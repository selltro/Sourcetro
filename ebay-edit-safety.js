(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  let updateBusy = false;

  function isImportedEbayEdit() {
    return typeof state !== "undefined"
      && state.route === "new-listing"
      && Boolean(state.listing?.ebayItemId);
  }

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

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function captureVisibleFormIntoListing() {
    if (!isImportedEbayEdit()) return;
    document.querySelectorAll("[data-bind]").forEach((field) => {
      const key = field.dataset.bind;
      if (!key) return;
      state.listing[key] = field.type === "checkbox" ? field.checked : field.value;
    });

    const marketplaceFields = [...document.querySelectorAll("[data-marketplace]")];
    if (marketplaceFields.length) {
      state.listing.marketplaces = marketplaceFields
        .filter((field) => field.checked)
        .map((field) => field.dataset.marketplace)
        .filter(Boolean);
    }
  }

  function originalInventoryItem() {
    if (!isImportedEbayEdit()) return null;
    return state.inventory.find((item) => item.id === state.listing.id || item.ebayItemId === state.listing.ebayItemId) || null;
  }

  function persistImportedItem(liveItem = null) {
    captureVisibleFormIntoListing();
    const itemId = state.listing.ebayItemId;
    const id = state.listing.id || `EBAY-${itemId}`;
    const existingIndex = state.inventory.findIndex((item) => item.id === id || item.ebayItemId === itemId);
    const existing = existingIndex >= 0 ? state.inventory[existingIndex] : {};
    const remotePhotos = Array.isArray(state.photos)
      ? state.photos.map((photo) => remotePhoto(photo.url)).filter(Boolean)
      : [];
    const now = new Date().toISOString();

    const record = {
      ...existing,
      ...state.listing,
      id,
      ebayItemId: itemId,
      status: existing.status || "Listed",
      title: liveItem?.title || state.listing.title || existing.title || `eBay item ${itemId}`,
      listPrice: liveItem?.price || state.listing.listPrice || existing.listPrice || "",
      description: liveItem?.description || state.listing.description || existing.description || "",
      ebayDescription: liveItem?.description || existing.ebayDescription || state.listing.description || "",
      ebayDescriptionHtml: liveItem?.descriptionHtml || existing.ebayDescriptionHtml || "",
      photo: remotePhotos[0] || remotePhoto(existing.photo) || null,
      ebayPictureUrls: remotePhotos.length ? remotePhotos : (existing.ebayPictureUrls || []),
      ebayItemSpecifics: liveItem?.itemSpecifics || existing.ebayItemSpecifics || state.listing.ebayItemSpecifics || {},
      ebayUrl: liveItem?.viewItemUrl || existing.ebayUrl || state.listing.ebayUrl || "",
      ebayLiveTitle: liveItem?.title || existing.ebayLiveTitle || existing.title || "",
      ebayLivePrice: liveItem?.price || existing.ebayLivePrice || existing.listPrice || "",
      ebayLiveDescription: liveItem?.description || existing.ebayLiveDescription || existing.ebayDescription || existing.description || "",
      ebayLiveCondition: liveItem?.condition || existing.ebayLiveCondition || "",
      ebayCategoryName: liveItem?.categoryName || existing.ebayCategoryName || "",
      sourceTroEditedAt: now,
      updatedAt: now,
    };

    if (existingIndex >= 0) state.inventory[existingIndex] = record;
    else state.inventory.unshift(record);

    const persistent = state.inventory.map((item) => ({
      ...item,
      photo: remotePhoto(item.photo),
      ebayPictureUrls: Array.isArray(item.ebayPictureUrls)
        ? item.ebayPictureUrls.map(remotePhoto).filter(Boolean)
        : [],
    }));
    saveJSON("sourcetro_inventory", persistent);
    return record;
  }

  async function saveImportedItemLocally() {
    persistImportedItem();
    try { localStorage.setItem("sourcetro_sync_dirty", "1"); } catch {}
    if (window.SourceTroCloud?.syncNow) {
      try { await window.SourceTroCloud.syncNow(); } catch {}
    }
    setRoute("inventory");
    showToast("Saved in SourceTro. Your live eBay listing was not changed.");
  }

  function collectLiveChanges() {
    captureVisibleFormIntoListing();
    const original = originalInventoryItem();
    if (!original) return {};
    const changes = {};

    const currentTitle = String(state.listing.title || "").trim();
    const originalTitle = String(original.ebayLiveTitle || original.title || "").trim();
    if (currentTitle && currentTitle !== originalTitle) changes.title = currentTitle;

    const currentDescription = String(state.listing.description || "").trim();
    const originalDescription = String(original.ebayLiveDescription || original.ebayDescription || original.description || "").trim();
    if (currentDescription && currentDescription !== originalDescription) changes.description = currentDescription;

    const currentPrice = Number(state.listing.listPrice || 0);
    const originalPrice = Number(original.ebayLivePrice || original.listPrice || 0);
    if (currentPrice > 0 && Math.abs(currentPrice - originalPrice) >= 0.005) changes.price = currentPrice;

    return changes;
  }

  function confirmationText(changes) {
    const lines = [`This will change your LIVE eBay listing ${state.listing.ebayItemId}.`, "", "Changes:"];
    if (Object.prototype.hasOwnProperty.call(changes, "title")) lines.push(`• Title: ${changes.title}`);
    if (Object.prototype.hasOwnProperty.call(changes, "price")) lines.push(`• Price: $${Number(changes.price).toFixed(2)}`);
    if (Object.prototype.hasOwnProperty.call(changes, "description")) lines.push("• Description: replace the current eBay description");
    lines.push("", "No other eBay fields will be changed.", "", "Continue with this live update?");
    return lines.join("\n");
  }

  async function reviseLiveEbayListing() {
    if (updateBusy || !isImportedEbayEdit()) return;
    if (!ownerKey()) {
      showToast("Unlock SourceTro secure access first, then try the eBay update again.");
      return;
    }

    const changes = collectLiveChanges();
    if (!Object.keys(changes).length) {
      showToast("No eBay title, description, or price changes were detected.");
      return;
    }

    const approved = window.confirm(confirmationText(changes));
    if (!approved) {
      showToast("eBay was not changed.");
      return;
    }

    updateBusy = true;
    decorateImportedStepFive();
    try {
      const response = await fetch(`${EBAY_GATEWAY_URL}/ebay/listings/revise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SourceTro-Key": ownerKey(),
        },
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({ itemId: state.listing.ebayItemId, changes }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.needsReconnect) {
          throw new Error("eBay authorization needs to be refreshed. Save in SourceTro first, then reconnect eBay from Marketplaces.");
        }
        throw new Error(result.error || `eBay update failed (${response.status}).`);
      }

      persistImportedItem(result.item || null);
      if (window.SourceTroCloud?.syncNow) {
        try { await window.SourceTroCloud.syncNow(); } catch {}
      }
      setRoute("inventory");
      const fields = Array.isArray(result.changedFields) ? result.changedFields.join(", ") : "listing";
      showToast(`eBay updated successfully: ${fields}.`);
    } catch (error) {
      showToast(error?.message || "SourceTro could not update the live eBay listing.");
    } finally {
      updateBusy = false;
      setTimeout(decorateImportedStepFive, 0);
    }
  }

  function decorateImportedStepFive() {
    if (!isImportedEbayEdit() || state.wizardStep !== 5) return;

    const saveButton = document.querySelector('[data-action="save-draft"]');
    const updateButton = document.querySelector('[data-action="publish-listing"]');

    if (saveButton && saveButton.textContent !== "Save in SourceTro") saveButton.textContent = "Save in SourceTro";

    if (updateButton) {
      updateButton.disabled = updateBusy;
      updateButton.textContent = updateBusy ? "Updating eBay…" : "Update eBay →";
      updateButton.title = "Updates only the live eBay title, description, or price after you confirm the exact changes.";
    }

    const footer = updateButton?.closest?.(".wizard-footer");
    if (footer && !footer.querySelector("[data-ebay-edit-note]")) {
      const note = document.createElement("p");
      note.dataset.ebayEditNote = "true";
      note.className = "muted";
      note.style.margin = "10px 0 0";
      note.style.width = "100%";
      note.textContent = "Save in SourceTro keeps every SourceTro field. Update eBay changes only title, description, or price and asks you to confirm first.";
      footer.appendChild(note);
    }
  }

  document.addEventListener("click", (event) => {
    if (!isImportedEbayEdit()) return;
    const action = event.target.closest?.("[data-action]")?.dataset.action;

    if (action === "save-draft") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveImportedItemLocally();
      return;
    }

    if (action === "publish-listing") {
      event.preventDefault();
      event.stopImmediatePropagation();
      reviseLiveEbayListing();
      return;
    }

    setTimeout(decorateImportedStepFive, 0);
  }, true);

  window.addEventListener("hashchange", () => setTimeout(decorateImportedStepFive, 40));
  window.addEventListener("pageshow", () => setTimeout(decorateImportedStepFive, 40));
  setTimeout(decorateImportedStepFive, 250);
})();
