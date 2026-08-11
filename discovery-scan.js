(() => {
  const PERSONAL_API = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const EBAY_API = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  let scanRun = 0;
  let cameraOpenPending = false;
  let detailMode = false;
  let discovery = freshDiscovery();
  let decorateTimer = null;

  function freshDiscovery() {
    return {
      busy: false,
      startedAt: 0,
      photoData: "",
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
    } catch {
      return "";
    }
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
    } catch {
      return "";
    }
  }

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number);
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function matchRank(match) {
    const type = String(match.matchType || match.match_type || "similar").toLowerCase();
    if (type === "exact") return 0;
    if (type === "likely") return 1;
    return 2;
  }

  function combinedMatches() {
    const seen = new Set();
    return [...(discovery.eBay.matches || []), ...(discovery.web.matches || [])]
      .filter((item) => Number(item.price) > 0)
      .filter((item) => {
        const key = `${safeUrl(item.url)}|${String(item.title || "").toLowerCase().slice(0, 90)}|${Number(item.price).toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => matchRank(a) - matchRank(b) || Number(a.price) - Number(b.price));
  }

  function priceStats() {
    const prices = combinedMatches().map((item) => Number(item.price)).filter((value) => value > 0);
    if (!prices.length) return null;
    return {
      low: Math.min(...prices),
      median: median(prices),
      high: Math.max(...prices),
      count: prices.length,
    };
  }

  function personalFetch(path, body) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return fetch(`${PERSONAL_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SourceTro-Key": key },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(body),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || `SourceTro request failed (${response.status}).`);
        error.status = response.status;
        error.details = result;
        throw error;
      }
      return result;
    });
  }

  function ebayFetch(path) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return fetch(`${EBAY_API}${path}`, {
      method: "GET",
      headers: { "X-SourceTro-Key": key },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `eBay search failed (${response.status}).`);
      return result;
    });
  }

  function ensureStyles() {
    if (document.querySelector("#sourceTroDiscoveryStyles")) return;
    const style = document.createElement("style");
    style.id = "sourceTroDiscoveryStyles";
    style.textContent = `
      .st-discovery-mode>.page-header,.st-discovery-mode>.source-scan-layout,.st-discovery-mode>.source-tools-panel{display:none!important}
      .st-discovery-mode.st-discovery-show-legacy>.page-header{display:flex!important}
      .st-discovery-mode.st-discovery-show-legacy>.source-scan-layout{display:grid!important}
      .st-discovery-mode.st-discovery-show-legacy>.source-tools-panel{display:block!important}
      .st-discovery-shell{display:grid;gap:18px;max-width:1180px;margin:0 auto 24px}
      .st-discovery-hero{position:relative;overflow:hidden;border-radius:26px;padding:24px;background:linear-gradient(135deg,#152a3d,#244c5b);color:#fff;box-shadow:0 18px 48px rgba(16,38,55,.18)}
      .st-discovery-hero:after{content:"";position:absolute;right:-80px;top:-110px;width:280px;height:280px;border-radius:50%;border:44px solid rgba(255,255,255,.06)}
      .st-discovery-top{position:relative;z-index:1;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
      .st-discovery-kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#bfe7d9}
      .st-discovery-title{margin:7px 0 6px;font-size:clamp(28px,4vw,44px);line-height:1.04}.st-discovery-sub{margin:0;max-width:720px;color:#d9e5e9}
      .st-discovery-controls{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:2}.st-discovery-controls button{white-space:nowrap}
      .st-camera-stage{position:relative;z-index:1;margin-top:20px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:18px}
      .st-camera-card{min-height:330px;border:1px solid rgba(255,255,255,.18);border-radius:22px;background:rgba(255,255,255,.08);display:grid;place-items:center;overflow:hidden;position:relative}
      .st-camera-card img{width:100%;height:100%;min-height:330px;max-height:500px;object-fit:contain;background:#102331}
      .st-camera-empty{text-align:center;padding:30px}.st-camera-icon{width:82px;height:82px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px;border:2px solid rgba(255,255,255,.45);font-size:34px;box-shadow:inset 0 0 0 10px rgba(255,255,255,.06)}
      .st-camera-empty h2{margin:0 0 7px}.st-camera-empty p{margin:0 auto 18px;max-width:380px;color:#d9e5e9}.st-camera-empty .button{background:#fff;color:#173044}
      .st-scan-panel{border-radius:22px;background:#fff;color:#172b3a;padding:18px;align-self:stretch;box-shadow:0 12px 36px rgba(3,24,38,.12)}
      .st-scan-panel h3{margin:0 0 4px}.st-scan-panel>p{margin:0;color:#677681;font-size:13px}.st-status-list{display:grid;gap:10px;margin-top:16px}
      .st-status-row{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:9px;padding:10px;border-radius:13px;background:#f5f8f8}.st-status-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#d9e2e5;font-size:11px;font-weight:900}
      .st-status-row.working .st-status-dot{background:#d6f0e7;animation:stPulse 1s infinite}.st-status-row.done .st-status-dot{background:#d7efe2;color:#1e6b4c}.st-status-row.error .st-status-dot{background:#ffe2da;color:#9d4b35}.st-status-row small{color:#6d7b84}.st-status-row b{font-size:11px;color:#4b5d67}
      @keyframes stPulse{0%,100%{transform:scale(.9);opacity:.7}50%{transform:scale(1.1);opacity:1}}
      .st-found-card,.st-prices-card,.st-matches-card,.st-decision-card{border:1px solid rgba(22,40,58,.12);border-radius:22px;background:#fff;padding:20px;box-shadow:0 8px 26px rgba(22,40,58,.05)}
      .st-found-grid{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}.st-found-card h2{margin:3px 0 5px;font-size:26px}.st-found-card p{margin:0;color:#60717c}.st-match-confidence{padding:6px 10px;border-radius:999px;background:#eef6f3;color:#24624c;font-size:12px;font-weight:800}
      .st-identity-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.st-identity-tags span{padding:6px 9px;border-radius:999px;background:#f3f6f7;color:#52626c;font-size:12px}
      .st-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.st-price-stat{padding:15px;border-radius:16px;background:#f4f8f7}.st-price-stat small{display:block;color:#657781}.st-price-stat strong{display:block;margin-top:3px;font-size:25px;color:#173044}
      .st-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.st-card-head h3{margin:0 0 3px}.st-card-head p{margin:0;color:#687781;font-size:13px}.st-source-chips{display:flex;gap:6px;flex-wrap:wrap}.st-source-chip{padding:5px 9px;border-radius:999px;background:#eef4f6;font-size:11px;font-weight:800;color:#395769}
      .st-match-list{display:grid;gap:10px;margin-top:14px}.st-match{display:grid;grid-template-columns:1fr auto;gap:12px;padding:13px;border:1px solid #e2e8ea;border-radius:15px}.st-match-main{min-width:0}.st-match-main>a{display:block;color:#173f56;font-weight:750;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st-match-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:5px}.st-match-meta span{font-size:11px;color:#64737d}.st-match-price{text-align:right}.st-match-price strong{display:block;font-size:18px}.st-match-price span{font-size:11px;font-weight:800;text-transform:capitalize;color:#4f7568}
      .st-discovery-note{margin:12px 0 0;color:#6d7b84;font-size:12px}.st-discovery-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}
      .st-buy-input{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:end;margin-top:14px}.st-buy-input label{display:grid;gap:5px;font-size:12px;font-weight:800}.st-buy-input input{min-height:44px;border:1px solid #ccd7dc;border-radius:12px;padding:10px 12px;font:inherit}.st-decision-banner{padding:15px;border-radius:16px;background:#f0f7f4}.st-decision-banner.pass{background:#fff2ed}.st-decision-banner.consider,.st-decision-banner.caution{background:#fff8e9}.st-decision-banner strong{display:block;font-size:22px}.st-decision-banner p{margin:5px 0 0;color:#5c6c75}
      .st-discovery-error{padding:12px;border-radius:14px;background:#fff1ec;color:#8e4633;margin-top:12px;font-size:13px}.st-discovery-muted{padding:18px;border:1px dashed #ccd9de;border-radius:16px;color:#64747e;text-align:center;margin-top:14px}
      @media(max-width:860px){.st-camera-stage{grid-template-columns:1fr}.st-camera-card{min-height:270px}.st-camera-card img{min-height:270px}.st-price-grid{grid-template-columns:1fr}.st-match{grid-template-columns:1fr}.st-match-price{text-align:left}.st-buy-input{grid-template-columns:1fr}.st-discovery-hero{padding:18px}}
    `;
    document.head.appendChild(style);
  }

  function statusRow(key, label, detail) {
    const status = discovery.status[key] || "idle";
    const icon = status === "done" ? "✓" : status === "error" ? "!" : status === "working" ? "●" : "·";
    const statusLabel = status === "done" ? "Done" : status === "error" ? "Needs attention" : status === "working" ? "Working" : "Waiting";
    return `<div class="st-status-row ${status}"><span class="st-status-dot">${icon}</span><div><strong>${label}</strong><small>${detail}</small></div><b>${statusLabel}</b></div>`;
  }

  function identificationMarkup() {
    const id = discovery.identification;
    if (!id) return "";
    const title = [id.brand, id.item_type].filter(Boolean).join(" ") || "Item identified";
    const tags = [id.category, id.color, id.size, id.style, id.condition].filter(Boolean);
    return `<section class="st-found-card">
      <div class="st-found-grid"><div><small class="st-discovery-kicker" style="color:#427160">Tro found</small><h2>${esc(title)}</h2><p>${esc(discovery.analysis?.evaluation?.explanation || "Tro used the photo to build search terms and listing details.")}</p></div><span class="st-match-confidence">${esc(id.confidence || "photo match")}</span></div>
      ${tags.length ? `<div class="st-identity-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
    </section>`;
  }

  function pricesMarkup() {
    const stats = priceStats();
    if (!stats) return `<section class="st-prices-card"><div class="st-card-head"><div><h3>Price comparison</h3><p>SourceTro is still looking for current priced matches.</p></div></div><div class="st-discovery-muted">No reliable priced matches have arrived yet.</div></section>`;
    return `<section class="st-prices-card">
      <div class="st-card-head"><div><h3>Current prices found</h3><p>${stats.count} priced match${stats.count === 1 ? "" : "es"} across accessible sources.</p></div><div class="st-source-chips"><span class="st-source-chip">eBay</span><span class="st-source-chip">Public web</span></div></div>
      <div class="st-price-grid"><div class="st-price-stat"><small>Lowest found</small><strong>${money(stats.low)}</strong></div><div class="st-price-stat"><small>Typical found</small><strong>${money(stats.median)}</strong></div><div class="st-price-stat"><small>Highest found</small><strong>${money(stats.high)}</strong></div></div>
      <p class="st-discovery-note">These are current asking/retail prices found online, not guaranteed sold prices. Exact identity and condition still matter.</p>
    </section>`;
  }

  function matchesMarkup() {
    const matches = combinedMatches().slice(0, 14);
    const webWorking = discovery.status.web === "working";
    const ebayWorking = discovery.status.ebay === "working";
    if (!matches.length) {
      return `<section class="st-matches-card"><div class="st-card-head"><div><h3>Matches from around the web</h3><p>SourceTro searches accessible public listings and connected marketplace data.</p></div></div><div class="st-discovery-muted">${webWorking || ebayWorking ? "Searching for matching products and prices…" : "No priced matches were reliable enough to show yet."}</div>${discovery.web.error ? `<div class="st-discovery-error">${esc(discovery.web.error)}</div>` : ""}</section>`;
    }
    return `<section class="st-matches-card">
      <div class="st-card-head"><div><h3>Matches from around the web</h3><p>Exact, likely, and similar matches are kept separate so Tro does not pretend they are the same item.</p></div><div class="st-source-chips"><span class="st-source-chip">${discovery.eBay.matches.length} eBay</span><span class="st-source-chip">${discovery.web.matches.length} web</span></div></div>
      <div class="st-match-list">${matches.map((item) => {
        const url = safeUrl(item.url);
        const type = String(item.matchType || item.match_type || "similar").toLowerCase();
        const source = item.source || item.marketplace || "Web";
        return `<div class="st-match"><div class="st-match-main">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.title || "Matching listing")}</a>` : `<strong>${esc(item.title || "Matching listing")}</strong>`}<div class="st-match-meta"><span>${esc(source)}</span><span>${esc(item.condition || item.priceType || item.price_type || "current listing")}</span>${item.whyMatch || item.why_match ? `<span>${esc(item.whyMatch || item.why_match)}</span>` : ""}</div></div><div class="st-match-price"><strong>${money(item.price)}</strong><span>${esc(type)} match</span></div></div>`;
      }).join("")}</div>
      <p class="st-discovery-note">SourceTro searches the public web and marketplace APIs that are accessible. Some websites restrict automated product search, so “all places” means all accessible sources—not every private or blocked marketplace.</p>
    </section>`;
  }

  function decisionMarkup() {
    if (!state?.sourceResult) return "";
    const result = state.sourceResult;
    return `<section class="st-decision-card">
      <div class="st-card-head"><div><h3>Tro recommendation</h3><p>Uses your TroFit goals plus what was visible in the photo. Live asking prices are shown separately above.</p></div><span class="st-match-confidence">TroScore ${Number(result.troScore || 0)}/100</span></div>
      <div class="st-decision-banner ${esc(result.tone || "consider")}" style="margin-top:14px"><strong>${esc(result.recommendation || "Review item")}</strong><p>${esc(result.reason || "Review the item and current matches before deciding.")}</p></div>
      <div class="st-buy-input"><label>${state.sourceScan.journey === "Thinking of buying" ? "What is the store asking?" : "What did you pay?"}<input id="stDiscoveryCost" type="number" min="0" step=".01" inputmode="decimal" value="${esc(state.sourceScan.purchasePrice || "")}" placeholder="0.00"></label><button class="button secondary" type="button" data-discovery-action="recalculate">Update decision</button></div>
      <div class="st-discovery-actions"><button class="button large" type="button" data-discovery-action="listing">Create listing from this scan →</button><button class="button secondary" type="button" data-discovery-action="save">Save this scan</button><button class="button ghost" type="button" data-discovery-action="again">Scan another item</button></div>
    </section>`;
  }

  function renderPanel() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !page) return;
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
    const statusDetail = discovery.busy ? "Results appear as each search finishes." : hasPhoto ? "Your latest scan is shown below." : "The camera opens when you tap Scan. One clear photo is enough to start.";

    shell.innerHTML = `<section class="st-discovery-hero">
      <div class="st-discovery-top"><div><span class="st-discovery-kicker">Smart Discovery Scan · v47</span><h1 class="st-discovery-title">Point. Scan. Compare.</h1><p class="st-discovery-sub">Take one photo and SourceTro immediately identifies the item, searches eBay and the accessible public web, compares current prices, and helps you decide what to do next.</p></div><div class="st-discovery-controls"><button class="button secondary" type="button" data-discovery-action="details">${detailMode ? "Hide details" : "Detailed workbench"}</button><button class="button" type="button" data-discovery-action="again">Scan another</button></div></div>
      <div class="st-camera-stage"><div class="st-camera-card">${hasPhoto ? `<img src="${esc(state.sourcePhoto.url)}" alt="Item being scanned by SourceTro">` : `<div class="st-camera-empty"><div class="st-camera-icon">◎</div><h2>Scan an item now</h2><p>Photograph a shirt, vase, shoes, bag, collectible, home item, or anything else you may want to resell.</p><button class="button large" type="button" data-discovery-action="camera">Open camera</button></div>`}</div>
      <aside class="st-scan-panel"><h3>${discovery.busy ? "Tro is working…" : hasPhoto ? "Scan complete / ready" : "What happens next"}</h3><p>${esc(statusDetail)}</p><div class="st-status-list">${statusRow("identify", "Identifying item", "Brand, type, style, condition and search clues")}${statusRow("ebay", "Searching eBay", "Current active eBay listings and asking prices")}${statusRow("web", "Exploring the web", "Accessible marketplaces, retailers and resale sites")}</div>${discovery.error ? `<div class="st-discovery-error">${esc(discovery.error)}</div>` : ""}</aside></div>
    </section>
    ${identificationMarkup()}${hasPhoto ? pricesMarkup() : ""}${hasPhoto ? matchesMarkup() : ""}${decisionMarkup()}`;
  }

  async function photoDataUrl() {
    if (!state?.sourcePhoto?.url) throw new Error("Take a photo first.");
    if (typeof imageUrlForAI === "function") return imageUrlForAI(state.sourcePhoto.url);
    const response = await fetch(state.sourcePhoto.url);
    if (!response.ok) throw new Error("SourceTro could not read that photo.");
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("SourceTro could not prepare that photo."));
      reader.readAsDataURL(blob);
    });
  }

  function applyAnalysis(analysis) {
    const id = analysis?.identification || {};
    state.lastAIAnalysis = analysis;
    discovery.analysis = analysis;
    discovery.identification = id;
    if (id.item_type) state.sourceScan.itemName = id.item_type;
    if (id.brand) state.sourceScan.brand = id.brand;
    if (id.category && typeof normalizeCategory === "function") state.sourceScan.category = normalizeCategory(id.category, state.sourceScan.category);
    if (id.condition && typeof normalizeCondition === "function") state.sourceScan.condition = normalizeCondition(id.condition, state.sourceScan.condition);
    state.sourceScan.marketplace = "All marketplaces";
    try {
      sessionStorage.setItem("sourcetro_ai_verified", "true");
      state.aiStatus = "connected";
    } catch {}
    if (typeof buildSourceResult === "function") {
      buildSourceResult();
      if (state.sourceResult) {
        state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
        state.sourceResult.discoveryAt = new Date().toISOString();
      }
    }
  }

  function searchQuery() {
    const analysis = discovery.analysis || {};
    return String(
      analysis?.research?.ebay_sold_search
      || analysis?.listing?.seo_title
      || [analysis?.identification?.brand, analysis?.identification?.item_type, analysis?.identification?.style]
        .filter(Boolean)
        .join(" ")
      || [state?.sourceScan?.brand, state?.sourceScan?.itemName, state?.sourceScan?.barcode]
        .filter(Boolean)
        .join(" ")
    ).trim().slice(0, 200);
  }

  async function runEbaySearch(runId) {
    const query = searchQuery();
    if (!query || runId !== scanRun) return;
    discovery.status.ebay = "working";
    discovery.eBay.status = "working";
    renderPanel();
    try {
      const result = await ebayFetch(`/ebay/research?q=${encodeURIComponent(query)}`);
      if (runId !== scanRun) return;
      discovery.eBay.matches = result.available && Array.isArray(result.samples)
        ? result.samples.map((item) => ({
            source: "eBay",
            marketplace: "eBay",
            title: item.title || query,
            url: item.url || "",
            price: Number(item.price || 0),
            currency: item.currency || "USD",
            condition: item.condition || "Active listing",
            matchType: "likely",
            priceType: "active asking",
            whyMatch: "eBay keyword match",
          })).filter((item) => item.price > 0)
        : [];
      discovery.eBay.error = result.available ? "" : (result.error || "eBay search is unavailable right now.");
      discovery.status.ebay = "done";
      discovery.eBay.status = "done";
      if (state.sourceResult) state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    } catch (error) {
      if (runId !== scanRun) return;
      discovery.eBay.error = error.message || "eBay search could not finish.";
      discovery.status.ebay = "error";
      discovery.eBay.status = "error";
    }
    renderPanel();
  }

  async function runWebSearch(runId, imageData) {
    discovery.status.web = "working";
    discovery.web.status = "working";
    renderPanel();
    try {
      const result = await personalFetch("/discover-web", {
        image: imageData,
        query: searchQuery(),
        identification: discovery.identification || {},
        sellerCountry: "US",
      });
      if (runId !== scanRun) return;
      discovery.web.matches = Array.isArray(result.matches)
        ? result.matches.map((item) => ({
            ...item,
            source: item.source || "Web",
            title: item.title || "Matching listing",
            url: item.url || "",
            price: Number(item.price || 0),
            currency: item.currency || "USD",
            matchType: item.match_type || "similar",
            priceType: item.price_type || "current price",
            whyMatch: item.why_match || "",
          })).filter((item) => item.price > 0 && item.currency === "USD")
        : [];
      discovery.web.sources = Array.isArray(result.sources) ? result.sources : [];
      discovery.web.summary = result.summary || "";
      discovery.status.web = "done";
      discovery.web.status = "done";
      if (state.sourceResult) state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    } catch (error) {
      if (runId !== scanRun) return;
      discovery.web.error = error.status === 404
        ? "Broad web discovery is waiting for the SourceTro v15 AI worker deployment. eBay and photo identification can still work."
        : (error.message || "Web discovery could not finish.");
      discovery.status.web = "error";
      discovery.web.status = "error";
    }
    renderPanel();
  }

  async function startDiscovery() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !state.sourcePhoto?.url) return;
    const runId = ++scanRun;
    discovery = freshDiscovery();
    discovery.busy = true;
    discovery.startedAt = Date.now();
    discovery.status.identify = "working";
    discovery.status.web = "working";
    discovery.status.ebay = "idle";
    if (typeof setTroState === "function") setTroState("working", "Scanning and searching…");
    renderPanel();

    try {
      const imageData = await photoDataUrl();
      if (runId !== scanRun) return;
      discovery.photoData = imageData;

      const webPromise = runWebSearch(runId, imageData);
      const analysisResult = await personalFetch("/analyze", {
        mode: state.sourceScan.journey === "Thinking of buying" ? "sourcing" : "owned",
        purchaseCost: state.sourceScan.purchasePrice || null,
        targetProfit: state.troFit?.minimumProfit || null,
        notes: [state.sourceScan.sourceLocation, state.sourceScan.barcode].filter(Boolean).join(" · "),
        images: [imageData],
      });
      if (runId !== scanRun) return;
      applyAnalysis(analysisResult.analysis || {});
      discovery.status.identify = "done";
      renderPanel();

      const ebayPromise = runEbaySearch(runId);
      await Promise.allSettled([webPromise, ebayPromise]);
      if (runId !== scanRun) return;
      discovery.finished = true;
      discovery.busy = false;
      if (state.sourceResult) state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
      if (typeof setTroState === "function") setTroState("success", "Scan results ready.", 2000);
    } catch (error) {
      if (runId !== scanRun) return;
      discovery.error = error.message || "SourceTro could not finish this scan.";
      discovery.status.identify = "error";
      discovery.busy = false;
      if (typeof setTroState === "function") setTroState("ready", "Ready when you are.");
    }
    renderPanel();
  }

  function openCamera() {
    const input = document.querySelector("#sourcePhotoInput");
    if (!input) {
      renderPanel();
      setTimeout(() => document.querySelector("#sourcePhotoInput")?.click(), 40);
      return;
    }
    input.click();
  }

  function resetAndOpen() {
    scanRun += 1;
    discovery = freshDiscovery();
    detailMode = false;
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof render === "function") render();
    setTimeout(openCamera, 30);
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
    if (typeof showToast === "function") showToast("Smart Discovery Scan saved.");
  }

  function createListing() {
    if (!state.sourceResult) {
      if (typeof showToast === "function") showToast("Let Tro finish identifying the item first.");
      return;
    }
    state.sourceResult.discoveryMatches = combinedMatches().slice(0, 20);
    if (typeof scanToListing === "function") scanToListing();
  }

  function decorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => {
      if (typeof state === "undefined" || !page) return;
      if (state.route !== "source-scan") {
        page.classList.remove("st-discovery-mode", "st-discovery-show-legacy");
        return;
      }
      renderPanel();
      if (cameraOpenPending) {
        cameraOpenPending = false;
        setTimeout(openCamera, 20);
      }
    }, 30);
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest?.('[data-route="source-scan"]');
    if (routeButton && typeof state !== "undefined" && state.route !== "source-scan") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      cameraOpenPending = true;
      if (typeof setRoute === "function") setRoute("source-scan");
      decorate();
      return;
    }

    const actionButton = event.target.closest?.("[data-discovery-action]");
    if (!actionButton) return;
    event.preventDefault();
    event.stopPropagation();
    const action = actionButton.dataset.discoveryAction;
    if (action === "camera") openCamera();
    if (action === "again") resetAndOpen();
    if (action === "details") { detailMode = !detailMode; renderPanel(); }
    if (action === "recalculate") recalculateDecision();
    if (action === "save") saveScan();
    if (action === "listing") createListing();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "sourcePhotoInput") return;
    setTimeout(() => {
      if (state?.sourcePhoto?.url) startDiscovery();
    }, 80);
  });

  window.addEventListener("hashchange", decorate);
  window.addEventListener("pageshow", decorate);
  const observer = new MutationObserver(decorate);
  if (typeof page !== "undefined" && page) observer.observe(page, { childList: true, subtree: true });

  window.SourceTroDiscovery = {
    start: startDiscovery,
    scanAnother: resetAndOpen,
    results: () => ({ ...discovery, matches: combinedMatches(), stats: priceStats() }),
  };

  ensureStyles();
  decorate();
})();
