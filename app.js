const page = document.querySelector("#page");
const toast = document.querySelector("#toast");

const listingDefaults = {
  category: "Women's Clothing",
  itemType: "",
  brand: "",
  size: "",
  color: "",
  condition: "Pre-owned - Good",
  material: "",
  notes: "",
  chest: "",
  waist: "",
  hips: "",
  length: "",
  inseam: "",
  sleeve: "",
  title: "",
  description: "",
  listPrice: "",
  storageBin: "",
  sku: "",
  marketplaces: ["eBay"],
};

const state = {
  route: location.hash.replace("#", "") || "dashboard",
  wizardStep: 1,
  photos: [],
  listing: { ...listingDefaults },
  generated: false,
  inventory: loadJSON("sourcetro_inventory", []),
  marketplaceConnections: loadJSON("sourcetro_connections", {}),
};

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Your browser storage is full. The item is still available in this session.");
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3300);
}

function setRoute(route) {
  state.route = route;
  location.hash = route;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function routeTitle(title, subtitle, action = "") {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">From source to sold</p>
        <h1>${title}</h1>
        <p class="subtext">${subtitle}</p>
      </div>
      ${action}
    </div>`;
}

function render() {
  const routes = {
    dashboard: dashboardView,
    "new-listing": listingView,
    inventory: inventoryView,
    orders: ordersView,
    shipping: shippingView,
    analytics: analyticsView,
    finances: financesView,
    marketplaces: marketplacesView,
  };
  (routes[state.route] || dashboardView)();
  updateNavigation();
}

function updateNavigation() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.route && !button.classList.contains("brand"));
  });
}

function inventoryStats() {
  const active = state.inventory.filter((item) => ["Listed", "Ready", "Draft"].includes(item.status)).length;
  const sold = state.inventory.filter((item) => item.status === "Sold");
  const revenue = sold.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const drafts = state.inventory.filter((item) => item.status === "Draft").length;
  return { active, sold: sold.length, revenue, drafts };
}

function dashboardView() {
  const stats = inventoryStats();
  page.innerHTML = `
    <div class="hero-card">
      <div>
        <p class="eyebrow">Your trusted resale operator</p>
        <h1>Good ${greeting()}, Nydia.</h1>
        <p>Turn the clothing in your basement and garage into clear, complete listings—one simple step at a time.</p>
        <div class="hero-actions">
          <button class="button large" data-route="new-listing">＋ Create a listing</button>
          <button class="button secondary large" data-action="demo-listing">Try with a demo item</button>
        </div>
      </div>
      <div class="hero-lens">
        <div class="camera-lens"><i></i></div>
        <small>Tro is ready</small>
      </div>
    </div>

    <div class="stats-grid">
      ${statCard("Active listings", stats.active, "Across your marketplaces", "▦")}
      ${statCard("Drafts", stats.drafts, "Ready for your review", "✎")}
      ${statCard("Sold", stats.sold, "All-time in SourceTro", "✓")}
      ${statCard("Sales", money(stats.revenue), "Before fees and costs", "$")}
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header"><div><h2>What do you want to do?</h2><span class="muted">Start with the easiest next step.</span></div></div>
        <div class="quick-grid">
          ${quickAction("new-listing", "◎", "Photograph an item", "Upload photos and let Tro help")}
          ${quickAction("new-listing", "↔", "Measure clothing", "Save every measurement")}
          ${quickAction("inventory", "▦", "Find an item", "Search by SKU or storage bin")}
          <button class="quick-action" data-action="open-tro"><span class="quick-icon">◉</span><strong>Talk to Tro</strong><small>Speak when you do not want to type</small></button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header"><div><h2>Your selling flow</h2><span class="muted">Everything stays organized.</span></div></div>
        <div class="pipeline">
          ${pipelineRow("Needs listing", stats.drafts, "Photos or details still needed")}
          ${pipelineRow("Ready to publish", state.inventory.filter((i) => i.status === "Ready").length, "Reviewed by you")}
          ${pipelineRow("Live listings", state.inventory.filter((i) => i.status === "Listed").length, "Visible on marketplaces")}
          ${pipelineRow("Sold & shipping", state.inventory.filter((i) => i.status === "Sold").length, "Orders to complete")}
        </div>
      </section>
    </div>

    <div class="section-title"><p class="eyebrow">One smooth system</p><h2>Everything a reseller needs</h2></div>
    <div class="feature-strip">
      ${featureCard("✦", "AI listing help", "Titles, descriptions, pricing guidance, and item specifics.")}
      ${featureCard("⇄", "Cross-listing", "Prepare one item for eBay, Poshmark, Mercari, and Depop.")}
      ${featureCard("▦", "Inventory control", "Know the exact bin and SKU for every item.")}
      ${featureCard("⌁", "Profit clarity", "Track sales, fees, item cost, and estimated profit.")}
    </div>`;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function statCard(label, value, note, icon) {
  return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><span class="stat-value">${value}</span><span class="stat-note">${note}</span></div>`;
}

function quickAction(route, icon, title, note) {
  return `<button class="quick-action" data-route="${route}"><span class="quick-icon">${icon}</span><strong>${title}</strong><small>${note}</small></button>`;
}

function pipelineRow(title, count, note) {
  return `<div class="pipeline-row"><span class="status-dot"></span><div><strong>${title}</strong><small>${note}</small></div><span class="pipeline-count">${count}</span></div>`;
}

function featureCard(icon, title, copy) {
  return `<article class="feature-card"><span>${icon}</span><h3>${title}</h3><p>${copy}</p></article>`;
}

function listingView() {
  page.innerHTML = `
    ${routeTitle("Create a listing", "Tro will guide you from photos to a marketplace-ready listing.", '<button class="button secondary" data-action="reset-listing">Start over</button>')}
    <div class="wizard-layout">
      <aside class="wizard-steps">
        <h3>Listing progress</h3>
        ${["Photos", "Measurements", "Item details", "Tro creates", "Review & publish"].map((label, index) => {
          const step = index + 1;
          const status = step === state.wizardStep ? "active" : step < state.wizardStep ? "done" : "";
          return `<button class="step-button ${status}" data-step="${step}"><span>${step < state.wizardStep ? "✓" : step}</span><strong>${label}</strong></button>`;
        }).join("")}
      </aside>
      <section class="wizard-card">${wizardStepView()}</section>
    </div>`;
}

function wizardStepView() {
  if (state.wizardStep === 1) return photoStep();
  if (state.wizardStep === 2) return measurementStep();
  if (state.wizardStep === 3) return detailsStep();
  if (state.wizardStep === 4) return generateStep();
  return publishStep();
}

function wizardHeader(step, title, copy) {
  return `<header><p class="eyebrow">Step ${step} of 5</p><h2>${title}</h2><p>${copy}</p></header>`;
}

function wizardFooter(nextLabel = "Continue", disableNext = false) {
  return `<div class="wizard-footer">
    <button class="button ghost" data-action="wizard-back" ${state.wizardStep === 1 ? "disabled" : ""}>← Back</button>
    <button class="button large" data-action="wizard-next" ${disableNext ? "disabled" : ""}>${nextLabel} →</button>
  </div>`;
}

function photoStep() {
  return `
    ${wizardHeader(1, "Add your item photos", "Take or upload clear photos. You can add more than one angle.")}
    <div class="upload-zone" id="uploadZone">
      <input type="file" id="photoInput" accept="image/*" multiple capture="environment" aria-label="Upload item photos" />
      <div><span class="upload-icon">◎</span><h3>Take a photo or choose from your device</h3><p class="muted">Front, back, label, tag, details, and any flaws</p><span class="button secondary">Choose photos</span></div>
    </div>
    <div class="photo-preview-grid">${state.photos.map((photo, index) => `<div class="photo-preview"><img src="${photo.url}" alt="Item photo ${index + 1}" /><button data-remove-photo="${index}" aria-label="Remove photo">×</button></div>`).join("")}</div>
    <div class="option-row">
      <label class="check-pill"><input type="checkbox" checked /> Brighten and sharpen</label>
      <label class="check-pill"><input type="checkbox" checked /> Suggest best cover photo</label>
      <label class="check-pill"><input type="checkbox" /> Clean background</label>
    </div>
    ${wizardFooter("Add measurements")}`;
}

function measurementStep() {
  return `
    ${wizardHeader(2, "Measure the clothing", "Tro keeps the measurements buyers need so you do not have to remember them.")}
    <div class="measure-help"><span>↔</span><div><strong>Lay the garment flat.</strong><p>Measure straight across. SourceTro will place these measurements into your finished description.</p></div></div>
    <div class="form-grid">
      ${field("chest", "Chest / pit to pit", 'placeholder="inches" inputmode="decimal"')}
      ${field("waist", "Waist", 'placeholder="inches" inputmode="decimal"')}
      ${field("hips", "Hips", 'placeholder="inches" inputmode="decimal"')}
      ${field("length", "Total length", 'placeholder="inches" inputmode="decimal"')}
      ${field("inseam", "Inseam", 'placeholder="inches" inputmode="decimal"')}
      ${field("sleeve", "Sleeve", 'placeholder="inches" inputmode="decimal"')}
    </div>
    ${wizardFooter("Add item details")}`;
}

function detailsStep() {
  return `
    ${wizardHeader(3, "Tell Tro about the item", "Type the basics or use the microphone to speak naturally.")}
    <div class="form-grid">
      <div class="field"><label>Category</label><select data-bind="category">${["Women's Clothing", "Men's Clothing", "Kids' Clothing", "Shoes", "Handbags", "Accessories", "Home", "Other"].map((x) => `<option ${state.listing.category === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      ${field("itemType", "Item type", 'placeholder="Example: jeans, blouse, jacket"')}
      ${field("brand", "Brand", 'placeholder="Example: Levi’s"')}
      ${field("size", "Size", 'placeholder="Example: 16W"')}
      ${field("color", "Color", 'placeholder="Example: dark wash blue"')}
      ${field("material", "Material", 'placeholder="Example: cotton blend"')}
      <div class="field"><label>Condition</label><select data-bind="condition">${["New with tags", "New without tags", "Pre-owned - Excellent", "Pre-owned - Good", "Pre-owned - Fair"].map((x) => `<option ${state.listing.condition === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="field full"><label>Anything else buyers should know?</label><div class="input-with-action"><textarea data-bind="notes" placeholder="Example: Worn twice, no stains, small mark near hem…">${esc(state.listing.notes)}</textarea><button type="button" data-voice-target="notes" aria-label="Speak item notes">●</button></div></div>
    </div>
    ${wizardFooter("Let Tro create the listing")}`;
}

function field(name, label, attrs = "") {
  return `<div class="field"><label>${label}</label><input data-bind="${name}" value="${esc(state.listing[name])}" ${attrs} /></div>`;
}

function generateStep() {
  if (!state.generated) {
    return `
      ${wizardHeader(4, "Let Tro do the writing", "Tro will combine your photos, measurements, and details into one clear listing.")}
      <div class="generate-box">
        <span class="tro-orb"><i></i></span>
        <h2>Ready when you are</h2>
        <p>I’ll draft an 80-character marketplace title, buyer-friendly description, measurement section, and three pricing points.</p>
        <button class="button large" data-action="generate-listing">✦ Create my listing</button>
      </div>
      ${wizardFooter("Review listing", true)}`;
  }
  const low = Math.max(8, Number(state.listing.listPrice) - 8);
  const high = Number(state.listing.listPrice) + 10;
  return `
    ${wizardHeader(4, "Tro created your listing", "Review and change anything before you publish.")}
    <div class="ai-results">
      <div class="ai-card"><label><span>Suggested title</span><span>${state.listing.title.length}/80</span></label><input data-bind="title" maxlength="80" value="${esc(state.listing.title)}" /></div>
      <div class="ai-card"><label><span>Description</span><span>Buyer-friendly</span></label><textarea data-bind="description">${esc(state.listing.description)}</textarea></div>
      <div class="price-row">
        <div class="price-card"><small>Sell faster</small><strong>${money(low)}</strong></div>
        <div class="price-card recommended"><small>Tro recommends</small><strong>${money(state.listing.listPrice)}</strong></div>
        <div class="price-card"><small>Try higher</small><strong>${money(high)}</strong></div>
      </div>
      <div class="field"><label>Your list price</label><input data-bind="listPrice" type="number" min="0" step="0.01" value="${esc(state.listing.listPrice)}" /></div>
      <button class="button secondary" data-action="generate-listing">↻ Generate another version</button>
    </div>
    ${wizardFooter("Review & choose marketplaces")}`;
}

function publishStep() {
  const title = state.listing.title || buildTitle();
  const firstPhoto = state.photos[0]?.url;
  return `
    ${wizardHeader(5, "Review and prepare to publish", "Choose where this item belongs and where you will store it.")}
    <div class="review-card">
      <div class="review-photo">${firstPhoto ? `<img src="${firstPhoto}" alt="Listing cover" />` : "No photo"}</div>
      <div><span class="tag">Ready for review</span><h3>${esc(title)}</h3><p>${esc(state.listing.condition)} · ${esc(state.listing.size || "Size not entered")} · ${esc(state.listing.color || "Color not entered")}</p><strong>${money(state.listing.listPrice)}</strong></div>
    </div>
    <h3>Choose marketplaces</h3>
    <div class="market-grid">
      ${marketOption("eBay", "ebay", "Best reach for nearly everything")}
      ${marketOption("Poshmark", "poshmark", "Strong clothing community")}
      ${marketOption("Mercari", "mercari", "Simple marketplace selling")}
      ${marketOption("Depop", "depop", "Trend and vintage shoppers")}
    </div>
    <div class="form-grid" style="margin-top:22px">
      ${field("storageBin", "Storage bin / location", 'placeholder="Example: Basement B-12"')}
      ${field("sku", "SKU", 'placeholder="Example: BB-0001"')}
    </div>
    <div class="wizard-footer">
      <button class="button ghost" data-action="wizard-back">← Back</button>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="button secondary" data-action="save-draft">Save draft</button>
        <button class="button large" data-action="publish-listing">Prepare listing →</button>
      </div>
    </div>`;
}

function marketOption(name, className, copy) {
  const checked = state.listing.marketplaces.includes(name);
  return `<label class="market-option"><input type="checkbox" data-marketplace="${name}" ${checked ? "checked" : ""} /><span class="market-logo ${className}">${name.slice(0, 1)}</span><span><strong>${name}</strong><small>${copy}</small></span></label>`;
}

function buildTitle() {
  const parts = [state.listing.brand, state.listing.itemType, state.listing.color, state.listing.size ? `Size ${state.listing.size}` : "", state.listing.material]
    .filter(Boolean)
    .join(" ");
  return (parts || "Resale item — add brand, type, color, and size").slice(0, 80);
}

function buildDescription() {
  const measurements = [
    ["Chest / pit to pit", state.listing.chest],
    ["Waist", state.listing.waist],
    ["Hips", state.listing.hips],
    ["Length", state.listing.length],
    ["Inseam", state.listing.inseam],
    ["Sleeve", state.listing.sleeve],
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value} in`).join("\n");

  return `${state.listing.brand ? `${state.listing.brand} ` : ""}${state.listing.itemType || "item"} in ${state.listing.condition.toLowerCase()} condition.${state.listing.color ? ` Color: ${state.listing.color}.` : ""}${state.listing.material ? ` Material: ${state.listing.material}.` : ""}${state.listing.size ? ` Tagged size: ${state.listing.size}.` : ""}\n\n${state.listing.notes || "Please review all photos for condition and details."}${measurements ? `\n\nApproximate flat-lay measurements:\n${measurements}` : ""}\n\nStored carefully and ready to ship.`;
}

function generateListing() {
  state.listing.title = buildTitle();
  state.listing.description = buildDescription();
  if (!state.listing.listPrice) {
    const categoryBase = state.listing.category.includes("Shoes") ? 38 : state.listing.category.includes("Handbag") ? 48 : 32;
    const brandBoost = /levi|nike|coach|ralph|patagonia|north face/i.test(state.listing.brand) ? 14 : 0;
    state.listing.listPrice = categoryBase + brandBoost;
  }
  state.generated = true;
  render();
  showToast("Tro created your listing. Review it before publishing.");
}

function storeListing(status) {
  const id = state.listing.id || `ST-${Date.now().toString().slice(-7)}`;
  const record = {
    ...state.listing,
    id,
    title: state.listing.title || buildTitle(),
    status,
    photo: state.photos[0]?.url || null,
    photoName: state.photos[0]?.name || "",
    updatedAt: new Date().toISOString(),
  };
  const existing = state.inventory.findIndex((item) => item.id === id);
  if (existing >= 0) state.inventory[existing] = record;
  else state.inventory.unshift(record);
  const persistent = state.inventory.map(({ photo, ...item }) => ({ ...item, photo: null }));
  saveJSON("sourcetro_inventory", persistent);
  return record;
}

function resetListing() {
  state.listing = { ...listingDefaults, marketplaces: ["eBay"] };
  state.photos.forEach((photo) => photo.url.startsWith("blob:") && URL.revokeObjectURL(photo.url));
  state.photos = [];
  state.wizardStep = 1;
  state.generated = false;
}

function inventoryView() {
  page.innerHTML = `
    ${routeTitle("Inventory", "Find every item by title, SKU, status, or storage bin.", '<button class="button" data-route="new-listing">＋ Add item</button>')}
    <div class="toolbar">
      <div class="toolbar-left"><input class="search-input" id="inventorySearch" placeholder="Search inventory…" /><select class="filter-select" id="statusFilter"><option value="">All statuses</option><option>Draft</option><option>Ready</option><option>Listed</option><option>Sold</option></select></div>
      <span class="muted">${state.inventory.length} total items</span>
    </div>
    <div id="inventoryResults">${inventoryTable(state.inventory)}</div>`;
}

function inventoryTable(items) {
  if (!items.length) return emptyState("▦", "Your inventory is ready for its first item", "Create a listing and SourceTro will keep the title, price, SKU, storage bin, and marketplace status together.", "Create first listing", "new-listing");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Item</th><th>Status</th><th>Price</th><th>Storage</th><th>Markets</th><th></th></tr></thead><tbody>${items.map((item) => `
    <tr><td><div class="item-cell"><span class="item-thumb">${item.photo ? `<img src="${item.photo}" alt="" />` : "◎"}</span><span><strong>${esc(item.title)}</strong><br><small class="muted">${esc(item.sku || item.id)}</small></span></div></td><td><span class="tag">${esc(item.status)}</span></td><td>${money(item.listPrice)}</td><td>${esc(item.storageBin || "Not assigned")}</td><td>${esc((item.marketplaces || []).join(", ") || "None")}</td><td><button class="table-action" data-edit-item="${item.id}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}

function emptyState(icon, title, copy, buttonLabel, route) {
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><h2>${title}</h2><p>${copy}</p>${buttonLabel ? `<button class="button" data-route="${route}">${buttonLabel}</button>` : ""}</div>`;
}

function ordersView() {
  const sold = state.inventory.filter((item) => item.status === "Sold");
  page.innerHTML = `${routeTitle("Orders", "Keep sales and next steps in one clear place.")}${sold.length ? inventoryTable(sold) : emptyState("▣", "No orders yet", "When marketplace sales are connected, new orders will appear here with buyer, payment, and shipping status.", "View inventory", "inventory")}`;
}

function shippingView() {
  page.innerHTML = `${routeTitle("Shipping", "Prepare labels, packing, and tracking without losing the item.")}${emptyState("↗", "Nothing needs shipping", "Sold items will appear here with their storage bin so you can pull, pack, label, and mark them shipped.", "Create a listing", "new-listing")}`;
}

function analyticsView() {
  const stats = inventoryStats();
  const values = [0, stats.drafts, stats.active, stats.sold, 0, Math.round(stats.revenue / 10)];
  const max = Math.max(...values, 1);
  page.innerHTML = `
    ${routeTitle("Analytics", "See what is listed, selling, and waiting for your attention.")}
    <div class="stats-grid">
      ${statCard("Items tracked", state.inventory.length, "All SourceTro items", "▦")}
      ${statCard("Active", stats.active, "Draft, ready, or listed", "◎")}
      ${statCard("Sold", stats.sold, "Completed sales", "✓")}
      ${statCard("Revenue", money(stats.revenue), "Before expenses", "$")}
    </div>
    <section class="chart-panel"><div class="panel-header"><div><h2>Resale activity</h2><span class="muted">Your numbers will grow as you use SourceTro.</span></div></div><div class="bar-chart">${values.map((value, index) => `<div class="bar-column" style="height:${Math.max(8, (value / max) * 190)}px"><span>${value}</span><small>${["Photos", "Draft", "Active", "Sold", "Ship", "Sales"][index]}</small></div>`).join("")}</div></section>`;
}

function financesView() {
  page.innerHTML = `
    ${routeTitle("Finances", "Estimate what you keep after item cost, marketplace fees, and shipping.")}
    <div class="finance-grid">
      <section class="panel"><div class="panel-header"><div><h2>Profit estimator</h2><span class="muted">Use this before accepting an offer.</span></div></div><div class="form-grid"><div class="field"><label>Sale price</label><input id="salePrice" type="number" value="45" min="0" step=".01" /></div><div class="field"><label>Item cost</label><input id="itemCost" type="number" value="5" min="0" step=".01" /></div><div class="field"><label>Marketplace fee %</label><input id="feeRate" type="number" value="15" min="0" step=".1" /></div><div class="field"><label>Your shipping cost</label><input id="shipCost" type="number" value="0" min="0" step=".01" /></div></div></section>
      <aside class="calculator-result"><p class="eyebrow">Estimated profit</p><span class="big-money" id="profitResult">$33.25</span><p id="profitDetails">Sale $45.00 − cost $5.00 − fees $6.75 − shipping $0.00</p><small>This is an estimate. Actual marketplace fees may vary.</small></aside>
    </div>`;
  updateProfit();
}

function updateProfit() {
  const sale = Number(document.querySelector("#salePrice")?.value || 0);
  const cost = Number(document.querySelector("#itemCost")?.value || 0);
  const rate = Number(document.querySelector("#feeRate")?.value || 0);
  const ship = Number(document.querySelector("#shipCost")?.value || 0);
  const fees = sale * rate / 100;
  const profit = sale - cost - fees - ship;
  const result = document.querySelector("#profitResult");
  const details = document.querySelector("#profitDetails");
  if (result) result.textContent = money(profit);
  if (details) details.textContent = `Sale ${money(sale)} − cost ${money(cost)} − fees ${money(fees)} − shipping ${money(ship)}`;
}

function marketplacesView() {
  const markets = [
    ["eBay", "ebay", "Large buyer reach and strong search"],
    ["Poshmark", "poshmark", "Clothing-focused social marketplace"],
    ["Mercari", "mercari", "Simple general marketplace"],
    ["Depop", "depop", "Style, trend, and vintage shoppers"],
  ];
  page.innerHTML = `
    ${routeTitle("Marketplaces", "Connect accounts when you are ready to publish and sync real listings.")}
    <div class="connect-grid">${markets.map(([name, className, copy]) => {
      const connected = state.marketplaceConnections[name];
      return `<article class="connect-card"><span class="market-logo ${className}">${name[0]}</span><span><strong>${name}</strong><small class="connect-status ${connected ? "connected" : ""}">${connected ? "✓ Ready for integration" : copy}</small></span><button class="button ${connected ? "secondary" : ""}" data-connect-market="${name}">${connected ? "Disconnect" : "Connect"}</button></article>`;
    }).join("")}</div>
    <div class="panel" style="margin-top:20px"><h3>About marketplace connections</h3><p class="muted" style="margin-bottom:0">This first SourceTro build prepares and stores your listing information. Real publishing requires approved eBay and marketplace API connections. The Connect buttons mark which accounts you want to set up next; they do not yet sign in or publish.</p></div>`;
}

function useDemoListing() {
  state.listing = {
    ...listingDefaults,
    category: "Women's Clothing",
    itemType: "721 high rise skinny jeans",
    brand: "Levi's",
    size: "16W",
    color: "Dark wash blue",
    condition: "Pre-owned - Excellent",
    material: "Cotton blend denim",
    notes: "Gently worn with no stains or holes. Classic five-pocket style.",
    waist: "18",
    hips: "22",
    inseam: "29",
    length: "40",
  };
  state.wizardStep = 3;
  state.generated = false;
  setRoute("new-listing");
  showToast("Demo details added. You can change anything.");
}

function openTro(initialText = "") {
  document.querySelector("#troDrawer").classList.add("open");
  document.querySelector("#drawerOverlay").classList.add("open");
  document.querySelector("#troDrawer").setAttribute("aria-hidden", "false");
  if (initialText) document.querySelector("#troInput").value = initialText;
  setTimeout(() => document.querySelector("#troInput").focus(), 220);
}

function closeTro() {
  document.querySelector("#troDrawer").classList.remove("open");
  document.querySelector("#drawerOverlay").classList.remove("open");
  document.querySelector("#troDrawer").setAttribute("aria-hidden", "true");
}

function troReply(text) {
  const lower = text.toLowerCase();
  if (lower.includes("price")) return "For a strong price suggestion, tell me the brand, item type, condition, and size. In the listing flow, I’ll give you a faster-sale price, recommended price, and higher test price.";
  if (lower.includes("title") || lower.includes("ebay")) return "A strong title starts with Brand + Item Type + Color + Size + important style or material keywords. Open New Listing and I’ll build one from your details.";
  if (lower.includes("today") || lower.includes("start")) return "Start with five easy clothing items from the same storage area. Photograph all five first, then measure and list them one at a time. That keeps you moving without feeling scattered.";
  if (lower.includes("ship")) return "Once an item sells, SourceTro will use the storage bin and SKU to help you find it quickly, then keep the packing and tracking steps together.";
  return "I can help you create a listing, choose measurements, write a title and description, estimate price, organize a storage bin, or plan your next listing session.";
}

function speakToInput(target, button) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showToast("Voice typing is not supported in this browser. Chrome or Edge works best.");
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  button?.classList.add("listening");
  showToast("Listening… speak naturally.");
  recognition.onresult = (event) => {
    const words = event.results[0][0].transcript;
    if (typeof target === "string") {
      state.listing[target] = `${state.listing[target] ? `${state.listing[target]} ` : ""}${words}`;
      render();
    } else if (target) {
      target.value = `${target.value ? `${target.value} ` : ""}${words}`;
    }
  };
  recognition.onerror = () => showToast("I did not catch that. Please try again.");
  recognition.onend = () => button?.classList.remove("listening");
  recognition.start();
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    document.querySelector("#sidebar").classList.remove("open");
    setRoute(routeButton.dataset.route);
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "demo-listing") useDemoListing();
  if (action === "open-tro") openTro();
  if (action === "reset-listing") { resetListing(); render(); showToast("Started a clean listing."); }
  if (action === "wizard-back") { state.wizardStep = Math.max(1, state.wizardStep - 1); render(); }
  if (action === "wizard-next") { state.wizardStep = Math.min(5, state.wizardStep + 1); render(); }
  if (action === "generate-listing") generateListing();
  if (action === "save-draft") { storeListing("Draft"); resetListing(); setRoute("inventory"); showToast("Draft saved in your inventory."); }
  if (action === "publish-listing") {
    if (!state.listing.title && !state.listing.itemType) { showToast("Add item details before preparing the listing."); return; }
    storeListing("Ready");
    resetListing();
    setRoute("inventory");
    showToast("Listing prepared and saved. Connect a marketplace to publish it live.");
  }

  const stepButton = event.target.closest("[data-step]");
  if (stepButton) { state.wizardStep = Number(stepButton.dataset.step); render(); }

  const removePhoto = event.target.closest("[data-remove-photo]");
  if (removePhoto) {
    const [removed] = state.photos.splice(Number(removePhoto.dataset.removePhoto), 1);
    if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
    render();
  }

  const voiceButton = event.target.closest("[data-voice-target]");
  if (voiceButton) speakToInput(voiceButton.dataset.voiceTarget, voiceButton);

  const edit = event.target.closest("[data-edit-item]");
  if (edit) {
    const item = state.inventory.find((record) => record.id === edit.dataset.editItem);
    if (item) {
      state.listing = { ...listingDefaults, ...item };
      state.generated = Boolean(item.title);
      state.wizardStep = 3;
      setRoute("new-listing");
    }
  }

  const connect = event.target.closest("[data-connect-market]");
  if (connect) {
    const name = connect.dataset.connectMarket;
    state.marketplaceConnections[name] = !state.marketplaceConnections[name];
    saveJSON("sourcetro_connections", state.marketplaceConnections);
    render();
    showToast(state.marketplaceConnections[name] ? `${name} marked ready for integration.` : `${name} disconnected.`);
  }
});

document.addEventListener("input", (event) => {
  const bound = event.target.dataset.bind;
  if (bound) state.listing[bound] = event.target.value;
  if (["salePrice", "itemCost", "feeRate", "shipCost"].includes(event.target.id)) updateProfit();
  if (event.target.id === "inventorySearch" || event.target.id === "statusFilter") {
    const query = document.querySelector("#inventorySearch")?.value.toLowerCase() || "";
    const status = document.querySelector("#statusFilter")?.value || "";
    const filtered = state.inventory.filter((item) => {
      const text = `${item.title} ${item.sku} ${item.storageBin} ${item.brand}`.toLowerCase();
      return text.includes(query) && (!status || item.status === status);
    });
    document.querySelector("#inventoryResults").innerHTML = inventoryTable(filtered);
  }
});

document.addEventListener("change", (event) => {
  const bound = event.target.dataset.bind;
  if (bound) state.listing[bound] = event.target.value;

  if (event.target.matches("[data-marketplace]")) {
    const name = event.target.dataset.marketplace;
    if (event.target.checked && !state.listing.marketplaces.includes(name)) state.listing.marketplaces.push(name);
    if (!event.target.checked) state.listing.marketplaces = state.listing.marketplaces.filter((market) => market !== name);
  }

  if (event.target.id === "photoInput") {
    const files = [...event.target.files].slice(0, Math.max(0, 12 - state.photos.length));
    files.forEach((file) => state.photos.push({ name: file.name, url: URL.createObjectURL(file) }));
    render();
    if (files.length) showToast(`${files.length} photo${files.length === 1 ? "" : "s"} added.`);
  }
});

document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#openTroFromSidebar").addEventListener("click", () => openTro());
document.querySelector("#voiceQuickAction").addEventListener("click", () => openTro());
document.querySelector("#mobileTro").addEventListener("click", () => openTro());
document.querySelector("#closeTro").addEventListener("click", closeTro);
document.querySelector("#drawerOverlay").addEventListener("click", () => {
  closeTro();
  document.querySelector("#sidebar").classList.remove("open");
});

document.querySelector("#troForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#troInput");
  const text = input.value.trim();
  if (!text) return;
  const messages = document.querySelector("#troMessages");
  messages.insertAdjacentHTML("beforeend", `<div class="message user-message">${esc(text)}</div>`);
  input.value = "";
  setTimeout(() => {
    messages.insertAdjacentHTML("beforeend", `<div class="message tro-message">${esc(troReply(text))}</div>`);
    messages.scrollTop = messages.scrollHeight;
  }, 350);
  messages.scrollTop = messages.scrollHeight;
});

document.querySelector("#troSuggestions")?.addEventListener("click", () => {});
document.querySelector(".tro-suggestions").addEventListener("click", (event) => {
  if (event.target.matches("button")) {
    document.querySelector("#troInput").value = event.target.textContent;
    document.querySelector("#troForm").requestSubmit();
  }
});
document.querySelector("#troMic").addEventListener("click", (event) => speakToInput(document.querySelector("#troInput"), event.currentTarget));

window.addEventListener("hashchange", () => {
  const next = location.hash.replace("#", "") || "dashboard";
  if (next !== state.route) { state.route = next; render(); }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

render();
