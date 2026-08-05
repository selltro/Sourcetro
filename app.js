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
  styleModel: "",
  flaws: "",
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
  offerPrice: "",
  lowestPrice: "",
  itemCost: "",
  sourceLocation: "",
  purchaseDate: "",
  storageBin: "",
  sku: "",
  marketplaces: ["eBay"],
};

const sourceScanDefaults = {
  itemName: "",
  brand: "",
  category: "Women's Clothing",
  condition: "Pre-owned - Good",
  purchasePrice: "",
  shippingCost: "7.50",
  feeRate: "14",
  marketplace: "eBay",
};

const membershipPlans = [
  {
    id: "free",
    name: "Try Tro",
    eyebrow: "Start free",
    monthly: 0,
    annual: 0,
    description: "Learn the SourceTro flow and create your first listings without a card.",
    features: [
      "5 Smart Source Scans each month",
      "10 AI-created listings each month",
      "1 marketplace",
      "Basic inventory and bin tracking",
      "Talk to Tro and Tell Tro",
    ],
  },
  {
    id: "seller",
    name: "Seller",
    eyebrow: "For active resellers",
    monthly: 29.99,
    annual: 299,
    description: "A complete weekly workflow for sourcing, listing, cross-listing, and staying organized.",
    features: [
      "100 new items each month",
      "100 Smart Source Scans each month",
      "Cross-list to 4 marketplaces",
      "100 background removals each month",
      "Auto-delisting when an item sells",
      "Voice help, bin tracking, and profit reports",
    ],
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    eyebrow: "For growing businesses",
    monthly: 39.99,
    annual: 399,
    description: "More volume, stronger insights, and time-saving tools for serious resellers.",
    features: [
      "250 new items each month",
      "250 Smart Source Scans each month",
      "All supported marketplaces",
      "300 background removals each month",
      "Bulk tools and Dead-Pile Rescue",
      "Advanced analytics, mileage, and tax reports",
      "Automations and priority support",
    ],
  },
];

const roadmapIdeas = [
  { id: "best-market", title: "Best marketplace recommendation", copy: "Compare estimated profit and selling speed before choosing where to list.", status: "Planned", votes: 38 },
  { id: "dead-pile", title: "Dead-Pile Rescue", copy: "Photograph several unlisted items and let Tro prepare the drafts in a batch.", status: "Under review", votes: 31 },
  { id: "tro-today", title: "Tro Today", copy: "Get three simple daily actions that move your resale business forward.", status: "Building", votes: 24 },
  { id: "scan", title: "Smart Source Scan", copy: "Estimate value, profit, ROI, and whether to buy before spending money.", status: "Now live", votes: 56 },
];

