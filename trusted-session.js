(() => {
  const BUILD = "48";
  const SESSION_OWNER_KEY = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  try {
    const trusted = localStorage.getItem(TRUSTED_OWNER_KEY) || "";
    const session = sessionStorage.getItem(SESSION_OWNER_KEY) || "";
    if (trusted && !session) sessionStorage.setItem(SESSION_OWNER_KEY, trusted);
  } catch {}

  // app.js still contains an old service-worker registration. Keep every
  // registration pointed at the current build so phones cannot fall back to
  // an older cached SourceTro version.
  if ("serviceWorker" in navigator && typeof navigator.serviceWorker.register === "function") {
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (url, options) => {
      const requested = String(url || "");
      const nextUrl = requested.includes("service-worker.js") ? `service-worker.js?v=${BUILD}` : url;
      return originalRegister(nextUrl, options);
    };
  }
})();