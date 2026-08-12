(() => {
  const SESSION_OWNER_KEY = "sourcetro_owner_key";
  const TRUSTED_OWNER_KEY = "sourcetro_trusted_owner_key";

  function restoreTrustedSession() {
    try {
      const trusted = localStorage.getItem(TRUSTED_OWNER_KEY) || "";
      const session = sessionStorage.getItem(SESSION_OWNER_KEY) || "";
      if (trusted && !session) sessionStorage.setItem(SESSION_OWNER_KEY, trusted);
    } catch {}
  }

  restoreTrustedSession();
  window.addEventListener("pageshow", restoreTrustedSession);
})();
