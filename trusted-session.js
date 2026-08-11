(() => {
  const BUILD = "40";
  const SESSION_OWNER_KEY = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  try {
    const trusted = localStorage.getItem(TRUSTED_OWNER_KEY) || "";
    const session = sessionStorage.getItem(SESSION_OWNER_KEY) || "";
    if (trusted && !session) sessionStorage.setItem(SESSION_OWNER_KEY, trusted);
  } catch {}

  if ("serviceWorker" in navigator && typeof navigator.serviceWorker.register === "function") {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (url, options) => {
      const requested = String(url || "");
      const nextUrl = requested.startsWith("service-worker.js") ? `service-worker.js?v=${BUILD}` : url;
      return originalRegister(nextUrl, options);
    };
  }
})();
