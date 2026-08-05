const page = document.querySelector("#page");
const toast = document.querySelector("#toast");

const SOURCETRO_API_URL = "https://sourcetro-personal-api.selltro.workers.dev";
const OWNER_KEY_STORAGE = "sourcetro_owner_key";
const AI_VERIFIED_STORAGE = "sourcetro_ai_verified";

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
  researchQuery: "",
  comparisonLow: "",
  comparisonHigh: "",
  sourceDecision: "",
  bestMarketplace: "",
  expectedDays: "",
  storageBin: "",
  sku: "",
  marketplaces: ["eBay"],
};

const sourceScanDefaults = {
  journey: "Thinking of buying",
  itemName: "",
  brand: "",
  category: "Women's Clothing",
  condition: "Pre-owned - Good",
  purchasePrice: "",
  shippingCost: "7.50",
  feeRate: "14",
  marketplace: "eBay",
  barcode: "",
  sourceLocation: "",
  verifiedLow: "",
  verifiedMedian: "",
  verifiedHigh: "",
};

const troFitDefaults = {
  monthlyGoal: "500",
  sourcingBudget: "150",
  minimumProfit: "20",
  inventoryLimit: "150",
  sellSpeed: "Within 60 days",
  weeklyHours: "5",
  experience: "Getting started",
  primaryMarketplace: "eBay",
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
      "5 AI-created listing drafts each month",
      "1 marketplace",
      "Store up to 25 inventory items",
      "Talk to Tro and Tell Tro",
    ],
  },
  {
    id: "source",
    name: "Source",
    eyebrow: "For casual sellers",
    monthly: 9.99,
    annual: 99,
    description: "An affordable way to source confidently and turn a small inventory into listings.",
    features: [
      "50 Smart Source Scans each month",
      "25 new items each month",
      "Cross-list to 2 marketplaces",
      "Store up to 100 inventory items",
      "TroFit, TroScore, barcode lookup, and Photo Prep",
      "Voice help and bin tracking",
    ],
  },
  {
    id: "seller",
    name: "Seller",
    eyebrow: "For active resellers",
    monthly: 24.99,
    annual: 249,
    description: "A complete weekly workflow for sourcing, listing, cross-listing, and staying organized.",
    features: [
      "150 Smart Source Scans each month",
      "100 new items each month",
      "Cross-list to 4 marketplaces",
      "Store up to 500 inventory items",
      "150 background removals each month",
      "Auto-delisting, batch tools, and profit reports",
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
      "400 Smart Source Scans each month",
      "All supported marketplaces",
      "Store up to 2,000 inventory items",
      "400 background removals each month",
      "Bulk tools and Dead-Pile Rescue",
      "Advanced analytics, mileage, and tax reports",
      "Automations and priority support",
    ],
  },
];

const roadmapIdeas = [
  { id: "trofit", title: "TroFit + Personal TroScore", copy: "Personalize every sourcing decision to the reseller’s budget, profit goal, time, storage, and marketplace.", status: "Now live", votes: 48 },
  { id: "source-stack", title: "SourceTro Batch Scan", copy: "Photograph several items and organize them into a sourcing or dead-pile queue.", status: "Building", votes: 31 },
  { id: "tro-today", title: "Tro Today", copy: "Get three simple daily actions that move your resale business forward.", status: "Building", votes: 24 },
  { id: "barcode", title: "SourceTro Barcode Lookup", copy: "Use a UPC or model number as another clue for identification and comparisons.", status: "Planned", votes: 34 },
];

const state = {
  route: location.hash.replace("#", "") || "dashboard",
  appMode: loadJSON("sourcetro_app_mode", "personal"),
  wizardStep: 1,
  photos: [],
  listing: { ...listingDefaults },
  generated: false,
  inventory: loadJSON("sourcetro_inventory", []),
  marketplaceConnections: loadJSON("sourcetro_connections", {}),
  sourceScan: { ...sourceScanDefaults },
  sourcePhoto: null,
  sourceResult: null,
  lastAIAnalysis: null,
  troFit: loadJSON("sourcetro_trofit", { ...troFitDefaults }),
  batchItems: [],
  scanHistory: loadJSON("sourcetro_scan_history", []),
  financeRecords: loadJSON("sourcetro_finance_records", []),
  billingCycle: "monthly",
  membershipInterest: loadJSON("sourcetro_membership_interest", "free"),
  feedback: loadJSON("sourcetro_feedback", []),
  feedbackVotes: loadJSON("sourcetro_feedback_votes", {}),
  feedbackDraft: { category: "I have an idea", message: "", contact: "" },
  feedbackScreenshot: null,
  aiOwnerKey: loadSessionValue(OWNER_KEY_STORAGE),
  aiStatus: loadSessionValue(AI_VERIFIED_STORAGE) === "true" ? "connected" : (loadSessionValue(OWNER_KEY_STORAGE) ? "ready" : "locked"),
  aiBusy: false,
  aiError: "",
};

function loadSessionValue(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function saveSessionValue(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // The app still works if private browsing blocks session storage.
  }
}

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

function setAppMode(mode) {
  state.appMode = mode === "full" ? "full" : "personal";
  saveJSON("sourcetro_app_mode", state.appMode);
  state.route = "dashboard";
  location.hash = "dashboard";
  render();
  showToast(state.appMode === "personal" ? "Personal Mode is on. All of your SourceTro work is still here." : "Full SourceTro is open. Personal Mode was not erased.");
}

