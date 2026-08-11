(() => {
  const BUILD = "41";
  const SW_URL = `service-worker.js?v=${BUILD}`;
  const RELOAD_MARKER = `sourcetro_sw_reloaded_${BUILD}`;

  function standalone() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  }

  function normalizeInstalledUrl() {
    if (!standalone()) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") === BUILD && url.searchParams.get("app") === "1") return;
    url.searchParams.set("app", "1");
    url.searchParams.set("v", BUILD);
    history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash || "#dashboard"}`);
  }

  async function refreshCloud() {
    if (!window.SourceTroCloud?.refreshFromCloud) return;
    try {
      await window.SourceTroCloud.refreshFromCloud();
    } catch {}
  }

  async function registerLatestWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "./",
        updateViaCache: "none",
      });
      await registration.update();
    } catch (error) {
      console.warn("SourceTro update check unavailable:", error?.message || error);
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      try {
        if (sessionStorage.getItem(RELOAD_MARKER) === "1") return;
        sessionStorage.setItem(RELOAD_MARKER, "1");
      } catch {}
      window.location.reload();
    });
  }

  normalizeInstalledUrl();

  window.addEventListener("load", () => {
    registerLatestWorker();
    setTimeout(refreshCloud, 1200);
  });

  window.addEventListener("focus", () => setTimeout(refreshCloud, 350));
  window.addEventListener("online", () => setTimeout(refreshCloud, 350));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(refreshCloud, 350);
  });
})();
