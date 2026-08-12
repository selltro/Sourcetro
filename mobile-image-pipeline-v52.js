(() => {
  const handled = new WeakSet();
  const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const LOW_MEMORY = Boolean(window.SourceTroPhone?.lowMemoryMode) || MOBILE || Number(navigator.deviceMemory || 8) <= 4;

  const settings = {
    sourcePhotoInput: LOW_MEMORY
      ? { max: 520, quality: .50, maxFiles: 1, skipBelow: 260000 }
      : { max: 640, quality: .56, maxFiles: 1, skipBelow: 360000 },
    photoInput: LOW_MEMORY
      ? { max: 960, quality: .62, maxFiles: 4, skipBelow: 500000 }
      : { max: 1280, quality: .72, maxFiles: 6, skipBelow: 800000 },
    measurementPhotoInput: LOW_MEMORY
      ? { max: 1100, quality: .68, maxFiles: 1, skipBelow: 600000 }
      : { max: 1400, quality: .76, maxFiles: 1, skipBelow: 850000 },
    batchPhotoInput: LOW_MEMORY
      ? { max: 520, quality: .50, maxFiles: 2, skipBelow: 260000 }
      : { max: 720, quality: .58, maxFiles: 4, skipBelow: 450000 },
    feedbackScreenshot: LOW_MEMORY
      ? { max: 800, quality: .60, maxFiles: 1, skipBelow: 450000 }
      : { max: 1000, quality: .68, maxFiles: 1, skipBelow: 650000 },
  };

  function imageFile(file) {
    return file && /^image\//i.test(file.type || "");
  }

  function alreadySmallEnough(file, config) {
    return imageFile(file)
      && file.size <= config.skipBelow
      && /^image\/(jpeg|jpg|webp)$/i.test(file.type || "");
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve) => {
      try { canvas.toBlob(resolve, "image/jpeg", quality); }
      catch { resolve(null); }
    });
  }

  async function compress(file, config) {
    if (!imageFile(file) || alreadySmallEnough(file, config)) return file;
    if (typeof createImageBitmap !== "function") return file;

    let bitmap = null;
    let canvas = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(1, config.max / longest);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      if (scale === 1 && file.size <= config.skipBelow) return file;

      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      let blob = await canvasBlob(canvas, config.quality);
      if (!blob) return file;

      // Keep scan payloads very small on phones. A second JPEG pass uses the
      // already-small canvas, not another decode of the original camera file.
      if (LOW_MEMORY && blob.size > 420000) {
        const smaller = await canvasBlob(canvas, Math.max(.42, config.quality - .10));
        if (smaller) blob = smaller;
      }

      const base = (file.name || "sourcetro-photo").replace(/\.[^.]+$/, "");
      return new File([blob], `${base}.jpg`, {
        type: "image/jpeg",
        lastModified: file.lastModified || Date.now(),
      });
    } finally {
      bitmap?.close?.();
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.remove?.();
      }
    }
  }

  async function compressSequential(files, config) {
    const out = [];
    const queue = files.slice(0, config.maxFiles);
    for (const file of queue) {
      try { out.push(await compress(file, config)); }
      catch { out.push(file); }
      // Give mobile browsers a chance to release the decoded bitmap before
      // beginning another photo.
      await new Promise((resolve) => setTimeout(resolve, LOW_MEMORY ? 24 : 0));
    }
    queue.length = 0;
    return out;
  }

  function replaceFiles(input, files) {
    try {
      const transfer = new DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      return true;
    } catch { return false; }
  }

  document.addEventListener("change", async (event) => {
    const input = event.target;
    const config = settings[input?.id];
    if (!config || handled.has(input)) return;
    const originals = [...(input.files || [])];
    if (!originals.length) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      input.disabled = true;
      const compressed = await compressSequential(originals, config);
      originals.length = 0;

      if (replaceFiles(input, compressed)) {
        handled.add(input);
        input.disabled = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        queueMicrotask(() => handled.delete(input));
        return;
      }

      if (input.id === "sourcePhotoInput" && typeof state !== "undefined") {
        const file = compressed[0];
        if (state.sourcePhoto?.url?.startsWith("blob:")) URL.revokeObjectURL(state.sourcePhoto.url);
        state.sourcePhoto = {
          name: file.name,
          url: URL.createObjectURL(file),
          memorySafe: true,
          compressedBytes: file.size,
        };
        state.sourceResult = null;
        state.lastAIAnalysis = null;
        if (typeof render === "function") render();
        setTimeout(() => window.SourceTroDiscovery?.start?.(), 120);
      }
      compressed.length = 0;
    } finally {
      input.disabled = false;
    }
  }, true);

  window.SourceTroMobileImage = {
    build: "54",
    lowMemoryMode: LOW_MEMORY,
  };

  window.addEventListener("pagehide", () => {
    document.querySelectorAll("canvas").forEach((canvas) => {
      if (canvas.width > 1 || canvas.height > 1) {
        canvas.width = 1;
        canvas.height = 1;
      }
    });
  });
})();
