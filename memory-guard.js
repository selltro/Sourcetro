(() => {
  const ANDROID = /Android/i.test(navigator.userAgent);
  const MAX_BATCH_PHOTOS = ANDROID ? 5 : 8;
  const MAX_AI_DIMENSION = ANDROID ? 1200 : 1400;
  const AI_JPEG_QUALITY = ANDROID ? 0.72 : 0.82;

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
    if (isBlobUrl(url) && !urlIsStillInUse(url)) URL.revokeObjectURL(url);
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
        showToast(`SourceTro keeps up to ${MAX_BATCH_PHOTOS} batch photos at once to protect phone memory.`);
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

  function blobToSmallDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("SourceTro could not prepare that photo."));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("SourceTro could not compress that photo.")), "image/jpeg", quality);
    });
  }

  let imagePreparationQueue = Promise.resolve();

  async function prepareImageForAI(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("SourceTro could not open that photo.");
    const blob = await response.blob();

    // v50 pre-compresses camera photos before app.js stores them. If the file is
    // already small, avoid another full image decode and simply encode it for AI.
    if (blob.size <= 850_000 && /^image\/(jpeg|png|webp)$/i.test(blob.type || "")) {
      return blobToSmallDataURL(blob);
    }

    if (typeof createImageBitmap !== "function") {
      if (blob.size <= 1_200_000) return blobToSmallDataURL(blob);
      throw new Error("That photo is too large for this phone. Retake it through SourceTro so it can be compressed first.");
    }

    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    let canvas = null;
    try {
      const scale = Math.min(1, MAX_AI_DIMENSION / Math.max(bitmap.width, bitmap.height));
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!context) throw new Error("SourceTro could not prepare that photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await canvasToBlob(canvas, AI_JPEG_QUALITY);
      return await blobToSmallDataURL(compressed);
    } finally {
      bitmap.close?.();
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
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
