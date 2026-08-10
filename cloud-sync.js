(() => {
  const API_URL = "https://sourcetro-personal-api.nydia-burgos.workers.dev";
  const SESSION_OWNER_KEY = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const SYNC_REVISION_KEY = "sourcetro_sync_revision";
  const SYNC_UPDATED_KEY = "sourcetro_sync_updated_at";
  const SYNC_DIRTY_KEY = "sourcetro_sync_dirty";
  const SYNC_KEYS = [
    "sourcetro_app_mode",
    "sourcetro_inventory",
    "sourcetro_connections",
    "sourcetro_trofit",
    "sourcetro_scan_history",
    "sourcetro_finance_records",
    "sourcetro_membership_interest",
    "sourcetro_feedback",
    "sourcetro_feedback_votes",
  ];

  let pushTimer = null;
  let syncing = false;
  let applyingRemote = false;
  let originalSaveJSON = null;

  function readLocal(key) {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  }

  function writeLocal(key, value) {
    try {
      if (value === null || value === undefined || value === "") localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {}
  }

  function readSession(key) {
    try { return sessionStorage.getItem(key) || ""; } catch { return ""; }
  }

  function writeSession(key, value) {
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch {}
  }

  function ownerKey() {
    return readLocal(TRUSTED_OWNER_KEY) || readSession(SESSION_OWNER_KEY);
  }

  function rememberOwnerKey(key) {
    const clean = String(key || "").trim();
    if (!clean) return false;
    writeLocal(TRUSTED_OWNER_KEY, clean);
    writeSession(SESSION_OWNER_KEY, clean);
    if (typeof state !== "undefined") {
      state.aiOwnerKey = clean;
      if (state.aiStatus === "locked") state.aiStatus = "ready";
    }
    return true;
  }

  function hydrateTrustedDevice() {
    const persistent = readLocal(TRUSTED_OWNER_KEY);
    const session = readSession(SESSION_OWNER_KEY);
    const key = persistent || session;
    if (!key) return false;

    if (!persistent && session) writeLocal(TRUSTED_OWNER_KEY, session);
    if (!session) writeSession(SESSION_OWNER_KEY, key);

    if (typeof state !== "undefined") {
      const wasLocked = !state.aiOwnerKey;
      state.aiOwnerKey = key;
      if (state.aiStatus === "locked") state.aiStatus = "ready";
      if (wasLocked && typeof render === "function") render();
    }
    return true;
  }

  function parseStoredJSON(key, fallback) {
    const raw = readLocal(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function snapshot() {
    const data = {};
    for (const key of SYNC_KEYS) {
      const raw = readLocal(key);
      if (!raw) continue;
      try { data[key] = JSON.parse(raw); } catch {}
    }
    return data;
  }

  function meaningfulCount(data = {}) {
    let score = 0;
    const inventory = data.sourcetro_inventory;
    const scans = data.sourcetro_scan_history;
    const finances = data.sourcetro_finance_records;
    const feedback = data.sourcetro_feedback;
    const connections = data.sourcetro_connections;
    const trofit = data.sourcetro_trofit;

    if (Array.isArray(inventory)) score += inventory.length * 100;
    if (Array.isArray(scans)) score += scans.length * 10;
    if (Array.isArray(finances)) score += finances.length * 10;
    if (Array.isArray(feedback)) score += feedback.length * 5;
    if (connections && typeof connections === "object") score += Object.values(connections).filter(Boolean).length;
    if (trofit && typeof trofit === "object" && Object.keys(trofit).length) score += 1;
    return score;
  }

  function applyDataToState(data) {
    if (typeof state === "undefined") return;
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_app_mode")) state.appMode = data.sourcetro_app_mode || "personal";
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_inventory")) state.inventory = Array.isArray(data.sourcetro_inventory) ? data.sourcetro_inventory : [];
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_connections")) state.marketplaceConnections = data.sourcetro_connections && typeof data.sourcetro_connections === "object" ? data.sourcetro_connections : {};
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_trofit")) state.troFit = data.sourcetro_trofit && typeof data.sourcetro_trofit === "object" ? data.sourcetro_trofit : state.troFit;
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_scan_history")) state.scanHistory = Array.isArray(data.sourcetro_scan_history) ? data.sourcetro_scan_history : [];
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_finance_records")) state.financeRecords = Array.isArray(data.sourcetro_finance_records) ? data.sourcetro_finance_records : [];
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_membership_interest")) state.membershipInterest = data.sourcetro_membership_interest || "free";
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_feedback")) state.feedback = Array.isArray(data.sourcetro_feedback) ? data.sourcetro_feedback : [];
    if (Object.prototype.hasOwnProperty.call(data, "sourcetro_feedback_votes")) state.feedbackVotes = data.sourcetro_feedback_votes && typeof data.sourcetro_feedback_votes === "object" ? data.sourcetro_feedback_votes : {};
  }

  function applyRemotePayload(payload) {
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
    applyingRemote = true;
    try {
      for (const key of SYNC_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        writeLocal(key, JSON.stringify(data[key]));
      }
      applyDataToState(data);
      writeLocal(SYNC_REVISION_KEY, Number(payload.revision || 0));
      writeLocal(SYNC_UPDATED_KEY, payload.updatedAt || "");
      writeLocal(SYNC_DIRTY_KEY, "");
    } finally {
      applyingRemote = false;
    }
    if (typeof render === "function") render();
  }

  async function syncRequest(path, options = {}) {
    const key = ownerKey();
    if (!key) throw new Error("SourceTro is locked on this device.");
    const response = await fetch(`${API_URL}${path}`, {
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
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `SourceTro sync failed (${response.status}).`);
    return body;
  }

  async function pullCloud() {
    if (syncing || !ownerKey()) return;
    syncing = true;
    try {
      const cloud = await syncRequest("/sync", { method: "GET" });
      const localData = snapshot();
      const localScore = meaningfulCount(localData);
      const cloudData = cloud?.data && typeof cloud.data === "object" ? cloud.data : {};
      const cloudScore = meaningfulCount(cloudData);
      const localRevision = Number(readLocal(SYNC_REVISION_KEY) || 0);
      const cloudRevision = Number(cloud.revision || 0);
      const dirty = readLocal(SYNC_DIRTY_KEY) === "1";

      // Never let a brand-new/empty device erase a populated device.
      if (!cloud.found) {
        if (localScore > 0) await pushCloud(true);
        return;
      }

      // If one side clearly has the user's real data and the other side is empty,
      // automatically keep the populated side as the source of truth.
      if (localScore > 0 && cloudScore === 0) {
        await pushCloud(true);
        return;
      }
      if (cloudScore > 0 && localScore === 0) {
        applyRemotePayload(cloud);
        return;
      }

      if (!dirty && cloudRevision > localRevision) {
        applyRemotePayload(cloud);
      } else if (dirty) {
        await pushCloud(true);
      } else if (!localRevision && cloudScore > 0) {
        applyRemotePayload(cloud);
      }
    } catch (error) {
      console.warn("SourceTro cloud sync unavailable:", error?.message || error);
    } finally {
      syncing = false;
    }
  }

  async function pushCloud(force = false) {
    if ((!force && syncing) || !ownerKey() || applyingRemote) return;
    const wasSyncing = syncing;
    syncing = true;
    try {
      const result = await syncRequest("/sync", {
        method: "POST",
        body: JSON.stringify({
          data: snapshot(),
          deviceUpdatedAt: new Date().toISOString(),
        }),
      });
      writeLocal(SYNC_REVISION_KEY, Number(result.revision || 0));
      writeLocal(SYNC_UPDATED_KEY, result.updatedAt || "");
      writeLocal(SYNC_DIRTY_KEY, "");
    } catch (error) {
      writeLocal(SYNC_DIRTY_KEY, "1");
      console.warn("SourceTro cloud save unavailable:", error?.message || error);
    } finally {
      syncing = wasSyncing;
    }
  }

  function schedulePush() {
    if (!ownerKey() || applyingRemote) return;
    writeLocal(SYNC_DIRTY_KEY, "1");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushCloud(), 900);
  }

  function wrapSaveJSON() {
    if (typeof saveJSON !== "function" || originalSaveJSON) return;
    originalSaveJSON = saveJSON;
    saveJSON = function syncedSaveJSON(key, value) {
      const result = originalSaveJSON(key, value);
      if (SYNC_KEYS.includes(key)) schedulePush();
      return result;
    };
  }

  function captureUnlock() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest('[data-action="unlock-live-ai"]');
      if (!button) return;
      const input = document.querySelector("#sourceTroOwnerKey");
      const key = input?.value?.trim() || "";
      if (!key) return;

      queueMicrotask(() => {
        if (!rememberOwnerKey(key)) return;
        wrapSaveJSON();
        setTimeout(() => {
          pullCloud();
          if (typeof showToast === "function") showToast("This device is remembered. SourceTro will keep your app data synced.");
        }, 80);
      });
    }, true);
  }

  function currentDataSummary() {
    const inventory = parseStoredJSON("sourcetro_inventory", []);
    const finances = parseStoredJSON("sourcetro_finance_records", []);
    return {
      inventoryItems: Array.isArray(inventory) ? inventory.length : 0,
      financeRecords: Array.isArray(finances) ? finances.length : 0,
      revision: Number(readLocal(SYNC_REVISION_KEY) || 0),
      updatedAt: readLocal(SYNC_UPDATED_KEY) || null,
      remembered: Boolean(readLocal(TRUSTED_OWNER_KEY)),
    };
  }

  window.SourceTroCloud = {
    syncNow: () => pushCloud(true),
    refreshFromCloud: () => pullCloud(),
    forgetDevice: () => {
      writeLocal(TRUSTED_OWNER_KEY, "");
      writeSession(SESSION_OWNER_KEY, "");
      if (typeof state !== "undefined") {
        state.aiOwnerKey = "";
        state.aiStatus = "locked";
        if (typeof render === "function") render();
      }
    },
    status: currentDataSummary,
  };

  hydrateTrustedDevice();
  wrapSaveJSON();
  captureUnlock();

  setTimeout(() => {
    if (ownerKey()) pullCloud();
  }, 450);

  window.addEventListener("online", () => pullCloud());
  window.addEventListener("pageshow", () => {
    hydrateTrustedDevice();
    if (ownerKey()) setTimeout(() => pullCloud(), 120);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && readLocal(SYNC_DIRTY_KEY) === "1") pushCloud(true);
  });
})();