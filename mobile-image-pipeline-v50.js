(() => {
  const processed = new WeakSet();
  const configById = {
    sourcePhotoInput: { max: 960, quality: 0.66, maxFiles: 1 },
    photoInput: { max: 1440, quality: 0.76, maxFiles: 8 },
    measurementPhotoInput: { max: 1600, quality: 0.82, maxFiles: 1 },
    batchPhotoInput: { max: 960, quality: 0.66, maxFiles: 6 },
    feedbackScreenshot: { max: 1200, quality: 0.72, maxFiles: 1 },
  };

  function isImage(file) {
    return file && /^image\//i.test(file.type || "");
  }

  async function canvasBlobFromDrawable(drawable, width, height, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    canvas.width = 1;
    canvas.height = 1;
    if (!blob) throw new Error("Image compression failed");
    return blob;
  }

  async function compressWithImageDecoder(file, maxDimension, quality) {
    if (!("ImageDecoder" in window) || !file.stream) return null;
    const decoder = new ImageDecoder({ data: file.stream(), type: file.type });
    try {
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const width = Number(track?.codedWidth || track?.displayWidth || 0);
      const height = Number(track?.codedHeight || track?.displayHeight || 0);
      if (!width || !height) return null;
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const decoded = await decoder.decode({
        frameIndex: 0,
        completeFramesOnly: true,
        desiredWidth: targetWidth,
        desiredHeight: targetHeight,
      });
      try {
        return await canvasBlobFromDrawable(decoded.image, targetWidth, targetHeight, quality);
      } finally {
        decoded.image.close?.();
      }
    } finally {
      decoder.close?.();
    }
  }

  async function compressWithBitmap(file, maxDimension, quality) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      return await canvasBlobFromDrawable(bitmap, width, height, quality);
    } finally {
      bitmap.close?.();
    }
  }

  async function compressFile(file, config) {
    if (!isImage(file)) return file;
    let blob = null;
    try {
      blob = await compressWithImageDecoder(file, config.max, config.quality);
    } catch {}
    if (!blob) {
      try { blob = await compressWithBitmap(file, config.max, config.quality); } catch {}
    }
    if (!blob) return file;
    const base = (file.name || "sourcetro-photo").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  }

  async function processFilesSequentially(files, config) {
    const result = [];
    for (const file of files.slice(0, config.maxFiles)) {
      result.push(await compressFile(file, config));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return result;
  }

  function assignFiles(input, files) {
    try {
      const dt = new DataTransfer();
      files.forEach((file) => dt.items.add(file));
      input.files = dt.files;
      return true;
    } catch {
      return false;
    }
  }

  document.addEventListener("change", async (event) => {
    const input = event.target;
    const config = configById[input?.id];
    if (!config || processed.has(input)) return;
    const original = [...(input.files || [])];
    if (!original.length) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      input.disabled = true;
      const files = await processFilesSequentially(original, config);
      if (assignFiles(input, files)) {
        processed.add(input);
        input.disabled = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        queueMicrotask(() => processed.delete(input));
        return;
      }

      // Chrome/Edge/Samsung browsers support DataTransfer. This fallback keeps
      // Smart Scan usable if a browser blocks programmatic FileList replacement.
      if (input.id === "sourcePhotoInput" && typeof state !== "undefined") {
        const file = files[0];
        if (state.sourcePhoto?.url?.startsWith("blob:")) URL.revokeObjectURL(state.sourcePhoto.url);
        state.sourcePhoto = { name: file.name, url: URL.createObjectURL(file), memorySafe: true };
        state.sourceResult = null;
        state.lastAIAnalysis = null;
        if (typeof render === "function") render();
        setTimeout(() => window.SourceTroDiscovery?.start?.(), 80);
      }
    } finally {
      input.disabled = false;
    }
  }, true);

  // Free transient image buffers when SourceTro leaves the page or is hidden.
  window.addEventListener("pagehide", () => {
    try {
      document.querySelectorAll("canvas").forEach((canvas) => {
        if (canvas.width > 1 || canvas.height > 1) {
          canvas.width = 1;
          canvas.height = 1;
        }
      });
    } catch {}
  });
})();
