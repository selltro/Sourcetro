(() => {
  let saveBusy = false;
  let refreshTimer = null;
  let decorateTimer = null;

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function editButtonForRow(row) {
    return row?.querySelector?.('[data-edit-item]') || null;
  }

  function existingItem() {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.id) return null;
    return state.inventory.find((item) =>
      item.id === state.listing.id ||
      (state.listing.ebayItemId && item.ebayItemId === state.listing.ebayItemId)
    ) || null;
  }

  function removeSaveBar() {
    document.querySelector("#sourceTroEditSaveBar")?.remove();
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

  function ensureSaveBar() {
    const item = existingItem();
    if (!item) {
      removeSaveBar();
      return;
    }

    let bar = document.querySelector("#sourceTroEditSaveBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "sourceTroEditSaveBar";
      bar.style.position = "fixed";
      bar.style.left = "12px";
      bar.style.right = "12px";
      bar.style.bottom = "76px";
      bar.style.zIndex = "9999";
      bar.style.display = "flex";
      bar.style.alignItems = "center";
      bar.style.justifyContent = "space-between";
      bar.style.gap = "10px";
      bar.style.padding = "10px 12px";
      bar.style.borderRadius = "16px";
      bar.style.background = "#16283a";
      bar.style.boxShadow = "0 12px 30px rgba(0,0,0,.24)";
      bar.innerHTML = `
        <div style="min-width:0;color:white">
          <strong style="display:block;font-size:14px">Editing inventory item</strong>
          <small data-save-note style="display:block;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48vw"></small>
        </div>
        <button type="button" class="button" data-action="save-current-edit" style="white-space:nowrap;min-height:44px">Save changes</button>`;
      document.body.appendChild(bar);
    }

    const note = bar.querySelector("[data-save-note]");
    if (note) note.textContent = item.ebayItemId ? "Saves to SourceTro only" : "Saves and syncs";

    const button = bar.querySelector('[data-action="save-current-edit"]');
    if (button) {
      button.disabled = saveBusy;
      const wanted = saveBusy ? "Saving…" : "Save changes";
      if (button.textContent !== wanted) button.textContent = wanted;
    }
  }

  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => {
      decorateRows();
      ensureSaveBar();
    }, 80);
  }

  async function saveCurrentEdit() {
    if (saveBusy) return;
    const original = existingItem();
    if (!original) {
      if (typeof showToast === "function") showToast("Open an inventory item first.");
      return;
    }

    saveBusy = true;
    ensureSaveBar();

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
      if (index < 0) throw new Error("SourceTro could not find that inventory item.");
      state.inventory[index] = record;

      const persistent = state.inventory.map((item) => ({
        ...item,
        photo: remotePhoto(item.photo),
        ebayPictureUrls: Array.isArray(item.ebayPictureUrls)
          ? item.ebayPictureUrls.map(remotePhoto).filter(Boolean)
          : [],
      }));

      saveJSON("sourcetro_inventory", persistent);

      let cloudSaved = false;
      if (window.SourceTroCloud?.syncNow) {
        await window.SourceTroCloud.syncNow();
        cloudSaved = Boolean(window.SourceTroCloud.status?.().remembered);
      }

      setRoute("inventory");
      removeSaveBar();
      if (typeof showToast === "function") {
        showToast(cloudSaved
          ? "Saved. Your SourceTro devices will update from the cloud."
          : "Saved on this phone. Cloud sync is locked on this device.");
      }
    } catch (error) {
      if (typeof showToast === "function") showToast(error?.message || "SourceTro could not save that change.");
    } finally {
      saveBusy = false;
      scheduleDecorate();
    }
  }

  async function refreshFromCloud() {
    if (document.visibilityState !== "visible") return;
    if (typeof state !== "undefined" && state.route === "new-listing" && existingItem()) return;
    if (!window.SourceTroCloud?.refreshFromCloud) return;
    try {
      await window.SourceTroCloud.refreshFromCloud();
      scheduleDecorate();
    } catch {}
  }

  function startRefreshLoop() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshFromCloud, 7000);
  }

  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest('[data-action="save-current-edit"]');
    if (saveButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveCurrentEdit();
      return;
    }

    if (event.target.closest('[data-edit-item]')) {
      setTimeout(scheduleDecorate, 120);
      return;
    }
    if (event.target.closest("button, a, input, select, textarea, label")) return;

    const row = event.target.closest("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;

    event.preventDefault();
    editButton.click();
    setTimeout(scheduleDecorate, 120);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const row = event.target.closest?.("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;
    event.preventDefault();
    editButton.click();
    setTimeout(scheduleDecorate, 120);
  });

  window.addEventListener("hashchange", scheduleDecorate);
  window.addEventListener("pageshow", () => {
    scheduleDecorate();
    setTimeout(refreshFromCloud, 250);
  });
  window.addEventListener("focus", () => setTimeout(refreshFromCloud, 180));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(refreshFromCloud, 180);
  });

  scheduleDecorate();
  startRefreshLoop();
})();
