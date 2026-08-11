(() => {
  const handled = new WeakSet();
  const settings = {
    sourcePhotoInput: { max: 720, quality: .58, maxFiles: 1 },
    photoInput: { max: 1280, quality: .72, maxFiles: 6 },
    measurementPhotoInput: { max: 1400, quality: .78, maxFiles: 1 },
    batchPhotoInput: { max: 720, quality: .58, maxFiles: 4 },
    feedbackScreenshot: { max: 1000, quality: .68, maxFiles: 1 },
  };

  function imageFile(file) {
    return file && /^image\//i.test(file.type || "");
  }

  async function compress(file, config) {
    if (!imageFile(file) || typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, config.max / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      if (scale === 1 && file.size < 900000) return file;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", config.quality));
      canvas.width = 1;
      canvas.height = 1;
      if (!blob) return file;
      const base = (file.name || "sourcetro-photo").replace(/\.[^.]+$/, "");
      return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified || Date.now() });
    } finally {
      bitmap.close?.();
    }
  }

  async function compressSequential(files, config) {
    const out = [];
    for (const file of files.slice(0, config.maxFiles)) {
      try { out.push(await compress(file, config)); }
      catch { out.push(file); }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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
        state.sourcePhoto = { name: file.name, url: URL.createObjectURL(file), memorySafe: true };
        state.sourceResult = null;
        state.lastAIAnalysis = null;
        if (typeof render === "function") render();
        setTimeout(() => window.SourceTroDiscovery?.start?.(), 120);
      }
    } finally {
      input.disabled = false;
    }
  }, true);

  window.addEventListener("pagehide", () => {
    document.querySelectorAll("canvas").forEach((canvas) => {
      if (canvas.width > 1 || canvas.height > 1) { canvas.width = 1; canvas.height = 1; }
    });
  });
})();
