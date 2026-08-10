(() => {
  function isImportedEbayEdit() {
    return typeof state !== "undefined"
      && state.route === "new-listing"
      && Boolean(state.listing?.ebayItemId);
  }

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function saveImportedItemLocally() {
    const itemId = state.listing.ebayItemId;
    const id = state.listing.id || `EBAY-${itemId}`;
    const existingIndex = state.inventory.findIndex((item) => item.id === id || item.ebayItemId === itemId);
    const existing = existingIndex >= 0 ? state.inventory[existingIndex] : {};
    const remotePhotos = state.photos.map((photo) => remotePhoto(photo.url)).filter(Boolean);
    const record = {
      ...existing,
      ...state.listing,
      id,
      ebayItemId: itemId,
      status: existing.status || "Listed",
      title: state.listing.title || existing.title || `eBay item ${itemId}`,
      photo: remotePhotos[0] || existing.photo || null,
      ebayPictureUrls: remotePhotos.length ? remotePhotos : (existing.ebayPictureUrls || []),
      updatedAt: new Date().toISOString(),
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
    setRoute("inventory");
    showToast("Saved in SourceTro. Your live eBay listing was not changed.");
  }

  function decorateImportedStepFive() {
    if (!isImportedEbayEdit() || state.wizardStep !== 5) return;

    const saveButton = document.querySelector('[data-action="save-draft"]');
    const prepareButton = document.querySelector('[data-action="publish-listing"]');
    if (saveButton && saveButton.textContent !== "Save in SourceTro") {
      saveButton.textContent = "Save in SourceTro";
    }
    if (prepareButton && prepareButton.textContent !== "Update eBay →") {
      prepareButton.textContent = "Update eBay →";
      prepareButton.title = "This button will be connected to a confirmed eBay update step next.";
    }

    const footer = prepareButton?.closest?.(".wizard-footer");
    if (footer && !footer.querySelector("[data-ebay-edit-note]")) {
      const note = document.createElement("p");
      note.dataset.ebayEditNote = "true";
      note.className = "muted";
      note.style.margin = "10px 0 0";
      note.style.width = "100%";
      note.textContent = "Imported eBay listing: saving here changes SourceTro only. Updating eBay will require a separate confirmation.";
      footer.appendChild(note);
    }
  }

  document.addEventListener("click", (event) => {
    if (!isImportedEbayEdit()) return;
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "save-draft") {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveImportedItemLocally();
      return;
    }

    if (action === "publish-listing") {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast("Your live eBay listing was not changed. The confirmed eBay update step is being connected next.");
      return;
    }

    if (action === "wizard-next" || action === "wizard-back") {
      setTimeout(decorateImportedStepFive, 0);
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (isImportedEbayEdit() && state.wizardStep === 5) decorateImportedStepFive();
  });

  if (typeof page !== "undefined" && page) {
    observer.observe(page, { childList: true, subtree: true });
  }

  window.addEventListener("hashchange", () => setTimeout(decorateImportedStepFive, 40));
  window.addEventListener("pageshow", () => setTimeout(decorateImportedStepFive, 40));
  setTimeout(decorateImportedStepFive, 250);
})();