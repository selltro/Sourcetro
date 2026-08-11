(() => {
  const BUILD = "51";
  const SESSION_KEY = "sourcetro_owner_key";
  const TRUSTED_KEY = "sourcetro_trusted_owner_key";

  function rememberSecureAccess() {
    try {
      const session = sessionStorage.getItem(SESSION_KEY) || "";
      const trusted = localStorage.getItem(TRUSTED_KEY) || "";
      if (session && session !== trusted) localStorage.setItem(TRUSTED_KEY, session);
      if (!session && trusted) sessionStorage.setItem(SESSION_KEY, trusted);
    } catch {}
  }

  function closeMobileMenu() {
    document.querySelector("#sidebar")?.classList.remove("open");
  }

  rememberSecureAccess();
  closeMobileMenu();
  window.addEventListener("pageshow", () => { rememberSecureAccess(); closeMobileMenu(); });
  window.addEventListener("focus", rememberSecureAccess);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") rememberSecureAccess();
  });

  if ("serviceWorker" in navigator && typeof navigator.serviceWorker.register === "function") {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (url, options) => {
      const requested = String(url || "");
      const nextUrl = requested.includes("service-worker.js") ? `service-worker.js?v=${BUILD}` : url;
      return originalRegister(nextUrl, { ...(options || {}), updateViaCache: "none" });
    };
  }

  if ("caches" in window) {
    window.addEventListener("load", () => {
      caches.keys().then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("sourcetro-") && !key.includes(`v${BUILD}-`))
          .map((key) => caches.delete(key)),
      )).catch(() => {});
    }, { once: true });
  }

  const lowMemory = Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory) <= 4;
  if (lowMemory) document.documentElement.classList.add("sourcetro-low-memory");
  window.SourceTroPhone = { build: BUILD, lowMemoryMode: lowMemory || /Android/i.test(navigator.userAgent) };
})();
