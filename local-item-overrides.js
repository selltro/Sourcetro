(() => {
  const STORAGE_KEY = "sourcetro_item_local_overrides_v1";
  const LOCAL_FIELDS = [
    "category",
    "condition",
    "brand",
    "size",
    "color",
    "material",
    "styleModel",
    "itemType",
    "flaws",
    "notes",
    "chest",
    "waist",
    "hips",
    "length",
    "inseam",
    "sleeve",
    "rise",
    "storageBin",
    "itemCost",
    "sourceLocation",
    "purchaseDate",
  ];

  let applying = false;
  let changeTimer = null;

  function readOverrides() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function writeOverrides(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }

  function currentItem() {
    if (typeof state === "undefined" || !state.listing) return null;
    return state.inventory.find((item) =>
      item.id === state.listing.id ||
      (state.listing.ebayItemId && item.ebayItemId === state.listing.ebayItemId)
    ) || null;
  }

  function itemKey(item = null) {
    const record = item || currentItem();
    return String(record?.id || state?.listing?.id || record?.ebayItemId || state?.listing?.ebayItemId || "");
  }

  function pickLocalFields(source = {}) {
    const result = {};
    for (const field of LOCAL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
      const value = source[field];
      if (value === undefined || value === null) continue;
      result[field] = value;
    }
    return result;
  }

  function saveOverride(key, values) {
    if (!key) return;
    const all = readOverrides();
    all[key] = {
      ...(all[key] || {}),
      ...pickLocalFields(values),
      savedAt: new Date().toISOString(),
    };
    writeOverrides(all);
  }

  function snapshotExistingItem(item) {
    if (!item?.ebayItemId) return;
    saveOverride(itemKey(item), item);
  }

  function captureVisibleLocalFields() {
    const item = currentItem();
    if (!item?.ebayItemId) return;
    const values = {};
    document.querySelectorAll("[data-bind]").forEach((field) => {
      const name = field.dataset.bind;
      if (!LOCAL_FIELDS.includes(name)) return;
      values[name] = field.type === "checkbox" ? field.checked : field.value;
    });
    saveOverride(itemKey(item), { ...item, ...state.listing, ...values });
  }

  function applyOverride() {
    if (applying || typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.ebayItemId) return;
    const item = currentItem();
    if (!item) return;
    const key = itemKey(item);
    const override = readOverrides()[key];
    if (!override) return;

    let changed = false;
    for (const field of LOCAL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(override, field)) continue;
      const value = override[field];
      if (state.listing[field] !== value) {
        state.listing[field] = value;
        changed = true;
      }
      if (item[field] !== value) {
        item[field] = value;
        changed = true;
      }
    }

    if (!changed) return;
    applying = true;
    try {
      if (typeof saveJSON === "function") saveJSON("sourcetro_inventory", state.inventory);
      if (typeof render === "function") render();
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    setTimeout(applyOverride, 80);
    setTimeout(applyOverride, 300);
    setTimeout(applyOverride, 800);
  }

  document.addEventListener("click", (event) => {
    const edit = event.target.closest?.("[data-edit-item]");
    if (edit && typeof state !== "undefined") {
      const item = state.inventory.find((record) => record.id === edit.dataset.editItem);
      if (item) snapshotExistingItem(item);
    }

    const save = event.target.closest?.('[data-action="save-current-edit"]');
    if (save) captureVisibleLocalFields();
  }, true);

  document.addEventListener("change", (event) => {
    if (!event.target?.dataset?.bind || !LOCAL_FIELDS.includes(event.target.dataset.bind)) return;
    clearTimeout(changeTimer);
    changeTimer = setTimeout(captureVisibleLocalFields, 60);
  }, true);

  window.addEventListener("hashchange", scheduleApply);
  window.addEventListener("pageshow", scheduleApply);

  window.SourceTroLocalOverrides = {
    apply: applyOverride,
    saveCurrent: captureVisibleLocalFields,
  };

  scheduleApply();
})();
