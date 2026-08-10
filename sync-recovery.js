(() => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("sync");
  if (!['master', 'pull'].includes(mode)) return;

  const SESSION_OWNER_KEY = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";
  const SYNC_REVISION_KEY = "sourcetro_sync_revision";
  const SYNC_DIRTY_KEY = "sourcetro_sync_dirty";

  let completed = false;
  let attempts = 0;

  function read(storage, key) {
    try { return storage.getItem(key) || ""; } catch { return ""; }
  }

  function ownerReady() {
    return Boolean(read(localStorage, TRUSTED_OWNER_KEY) || read(sessionStorage, SESSION_OWNER_KEY));
  }

  function toast(message) {
    if (typeof showToast === "function") showToast(message);
  }

  async function runRecovery() {
    if (completed || !window.SourceTroCloud || !ownerReady()) return false;
    completed = true;

    if (mode === "master") {
      const before = window.SourceTroCloud.status();
      if (!before.inventoryItems) {
        completed = false;
        toast("SourceTro is waiting for the computer inventory before cloud upload.");
        return false;
      }

      await window.SourceTroCloud.syncNow();
      setTimeout(() => {
        const after = window.SourceTroCloud.status();
        toast(`Computer inventory sent to SourceTro Cloud: ${after.inventoryItems} item${after.inventoryItems === 1 ? "" : "s"}.`);
      }, 350);
      return true;
    }

    try {
      localStorage.setItem(SYNC_REVISION_KEY, "0");
      localStorage.removeItem(SYNC_DIRTY_KEY);
    } catch {}

    await window.SourceTroCloud.refreshFromCloud();
    setTimeout(() => {
      const after = window.SourceTroCloud.status();
      if (after.inventoryItems > 0) {
        toast(`Phone synced from SourceTro Cloud: ${after.inventoryItems} inventory item${after.inventoryItems === 1 ? "" : "s"}.`);
      } else {
        toast("No cloud inventory was found yet. Keep this page open and try the computer upload once more.");
      }
    }, 500);
    return true;
  }

  const timer = setInterval(async () => {
    attempts += 1;
    const done = await runRecovery();
    if (done || attempts >= 40) clearInterval(timer);
  }, 750);

  setTimeout(runRecovery, 250);
})();
