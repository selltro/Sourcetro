(() => {
  const PERSONAL_API = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const EBAY_API = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const controllers = new Set();
  let scanRun = 0;
  let stateView = fresh();
  let renderQueued = false;
  let detailMode = false;
  let cameraAwaiting = false;
  let cameraOpenedAt = 0;

  function fresh() {
    return {
      busy: false,
      identification: null,
      analysis: null,
      error: "",
      status: { identify: "idle", ebay: "idle", web: "idle" },
      eBay: { matches: [], error: "" },
      web: { matches: [], error: "", summary: "" },
    };
  }

  function ownerKey() {
    try {
      const session = sessionStorage.getItem(OWNER_KEY_STORAGE) || "";
      if (session) return session;
      const trusted = localStorage.getItem(TRUSTED_OWNER_KEY) || "";
      if (trusted) sessionStorage.setItem(OWNER_KEY_STORAGE, trusted);
      return trusted;
    } catch { return ""; }
  }

  function esc(value = "") {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) : "—";
  }

  function safeUrl(value = "") {
    try {
      const u = new URL(String(value));
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch { return ""; }
  }

  function median(values) {
    const a = values.filter((n) => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function matches() {
    const seen = new Set();
    return [...stateView.eBay.matches, ...stateView.web.matches]
      .filter((x) => Number(x.price) > 0)
      .filter((x) => {
        const key = `${safeUrl(x.url)}|${String(x.title || "").toLowerCase().slice(0, 90)}|${Number(x.price).toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 14);
  }

  function stats() {
    const p = matches().map((x) => Number(x.price)).filter((x) => x > 0);
    return p.length ? { low: Math.min(...p), mid: median(p), high: Math.max(...p), count: p.length } : null;
  }

  function abortAll() {
    controllers.forEach((c) => c.abort());
    controllers.clear();
  }

  async function requestJson(url, options = {}, timeoutMs = 0) {
    const controller = new AbortController();
    controllers.add(controller);
    let timer = null;
    if (timeoutMs > 0) timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `Request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        const e = new Error("SourceTro could not finish that step in time.");
        e.code = "TIMEOUT";
        throw e;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      controllers.delete(controller);
    }
  }

  function personal(path, body, timeoutMs = 0) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${PERSONAL_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SourceTro-Key": key },
      body: JSON.stringify(body),
    }, timeoutMs);
  }

  function ebay(path, timeoutMs = 9000) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${EBAY_API}${path}`, { method: "GET", headers: { "X-SourceTro-Key": key } }, timeoutMs);
  }

  function ensureStyles() {
    if (document.querySelector("#sourceTroDiscoveryV52Styles")) return;
    const style = document.createElement("style");
    style.id = "sourceTroDiscoveryV52Styles";
    style.textContent = `
      .st52-mode>.page-header,.st52-mode>.source-scan-layout,.st52-mode>.source-tools-panel{display:none!important}
      .st52-mode.st52-details>.page-header{display:flex!important}.st52-mode.st52-details>.source-scan-layout{display:grid!important}.st52-mode.st52-details>.source-tools-panel{display:block!important}
      .st52-shell{max-width:1080px;margin:0 auto 28px;display:grid;gap:16px}.st52-card{background:#fff;border:1px solid #e4e9e7;border-radius:24px;padding:20px;box-shadow:0 8px 26px rgba(22,40,58,.05)}
      .st52-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.st52-head h1{margin:4px 0 7px;color:#173044;font-size:clamp(29px,5vw,42px)}.st52-head p{margin:0;color:#687781;max-width:650px}.st52-kicker{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4c7a68}.st52-head-actions{display:flex;gap:8px;flex-wrap:wrap}
      .st52-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:16px;margin-top:18px}.st52-camera{min-height:280px;border:2px dashed #cbd8d4;border-radius:20px;background:#f8faf9;display:grid;place-items:center;overflow:hidden}.st52-camera img{width:100%;height:100%;min-height:280px;max-height:430px;object-fit:contain;background:#f2f5f4}.st52-empty{text-align:center;padding:26px;max-width:480px}.st52-lens{display:inline-flex!important;width:108px!important;height:108px!important;margin:0 auto 15px!important;transform:none!important;box-shadow:0 0 0 8px rgba(85,188,231,.12),0 0 26px rgba(85,188,231,.35)!important}.st52-empty h2{margin:0 0 7px;color:#173044}.st52-empty p{margin:0 0 16px;color:#6b7a83}.st52-buttons{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
      .st52-progress{background:#f5f8f7;border-radius:18px;padding:16px}.st52-progress h3{margin:0 0 4px;color:#173044}.st52-progress>p{margin:0;color:#6c7a83;font-size:13px}.st52-statuses{display:grid;gap:9px;margin-top:14px}.st52-status{display:grid;grid-template-columns:24px 1fr auto;gap:9px;align-items:center;background:#fff;border:1px solid #e5ebe8;border-radius:13px;padding:10px}.st52-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#e0e6e4;font-size:11px;font-weight:900}.st52-status.working .st52-dot{background:#d6efe5;animation:st52Pulse 1s infinite}.st52-status.done .st52-dot{background:#d6efe5;color:#176344}.st52-status.error .st52-dot{background:#ffe1d7;color:#914730}.st52-status.cancelled .st52-dot{background:#eceff0;color:#64727a}.st52-status small{display:block;color:#6d7a83}.st52-status b{font-size:11px;color:#4e626e}@keyframes st52Pulse{0%,100%{transform:scale(.9);opacity:.65}50%{transform:scale(1.08);opacity:1}}
      .st52-progress-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.st52-note{font-size:12px;color:#6e7c84;margin:10px 0 0}.st52-error{padding:11px 12px;border-radius:12px;background:#fff0ea;color:#8a4431;margin-top:10px;font-size:13px}
      .st52-found{display:grid;grid-template-columns:1fr auto;gap:12px}.st52-found h2{margin:4px 0 5px;color:#173044}.st52-found p{margin:0;color:#667781}.st52-badge{padding:6px 10px;border-radius:999px;background:#eef6f2;color:#25624d;font-size:12px;font-weight:800}.st52-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.st52-tags span{padding:6px 9px;border-radius:999px;background:#f2f5f4;color:#586870;font-size:12px}
      .st52-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:13px}.st52-price{padding:14px;border-radius:15px;background:#f4f8f6}.st52-price small{display:block;color:#687982}.st52-price strong{font-size:24px;color:#173044}.st52-list{display:grid;gap:9px;margin-top:13px}.st52-match{display:grid;grid-template-columns:1fr auto;gap:12px;border:1px solid #e3e9e6;border-radius:14px;padding:12px}.st52-match a{display:block;color:#17445c;font-weight:750;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st52-match small{display:block;color:#6d7b83;margin-top:4px}.st52-price-right{text-align:right}.st52-price-right strong{display:block;color:#173044}.st52-price-right span{font-size:11px;font-weight:800;color:#4d7565;text-transform:capitalize}.st52-muted{padding:16px;border:1px dashed #ccd8d4;border-radius:14px;color:#687982;text-align:center;margin-top:12px}
      .st52-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}
      @media(max-width:820px){.st52-grid{grid-template-columns:1fr}.st52-camera{min-height:240px}.st52-camera img{min-height:240px}.st52-price-grid{grid-template-columns:1fr}.st52-match{grid-template-columns:1fr}.st52-price-right{text-align:left}.st52-card{padding:16px}.st52-lens{width:100px!important;height:100px!important}}
    `;
    document.head.appendChild(style);
  }

  function statusRow(key, label, detail) {
    const s = stateView.status[key] || "idle";
    const icon = s === "done" ? "✓" : s === "working" ? "●" : s === "error" ? "!" : s === "cancelled" ? "×" : "·";
    const text = s === "done" ? "Done" : s === "working" ? "Working" : s === "error" ? "Unavailable" : s === "cancelled" ? "Stopped" : "Waiting";
    return `<div class="st52-status ${s}"><span class="st52-dot">${icon}</span><div><strong>${label}</strong><small>${detail}</small></div><b>${text}</b></div>`;
  }

  function identificationMarkup() {
    const id = stateView.identification;
    if (!id) return "";
    const title = [id.brand, id.item_type].filter(Boolean).join(" ") || "Item identified";
    const tags = [id.category, id.color, id.size, id.style, id.condition].filter(Boolean);
    return `<section class="st52-card"><div class="st52-found"><div><span class="st52-kicker">Tro found</span><h2>${esc(title)}</h2><p>Tro used your photo to build the comparison search. Check labels or model numbers when exact identity matters.</p></div><span class="st52-badge">${esc(id.confidence || "photo match")}</span></div>${tags.length ? `<div class="st52-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</section>`;
  }

  function pricesMarkup() {
    const s = stats();
    return `<section class="st52-card"><div class="st52-head"><div><h2 style="margin:0;color:#173044;font-size:22px">Current prices found</h2><p>eBay results appear first. Public-web matches can continue afterward.</p></div></div>${s ? `<div class="st52-price-grid"><div class="st52-price"><small>Lowest found</small><strong>${money(s.low)}</strong></div><div class="st52-price"><small>Typical found</small><strong>${money(s.mid)}</strong></div><div class="st52-price"><small>Highest found</small><strong>${money(s.high)}</strong></div></div><p class="st52-note">These are current asking/retail prices, not guaranteed sold prices.</p>` : `<div class="st52-muted">${stateView.status.ebay === "working" || stateView.status.web === "working" ? "Price matches are still arriving…" : "No reliable priced matches were returned yet."}</div>`}</section>`;
  }

  function matchesMarkup() {
    const list = matches();
    return `<section class="st52-card"><h2 style="margin:0;color:#173044;font-size:22px">Matches from around the web</h2>${list.length ? `<div class="st52-list">${list.map((x) => {
      const url = safeUrl(x.url);
      return `<div class="st52-match"><div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(x.title || "Matching listing")}</a>` : `<strong>${esc(x.title || "Matching listing")}</strong>`}<small>${esc(x.source || x.marketplace || "Web")} · ${esc(x.condition || x.priceType || x.price_type || "current listing")}</small></div><div class="st52-price-right"><strong>${money(x.price)}</strong><span>${esc(x.matchType || x.match_type || "similar")} match</span></div></div>`;
    }).join("")}</div>` : `<div class="st52-muted">${stateView.status.web === "working" ? "Public-web search is still working in the background…" : "No additional public-web matches were reliable enough to show."}</div>`}${stateView.web.error ? `<div class="st52-error">${esc(stateView.web.error)}</div>` : ""}<p class="st52-note">SourceTro can search accessible public pages and connected marketplace data; some sites block automated search.</p></section>`;
  }

  function renderPanel() {
    if (typeof state === "undefined" || state.route !== "source-scan" || typeof page === "undefined" || !page) return;
    ensureStyles();
    page.classList.add("st52-mode");
    page.classList.toggle("st52-details", detailMode);
    let shell = document.querySelector("#sourceTroDiscoveryV52");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "sourceTroDiscoveryV52";
      shell.className = "st52-shell";
      page.insertAdjacentElement("afterbegin", shell);
    }
    const hasPhoto = Boolean(state.sourcePhoto?.url);
    shell.innerHTML = `<section class="st52-card"><div class="st52-head"><div><span class="st52-kicker">Smart Source Scan</span><h1>Should I buy this?</h1><p>Take one photo. Tro identifies the item first, then checks eBay and the public web. The app will not cancel identification after only a few seconds anymore.</p></div><div class="st52-head-actions"><button class="button secondary" type="button" data-st52="details">${detailMode ? "Hide details" : "More details"}</button><button class="button ghost" type="button" data-st52="cancel">Cancel</button></div></div><div class="st52-grid"><div class="st52-camera">${hasPhoto ? `<img src="${esc(state.sourcePhoto.url)}" alt="Item being scanned">` : `<div class="st52-empty"><span class="tro-orb st52-lens" data-mood="ready"><i></i></span><h2>Scan an item</h2><p>Take one clear photo. You can cancel before or during the scan.</p><div class="st52-buttons"><button class="button large" type="button" data-st52="camera">Take picture</button><button class="button ghost" type="button" data-st52="cancel">Cancel</button></div></div>`}</div><aside class="st52-progress"><h3>${stateView.busy ? "Tro is working…" : hasPhoto ? "Results" : "What Tro checks"}</h3><p>${stateView.busy ? "Identification may take a little longer on a phone, but SourceTro now lets it finish instead of stopping at 18 seconds." : "eBay and web search begin as soon as Tro has a reliable search phrase."}</p><div class="st52-statuses">${statusRow("identify", "Identify the item", "Brand, type, style and condition clues")}${statusRow("ebay", "Check eBay", "Current active listings and asking prices")}${statusRow("web", "Search the web", "Accessible resale, retail and specialty sites")}</div>${stateView.error ? `<div class="st52-error">${esc(stateView.error)}</div>` : ""}<div class="st52-progress-actions">${stateView.busy ? `<button class="button ghost" type="button" data-st52="stop">Cancel search</button>` : hasPhoto ? `<button class="button secondary" type="button" data-st52="again">Retake / scan another</button>` : ""}</div></aside></div></section>${identificationMarkup()}${hasPhoto ? pricesMarkup() : ""}${hasPhoto ? matchesMarkup() : ""}${stateView.identification ? `<section class="st52-card"><h2 style="margin:0;color:#173044;font-size:22px">Next step</h2><p style="color:#687781">Use the scan to start a listing, or scan another item.</p><div class="st52-actions"><button class="button large" type="button" data-st52="listing">Create listing →</button><button class="button secondary" type="button" data-st52="save">Save scan</button><button class="button ghost" type="button" data-st52="again">Scan another</button></div></section>` : ""}`;
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => { renderQueued = false; renderPanel(); }, 35);
  }

  async function smallImage() {
    if (!state?.sourcePhoto?.url) throw new Error("Take a photo first.");
    const r = await fetch(state.sourcePhoto.url);
    if (!r.ok) throw new Error("SourceTro could not read that photo.");
    const blob = await r.blob();
    if (typeof createImageBitmap !== "function") {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("SourceTro could not prepare that photo."));
        reader.readAsDataURL(blob);
      });
    }
    const bitmap = await createImageBitmap(blob);
    try {
      const max = 640;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) throw new Error("SourceTro could not prepare that photo.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", .58);
      canvas.width = 1; canvas.height = 1;
      return data;
    } finally { bitmap.close?.(); }
  }

  function normalizeFast(result) {
    const id = result.identification || result.item || {};
    const query = String(result.searchQuery || result.search_query || [id.brand, id.item_type, id.style].filter(Boolean).join(" ")).trim();
    return {
      identification: {
        brand: id.brand || "",
        item_type: id.item_type || id.itemType || "",
        category: id.category || "",
        color: id.color || "",
        size: id.size || "",
        style: id.style || "",
        condition: id.condition || "",
        visible_flaws: Array.isArray(id.visible_flaws) ? id.visible_flaws : [],
        confidence: id.confidence || "medium",
      },
      research: { ebay_sold_search: query, search_keywords: query ? [query] : [], details_to_verify: [] },
      evaluation: { demand: "Check live prices", sourcing_decision: "Review current matches", explanation: "Tro identified the item from the photo." },
      listing: { seo_title: query.slice(0, 80), description: "", item_specifics: [], photo_checklist: [] },
      warnings: [],
    };
  }

  function applyAnalysis(analysis) {
    const id = analysis?.identification || {};
    stateView.analysis = analysis;
    stateView.identification = id;
    state.lastAIAnalysis = analysis;
    if (id.item_type) state.sourceScan.itemName = id.item_type;
    if (id.brand) state.sourceScan.brand = id.brand;
    if (id.category && typeof normalizeCategory === "function") state.sourceScan.category = normalizeCategory(id.category, state.sourceScan.category);
    if (id.condition && typeof normalizeCondition === "function") state.sourceScan.condition = normalizeCondition(id.condition, state.sourceScan.condition);
    state.sourceScan.marketplace = "All marketplaces";
    try { sessionStorage.setItem("sourcetro_ai_verified", "true"); state.aiStatus = "connected"; } catch {}
    if (typeof buildSourceResult === "function") {
      try { buildSourceResult(analysis); } catch { try { buildSourceResult(); } catch {} }
    }
  }

  function query() {
    const a = stateView.analysis || {};
    return String(a?.research?.ebay_sold_search || a?.listing?.seo_title || [a?.identification?.brand, a?.identification?.item_type, a?.identification?.style].filter(Boolean).join(" ") || [state?.sourceScan?.brand, state?.sourceScan?.itemName].filter(Boolean).join(" ")).trim().slice(0, 180);
  }

  async function identify(runId, imageData) {
    stateView.status.identify = "working";
    queueRender();
    const body = {
      mode: state.sourceScan.journey === "Thinking of buying" ? "sourcing" : "owned",
      purchaseCost: state.sourceScan.purchasePrice || null,
      targetProfit: state.troFit?.minimumProfit || null,
      notes: [state.sourceScan.sourceLocation, state.sourceScan.barcode].filter(Boolean).join(" · "),
      images: [imageData],
    };

    try {
      const fast = await personal("/identify-fast", { image: imageData, notes: body.notes }, 22000);
      if (runId !== scanRun) return false;
      applyAnalysis(normalizeFast(fast));
      stateView.status.identify = "done";
      queueRender();
      return true;
    } catch (fastError) {
      if (runId !== scanRun) return false;
      if (fastError.status !== 404 && fastError.status !== 405 && fastError.status !== 500) {
        // A real authorization/network error should not be hidden by the fallback.
        if (fastError.status === 401 || /secure access/i.test(fastError.message || "")) throw fastError;
      }
    }

    const full = await personal("/analyze", body, 55000);
    if (runId !== scanRun) return false;
    applyAnalysis(full.analysis || {});
    stateView.status.identify = "done";
    queueRender();
    return true;
  }

  async function searchEbay(runId) {
    const q = query();
    if (!q || runId !== scanRun) return;
    stateView.status.ebay = "working"; queueRender();
    try {
      const result = await ebay(`/ebay/research?q=${encodeURIComponent(q)}`, 10000);
      if (runId !== scanRun) return;
      stateView.eBay.matches = result.available && Array.isArray(result.samples) ? result.samples.map((x) => ({ source: "eBay", title: x.title || q, url: x.url || "", price: Number(x.price || 0), currency: x.currency || "USD", condition: x.condition || "Active listing", matchType: "likely", priceType: "active asking" })).filter((x) => x.price > 0) : [];
      stateView.eBay.error = result.available ? "" : (result.error || "eBay research is unavailable right now.");
      stateView.status.ebay = "done";
    } catch (error) {
      if (runId !== scanRun) return;
      stateView.eBay.error = error.message || "eBay search could not finish.";
      stateView.status.ebay = error.code === "TIMEOUT" ? "cancelled" : "error";
    }
    queueRender();
  }

  async function searchWeb(runId) {
    const q = query();
    if (!q || runId !== scanRun) return;
    stateView.status.web = "working"; queueRender();
    try {
      const result = await personal("/discover-web", { query: q, identification: stateView.identification || {}, sellerCountry: "US" }, 13000);
      if (runId !== scanRun) return;
      stateView.web.matches = Array.isArray(result.matches) ? result.matches.map((x) => ({ ...x, source: x.source || "Web", price: Number(x.price || 0), matchType: x.match_type || "similar", priceType: x.price_type || "current price" })).filter((x) => x.price > 0 && String(x.currency || "USD").toUpperCase() === "USD") : [];
      stateView.web.summary = result.summary || "";
      stateView.status.web = "done";
    } catch (error) {
      if (runId !== scanRun) return;
      stateView.web.error = error.code === "TIMEOUT" ? "The public web was slow, so SourceTro stopped waiting. Your eBay results are still usable." : (error.status === 404 ? "Public-web discovery is not available on the current AI worker yet." : (error.message || "Public-web search is unavailable right now."));
      stateView.status.web = error.code === "TIMEOUT" ? "cancelled" : "error";
    }
    queueRender();
  }

  async function start() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !state.sourcePhoto?.url) return;
    const runId = ++scanRun;
    abortAll();
    stateView = fresh();
    stateView.busy = true;
    stateView.status.identify = "working";
    if (typeof setTroState === "function") setTroState("working", "Identifying item…");
    queueRender();
    try {
      let imageData = await smallImage();
      if (runId !== scanRun) return;
      await identify(runId, imageData);
      imageData = "";
      if (runId !== scanRun || !stateView.identification) return;
      const e = searchEbay(runId);
      const w = searchWeb(runId);
      await Promise.race([e, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (runId !== scanRun) return;
      stateView.busy = false;
      if (state.sourceResult) {
        state.sourceResult.discoveryMatches = matches().slice(0, 20);
        state.sourceResult.discoveryAt = new Date().toISOString();
      }
      if (typeof setTroState === "function") setTroState("success", "Scan results ready.", 1600);
      queueRender();
      Promise.allSettled([e, w]).then(() => {
        if (runId !== scanRun) return;
        if (state.sourceResult) state.sourceResult.discoveryMatches = matches().slice(0, 20);
        queueRender();
      });
    } catch (error) {
      if (runId !== scanRun) return;
      stateView.busy = false;
      stateView.error = error.code === "TIMEOUT" ? "Tro is taking unusually long to identify this photo. Try a closer picture with the item filling the frame." : (error.message || "SourceTro could not finish this scan.");
      stateView.status.identify = error.code === "TIMEOUT" ? "cancelled" : "error";
      if (stateView.status.ebay === "idle") stateView.status.ebay = "cancelled";
      if (stateView.status.web === "idle") stateView.status.web = "cancelled";
      if (typeof setTroState === "function") setTroState("ready", "Ready when you are.");
      queueRender();
    }
  }

  function openCamera() {
    const input = document.querySelector("#sourcePhotoInput");
    if (!input) return;
    cameraAwaiting = true;
    cameraOpenedAt = Date.now();
    try { input.value = ""; } catch {}
    input.click();
  }

  function cancelSearch() {
    scanRun += 1;
    abortAll();
    stateView.busy = false;
    ["identify", "ebay", "web"].forEach((k) => { if (stateView.status[k] === "working") stateView.status[k] = "cancelled"; });
    queueRender();
  }

  function cancelAll() {
    cameraAwaiting = false;
    cancelSearch();
    if (typeof resetSourceScan === "function") resetSourceScan();
    document.querySelector("#sidebar")?.classList.remove("open");
    if (typeof setRoute === "function") setRoute("dashboard"); else location.hash = "dashboard";
  }

  function again() {
    cameraAwaiting = false;
    cancelSearch();
    stateView = fresh(); detailMode = false;
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof render === "function") render();
    setTimeout(renderPanel, 50);
  }

  function save() {
    if (!state.sourceResult) return;
    state.sourceResult.discoveryMatches = matches().slice(0, 20);
    if (typeof saveSourceDecision === "function") saveSourceDecision();
  }

  function listing() {
    if (!state.sourceResult && typeof buildSourceResult === "function" && stateView.analysis) {
      try { buildSourceResult(stateView.analysis); } catch { try { buildSourceResult(); } catch {} }
    }
    if (state.sourceResult && typeof scanToListing === "function") scanToListing();
    else if (typeof showToast === "function") showToast("Tro needs to identify the item first.");
  }

  document.addEventListener("click", (event) => {
    const scanRoute = event.target.closest?.('[data-route="source-scan"]');
    if (scanRoute) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      document.querySelector("#sidebar")?.classList.remove("open");
      if (typeof state !== "undefined" && state.route !== "source-scan" && typeof setRoute === "function") setRoute("source-scan");
      setTimeout(renderPanel, 45);
      return;
    }
    const button = event.target.closest?.("[data-st52]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const action = button.dataset.st52;
    if (action === "camera") openCamera();
    if (action === "cancel") cancelAll();
    if (action === "stop") cancelSearch();
    if (action === "again") again();
    if (action === "details") { detailMode = !detailMode; renderPanel(); }
    if (action === "save") save();
    if (action === "listing") listing();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "sourcePhotoInput") return;
    cameraAwaiting = false;
    setTimeout(() => {
      if (state?.route === "source-scan" && state?.sourcePhoto?.url) start();
    }, 140);
  });

  document.addEventListener("cancel", (event) => {
    if (event.target?.id === "sourcePhotoInput") cancelAll();
  }, true);

  window.addEventListener("focus", () => {
    if (!cameraAwaiting) return;
    setTimeout(() => {
      const input = document.querySelector("#sourcePhotoInput");
      if (cameraAwaiting && Date.now() - cameraOpenedAt > 700 && !input?.files?.length && !state?.sourcePhoto?.url) cancelAll();
    }, 800);
  });

  window.addEventListener("hashchange", () => {
    document.querySelector("#sidebar")?.classList.remove("open");
    if (typeof state !== "undefined" && state.route === "source-scan") setTimeout(renderPanel, 50);
    else page?.classList.remove("st52-mode", "st52-details");
  });

  const observer = new MutationObserver(() => {
    if (typeof state !== "undefined" && state.route === "source-scan" && !document.querySelector("#sourceTroDiscoveryV52")) queueRender();
  });
  if (typeof page !== "undefined" && page) observer.observe(page, { childList: true, subtree: false });

  window.SourceTroDiscovery = { start, cancel: cancelAll, scanAnother: again, results: () => ({ ...stateView, matches: matches(), stats: stats() }) };
  ensureStyles();
  if (typeof state !== "undefined" && state.route === "source-scan") setTimeout(renderPanel, 50);
})();
