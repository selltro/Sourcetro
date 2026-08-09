(() => {
  const EBAY_GATEWAY_URL = "https://sourcetro-ebay-test.nydia-burgos.workers.dev";
  const OWNER_KEY_STORAGE = "sourcetro_owner_key";

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
    error: "",
  };

  function ownerKey() {
    try {
      return sessionStorage.getItem(OWNER_KEY_STORAGE) || "";
    } catch {
      return "";
    }
  }

  function setTextIfChanged(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  async function gateway(path, options = {}) {
    const response = await fetch(`${EBAY_GATEWAY_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-SourceTro-Key": ownerKey(),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `eBay connection request failed (${response.status}).`);
    }
    return data;
  }

  function setLocalConnection(connected) {
    if (typeof state === "undefined") return;
    const changed = Boolean(state.marketplaceConnections?.eBay) !== Boolean(connected);
    state.marketplaceConnections.eBay = Boolean(connected);
    try {
      saveJSON("sourcetro_connections", state.marketplaceConnections);
    } catch {
      // The live status is still authoritative if local storage is unavailable.
    }
    if (changed && state.route === "marketplaces") render();
  }

  function decorateEbayCard() {
    const button = document.querySelector('[data-connect-market="eBay"]');
    if (!button) return;

    const card = button.closest(".connect-card");
    const statusNode = card?.querySelector(".connect-status");

    if (ebayStatus.busy) {
      button.disabled = true;
      setTextIfChanged(button, ebayStatus.connected ? "Checking…" : "Connecting…");
      setTextIfChanged(statusNode, "Contacting eBay securely…");
      return;
    }

    button.disabled = false;

    if (!ownerKey()) {
      setTextIfChanged(button, "Connect eBay");
      setTextIfChanged(statusNode, "Unlock SourceTro secure access first");
      return;
    }

    if (!ebayStatus.checked) {
      setTextIfChanged(button, "Connect eBay");
      setTextIfChanged(statusNode, "Checking Production connection…");
      return;
    }

    if (!ebayStatus.setupReady) {
      setTextIfChanged(button, "Finish setup");
      setTextIfChanged(statusNode, "eBay gateway needs its Cloudflare settings");
      return;
    }

    if (ebayStatus.connected) {
      setTextIfChanged(button, "Disconnect");
      button.classList.add("secondary");
      if (statusNode) {
        let message = "✓ Connected to eBay Production";
        if (!ebayStatus.policiesChecked) {
          message = "✓ Connected to eBay Production — checking business policies…";
        } else if (!ebayStatus.policiesReady) {
          message = "✓ eBay connected — business policies need attention";
        } else if (!ebayStatus.locationsChecked) {
          message = "✓ Business policies ready — checking ship-from location…";
        } else if (ebayStatus.locationReady) {
          message = "✓ eBay ready — policies and ship-from location confirmed";
        } else {
          message = "✓ eBay connected — ship-from location needed";
        }
        setTextIfChanged(statusNode, message);
        statusNode.classList.add("connected");
      }
      return;
    }

    setTextIfChanged(button, ebayStatus.needsReconnect ? "Reconnect eBay" : "Connect eBay");
    button.classList.remove("secondary");
    if (statusNode) {
      setTextIfChanged(
        statusNode,
        ebayStatus.needsReconnect
          ? "Authorization expired or was revoked — reconnect"
          : "Secure Production OAuth connection ready"
      );
      statusNode.classList.remove("connected");
    }
  }

  async function refreshLocations() {
    if (!ebayStatus.connected || !ownerKey() || !ebayStatus.policiesReady) return;
    try {
      const result = await gateway("/ebay/locations", { method: "GET" });
      ebayStatus.locationsChecked = true;
      ebayStatus.locationReady = Boolean(result.ready);
      ebayStatus.enabledLocations = Number(result.enabledCount || 0);
    } catch (error) {
      ebayStatus.locationsChecked = true;
      ebayStatus.locationReady = false;
      ebayStatus.enabledLocations = 0;
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
      ebayStatus.policiesChecked = true;
      ebayStatus.policiesReady = false;
      ebayStatus.locationsChecked = false;
      ebayStatus.locationReady = false;
      ebayStatus.error = error.message || "Could not check eBay business policies.";
    }
    decorateEbayCard();
    if (ebayStatus.policiesReady) refreshLocations();
  }

  async function refreshEbayStatus() {
    if (ebayStatus.busy) return;
    if (!ownerKey()) {
      ebayStatus.checked = true;
      ebayStatus.connected = false;
      decorateEbayCard();
      return;
    }

    ebayStatus.busy = true;
    decorateEbayCard();
    try {
      const result = await gateway("/status", { method: "GET" });
      ebayStatus.checked = true;
      ebayStatus.setupReady = Boolean(result.setupReady);
      ebayStatus.connected = Boolean(result.connected);
      ebayStatus.needsReconnect = Boolean(result.needsReconnect);
      ebayStatus.error = result.error || "";
      setLocalConnection(ebayStatus.connected);
    } catch (error) {
      ebayStatus.checked = true;
      ebayStatus.connected = false;
      ebayStatus.error = error.message || "Could not check eBay connection.";
    } finally {
      ebayStatus.busy = false;
      decorateEbayCard();
    }

    if (ebayStatus.connected) refreshPolicies();
  }

  async function beginEbayConnect() {
    if (!ownerKey()) {
      showToast("Unlock SourceTro's secure connection first, then connect eBay.");
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
      showToast(ebayStatus.error);
    }
  }

  async function disconnectEbay() {
    const confirmed = window.confirm("Disconnect eBay from SourceTro on this account?");
    if (!confirmed) return;

    ebayStatus.busy = true;
    decorateEbayCard();
    try {
      await gateway("/disconnect", { method: "POST", body: "{}" });
      ebayStatus.checked = true;
      ebayStatus.connected = false;
      ebayStatus.needsReconnect = false;
      ebayStatus.policiesChecked = false;
      ebayStatus.policiesReady = false;
      ebayStatus.locationsChecked = false;
      ebayStatus.locationReady = false;
      ebayStatus.enabledLocations = 0;
      setLocalConnection(false);
      showToast("eBay disconnected from SourceTro.");
    } catch (error) {
      showToast(error.message || "Could not disconnect eBay.");
    } finally {
      ebayStatus.busy = false;
      decorateEbayCard();
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-connect-market="eBay"]');
    if (!button) return;

    // Intercept the prototype toggle in app.js so the eBay button now performs
    // the real Production OAuth connection instead of only changing local state.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (ebayStatus.connected) disconnectEbay();
    else beginEbayConnect();
  }, true);

  const observer = new MutationObserver(() => decorateEbayCard());
  observer.observe(page, { childList: true, subtree: true });

  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      decorateEbayCard();
      if (location.hash.replace("#", "") === "marketplaces") refreshEbayStatus();
    }, 50);
  });

  const params = new URLSearchParams(location.search);
  const oauthResult = params.get("ebay");
  if (oauthResult === "connected") {
    ebayStatus.connected = true;
    ebayStatus.checked = true;
    ebayStatus.setupReady = true;
    setLocalConnection(true);
    showToast("eBay Production is connected to SourceTro.");
    history.replaceState({}, "", `${location.pathname}${location.hash || "#marketplaces"}`);
  } else if (oauthResult === "declined") {
    showToast("eBay connection was not approved. Nothing was changed.");
    history.replaceState({}, "", `${location.pathname}${location.hash || "#marketplaces"}`);
  }

  setTimeout(() => {
    decorateEbayCard();
    refreshEbayStatus();
  }, 700);
})();
