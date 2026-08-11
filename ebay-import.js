(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const TRADING_SCOPE = "https://api.ebay.com/oauth/api_scope";
  const CATEGORIES = ["Women's Clothing", "Men's Clothing", "Kids' Clothing", "Shoes", "Handbags", "Accessories", "Home", "Other"];
  let busy = false;
  let editBusy = false;
  let lastStatus = null;

  function ownerKey() {
    try {
      const session = sessionStorage.getItem(OWNER_KEY_STORAGE) || "";
      if (session) return session;
      const trusted = localStorage.getItem(TRUSTED_OWNER_KEY) || "";
      if (trusted) sessionStorage.setItem(OWNER_KEY_STORAGE, trusted);
      return trusted;
    } catch {
      return "";
    }
  }

  async function gateway(path, options = {}) {
    const response = await fetch(`${EBAY_GATEWAY_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": ownerKey(),
        ...(options.headers || {}),
      },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
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

  function normalizedCategory(value, categoryName, specifics) {
    return CATEGORIES.includes(value) ? value : sourceTroCategory(categoryName || value, specifics);
  }

  function hasSourceTroEdits(item) {
    return Boolean(item?.sourceTroEditedAt);
  }

  function localOrLive(existing, field, liveValue) {
    if (hasSourceTroEdits(existing) && Object.prototype.hasOwnProperty.call(existing || {}, field)) {
      return existing[field];
    }
    if (liveValue !== undefined && liveValue !== null && liveValue !== "") return liveValue;
    return existing?.[field] ?? "";
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
      const specifics = ebay.itemSpecifics || existing?.ebayItemSpecifics || {};
      const category = sourceTroCategory(ebay.categoryName || existing?.ebayCategoryName || existing?.category, specifics);
      const condition = sourceTroCondition(ebay.condition || existing?.ebayLiveCondition || existing?.condition);

      const record = {
        ...(existing || {}),
        id: existing?.id || fallbackId,
        ebayItemId: ebay.itemId,
        ebayUrl: ebay.viewItemUrl || existing?.ebayUrl || `https://www.ebay.com/itm/${ebay.itemId}`,
        title: localOrLive(existing, "title", ebay.title || `eBay item ${ebay.itemId}`),
        status: "Listed",
        listPrice: localOrLive(existing, "listPrice", ebay.price || ""),
        sku: localOrLive(existing, "sku", ebay.sku || fallbackId),
        condition: localOrLive(existing, "condition", condition),
        category: localOrLive(existing, "category", category),
        brand: localOrLive(existing, "brand", firstSpecific(specifics, "Brand")),
        size: localOrLive(existing, "size", firstSpecific(specifics, "Size", "US Size")),
        color: localOrLive(existing, "color", firstSpecific(specifics, "Color", "Colour")),
        material: localOrLive(existing, "material", firstSpecific(specifics, "Material", "Fabric Type")),
        styleModel: localOrLive(existing, "styleModel", firstSpecific(specifics, "Style", "Model", "Model Number")),
        itemType: localOrLive(existing, "itemType", firstSpecific(specifics, "Type", "Product") || ebay.categoryName || ""),
        marketplaces: [...markets],
        photo: pictures[0] || remotePhoto(ebay.pictureUrl) || existing?.photo || null,
        ebayPictureUrls: pictures.length ? pictures : (existing?.ebayPictureUrls || []),
        ebayItemSpecifics: specifics,
        ebayQuantityAvailable: Number(ebay.quantityAvailable || 0),
        ebayWatchCount: Number(ebay.watchCount || 0),
        ebayListingType: ebay.listingType || existing?.ebayListingType || "",
        ebayCategoryId: ebay.categoryId || existing?.ebayCategoryId || "",
        ebayCategoryName: ebay.categoryName || existing?.ebayCategoryName || "",
        ebayLiveCondition: ebay.condition || existing?.ebayLiveCondition || "",
        ebayLiveTitle: ebay.title || existing?.ebayLiveTitle || "",
        ebayLivePrice: ebay.price || existing?.ebayLivePrice || "",
        ebayStartTime: ebay.startTime || existing?.ebayStartTime || "",
        ebayEndTime: ebay.endTime || existing?.ebayEndTime || "",
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

    const persistent = state.inventory.map((item) => ({
      ...item,
      photo: remotePhoto(item.photo),
      ebayPictureUrls: Array.isArray(item.ebayPictureUrls) ? item.ebayPictureUrls.map(remotePhoto).filter(Boolean) : [],
    }));
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
    const edited = hasSourceTroEdits(item);
    const inferredCategory = sourceTroCategory(details.categoryName || item.ebayCategoryName || item.category, specifics);
    const inferredCondition = sourceTroCondition(details.condition || item.ebayLiveCondition || item.condition);

    const updated = {
      ...item,
      title: edited ? item.title : (details.title || item.title),
      listPrice: edited ? item.listPrice : (details.price || item.listPrice),
      sku: edited ? item.sku : (details.sku || item.sku),
      condition: edited ? item.condition : inferredCondition,
      category: edited ? normalizedCategory(item.category, details.categoryName, specifics) : inferredCategory,
      brand: edited ? item.brand : (firstSpecific(specifics, "Brand") || item.brand || ""),
      size: edited ? item.size : (firstSpecific(specifics, "Size", "US Size") || item.size || ""),
      color: edited ? item.color : (firstSpecific(specifics, "Color", "Colour") || item.color || ""),
      material: edited ? item.material : (firstSpecific(specifics, "Material", "Fabric Type") || item.material || ""),
      styleModel: edited ? item.styleModel : (firstSpecific(specifics, "Style", "Model", "Model Number") || item.styleModel || ""),
      itemType: edited ? item.itemType : (firstSpecific(specifics, "Type", "Product") || item.itemType || details.categoryName || ""),
      description: edited ? (item.description || item.ebayDescription || "") : (details.description || item.description || ""),
      photo: pictures[0] || item.photo || null,
      ebayPictureUrls: pictures.length ? pictures : (item.ebayPictureUrls || []),
      ebayItemSpecifics: specifics,
      ebayDescription: details.description || item.ebayDescription || "",
      ebayDescriptionHtml: details.descriptionHtml || item.ebayDescriptionHtml || "",
      ebayCategoryId: details.categoryId || item.ebayCategoryId || "",
      ebayCategoryName: details.categoryName || item.ebayCategoryName || "",
      ebayLiveCondition: details.condition || item.ebayLiveCondition || "",
      ebayLiveTitle: details.title || item.ebayLiveTitle || "",
      ebayLivePrice: details.price || item.ebayLivePrice || "",
      ebayLiveDescription: details.description || item.ebayLiveDescription || "",
      ebayQuantityAvailable: Number(details.quantityAvailable || item.ebayQuantityAvailable || 0),
      ebayWatchCount: Number(details.watchCount || item.ebayWatchCount || 0),
      ebayUrl: details.viewItemUrl || item.ebayUrl,
      updatedAt: new Date().toISOString(),
    };

    const index = state.inventory.findIndex((record) => record.id === item.id);
    if (index >= 0) state.inventory[index] = updated;
    saveJSON("sourcetro_inventory", state.inventory.map((record) => ({
      ...record,
      photo: remotePhoto(record.photo),
      ebayPictureUrls: Array.isArray(record.ebayPictureUrls) ? record.ebayPictureUrls.map(remotePhoto).filter(Boolean) : [],
    })));
    return updated;
  }

  function openFullEbayEditor(item, details) {
    const specifics = details.itemSpecifics || item.ebayItemSpecifics || {};
    const pictures = Array.isArray(details.pictureUrls) ? details.pictureUrls.filter(remotePhoto) : (item.ebayPictureUrls || []);
    const edited = hasSourceTroEdits(item);

    state.listing = {
      ...listingDefaults,
      ...item,
      title: edited ? (item.title || details.title || "") : (details.title || item.title || ""),
      description: edited ? (item.description || item.ebayDescription || details.description || "") : (details.description || item.ebayDescription || ""),
      listPrice: edited ? (item.listPrice || details.price || "") : (details.price || item.listPrice || ""),
      sku: edited ? (item.sku || details.sku || "") : (details.sku || item.sku || ""),
      condition: edited ? (item.condition || sourceTroCondition(details.condition)) : sourceTroCondition(details.condition || item.condition),
      category: edited ? normalizedCategory(item.category, details.categoryName, specifics) : sourceTroCategory(details.categoryName || item.category, specifics),
      brand: edited ? (item.brand || "") : (firstSpecific(specifics, "Brand") || item.brand || ""),
      size: edited ? (item.size || "") : (firstSpecific(specifics, "Size", "US Size") || item.size || ""),
      color: edited ? (item.color || "") : (firstSpecific(specifics, "Color", "Colour") || item.color || ""),
      material: edited ? (item.material || "") : (firstSpecific(specifics, "Material", "Fabric Type") || item.material || ""),
      styleModel: edited ? (item.styleModel || "") : (firstSpecific(specifics, "Style", "Model", "Model Number") || item.styleModel || ""),
      itemType: edited ? (item.itemType || "") : (firstSpecific(specifics, "Type", "Product") || item.itemType || details.categoryName || ""),
      marketplaces: Array.isArray(item.marketplaces) && item.marketplaces.length ? item.marketplaces : ["eBay"],
      ebayItemId: item.ebayItemId,
      ebayUrl: details.viewItemUrl || item.ebayUrl || "",
      ebayItemSpecifics: specifics,
      ebayDescriptionHtml: details.descriptionHtml || item.ebayDescriptionHtml || "",
    };

    state.photos = pictures.map((url, index) => ({ name: `eBay photo ${index + 1}`, url, importedFromEbay: true }));
    state.measurementPhotos = [];
    state.measurementResult = null;
    state.measurementError = "";
    state.generated = Boolean(state.listing.title && state.listing.description);
    state.wizardStep = 3;
    setRoute("new-listing");
    showToast(`Loaded ${state.photos.length} eBay photo${state.photos.length === 1 ? "" : "s"} and your saved SourceTro details.`);
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
