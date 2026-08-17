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

  let cameraStream = null;
  let cameraInput = null;
  let nativePickerBypass = false;

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

  function commitSourcePhoto(file) {
    if (!file || typeof state === "undefined") return false;
    if (!Array.isArray(state.sourcePhotos)) state.sourcePhotos = [];
    if (state.sourcePhotos.length >= 12) {
      if (typeof showToast === "function") showToast("You can add up to 12 photos.");
      return false;
    }

    const firstPhoto = state.sourcePhotos.length === 0;
    const photo = {
      name: file.name || "sourcetro-scan.jpg",
      url: URL.createObjectURL(file),
      memorySafe: true,
      compressedBytes: file.size || 0,
    };
    state.sourcePhotos.push(photo);
    state.sourcePhoto = state.sourcePhotos[0];

    if (firstPhoto) {
      state.sourceResult = null;
      state.lastAIAnalysis = null;
      if ("aiError" in state) state.aiError = "";
    }
    if (typeof render === "function") render();
    const remaining = Math.max(0, 6 - state.sourcePhotos.length);
    if (typeof setTroState === "function") setTroState(
      "listening",
      firstPhoto ? "Photo ready — Tro is identifying it." : (remaining ? `Optional photo added — ${remaining} more for a full listing.` : "Full listing photo set ready."),
      1600,
    );
    if (typeof showToast === "function" && !firstPhoto) showToast(
      remaining ? `Optional photo ${state.sourcePhotos.length} added. ${remaining} more only for a full listing.` : `${state.sourcePhotos.length} photos ready for your listing.`,
    );
    if (firstPhoto) setTimeout(() => window.SourceTroDiscovery?.start?.(), 100);
    else if (state.sourcePhotos.length === 6) setTimeout(() => window.SourceTroDiscovery?.completePhotoSet?.(), 100);
    return true;
  }

  function cameraOverlay() {
    let overlay = document.querySelector("#sourceTroLiteCamera");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "sourceTroLiteCamera";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="st-lite-camera-card" role="dialog" aria-modal="true" aria-label="SourceTro camera">
        <div class="st-lite-camera-head">
          <div><strong>Smart Scan camera</strong><small>Memory-safe phone capture</small></div>
          <button type="button" data-lite-camera="cancel" aria-label="Close camera">×</button>
        </div>
        <video playsinline muted autoplay></video>
        <p>Center the item and make sure the label or brand is visible when possible.</p>
        <div class="st-lite-camera-actions">
          <button type="button" class="button secondary" data-lite-camera="library">Choose existing photo</button>
          <button type="button" class="button" data-lite-camera="capture">Take photo</button>
        </div>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      #sourceTroLiteCamera{position:fixed;inset:0;z-index:10000;background:#07131dcc;display:grid;place-items:center;padding:14px}
      #sourceTroLiteCamera[hidden]{display:none!important}
      .st-lite-camera-card{width:min(100%,520px);max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:22px;padding:14px;box-shadow:0 20px 70px #0008}
      .st-lite-camera-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;color:#173044}.st-lite-camera-head div{display:grid}.st-lite-camera-head small{color:#6b7a83;font-weight:500}.st-lite-camera-head button{border:0;background:#eef2f1;border-radius:50%;width:38px;height:38px;font-size:24px;color:#173044}
      .st-lite-camera-card video{display:block;width:100%;max-height:62vh;aspect-ratio:3/4;object-fit:cover;background:#111;border-radius:16px}
      .st-lite-camera-card p{font-size:13px;color:#667781;margin:10px 2px}.st-lite-camera-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      @media(max-width:430px){.st-lite-camera-card{border-radius:18px}.st-lite-camera-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    return overlay;
  }

  function stopLiteCamera(dispatchCancel = false) {
    cameraStream?.getTracks?.().forEach((track) => track.stop());
    cameraStream = null;
    const overlay = document.querySelector("#sourceTroLiteCamera");
    if (overlay) {
      const video = overlay.querySelector("video");
      if (video) video.srcObject = null;
      overlay.hidden = true;
    }
    const input = cameraInput;
    cameraInput = null;
    if (dispatchCancel && input) input.dispatchEvent(new Event("cancel", { bubbles: true }));
  }

  function openNativePicker(input, libraryOnly = false) {
    stopLiteCamera(false);
    nativePickerBypass = true;
    const hadCapture = input.hasAttribute("capture");
    const captureValue = input.getAttribute("capture");
    if (libraryOnly) input.removeAttribute("capture");
    try { input.click(); }
    finally {
      if (libraryOnly && hadCapture) input.setAttribute("capture", captureValue || "environment");
      nativePickerBypass = false;
    }
  }

  async function openLiteCamera(input) {
    if (!navigator.mediaDevices?.getUserMedia) {
      openNativePicker(input, false);
      return;
    }

    cameraInput = input;
    const overlay = cameraOverlay();
    const video = overlay.querySelector("video");
    overlay.hidden = false;

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 960, max: 1280 },
          height: { ideal: 720, max: 960 },
        },
      });
      video.srcObject = cameraStream;
      await video.play().catch(() => {});
    } catch {
      overlay.hidden = true;
      openNativePicker(input, false);
    }
  }

  async function captureLitePhoto() {
    const input = cameraInput;
    const overlay = document.querySelector("#sourceTroLiteCamera");
    const video = overlay?.querySelector("video");
    if (!input || !video || !video.videoWidth || !video.videoHeight) return;

    let canvas = null;
    try {
      const max = 520;
      const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, .50);
      if (!blob) return;

      const file = new File([blob], `sourcetro-scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      stopLiteCamera(false);
      commitSourcePhoto(file);
    } finally {
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
        canvas.remove?.();
      }
    }
  }

  document.addEventListener("click", (event) => {
    const directInput = event.target?.id === "sourcePhotoInput" ? event.target : null;
    const zoneInput = event.target?.closest?.(".source-upload")?.querySelector?.("#sourcePhotoInput") || null;
    const sourceInput = directInput || zoneInput;

    if (sourceInput && MOBILE && !nativePickerBypass) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openLiteCamera(sourceInput);
      return;
    }

    const action = event.target.closest?.("[data-lite-camera]")?.dataset?.liteCamera;
    if (!action) return;
    event.preventDefault();
    if (action === "capture") captureLitePhoto();
    if (action === "library" && cameraInput) openNativePicker(cameraInput, true);
    if (action === "cancel") stopLiteCamera(true);
  }, true);

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

      // Smart Scan owns its photo from this point forward. Do not rewrite the
      // file input or dispatch another change event; that used to hand the same
      // photo to both legacy app.js and the newer discovery scanner.
      if (input.id === "sourcePhotoInput") {
        const file = compressed[0];
        if (file) commitSourcePhoto(file);
        try { input.value = ""; } catch {}
        compressed.length = 0;
        return;
      }

      if (replaceFiles(input, compressed)) {
        handled.add(input);
        input.disabled = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        queueMicrotask(() => handled.delete(input));
        return;
      }

      compressed.length = 0;
    } finally {
      input.disabled = false;
    }
  }, true);

  window.SourceTroMobileImage = {
    build: "65",
    lowMemoryMode: LOW_MEMORY,
    cameraMode: MOBILE ? "memory-safe-stream" : "file-input",
    smartScanOwner: "mobile-image-pipeline",
  };

  window.addEventListener("pagehide", () => {
    stopLiteCamera(false);
    document.querySelectorAll("canvas").forEach((canvas) => {
      if (canvas.width > 1 || canvas.height > 1) {
        canvas.width = 1;
        canvas.height = 1;
      }
    });
  });
})();
