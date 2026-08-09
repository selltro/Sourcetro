(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRADING_SCOPE = "https://api.ebay.com/oauth/api_scope";
  let busy = false;
  let lastStatus = null;

  function ownerKey() {
    try {
      return sessionStorage.getItem(OWNER_KEY_STORAGE) || "";
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
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `eBay request failed (${response.status}).`);
      error.details = data;
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

    button.disabled = busy;
    if (busy) {
      button.textContent = "Importing from eBay…";
    } else if (!ownerKey()) {
      button.textContent = "Unlock to import eBay";
    } else if (lastStatus?.connected && !hasTradingScope(lastStatus)) {
      button.textContent = "Enable eBay import";
    } else {
      button.textContent = "Import from eBay";
    }
  }

  async function refreshStatus() {
    if (!ownerKey()) {
      lastStatus = null;
      decorateInventory();
      return;
    }
    try {
      lastStatus = await gateway("/status", { method: "GET" });
    } catch {
      lastStatus = null;
    }
    decorateInventory();
  }

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
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
        photo: remotePhoto(ebay.pictureUrl) || existing?.photo || null,
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

    const persistent = state.inventory.map((item) => ({
      ...item,
      photo: remotePhoto(item.photo),
    }));
    saveJSON("sourcetro_inventory", persistent);
    return { added, updated };
  }

  async function enableTradingImport() {
    const result = await gateway("/oauth/start", { method: "POST", body: "{}" });
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
      showToast(`eBay import complete: ${added} added, ${updated} refreshed.`);
    } catch (error) {
      const needsReconnect = Boolean(error.details?.needsReconnect);
      if (needsReconnect) {
        const approved = window.confirm("eBay needs refreshed permission before SourceTro can read your active listings. Reconnect now? Your live listings will not be changed.");
        if (approved) await enableTradingImport();
      } else {
        showToast(error.message || "SourceTro could not import your eBay listings.");
      }
    } finally {
      busy = false;
      decorateInventory();
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="import-ebay-active"]');
    if (!button) return;
    event.preventDefault();
    importActiveListings();
  });

  const observer = new MutationObserver(() => {
    if (typeof state !== "undefined" && state.route === "inventory") decorateInventory();
  });
  observer.observe(page, { childList: true, subtree: true });

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      decorateInventory();
      if (location.hash.replace("#", "") === "inventory") refreshStatus();
    }, 80);
  });

  setTimeout(() => {
    decorateInventory();
    refreshStatus();
  }, 900);
})();
