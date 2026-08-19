(() => {
  const GATEWAY = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const MARKETPLACE = "eBay";

  let researchBusy = false;
  let researchResult = null;
  let preflightBusy = false;
  let preflightResult = null;
  let preflightKey = "";
  let publishBusy = false;
  let decorateTimer = null;

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

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function newListing() {
    return typeof state !== "undefined"
      && state.route === "new-listing"
      && state.listing
      && !state.listing.ebayItemId;
  }

  function eBaySelected() {
    return Array.isArray(state?.listing?.marketplaces) && state.listing.marketplaces.includes(MARKETPLACE);
  }

  function captureVisibleListing() {
    if (!newListing()) return;
    document.querySelectorAll("#page [data-bind]").forEach((field) => {
      const key = field.dataset.bind;
      if (!key) return;
      state.listing[key] = field.type === "checkbox" ? field.checked : field.value;
    });
    const markets = [...document.querySelectorAll("#page [data-marketplace]")]
      .filter((field) => field.checked)
      .map((field) => field.dataset.marketplace)
      .filter(Boolean);
    if (document.querySelectorAll("#page [data-marketplace]").length) state.listing.marketplaces = markets;
  }

  function listingQuery() {
    captureVisibleListing();
    return String(
      state.listing.researchQuery
      || state.listing.title
      || [state.listing.brand, state.listing.itemType, state.listing.styleModel, state.listing.size]
        .filter(Boolean)
        .join(" ")
    ).trim();
  }

  function gateway(path, options = {}) {
    const key = ownerKey();
    if (!key) return Promise.reject(new Error("SourceTro secure access is locked on this device."));
    return fetch(`${GATEWAY}${path}`, {
      ...options,
      headers: {
        "X-SourceTro-Key": key,
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || `eBay request failed (${response.status}).`);
        error.details = result;
        throw error;
      }
      return result;
    });
  }

  function ensureStyles() {
    if (document.querySelector("#sourceTroSellerStyles")) return;
    const style = document.createElement("style");
    style.id = "sourceTroSellerStyles";
    style.textContent = `
      .st-seller-card{margin:18px 0;padding:18px;border:1px solid rgba(22,40,58,.14);border-radius:18px;background:#fff;box-shadow:0 8px 22px rgba(22,40,58,.05)}
      .st-seller-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .st-seller-head h3{margin:0 0 4px}.st-seller-head p{margin:0;color:#647381;font-size:13px}
      .st-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
      .st-price-stat{padding:12px;border-radius:14px;background:#f4f8f7;text-align:center}.st-price-stat strong{display:block;font-size:20px;color:#16283a}.st-price-stat small{color:#657582}
      .st-note{font-size:12px;color:#6d7882;margin:10px 0 0}.st-warning{color:#9b5b18}.st-good{color:#207451}
      .st-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.st-mini{min-height:38px;padding:8px 12px;border-radius:12px}
      .st-readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
      .st-readiness-grid .field{min-width:0}.st-aspects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      .st-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:#eef6f3;font-size:12px;font-weight:700;color:#245f4b}
      .st-badge.bad{background:#fff1ec;color:#a54b36}.st-samples{margin-top:12px;display:grid;gap:7px}.st-sample{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#546370}.st-sample a{color:#1e5d79;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tro-apply-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.tro-apply-row button{border:0;border-radius:10px;padding:7px 10px;background:#eef6f3;color:#1e5d49;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
      @media(max-width:760px){.st-price-grid,.st-readiness-grid,.st-aspects{grid-template-columns:1fr}.st-seller-card{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function researchCard() {
    const existing = document.querySelector("#sourceTroPriceResearch");
    if (existing) return existing;
    const anchor = document.querySelector("#page .price-row");
    if (!anchor || !newListing() || state.wizardStep !== 4) return null;
    const card = document.createElement("section");
    card.id = "sourceTroPriceResearch";
    card.className = "st-seller-card";
    anchor.insertAdjacentElement("afterend", card);
    return card;
  }

  function renderResearchCard() {
    const card = researchCard();
    if (!card) return;
    if (researchBusy) {
      card.innerHTML = `<div class="st-seller-head"><div><h3>Live eBay price check</h3><p>Checking current comparable asking prices…</p></div><span class="st-badge">Working</span></div>`;
      return;
    }

    if (!researchResult) {
      card.innerHTML = `
        <div class="st-seller-head">
          <div><h3>Live eBay price check</h3><p>Use current eBay listings as a real-world pricing reference.</p></div>
          <button type="button" class="button secondary st-mini" data-st-action="research">Check prices</button>
        </div>
        <p class="st-note">This checks active eBay asking prices. It does not claim they are sold comps.</p>`;
      return;
    }

    if (!researchResult.available) {
      card.innerHTML = `
        <div class="st-seller-head"><div><h3>Live eBay price check</h3><p>${esc(researchResult.error || "Live research is unavailable right now.")}</p></div><button type="button" class="button secondary st-mini" data-st-action="research">Try again</button></div>
        <p class="st-note">Your listing can still be prepared without live pricing data.</p>`;
      return;
    }

    const stats = researchResult.stats || {};
    const samples = Array.isArray(researchResult.samples) ? researchResult.samples.slice(0, 4) : [];
    card.innerHTML = `
      <div class="st-seller-head">
        <div><h3>Live eBay price check</h3><p>${esc(researchResult.query || listingQuery())}</p></div>
        <span class="st-badge">${Number(researchResult.count || 0)} current listings</span>
      </div>
      <div class="st-price-grid">
        <div class="st-price-stat"><small>Lower range</small><strong>${money(stats.low)}</strong></div>
        <div class="st-price-stat"><small>Median asking</small><strong>${money(stats.median)}</strong></div>
        <div class="st-price-stat"><small>Upper range</small><strong>${money(stats.high)}</strong></div>
      </div>
      <div class="st-actions">
        <button type="button" class="button secondary st-mini" data-st-action="use-price" data-price="${Number(stats.median || 0)}">Use median</button>
        <button type="button" class="button secondary st-mini" data-st-action="use-price" data-price="${Number(stats.high || 0)}">Use upper range</button>
        <button type="button" class="button ghost st-mini" data-st-action="research">Refresh</button>
      </div>
      ${samples.length ? `<div class="st-samples">${samples.map((item) => `<div class="st-sample"><a href="${esc(item.url || "#")}" target="_blank" rel="noopener">${esc(item.title || "eBay listing")}</a><strong>${money(item.price)}</strong></div>`).join("")}</div>` : ""}
      <p class="st-note">Current eBay asking prices, not completed-sale prices. Tro uses these as a pricing reference—not a guarantee of what the item will sell for.</p>`;
  }

  async function researchCurrentListing() {
    if (!newListing() || researchBusy) return null;
    const query = listingQuery();
    if (!query) {
      showToast("Add a title or item details first so SourceTro knows what to compare.");
      return null;
    }
    researchBusy = true;
    researchResult = null;
    renderResearchCard();
    try {
      const result = await gateway(`/ebay/research?q=${encodeURIComponent(query)}`, { method: "GET" });
      researchResult = result;
      if (result.available && result.stats) {
        state.listing.researchQuery = query;
        state.listing.comparisonLow = String(result.stats.low ?? "");
        state.listing.comparisonHigh = String(result.stats.high ?? "");
        state.listing.ebayResearchMedian = String(result.stats.median ?? "");
        state.listing.ebayResearchAt = new Date().toISOString();
      }
      return result;
    } catch (error) {
      researchResult = { available: false, error: error.message || "Live eBay research is unavailable." };
      return researchResult;
    } finally {
      researchBusy = false;
      renderResearchCard();
    }
  }

  function preflightSignature() {
    if (!newListing()) return "";
    captureVisibleListing();
    return JSON.stringify([
      state.listing.title,
      state.listing.category,
      state.listing.itemType,
      state.listing.brand,
      state.listing.size,
      state.listing.color,
      state.listing.condition,
      state.listing.ebayCategoryId || "",
    ]);
  }

  function readinessCard() {
    let card = document.querySelector("#sourceTroEbayReadiness");
    if (card) return card;
    if (!newListing() || state.wizardStep !== 5 || !eBaySelected()) return null;
    const footer = document.querySelector("#page .wizard-footer");
    if (!footer) return null;
    card = document.createElement("section");
    card.id = "sourceTroEbayReadiness";
    card.className = "st-seller-card";
    footer.parentNode.insertBefore(card, footer);
    return card;
  }

  function aspectControl(aspect) {
    const name = String(aspect.name || "");
    const value = String(aspect.value || state.listing.ebayAspects?.[name] || "");
    const values = Array.isArray(aspect.values) ? aspect.values.slice(0, 80) : [];
    const required = Boolean(aspect.required);
    const label = `${esc(name)}${required ? " *" : ""}`;
    if (values.length) {
      const options = [`<option value="">Select</option>`, ...values.map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(option)}</option>`)].join("");
      return `<div class="field"><label>${label}</label><select data-ebay-aspect="${esc(name)}">${options}</select></div>`;
    }
    return `<div class="field"><label>${label}</label><input data-ebay-aspect="${esc(name)}" value="${esc(value)}" placeholder="${required ? "Required by eBay" : "Recommended"}" /></div>`;
  }

  function renderReadinessCard() {
    const card = readinessCard();
    if (!card) return;
    const ebayConnected = Boolean(window.SourceTroEbayConnection?.isConnected?.());
    if (!ebayConnected) {
      card.innerHTML = `<div class="st-seller-head"><div><h3>Connect eBay for publishing</h3><p>eBay price comparisons are working. Publishing needs a separate one-time permission from your eBay seller account.</p></div><span class="st-badge bad">Not connected</span></div><div class="st-actions"><button type="button" class="button st-mini" data-st-action="connect-ebay">Connect eBay</button></div><p class="st-note">You can save this listing as a draft now. After eBay is connected, SourceTro will keep the authorization renewed automatically.</p>`;
      return;
    }
    if (preflightBusy) {
      card.innerHTML = `<div class="st-seller-head"><div><h3>eBay readiness check</h3><p>Checking category, item specifics, business policies and ship-from location…</p></div><span class="st-badge">Checking</span></div>`;
      return;
    }
    if (!preflightResult) {
      card.innerHTML = `<div class="st-seller-head"><div><h3>eBay readiness check</h3><p>SourceTro will verify everything eBay needs before anything can go live.</p></div><button type="button" class="button secondary st-mini" data-st-action="preflight">Check eBay</button></div>`;
      return;
    }
    if (!preflightResult.ok) {
      card.innerHTML = `<div class="st-seller-head"><div><h3>eBay readiness check</h3><p>${esc(preflightResult.error || "SourceTro could not complete the eBay check.")}</p></div><button type="button" class="button secondary st-mini" data-st-action="preflight">Try again</button></div>`;
      return;
    }

    const categories = Array.isArray(preflightResult.categorySuggestions) ? preflightResult.categorySuggestions : [];
    const selectedCategoryId = String(state.listing.ebayCategoryId || preflightResult.category?.id || "");
    const selectedCondition = String(state.listing.ebayCondition || preflightResult.condition?.enum || "");
    const conditions = Array.isArray(preflightResult.conditionOptions) ? preflightResult.conditionOptions : [];
    const required = (preflightResult.aspects || []).filter((item) => item.required);
    const recommended = (preflightResult.aspects || []).filter((item) => !item.required && (item.value || ["Brand", "Type", "Size", "Color", "Material", "Style", "Department", "Size Type"].includes(item.name))).slice(0, 6);
    const missing = required.filter((item) => !String(state.listing.ebayAspects?.[item.name] || item.value || "").trim());
    const ready = Boolean(preflightResult.policiesReady && preflightResult.locationReady && selectedCategoryId && selectedCondition && !missing.length);

    card.innerHTML = `
      <div class="st-seller-head">
        <div><h3>eBay readiness check</h3><p>Review eBay-specific details before publishing.</p></div>
        <span class="st-badge ${ready ? "" : "bad"}">${ready ? "Ready to publish" : `${missing.length} required field${missing.length === 1 ? "" : "s"} left`}</span>
      </div>
      <div class="st-readiness-grid">
        <div class="field"><label>eBay category</label><select data-ebay-category>${categories.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === selectedCategoryId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div>
        <div class="field"><label>eBay condition</label><select data-ebay-condition><option value="">Select</option>${conditions.map((item) => `<option value="${esc(item.enum)}" ${item.enum === selectedCondition ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div>
      </div>
      ${required.length ? `<h4 style="margin:16px 0 6px">Required eBay item specifics</h4><div class="st-aspects">${required.map(aspectControl).join("")}</div>` : `<p class="st-note st-good">No additional required item specifics were returned for this category.</p>`}
      ${recommended.length ? `<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Recommended eBay details</summary><div class="st-aspects">${recommended.map(aspectControl).join("")}</div></details>` : ""}
      <div class="st-actions">
        <span class="st-badge ${preflightResult.policiesReady ? "" : "bad"}">${preflightResult.policiesReady ? "Policies ready" : "Policies need attention"}</span>
        <span class="st-badge ${preflightResult.locationReady ? "" : "bad"}">${preflightResult.locationReady ? "Ship-from ready" : "Ship-from needed"}</span>
        <button type="button" class="button ghost st-mini" data-st-action="preflight">Recheck</button>
      </div>
      <p class="st-note">SourceTro will never publish automatically. The final Publish to eBay button always asks you to confirm first.</p>`;
  }

  async function refreshPreflight(force = false) {
    if (!newListing() || !eBaySelected() || preflightBusy) return preflightResult;
    if (!window.SourceTroEbayConnection?.isConnected?.()) {
      preflightResult = { ok: false, needsConnection: true, error: "Connect eBay for publishing first." };
      renderReadinessCard();
      decoratePublishButton();
      return preflightResult;
    }
    captureVisibleListing();
    const signature = preflightSignature();
    if (!force && preflightResult && preflightKey === signature) return preflightResult;
    preflightBusy = true;
    preflightResult = null;
    renderReadinessCard();
    try {
      const result = await gateway("/ebay/listings/preflight", {
        method: "POST",
        body: JSON.stringify({ listing: state.listing }),
      });
      preflightResult = result;
      preflightKey = signature;
      if (result.category?.id) {
        state.listing.ebayCategoryId = String(state.listing.ebayCategoryId || result.category.id);
        state.listing.ebayCategoryName = String(result.category.name || "");
      }
      state.listing.ebayAspects = { ...(state.listing.ebayAspects || {}) };
      for (const aspect of result.aspects || []) {
        if (aspect.value && !state.listing.ebayAspects[aspect.name]) state.listing.ebayAspects[aspect.name] = aspect.value;
      }
      if (result.condition?.enum && !state.listing.ebayCondition) state.listing.ebayCondition = result.condition.enum;
      return result;
    } catch (error) {
      preflightResult = { ok: false, error: error.message || "SourceTro could not complete the eBay readiness check." };
      return preflightResult;
    } finally {
      preflightBusy = false;
      renderReadinessCard();
      decoratePublishButton();
    }
  }

  function decoratePublishButton() {
    if (!newListing() || state.wizardStep !== 5) return;
    const button = document.querySelector('#page [data-action="publish-listing"]');
    if (!button) return;
    if (eBaySelected()) {
      const connected = Boolean(window.SourceTroEbayConnection?.isConnected?.());
      button.textContent = !connected ? "Connect eBay before publishing" : (publishBusy ? "Publishing to eBay…" : "Publish to eBay →");
      button.disabled = publishBusy || !connected;
      button.title = "Publishes only after SourceTro verifies the listing and you confirm.";
    } else {
      button.textContent = "Prepare listing →";
      button.disabled = false;
    }
  }

  async function uploadOnePhoto(photo, index) {
    const url = String(photo?.url || "");
    if (/^https:\/\//i.test(url)) return url;
    if (!url) throw new Error(`Photo ${index + 1} is missing.`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`SourceTro could not read photo ${index + 1}.`);
    const blob = await response.blob();
    const form = new FormData();
    form.append("image", blob, photo?.name || `sourcetro-${index + 1}.jpg`);
    const result = await gateway("/ebay/images/upload", { method: "POST", body: form });
    if (!result.imageUrl) throw new Error(`eBay did not return a URL for photo ${index + 1}.`);
    return result.imageUrl;
  }

  async function uploadPhotos() {
    const photos = Array.isArray(state.photos) ? state.photos.filter((photo) => photo?.url && !photo.measurement).slice(0, 12) : [];
    if (!photos.length) throw new Error("Add at least one listing photo before publishing to eBay.");
    const urls = [];
    for (let i = 0; i < photos.length; i += 1) {
      if (typeof setTroState === "function") setTroState("working", `Uploading photo ${i + 1} of ${photos.length}…`);
      urls.push(await uploadOnePhoto(photos[i], i));
    }
    return urls;
  }

  function unresolvedRequiredAspects() {
    if (!preflightResult?.ok) return [];
    return (preflightResult.aspects || [])
      .filter((item) => item.required)
      .filter((item) => !String(state.listing.ebayAspects?.[item.name] || item.value || "").trim())
      .map((item) => item.name);
  }

  async function publishCurrentListing() {
    if (publishBusy || !newListing()) return;
    captureVisibleListing();
    if (!eBaySelected()) return;
    if (!ownerKey()) {
      showToast("SourceTro secure access is locked on this device.");
      return;
    }
    if (!String(state.listing.title || "").trim()) { showToast("Add a title before publishing."); return; }
    if (!String(state.listing.description || "").trim()) { showToast("Add a description before publishing."); return; }
    if (!(Number(state.listing.listPrice) > 0)) { showToast("Add a list price greater than zero."); return; }
    const publishPhotos = Array.isArray(state.photos) ? state.photos.filter((photo) => photo?.url && !photo.measurement) : [];
    if (!publishPhotos.length) { showToast("Add at least one regular listing photo before publishing."); return; }

    const check = await refreshPreflight(true);
    if (!check?.ok) {
      showToast(check?.error || "Complete the eBay readiness check first.");
      return;
    }
    const missing = unresolvedRequiredAspects();
    if (missing.length) {
      showToast(`eBay still needs: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
      renderReadinessCard();
      document.querySelector("#sourceTroEbayReadiness")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!state.listing.ebayCondition) { showToast("Choose the eBay condition first."); return; }
    if (!check.policiesReady || !check.locationReady) { showToast("eBay policies or the ship-from location still need attention."); return; }

    const categoryName = state.listing.ebayCategoryName || check.category?.name || "selected eBay category";
    const confirmed = window.confirm(
      `Publish this item LIVE on eBay?\n\n${state.listing.title}\n${money(state.listing.listPrice)}\nCategory: ${categoryName}\nPhotos: ${publishPhotos.length}\n\nNothing will publish unless you choose OK.`
    );
    if (!confirmed) {
      showToast("eBay was not changed.");
      return;
    }

    publishBusy = true;
    decoratePublishButton();
    if (typeof setTroState === "function") setTroState("working", "Preparing eBay photos…");
    try {
      const imageUrls = await uploadPhotos();
      if (typeof setTroState === "function") setTroState("working", "Publishing your eBay listing…");
      const result = await gateway("/ebay/listings/publish", {
        method: "POST",
        body: JSON.stringify({
          listing: {
            ...state.listing,
            ebayCategoryId: state.listing.ebayCategoryId || check.category?.id,
            ebayCategoryName: state.listing.ebayCategoryName || check.category?.name,
            ebayCondition: state.listing.ebayCondition,
            ebayAspects: state.listing.ebayAspects || {},
          },
          imageUrls,
        }),
      });

      state.listing.ebayItemId = result.listingId;
      state.listing.ebayOfferId = result.offerId || "";
      state.listing.ebayUrl = result.viewItemUrl || (result.listingId ? `https://www.ebay.com/itm/${result.listingId}` : "");
      state.listing.ebayCategoryId = result.categoryId || state.listing.ebayCategoryId;
      state.listing.ebayPictureUrls = imageUrls;
      state.listing.ebayPublishedAt = new Date().toISOString();
      state.listing.sku = result.sku || state.listing.sku;
      state.photos = imageUrls.map((url, index) => ({ name: `eBay photo ${index + 1}`, url }));

      if (typeof storeListing === "function") storeListing("Listed");
      if (window.SourceTroCloud?.syncNow) {
        try { await window.SourceTroCloud.syncNow(); } catch {}
      }
      if (typeof resetListing === "function") resetListing();
      if (typeof setRoute === "function") setRoute("inventory");
      if (typeof setTroState === "function") setTroState("success", "Published to eBay.", 2200);
      showToast(`Published to eBay successfully${result.listingId ? ` — item ${result.listingId}` : ""}.`);
    } catch (error) {
      if (typeof setTroState === "function") setTroState("ready", "Ready when you are.");
      showToast(error?.message || "SourceTro could not publish the eBay listing.");
    } finally {
      publishBusy = false;
      scheduleDecorate();
    }
  }

  function decorateTroShortcuts() {
    if (!newListing() || ![3, 4].includes(Number(state.wizardStep))) return;
    if (document.querySelector("#sourceTroQuickImprove")) return;
    const firstCard = document.querySelector("#page .ai-card") || document.querySelector("#page .form-grid");
    if (!firstCard) return;
    const bar = document.createElement("div");
    bar.id = "sourceTroQuickImprove";
    bar.className = "st-seller-card";
    bar.innerHTML = `
      <div class="st-seller-head"><div><h3>Tro quick actions</h3><p>Have Tro improve the listing and apply the result for you.</p></div></div>
      <div class="st-actions">
        <button type="button" class="button secondary st-mini" data-st-action="tro-title">Improve title</button>
        <button type="button" class="button secondary st-mini" data-st-action="tro-description">Improve description</button>
        <button type="button" class="button secondary st-mini" data-st-action="research">Research price</button>
      </div>`;
    firstCard.parentNode.insertBefore(bar, firstCard);
  }

  async function applyTroField(field) {
    if (!window.SourceTroChat?.ask || !newListing()) {
      showToast("Tro chat is not ready yet.");
      return;
    }
    captureVisibleListing();
    const instructions = field === "title"
      ? "Improve the current listing title for eBay SEO. Return ONLY the final title, no label, no quotes, no explanation, maximum 80 characters."
      : "Improve the current listing description so it is accurate, buyer-friendly, easy to scan, and does not invent facts. Return ONLY the final description with no introduction or explanation.";
    if (typeof setTroState === "function") setTroState("thinking", `Improving ${field}…`);
    try {
      const answer = String(await window.SourceTroChat.ask(instructions) || "").trim();
      if (!answer) throw new Error("Tro did not return a usable answer.");
      state.listing[field] = field === "title" ? answer.slice(0, 80) : answer;
      render();
      showToast(`Tro applied the improved ${field}.`);
      if (typeof setTroState === "function") setTroState("success", "Applied.", 1600);
    } catch (error) {
      showToast(error?.message || `Tro could not improve the ${field}.`);
    }
  }

  function scheduleDecorate() {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(() => {
      ensureStyles();
      if (!newListing()) return;
      if (state.wizardStep === 4) {
        renderResearchCard();
        decorateTroShortcuts();
      }
      if (state.wizardStep === 3) decorateTroShortcuts();
      if (state.wizardStep === 5) {
        decoratePublishButton();
        renderReadinessCard();
        if (eBaySelected()) setTimeout(() => refreshPreflight(false), 50);
      }
    }, 90);
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-st-action]");
    if (control) {
      event.preventDefault();
      event.stopPropagation();
      const action = control.dataset.stAction;
      if (action === "research") researchCurrentListing();
      if (action === "preflight") refreshPreflight(true);
      if (action === "connect-ebay") {
        if (typeof storeListing === "function") storeListing("Draft");
        if (typeof setRoute === "function") setRoute("marketplaces");
        if (typeof showToast === "function") showToast("Draft saved. Connect eBay once for publishing.");
        setTimeout(() => document.querySelector('[data-connect-market="eBay"]')?.click(), 180);
      }
      if (action === "tro-title") applyTroField("title");
      if (action === "tro-description") applyTroField("description");
      if (action === "use-price") {
        const price = Number(control.dataset.price || 0);
        if (price > 0) {
          state.listing.listPrice = price.toFixed(2);
          render();
          showToast(`List price set to ${money(price)}.`);
        }
      }
      return;
    }

    const publish = event.target.closest?.('[data-action="publish-listing"]');
    if (publish && newListing() && eBaySelected()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      publishCurrentListing();
      return;
    }

    setTimeout(scheduleDecorate, 0);
  }, true);

  document.addEventListener("change", (event) => {
    if (!newListing()) return;
    if (event.target.matches?.("[data-ebay-aspect]")) {
      state.listing.ebayAspects = { ...(state.listing.ebayAspects || {}) };
      state.listing.ebayAspects[event.target.dataset.ebayAspect] = event.target.value;
      renderReadinessCard();
      return;
    }
    if (event.target.matches?.("[data-ebay-condition]")) {
      state.listing.ebayCondition = event.target.value;
      renderReadinessCard();
      return;
    }
    if (event.target.matches?.("[data-ebay-category]")) {
      const option = event.target.selectedOptions?.[0];
      state.listing.ebayCategoryId = event.target.value;
      state.listing.ebayCategoryName = option?.textContent || "";
      state.listing.ebayAspects = {};
      preflightResult = null;
      preflightKey = "";
      refreshPreflight(true);
      return;
    }
    setTimeout(scheduleDecorate, 0);
  });

  const observer = new MutationObserver(scheduleDecorate);
  if (typeof page !== "undefined" && page) observer.observe(page, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleDecorate);
  window.addEventListener("pageshow", scheduleDecorate);

  window.SourceTroSeller = {
    researchCurrentListing,
    refreshPreflight,
    publishCurrentListing,
  };

  ensureStyles();
  scheduleDecorate();
})();
