(() => {
  const REFRESH_MS = 6000;
  let timer = null;

  async function refresh() {
    if (document.visibilityState !== "visible") return;
    if (!window.SourceTroCloud?.refreshFromCloud) return;
    try {
      await window.SourceTroCloud.refreshFromCloud();
    } catch {}
  }

  function start() {
    clearInterval(timer);
    timer = setInterval(refresh, REFRESH_MS);
  }

  window.addEventListener("focus", () => setTimeout(refresh, 100));
  window.addEventListener("pageshow", () => setTimeout(refresh, 150));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(refresh, 100);
  });

  setTimeout(refresh, 900);
  start();
})();