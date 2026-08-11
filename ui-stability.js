(() => {
  function normalizeButtons(root = document) {
    root.querySelectorAll?.("button:not([type])").forEach((button) => {
      if (button.closest("form") && button.classList.contains("send-button")) return;
      button.type = "button";
      button.style.touchAction = "manipulation";
    });
  }

  function statusToast(message) {
    if (typeof showToast === "function") showToast(message);
  }

  document.addEventListener("click", (event) => {
    const notification = event.target.closest?.("button.notification");
    if (notification) {
      event.preventDefault();
      statusToast("No new SourceTro notifications right now.");
      return;
    }

    const settings = event.target.closest?.('.profile-row button[aria-label="Settings"]');
    if (settings) {
      event.preventDefault();
      statusToast("SourceTro settings are active. Use Personal Mode / Full app here, and Marketplaces for account connections.");
    }
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) normalizeButtons(node);
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  normalizeButtons();
})();
