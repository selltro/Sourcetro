(() => {
  const PERSONAL_API = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const EBAY_API = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  let runId = 0;
  let discovery = fresh();
  const controllers = new Set();

  function fresh() {
    return {
      busy: false,
      identification: null,
      searchQuery: "",
      summary: "",
      status: { identify: "idle", ebay: "idle", web: "idle" },
      ebay: { matches: [], error: "" },
      web: { matches: [], error: "", summary: "" },
      error: "",
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

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number)
      : "—";
  }

  function safeUrl(value = "") {
    try {
      const url = new URL(String(value));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function median(values) {
    const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function abortAll() {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
  }

  async function requestJson(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || `Request failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      return body;
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("SourceTro stopped waiting because this step took too long.");
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }

  function personalFetch(path, body, timeout) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${PERSONAL_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SourceTro-Key": key },
      body: JSON.stringify(body),
    }, timeout);
  }

  function ebayFetch(path, timeout = 7000) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is not remembered on this device yet."));
    return requestJson(`${EBAY_API}${path}`, {
      method: "GET",
      headers: { "X-SourceTro-Key": key },
    }, timeout);
  }

  function ensureStyles() {
    if (document.querySelector("#sourceTroFastScanStyles")) return;
    document.querySelector("#sourceTroDiscoveryStyles")?.remove();
    document.querySelector("#sourceTroDiscoveryStylesV48")?.remove();
    const style = document.createElement("style");
    style.id = "sourceTroFastScanStyles";
    style.textContent = `
      .st-discovery-mode>.page-header,.st-discovery-mode>.source-scan-layout,.st-discovery-mode>.source-tools-panel,.st-discovery-mode>.scan-history{display:none!important}
      .st-fast-shell{max-width:980px;margin:0 auto 28px;display:grid;gap:16px}
      .st-fast-card{background:#fff;border:1px solid #e1e8e6;border-radius:24px;padding:20px;box-shadow:0 8px 24px rgba(23,48,68,.06)}
      .st-fast-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.st-fast-head h1{margin:4px 0 5px;color:#173044;font-size:clamp(28px,4vw,40px)}.st-fast-head p{margin:0;color:#687982;max-width:650px}.st-fast-eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#4b7c69}.st-fast-actions{display:flex;gap:8px;flex-wrap:wrap}
      .st-fast-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(260px,.92fr);gap:16px;margin-top:18px}.st-fast-camera{min-height:280px;border:1px solid #dfe8e5;border-radius:20px;background:#f7faf9;overflow:hidden;display:grid;place-items:center}.st-fast-camera img{display:block;width:100%;height:100%;min-height:280px;max-height:460px;object-fit:contain;background:#f4f7f6}.st-fast-empty{text-align:center;padding:26px}.st-fast-empty .tro-orb{width:106px;height:106px;margin:0 auto 16px;display:inline-flex!important;box-shadow:0 0 0 8px rgba(85,188,231,.12),0 0 26px rgba(85,188,231,.35)!important}.st-fast-empty h2{margin:0 0 6px;color:#173044}.st-fast-empty p{margin:0 0 16px;color:#6d7c84}.st-fast-buttons{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
      .st-fast-progress{border-radius:20px;background:#f4f8f7;padding:16px}.st-fast-progress h3{margin:0;color:#173044}.st-fast-progress>p{margin:4px 0 0;color:#6b7a82;font-size:13px}.st-fast-statuses{display:grid;gap:9px;margin-top:14px}.st-fast-row{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:9px;background:#fff;border:1px solid #e2e9e7;border-radius:13px;padding:10px}.st-fast-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#dfe6e4;font-size:11px;font-weight:900}.st-fast-row.working .st-fast-dot{background:#d8efe6;animation:stFastPulse 1s infinite}.st-fast-row.done .st-fast-dot{background:#d8efe6;color:#176344}.st-fast-row.error .st-fast-dot{background:#ffe3da;color:#91472f}.st-fast-row.cancelled .st-fast-dot{background:#eceff0;color:#66747c}.st-fast-row strong{display:block;color:#173044}.st-fast-row small{display:block;color:#6d7b83}.st-fast-row b{font-size:11px;color:#4d616c}@keyframes stFastPulse{0%,100%{transform:scale(.9);opacity:.65}50%{transform:scale(1.08);opacity:1}}
      .st-fast-error{margin-top:11px;padding:11px 12px;border-radius:12px;background:#fff0ea;color:#8b4531;font-size:13px}.st-fast-note{margin-top:10px;color:#6b7a82;font-size:12px}
      .st-found{display:grid;grid-template-columns:1fr auto;gap:10px}.st-found h2{margin:4px 0;color:#173044}.st-found p{margin:0;color:#667780}.st-chip{padding:6px 10px;border-radius:999px;background:#eef6f2;color:#25634d;font-size:12px;font-weight:800;align-self:start}.st-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.st-tags span{padding:6px 9px;border-radius:999px;background:#f2f5f4;color:#56676f;font-size:12px}
      .st-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:13px}.st-price{padding:14px;border-radius:15px;background:#f3f8f6}.st-price small{display:block;color:#677982}.st-price strong{display:block;color:#173044;font-size:23px}.st-match-list{display:grid;gap:8px;margin-top:12px}.st-match{display:grid;grid-template-columns:1fr auto;gap:10px;padding:11px;border:1px solid #e2e8e6;border-radius:13px}.st-match a{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#17445c;text-decoration:none;font-weight:750}.st-match small{color:#6d7a82}.st-match-price{text-align:right}.st-match-price strong{display:block;color:#173044}.st-match-price span{font-size:11px;color:#4c7565;text-transform:capitalize;font-weight:800}.st-muted{padding:15px;border:1px dashed #ccd8d4;border-radius:13px;color:#697982;text-align:center;margin-top:12px}.st-result-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:820px){.st-fast-grid{grid-template-columns:1fr}.st-fast-camera{min-height:240px}.st-fast-camera img{min-height:240px}.st-price-grid{grid-template-columns:1fr}.st-match{grid-template-columns:1fr}.st-match-price{text-align:left}.st-fast-card{padding:16px}}
    `;
    document.head.appendChild(style);
  }

  function statusRow(key, label, detail) {
    const status = discovery.status[key] || "idle";
    const icon = status === "done" ? "✓" : status === "working" ? "●" : status === "error" ? "!" : status === "cancelled" ? "×" : "·";
    const text = status === "done" ? "Done" : status === "working" ? "Working" : status === "error" ? "Unavailable" : status === "cancelled" ? "Stopped" : "Waiting";
    return `<div class="st-fast-row ${status}"><span class="st-fast-dot">${icon}</span><div><strong>${label}</strong><small>${detail}</small></div><b>${text}</b></div>`;
  }

  function matches() {
    const seen = new Set();
    return [...discovery.ebay.matches, ...discovery.web.matches]
      .filter((item) => Number(item.price) > 0)
      .filter((item) => {
        const key = `${safeUrl(item.url)}|${String(item.title || "").toLowerCase().slice(0,70)}|${Number(item.price).toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }

  function resultMarkup() {
    const id = discovery.identification;
    if (!id) return "";
    const title = [id.brand, id.item_type].filter(Boolean).join(" ") || "Item identified";
    const tags = [id.category, id.color, id.size, id.style, id.condition].filter(Boolean);
    const all = matches();
    const prices = all.map((item) => Number(item.price)).filter((value) => value > 0);
    const low = prices.length ? Math.min(...prices) : 0;
    const typical = prices.length ? median(prices) : 0;
    const high = prices.length ? Math.max(...prices) : 0;
    return `
      <section class="st-fast-card"><div class="st-found"><div><span class="st-fast-eyebrow">Tro found</span><h2>${esc(title)}</h2><p>${esc(discovery.summary || `Search phrase: ${discovery.searchQuery}`)}</p></div><span class="st-chip">${esc(id.confidence || "photo match")}</span></div>${tags.length ? `<div class="st-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}</section>
      <section class="st-fast-card"><div class="st-fast-head"><div><h2 style="margin:0;color:#173044">Current prices found</h2><p>eBay appears first. Public-web results can arrive afterward.</p></div></div>${prices.length ? `<div class="st-price-grid"><div class="st-price"><small>Lowest found</small><strong>${money(low)}</strong></div><div class="st-price"><small>Typical found</small><strong>${money(typical)}</strong></div><div class="st-price"><small>Highest found</small><strong>${money(high)}</strong></div></div>` : `<div class="st-muted">${discovery.status.ebay === "working" || discovery.status.web === "working" ? "Price matches are still arriving…" : "No reliable priced matches were returned."}</div>`}<p class="st-fast-note">These are current asking/retail prices, not guaranteed sold prices.</p></section>
      <section class="st-fast-card"><div class="st-fast-head"><div><h2 style="margin:0;color:#173044">Matches</h2><p>SourceTro labels results instead of pretending every similar item is exact.</p></div></div>${all.length ? `<div class="st-match-list">${all.map((item) => { const url = safeUrl(item.url); const type = item.matchType || item.match_type || "similar"; return `<div class="st-match"><div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.title || "Matching listing")}</a>` : `<strong>${esc(item.title || "Matching listing")}</strong>`}<small>${esc(item.source || item.marketplace || "Web")} · ${esc(item.condition || item.priceType || item.price_type || "current listing")}</small></div><div class="st-match-price"><strong>${money(item.price)}</strong><span>${esc(type)} match</span></div></div>`; }).join("")}</div>` : `<div class="st-muted">No priced matches yet.</div>`}${discovery.web.error ? `<div class="st-fast-error">Web: ${esc(discovery.web.error)}</div>` : ""}${discovery.ebay.error ? `<div class="st-fast-error">eBay: ${esc(discovery.ebay.error)}</div>` : ""}<div class="st-result-actions"><button class="button large" type="button" data-fast-action="listing">Create listing →</button><button class="button secondary" type="button" data-fast-action="again">Scan another</button></div></section>`;
  }

  function renderPanel() {
    if (typeof state === "undefined" || state.route !== "source-scan" || typeof page === "undefined" || !page) return;
    ensureStyles();
    page.classList.add("st-discovery-mode");
    let shell = document.querySelector("#sourceTroDiscovery");
    if (!shell) {
      shell = document.createElement("div");
      shell.id = "sourceTroDiscovery";
      shell.className = "st-fast-shell";
      page.insertAdjacentElement("afterbegin", shell);
    }
    const hasPhoto = Boolean(state.sourcePhoto?.url);
    shell.innerHTML = `<section class="st-fast-card"><div class="st-fast-head"><div><span class="st-fast-eyebrow">Smart Source Scan · Fast mode</span><h1>Should I buy this?</h1><p>Take one photo. Tro identifies the item first, then immediately checks eBay and searches the public web when available.</p></div><div class="st-fast-actions"><button class="button ghost" type="button" data-fast-action="cancel">Cancel</button></div></div><div class="st-fast-grid"><div class="st-fast-camera">${hasPhoto ? `<img src="${esc(state.sourcePhoto.url)}" alt="Item being scanned">` : `<div class="st-fast-empty"><span class="tro-orb" data-mood="ready"><i></i></span><h2>Scan an item</h2><p>One clear photo is enough to start.</p><div class="st-fast-buttons"><button class="button large" type="button" data-fast-action="camera">Take picture</button><button class="button ghost" type="button" data-fast-action="cancel">Cancel</button></div></div>`}</div><aside class="st-fast-progress"><h3>${discovery.busy ? "Tro is working…" : hasPhoto ? "Results" : "What Tro checks"}</h3><p>${discovery.busy ? "Identification comes first. eBay and web pricing start as soon as Tro has the search words." : "The public web never blocks your eBay result."}</p><div class="st-fast-statuses">${statusRow("identify", "Identify the item", "Fast photo identification and search phrase")}${statusRow("ebay", "Check eBay", "Current active eBay asking prices")}${statusRow("web", "Search the web", "Accessible resale, retail, vintage and specialty sites")}</div>${discovery.error ? `<div class="st-fast-error">${esc(discovery.error)}</div>` : ""}${discovery.busy ? `<div class="st-result-actions"><button class="button ghost" type="button" data-fast-action="stop">Cancel search</button></div>` : ""}<p class="st-fast-note">If the public web is slow, SourceTro stops waiting for it and keeps the item/eBay results.</p></aside></div></section>${resultMarkup()}`;
  }

  async function prepareFastImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("SourceTro could not read that photo.");
    const blob = await response.blob();
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
      const max = 520;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!context) throw new Error("SourceTro could not prepare that photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", .5);
      canvas.width = 1;
      canvas.height = 1;
      return data;
    } finally {
      bitmap.close?.();
    }
  }

  function applyIdentification(payload) {
    const id = payload.identification || {};
    discovery.identification = id;
    discovery.searchQuery = String(payload.searchQuery || payload.search_query || [id.brand, id.item_type, id.style, id.color].filter(Boolean).join(" ")).trim();
    discovery.summary = String(payload.summary || "");
    if (id.brand) state.sourceScan.brand = id.brand;
    if (id.item_type) state.sourceScan.itemName = id.item_type;
    if (id.category && typeof normalizeCategory === "function") state.sourceScan.category = normalizeCategory(id.category, state.sourceScan.category);
    if (id.condition && typeof normalizeCondition === "function") state.sourceScan.condition = normalizeCondition(id.condition, state.sourceScan.condition);
    state.sourceScan.marketplace = "All marketplaces";
    const synthetic = {
      identification: { ...id, visible_flaws: Array.isArray(id.visible_flaws) ? id.visible_flaws : [] },
      research: { ebay_sold_search: discovery.searchQuery, search_keywords: [], details_to_verify: [] },
      evaluation: { demand: "", sourcing_decision: "", explanation: discovery.summary || "Tro identified the item and built comparison search words." },
      listing: null,
      warnings: [],
    };
    if (typeof buildSourceResult === "function") buildSourceResult(synthetic);
    try {
      state.aiStatus = "connected";
      sessionStorage.setItem("sourcetro_ai_verified", "true");
    } catch {}
  }

  async function identify(run, image) {
    discovery.status.identify = "working";
    renderPanel();
    const notes = [state.sourceScan.brand, state.sourceScan.itemName, state.sourceScan.barcode].filter(Boolean).join(" · ");
    try {
      const result = await personalFetch("/identify-fast", { image, notes }, 16000);
      if (run !== runId) return false;
      applyIdentification(result);
      discovery.status.identify = "done";
      renderPanel();
      return true;
    } catch (error) {
      if (run !== runId) return false;
      discovery.status.identify = error.code === "TIMEOUT" ? "cancelled" : "error";
      if (error.status === 404) {
        discovery.error = "Fast Scan is ready in SourceTro, but the new Fast Scan Worker still needs to be deployed once in Cloudflare.";
      } else if (error.code === "TIMEOUT") {
        discovery.error = "The fast identification service did not answer in time. SourceTro stopped it instead of locking up your phone.";
      } else {
        discovery.error = error.message || "Tro could not identify the item.";
      }
      renderPanel();
      return false;
    }
  }

  async function searchEbay(run) {
    const query = discovery.searchQuery;
    if (!query || run !== runId) return;
    discovery.status.ebay = "working";
    renderPanel();
    try {
      const result = await ebayFetch(`/ebay/research?q=${encodeURIComponent(query)}`, 7000);
      if (run !== runId) return;
      discovery.ebay.matches = result.available && Array.isArray(result.samples)
        ? result.samples.map((item) => ({ source: "eBay", marketplace: "eBay", title: item.title || query, url: item.url || "", price: Number(item.price || 0), currency: item.currency || "USD", condition: item.condition || "Active listing", matchType: "likely", priceType: "active asking" })).filter((item) => item.price > 0)
        : [];
      discovery.ebay.error = result.available ? "" : (result.error || "eBay research is unavailable right now.");
      discovery.status.ebay = "done";
    } catch (error) {
      if (run !== runId) return;
      discovery.ebay.error = error.message || "eBay search could not finish.";
      discovery.status.ebay = error.code === "TIMEOUT" ? "cancelled" : "error";
    }
    if (state.sourceResult) state.sourceResult.discoveryMatches = matches();
    renderPanel();
  }

  async function searchWeb(run) {
    const query = discovery.searchQuery;
    if (!query || run !== runId) return;
    discovery.status.web = "working";
    renderPanel();
    try {
      const result = await personalFetch("/discover-web", { query, identification: discovery.identification || {}, sellerCountry: "US" }, 10000);
      if (run !== runId) return;
      discovery.web.matches = Array.isArray(result.matches)
        ? result.matches.map((item) => ({ ...item, source: item.source || "Web", title: item.title || "Matching listing", url: item.url || "", price: Number(item.price || 0), currency: item.currency || "USD", matchType: item.match_type || "similar", priceType: item.price_type || "current price" })).filter((item) => item.price > 0 && item.currency === "USD")
        : [];
      discovery.web.summary = result.summary || "";
      discovery.web.error = "";
      discovery.status.web = "done";
    } catch (error) {
      if (run !== runId) return;
      discovery.web.error = error.code === "TIMEOUT" ? "The public web was slow, so SourceTro stopped waiting for it." : (error.message || "Public-web search is unavailable right now.");
      discovery.status.web = error.code === "TIMEOUT" ? "cancelled" : "error";
    }
    if (state.sourceResult) state.sourceResult.discoveryMatches = matches();
    renderPanel();
  }

  async function start() {
    if (typeof state === "undefined" || state.route !== "source-scan" || !state.sourcePhoto?.url) return;
    const current = ++runId;
    abortAll();
    discovery = fresh();
    discovery.busy = true;
    if (typeof setTroState === "function") setTroState("working", "Identifying item…");
    renderPanel();
    try {
      const image = await prepareFastImage(state.sourcePhoto.url);
      if (current !== runId) return;
      const ok = await identify(current, image);
      if (!ok || current !== runId) {
        discovery.busy = false;
        renderPanel();
        return;
      }
      const ebayPromise = searchEbay(current);
      const webPromise = searchWeb(current);
      await Promise.race([ebayPromise, new Promise((resolve) => setTimeout(resolve, 4500))]);
      if (current !== runId) return;
      discovery.busy = false;
      if (typeof setTroState === "function") setTroState("success", "Fast scan results ready.", 1400);
      renderPanel();
      Promise.allSettled([ebayPromise, webPromise]).then(() => {
        if (current === runId) renderPanel();
      });
    } catch (error) {
      if (current !== runId) return;
      discovery.error = error.message || "SourceTro could not finish this scan.";
      discovery.status.identify = "error";
      discovery.busy = false;
      renderPanel();
    }
  }

  function openCamera() {
    const input = document.querySelector("#sourcePhotoInput");
    if (!input) return;
    try { input.value = ""; } catch {}
    input.click();
  }

  function stopSearch() {
    ++runId;
    abortAll();
    discovery.busy = false;
    Object.keys(discovery.status).forEach((key) => { if (discovery.status[key] === "working") discovery.status[key] = "cancelled"; });
    renderPanel();
  }

  function cancelScan() {
    stopSearch();
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof setRoute === "function") setRoute("dashboard");
    else location.hash = "dashboard";
  }

  function scanAgain() {
    ++runId;
    abortAll();
    discovery = fresh();
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof render === "function") render();
    setTimeout(renderPanel, 30);
  }

  function createListing() {
    if (!state.sourceResult) {
      if (typeof showToast === "function") showToast("Let Tro identify the item first.");
      return;
    }
    if (state.sourceResult) state.sourceResult.discoveryMatches = matches();
    if (typeof scanToListing === "function") scanToListing();
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest?.('[data-route="source-scan"]');
    if (routeButton) {
      document.querySelector("#sidebar")?.classList.remove("open");
      setTimeout(renderPanel, 40);
    }
    const button = event.target.closest?.("[data-fast-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.fastAction;
    if (action === "camera") openCamera();
    if (action === "cancel") cancelScan();
    if (action === "stop") stopSearch();
    if (action === "again") scanAgain();
    if (action === "listing") createListing();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id !== "sourcePhotoInput") return;
    setTimeout(() => {
      if (state?.sourcePhoto?.url) start();
    }, 150);
  });

  document.addEventListener("cancel", (event) => {
    if (event.target?.id === "sourcePhotoInput") cancelScan();
  }, true);

  window.addEventListener("hashchange", () => {
    if (typeof state !== "undefined" && state.route === "source-scan") setTimeout(renderPanel, 40);
    else page?.classList.remove("st-discovery-mode");
  });
  window.addEventListener("pageshow", () => {
    if (typeof state !== "undefined" && state.route === "source-scan") setTimeout(renderPanel, 40);
  });

  window.SourceTroDiscovery = { start, cancel: cancelScan, scanAnother: scanAgain, results: () => ({ ...discovery, matches: matches() }) };
  ensureStyles();
  if (typeof state !== "undefined" && state.route === "source-scan") setTimeout(renderPanel, 40);
})();
