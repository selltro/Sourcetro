(() => {
  const MAX_BATCH_PHOTOS = 8;
  const MAX_AI_DIMENSION = 1400;
  const AI_JPEG_QUALITY = 0.82;

  function isBlobUrl(url) {
    return typeof url === "string" && url.startsWith("blob:");
  }

  function urlIsStillInUse(url) {
    if (!url) return false;
    if (state.sourcePhoto?.url === url) return true;
    if (state.feedbackScreenshot?.url === url) return true;
    if (state.photos?.some((photo) => photo.url === url)) return true;
    if (state.measurementPhotos?.some((photo) => photo.url === url)) return true;
    if (state.batchItems?.some((photo) => photo.url === url)) return true;
    return false;
  }

  function revokeIfUnused(url) {
    if (isBlobUrl(url) && !urlIsStillInUse(url)) {
      URL.revokeObjectURL(url);
    }
  }

  function capBatchQueue() {
    if (!Array.isArray(state.batchItems) || state.batchItems.length <= MAX_BATCH_PHOTOS) return false;

    const removed = state.batchItems.splice(MAX_BATCH_PHOTOS);
    removed.forEach((item) => revokeIfUnused(item?.url));
    return removed.length > 0;
  }

  function clearBatchQueue() {
    if (!Array.isArray(state.batchItems) || !state.batchItems.length) return;
    const removed = state.batchItems.splice(0);
    removed.forEach((item) => revokeIfUnused(item?.url));
    render();
    showToast("Batch photos cleared to free memory.");
  }

  function addBatchMemoryControl() {
    const queue = document.querySelector(".batch-queue");
    if (!queue || queue.querySelector("[data-memory-clear-batch]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.dataset.memoryClearBatch = "true";
    button.textContent = "Clear batch photos";
    button.title = "Remove queued batch photos from this session to free memory";
    queue.appendChild(button);
  }

  const observer = new MutationObserver(addBatchMemoryControl);
  observer.observe(page, { childList: true, subtree: true });
  addBatchMemoryControl();

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "batchPhotoInput") return;

    queueMicrotask(() => {
      if (capBatchQueue()) {
        render();
        showToast(`SourceTro keeps up to ${MAX_BATCH_PHOTOS} batch photos at once to protect device memory.`);
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-memory-clear-batch]")) {
      clearBatchQueue();
      return;
    }

    const batchButton = event.target.closest("[data-batch-item]");
    if (!batchButton) return;

    // app.js first moves the selected batch photo into sourcePhoto. After that
    // happens, remove the duplicate queue reference so the same large photo is
    // not held in two places for the rest of the session.
    queueMicrotask(() => {
      const selectedUrl = state.sourcePhoto?.url;
      if (!selectedUrl) return;

      const selectedIndex = state.batchItems.findIndex((item) => item.url === selectedUrl);
      if (selectedIndex < 0) return;

      state.batchItems.splice(selectedIndex, 1);
      if (state.sourcePhoto) state.sourcePhoto.fromBatch = false;
      render();
    });
  });

  // Serialize image preparation. Tro Measure can ask for two photos at once;
  // processing both full-size camera images concurrently can create a large
  // temporary memory spike on phones and in browser tabs.
  let imagePreparationQueue = Promise.resolve();

  async function prepareImageForAI(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("SourceTro could not open that photo.");

    const blob = await response.blob();

    try {
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, MAX_AI_DIMENSION / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("SourceTro could not prepare that photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", AI_JPEG_QUALITY);

      bitmap.close?.();
      // Shrink the backing store immediately after encoding so mobile browsers
      // can reclaim the temporary pixel buffer sooner.
      canvas.width = 1;
      canvas.height = 1;

      return dataUrl;
    } catch (error) {
      return blobToDataURL(blob);
    }
  }

  imageUrlForAI = function memorySafeImageUrlForAI(url) {
    const task = imagePreparationQueue.then(
      () => prepareImageForAI(url),
      () => prepareImageForAI(url),
    );
    imagePreparationQueue = task.catch(() => {});
    return task;
  };
})();
