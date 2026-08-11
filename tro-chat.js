(() => {
  const API_URL = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const HISTORY_KEY = "sourcetro_tro_chat_history";
  const MAX_HISTORY = 30;
  let busy = false;

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

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch {}
  }

  function remember(role, content) {
    const history = readHistory();
    history.push({ role, content: String(content || "").slice(0, 3000), at: new Date().toISOString() });
    writeHistory(history);
  }

  function messagesNode() {
    return document.querySelector("#troMessages");
  }

  function appendMessage(role, text, pending = false) {
    const messages = messagesNode();
    if (!messages) return null;
    const node = document.createElement("div");
    node.className = `message ${role === "user" ? "user-message" : "tro-message"}`;
    if (pending) node.dataset.troPending = "true";
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function restoreHistory() {
    const messages = messagesNode();
    if (!messages || messages.dataset.liveHistoryReady === "true") return;
    messages.dataset.liveHistoryReady = "true";
    const history = readHistory().slice(-10);
    for (const entry of history) appendMessage(entry.role, entry.content);
  }

  function compactListing(listing = {}) {
    const fields = [
      "id", "ebayItemId", "title", "description", "category", "itemType", "brand", "size",
      "color", "condition", "material", "styleModel", "flaws", "notes", "chest", "waist",
      "hips", "length", "inseam", "sleeve", "rise", "listPrice", "offerPrice", "lowestPrice",
      "itemCost", "sourceLocation", "storageBin", "sku", "status",
    ];
    const result = {};
    for (const key of fields) {
      const value = listing?.[key];
      if (value !== undefined && value !== null && value !== "") result[key] = value;
    }
    return result;
  }

  function buildContext() {
    if (typeof state === "undefined") return {};
    const inventory = Array.isArray(state.inventory) ? state.inventory : [];
    const listed = inventory.filter((item) => item.status === "Listed").length;
    const drafts = inventory.filter((item) => item.status === "Draft").length;
    const ready = inventory.filter((item) => item.status === "Ready").length;
    const sold = inventory.filter((item) => item.status === "Sold").length;
    const recentInventory = inventory.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      brand: item.brand,
      category: item.category,
      size: item.size,
      condition: item.condition,
      listPrice: item.listPrice,
      status: item.status,
      ebayItemId: item.ebayItemId,
    }));

    const context = {
      route: state.route,
      appMode: state.appMode,
      inventorySummary: { total: inventory.length, listed, drafts, ready, sold },
      recentInventory,
    };

    if (state.route === "new-listing" && state.listing) context.currentListing = compactListing(state.listing);
    if (state.sourceScan) {
      context.currentSourceScan = {
        journey: state.sourceScan.journey,
        itemName: state.sourceScan.itemName,
        brand: state.sourceScan.brand,
        category: state.sourceScan.category,
        condition: state.sourceScan.condition,
        purchasePrice: state.sourceScan.purchasePrice,
        marketplace: state.sourceScan.marketplace,
      };
    }
    if (state.troFit) context.troFit = state.troFit;
    return context;
  }

  function setBusy(value) {
    busy = value;
    const form = document.querySelector("#troForm");
    const send = form?.querySelector('button[type="submit"]');
    if (send) {
      send.disabled = value;
      send.setAttribute("aria-busy", value ? "true" : "false");
    }
  }

  async function liveReply(message) {
    const key = ownerKey();
    if (!key) {
      throw new Error("Tro needs SourceTro secure access on this device before live answers can work.");
    }

    const history = readHistory()
      .slice(-12)
      .filter((entry) => entry.role === "user" || entry.role === "assistant")
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": key,
      },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({
        message,
        history,
        context: buildContext(),
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Tro's live chat service is not deployed yet.");
      }
      throw new Error(result.error || `Tro could not answer (${response.status}).`);
    }

    const answer = String(result.answer || "").trim();
    if (!answer) throw new Error("Tro did not return an answer. Please try again.");
    return answer;
  }

  async function handleSubmit(event) {
    if (busy) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    const input = document.querySelector("#troInput");
    const message = String(input?.value || "").trim();
    if (!message) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    appendMessage("user", message);
    remember("user", message);
    input.value = "";
    setBusy(true);
    if (typeof setTroState === "function") setTroState("thinking", "Thinking…");
    const pending = appendMessage("assistant", "Tro is thinking…", true);

    try {
      const answer = await liveReply(message);
      pending?.remove();
      appendMessage("assistant", answer);
      remember("assistant", answer);
      if (typeof setTroState === "function") setTroState("success", "Answer ready.", 1800);
    } catch (error) {
      pending?.remove();
      const fallback = typeof troReply === "function" ? troReply(message) : "";
      const errorText = String(error?.message || "Tro could not answer right now.");
      const answer = fallback
        ? `${fallback}\n\nLive Tro note: ${errorText}`
        : errorText;
      appendMessage("assistant", answer);
      if (typeof setTroState === "function") setTroState("ready", "Ready when you are.");
    } finally {
      setBusy(false);
      input?.focus?.();
    }
  }

  const form = document.querySelector("#troForm");
  if (form) form.addEventListener("submit", handleSubmit, true);

  window.addEventListener("pageshow", restoreHistory);
  document.querySelector("#openTroFromSidebar")?.addEventListener("click", () => setTimeout(restoreHistory, 0));
  document.querySelector("#voiceQuickAction")?.addEventListener("click", () => setTimeout(restoreHistory, 0));
  document.querySelector("#mobileTro")?.addEventListener("click", () => setTimeout(restoreHistory, 0));
  setTimeout(restoreHistory, 100);

  window.SourceTroChat = {
    ask: liveReply,
    history: readHistory,
    clearHistory: () => writeHistory([]),
  };
})();