function applyAppMode() {
  const personal = state.appMode === "personal";
  document.body.classList.toggle("personal-mode", personal);
  document.querySelectorAll("[data-full-only]").forEach((element) => {
    element.hidden = personal;
  });
  const title = document.querySelector("#modeSwitchTitle");
  const note = document.querySelector("#modeSwitchNote");
  const action = document.querySelector("#modeSwitchAction");
  const badge = document.querySelector("#modeBadge");
  if (title) title.textContent = personal ? "Personal Mode" : "Full SourceTro";
  if (note) note.textContent = personal ? "Built for Budget Basket" : "All product features";
  if (action) action.textContent = personal ? "Full app" : "My mode";
  if (badge) badge.textContent = personal ? "Nydia's Personal Mode" : "Full SourceTro";
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
  applyAppMode();
  const routes = {
    dashboard: dashboardView,
    "source-scan": sourceScanView,
    trofit: troFitView,
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
  if (state.appMode === "personal") {
    personalDashboardView();
    return;
  }
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
          ${quickAction("trofit", "◈", "Set my TroFit", "Make every buy-or-pass answer personal")}
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
      ${featureCard("◎", "Source smarter", "TroFit, Personal TroScore, comparison evidence, demand, ROI, and personal buy-or-pass guidance.")}
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

function personalDashboardView() {
  const stats = inventoryStats();
  const deadPileGoal = 150;
  const moved = Math.min(deadPileGoal, state.inventory.length);
  const remaining = Math.max(0, deadPileGoal - moved);
  const ready = state.inventory.filter((item) => item.status === "Ready").length;
  const listed = state.inventory.filter((item) => item.status === "Listed").length;
  const nextActions = [];
  if (stats.drafts) nextActions.push({ route: "inventory", title: `Finish ${Math.min(3, stats.drafts)} draft${stats.drafts === 1 ? "" : "s"}`, note: "Tro will show only the missing details." });
  if (stats.stale) nextActions.push({ route: "inventory", title: `Review ${Math.min(3, stats.stale)} older listing${stats.stale === 1 ? "" : "s"}`, note: "Consider a price change or relist." });
  nextActions.push({ route: "new-listing", title: "List one item from your dead pile", note: "One finished listing is progress." });
  if (nextActions.length < 3) nextActions.push({ route: "source-scan", title: "Check your next sourced item", note: "See the likely profit before you buy." });
  if (nextActions.length < 3) nextActions.push({ route: "finances", title: "Record one sale or expense", note: "Keep your actual profit honest." });

  page.innerHTML = `
    <div class="personal-hero">
      <div>
        <div class="personal-kicker"><span>●</span> Private workspace · Budget Basket</div>
        <h1>Good ${greeting()}, Nydia. What are we selling today?</h1>
        <p>Your simple eBay workflow—source it, list it, find it, sell it, and know what you made.</p>
        <div class="personal-hero-actions">
          <button class="button large" data-route="new-listing">＋ List something I own</button>
          <button class="button secondary large" data-route="source-scan">◎ Check before I buy</button>
        </div>
      </div>
      <div class="personal-lens-wrap">
        <button class="tro-character personal-lens" data-action="tro-expression" data-mood="ready" aria-label="Tro is ready. Tap the lens to preview its color states.">
          <span class="tro-lens-body" aria-hidden="true"><span class="tro-focus-ring"></span><span class="tro-glass"><span class="tro-shine"></span><span class="tro-aperture"></span><span class="tro-core"></span></span></span>
        </button>
        <small class="tro-status" aria-live="polite">Ready when you are.</small>
      </div>
    </div>

    <div class="personal-flow" aria-label="Your SourceTro personal workflow">
      <button data-route="source-scan"><span>1</span><b>Source</b><small>Buy or pass</small></button>
      <i>→</i>
      <button data-route="new-listing"><span>2</span><b>List</b><small>Photos to draft</small></button>
      <i>→</i>
      <button data-route="inventory"><span>3</span><b>Organize</b><small>SKU and bin</small></button>
      <i>→</i>
      <button data-route="orders"><span>4</span><b>Sell</b><small>Order and ship</small></button>
      <i>→</i>
      <button data-route="finances"><span>5</span><b>Profit</b><small>What you made</small></button>
    </div>

    <div class="personal-summary-grid">
      ${statCard("Dead pile moved", `${moved} / ${deadPileGoal}`, `${remaining} items left to process`, "▦")}
      ${statCard("Drafts", stats.drafts, "Listings waiting for you", "✎")}
      ${statCard("Ready for eBay", ready, "Reviewed and ready", "↗")}
      ${statCard("Live / sold", `${listed} / ${stats.sold}`, "Your real selling progress", "✓")}
    </div>

    <div class="personal-main-grid">
      <section class="panel tro-today-panel">
        <div class="panel-header"><div><p class="eyebrow">Tro Today</p><h2>Only three things—not everything</h2><span class="muted">Small actions to help turn your inventory into income.</span></div></div>
        <div class="personal-task-list">
          ${nextActions.slice(0, 3).map((item, index) => `<button data-route="${item.route}"><span>${index + 1}</span><div><strong>${item.title}</strong><small>${item.note}</small></div><b>Start →</b></button>`).join("")}
        </div>
      </section>

      <section class="panel personal-ready-panel">
        <div class="panel-header"><div><p class="eyebrow">Make it real</p><h2>Your connection checklist</h2></div></div>
        <div class="connection-checklist">
          <div class="complete"><span>✓</span><div><strong>Personal workspace</strong><small>Your scans and inventory stay together.</small></div></div>
          <div class="${state.aiStatus === "connected" ? "complete" : ""}"><span>${state.aiStatus === "connected" ? "✓" : "1"}</span><div><strong>${state.aiStatus === "connected" ? "Live AI connected" : "Unlock live AI"}</strong><small>Real photo identification and listing writing.</small></div>${state.aiStatus === "connected" ? "" : '<button data-route="source-scan">Open</button>'}</div>
          <div><span>2</span><div><strong>Connect your eBay</strong><small>Create drafts, publish, and receive sales.</small></div><b>Next</b></div>
          <div><span>3</span><div><strong>Test five real items</strong><small>Then adjust the process to fit how you work.</small></div></div>
        </div>
        <p class="personal-safety-note"><strong>Nothing was erased.</strong> Switch to Full SourceTro anytime to see memberships, customer feedback, and future marketplace features.</p>
      </section>
    </div>
  `;
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

function troFitView() {
  const fit = state.troFit;
  page.innerHTML = `
    ${routeTitle("My TroFit™", "Tell Tro what makes an item worth buying for you—not for an average reseller.")}
    <section class="trofit-hero">
      <div class="trofit-score-preview"><span>◈</span><strong>Personal decisions</strong><small>Your goals shape every TroScore™</small></div>
      <div><p class="eyebrow">SourceTro exclusive</p><h2>The same item should not receive the same answer for everyone.</h2><p>TroFit considers your available cash, desired profit, storage, time, experience, preferred marketplace, and how quickly you want items to sell. After real sales are connected, TroFit will also learn from your own results.</p></div>
    </section>
    <div class="trofit-layout">
      <section class="panel trofit-form">
        <div class="panel-header"><div><p class="eyebrow">Your resale profile</p><h2>What does a good buy look like for you?</h2></div></div>
        <div class="form-grid">
          ${troFitField("monthlyGoal", "Monthly income goal", 'type="number" min="0" step="25" inputmode="decimal"')}
          ${troFitField("sourcingBudget", "Monthly sourcing budget", 'type="number" min="0" step="10" inputmode="decimal"')}
          ${troFitField("minimumProfit", "Minimum profit per item", 'type="number" min="0" step="1" inputmode="decimal"')}
          ${troFitField("inventoryLimit", "Maximum items I can store", 'type="number" min="1" step="1" inputmode="numeric"')}
          ${troFitField("weeklyHours", "Hours I can spend each week", 'type="number" min="1" max="80" step="1" inputmode="numeric"')}
          <div class="field"><label>How quickly should items sell?</label><select data-trofit-bind="sellSpeed">${["Within 30 days", "Within 60 days", "Within 90 days", "I can wait for more profit"].map((x) => `<option ${fit.sellSpeed === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label>Reselling experience</label><select data-trofit-bind="experience">${["Getting started", "Casual seller", "Active reseller", "Full-time reseller"].map((x) => `<option ${fit.experience === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label>Primary marketplace</label><select data-trofit-bind="primaryMarketplace">${["eBay", "Poshmark", "Mercari", "Depop", "Facebook Marketplace"].map((x) => `<option ${fit.primaryMarketplace === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        </div>
        <button class="button large" data-action="save-trofit">Save my TroFit</button>
      </section>
      <aside class="panel trofit-summary">
        <p class="eyebrow">Your current buying rules</p>
        <h2>Tro will look for:</h2>
        <div class="fit-rule"><span>$</span><div><strong>At least ${money(fit.minimumProfit)} profit</strong><small>After estimated fees and shipping</small></div></div>
        <div class="fit-rule"><span>◷</span><div><strong>${esc(fit.sellSpeed)}</strong><small>A speed that fits how quickly you need cash back</small></div></div>
        <div class="fit-rule"><span>▦</span><div><strong>Room for ${esc(fit.inventoryLimit)} items</strong><small>Tro will warn when storage is getting tight</small></div></div>
        <div class="fit-rule"><span>⇄</span><div><strong>${esc(fit.primaryMarketplace)} first</strong><small>Then compare other marketplaces when useful</small></div></div>
        <button class="button secondary full" data-route="source-scan">Use TroFit in Smart Scan →</button>
      </aside>
    </div>
    <section class="panel why-trofit"><div class="panel-header"><div><p class="eyebrow">How Personal TroScore works</p><h2>A transparent answer—not a mystery number</h2></div></div><div class="score-factor-grid">
      ${scoreFactor("Profit fit", "Does the expected net profit meet your rule?")}
      ${scoreFactor("Cash fit", "Does the purchase fit your sourcing budget?")}
      ${scoreFactor("Speed fit", "Is demand strong enough for your timeline?")}
      ${scoreFactor("Space fit", "Is the item worth the storage it will use?")}
      ${scoreFactor("Marketplace fit", "Where should this item perform best?")}
    </div></section>`;
}

function troFitField(name, label, attrs = "") {
  return `<div class="field"><label>${label}</label><input data-trofit-bind="${name}" value="${esc(state.troFit[name])}" ${attrs} /></div>`;
}

function scoreFactor(title, copy) {
  return `<article><span>✓</span><strong>${title}</strong><small>${copy}</small></article>`;
}

function aiConnectionMarkup() {
  if (state.aiStatus === "connected") {
    return `<div class="ai-connection-card connected">
      <span class="ai-connection-icon">✓</span>
      <div><strong>Live Tro AI is connected</strong><small>Your OpenAI key stays encrypted in Cloudflare. This browser tab holds only your separate owner key.</small></div>
      <button class="button ghost" data-action="lock-live-ai">Lock</button>
    </div>`;
  }

  if (state.aiOwnerKey) {
    return `<div class="ai-connection-card ready">
      <span class="ai-connection-icon">◎</span>
      <div><strong>Owner key is ready</strong><small>Your first live item analysis will verify the connection.</small></div>
      <button class="button ghost" data-action="lock-live-ai">Change</button>
    </div>`;
  }

  return `<div class="ai-connection-card ${state.aiError ? "error" : ""}">
    <span class="ai-connection-icon">🔒</span>
    <div class="ai-key-copy"><strong>Unlock live Tro AI on this device</strong><small>Paste the separate <b>SourceTro Owner Key</b> you saved in Edge—not your OpenAI API key.</small>${state.aiError ? `<em>${esc(state.aiError)}</em>` : ""}</div>
    <div class="ai-key-entry"><input id="sourceTroOwnerKey" type="password" autocomplete="current-password" placeholder="SourceTro Owner Key" aria-label="SourceTro Owner Key" /><button class="button" data-action="unlock-live-ai">Unlock</button></div>
  </div>`;
}

function sourceScanView() {
  const scan = state.sourceScan;
  page.innerHTML = `
    ${routeTitle("Resale Workbench", "Show Tro the item once. Research it, evaluate it, and carry it into an SEO-ready listing.", '<button class="button secondary" data-action="reset-scan">Start over</button>')}
    <div class="source-scan-layout">
      <section class="panel source-scan-form">
        <div class="journey-choice" role="group" aria-label="What do you want to do with this item?">
          ${["Thinking of buying", "I already own it"].map((choice) => `<button class="${scan.journey === choice ? "active" : ""}" data-scan-journey="${choice}"><span>${choice === "Thinking of buying" ? "◎" : "＋"}</span><strong>${choice}</strong><small>${choice === "Thinking of buying" ? "Research before spending" : "Research, price, and list it"}</small></button>`).join("")}
        </div>
        ${aiConnectionMarkup()}
        <div class="source-step"><span>1</span><div><h2>Show Tro the item</h2><p class="muted">Take one clear photo. Add the label, model, or brand when you can.</p></div></div>
        <div class="upload-zone source-upload ${state.sourcePhoto ? "has-photo" : ""}">
          <input type="file" id="sourcePhotoInput" accept="image/*" capture="environment" aria-label="Take or upload a sourcing photo" />
          ${state.sourcePhoto
            ? `<img src="${state.sourcePhoto.url}" alt="Item to research" /><button type="button" class="replace-photo">Replace photo</button>`
            : `<div><span class="upload-icon">◎</span><h3>Take a picture or choose a photo</h3><p class="muted">Tro will use this as the starting point for identification.</p><span class="button secondary">Choose photo</span></div>`}
        </div>

        ${state.sourcePhoto ? `<div class="photo-analyze-card ${state.aiError ? "error" : ""}">
          <div><strong>${state.aiBusy ? "Tro is looking at your photo…" : "Your photo is ready"}</strong><small>${state.aiBusy ? "Keep this page open while Tro identifies the item and writes the listing." : "Tap the blue button now. The other details and sold prices are optional and can be added afterward."}</small>${state.aiError ? `<em>${esc(state.aiError)}</em>` : ""}</div>
          <button class="button large" data-action="analyze-source" ${state.aiBusy ? "disabled" : ""}>${state.aiBusy ? "Tro is analyzing…" : "✦ Analyze this photo now"}</button>
        </div>` : ""}

        <div class="source-step details-heading"><span>2</span><div><h2>Add what you know</h2><p class="muted">Tro turns these details into stronger comparison searches and listing keywords.</p></div></div>
        <div class="form-grid">
          ${scanField("itemName", "What is it?", 'placeholder="Example: Levi’s 721 jeans"')}
          ${scanField("brand", "Brand", 'placeholder="Example: Levi’s"')}
          <div class="field barcode-field"><label>Barcode, UPC, or model number (optional)</label><div><input data-scan-bind="barcode" value="${esc(scan.barcode)}" inputmode="numeric" placeholder="Scan or type the number" /><button class="button secondary" data-action="barcode-preview">Look up</button></div></div>
          <div class="field"><label>Category</label><select data-scan-bind="category">${["Women's Clothing", "Men's Clothing", "Kids' Clothing", "Shoes", "Handbags", "Accessories", "Electronics", "Collectibles", "Home", "Other"].map((x) => `<option ${scan.category === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          <div class="field"><label>Condition</label><select data-scan-bind="condition">${["New with tags", "New without tags", "Pre-owned - Excellent", "Pre-owned - Good", "Pre-owned - Fair"].map((x) => `<option ${scan.condition === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          ${scanField("purchasePrice", scan.journey === "Thinking of buying" ? "Store price" : "What you paid", 'type="number" min="0" step=".01" inputmode="decimal" placeholder="12.00"')}
          ${scanField("sourceLocation", "Where did you find it?", 'placeholder="Example: Goodwill Boston Road, yard sale, my closet"')}
          <div class="field"><label>Compare on</label><select data-scan-bind="marketplace">${["eBay", "Poshmark", "Mercari", "Depop", "All marketplaces"].map((x) => `<option ${scan.marketplace === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
          ${scanField("shippingCost", "Estimated shipping cost", 'type="number" min="0" step=".01" inputmode="decimal"')}
          ${scanField("feeRate", "Estimated marketplace fee %", 'type="number" min="0" max="40" step=".1" inputmode="decimal"')}
        </div>

        <div class="source-step details-heading"><span>3</span><div><h2>Check real comparisons</h2><p class="muted">Open a live sold search, then enter the range you see. Tro will use your verified numbers instead of a planning estimate.</p></div></div>
        <div class="research-launch" data-research-launch>
          <div><small>Tro’s comparison search</small><strong data-research-query>${esc(buildResearchQuery(scan)) || "Add an item or brand first"}</strong></div>
          <a class="button secondary ${buildResearchQuery(scan) ? "" : "disabled"}" data-research-link href="${ebaySoldSearchUrl(scan)}" target="_blank" rel="noopener">Search eBay sold items ↗</a>
        </div>
        <div class="form-grid verified-range">
          ${scanField("verifiedLow", "Lowest similar sold", 'type="number" min="0" step=".01" inputmode="decimal" placeholder="Optional"')}
          ${scanField("verifiedMedian", "Typical similar sold", 'type="number" min="0" step=".01" inputmode="decimal" placeholder="Optional"')}
          ${scanField("verifiedHigh", "Highest similar sold", 'type="number" min="0" step=".01" inputmode="decimal" placeholder="Optional"')}
        </div>

        <div class="scan-actions">
          <button class="button large" data-action="analyze-source" ${state.aiBusy ? "disabled" : ""}>${state.aiBusy ? "Tro is analyzing…" : "✦ Analyze photo & build my listing"}</button>
          <button class="button ghost" data-action="demo-source">Try a demo scan</button>
        </div>
        <p class="data-note"><strong>Live AI is ready:</strong> Tro can identify the photographed item, flag details to verify, write an SEO title and description, build comparison words, and carry the work into your listing. Until eBay is connected, you still confirm sold prices from the live eBay search before relying on the profit estimate.</p>
      </section>

      <aside class="source-results" id="sourceResults">
        ${state.sourceResult ? sourceResultMarkup(state.sourceResult) : sourceWaitingMarkup()}
      </aside>
    </div>

    <section class="panel source-tools-panel">
      <div class="panel-header"><div><p class="eyebrow">SourceTro time-savers</p><h2>More ways to start</h2><span class="muted">Original SourceTro workflows inspired by the real problems resellers face.</span></div></div>
      <div class="source-tool-grid">
        <article><span class="source-tool-icon">▦</span><h3>SourceTro Batch Scan</h3><p>Add several photos from a thrift trip or dead pile. Tro organizes a queue and shows what still needs attention.</p><label class="button secondary batch-picker">Add several photos<input id="batchPhotoInput" type="file" accept="image/*" multiple /></label></article>
        <article><span class="source-tool-icon">▥</span><h3>Barcode Lookup</h3><p>Use a UPC, ISBN, or model number as another clue. Live product matching will turn on with the secure lookup service.</p><button class="button secondary" data-action="focus-barcode">Enter a barcode</button></article>
        <article><span class="source-tool-icon">✦</span><h3>Photo Prep</h3><p>Crop, brighten, remove the background, and check photo quality before creating the listing.</p><button class="button secondary" data-route="new-listing">Prepare listing photos</button></article>
        <article><span class="source-tool-icon">◇</span><h3>Authenticity Risk Review</h3><p>Tro flags warning signs and questions to check. It never guarantees authenticity from a photo.</p><button class="button secondary" data-action="risk-review-info">How it protects sellers</button></article>
      </div>
      ${batchQueueMarkup()}
    </section>

    ${state.scanHistory.length ? `
      <section class="panel scan-history">
        <div class="panel-header"><div><h2>Recent sourcing decisions</h2><span class="muted">Saved on this device</span></div></div>
        <div class="history-list">${state.scanHistory.slice(0, 4).map((item) => `<div><span class="decision-dot ${item.tone}"></span><span><strong>${esc(item.identifiedItem)}</strong><small>${item.recommendation} · Store price ${money(item.purchasePrice)}</small></span><b>${money(item.profit)} profit</b></div>`).join("")}</div>
      </section>` : ""}`;
}

function scanField(name, label, attrs = "") {
  return `<div class="field"><label>${label}</label><input data-scan-bind="${name}" value="${esc(state.sourceScan[name])}" ${attrs} /></div>`;
}

function buildResearchQuery(scan = state.sourceScan) {
  if (![scan.brand, scan.itemName, scan.barcode].some(Boolean)) return "";
  return [scan.brand, scan.itemName, scan.barcode, scan.category?.replace(/Women's |Men's |Kids' /, ""), scan.condition?.includes("New") ? "new" : "preowned"]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function ebaySoldSearchUrl(scan = state.sourceScan) {
  const query = buildResearchQuery(scan);
  if (!query) return "#";
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

function batchQueueMarkup() {
  if (!state.batchItems.length) return "";
  return `<div class="batch-queue"><div><strong>${state.batchItems.length} item${state.batchItems.length === 1 ? "" : "s"} in your SourceTro queue</strong><small>Photos are ready for identification. Add an item name or use each one to start a listing.</small></div><div class="batch-thumbs">${state.batchItems.slice(0, 8).map((item, index) => `<button data-batch-item="${index}" title="Use ${esc(item.name)}"><img src="${item.url}" alt="Batch item ${index + 1}" /><span>${index + 1}</span></button>`).join("")}</div></div>`;
}

function sourceWaitingMarkup() {
  const hasPhoto = Boolean(state.sourcePhoto);
  const heading = state.aiBusy
    ? "Tro is analyzing your item…"
    : hasPhoto
      ? "Your photo is ready"
      : state.sourceScan.journey === "Thinking of buying"
        ? "Should you buy it?"
        : "What is the best way to sell it?";
  const copy = state.aiBusy
    ? "Tro is identifying the item, checking what needs verification, and building your SEO listing draft."
    : hasPhoto
      ? "Tap the button below to start the live photo analysis. You can add the price and other details afterward."
      : "Tro will organize the comparison evidence, value, demand, fees, profit, best marketplace, SEO keywords, and the next step.";
  return `<div class="source-waiting">
    <span class="tro-orb" data-mood="${state.aiBusy ? "thinking" : "ready"}"><i></i></span>
    <p class="eyebrow">${state.aiBusy ? "Tro is working" : hasPhoto ? "Photo received" : "Tro is ready"}</p>
    <h2>${heading}</h2>
    <p>${copy}</p>
    ${state.aiError ? `<div class="source-inline-error"><strong>Tro could not finish</strong><span>${esc(state.aiError)}</span></div>` : ""}
    ${hasPhoto && !state.aiBusy ? `<button class="button large waiting-analyze-button" data-action="analyze-source">✦ Analyze this photo now</button>` : ""}
    ${!hasPhoto ? `<div class="decision-preview"><span>Great Buy</span><span>Consider</span><span>Buy below $___</span><span>Pass</span></div>` : ""}
  </div>`;
}

function sourceResultMarkup(result) {
  return `<div class="source-result-card">
    <div class="decision-banner ${result.tone}">
      <small>${state.sourceScan.journey === "Thinking of buying" ? "Tro’s sourcing recommendation" : "Tro’s selling recommendation"}</small>
      <strong>${result.recommendation}</strong>
      <p>${result.reason}</p>
    </div>
    <div class="identified-item">
      <span class="result-lens">◎</span>
      <div><small>${result.aiAssisted ? "Live AI photo analysis" : "Planning estimate"} · ${result.confidence}% confidence</small><h2>${esc(result.identifiedItem)}</h2><p>${esc(result.category)} · ${esc(result.condition)}</p></div>
    </div>
    ${result.aiAssisted && result.aiListing ? `<div class="live-ai-summary">
      <div class="comparison-heading"><h3>Tro’s SEO listing draft</h3><span>Live AI</span></div>
      <strong>${esc(result.aiListing.seo_title)}</strong>
      <p>${esc(result.aiExplanation || result.aiListing.description)}</p>
      ${result.detailsToVerify?.length ? `<small><b>Verify:</b> ${esc(result.detailsToVerify.join(" · "))}</small>` : ""}
    </div>` : ""}
    <div class="personal-score">
      <div class="score-ring" style="--score:${result.troScore}"><strong>${result.troScore}</strong><small>/100</small></div>
      <div><small>Personal TroScore™</small><h3>${result.fitLabel}</h3><p>${result.fitReason}</p></div>
    </div>
    <div class="sold-range">
      <small>${result.verifiedComps ? "Your verified sold range" : "Planning resale range"}</small>
      <strong>${money(result.soldLow)}–${money(result.soldHigh)}</strong>
      <span>Typical value ${money(result.median)} · ${result.marketplace} · ${result.verifiedComps ? "entered from live research" : "not live data"}</span>
    </div>
    <div class="result-metrics">
      ${resultMetric("Estimated profit", money(result.profit))}
      ${resultMetric("Return on investment", `${result.roi}%`)}
      ${resultMetric("Demand / sell-through", `${result.sellThrough}%`)}
      ${resultMetric("Estimated time to sell", `${result.days} days`)}
      ${resultMetric("Maximum buy price", money(result.maxBuy))}
      ${resultMetric("Fees + shipping", money(result.fees + result.shipping))}
    </div>
    <div class="tro-reason-panel">
      <div class="comparison-heading"><h3>Why Tro said it</h3><span>Based on your TroFit</span></div>
      ${result.scoreFactors.map((factor) => `<div class="score-bar"><span>${factor.label}</span><i><b style="width:${factor.value}%"></b></i><strong>${factor.value}</strong></div>`).join("")}
    </div>
    <div class="result-advice-grid">
      <article><small>Best marketplace preview</small><strong>${result.bestMarketplace}</strong><p>${result.marketplaceReason}</p></article>
      <article><small>Offer Guide</small><strong>Try ${money(result.openingOffer)}</strong><p>Do not pay more than ${money(result.maxBuy)} based on your ${money(state.troFit.minimumProfit)} minimum-profit rule.</p></article>
      <article class="risk-${result.riskTone}"><small>Authenticity Risk Review</small><strong>${result.riskLevel}</strong><p>${result.riskCopy}</p></article>
    </div>
    <div class="comparison-preview">
      <div class="comparison-heading"><h3>Comparison evidence</h3><span>${result.verifiedComps ? "Verified by you" : "Research ready"}</span></div>
      <div class="research-evidence"><small>Search words</small><strong>${esc(result.researchQuery)}</strong></div>
      ${result.verifiedComps
        ? `<div><span><strong>Lowest comparable sold</strong><small>Entered from your live research</small></span><b>${money(result.soldLow)}</b></div><div><span><strong>Typical comparable sold</strong><small>Used for Tro’s calculations</small></span><b>${money(result.median)}</b></div><div><span><strong>Highest comparable sold</strong><small>Use only for truly similar condition</small></span><b>${money(result.soldHigh)}</b></div>`
        : result.sampleComps.map((comp) => `<div><span><strong>${esc(comp.title)}</strong><small>${comp.marketplace} · ${comp.condition}</small></span><b>${money(comp.price)}</b></div>`).join("")}
      <a class="button secondary full research-again" href="${result.researchUrl}" target="_blank" rel="noopener">Open live sold comparisons ↗</a>
    </div>
    <div class="result-actions">
      <button class="button full" data-action="scan-to-listing">${state.sourceScan.journey === "Thinking of buying" ? "I bought it—create my listing" : "Create my SEO listing"}</button>
      <button class="button secondary full" data-action="save-scan">Save this decision</button>
    </div>
  </div>`;
}

function resultMetric(label, value) {
  return `<div><small>${label}</small><strong>${value}</strong></div>`;
}

async function analyzeSourceScan() {
  const scan = state.sourceScan;
  if (!state.sourcePhoto && !scan.itemName.trim()) {
    showToast("Add a photo or tell Tro what the item is first.");
    return;
  }

  if (!state.aiOwnerKey) {
    state.aiError = "Enter your SourceTro Owner Key to use the secure AI connection.";
    render();
    document.querySelector("#sourceTroOwnerKey")?.focus();
    showToast("Unlock live Tro AI first. Use the separate owner key you saved in Edge.");
    return;
  }

  state.aiBusy = true;
  state.aiError = "";
  setTroState("thinking", "Looking closely at your item…");
  render();

  try {
    const images = state.sourcePhoto ? [await imageUrlForAI(state.sourcePhoto.url)] : [];
    const verifiedPrices = [scan.verifiedLow, scan.verifiedMedian, scan.verifiedHigh].filter(Boolean).join(" / ");
    const notes = [
      scan.brand && `Seller-entered brand: ${scan.brand}`,
      scan.itemName && `Seller-entered item: ${scan.itemName}`,
      scan.category && `Selected category: ${scan.category}`,
      scan.condition && `Seller-entered condition: ${scan.condition}`,
      scan.barcode && `Barcode or model clue: ${scan.barcode}`,
      scan.sourceLocation && `Sourcing place: ${scan.sourceLocation}`,
      verifiedPrices && `Seller-verified sold prices (low / typical / high): ${verifiedPrices}`,
    ].filter(Boolean).join("\n");

    const response = await fetch(`${SOURCETRO_API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": state.aiOwnerKey,
      },
      body: JSON.stringify({
        mode: scan.journey === "Thinking of buying" ? "sourcing" : "owned",
        purchaseCost: scan.purchasePrice || null,
        targetProfit: state.troFit.minimumProfit || null,
        notes,
        images,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        lockLiveAI();
        throw new Error("That owner key was not accepted. Copy the SourceTro Owner Key from Edge and try again.");
      }
      throw new Error(payload.error || "Tro could not analyze this item. Please try again.");
    }

    state.aiStatus = "connected";
    saveSessionValue(AI_VERIFIED_STORAGE, "true");
    buildSourceResult(payload.analysis);
    setTroState("success", "Live item analysis ready.", 2600);
    showToast("Tro identified the item and created your SEO listing draft.");
  } catch (error) {
    state.aiError = error?.message || "Live AI could not connect. Please try again.";
    setTroState("ready", "Ready when you are.");
    showToast(state.aiError);
  } finally {
    state.aiBusy = false;
    render();
  }
}

function buildSourceResult(aiAnalysis = null) {
  const scan = state.sourceScan;
  const identification = aiAnalysis?.identification || {};
  const research = aiAnalysis?.research || {};
  const evaluation = aiAnalysis?.evaluation || {};
  const aiListing = aiAnalysis?.listing || null;
  if (aiAnalysis) state.lastAIAnalysis = aiAnalysis;

  if (usableAIValue(identification.brand)) scan.brand = identification.brand.trim();
  if (usableAIValue(identification.item_type)) scan.itemName = identification.item_type.trim();
  if (usableAIValue(identification.category)) scan.category = normalizeCategory(identification.category, scan.category);
  if (usableAIValue(identification.condition)) scan.condition = normalizeCondition(identification.condition, scan.condition);

    const itemName = scan.itemName.trim() || state.sourcePhoto?.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Resale item";
    const knownBrand = /levi|nike|coach|patagonia|north face|ralph|lululemon|carhartt|free people/i.test(`${scan.brand} ${itemName}`);
    const categoryBases = { "Women's Clothing": 34, "Men's Clothing": 36, "Kids' Clothing": 22, Shoes: 48, Handbags: 62, Accessories: 28, Electronics: 72, Collectibles: 46, Home: 38, Other: 32 };
    const conditionFactors = { "New with tags": 1.2, "New without tags": 1.1, "Pre-owned - Excellent": 1, "Pre-owned - Good": .88, "Pre-owned - Fair": .64 };
    const base = categoryBases[scan.category] || 34;
    const planningMedian = Math.max(10, Math.round((base + (knownBrand ? 18 : 0)) * (conditionFactors[scan.condition] || .88)));
    const verifiedMedian = Number(scan.verifiedMedian || 0);
    const verifiedLow = Number(scan.verifiedLow || 0);
    const verifiedHigh = Number(scan.verifiedHigh || 0);
    const verifiedComps = Boolean(verifiedMedian || (verifiedLow && verifiedHigh));
    const median = verifiedMedian || (verifiedLow && verifiedHigh ? Math.round((verifiedLow + verifiedHigh) / 2) : planningMedian);
    const soldLow = verifiedLow || Math.max(6, Math.round(median * .78));
    const soldHigh = verifiedHigh || Math.round(median * 1.22);
    const purchasePrice = Number(scan.purchasePrice || 0);
    const shipping = Number(scan.shippingCost || 0);
    const fees = Math.round((median * Number(scan.feeRate || 0) / 100) * 100) / 100;
    const profit = Math.round((median - purchasePrice - shipping - fees) * 100) / 100;
    const roi = purchasePrice > 0 ? Math.round((profit / purchasePrice) * 100) : 0;
    const aiDemand = String(evaluation.demand || "").toLowerCase();
    const demandBase = /high|strong|popular|fast/.test(aiDemand) ? 72 : /low|weak|slow|limited/.test(aiDemand) ? 34 : 52;
    const sellThrough = aiAnalysis
      ? Math.min(88, Math.max(28, demandBase + (knownBrand ? 8 : 0)))
      : Math.min(88, Math.max(28, 49 + (knownBrand ? 24 : 0) + (scan.condition.includes("Excellent") || scan.condition.includes("New") ? 7 : 0)));
    const days = sellThrough >= 70 ? 21 : sellThrough >= 50 ? 38 : 62;
    const targetProfit = Math.max(Number(state.troFit.minimumProfit || 0), 8);
    const maxBuy = Math.max(0, Math.floor(median - fees - shipping - targetProfit));
    const budget = Math.max(Number(state.troFit.sourcingBudget || 0), 1);
    const inventoryLimit = Math.max(Number(state.troFit.inventoryLimit || 1), 1);
    const speedTarget = state.troFit.sellSpeed.includes("30") ? 30 : state.troFit.sellSpeed.includes("60") ? 60 : state.troFit.sellSpeed.includes("90") ? 90 : 120;
    const profitFactor = Math.max(0, Math.min(100, Math.round((profit / Math.max(targetProfit, 1)) * 100)));
    const cashFactor = purchasePrice ? Math.max(0, Math.min(100, Math.round((1 - purchasePrice / budget) * 115))) : 70;
    const speedFactor = Math.max(0, Math.min(100, Math.round((speedTarget / Math.max(days, 1)) * 75)));
    const spaceFactor = Math.max(0, Math.min(100, Math.round((1 - state.inventory.length / inventoryLimit) * 100)));
    const marketplaceFactor = knownBrand ? 88 : scan.marketplace === state.troFit.primaryMarketplace ? 78 : 67;
    const troScore = Math.round(profitFactor * .35 + cashFactor * .15 + speedFactor * .2 + spaceFactor * .1 + marketplaceFactor * .2);
    const bestMarketplace = scan.category.includes("Clothing") || scan.category === "Shoes" ? (knownBrand ? "eBay" : "Poshmark") : scan.category === "Home" ? "Facebook Marketplace" : "eBay";
    const marketplaceReason = bestMarketplace === "eBay" ? "Strong search demand and useful sold-price history for this item type." : bestMarketplace === "Poshmark" ? "A clothing-focused audience may help this item get noticed." : "Local pickup may protect profit on a bulky item.";
    const openingOffer = Math.max(0, Math.floor(Math.min(purchasePrice ? purchasePrice * .8 : maxBuy * .8, maxBuy)));
    const elevatedRisk = /coach|gucci|louis|chanel|prada|rolex|supreme/i.test(`${scan.brand} ${itemName}`) || ["Handbags", "Collectibles"].includes(scan.category);
    const riskLevel = elevatedRisk ? "Review recommended" : "No major photo-based flags";
    const riskTone = elevatedRisk ? "review" : "low";
    const riskCopy = elevatedRisk ? "Check serial details, stitching, hardware, seller history, and professional authentication before relying on the brand name." : "Still verify labels, condition, model details, and seller information before buying.";
    const fitLabel = troScore >= 80 ? "Excellent fit for your goals" : troScore >= 65 ? "Good fit with a few checks" : troScore >= 45 ? "Borderline for your goals" : "Poor fit for your goals";
    const fitReason = `This score uses your ${money(targetProfit)} minimum profit, ${money(budget)} monthly sourcing budget, ${state.troFit.sellSpeed.toLowerCase()} preference, and current inventory space.`;
    let recommendation = scan.journey === "I already own it" ? `LIST NEAR ${money(median)}` : "PASS";
    let tone = "pass";
    let reason = `At ${money(purchasePrice)}, the expected margin is too thin for the time and risk.`;
    if (scan.journey === "I already own it") {
      tone = profit >= targetProfit ? "buy" : profit > 0 ? "consider" : "caution";
      reason = `Start near ${money(median)}, consider offers around ${money(Math.round(median * .9))}, and use ${bestMarketplace} first. Tro will carry the research into your SEO listing.`;
    } else if (!scan.purchasePrice) {
      recommendation = `BUY ONLY BELOW ${money(maxBuy)}`;
      tone = "caution";
      reason = "Enter the store price for a personal buy-or-pass answer. This is Tro’s current maximum target cost.";
    } else if (profit >= targetProfit && troScore >= 72) {
      recommendation = "GREAT BUY";
      tone = "buy";
      reason = `The estimated ${money(profit)} profit meets your personal goal, and the ${troScore}/100 TroScore fits your budget, speed, and storage preferences.`;
    } else if (profit >= targetProfit * .6 && troScore >= 50) {
      recommendation = "WORTH CONSIDERING";
      tone = "consider";
      reason = `The numbers may work, but this falls short of at least one TroFit preference. Review the evidence before buying.`;
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
      confidence: confidencePercent(identification.confidence, state.sourcePhoto ? (knownBrand ? 86 : 74) : 64),
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
      troScore,
      fitLabel,
      fitReason,
      bestMarketplace,
      marketplaceReason,
      openingOffer,
      riskLevel,
      riskTone,
      riskCopy: aiAnalysis
        ? [...(identification.visible_flaws || []), ...(aiAnalysis.warnings || [])].filter(Boolean).slice(0, 3).join(" ") || riskCopy
        : riskCopy,
      verifiedComps,
      researchQuery: usableAIValue(research.ebay_sold_search) ? research.ebay_sold_search : buildResearchQuery(scan),
      researchUrl: usableAIValue(research.ebay_sold_search)
        ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(research.ebay_sold_search)}&LH_Sold=1&LH_Complete=1`
        : ebaySoldSearchUrl(scan),
      sourceLocation: scan.sourceLocation,
      aiAssisted: Boolean(aiAnalysis),
      aiListing,
      aiIdentification: identification,
      detailsToVerify: research.details_to_verify || [],
      aiWarnings: aiAnalysis?.warnings || [],
      aiExplanation: evaluation.explanation || "",
      scoreFactors: [
        { label: "Profit fit", value: profitFactor },
        { label: "Cash fit", value: cashFactor },
        { label: "Speed fit", value: speedFactor },
        { label: "Space fit", value: spaceFactor },
        { label: "Marketplace fit", value: marketplaceFactor },
      ],
      sampleComps: [
        { title: `${scan.brand || "Similar"} ${itemName}`, marketplace: "eBay", condition: "Pre-owned", price: soldLow },
        { title: `${itemName} comparable`, marketplace: scan.marketplace === "All marketplaces" ? "Poshmark" : scan.marketplace, condition: scan.condition, price: median },
        { title: `${scan.brand || "Comparable"} ${scan.category}`, marketplace: "Mercari", condition: "Excellent", price: soldHigh },
      ],
    };
    return state.sourceResult;
}

function usableAIValue(value) {
  const text = String(value || "").trim();
  return Boolean(text && !/^(unknown|unclear|not visible|not provided|n\/a|none)$/i.test(text));
}

function normalizeCategory(value, fallback) {
  const category = String(value || "").toLowerCase();
  if (category.includes("shoe") || category.includes("sneaker") || category.includes("boot")) return "Shoes";
  if (category.includes("handbag") || category.includes("purse") || category.includes("tote")) return "Handbags";
  if (category.includes("accessor")) return "Accessories";
  if (category.includes("electronic")) return "Electronics";
  if (category.includes("collect")) return "Collectibles";
  if (category.includes("home") || category.includes("house")) return "Home";
  if (category.includes("women")) return "Women's Clothing";
  if (/\bmen\b|male/.test(category)) return "Men's Clothing";
  if (category.includes("kid") || category.includes("child") || category.includes("baby")) return "Kids' Clothing";
  if (category.includes("clothing") || category.includes("apparel")) return "Women's Clothing";
  return fallback || "Other";
}

function normalizeCondition(value, fallback) {
  const condition = String(value || "").toLowerCase();
  if (/new.+tag|nwt/.test(condition)) return "New with tags";
  if (/new/.test(condition)) return "New without tags";
  if (/excellent|like new/.test(condition)) return "Pre-owned - Excellent";
  if (/fair|heavy|worn|damage/.test(condition)) return "Pre-owned - Fair";
  if (/good|used|pre.?owned/.test(condition)) return "Pre-owned - Good";
  return fallback || "Pre-owned - Good";
}

function confidencePercent(value, fallback = 70) {
  const text = String(value || "").toLowerCase();
  if (/very high|high/.test(text)) return 90;
  if (/medium|moderate/.test(text)) return 74;
  if (/low/.test(text)) return 52;
  const numeric = Number.parseFloat(text);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(100, numeric <= 1 ? numeric * 100 : numeric)) : fallback;
}

async function imageUrlForAI(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  try {
    const bitmap = await createImageBitmap(blob);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", .84);
  } catch {
    return blobToDataURL(blob);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("SourceTro could not prepare that photo. Try a JPEG or PNG image."));
    reader.readAsDataURL(blob);
  });
}

function unlockLiveAI() {
  const input = document.querySelector("#sourceTroOwnerKey");
  const key = input?.value.trim() || "";
  if (!key) {
    state.aiError = "Paste the SourceTro Owner Key you saved in Edge.";
    render();
    document.querySelector("#sourceTroOwnerKey")?.focus();
    return;
  }
  state.aiOwnerKey = key;
  state.aiStatus = "ready";
  state.aiError = "";
  saveSessionValue(OWNER_KEY_STORAGE, key);
  saveSessionValue(AI_VERIFIED_STORAGE, "");
  render();
  showToast("Owner key ready. Add an item photo and Tro will verify it during the first analysis.");
}

function lockLiveAI() {
  state.aiOwnerKey = "";
  state.aiStatus = "locked";
  saveSessionValue(OWNER_KEY_STORAGE, "");
  saveSessionValue(AI_VERIFIED_STORAGE, "");
}

function useDemoScan() {
  state.sourceScan = { ...sourceScanDefaults, itemName: "721 high rise skinny jeans size 16W", brand: "Levi's", purchasePrice: "12", condition: "Pre-owned - Excellent" };
  state.sourceResult = null;
  state.lastAIAnalysis = null;
  buildSourceResult();
  render();
  showToast("Demo planning estimate loaded. Your real photo uses live Tro AI.");
}

function resetSourceScan() {
  if (state.sourcePhoto?.url?.startsWith("blob:") && !state.sourcePhoto.fromBatch) URL.revokeObjectURL(state.sourcePhoto.url);
  state.sourcePhoto = null;
  state.sourceScan = { ...sourceScanDefaults };
  state.sourceResult = null;
  state.lastAIAnalysis = null;
}

function saveTroFit() {
  saveJSON("sourcetro_trofit", state.troFit);
  setTroState("success", "Your TroFit is saved.", 2200);
  render();
  showToast("TroFit saved. Future Smart Scans will use your personal buying rules.");
}

function previewBarcodeLookup() {
  const barcode = state.sourceScan.barcode.trim();
  if (!barcode) {
    showToast("Enter a UPC, ISBN, or model number first.");
    document.querySelector('[data-scan-bind="barcode"]')?.focus();
    return;
  }
  setTroState("thinking", "Barcode clue received…", 1800);
  showToast(`Barcode ${barcode} saved as an identification clue. Live matching requires the secure lookup connection.`);
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
  const identification = result.aiIdentification || {};
  const aiListing = result.aiListing || null;
  const specifics = Object.fromEntries((aiListing?.item_specifics || []).map((item) => [String(item.name || "").toLowerCase(), item.value || ""]));
  const specific = (...names) => {
    const match = Object.entries(specifics).find(([key]) => names.some((name) => key.includes(name)));
    return match?.[1] || "";
  };
  const priceEvidence = result.verifiedComps
    ? `Seller-verified comparable range: ${money(result.soldLow)}–${money(result.soldHigh)}.`
    : `Planning price range: ${money(result.soldLow)}–${money(result.soldHigh)}; verify sold comparisons before publishing.`;
  state.listing = {
    ...listingDefaults,
    category: result.category,
    itemType: state.sourceScan.itemName || result.identifiedItem,
    brand: state.sourceScan.brand || identification.brand || "",
    size: usableAIValue(identification.size) ? identification.size : specific("size"),
    color: usableAIValue(identification.color) ? identification.color : specific("color"),
    material: specific("material", "fabric"),
    styleModel: usableAIValue(identification.style) ? identification.style : specific("style", "model"),
    condition: result.condition,
    flaws: (identification.visible_flaws || []).join("; "),
    title: aiListing?.seo_title || "",
    description: aiListing?.description || "",
    listPrice: result.median,
    notes: `${result.aiAssisted ? "Tro AI photo analysis" : "Sourcing estimate"}: ${result.recommendation}. ${priceEvidence}${result.aiWarnings?.length ? ` Check: ${result.aiWarnings.join(" ")}` : ""}`,
    itemCost: result.purchasePrice || "",
    sourceLocation: result.sourceLocation || "",
    researchQuery: result.researchQuery,
    comparisonLow: result.soldLow,
    comparisonHigh: result.soldHigh,
    sourceDecision: result.recommendation,
    bestMarketplace: result.bestMarketplace,
    expectedDays: result.days,
    offerPrice: Math.round(result.median * .9),
    lowestPrice: Math.round(result.median * .75),
  };
  if (state.sourcePhoto) {
    state.photos = [state.sourcePhoto];
    state.sourcePhoto = null;
  }
  state.generated = Boolean(aiListing?.seo_title && aiListing?.description);
  state.wizardStep = state.generated ? 4 : (state.photos.length ? 2 : 1);
  setRoute("new-listing");
  showToast(state.generated ? "Tro’s SEO title and description are ready to review." : "Scan details carried into your listing. Nothing needs to be entered twice.");
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
        <p>I’ll draft a search-friendly marketplace title, buyer-focused description, item-specific checklist, measurement section, and three pricing points.</p>
        <button class="button large" data-action="generate-listing">✦ Create my listing</button>
      </div>
      ${wizardFooter("Review listing", true)}`;
  }
  const low = Math.max(8, Number(state.listing.listPrice) - 8);
  const high = Number(state.listing.listPrice) + 10;
  return `
    ${wizardHeader(4, "Tro created your listing", "Review and change anything before you publish.")}
    <div class="ai-results">
      ${seoReviewMarkup()}
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
    ${seoReviewMarkup(true)}
    ${sellingCoachMarkup()}
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

function seoListingReview() {
  const listing = state.listing;
  const clothing = listing.category.includes("Clothing") || listing.category === "Shoes";
  const measurements = [listing.chest, listing.waist, listing.hips, listing.length, listing.inseam, listing.sleeve].filter(Boolean).length;
  const title = listing.title || buildTitle();
  const checks = [
    { label: "Brand + item type", done: Boolean(listing.brand && listing.itemType), tip: "Add the brand and exact product name buyers search." },
    { label: "Strong title length", done: title.length >= 45 && title.length <= 80, tip: "Aim for 45–80 useful characters without filler words." },
    { label: "Size, color, or model", done: Boolean(listing.size && (listing.color || listing.styleModel)), tip: "Add size plus color or model to narrow the search match." },
    { label: "Condition and flaws", done: Boolean(listing.condition && (listing.flaws || listing.notes)), tip: "Describe condition honestly and name any flaw." },
    { label: clothing ? "Buyer measurements" : "Useful specifications", done: clothing ? measurements >= 2 : Boolean(listing.styleModel || listing.material), tip: clothing ? "Add at least two flat-lay measurements." : "Add a model, material, dimensions, or key specifications." },
    { label: "Photo coverage", done: state.photos.length >= 4, tip: "Use at least four clear photos: front, back, label, and condition." },
  ];
  const complete = checks.filter((check) => check.done).length;
  return { score: Math.round((complete / checks.length) * 100), checks, title };
}

function seoReviewMarkup(compact = false) {
  const review = seoListingReview();
  const missing = review.checks.filter((check) => !check.done);
  return `<section class="seo-review ${compact ? "compact" : ""}" data-seo-review>
    <div class="seo-score"><div class="score-ring" style="--score:${review.score}"><strong data-seo-score>${review.score}</strong><small>/100</small></div><div><small>SourceTro SEO Check</small><h3 data-seo-label>${review.score >= 84 ? "Strong and searchable" : review.score >= 67 ? "Good—add a few details" : "Needs a little more detail"}</h3><p>Tro checks the words and details buyers use to find and trust a listing.</p></div></div>
    <div class="seo-check-list" data-seo-checks>${review.checks.map((check) => `<span class="${check.done ? "done" : "missing"}"><b>${check.done ? "✓" : "+"}</b>${check.label}</span>`).join("")}</div>
    ${missing.length && !compact ? `<p class="seo-next"><strong>Best next improvement:</strong> ${esc(missing[0].tip)}</p>` : ""}
  </section>`;
}

function sellingCoachMarkup() {
  const listing = state.listing;
  const market = listing.bestMarketplace || listing.marketplaces[0] || "eBay";
  const floor = listing.lowestPrice || Math.round(Number(listing.listPrice || 0) * .75);
  return `<section class="selling-coach">
    <div><small>Best place to start</small><strong>${esc(market)}</strong><p>${listing.researchQuery ? `Based on the item type and comparison search: ${esc(listing.researchQuery)}.` : "Tro will refine this after comparison research."}</p></div>
    <div><small>Price plan</small><strong>${money(listing.listPrice)} list · ${money(floor)} floor</strong><p>Review after ${listing.expectedDays || 30} days if there are no watchers, offers, or messages.</p></div>
    <div><small>Source record</small><strong>${esc(listing.sourceLocation || "Add the sourcing place below")}</strong><p>Tracking this shows which stores and sourcing places actually make you money.</p></div>
  </section>`;
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
        <button class="${cycle === "annual" ? "active" : ""}" data-billing="annual">Annual <span>Save up to $80</span></button>
      </div>
    </section>

    <div class="plan-grid">
      ${membershipPlans.map((plan) => membershipPlanCard(plan, cycle)).join("")}
    </div>

    <p class="membership-note"><strong>Payments are not open yet.</strong> Choosing a plan now saves your interest on this device while SourceTro completes live scans, marketplace connections, secure accounts, and billing.</p>

    <section class="panel plan-comparison">
      <div class="panel-header"><div><p class="eyebrow">Compare at a glance</p><h2>What changes with each plan</h2></div></div>
      <div class="table-wrap"><table class="comparison-table">
        <thead><tr><th>Feature</th><th>Free</th><th>Source</th><th>Seller</th><th>Pro</th></tr></thead>
        <tbody>
          ${comparisonRow("New items each month", "5 AI drafts", "25", "100", "250")}
          ${comparisonRow("Smart Source Scans", "5", "50", "150", "400")}
          ${comparisonRow("Inventory capacity", "25", "100", "500", "2,000")}
          ${comparisonRow("Marketplace access", "1", "2", "4", "All supported")}
          ${comparisonRow("TroFit & Personal TroScore", "Included", "Included", "Included", "Included")}
          ${comparisonRow("Photo Prep", "Basic", "Included", "150 removals", "400 removals")}
          ${comparisonRow("Auto-delisting", "—", "—", "Included", "Included")}
          ${comparisonRow("Batch Scan & Dead-Pile Rescue", "—", "Preview", "Included", "Priority batch tools")}
          ${comparisonRow("Reports", "Basic inventory", "Basic inventory", "Profit reports", "Advanced, mileage & tax")}
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

function comparisonRow(label, free, source, seller, pro) {
  return `<tr><th>${label}</th><td>${free}</td><td>${source}</td><td>${seller}</td><td>${pro}</td></tr>`;
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
  if (lower.includes("membership") || lower.includes("plan") || lower.includes("9.99") || lower.includes("24.99") || lower.includes("39.99")) return "SourceTro’s planned launch choices are Free, Source at $9.99, Seller at $24.99, and Pro at $39.99 a month. Open Membership to compare limits and save the plan that interests you. Payments are not open yet.";
  if (lower.includes("trofit") || lower.includes("troscore") || lower.includes("personal")) return "Open My TroFit and tell me your budget, minimum profit, available time, storage, and favorite marketplace. Then Smart Scan will give you a Personal TroScore and explain why the item fits—or does not fit—your own goals.";
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
  const journey = event.target.closest("[data-scan-journey]")?.dataset.scanJourney;
  if (journey) {
    state.sourceScan.journey = journey;
    state.sourceResult = null;
    state.lastAIAnalysis = null;
    render();
    return;
  }
  if (action === "toggle-mode") { setAppMode(state.appMode === "personal" ? "full" : "personal"); return; }
  if (action === "unlock-live-ai") { unlockLiveAI(); return; }
  if (action === "lock-live-ai") { lockLiveAI(); state.aiError = ""; render(); showToast("Live AI is locked on this browser tab."); return; }
  if (action === "demo-listing") useDemoListing();
  if (action === "demo-source") useDemoScan();
  if (action === "open-tro") openTro();
  if (action === "tro-expression") cycleTroExpression();
  if (action === "analyze-source") analyzeSourceScan();
  if (action === "save-trofit") saveTroFit();
  if (action === "barcode-preview") previewBarcodeLookup();
  if (action === "focus-barcode") {
    document.querySelector('[data-scan-bind="barcode"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => document.querySelector('[data-scan-bind="barcode"]')?.focus(), 350);
  }
  if (action === "risk-review-info") showToast("Risk Review flags warning signs and recommends professional authentication for high-value items. It never promises an item is genuine from photos alone.");
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

  const batchItem = event.target.closest("[data-batch-item]");
  if (batchItem) {
    const item = state.batchItems[Number(batchItem.dataset.batchItem)];
    if (item) {
      state.sourcePhoto = { ...item, fromBatch: true };
      state.sourceResult = null;
      state.lastAIAnalysis = null;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Batch photo moved into Smart Scan. Add the store price or item details.");
    }
  }

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
    const planName = membershipPlans.find((item) => item.id === plan.dataset.planInterest)?.name || "Plan";
    showToast(plan.dataset.planInterest === "free" ? "Free is selected for launch." : `${planName} saved as your preferred launch plan. No payment was taken.`);
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
  if (bound) {
    state.listing[bound] = event.target.value;
    refreshSeoReview();
  }
  const scanBound = event.target.dataset.scanBind;
  if (scanBound) {
    state.sourceScan[scanBound] = event.target.value;
    if (!isLocalPriceField(scanBound)) {
      state.sourceResult = null;
      state.lastAIAnalysis = null;
    }
    refreshResearchLaunch();
  }
  const feedbackBound = event.target.dataset.feedbackBind;
  if (feedbackBound) state.feedbackDraft[feedbackBound] = event.target.value;
  const troFitBound = event.target.dataset.trofitBind;
  if (troFitBound) state.troFit[troFitBound] = event.target.value;
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

function refreshResearchLaunch() {
  const query = buildResearchQuery();
  const queryNode = document.querySelector("[data-research-query]");
  const link = document.querySelector("[data-research-link]");
  if (queryNode) queryNode.textContent = query || "Add an item or brand first";
  if (link) {
    link.href = ebaySoldSearchUrl();
    link.classList.toggle("disabled", !query);
  }
}

function isLocalPriceField(name) {
  return ["purchasePrice", "shippingCost", "feeRate", "verifiedLow", "verifiedMedian", "verifiedHigh"].includes(name);
}

function refreshSeoReview() {
  const review = seoListingReview();
  document.querySelectorAll("[data-seo-score]").forEach((node) => { node.textContent = review.score; node.closest(".score-ring")?.style.setProperty("--score", review.score); });
  document.querySelectorAll("[data-seo-label]").forEach((node) => { node.textContent = review.score >= 84 ? "Strong and searchable" : review.score >= 67 ? "Good—add a few details" : "Needs a little more detail"; });
  document.querySelectorAll("[data-seo-checks]").forEach((node) => { node.innerHTML = review.checks.map((check) => `<span class="${check.done ? "done" : "missing"}"><b>${check.done ? "✓" : "+"}</b>${check.label}</span>`).join(""); });
}

document.addEventListener("change", (event) => {
  const bound = event.target.dataset.bind;
  if (bound) state.listing[bound] = event.target.value;
  const scanBound = event.target.dataset.scanBind;
  if (scanBound) {
    state.sourceScan[scanBound] = event.target.value;
    if (isLocalPriceField(scanBound) && state.lastAIAnalysis) {
      buildSourceResult(state.lastAIAnalysis);
      render();
      showToast("Price and profit updated without another AI charge.");
    } else {
      state.sourceResult = null;
      state.lastAIAnalysis = null;
    }
    refreshResearchLaunch();
  }
  const troFitBound = event.target.dataset.trofitBind;
  if (troFitBound) state.troFit[troFitBound] = event.target.value;

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
    if (state.sourcePhoto?.url?.startsWith("blob:") && !state.sourcePhoto.fromBatch) URL.revokeObjectURL(state.sourcePhoto.url);
    state.sourcePhoto = { name: file.name, url: URL.createObjectURL(file) };
    state.sourceResult = null;
    state.lastAIAnalysis = null;
    state.aiError = "";
    render();
    setTroState("listening", "Photo received — tap Analyze this photo now.", 1800);
    showToast("Photo added. Tap the blue Analyze this photo now button.");
  }

  if (event.target.id === "batchPhotoInput") {
    const files = [...(event.target.files || [])].slice(0, 20);
    files.forEach((file) => state.batchItems.push({ name: file.name, url: URL.createObjectURL(file) }));
    render();
    showToast(`${files.length} item${files.length === 1 ? "" : "s"} added to your SourceTro Batch Scan queue.`);
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
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js?v=11").catch(() => {}));
}

render();
