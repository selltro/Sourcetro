(() => {
  const SESSION_KEY = "sourcetro_owner_key";
  const TRUSTED_KEY = "sourcetro_trusted_owner_key";
  const AI_VERIFIED_KEY = "sourcetro_ai_verified";

  function remember(key) {
    if (!key) return;
    try {
      sessionStorage.setItem(SESSION_KEY, key);
      localStorage.setItem(TRUSTED_KEY, key);
    } catch {}
  }

  function forget() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(AI_VERIFIED_KEY);
      localStorage.removeItem(TRUSTED_KEY);
    } catch {}
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-action]")?.dataset?.action;
    if (action === "unlock-live-ai") {
      remember(document.querySelector("#sourceTroOwnerKey")?.value?.trim() || "");
    }
    if (action === "lock-live-ai") forget();
  }, true);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const url = String(args[0]?.url || args[0] || "");
      if (response.status === 401 && url.includes("sourcetro-personal-api.")) forget();
    } catch {}
    return response;
  };

  try {
    const trusted = localStorage.getItem(TRUSTED_KEY) || "";
    const session = sessionStorage.getItem(SESSION_KEY) || "";
    if (trusted && !session) sessionStorage.setItem(SESSION_KEY, trusted);
  } catch {}
})();