const state = {
  route: location.hash.replace("#", "") || "dashboard",
  wizardStep: 1,
  photos: [],
  listing: { ...listingDefaults },
  generated: false,
  inventory: loadJSON("sourcetro_inventory", []),
  marketplaceConnections: loadJSON("sourcetro_connections", {}),
  sourceScan: { ...sourceScanDefaults },
  sourcePhoto: null,
  sourceResult: null,
  scanHistory: loadJSON("sourcetro_scan_history", []),
  financeRecords: loadJSON("sourcetro_finance_records", []),
  billingCycle: "monthly",
  membershipInterest: loadJSON("sourcetro_membership_interest", "free"),
  feedback: loadJSON("sourcetro_feedback", []),
  feedbackVotes: loadJSON("sourcetro_feedback_votes", {}),
  feedbackDraft: { category: "I have an idea", message: "", contact: "" },
  feedbackScreenshot: null,
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

const troExpressions = [
  ["listening", "Listening…"],
  ["thinking", "Thinking…"],
  ["working", "Working on it…"],
  ["success", "Complete — ready to review."],
  ["ready", "Ready when you are."],
];
let troExpressionIndex = 0;

function setTroState(mood, message, resetDelay = 0) {
  document.querySelectorAll(".tro-character, .tro-orb").forEach((lens) => {
    lens.dataset.mood = mood;
  });
  const character = document.querySelector(".tro-character");
  const status = document.querySelector(".tro-status");
  if (character) character.setAttribute("aria-label", `Tro is ${mood}. ${message}`);
  if (status) status.textContent = message;
  clearTimeout(setTroState.timer);
  if (resetDelay) {
    setTroState.timer = setTimeout(() => setTroState("ready", "Ready when you are."), resetDelay);
  }
}

function cycleTroExpression() {
  const [mood, message] = troExpressions[troExpressionIndex];
  troExpressionIndex = (troExpressionIndex + 1) % troExpressions.length;
  setTroState(mood, message, mood === "ready" ? 0 : 2600);
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
    "source-scan": sourceScanView,
    "new-listing": listingView,
    inventory: inventoryView,
    orders: ordersView,
    shipping: shippingView,
    analytics: analyticsView,
    finances: financesView,
    marketplaces: marketplacesView,
    membership: membershipView,
    "tell-tro": tellTroView,
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
  const revenue = sold.reduce((sum, item) => sum + Number(item.soldPrice || item.listPrice || 0), 0);
  const drafts = state.inventory.filter((item) => item.status === "Draft").length;
  const stale = state.inventory.filter((item) => item.status === "Listed" && Date.now() - new Date(item.updatedAt || 0).getTime() > 60 * 86400000).length;
  return { active, sold: sold.length, revenue, drafts, stale };
}

function dashboardView() {
  const stats = inventoryStats();
  page.innerHTML = `
    <div class="hero-card">
      <div>
        <p class="eyebrow">Tro™ · Trusted Resale Operator</p>
        <h1>Good ${greeting()}, Nydia.</h1>
        <p>SourceTro helps resellers source smarter, list faster, stay organized, and sell more—from source to sold.</p>
        <div class="hero-actions">
          <button class="button large" data-route="source-scan">◎ Scan before buying</button>
          <button class="button secondary large" data-route="new-listing">＋ Create a listing</button>
        </div>
      </div>
      <div class="hero-lens">
        <button class="tro-character" data-action="tro-expression" data-mood="ready" aria-label="Tro is ready. Tap the lens to preview its color states.">
          <span class="tro-lens-body" aria-hidden="true">
            <span class="tro-focus-ring"></span>
            <span class="tro-glass">
              <span class="tro-shine"></span>
              <span class="tro-aperture"></span>
              <span class="tro-core"></span>
            </span>
          </span>
        </button>
        <small class="tro-status" aria-live="polite">Ready when you are.</small>
      </div>
    </div>

    <div class="start-choice-grid" aria-label="Choose how to start">
      <button class="start-choice source-choice" data-route="source-scan">
        <span class="choice-number">1</span>
        <span class="choice-icon">◎</span>
        <span><strong>Scan an item before buying</strong><small>Identify it, compare prices, estimate profit, and decide: buy or pass.</small></span>
        <b>Start scan →</b>
      </button>
      <button class="start-choice listing-choice" data-route="new-listing">
        <span class="choice-number">2</span>
        <span class="choice-icon">＋</span>
        <span><strong>Create a listing for an item I own</strong><small>Add photos and measurements, then let Tro prepare the listing.</small></span>
        <b>Start listing →</b>
      </button>
    </div>

    <div class="stats-grid">
      ${statCard("Items scanned", state.scanHistory.length, "Sourcing decisions saved", "◎")}
      ${statCard("Active listings", stats.active, "Across your marketplaces", "▦")}
      ${statCard("Drafts", stats.drafts, "Ready for your review", "✎")}
      ${statCard("Sold", stats.sold, "All-time in SourceTro", "✓")}
    </div>

    ${(stats.drafts || stats.stale) ? `<div class="tro-alert"><span class="tro-orb" data-mood="thinking"><i></i></span><div><strong>Tro found your next best actions</strong><p>${stats.drafts ? `${stats.drafts} draft${stats.drafts === 1 ? " is" : "s are"} waiting to be finished. ` : ""}${stats.stale ? `${stats.stale} listing${stats.stale === 1 ? " has" : "s have"} been active more than 60 days—consider a price change or relist.` : ""}</p></div><button class="button secondary" data-route="inventory">Review items</button></div>` : ""}

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-header"><div><h2>What do you want to do?</h2><span class="muted">Start with the easiest next step.</span></div></div>
        <div class="quick-grid">
          ${quickAction("source-scan", "◎", "Check an item", "See whether it may be worth buying")}
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
      ${featureCard("◎", "Source smarter", "Photo identification, sold-price comparisons, demand, ROI, and buy-or-pass guidance.")}
      ${featureCard("✦", "List faster", "Titles, descriptions, item specifics, measurements, and pricing guidance.")}
      ${featureCard("⇄", "Cross-listing", "Prepare one item for eBay, Poshmark, Mercari, and Depop.")}
      ${featureCard("▦", "Inventory control", "Know the exact bin and SKU for every item.")}
    </div>

    <div class="community-strip">
      <section>
        <span class="community-icon">◇</span>
        <div><p class="eyebrow">Membership</p><h2>Choose a plan that can grow with you</h2><p>Start free, then move up when you need more scans, listings, and marketplaces.</p></div>
        <button class="button secondary" data-route="membership">Compare plans</button>
      </section>
      <section>
        <span class="community-icon coral">✦</span>
        <div><p class="eyebrow">Built with resellers</p><h2>Have an idea? Tell Tro.</h2><p>Report a problem, ask for help, request a marketplace, or vote on what SourceTro builds next.</p></div>
        <button class="button" data-route="tell-tro">Tell Tro</button>
      </section>
    </div>

    <section class="mission-card">
      <p class="eyebrow">Our mission</p>
      <h2>From Source to Sold</h2>
      <p>SourceTro helps resellers source smarter, list faster, stay organized, and sell more. Tro™ is your Trusted Resale Operator—ready by voice or typing whenever you need help.</p>
    </section>`;
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

function sourceScanView() {
  const scan = state.sourceScan;
  page.innerHTML = `
    ${routeTitle("Smart Source Scan", "Snap it, identify it, compare the numbers, and decide whether it is worth buying.", '<button class="button secondary" data-action="reset-scan">Start over</button>')}
    <div class="source-scan-layout">
      <section class="panel source-scan-form">
        <div class="source-step"><span>1</span><div><h2>Snap the item</h2><p class="muted">Take one clear photo. Add the label, model, or brand in the item details when you can.</p></div></div>
        <div class="upload-zone source-upload ${state.sourcePhoto ? "has-photo" : ""}">
          <input type="file" id="sourcePhotoInput" accept="image/*" capture="environment" aria-label="Take or upload a sourcing photo" />
          ${state.sourcePhoto
            ? `<img src="${state.sourcePhoto.url}" alt="Item to research" /><button type="button" class="replace-photo">Replace photo</button>`
            : `<div><span class="upload-icon">◎</span><h3>Take a picture or choose a photo</h3><p class="muted">Tro will use this as the starting point for identification.</p><span class="button secondary">Choose photo</span></div>`}
        </div>

        <div class="source-step details-heading"><span>2</span><div><h2>Add what you know</h2><p class="muted">Even one or two details can make the price comparison more accurate.</p></div></div>
        <div class="form-grid">
          ${scanField("itemName", "What is it?", 'placeholder="Example: Levi’s 721 jeans"')}
          ${scanField("brand", "Brand", 'placeholder="Example: Levi’s"')}
          <div class="field"><label>Category</label><select data-scan-bind="category">${["Women's Clothing", "Men's Clothing", "Kids' Clothing", "Shoes", "Handbags", "Accessories", "Electronics", "Collectibles", "Home", "Other"].map((x) => `<option ${scan.category === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label>Condition</label><select data-scan-bind="condition">${["New with tags", "New without tags", "Pre-owned - Excellent", "Pre-owned - Good", "Pre-owned - Fair"].map((x) => `<option ${scan.condition === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          ${scanField("purchasePrice", "Store price", 'type="number" min="0" step=".01" inputmode="decimal" placeholder="12.00"')}
          <div class="field"><label>Compare on</label><select data-scan-bind="marketplace">${["eBay", "Poshmark", "Mercari", "Depop", "All marketplaces"].map((x) => `<option ${scan.marketplace === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          ${scanField("shippingCost", "Estimated shipping cost", 'type="number" min="0" step=".01" inputmode="decimal"')}
          ${scanField("feeRate", "Estimated marketplace fee %", 'type="number" min="0" max="40" step=".1" inputmode="decimal"')}
        </div>

        <div class="scan-actions">
          <button class="button large" data-action="analyze-source">◎ Identify & check value</button>
          <button class="button ghost" data-action="demo-source">Try a demo scan</button>
        </div>
        <p class="data-note"><strong>Prototype note:</strong> This screen is ready for live image recognition and sold-listing search. Until those secure services are connected, Tro shows a clearly labeled planning estimate—not live web data.</p>
      </section>

      <aside class="source-results" id="sourceResults">
        ${state.sourceResult ? sourceResultMarkup(state.sourceResult) : sourceWaitingMarkup()}
      </aside>
    </div>

    ${state.scanHistory.length ? `
      <section class="panel scan-history">
        <div class="panel-header"><div><h2>Recent sourcing decisions</h2><span class="muted">Saved on this device</span></div></div>
        <div class="history-list">${state.scanHistory.slice(0, 4).map((item) => `<div><span class="decision-dot ${item.tone}"></span><span><strong>${esc(item.identifiedItem)}</strong><small>${item.recommendation} · Store price ${money(item.purchasePrice)}</small></span><b>${money(item.profit)} profit</b></div>`).join("")}</div>
      </section>` : ""}`;
}

function scanField(name, label, attrs = "") {
  return `<div class="field"><label>${label}</label><input data-scan-bind="${name}" value="${esc(state.sourceScan[name])}" ${attrs} /></div>`;
}

function sourceWaitingMarkup() {
  return `<div class="source-waiting">
    <span class="tro-orb" data-mood="ready"><i></i></span>
    <p class="eyebrow">Tro is ready</p>
    <h2>Should you buy it?</h2>
    <p>After the scan, Tro will organize the item identity, expected sold-price range, demand, fees, shipping, profit, ROI, and maximum recommended purchase price.</p>
    <div class="decision-preview"><span>Great Buy</span><span>Consider</span><span>Buy below $___</span><span>Pass</span></div>
  </div>`;
}

function sourceResultMarkup(result) {
  return `<div class="source-result-card">
    <div class="decision-banner ${result.tone}">
      <small>Tro’s sourcing recommendation</small>
      <strong>${result.recommendation}</strong>
      <p>${result.reason}</p>
    </div>
    <div class="identified-item">
      <span class="result-lens">◎</span>
      <div><small>Likely item · ${result.confidence}% planning confidence</small><h2>${esc(result.identifiedItem)}</h2><p>${esc(result.category)} · ${esc(result.condition)}</p></div>
    </div>
    <div class="sold-range">
      <small>Estimated resale range</small>
      <strong>${money(result.soldLow)}–${money(result.soldHigh)}</strong>
      <span>Typical value ${money(result.median)} · ${result.marketplace}</span>
    </div>
    <div class="result-metrics">
      ${resultMetric("Estimated profit", money(result.profit))}
      ${resultMetric("Return on investment", `${result.roi}%`)}
      ${resultMetric("Demand / sell-through", `${result.sellThrough}%`)}
      ${resultMetric("Estimated time to sell", `${result.days} days`)}
      ${resultMetric("Maximum buy price", money(result.maxBuy))}
      ${resultMetric("Fees + shipping", money(result.fees + result.shipping))}
    </div>
    <div class="comparison-preview">
      <div class="comparison-heading"><h3>Sold-comparison preview</h3><span>Sample—not live</span></div>
      ${result.sampleComps.map((comp) => `<div><span><strong>${esc(comp.title)}</strong><small>${comp.marketplace} · ${comp.condition}</small></span><b>${money(comp.price)}</b></div>`).join("")}
    </div>
    <div class="result-actions">
      <button class="button full" data-action="scan-to-listing">I bought it—create listing</button>
      <button class="button secondary full" data-action="save-scan">Save this decision</button>
    </div>
  </div>`;
}

function resultMetric(label, value) {
  return `<div><small>${label}</small><strong>${value}</strong></div>`;
}

function analyzeSourceScan() {
  const scan = state.sourceScan;
  if (!state.sourcePhoto && !scan.itemName.trim()) {
    showToast("Add a photo or tell Tro what the item is first.");
    return;
  }

  setTroState("thinking", "Identifying and comparing…");
  showToast("Tro is checking the item and running the numbers…");
  setTimeout(() => {
    const itemName = scan.itemName.trim() || state.sourcePhoto?.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Resale item";
    const knownBrand = /levi|nike|coach|patagonia|north face|ralph|lululemon|carhartt|free people/i.test(`${scan.brand} ${itemName}`);
    const categoryBases = { "Women's Clothing": 34, "Men's Clothing": 36, "Kids' Clothing": 22, Shoes: 48, Handbags: 62, Accessories: 28, Electronics: 72, Collectibles: 46, Home: 38, Other: 32 };
    const conditionFactors = { "New with tags": 1.2, "New without tags": 1.1, "Pre-owned - Excellent": 1, "Pre-owned - Good": .88, "Pre-owned - Fair": .64 };
    const base = categoryBases[scan.category] || 34;
    const median = Math.max(10, Math.round((base + (knownBrand ? 18 : 0)) * (conditionFactors[scan.condition] || .88)));
    const soldLow = Math.max(6, Math.round(median * .78));
    const soldHigh = Math.round(median * 1.22);
    const purchasePrice = Number(scan.purchasePrice || 0);
    const shipping = Number(scan.shippingCost || 0);
    const fees = Math.round((median * Number(scan.feeRate || 0) / 100) * 100) / 100;
    const profit = Math.round((median - purchasePrice - shipping - fees) * 100) / 100;
    const roi = purchasePrice > 0 ? Math.round((profit / purchasePrice) * 100) : 0;
    const sellThrough = Math.min(88, Math.max(28, 49 + (knownBrand ? 24 : 0) + (scan.condition.includes("Excellent") || scan.condition.includes("New") ? 7 : 0)));
    const days = sellThrough >= 70 ? 21 : sellThrough >= 50 ? 38 : 62;
    const targetProfit = Math.max(12, median * .35);
    const maxBuy = Math.max(0, Math.floor(median - fees - shipping - targetProfit));
    let recommendation = "PASS";
    let tone = "pass";
    let reason = `At ${money(purchasePrice)}, the expected margin is too thin for the time and risk.`;
    if (!scan.purchasePrice) {
      recommendation = `BUY ONLY BELOW ${money(maxBuy)}`;
      tone = "caution";
      reason = "Enter the store price for a personal buy-or-pass answer. This is Tro’s current maximum target cost.";
    } else if (profit >= 25 && roi >= 100 && sellThrough >= 55) {
      recommendation = "GREAT BUY";
      tone = "buy";
      reason = `The estimated ${money(profit)} profit, ${roi}% ROI, and ${sellThrough}% demand make this a strong sourcing candidate.`;
    } else if (profit >= 12 && roi >= 45) {
      recommendation = "WORTH CONSIDERING";
      tone = "consider";
      reason = `The numbers can work, but check condition, flaws, and how quickly you want your money back.`;
    } else if (purchasePrice <= maxBuy && profit > 0) {
      recommendation = `ONLY BUY BELOW ${money(maxBuy)}`;
      tone = "caution";
      reason = "The item may work only with a lower purchase cost or cheaper shipping.";
    }

    state.sourceResult = {
      identifiedItem: `${scan.brand ? `${scan.brand} ` : ""}${itemName}`.trim(),
      category: scan.category,
      condition: scan.condition,
      marketplace: scan.marketplace,
      confidence: state.sourcePhoto ? (knownBrand ? 86 : 74) : 64,
      soldLow,
      soldHigh,
      median,
      purchasePrice,
      shipping,
      fees,
      profit,
      roi,
      sellThrough,
      days,
      maxBuy,
      recommendation,
      tone,
      reason,
      sampleComps: [
        { title: `${scan.brand || "Similar"} ${itemName}`, marketplace: "eBay", condition: "Pre-owned", price: soldLow },
        { title: `${itemName} comparable`, marketplace: scan.marketplace === "All marketplaces" ? "Poshmark" : scan.marketplace, condition: scan.condition, price: median },
        { title: `${scan.brand || "Comparable"} ${scan.category}`, marketplace: "Mercari", condition: "Excellent", price: soldHigh },
      ],
    };
    render();
    setTroState("success", "Sourcing answer ready.", 2600);
  }, 750);
}

function useDemoScan() {
  state.sourceScan = { ...sourceScanDefaults, itemName: "721 high rise skinny jeans size 16W", brand: "Levi's", purchasePrice: "12", condition: "Pre-owned - Excellent" };
  state.sourceResult = null;
  render();
  analyzeSourceScan();
}

function resetSourceScan() {
  if (state.sourcePhoto?.url?.startsWith("blob:")) URL.revokeObjectURL(state.sourcePhoto.url);
  state.sourcePhoto = null;
  state.sourceScan = { ...sourceScanDefaults };
  state.sourceResult = null;
}

function saveSourceDecision() {
  if (!state.sourceResult) return;
  state.scanHistory.unshift({ ...state.sourceResult, savedAt: new Date().toISOString() });
  state.scanHistory = state.scanHistory.slice(0, 30);
  saveJSON("sourcetro_scan_history", state.scanHistory);
  render();
  showToast("Sourcing decision saved.");
}

function scanToListing() {
  if (!state.sourceResult) return;
  const result = state.sourceResult;
  state.listing = {
    ...listingDefaults,
    category: result.category,
    itemType: state.sourceScan.itemName || result.identifiedItem,
    brand: state.sourceScan.brand,
    condition: result.condition,
    listPrice: result.median,
    notes: `Sourcing estimate: ${result.recommendation}. Estimated resale range ${money(result.soldLow)}–${money(result.soldHigh)}. Verify live comparisons before publishing.`,
    itemCost: result.purchasePrice || "",
    offerPrice: Math.round(result.median * .9),
    lowestPrice: Math.round(result.median * .75),
  };
  if (state.sourcePhoto) {
    state.photos = [state.sourcePhoto];
    state.sourcePhoto = null;
  }
  state.generated = false;
  state.wizardStep = state.photos.length ? 2 : 1;
  setRoute("new-listing");
  showToast("Scan details carried into your listing. Nothing needs to be entered twice.");
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
      ${field("styleModel", "Style / model number", 'placeholder="Example: 721 or RN number"')}
      <div class="field"><label>Condition</label><select data-bind="condition">${["New with tags", "New without tags", "Pre-owned - Excellent", "Pre-owned - Good", "Pre-owned - Fair"].map((x) => `<option ${state.listing.condition === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="field full"><label>Flaws or missing pieces</label><div class="input-with-action"><textarea data-bind="flaws" placeholder="Example: Small mark near hem; shown in photo 6">${esc(state.listing.flaws)}</textarea><button type="button" data-voice-target="flaws" aria-label="Speak flaws">●</button></div></div>
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
        <div class="price-card"><small>Lowest acceptable</small><strong>${money(state.listing.lowestPrice || low)}</strong></div>
        <div class="price-card recommended"><small>Tro recommends</small><strong>${money(state.listing.listPrice)}</strong></div>
        <div class="price-card"><small>Suggested offer</small><strong>${money(state.listing.offerPrice || high)}</strong></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Your list price</label><input data-bind="listPrice" type="number" min="0" step="0.01" value="${esc(state.listing.listPrice)}" /></div>
        <div class="field"><label>Offer price</label><input data-bind="offerPrice" type="number" min="0" step="0.01" value="${esc(state.listing.offerPrice)}" /></div>
        <div class="field"><label>Lowest acceptable price</label><input data-bind="lowestPrice" type="number" min="0" step="0.01" value="${esc(state.listing.lowestPrice)}" /></div>
      </div>
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
      ${marketOption("Facebook Marketplace", "facebook", "Local and social buyers")}
    </div>
    <div class="form-grid" style="margin-top:22px">
      ${field("storageBin", "Storage bin / location", 'placeholder="Example: Basement B-12"')}
      ${field("sku", "SKU", 'placeholder="Example: BB-0001"')}
      ${field("itemCost", "What you paid", 'type="number" min="0" step=".01" placeholder="12.00"')}
      ${field("sourceLocation", "Where you sourced it", 'placeholder="Example: Goodwill Boston Road"')}
      ${field("purchaseDate", "Purchase date", 'type="date"')}
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
  const parts = [state.listing.brand, state.listing.itemType, state.listing.styleModel, state.listing.color, state.listing.size ? `Size ${state.listing.size}` : "", state.listing.material]
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

  return `${state.listing.brand ? `${state.listing.brand} ` : ""}${state.listing.itemType || "item"} in ${state.listing.condition.toLowerCase()} condition.${state.listing.styleModel ? ` Style/model: ${state.listing.styleModel}.` : ""}${state.listing.color ? ` Color: ${state.listing.color}.` : ""}${state.listing.material ? ` Material: ${state.listing.material}.` : ""}${state.listing.size ? ` Tagged size: ${state.listing.size}.` : ""}\n\n${state.listing.notes || "Please review all photos for condition and details."}${state.listing.flaws ? `\n\nDisclosed flaws: ${state.listing.flaws}` : ""}${measurements ? `\n\nApproximate flat-lay measurements:\n${measurements}` : ""}\n\nStored carefully and ready to ship.`;
}

function generateListing() {
  setTroState("working", "Building your listing…");
  setTimeout(() => {
    state.listing.title = buildTitle();
    state.listing.description = buildDescription();
    if (!state.listing.listPrice) {
      const categoryBase = state.listing.category.includes("Shoes") ? 38 : state.listing.category.includes("Handbag") ? 48 : 32;
      const brandBoost = /levi|nike|coach|ralph|patagonia|north face/i.test(state.listing.brand) ? 14 : 0;
      state.listing.listPrice = categoryBase + brandBoost;
    }
    if (!state.listing.offerPrice) state.listing.offerPrice = Math.round(Number(state.listing.listPrice) * .9);
    if (!state.listing.lowestPrice) state.listing.lowestPrice = Math.round(Number(state.listing.listPrice) * .75);
    state.generated = true;
    render();
    setTroState("success", "Listing ready to review.", 2600);
    showToast("Tro created your listing. Review it before publishing.");
  }, 650);
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
  const stats = inventoryStats();
  page.innerHTML = `
    ${routeTitle("Inventory", "Find every item by title, SKU, status, or storage bin.", '<button class="button" data-route="new-listing">＋ Add item</button>')}
    ${(stats.drafts || stats.stale) ? `<div class="inventory-reminders"><span><strong>${stats.drafts}</strong><small>Drafts to finish</small></span><span><strong>${stats.stale}</strong><small>Listings over 60 days</small></span><p>Tro will remind you to finish, relist, reduce, or refresh items that need attention.</p></div>` : ""}
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
  page.innerHTML = `${routeTitle("Orders", "Keep sales and next steps in one clear place.")}${sold.length ? inventoryTable(sold) : emptyState("▣", "No orders yet", "When marketplace accounts are securely connected, new orders will appear here with buyer, payment, and shipping status—and SourceTro can remove the sold item from your other marketplaces.", "View inventory", "inventory")}`;
}

function shippingView() {
  page.innerHTML = `${routeTitle("Shipping", "Prepare labels, packing, tracking, and combined shipments without losing the item.")}${emptyState("↗", "Nothing needs shipping", "Sold items will appear here with the storage bin, SKU, packing steps, label status, tracking number, and combined-shipping guidance.", "Create a listing", "new-listing")}`;
}

function analyticsView() {
  const stats = inventoryStats();
  const values = [0, stats.drafts, stats.active, stats.sold, 0, Math.round(stats.revenue / 10)];
  const max = Math.max(...values, 1);
  const sourceMap = state.inventory.reduce((map, item) => {
    const location = item.sourceLocation || "Not recorded";
    const row = map.get(location) || { location, items: 0, potentialProfit: 0 };
    row.items += 1;
    row.potentialProfit += Number(item.listPrice || 0) - Number(item.itemCost || 0);
    map.set(location, row);
    return map;
  }, new Map());
  const sourceRows = [...sourceMap.values()].sort((a, b) => b.potentialProfit - a.potentialProfit);
  page.innerHTML = `
    ${routeTitle("Analytics", "See what is listed, selling, and waiting for your attention.")}
    <div class="stats-grid">
      ${statCard("Items tracked", state.inventory.length, "All SourceTro items", "▦")}
      ${statCard("Active", stats.active, "Draft, ready, or listed", "◎")}
      ${statCard("Sold", stats.sold, "Completed sales", "✓")}
      ${statCard("Revenue", money(stats.revenue), "Before expenses", "$")}
    </div>
    <section class="chart-panel"><div class="panel-header"><div><h2>Resale activity</h2><span class="muted">Your numbers will grow as you use SourceTro.</span></div></div><div class="bar-chart">${values.map((value, index) => `<div class="bar-column" style="height:${Math.max(8, (value / max) * 190)}px"><span>${value}</span><small>${["Photos", "Draft", "Active", "Sold", "Ship", "Sales"][index]}</small></div>`).join("")}</div></section>
    <section class="panel sourcing-insights"><div class="panel-header"><div><h2>Where your best inventory comes from</h2><span class="muted">Source locations and potential margin based on the costs you record.</span></div></div>
      ${sourceRows.length ? `<div class="insight-list">${sourceRows.slice(0, 6).map((row) => `<div><span><strong>${esc(row.location)}</strong><small>${row.items} item${row.items === 1 ? "" : "s"}</small></span><b>${money(row.potentialProfit)} potential margin</b></div>`).join("")}</div>` : `<p class="muted">Add “Where you sourced it” and “What you paid” when you prepare a listing. Tro will then show which stores, sales, and locations produce the most profit.</p>`}
    </section>`;
}

function financesView() {
  const expenses = state.financeRecords.filter((record) => record.type !== "Mileage").reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const miles = state.financeRecords.filter((record) => record.type === "Mileage").reduce((sum, record) => sum + Number(record.amount || 0), 0);
  page.innerHTML = `
    ${routeTitle("Finances", "Estimate profit, record business expenses and mileage, and keep clean data for your reports.", state.financeRecords.length ? '<button class="button secondary" data-action="export-finances">Export CSV</button>' : "")}
    <div class="finance-grid">
      <section class="panel"><div class="panel-header"><div><h2>Profit estimator</h2><span class="muted">Use this before accepting an offer.</span></div></div><div class="form-grid"><div class="field"><label>Sale price</label><input id="salePrice" type="number" value="45" min="0" step=".01" /></div><div class="field"><label>Item cost</label><input id="itemCost" type="number" value="5" min="0" step=".01" /></div><div class="field"><label>Marketplace fee %</label><input id="feeRate" type="number" value="15" min="0" step=".1" /></div><div class="field"><label>Your shipping cost</label><input id="shipCost" type="number" value="0" min="0" step=".01" /></div></div></section>
      <aside class="calculator-result"><p class="eyebrow">Estimated profit</p><span class="big-money" id="profitResult">$33.25</span><p id="profitDetails">Sale $45.00 − cost $5.00 − fees $6.75 − shipping $0.00</p><small>This is an estimate. Actual marketplace fees may vary.</small></aside>
    </div>
    <section class="panel finance-log">
      <div class="panel-header"><div><h2>Expense & mileage log</h2><span class="muted">Stored on this device and ready to export.</span></div><div class="finance-totals"><span><small>Expenses</small><strong>${money(expenses)}</strong></span><span><small>Mileage</small><strong>${miles.toFixed(1)} mi</strong></span></div></div>
      <div class="finance-entry-row">
        <div class="field"><label>Record type</label><select id="financeType"><option>Inventory purchase</option><option>Shipping supplies</option><option>Platform fee</option><option>Advertising</option><option>Mileage</option><option>Other</option></select></div>
        <div class="field"><label>Amount or miles</label><input id="financeAmount" type="number" min="0" step=".01" placeholder="0.00" /></div>
        <div class="field"><label>Note</label><input id="financeNote" placeholder="Example: thrift trip or poly mailers" /></div>
        <button class="button" data-action="add-finance-record">Add record</button>
      </div>
      ${state.financeRecords.length ? `<div class="finance-records">${state.financeRecords.slice(0, 8).map((record) => `<div><span><strong>${esc(record.type)}</strong><small>${esc(record.note || "No note")} · ${new Date(record.createdAt).toLocaleDateString()}</small></span><b>${record.type === "Mileage" ? `${Number(record.amount).toFixed(1)} mi` : money(record.amount)}</b></div>`).join("")}</div>` : `<p class="muted finance-empty">No records yet. Add purchases, supplies, fees, advertising, mileage, or other business costs here.</p>`}
      <p class="data-note"><strong>Recordkeeping note:</strong> SourceTro organizes the information you enter; it does not provide tax advice. Confirm deductions and filing rules with a qualified tax professional.</p>
    </section>`;
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

function addFinanceRecord() {
  const type = document.querySelector("#financeType")?.value || "Other";
  const amount = Number(document.querySelector("#financeAmount")?.value || 0);
  const note = document.querySelector("#financeNote")?.value.trim() || "";
  if (amount <= 0) {
    showToast(type === "Mileage" ? "Enter the miles driven." : "Enter the amount paid.");
    return;
  }
  state.financeRecords.unshift({ id: `FR-${Date.now()}`, type, amount, note, createdAt: new Date().toISOString() });
  saveJSON("sourcetro_finance_records", state.financeRecords);
  render();
  showToast(`${type} recorded.`);
}

function exportFinanceCsv() {
  if (!state.financeRecords.length) return;
  const rows = [["Date", "Type", "Amount or miles", "Note"], ...state.financeRecords.map((record) => [record.createdAt.slice(0, 10), record.type, record.amount, record.note])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sourcetro-finances-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Finance CSV downloaded.");
}

function marketplacesView() {
  const markets = [
    ["eBay", "ebay", "Large buyer reach and strong search"],
    ["Poshmark", "poshmark", "Clothing-focused social marketplace"],
    ["Mercari", "mercari", "Simple general marketplace"],
    ["Depop", "depop", "Style, trend, and vintage shoppers"],
    ["Facebook Marketplace", "facebook", "Local and social marketplace"],
  ];
  page.innerHTML = `
    ${routeTitle("Marketplaces", "Connect accounts when you are ready to publish and sync real listings.")}
    <div class="connect-grid">${markets.map(([name, className, copy]) => {
      const connected = state.marketplaceConnections[name];
      return `<article class="connect-card"><span class="market-logo ${className}">${name[0]}</span><span><strong>${name}</strong><small class="connect-status ${connected ? "connected" : ""}">${connected ? "✓ Ready for integration" : copy}</small></span><button class="button ${connected ? "secondary" : ""}" data-connect-market="${name}">${connected ? "Disconnect" : "Connect"}</button></article>`;
    }).join("")}</div>
    <div class="panel" style="margin-top:20px"><h3>About marketplace connections</h3><p class="muted" style="margin-bottom:0">This build prepares and stores your listing information for eBay, Poshmark, Mercari, Depop, and Facebook Marketplace. Approved marketplace connections are required for real publishing, live orders, sold-price searches, status syncing, and automatic delisting when an item sells. The Connect buttons mark which accounts you want to set up next; they do not yet sign in or publish.</p></div>`;
}

function membershipView() {
  const cycle = state.billingCycle;
  page.innerHTML = `
    ${routeTitle("Memberships made for resellers", "Start free. Upgrade when SourceTro is saving you enough time to need more scans, listings, and marketplaces.")}
    <section class="membership-hero">
      <div>
        <p class="eyebrow">Simple, protected pricing</p>
        <h2>One item counts once—even when you cross-list it.</h2>
        <p>SourceTro will never count the same item four times just because it was prepared for four marketplaces. Monthly limits protect the real cost of AI scans, listing creation, and photo processing so the memberships can stay sustainable.</p>
      </div>
      <div class="billing-toggle" role="group" aria-label="Billing cycle">
        <button class="${cycle === "monthly" ? "active" : ""}" data-billing="monthly">Monthly</button>
        <button class="${cycle === "annual" ? "active" : ""}" data-billing="annual">Annual <span>Save up to $100</span></button>
      </div>
    </section>

    <div class="plan-grid">
      ${membershipPlans.map((plan) => membershipPlanCard(plan, cycle)).join("")}
    </div>

    <p class="membership-note"><strong>Payments are not open yet.</strong> Choosing a plan now saves your interest on this device while SourceTro completes live scans, marketplace connections, secure accounts, and billing.</p>

    <section class="panel plan-comparison">
      <div class="panel-header"><div><p class="eyebrow">Compare at a glance</p><h2>What changes with each plan</h2></div></div>
      <div class="table-wrap"><table class="comparison-table">
        <thead><tr><th>Feature</th><th>Free</th><th>Seller</th><th>Pro</th></tr></thead>
        <tbody>
          ${comparisonRow("New items each month", "10 AI listings", "100", "250")}
          ${comparisonRow("Smart Source Scans", "5", "100", "250")}
          ${comparisonRow("Marketplace access", "1", "4", "All supported")}
          ${comparisonRow("Background removals", "—", "100", "300")}
          ${comparisonRow("Auto-delisting", "—", "Included", "Included")}
          ${comparisonRow("Bulk tools & Dead-Pile Rescue", "—", "—", "Included")}
          ${comparisonRow("Reports", "Basic inventory", "Basic profit", "Advanced, mileage & tax")}
          ${comparisonRow("Talk to Tro & Tell Tro", "Included", "Included", "Priority support")}
        </tbody>
      </table></div>
    </section>

    <section class="founding-card">
      <span class="tro-orb" data-mood="success"><i></i></span>
      <div><p class="eyebrow">Founding members</p><h2>Help build SourceTro from the beginning</h2><p>Early testers will be invited to try the working connections first, share feedback through Tell Tro, and keep their original launch price for at least one year.</p></div>
      <button class="button" data-route="tell-tro">I want to help test</button>
    </section>`;
}

function membershipPlanCard(plan, cycle) {
  const isAnnual = cycle === "annual";
  const selected = state.membershipInterest === plan.id;
  const price = isAnnual ? plan.annual : plan.monthly;
  const equivalent = isAnnual && plan.annual ? plan.annual / 12 : null;
  return `<article class="plan-card ${plan.featured ? "featured" : ""} ${selected ? "selected" : ""}">
    ${plan.featured ? '<span class="popular-badge">Best for most resellers</span>' : ""}
    <p class="eyebrow">${plan.eyebrow}</p>
    <h2>${plan.name}</h2>
    <p class="plan-copy">${plan.description}</p>
    <div class="plan-price"><strong>${money(price)}</strong><span>/${isAnnual ? "year" : "month"}</span></div>
    ${equivalent ? `<small class="monthly-equivalent">About ${money(equivalent)}/month, billed annually</small>` : '<small class="monthly-equivalent">No credit card required</small>'}
    <ul>${plan.features.map((feature) => `<li><span>✓</span>${feature}</li>`).join("")}</ul>
    <button class="button ${plan.featured ? "" : "secondary"} full" data-plan-interest="${plan.id}">${selected ? "✓ Your choice" : plan.id === "free" ? "Start with Free" : `Choose ${plan.name}`}</button>
  </article>`;
}

function comparisonRow(label, free, seller, pro) {
  return `<tr><th>${label}</th><td>${free}</td><td>${seller}</td><td>${pro}</td></tr>`;
}

function tellTroView() {
  const draft = state.feedbackDraft;
  const screenshot = state.feedbackScreenshot;
  const savedIdeas = state.feedback.filter((item) => item.category === "I have an idea" || item.category === "I want a marketplace added");
  page.innerHTML = `
    ${routeTitle("Tell Tro", "Your experience helps decide what SourceTro fixes, improves, and builds next.")}
    <section class="tell-tro-intro">
      <div class="tell-lens"><span class="tro-orb" data-mood="listening"><i></i></span></div>
      <div><p class="eyebrow">You ask. Tro listens.</p><h2>Help us make reselling easier.</h2><p>Tell us when something is confusing, when something does not work, or when you have an idea that could save resellers time. You can speak or type.</p></div>
      <div class="feedback-count"><strong>${state.feedback.length}</strong><span>Your submission${state.feedback.length === 1 ? "" : "s"}</span></div>
    </section>

    <div class="tell-tro-layout">
      <section class="panel feedback-form-panel">
        <div class="panel-header"><div><p class="eyebrow">Share feedback</p><h2>What would you like Tro to know?</h2></div></div>
        <div class="feedback-category-grid" role="group" aria-label="Feedback type">
          ${["Something isn’t working", "I’m confused", "I have an idea", "I want a marketplace added"].map((category) => `<button class="feedback-category ${draft.category === category ? "active" : ""}" data-feedback-category="${category}"><span>${feedbackCategoryIcon(category)}</span>${category}</button>`).join("")}
        </div>
        <div class="field full feedback-message-field">
          <label for="feedbackMessage">Tell us what happened or what you would like added</label>
          <textarea id="feedbackMessage" data-feedback-bind="message" placeholder="Example: I want Tro to show which marketplace is likely to sell my item fastest.">${esc(draft.message)}</textarea>
          <button class="voice-feedback" data-action="speak-feedback" type="button"><span>●</span> Speak instead of typing</button>
        </div>
        <div class="form-grid feedback-extras">
          <div class="field"><label for="feedbackContact">Email for an update (optional)</label><input id="feedbackContact" type="email" data-feedback-bind="contact" value="${esc(draft.contact)}" placeholder="you@example.com" /></div>
          <div class="field"><label>Screenshot (optional)</label><label class="screenshot-picker"><input id="feedbackScreenshot" type="file" accept="image/*" /><span>${screenshot ? "Replace screenshot" : "＋ Attach screenshot"}</span><small>${screenshot ? esc(screenshot.name) : "PNG, JPG, or a phone screenshot"}</small></label></div>
        </div>
        ${screenshot ? `<div class="screenshot-preview"><img src="${screenshot.url}" alt="Feedback screenshot preview" /><button data-action="remove-feedback-screenshot" aria-label="Remove screenshot">×</button></div>` : ""}
        <div class="feedback-submit-row"><p><strong>Prototype:</strong> submissions are saved on this device until secure member accounts and cloud delivery are connected.</p><button class="button large" data-action="submit-feedback">Send to Tro →</button></div>
      </section>

      <aside class="feedback-promise">
        <p class="eyebrow">The Tro promise</p>
        <h2>Your idea will not disappear into a box.</h2>
        <ol>
          <li><span>1</span><div><strong>Submitted</strong><small>Tro records the idea or problem.</small></div></li>
          <li><span>2</span><div><strong>Reviewed & voted on</strong><small>Resellers help show what matters most.</small></div></li>
          <li><span>3</span><div><strong>Planned or building</strong><small>The roadmap shows its progress.</small></div></li>
          <li><span>4</span><div><strong>Now live</strong><small>“You asked. Tro listened.”</small></div></li>
        </ol>
        <div class="bonus-note">Selected member ideas may receive five bonus Smart Source Scans when memberships launch.</div>
      </aside>
    </div>

    <section class="roadmap-section">
      <div class="section-title"><p class="eyebrow">Customer roadmap</p><h2>Vote on what Tro builds next</h2><p class="muted">The highest vote count is not the only factor, but it helps us understand what would save resellers the most time.</p></div>
      <div class="roadmap-grid">
        ${roadmapIdeas.map((idea) => roadmapCard(idea)).join("")}
        ${savedIdeas.slice(0, 4).map((idea) => roadmapCard({ id: idea.id, title: idea.message, copy: idea.category, status: "Submitted", votes: 1 }, true)).join("")}
      </div>
    </section>

    ${state.feedback.length ? `<section class="panel your-feedback"><div class="panel-header"><div><p class="eyebrow">Saved on this device</p><h2>Your Tell Tro history</h2></div></div><div class="feedback-history">${state.feedback.slice(0, 6).map((item) => `<div><span class="feedback-type-icon">${feedbackCategoryIcon(item.category)}</span><span><strong>${esc(item.category)}</strong><small>${esc(item.message)} · ${new Date(item.createdAt).toLocaleDateString()}${item.screenshotName ? ` · Screenshot: ${esc(item.screenshotName)}` : ""}</small></span><b>Submitted</b></div>`).join("")}</div></section>` : ""}`;
}

function feedbackCategoryIcon(category) {
  if (category.includes("working")) return "!";
  if (category.includes("confused")) return "?";
  if (category.includes("marketplace")) return "⇄";
  return "✦";
}

function roadmapCard(idea, userIdea = false) {
  const voted = Boolean(state.feedbackVotes[idea.id]);
  const totalVotes = Number(idea.votes || 0) + (voted ? 1 : 0);
  const statusClass = idea.status.toLowerCase().replaceAll(" ", "-");
  return `<article class="roadmap-card ${userIdea ? "user-idea" : ""}">
    <div><span class="roadmap-status ${statusClass}">${idea.status}</span>${userIdea ? '<span class="your-idea-label">Your idea</span>' : ""}</div>
    <h3>${esc(idea.title)}</h3><p>${esc(idea.copy)}</p>
    <button class="vote-button ${voted ? "voted" : ""}" data-vote-idea="${idea.id}"><span>▲</span>${totalVotes} vote${totalVotes === 1 ? "" : "s"}${voted ? " · Voted" : ""}</button>
  </article>`;
}

function submitFeedback() {
  const message = state.feedbackDraft.message.trim();
  if (message.length < 8) {
    showToast("Tell Tro a little more so we can understand your feedback.");
    document.querySelector("#feedbackMessage")?.focus();
    return;
  }
  const record = {
    id: `TT-${Date.now()}`,
    category: state.feedbackDraft.category,
    message,
    contact: state.feedbackDraft.contact.trim(),
    screenshotName: state.feedbackScreenshot?.name || "",
    status: "Submitted",
    createdAt: new Date().toISOString(),
  };
  state.feedback.unshift(record);
  saveJSON("sourcetro_feedback", state.feedback);
  if (state.feedbackScreenshot?.url?.startsWith("blob:")) URL.revokeObjectURL(state.feedbackScreenshot.url);
  state.feedbackScreenshot = null;
  state.feedbackDraft = { category: "I have an idea", message: "", contact: "" };
  setTroState("success", "Feedback saved. Thank you!", 2200);
  render();
  showToast("You asked. Tro listened—your feedback is saved.");
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
  if (lower.includes("suggest") || lower.includes("feedback") || lower.includes("idea") || lower.includes("add a marketplace")) return "I want to hear it. Open Tell Tro to speak or type your idea, attach a screenshot, and vote on the customer roadmap. During this prototype, your submission is saved on this device until secure cloud delivery is connected.";
  if (lower.includes("membership") || lower.includes("plan") || lower.includes("29.99") || lower.includes("39.99")) return "SourceTro will launch with Free, Seller at $29.99 a month, and Pro at $39.99 a month. Open Membership to compare the monthly limits and save the plan that interests you. Payments are not open yet.";
  if (lower.includes("worth") || lower.includes("buy") || lower.includes("source")) return "Open Smart Source Scan, add a photo and the store price, and I’ll organize the resale range, estimated fees, shipping, profit, ROI, demand, maximum buy price, and a clear buy-or-pass answer. Live web comparisons will begin after the marketplace search service is connected.";
  if (lower.includes("price")) return "For a strong price suggestion, tell me the brand, item type, condition, and size. In the listing flow, I’ll give you a faster-sale price, recommended price, and higher test price.";
  if (lower.includes("title") || lower.includes("ebay")) return "A strong title starts with Brand + Item Type + Color + Size + important style or material keywords. Open New Listing and I’ll build one from your details.";
  if (lower.includes("today") || lower.includes("start")) return "Start with five easy clothing items from the same storage area. Photograph all five first, then measure and list them one at a time. That keeps you moving without feeling scattered.";
  if (lower.includes("ship")) return "Once an item sells, SourceTro will use the storage bin and SKU to help you find it quickly, then keep the packing and tracking steps together.";
  if (lower.includes("profit") || lower.includes("roi")) return "I can estimate profit and ROI from the expected sale price, your item cost, marketplace fees, and shipping. Smart Source Scan does this before you buy; Finances does it before you accept an offer.";
  return "I can help you decide what to buy, create a listing, choose measurements, write a title and description, estimate profit, organize a storage bin, or plan your next listing session.";
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
  let heard = false;
  button?.classList.add("listening");
  setTroState("listening", "Listening…");
  showToast("Listening… speak naturally.");
  recognition.onresult = (event) => {
    heard = true;
    const words = event.results[0][0].transcript;
    if (typeof target === "string") {
      state.listing[target] = `${state.listing[target] ? `${state.listing[target]} ` : ""}${words}`;
      render();
    } else if (target) {
      target.value = `${target.value ? `${target.value} ` : ""}${words}`;
      const feedbackBound = target.dataset?.feedbackBind;
      if (feedbackBound) state.feedbackDraft[feedbackBound] = target.value;
    }
    setTroState("thinking", "Got it — thinking…", 1400);
  };
  recognition.onerror = () => {
    setTroState("ready", "Ready when you are.");
    showToast("I did not catch that. Please try again.");
  };
  recognition.onend = () => {
    button?.classList.remove("listening");
    if (!heard) setTroState("ready", "Ready when you are.");
  };
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
  if (action === "demo-source") useDemoScan();
  if (action === "open-tro") openTro();
  if (action === "tro-expression") cycleTroExpression();
  if (action === "analyze-source") analyzeSourceScan();
  if (action === "save-scan") saveSourceDecision();
  if (action === "scan-to-listing") scanToListing();
  if (action === "add-finance-record") addFinanceRecord();
  if (action === "export-finances") exportFinanceCsv();
  if (action === "submit-feedback") submitFeedback();
  if (action === "speak-feedback") speakToInput(document.querySelector("#feedbackMessage"), event.target.closest("[data-action]"));
  if (action === "remove-feedback-screenshot") {
    if (state.feedbackScreenshot?.url?.startsWith("blob:")) URL.revokeObjectURL(state.feedbackScreenshot.url);
    state.feedbackScreenshot = null;
    render();
  }
  if (action === "reset-scan") { resetSourceScan(); render(); showToast("Started a clean sourcing scan."); }
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

  const billing = event.target.closest("[data-billing]");
  if (billing) {
    state.billingCycle = billing.dataset.billing;
    render();
  }

  const plan = event.target.closest("[data-plan-interest]");
  if (plan) {
    state.membershipInterest = plan.dataset.planInterest;
    saveJSON("sourcetro_membership_interest", state.membershipInterest);
    render();
    showToast(plan.dataset.planInterest === "free" ? "Free is selected for launch." : `${plan.dataset.planInterest === "seller" ? "Seller" : "Pro"} saved as your preferred launch plan. No payment was taken.`);
  }

  const category = event.target.closest("[data-feedback-category]");
  if (category) {
    state.feedbackDraft.category = category.dataset.feedbackCategory;
    render();
    document.querySelector("#feedbackMessage")?.focus();
  }

  const vote = event.target.closest("[data-vote-idea]");
  if (vote) {
    const id = vote.dataset.voteIdea;
    state.feedbackVotes[id] = !state.feedbackVotes[id];
    saveJSON("sourcetro_feedback_votes", state.feedbackVotes);
    render();
    showToast(state.feedbackVotes[id] ? "Your vote was added." : "Your vote was removed.");
  }
});

document.addEventListener("input", (event) => {
  const bound = event.target.dataset.bind;
  if (bound) state.listing[bound] = event.target.value;
  const scanBound = event.target.dataset.scanBind;
  if (scanBound) {
    state.sourceScan[scanBound] = event.target.value;
    state.sourceResult = null;
  }
  const feedbackBound = event.target.dataset.feedbackBind;
  if (feedbackBound) state.feedbackDraft[feedbackBound] = event.target.value;
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
  const scanBound = event.target.dataset.scanBind;
  if (scanBound) {
    state.sourceScan[scanBound] = event.target.value;
    state.sourceResult = null;
  }

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

  if (event.target.id === "sourcePhotoInput") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (state.sourcePhoto?.url?.startsWith("blob:")) URL.revokeObjectURL(state.sourcePhoto.url);
    state.sourcePhoto = { name: file.name, url: URL.createObjectURL(file) };
    state.sourceResult = null;
    render();
    setTroState("listening", "Photo received — add the store price.", 1800);
    showToast("Photo added. Add the store price, then ask Tro to check it.");
  }

  if (event.target.id === "feedbackScreenshot") {
    const file = event.target.files?.[0];
    if (!file) return;
    if (state.feedbackScreenshot?.url?.startsWith("blob:")) URL.revokeObjectURL(state.feedbackScreenshot.url);
    state.feedbackScreenshot = { name: file.name, url: URL.createObjectURL(file) };
    render();
    showToast("Screenshot attached to your feedback.");
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
  setTroState("thinking", "Thinking…");
  setTimeout(() => {
    messages.insertAdjacentHTML("beforeend", `<div class="message tro-message">${esc(troReply(text))}</div>`);
    messages.scrollTop = messages.scrollHeight;
    setTroState("success", "Answer ready.", 1800);
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
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js?v=6").catch(() => {}));
}

render();
