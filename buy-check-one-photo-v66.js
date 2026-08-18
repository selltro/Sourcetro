(() => {
  const INPUT_ID = "sourcePhotoInput";
  let openingNextCamera = false;

  function revokePhoto(photo) {
    const url = String(photo?.url || "");
    if (url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }

  function replaceSourcePhoto(file) {
    if (typeof state === "undefined" || !file) return false;

    const previous = [];
    if (Array.isArray(state.sourcePhotos)) previous.push(...state.sourcePhotos);
    if (state.sourcePhoto && !previous.includes(state.sourcePhoto)) previous.push(state.sourcePhoto);

    const photo = {
      name: file.name || `sourcetro-${Date.now()}.jpg`,
      url: URL.createObjectURL(file),
    };

    state.sourcePhotos = [photo];
    state.sourcePhoto = photo;
    state.sourceResult = null;
    state.lastAIAnalysis = null;
    state.aiError = "";

    previous.forEach(revokePhoto);
    return true;
  }

  function startCurrentPhoto() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !state.sourcePhoto?.url) return;
    if (typeof window.SourceTroDiscovery?.start !== "function") {
      if (typeof showToast === "function") showToast("Tro is still loading. Try the photo again in a moment.");
      return;
    }
    window.SourceTroDiscovery.start();
  }

  function openNextCamera() {
    if (openingNextCamera) return;
    openingNextCamera = true;
    setTimeout(() => {
      openingNextCamera = false;
      if (typeof state === "undefined" || state.route !== "source-scan") return;
      const input = document.querySelector(`#${INPUT_ID}`);
      if (!input) return;
      try { input.value = ""; } catch {}
      input.click();
    }, 180);
  }

  // Own the Buy Check photo event before the legacy multi-photo handler sees it.
  // One selected/taken photo always replaces the previous scan photo and starts AI.
  document.addEventListener("change", (event) => {
    if (event.target?.id !== INPUT_ID) return;
    if (typeof state === "undefined" || state.route !== "source-scan") return;

    const file = event.target.files?.[0];
    if (!file) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!replaceSourcePhoto(file)) return;

    if (typeof setTroState === "function") setTroState("working", "Photo ready — identifying item…");
    if (typeof render === "function") render();
    setTimeout(startCurrentPhoto, 70);
  }, true);

  // The existing Scan another action resets the scan. Open the camera immediately
  // afterward so the next item is one tap away.
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-st52="again"]');
    if (!button) return;
    openNextCamera();
  }, true);
})();
