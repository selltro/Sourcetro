(() => {
  const LOCAL_FIELDS = [
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

  let lastAppliedSession = "";
  let applyTimer = null;

  function currentImportedItem() {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.ebayItemId) return null;
    return state.inventory.find((item) =>
      item.id === state.listing.id || item.ebayItemId === state.listing.ebayItemId
    ) || null;
  }

  function sessionKey(item) {
    return [
      item?.id || "",
      item?.ebayItemId || "",
      item?.updatedAt || "",
      state?.listing?.ebayItemId || "",
    ].join("|");
  }

  function applySavedSourceTroFields() {
    const item = currentImportedItem();
    if (!item) return;

    const key = sessionKey(item);
    if (key && key === lastAppliedSession) return;

    let changed = false;
    for (const field of LOCAL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(item, field)) continue;
      const saved = item[field];
      if (saved === undefined || saved === null || saved === "") continue;
      if (state.listing[field] === saved) continue;
      state.listing[field] = saved;
      changed = true;
    }

    lastAppliedSession = key;
    if (changed && typeof render === "function") render();
  }

  function scheduleApply(delay = 80) {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applySavedSourceTroFields, delay);
  }

  window.addEventListener("hashchange", () => {
    if (location.hash.replace("#", "") !== "new-listing") {
      lastAppliedSession = "";
      return;
    }
    scheduleApply(120);
  });

  window.addEventListener("pageshow", () => scheduleApply(200));

  const observer = new MutationObserver(() => {
    if (typeof state === "undefined" || state.route !== "new-listing" || !state.listing?.ebayItemId) return;
    scheduleApply(60);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleApply(350);
})();
