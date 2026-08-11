(() => {
  const INVENTORY_KEY = "sourcetro_inventory";
  let saveBusy = false;
  let refreshTimer = null;
  let decorateTimer = null;
  let lastLocalSaveAt = 0;

  function remotePhoto(value) {
    return /^https?:\/\//i.test(String(value || "")) ? value : null;
  }

  function editButtonForRow(row) {
    return row?.querySelector?.('[data-edit-item]') || null;
  }

  function existingItem() {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing) return null;
    return state.inventory.find((item) =>
      (state.listing.id && item.id === state.listing.id) ||
      (state.listing.ebayItemId && item.ebayItemId === state.listing.ebayItemId)
    ) || null;
  }

  function captureVisibleFormIntoListing() {
    const captured = {};
    if (typeof state === "undefined" || !state.listing) return captured;

    document.querySelectorAll("[data-bind]").forEach((field) => {
      const key = field.dataset.bind;
      if (!key) return;
      const value = field.type === "checkbox" ? field.checked : field.value;
      state.listing[key] = value;
      captured[key] = value;
    });

    const marketplaceFields = [...document.querySelectorAll("[data-marketplace]")];
    if (marketplaceFields.length) {
      const markets = marketplaceFields
        .filter((field) => field.checked)
        .map((field) => field.dataset.marketplace)
        .filter(Boolean);
      state.listing.marketplaces = markets;
      captured.marketplaces = markets;
    }

    return captured;
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
      row.style.touchAction = "manipulation";
    });
  }

  function styleCompactSaveBar(bar) {
    const mobile = window.matchMedia?.("(max-width: 760px)")?.matches;
    bar.style.position = "fixed";
    bar.style.left = "auto";
    bar.style.right = mobile ? "12px" : "22px";
    bar.style.bottom = mobile ? "82px" : "84px";
    bar.style.zIndex = "9999";
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.justifyContent = "flex-end";
    bar.style.gap = "10px";
    bar.style.width = "auto";
    bar.style.maxWidth = mobile ? "calc(100vw - 24px)" : "340px";
    bar.style.padding = "8px 9px 8px 12px";
    bar.style.borderRadius = "14px";
    bar.style.background = "#16283a";
    bar.style.boxShadow = "0 10px 24px rgba(0,0,0,.22)";
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
      bar.innerHTML = `
        <div data-save-copy style="min-width:0;color:white;line-height:1.15">
          <strong style="display:block;font-size:12px">Editing item</strong>
          <small data-save-note style="display:block;opacity:.72;font-size:10px;white-space:nowrap"></small>
        </div>
        <button type="button" class="button" data-action="save-current-edit" style="white-space:nowrap;min-height:40px;padding:0 16px;touch-action:manipulation">Save</button>`;
      document.body.appendChild(bar);
    }

    styleCompactSaveBar(bar);

    const note = bar.querySelector("[data-save-note]");
    if (note) note.textContent = item.ebayItemId ? "SourceTro only" : "Save & sync";

    const button = bar.querySelector('[data-action="save-current-edit"]');
    if (button) {
      button.disabled = saveBusy;
      button.textContent = saveBusy ? "Saving…" : "Save";
    }
  }

  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => {
      decorateRows();
      ensureSaveBar();
    }, 80);
  }

  function readStoredInventory() {
    try {
      const records = JSON.parse(localStorage.getItem(INVENTORY_KEY) || "[]");
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function valuesMatch(saved, captured) {
    for (const [key, value] of Object.entries(captured)) {
      const left = JSON.stringify(saved?.[key] ?? null);
      const right = JSON.stringify(value ?? null);
      if (left !== right) return false;
    }
    return true;
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
      const captured = captureVisibleFormIntoListing();
      const now = new Date().toISOString();
      const remotePhotos = Array.isArray(state.photos)
        ? state.photos.map((photo) => remotePhoto(photo?.url)).filter(Boolean)
        : [];

      const record = {
        ...original,
        ...state.listing,
        ...captured,
        id: original.id,
        status: original.status || state.listing.status || "Draft",
        photo: remotePhotos[0] || remotePhoto(original.photo) || null,
        ebayPictureUrls: remotePhotos.length ? remotePhotos : (original.ebayPictureUrls || []),
        sourceTroEditedAt: original.ebayItemId ? now : (original.sourceTroEditedAt || ""),
        updatedAt: now,
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

      saveJSON(INVENTORY_KEY, persistent);

      const verified = readStoredInventory().find((item) => item.id === original.id);
      if (!verified || !valuesMatch(verified, captured)) {
        throw new Error("SourceTro could not verify the saved changes on this device.");
      }

      lastLocalSaveAt = Date.now();
      try { localStorage.setItem("sourcetro_sync_dirty", "1"); } catch {}

      if (window.SourceTroCloud?.syncNow) {
        try { await window.SourceTroCloud.syncNow(); } catch {}
      }

      setRoute("inventory");
      removeSaveBar();
      if (typeof showToast === "function") {
        showToast("Saved. Your SourceTro changes are stored and syncing.");
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
    if (Date.now() - lastLocalSaveAt < 30000) return;
    if (typeof state !== "undefined" && state.route === "new-listing" && existingItem()) return;
    if (!window.SourceTroCloud?.refreshFromCloud) return;
    try {
      await window.SourceTroCloud.refreshFromCloud();
      scheduleDecorate();
    } catch {}
  }

  function startRefreshLoop() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshFromCloud, 8000);
  }

  document.addEventListener("click", (event) => {
    const saveButton = event.target.closest?.('[data-action="save-current-edit"]');
    if (saveButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveCurrentEdit();
      return;
    }

    if (event.target.closest?.('[data-edit-item]')) {
      setTimeout(scheduleDecorate, 150);
      return;
    }
    if (event.target.closest?.("button, a, input, select, textarea, label")) return;

    const row = event.target.closest?.("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;

    event.preventDefault();
    editButton.click();
    setTimeout(scheduleDecorate, 150);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const row = event.target.closest?.("#inventoryResults .data-table tbody tr");
    if (!row) return;
    const editButton = editButtonForRow(row);
    if (!editButton) return;
    event.preventDefault();
    editButton.click();
    setTimeout(scheduleDecorate, 150);
  });

  window.addEventListener("resize", scheduleDecorate);
  window.addEventListener("hashchange", scheduleDecorate);
  window.addEventListener("pageshow", () => {
    scheduleDecorate();
    setTimeout(refreshFromCloud, 300);
  });
  window.addEventListener("focus", () => setTimeout(refreshFromCloud, 250));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(refreshFromCloud, 250);
  });

  scheduleDecorate();
  startRefreshLoop();
})();
