(() => {
  const PERSONAL_API = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const EBAY_API = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  let scanRun = 0;
  let discovery = freshDiscovery();
  let detailMode = false;
  let cameraAwaiting = false;
  let cameraOpenedAt = 0;
  const controllers = new Set();

  function freshDiscovery() {
    return {
      busy: false,
      identification: null,
      analysis: null,
      eBay: { status: "idle", matches: [], error: "" },
      web: { status: "idle", matches: [], sources: [], summary: "", error: "" },
      status: { identify: "idle", ebay: "idle", web: "idle" },
      error: "",
      finished: false,
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
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value = "") {
    try {
      const url = new URL(String(value));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number);
  }

  function median(values) {
    const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function combinedMatches() {
    const seen = new Set();
    return [...(discovery.eBay.matches || []), ...(discovery.web.matches || [])]
      .filter((item) => Number(item.price) > 0)
      .filter((item) => {
        const key = `${safeUrl(item.url)}|${String(item.title || "").toLowerCase().slice(0, 80)}|${Number(item.price).toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const rank = (item) => ({ exact: 0, likely: 1, similar: 2 }[String(item.matchType || item.match_type || "similar").toLowerCase()] ?? 2);
        return rank(a) - rank(b) || Number(a.price) - Number(b.price);
      });
  }

  function priceStats() {
    const prices = combinedMatches().map((item) => Number(item.price)).filter((v) => v > 0);
    if (!prices.length) return null;
    return { low: Math.min(...prices), median: median(prices), high: Math.max(...prices), count: prices.length };
  }

  function abortRequests() {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  async function requestJson(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || `Request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return result;
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeout = new Error("This search took too long, so SourceTro stopped it.");
        timeout.code = "TIMEOUT";
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }

  function personalFetch(path, body, timeoutMs) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${PERSONAL_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SourceTro-Key": key },
      body: JSON.stringify(body),
    }, timeoutMs);
  }

  function ebayFetch(path, timeoutMs = 7000) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${EBAY_API}${path}`, {
      method: "GET",
      headers: { "X-SourceTro-Key": key },
    }, timeoutMs);
  }

  function ensureStyles() {
    if (document.querySelector("#sourceTroDiscoveryStylesV48")) return;
    document.querySelector("#sourceTroDiscoveryStyles")?.remove();
    const style = document.createElement("style");
    style.id = "sourceTroDiscoveryStylesV48";
    style.textContent = `
      .st-discovery-mode>.page-header,.st-discovery-mode>.source-scan-layout,.st-discovery-mode>.source-tools-panel{display:none!important}
      .st-discovery-mode.st-discovery-show-legacy>.page-header{display:flex!important}
      .st-discovery-mode.st-discovery-show-legacy>.source-scan-layout{display:grid!important}
      .st-discovery-mode.st-discovery-show-legacy>.source-tools-panel{display:block!important}
      .st-discovery-shell{display:grid;gap:18px;max-width:1120px;margin:0 auto 28px}
      .st-scan-card,.st-result-card{background:#fff;border:1px solid #e3e8e6;border-radius:22px;box-shadow:0 8px 26px rgba(22,40,58,.05);padding:22px}
      .st-scan-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}.st-scan-head h1{margin:4px 0 6px;font-size:clamp(28px,4vw,40px);color:#173044}.st-scan-head p{margin:0;color:#687781;max-width:680px}.st-eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4e7c69}
      .st-head-actions{display:flex;gap:8px;flex-wrap:wrap}.st-camera-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:18px;margin-top:20px}
      .st-camera-box{min-height:300px;border:2px dashed #cad7d3;border-radius:20px;background:#f8faf9;display:grid;place-items:center;overflow:hidden;position:relative}.st-camera-box img{width:100%;height:100%;min-height:300px;max-height:480px;object-fit:contain;background:#f3f6f5}
      .st-camera-empty{text-align:center;padding:28px;max-width:480px}.st-lens{width:86px;height:86px;margin:0 auto 15px;border-radius:50%;border:3px solid #173044;box-shadow:inset 0 0 0 10px #e8efed;display:grid;place-items:center;font-size:36px;color:#173044;background:#fff}.st-camera-empty h2{margin:0 0 7px;color:#173044}.st-camera-empty p{margin:0 0 17px;color:#6b7a83}.st-camera-buttons{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
      .st-progress{border-radius:18px;background:#f5f8f7;padding:17px}.st-progress h3{margin:0 0 4px;color:#173044}.st-progress>p{margin:0;color:#6c7a83;font-size:13px}.st-status-list{display:grid;gap:9px;margin-top:14px}.st-status-row{display:grid;grid-template-columns:24px 1fr auto;gap:9px;align-items:center;background:#fff;border:1px solid #e6ece9;border-radius:13px;padding:10px}.st-status-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#dfe6e4;font-size:11px;font-weight:900}.st-status-row.working .st-status-dot{background:#d7efe5;animation:stPulse 1s infinite}.st-status-row.done .st-status-dot{background:#d7efe5;color:#176344}.st-status-row.error .st-status-dot{background:#ffe1d7;color:#92462f}.st-status-row.cancelled .st-status-dot{background:#eceff0;color:#64727a}.st-status-row small{display:block;color:#6d7a83}.st-status-row b{font-size:11px;color:#4e626e}
      @keyframes stPulse{0%,100%{transform:scale(.9);opacity:.65}50%{transform:scale(1.08);opacity:1}}
      .st-progress-actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}.st-inline-note{font-size:12px;color:#6e7c84;margin-top:10px}.st-error{padding:11px 12px;border-radius:12px;background:#fff0ea;color:#8a4431;margin-top:10px;font-size:13px}
      .st-found{display:grid;grid-template-columns:1fr auto;gap:12px}.st-found h2{margin:4px 0 5px;color:#173044}.st-found p{margin:0;color:#667781}.st-badge{padding:6px 10px;border-radius:999px;background:#eef6f2;color:#25624d;font-size:12px;font-weight:800}.st-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.st-tags span{padding:6px 9px;border-radius:999px;background:#f2f5f4;color:#586870;font-size:12px}
      .st-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.st-price{padding:14px;border-radius:15px;background:#f4f8f6}.st-price small{display:block;color:#687982}.st-price strong{font-size:24px;color:#173044}.st-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.st-card-head h3{margin:0;color:#173044}.st-card-head p{margin:3px 0 0;color:#6a7982;font-size:13px}
      .st-match-list{display:grid;gap:9px;margin-top:13px}.st-match{display:grid;grid-template-columns:1fr auto;gap:12px;border:1px solid #e3e9e6;border-radius:14px;padding:12px}.st-match a{display:block;color:#17445c;font-weight:750;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-match small{display:block;color:#6d7b83;margin-top:4px}.st-match-price{text-align:right}.st-match-price strong{display:block;color:#173044}.st-match-price span{font-size:11px;font-weight:800;text-transform:capitalize;color:#4d7565}.st-muted{padding:16px;border:1px dashed #ccd8d4;border-radius:14px;color:#687982;text-align:center;margin-top:12px}
      .st-decision{padding:15px;border-radius:15px;background:#f0f7f3;margin-top:13px}.st-decision.pass{background:#fff1eb}.st-decision.consider,.st-decision.caution{background:#fff8e8}.st-decision strong{font-size:21px;color:#173044}.st-decision p{margin:4px 0 0;color:#5f6f78}.st-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:13px}.st-cost{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:13px}.st-cost label{font-size:12px;font-weight:800;color:#435965}.st-cost input{display:block;width:100%;margin-top:5px;min-height:43px;border:1px solid #ccd7d3;border-radius:11px;padding:9px 11px;font:inherit}
      @media(max-width:820px){.st-camera-grid{grid-template-columns:1fr}.st-camera-box{min-height:250px}.st-camera-box img{min-height:250px}.st-price-grid{grid-template-columns:1fr}.st-match{grid-template-columns:1fr}.st-match-price{text-align:left}.st-cost{grid-template-columns:1fr}.st-scan-card,.st-result-card{padding:17px}}
    `;
    document.head.appendChild(style);
  }

  function statusRow(key, label, detail) {
    const status = discovery.status[key] || "idle";
    const icon = status === "done" ? "✓" : status === "error" ? "!" : status === "working" ? "●" : status === "cancelled" ? "×" : "·";
    const text = status === "done" ? "Done" : status === "error" ? "Unavailable" : status === "working" ? "Working" : status === "cancelled" ? "Cancelled" : "Waiting";
    return `<div class="st-status-row ${status}"><span class="st-status-dot">${icon}</span><div><strong>${label}</strong><small>${detail}</small></div><b>${text}</b></div>`;
  }

  function identificationMarkup() {
    const id = discovery.identification;
    if (!id) return "";
    const title = [id.brand, id.item_type].filter(Boolean).join(" ") || "Item identified";
    const tags = [id.category, id.color, id.size, id.style, id.condition].filter(Boolean);
    return `<section class="st-result-card"><div class="st-found"><div><span class="st-eyebrow">Tro found</span><h2>${esc(title)}</h2><p>${esc(discovery.analysis?.evaluation?.explanation || "Tro used the photo to identify the item and build stronger search terms.")}</p></div><span class="st-badge">${esc(id.confidence || "photo match")}</span></div>${tags.length ? `<div class="st-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}</section>`;
  }

  function pricesMarkup() {
    const stats = priceStats();
    return `<section class="st-result-card"><div class="st-card-head"><div><h3>Current prices found</h3><p>eBay first, then the public web when available.</p></div></div>${stats ? `<div class="st-price-grid"><div class="st-price"><small>Lowest found</small><strong>${money(stats.low)}</strong></div><div class="st-price"><small>Typical found</small><strong>${money(stats.median)}</strong></div><div class="st-price"><small>Highest found</small><strong>${money(stats.high)}</strong></div></div><p class="st-inline-note">These are current asking/retail prices, not guaranteed sold prices.</p>` : `<div class="st-muted">${discovery.status.ebay === "working" || discovery.status.web === "working" ? "Price matches are still arriving…" : "No reliable priced matches found yet."}</div>`}</section>`;
  }

  function matchesMarkup() {
    const matches = combinedMatches().slice(0, 10);
    return `<section class="st-result-card"><div class="st-card-head"><div><h3>Matches from around the web</h3><p>Exact, likely, and similar matches stay labeled separately.</p></div></div>${matches.length ? `<div class="st-match-list">${matches.map((item) => {
      const url = safeUrl(item.url);
      const type = String(item.matchType || item.match_type || "similar").toLowerCase();
      const source = item.source || item.marketplace || "Web";
      return `<div class="st-match"><div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.title || "Matching listing")}</a>` : `<strong>${esc(item.title || "Matching listing")}</strong>`}<small>${esc(source)} · ${esc(item.condition || item.priceType || item.price_type || "current listing")}</small></div><div class="st-match-price"><strong>${money(item.price)}</strong><span>${esc(type)} match</span></div></div>`;
    }).join("")}</div>` : `<div class="st-muted">${discovery.status.web === "working" ? "Public web search is continuing in the background…" : "No additional public-web matches were reliable enough to show."}</div>`}${discovery.web.error ? `<div class="st-error">${esc(discovery.web.error)}</div>` : ""}<p class="st-inline-note">SourceTro searches accessible public pages and marketplace APIs. Some sites block automated search, so results depend on what is publicly available.</p></section>`;
  }

  function decisionMarkup() {
    const result = typeof state !== "undefined" ? state.sourceResult : null;
    if (!result) return "";
    return `<section class="st-result-card"><div class="st-card-head"><div><h3>Tro recommendation</h3><p>Uses your TroFit goals and the item details Tro could verify.</p></div><span class="st-badge">TroScore ${Number(result.troScore || 0)}/100</span></div><div class="st-decision ${esc(result.tone || "consider")}"><strong>${esc(result.recommendation || "Review item")}</strong><p>${esc(result.reason || "Review the item and current prices before deciding.")}</p></div><div class="st-cost"><label>${state.sourceScan.journey === "Thinking of buying" ? "What is the store asking?" : "What did you pay?"}<input id="stDiscoveryCost" type="number" min="0" step=".01" inputmode="decimal" value="${esc(state.sourceScan.purchasePrice || "")}" placeholder="0.00"></label><button class="button secondary" type="button" data-discovery-action="recalculate">Update decision</button></div><div class="st-actions"><button class="button large" type="button" data-discovery-action="listing">Create listing →</button><button class="button secondary" type="button" data-discovery-action="save">Save scan</button><button class="button ghost" type="button" data-discovery-action="again">Scan another</button></div></section>`;
  }

  function renderPanel() {
    if (typeof state === "undefined" || state.route !== "source-scan" || typeof page === "undefined" || !page) return;
    ensureStyles();
    page.classList.add("st-discovery-mode");
    page.classList.toggle("st-discovery-show-legacy", detailMode);

    let shell = document.querySelector("#sourceTroDiscovery");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "sourceTroDiscovery";
      shell.className = "st-discovery-shell";
      page.insertAdjacentElement("afterbegin", shell);
    }

    const hasPhoto = Boolean(state.sourcePhoto?.url);
    shell.innerHTML = `<section class="st-scan-card"><div class="st-scan-head"><div><span class="st-eyebrow">Smart Source Scan</span><h1>Should I buy this?</h1><p>Take one photo. Tro identifies it, checks eBay first, then searches the public web when available—without making you wait forever.</p></div><div class="st-head-actions"><button class="button secondary" type="button" data-discovery-action="details">${detailMode ? "Hide details" : "More details"}</button><button class="button ghost" type="button" data-discovery-action="cancel">Cancel</button></div></div><div class="st-camera-grid"><div class="st-camera-box">${hasPhoto ? `<img src="${esc(state.sourcePhoto.url)}" alt="Item being scanned">` : `<div class="st-camera-empty"><div class="st-lens">◎</div><h2>Scan an item</h2><p>Use the same simple camera flow throughout SourceTro.</p><div class="st-camera-buttons"><button class="button large" type="button" data-discovery-action="camera">Take picture</button><button class="button ghost" type="button" data-discovery-action="cancel">Cancel</button></div></div>`}</div><aside class="st-progress"><h3>${discovery.busy ? "Tro is working…" : hasPhoto ? "Results" : "What Tro checks"}</h3><p>${discovery.busy ? "Fast results appear first. Web search keeps going only for a short time." : "eBay is checked first. Public-web searching is optional and time-limited."}</p><div class="st-status-list">${statusRow("identify", "Identify the item", "Brand, type, style and condition clues")}${statusRow("ebay", "Check eBay", "Current active listings and asking prices")}${statusRow("web", "Search the web", "Accessible resale, retail and specialty sites")}</div>${discovery.error ? `<div class="st-error">${esc(discovery.error)}</div>` : ""}<div class="st-progress-actions">${discovery.busy ? `<button class="button ghost" type="button" data-discovery-action="stop">Cancel search</button>` : hasPhoto ? `<button class="button secondary" type="button" data-discovery-action="again">Retake / scan another</button>` : ""}</div><p class="st-inline-note">If the web is slow or unavailable, SourceTro stops waiting and still shows the item and eBay results.</p></aside></div></section>${identificationMarkup()}${hasPhoto ? pricesMarkup() : ""}${hasPhoto ? matchesMarkup() : ""}${decisionMarkup()}`;
  }

  async function prepareSmallImage() {
    if (!state?.sourcePhoto?.url) throw new Error("Take a photo first.");
    const response = await fetch(state.sourcePhoto.url);
    const blob = await response.blob();
    const maxDimension = 900;

    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      try {
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", .68);
      } finally {
        bitmap.close?.();
      }
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("SourceTro could not prepare that photo."));
      reader.readAsDataURL(blob);
    });
  }

  function applyAnalysis(analysis) {
    const id = analysis?.identification || {};
    discovery.analysis = analysis;
    discovery.identification = id;
    state.lastAIAnalysis = analysis;
    if (id.item_type) state.sourceScan.itemName = id.item_type;
    if (id.brand) state.sourceScan.brand = id.brand;
    if (id.category && typeof normalizeCategory === "function") state.sourceScan.category = normalizeCategory(id.category, state.sourceScan.category);
    if (id.condition && typeof normalizeCondition === "function") state.sourceScan.condition = normalizeCondition(id.condition, state.sourceScan.condition);
    state.sourceScan.marketplace = "All marketplaces";
    try { sessionStorage.setItem("sourcetro_ai_verified", "true"); state.aiStatus = "connected"; } catch {}
    if (typeof buildSourceResult === "function") buildSourceResult();
  }

  function searchQuery() {
    const analysis = discovery.analysis || {};
    return String(analysis?.listing?.seo_title || analysis?.research?.ebay_sold_search || [analysis?.identification?.brand, analysis?.identification?.item_type, analysis?.identification?.style].filter(Boolean).join(" ") || [state?.sourceScan?.brand, state?.sourceScan?.itemName, state?.sourceScan?.barcode].filter(Boolean).join(" ")).trim().slice(0, 180);
  }

  async function runEbaySearch(runId) {
    const query = searchQuery();
    if (!query || runId !== scanRun) return;
    discovery.status.ebay = "working";
    discovery.eBay.status = "working";
    renderPanel();
    try {
      const result = await ebayFetch(`/ebay/research?q=${encodeURIComponent(query)}`, 7000);
      if (runId !== scanRun) return;
      discovery.eBay.matches = result.available && Array.isArray(result.samples) ? result.samples.map((item) => ({ source: "eBay", marketplace: "eBay", title: item.title || query, url: item.url || "", price: Number(item.price || 0), currency: item.currency || "USD", condition: item.condition || "Active listing", matchType: "likely", priceType: "active asking" })).filter((item) => item.price > 0) : [];
      discovery.eBay.error = result.available ? "" : (result.error || "eBay price research is unavailable right now.");
      discovery.status.ebay = "done";
      discovery.eBay.status = "done";
    } catch (error) {
      if (runId !== scanRun) return;
      discovery.eBay.error = error.message || "eBay search could not finish.";
      discovery.status.ebay = error.code === "TIMEOUT" ? "cancelled" : "error";
      discovery.eBay.status = discovery.status.ebay;
    }
    renderPanel();
  }

  async function runWebSearch(runId) {
    const query = searchQuery();
    if (!query || runId !== scanRun) return;
    discovery.status.web = "working";
    discovery.web.status = "working";
    renderPanel();
    try {
      // Deliberately send search words and identification only. Sending the same
      // large camera image to both AI analysis and web search was the main mobile
      // memory pressure in v47.
      const result = await personalFetch("/discover-web", {
        query,
        identification: discovery.identification || {},
        sellerCountry: "US",
      }, 9000);
      if (runId !== scanRun) return;
      discovery.web.matches = Array.isArray(result.matches) ? result.matches.map((item) => ({ ...item, source: item.source || "Web", title: item.title || "Matching listing", url: item.url || "", price: Number(item.price || 0), currency: item.currency || "USD", matchType: item.match_type || "similar", priceType: item.price_type || "current price" })).filter((item) => item.price > 0 && item.currency === "USD") : [];
      discovery.web.sources = Array.isArray(result.sources) ? result.sources : [];
      discovery.web.summary = result.summary || "";
      discovery.status.web = "done";
      discovery.web.status = "done";
    } catch (error) {
      if (runId !== scanRun) return;
      if (error.code === "TIMEOUT") {
        discovery.web.error = "The public web was slow, so SourceTro stopped waiting. Your eBay results are still usable.";
        discovery.status.web = "cancelled";
      } else if (error.status === 404) {
        discovery.web.error = "Public-web discovery is not available on the current AI worker. eBay results still work.";
        discovery.status.web = "error";
      } else {
        discovery.web.error = error.message || "Public-web search is unavailable right now.";
        discovery.status.web = "error";
      }
      discovery.web.status = discovery.status.web;
    }
    renderPanel();
  }

  async function startDiscovery() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !state.sourcePhoto?.url) return;
    const runId = ++scanRun;
    abortRequests();
    discovery = freshDiscovery();
    discovery.busy = true;
    discovery.status.identify = "working";
    if (typeof setTroState === "function") setTroState("working", "Identifying item…");
    renderPanel();

    let imageData = "";
    try {
      imageData = await prepareSmallImage();
      if (runId !== scanRun) return;
      const analysisResult = await personalFetch("/analyze", {
        mode: state.sourceScan.journey === "Thinking of buying" ? "sourcing" : "owned",
        purchaseCost: state.sourceScan.purchasePrice || null,
        targetProfit: state.troFit?.minimumProfit || null,
        notes: [state.sourceScan.sourceLocation, state.sourceScan.barcode].filter(Boolean).join(" · "),
        images: [imageData],
      }, 18000);
      imageData = "";
      if (runId !== scanRun) return;
      applyAnalysis(analysisResult.analysis || {});
      discovery.status.identify = "done";
      renderPanel();

      const ebayPromise = runEbaySearch(runId);
      const webPromise = runWebSearch(runId);

      // Do not make the seller wait for the broad web. As soon as eBay returns,
      // or after a few seconds, the scan becomes usable while web search can finish.
      await Promise.race([ebayPromise, new Promise((resolve) => setTimeout(resolve, 4500))]);
      if (runId !== scanRun) return;
      discovery.busy = false;
      discovery.finished = true;
      if (state.sourceResult) {
        state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
        state.sourceResult.discoveryAt = new Date().toISOString();
      }
      if (typeof setTroState === "function") setTroState("success", "Fast results ready.", 1600);
      renderPanel();

      Promise.allSettled([ebayPromise, webPromise]).then(() => {
        if (runId !== scanRun) return;
        if (state.sourceResult) state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
        renderPanel();
      });
    } catch (error) {
      imageData = "";
      if (runId !== scanRun) return;
      discovery.error = error.message || "SourceTro could not finish this scan.";
      discovery.status.identify = error.code === "TIMEOUT" ? "cancelled" : "error";
      discovery.busy = false;
      if (typeof setTroState === "function") setTroState("ready", "Ready when you are.");
      renderPanel();
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

  function cancelSearchOnly() {
    scanRun += 1;
    abortRequests();
    discovery.busy = false;
    for (const key of ["identify", "ebay", "web"]) if (discovery.status[key] === "working") discovery.status[key] = "cancelled";
    if (typeof setTroState === "function") setTroState("ready", "Search cancelled.", 1200);
    renderPanel();
  }

  function cancelScan() {
    cameraAwaiting = false;
    cancelSearchOnly();
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof setRoute === "function") setRoute("dashboard");
    else location.hash = "dashboard";
  }

  function resetAndOpen() {
    scanRun += 1;
    abortRequests();
    discovery = freshDiscovery();
    detailMode = false;
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof render === "function") render();
    setTimeout(() => { renderPanel(); openCamera(); }, 40);
  }

  function recalculateDecision() {
    const input = document.querySelector("#stDiscoveryCost");
    if (input) state.sourceScan.purchasePrice = input.value;
    if (typeof buildSourceResult === "function") buildSourceResult();
    if (state.sourceResult) state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    renderPanel();
  }

  function saveScan() {
    if (!state.sourceResult) return;
    state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    state.sourceResult.discoveryWebSummary = discovery.web.summary || "";
    if (typeof saveSourceDecision === "function") saveSourceDecision();
    if (typeof showToast === "function") showToast("Smart Source Scan saved.");
  }

  function createListing() {
    if (!state.sourceResult) {
      if (typeof showToast === "function") showToast("Let Tro finish identifying the item first.");
      return;
    }
    state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    if (typeof scanToListing === "function") scanToListing();
  }

  function activateScanRoute(openImmediately = false) {
    setTimeout(() => {
      renderPanel();
      if (openImmediately) setTimeout(openCamera, 40);
    }, 40);
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest?.('[data-route="source-scan"]');
    if (routeButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const alreadyHere = typeof state !== "undefined" && state.route === "source-scan";
      if (!alreadyHere && typeof setRoute === "function") setRoute("source-scan");
      activateScanRoute(true);
      return;
    }

    const button = event.target.closest?.("[data-discovery-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.discoveryAction;
    if (action === "camera") openCamera();
    if (action === "again") resetAndOpen();
    if (action === "cancel") cancelScan();
    if (action === "stop") cancelSearchOnly();
    if (action === "details") { detailMode = !detailMode; renderPanel(); }
    if (action === "recalculate") recalculateDecision();
    if (action === "save") saveScan();
    if (action === "listing") createListing();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "sourcePhotoInput") return;
    cameraAwaiting = false;
    const file = event.target.files?.[0];
    if (!file) {
      cancelScan();
      return;
    }
    setTimeout(() => {
      renderPanel();
      if (state?.sourcePhoto?.url) startDiscovery();
    }, 120);
  });

  // Modern mobile browsers fire cancel when the user backs out of the native
  // camera/file picker. This sends them straight back instead of trapping them.
  document.addEventListener("cancel", (event) => {
    if (event.target?.id === "sourcePhotoInput") cancelScan();
  }, true);

  // Fallback for browsers that do not dispatch the input cancel event.
  window.addEventListener("focus", () => {
    if (!cameraAwaiting) return;
    setTimeout(() => {
      const input = document.querySelector("#sourcePhotoInput");
      if (cameraAwaiting && Date.now() - cameraOpenedAt > 600 && !input?.files?.length && !state?.sourcePhoto?.url) cancelScan();
    }, 750);
  });

  window.addEventListener("hashchange", () => {
    if (typeof state !== "undefined" && state.route === "source-scan") activateScanRoute(false);
    else if (typeof page !== "undefined" && page) page.classList.remove("st-discovery-mode", "st-discovery-show-legacy");
  });
  window.addEventListener("pageshow", () => {
    if (typeof state !== "undefined" && state.route === "source-scan") activateScanRoute(false);
  });

  window.SourceTroDiscovery = {
    start: startDiscovery,
    scanAnother: resetAndOpen,
    cancel: cancelScan,
    results: () => ({ ...discovery, matches: combinedMatches(), stats: priceStats() }),
  };

  ensureStyles();
  if (typeof state !== "undefined" && state.route === "source-scan") activateScanRoute(false);
})();