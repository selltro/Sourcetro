(() => {
  const INPUT_ID = "sourcePhotoInput";
  let enforcing = false;
  let enforcementQueued = false;

  function buyCheckMode() {
    return typeof state !== "undefined"
      && state.route === "source-scan"
      && state.sourceScan?.journey === "Thinking of buying";
  }

  function revokePhoto(photo) {
    const url = String(photo?.url || "");
    if (url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }

  function startCurrentPhoto() {
    if (!buyCheckMode() || !state.sourcePhoto?.url) return;
    if (typeof window.SourceTroDiscovery?.start !== "function") return;
    window.SourceTroDiscovery.start();
  }

  function enforceOnePhoto() {
    enforcementQueued = false;
    if (enforcing || !buyCheckMode()) return;

    const photos = Array.isArray(state.sourcePhotos) ? state.sourcePhotos.filter(Boolean) : [];
    if (photos.length <= 1) {
      if (photos.length === 1 && state.sourcePhoto !== photos[0]) state.sourcePhoto = photos[0];
      return;
    }

    enforcing = true;
    try {
      // A second Buy Check photo means "scan this item instead", not "build a photo set".
      // Keep the newest photo, discard older blob URLs, and restart identification.
      const newest = photos[photos.length - 1];
      photos.slice(0, -1).forEach((photo) => {
        if (photo !== newest) revokePhoto(photo);
      });
      state.sourcePhotos = [newest];
      state.sourcePhoto = newest;
      state.sourceResult = null;
      state.lastAIAnalysis = null;
      if ("aiError" in state) state.aiError = "";

      if (typeof setTroState === "function") setTroState("working", "New photo ready — identifying item…");
      if (typeof render === "function") render();
      setTimeout(startCurrentPhoto, 80);
    } finally {
      enforcing = false;
    }
  }

  function queueEnforcement() {
    if (enforcementQueued) return;
    enforcementQueued = true;
    queueMicrotask(enforceOnePhoto);
  }

  // mobile-image-pipeline-v52 owns the native camera/change event before later
  // handlers can see it. Watch app state/render changes instead and enforce the
  // one-photo rule only for Buy Check. Owned-item listing mode can still use a
  // multi-photo set.
  const observer = new MutationObserver(queueEnforcement);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", (event) => {
    if (event.target?.id === INPUT_ID) setTimeout(queueEnforcement, 0);
  }, true);

  // The existing Scan another handler resets the scan synchronously. Because this
  // listener runs afterward on the same click, the fresh input is available while
  // the user's gesture is still active, so phones can reopen the camera reliably.
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-st52="again"]');
    if (!button) return;
    const open = () => {
      if (!buyCheckMode()) return;
      const input = document.querySelector(`#${INPUT_ID}`);
      if (!input) return false;
      try { input.value = ""; } catch {}
      input.click();
      return true;
    };
    if (!open()) requestAnimationFrame(open);
  }, true);
})();
