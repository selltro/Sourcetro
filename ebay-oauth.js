(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const HEARTBEAT_MS = 20 * 60 * 1000;
  const MIN_RECHECK_MS = 30 * 1000;

  const ebayStatus = {
    checked: false,
    busy: false,
    connected: false,
    setupReady: false,
    needsReconnect: false,
    policiesChecked: false,
    policiesReady: false,
    locationsChecked: false,
    locationReady: false,
    enabledLocations: 0,
    refreshTokenExpiresAt: null,
    lastCheckedAt: 0,
    error: "",
  };

  let heartbeatTimer = null;

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

  function setTextIfChanged(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  async function gateway(path, options = {}) {
    const key = ownerKey();
    if (!key) throw new Error("SourceTro secure access is not remembered on this device yet.");

    const response = await fetch(`${EBAY_GATEWAY_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": key,
        ...(options.headers || {}),
      },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `eBay connection request failed (${response.status}).`);
      error.details = data;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setLocalConnection(connected) {
    if (typeof state === "undefined") return;
    const changed = Boolean(state.marketplaceConnections?.eBay) !== Boolean(connected);
    state.marketplaceConnections.eBay = Boolean(connected);
    try { saveJSON("sourcetro_connections", state.marketplaceConnections); } catch {}
    if (changed && state.route === "marketplaces") render();
  }

  function decorateEbayCard() {
    const button = document.querySelector('[data-connect-market="eBay"]');
    if (!button) return;

    const card = button.closest(".connect-card");
    const statusNode = card?.querySelector(".connect-status");

    button.classList.remove("secondary");

    if (!ownerKey()) {
      button.disabled = false;
      setTextIfChanged(button, "Restore secure access");
      setTextIfChanged(statusNode, "SourceTro needs its saved device access before it can check eBay");
      statusNode?.classList.remove("connected");
      return;
    }

    if (ebayStatus.busy && !ebayStatus.checked) {
      button.disabled = true;
      setTextIfChanged(button, "Checking eBay…");
      setTextIfChanged(statusNode, "Restoring your saved eBay connection automatically…");
      return;
    }

    if (!ebayStatus.checked) {
      button.disabled = true;
      setTextIfChanged(button, "Checking eBay…");
      setTextIfChanged(statusNode, "Checking your saved Production connection…");
      return;
    }

    if (ebayStatus.connected) {
      const needsLocation = ebayStatus.policiesChecked
        && ebayStatus.policiesReady
        && ebayStatus.locationsChecked
        && !ebayStatus.locationReady;

      if (needsLocation) {
        button.disabled = ebayStatus.busy;
        setTextIfChanged(button, ebayStatus.busy ? "Working…" : "Create ship-from");
        setTextIfChanged(statusNode, "✓ eBay is connected — ship-from location needs setup");
        statusNode?.classList.add("connected");
        return;
      }

      button.disabled = true;
      button.classList.add("secondary");
      setTextIfChanged(button, "Always connected ✓");

      let message = "✓ eBay stays connected automatically";
      if (!ebayStatus.policiesChecked) message = "✓ eBay connected — checking business policies…";
      else if (!ebayStatus.policiesReady) message = "✓ eBay connected — business policies need attention";
      else if (!ebayStatus.locationsChecked) message = "✓ eBay connected — checking ship-from location…";
      else if (ebayStatus.locationReady) message = "✓ eBay ready — SourceTro will renew access automatically";

      setTextIfChanged(statusNode, message);
      statusNode?.classList.add("connected");
      return;
    }

    button.disabled = ebayStatus.busy;
    setTextIfChanged(button, ebayStatus.busy ? "Connecting…" : (ebayStatus.needsReconnect ? "Reconnect eBay" : "Connect eBay"));
    setTextIfChanged(
      statusNode,
      ebayStatus.needsReconnect
        ? "eBay authorization was revoked or expired — one new approval is required"
        : "Connect once; SourceTro will keep the connection renewed automatically"
    );
    statusNode?.classList.remove("connected");
  }

  async function refreshLocations() {
    if (!ebayStatus.connected || !ownerKey() || !ebayStatus.policiesReady) return;
    try {
      const result = await gateway("/ebay/locations", { method: "GET" });
      ebayStatus.locationsChecked = true;
      ebayStatus.locationReady = Boolean(result.ready);
      ebayStatus.enabledLocations = Number(result.enabledCount || 0);
    } catch (error) {
      ebayStatus.error = error.message || "Could not check eBay inventory locations.";
    }
    decorateEbayCard();
  }

  async function refreshPolicies() {
    if (!ebayStatus.connected || !ownerKey()) return;
    try {
      const result = await gateway("/ebay/policies", { method: "GET" });
      ebayStatus.policiesChecked = true;
      ebayStatus.policiesReady = Boolean(result.ready);
      if (!ebayStatus.policiesReady) {
        ebayStatus.locationsChecked = false;
        ebayStatus.locationReady = false;
      }
    } catch (error) {
      ebayStatus.error = error.message || "Could not check eBay business policies.";
    }
    decorateEbayCard();
    if (ebayStatus.policiesReady) refreshLocations();
  }

  async function refreshEbayStatus(force = false) {
    if (ebayStatus.busy || !ownerKey()) {
      decorateEbayCard();
      return;
    }

    if (!force && ebayStatus.lastCheckedAt && Date.now() - ebayStatus.lastCheckedAt < MIN_RECHECK_MS) return;

    const previouslyConnected = ebayStatus.connected || Boolean(state?.marketplaceConnections?.eBay);
    ebayStatus.busy = true;
    decorateEbayCard();

    try {
      const result = await gateway("/status", { method: "GET" });
      ebayStatus.checked = true;
      ebayStatus.lastCheckedAt = Date.now();
      ebayStatus.setupReady = Boolean(result.setupReady);
      ebayStatus.connected = Boolean(result.connected);
      ebayStatus.needsReconnect = Boolean(result.needsReconnect);
      ebayStatus.refreshTokenExpiresAt = result.refreshTokenExpiresAt || null;
      ebayStatus.error = result.error || "";
      setLocalConnection(ebayStatus.connected);
    } catch (error) {
      ebayStatus.checked = true;
      ebayStatus.lastCheckedAt = Date.now();
      ebayStatus.error = error.message || "Could not check eBay connection.";
      // A temporary network failure should not make SourceTro forget a connection
      // that was already confirmed on this device.
      if (previouslyConnected) {
        ebayStatus.connected = true;
        ebayStatus.needsReconnect = false;
      }
    } finally {
      ebayStatus.busy = false;
      decorateEbayCard();
    }

    if (ebayStatus.connected) refreshPolicies();
  }

  async function beginEbayConnect() {
    if (!ownerKey()) {
      if (typeof showToast === "function") showToast("Open SourceTro secure access once on this device. After that, eBay will stay connected automatically.");
      return;
    }

    ebayStatus.busy = true;
    decorateEbayCard();
    try {
      const result = await gateway("/oauth/start", { method: "POST", body: "{}" });
      if (!result.authUrl) throw new Error("eBay did not return a sign-in link.");
      window.location.assign(result.authUrl);
    } catch (error) {
      ebayStatus.busy = false;
      ebayStatus.error = error.message || "Could not start eBay sign-in.";
      decorateEbayCard();
      if (typeof showToast === "function") showToast(ebayStatus.error);
    }
  }

  async function createShipFromLocation() {
    if (!ebayStatus.connected || !ownerKey()) return;
    ebayStatus.busy = true;
    decorateEbayCard();
    try {
      await gateway("/ebay/locations/create", { method: "POST", body: "{}" });
      ebayStatus.busy = false;
      ebayStatus.locationsChecked = false;
      await refreshLocations();
      if (typeof showToast === "function") {
        showToast(ebayStatus.locationReady
          ? "Budget Basket ship-from location is ready on eBay."
          : "eBay received the ship-from setup, but it is not ready yet.");
      }
    } catch (error) {
      ebayStatus.busy = false;
      ebayStatus.error = error.message || "Could not create the eBay ship-from location.";
      decorateEbayCard();
      if (typeof showToast === "function") showToast(ebayStatus.error);
    }
  }

  function scheduleHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) refreshEbayStatus(true);
    }, HEARTBEAT_MS);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-connect-market="eBay"]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const needsLocation = ebayStatus.connected
      && ebayStatus.policiesChecked
      && ebayStatus.policiesReady
      && ebayStatus.locationsChecked
      && !ebayStatus.locationReady;

    if (needsLocation) {
      createShipFromLocation();
      return;
    }

    if (ebayStatus.connected) {
      if (typeof showToast === "function") showToast("eBay is already connected. SourceTro renews access automatically.");
      return;
    }

    beginEbayConnect();
  }, true);

  const observer = new MutationObserver(() => decorateEbayCard());
  if (typeof page !== "undefined" && page) observer.observe(page, { childList: true, subtree: true });

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      decorateEbayCard();
      if (location.hash.replace("#", "") === "marketplaces") refreshEbayStatus(true);
    }, 60);
  });

  window.addEventListener("focus", () => setTimeout(() => refreshEbayStatus(), 250));
  window.addEventListener("online", () => setTimeout(() => refreshEbayStatus(true), 250));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(() => refreshEbayStatus(), 250);
  });

  const params = new URLSearchParams(location.search);
  const oauthResult = params.get("ebay");
  if (oauthResult === "connected") {
    ebayStatus.connected = true;
    ebayStatus.checked = true;
    ebayStatus.setupReady = true;
    ebayStatus.needsReconnect = false;
    ebayStatus.lastCheckedAt = Date.now();
    setLocalConnection(true);
    if (typeof showToast === "function") showToast("eBay is connected. SourceTro will keep it renewed automatically.");
    history.replaceState({}, "", `${location.pathname}${location.hash || "#marketplaces"}`);
  } else if (oauthResult === "declined") {
    if (typeof showToast === "function") showToast("eBay connection was not approved. Nothing was changed.");
    history.replaceState({}, "", `${location.pathname}${location.hash || "#marketplaces"}`);
  }

  setTimeout(() => {
    decorateEbayCard();
    refreshEbayStatus(true);
  }, 350);
  scheduleHeartbeat();
})();
