(() => {
  let saveBusy = false;

  function existingItem() {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.id) return null;
    return state.inventory.find((item) => item.id === state.listing.id || (state.listing.ebayItemId && item.ebayItemId === state.listing.ebayItemId)) || null;
  }

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  async function saveCurrentEdit() {
    if (saveBusy) return;
    const original = existingItem();
    if (!original) return;

    saveBusy = true;
    decorate();
    try {
      const remotePhotos = Array.isArray(state.photos)
        ? state.photos.map((photo) => remotePhoto(photo?.url)).filter(Boolean)
        : [];

      const record = {
        ...original,
        ...state.listing,
        id: original.id,
        status: original.status || state.listing.status || "Draft",
        photo: remotePhotos[0] || original.photo || null,
        ebayPictureUrls: remotePhotos.length ? remotePhotos : (original.ebayPictureUrls || []),
        updatedAt: new Date().toISOString(),
      };

      const index = state.inventory.findIndex((item) => item.id === original.id);
      if (index >= 0) state.inventory[index] = record;

      const persistent = state.inventory.map((item) => ({
        ...item,
        photo: remotePhoto(item.photo),
        ebayPictureUrls: Array.isArray(item.ebayPictureUrls)
          ? item.ebayPictureUrls.map(remotePhoto).filter(Boolean)
          : [],
      }));

      saveJSON("sourcetro_inventory", persistent);

      if (window.SourceTroCloud?.syncNow) {
        await window.SourceTroCloud.syncNow();
      }

      setRoute("inventory");
      showToast(state.listing?.ebayItemId
        ? "Saved in SourceTro and synced. Your live eBay listing was not changed."
        : "Changes saved and synced across your SourceTro devices.");
    } finally {
      saveBusy = false;
      setTimeout(decorate, 0);
    }
  }

  function decorate() {
    const item = existingItem();
    const header = document.querySelector(".page-header");
    if (!item || !header) return;

    let button = header.querySelector('[data-action="save-current-edit"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.dataset.action = "save-current-edit";
      button.style.marginLeft = "8px";
      header.appendChild(button);
    }

    button.disabled = saveBusy;
    button.textContent = saveBusy ? "Saving…" : "Save changes";
    button.title = item.ebayItemId
      ? "Save these changes in SourceTro only. This does not change the live eBay listing."
      : "Save these changes and sync them to your other SourceTro devices.";
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="save-current-edit"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveCurrentEdit();
  }, true);

  const observer = new MutationObserver(() => setTimeout(decorate, 0));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(decorate, 50));
  window.addEventListener("pageshow", () => setTimeout(decorate, 100));
  setTimeout(decorate, 300);
})();