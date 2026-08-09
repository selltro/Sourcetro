(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRADING_SCOPE = "https://api.ebay.com/oauth/api_scope";
  let busy = false;
  let editBusy = false;
  let lastStatus = null;

  function ownerKey() {
    try { return sessionStorage.getItem(OWNER_KEY_STORAGE) || ""; } catch { return ""; }
  }

  async function gateway(path, options = {}) {
    const response = await fetch(`${EBAY_GATEWAY_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": ownerKey(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `eBay request failed (${response.status}).`);
      error.ebayDetails = data;
      throw error;
    }
    return data;
  }

  function hasTradingScope(status) {
    return Array.isArray(status?.scopes) && status.scopes.includes(TRADING_SCOPE);
  }

  function importButton() {
    return document.querySelector('[data-action="import-ebay-active"]');
  }

  function setButtonText(button, text) {
    if (button && button.textContent !== text) button.textContent = text;
  }

  function syncRouteFromHash() {
    if (typeof state === "undefined" || typeof render !== "function") return;
    const route = location.hash.replace("#", "") || "dashboard";
    if (state.route !== route) {
      state.route = route;
      render();
    }
  }

  function decorateInventory() {
    if (typeof state === "undefined" || state.route !== "inventory") return;
    const header = page?.querySelector?.(".page-header");
    if (!header) return;
    let button = importButton();
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary";
      button.dataset.action = "import-ebay-active";
      button.style.marginRight = "8px";
      const addButton = header.querySelector('[data-route="new-listing"]');
      if (addButton) header.insertBefore(button, addButton);
      else header.appendChild(button);
    }
    if (button.disabled !== busy) button.disabled = busy;
    let label = "Import from eBay";
    if (busy) label = "Importing from eBay…";
    else if (!ownerKey()) label = "Unlock to import eBay";
    else if (lastStatus?.connected && !hasTradingScope(lastStatus)) label = "Enable eBay import";
    setButtonText(button, label);
  }

  async function refreshStatus() {
    if (!ownerKey()) {
      lastStatus = null;
      decorateInventory();
      return;
    }
    try { lastStatus = await gateway("/status", { method: "GET" }); } catch { lastStatus = null; }
    decorateInventory();
  }

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function firstSpecific(specifics, ...names) {
    for (const name of names) {
      const value = specifics?.[name];
      if (Array.isArray(value) && value.length) return String(value[0] || "");
      if (value) return String(value);
    }
    const wanted = names.map((name) => name.toLowerCase());
    for (const [name, value] of Object.entries(specifics || {})) {
      if (!wanted.includes(name.toLowerCase())) continue;
      if (Array.isArray(value) && value.length) return String(value[0] || "");
      if (value) return String(value);
    }
    return "";
  }

  function sourceTroCondition(value = "") {
    const text = String(value).toLowerCase();
    if (/new.*tag/.test(text)) return "New with tags";
    if (/new/.test(text)) return "New without tags";
    if (/excellent|like new/.test(text)) return "Pre-owned - Excellent";
    if (/fair|acceptable|poor/.test(text)) return "Pre-owned - Fair";
    return "Pre-owned - Good";
  }

  function sourceTroCategory(categoryName = "", specifics = {}) {
    const category = String(categoryName).toLowerCase();
    const department = firstSpecific(specifics, "Department").toLowerCase();
    if (/shoe|sneaker|boot|sandal|heel|slipper/.test(category)) return "Shoes";
    if (/handbag|purse|bag|wallet/.test(category)) return "Handbags";
    if (/accessor|belt|hat|scarf|glove|jewelry|watch/.test(category)) return "Accessories";
    if (/home|kitchen|decor|collectible|cup|mug|tumbler/.test(category)) return "Home";
    if (/kid|boy|girl|baby|toddler|child/.test(department)) return "Kids' Clothing";
    if (/men|man|male/.test(department)) return "Men's Clothing";
    if (/women|woman|female/.test(department)) return "Women's Clothing";
    if (/clothing|jean|shirt|top|dress|pant|short|jacket|coat|sweater|jersey|skirt/.test(category)) return "Women's Clothing";
    return "Other";
  }

  function mergeListings(listings) {
    let added = 0;
    let updated = 0;
    const now = new Date().toISOString();
    for (const ebay of listings) {
      if (!ebay?.itemId) continue;
      const fallbackId = `EBAY-${ebay.itemId}`;
      const index = state.inventory.findIndex((item) => item.ebayItemId === ebay.itemId || item.id === fallbackId);
      const existing = index >= 0 ? state.inventory[index] : null;
      const markets = new Set([...(existing?.marketplaces || []), "eBay"]);
      const pictures = Array.isArray(ebay.pictureUrls) ? ebay.pictureUrls.filter(remotePhoto) : [];
      const record = {
        ...(existing || {}),
        id: existing?.id || fallbackId,
        ebayItemId: ebay.itemId,
        ebayUrl: ebay.viewItemUrl || `https://www.ebay.com/itm/${ebay.itemId}`,
        title: ebay.title || existing?.title || `eBay item ${ebay.itemId}`,
        status: "Listed",
        listPrice: ebay.price || existing?.listPrice || "",
        sku: ebay.sku || existing?.sku || fallbackId,
        condition: ebay.condition || existing?.condition || "",
        category: ebay.categoryName || existing?.category || "",
        marketplaces: [...markets],
        photo: pictures[0] || remotePhoto(ebay.pictureUrl) || existing?.photo || null,
        ebayPictureUrls: pictures,
        ebayItemSpecifics: ebay.itemSpecifics || existing?.ebayItemSpecifics || {},
        ebayQuantityAvailable: Number(ebay.quantityAvailable || 0),
        ebayWatchCount: Number(ebay.watchCount || 0),
        ebayListingType: ebay.listingType || "",
        ebayCategoryId: ebay.categoryId || "",
        ebayStartTime: ebay.startTime || "",
        ebayEndTime: ebay.endTime || "",
        importedFrom: "eBay",
        ebayImportedAt: existing?.ebayImportedAt || now,
        updatedAt: now,
      };
      if (index >= 0) {
        state.inventory[index] = record;
        updated += 1;
      } else {
        state.inventory.unshift(record);
        added += 1;
      }
    }
    const persistent = state.inventory.map((item) => ({ ...item, photo: remotePhoto(item.photo) }));
    saveJSON("sourcetro_inventory", persistent);
    return { added, updated };
  }

  async function enableTradingImport() {
    const result = await gateway("/oauth/start", { method: "POST", body: JSON.stringify({ returnRoute: "inventory" }) });
    if (!result.authUrl) throw new Error("eBay did not return a permission link.");
    window.location.assign(result.authUrl);
  }

  async function importActiveListings() {
    if (busy) return;
    if (!ownerKey()) {
      showToast("Unlock SourceTro secure access first, then import from eBay.");
      return;
    }
    busy = true;
    decorateInventory();
    try {
      lastStatus = await gateway("/status", { method: "GET" });
      if (!lastStatus.connected) {
        showToast("Connect eBay first, then import your active listings.");
        return;
      }
      if (!hasTradingScope(lastStatus)) {
        const approved = window.confirm("eBay needs one additional read permission so SourceTro can copy your current active listings into Inventory. This will not edit, end, or publish any eBay listings. Continue?");
        if (!approved) return;
        await enableTradingImport();
        return;
      }
      const result = await gateway("/ebay/listings/active", { method: "GET" });
      const listings = Array.isArray(result.listings) ? result.listings : [];
      const { added, updated } = mergeListings(listings);
      render();
      decorateInventory();
      showToast(`eBay import complete: ${added} added, ${updated} refreshed.`);
    } catch (error) {
      const reconnect = Boolean(error?.ebayDetails?.needsReconnect);
      if (reconnect) {
        const approved = window.confirm("eBay needs refreshed permission before SourceTro can read your active listings. Reconnect now? Your live listings will not be changed.");
        if (approved) await enableTradingImport();
      } else {
        showToast(error?.message || "SourceTro could not import your eBay listings.");
      }
    } finally {
      busy = false;
      decorateInventory();
    }
  }

  function updateStoredItem(item, details) {
    const pictures = Array.isArray(details.pictureUrls) ? details.pictureUrls.filter(remotePhoto) : [];
    const specifics = details.itemSpecifics || {};
    const updated = {
      ...item,
      title: details.title || item.title,
      listPrice: details.price || item.listPrice,
      sku: details.sku || item.sku,
      condition: details.condition || item.condition,
      category: details.categoryName || item.category,
      photo: pictures[0] || item.photo || null,
      ebayPictureUrls: pictures,
      ebayItemSpecifics: specifics,
      ebayDescription: details.description || "",
      ebayDescriptionHtml: details.descriptionHtml || "",
      ebayCategoryId: details.categoryId || item.ebayCategoryId || "",
      ebayQuantityAvailable: Number(details.quantityAvailable || item.ebayQuantityAvailable || 0),
      ebayWatchCount: Number(details.watchCount || item.ebayWatchCount || 0),
      ebayUrl: details.viewItemUrl || item.ebayUrl,
      updatedAt: new Date().toISOString(),
    };
    const index = state.inventory.findIndex((record) => record.id === item.id);
    if (index >= 0) state.inventory[index] = updated;
    saveJSON("sourcetro_inventory", state.inventory.map((record) => ({ ...record, photo: remotePhoto(record.photo) })));
    return updated;
  }

  function openFullEbayEditor(item, details) {
    const specifics = details.itemSpecifics || {};
    const category = sourceTroCategory(details.categoryName || item.category, specifics);
    const pictures = Array.isArray(details.pictureUrls) ? details.pictureUrls.filter(remotePhoto) : [];
    state.listing = {
      ...listingDefaults,
      ...item,
      title: details.title || item.title || "",
      description: details.description || item.ebayDescription || "",
      listPrice: details.price || item.listPrice || "",
      sku: details.sku || item.sku || "",
      condition: sourceTroCondition(details.condition || item.condition),
      category,
      brand: firstSpecific(specifics, "Brand") || item.brand || "",
      size: firstSpecific(specifics, "Size", "US Size") || item.size || "",
      color: firstSpecific(specifics, "Color", "Colour") || item.color || "",
      material: firstSpecific(specifics, "Material", "Fabric Type") || item.material || "",
      styleModel: firstSpecific(specifics, "Style", "Model", "Model Number") || item.styleModel || "",
      itemType: firstSpecific(specifics, "Type", "Product") || item.itemType || details.categoryName || "",
      marketplaces: ["eBay"],
      ebayItemId: item.ebayItemId,
      ebayUrl: details.viewItemUrl || item.ebayUrl || "",
      ebayItemSpecifics: specifics,
      ebayDescriptionHtml: details.descriptionHtml || "",
    };
    state.photos = pictures.map((url, index) => ({ name: `eBay photo ${index + 1}`, url, importedFromEbay: true }));
    state.measurementPhotos = [];
    state.measurementResult = null;
    state.measurementError = "";
    state.generated = Boolean(state.listing.title && state.listing.description);
    state.wizardStep = 3;
    setRoute("new-listing");
    showToast(`Loaded ${state.photos.length} eBay photo${state.photos.length === 1 ? "" : "s"} and the listing details.`);
  }

  async function editImportedEbayItem(item) {
    if (editBusy) return;
    if (!ownerKey()) {
      showToast("Unlock SourceTro secure access first.");
      return;
    }
    editBusy = true;
    showToast("Loading the full eBay listing…");
    try {
      const result = await gateway(`/ebay/listings/item?item_id=${encodeURIComponent(item.ebayItemId)}`, { method: "GET" });
      const details = result.item || {};
      const updated = updateStoredItem(item, details);
      openFullEbayEditor(updated, details);
    } catch (error) {
      const reconnect = Boolean(error?.ebayDetails?.needsReconnect);
      if (reconnect) {
        const approved = window.confirm("eBay needs refreshed permission before SourceTro can read the full listing. Reconnect now? Your live listing will not be changed.");
        if (approved) await enableTradingImport();
      } else {
        showToast(error?.message || "SourceTro could not load that eBay listing.");
      }
    } finally {
      editBusy = false;
    }
  }

  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-item]");
    if (!edit || typeof state === "undefined") return;
    const item = state.inventory.find((record) => record.id === edit.dataset.editItem);
    if (!item?.ebayItemId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editImportedEbayItem(item);
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="import-ebay-active"]');
    if (!button) return;
    event.preventDefault();
    importActiveListings();
  });

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      syncRouteFromHash();
      decorateInventory();
      if (location.hash.replace("#", "") === "inventory") refreshStatus();
    }, 60);
  });

  window.addEventListener("pageshow", () => {
    setTimeout(() => {
      syncRouteFromHash();
      decorateInventory();
      if (location.hash.replace("#", "") === "inventory") refreshStatus();
    }, 60);
  });

  setTimeout(() => {
    syncRouteFromHash();
    decorateInventory();
    if (location.hash.replace("#", "") === "inventory") refreshStatus();
  }, 300);
})();