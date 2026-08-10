(() => {
  let saveBusy = false;
  let refreshTimer = null;

  function editButtonForRow(row) {
    return row?.querySelector?.('[data-edit-item]') || null;
  }

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function existingItem() {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.id) return null;
    return state.inventory.find((item) =>
      item.id === state.listing.id ||
      (state.listing.ebayItemId && item.ebayItemId === state.listing.ebayItemId)
    ) || null;
  }

  function decorateRows() {
    document.querySelectorAll("#inventoryResults .data-table tbody tr").forEach((row) => {
      if (!editButtonForRow(row)) return;
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", "Open item for editing");
      row.style.cursor = "pointer";
    });
  }

  function decorateSaveButton() {
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
      ? "Save in SourceTro only. This does not change the live eBay listing."
      : "Save and sync this item across SourceTro devices.";
  }

  async function saveCurrentEdit() {
    if (saveBusy) return;
    const original = existingItem();
    if (!original) return;

    saveBusy = true;
    decorateSaveButton();

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

      const wasEbay = Boolean(record.ebayItemId);
      setRoute("inventory");
      showToast(wasEbay
        ? "Saved in SourceTro and synced. Your live eBay listing was not changed."
        : "Changes saved and synced across your SourceTro devices.");
    } catch (error) {
      showToast(error?.message || "SourceTro could not save that change. Please try again.");
    } finally {
      saveBusy = false;
      setTimeout(() => {
        decorateRows();
        decorateSaveButton();
      }, 0);
    }
  }

  async function refreshFromCloud() {
    if (document.visibilityState !== "visible") return;
    if (!window.SourceTroCloud?.refreshFromCloud) return;
    try {
      await window.SourceTroCloud.refreshFromCloud();
    } catch {}
  }

  function startRefreshLoop() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshFromCloud, 6000);
  }

  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest('[data-action="save-current-edit"]');
    if (saveButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveCurrentEdit();
      return;
    }

    if (event.target.closest('[data-edit-item]')) return;
    if (event.target.closest("button, a, input, select, textarea, label")) return;

    const row = event.target.closest("#inventoryResults .data-table tbody tr");
    if (!row) return;

    const editButton = editButtonForRow(row);
    if (!editButton) return;

    event.preventDefault();
    editButton.click();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const row = event.target.closest?.("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;
    event.preventDefault();
    editButton.click();
  });

  const observer = new MutationObserver(() => {
    decorateRows();
    decorateSaveButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("pageshow", () => {
    setTimeout(() => {
      decorateRows();
      decorateSaveButton();
      refreshFromCloud();
    }, 100);
  });

  window.addEventListener("hashchange", () => setTimeout(() => {
    decorateRows();
    decorateSaveButton();
  }, 100));

  window.addEventListener("focus", () => setTimeout(refreshFromCloud, 100));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(refreshFromCloud, 100);
  });

  setTimeout(() => {
    decorateRows();
    decorateSaveButton();
    refreshFromCloud();
  }, 300);
  startRefreshLoop();
})();