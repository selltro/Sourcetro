(() => {
  function polishScanLens() {
    document.querySelectorAll(".st-lens").forEach((lens) => {
      lens.className = "tro-orb st-v49-lens";
      lens.dataset.mood = "ready";
      lens.innerHTML = "<i></i>";
    });
  }

  function resetWithoutOpeningCamera() {
    if (typeof resetSourceScan === "function") resetSourceScan();
    if (typeof render === "function") render();
    setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 20);
  }

  document.addEventListener("click", (event) => {
    const scanRoute = event.target.closest?.('[data-route="source-scan"]');
    if (scanRoute) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (typeof state !== "undefined" && state.route !== "source-scan" && typeof setRoute === "function") setRoute("source-scan");
      setTimeout(polishScanLens, 60);
      return;
    }

    const again = event.target.closest?.('[data-discovery-action="again"]');
    if (again) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      resetWithoutOpeningCamera();
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .st-v49-lens{display:inline-flex!important;width:112px!important;height:112px!important;margin:0 auto 16px!important;transform:none!important;box-shadow:0 0 0 8px rgba(85,188,231,.12),0 0 26px rgba(85,188,231,.35)!important}
    @media(max-width:820px){.st-v49-lens{width:104px!important;height:104px!important}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.(".st-lens") || node.querySelector?.(".st-lens"))))) polishScanLens();
  });
  if (typeof page !== "undefined" && page) observer.observe(page, { childList: true, subtree: true });
  window.addEventListener("pageshow", () => setTimeout(polishScanLens, 60));
  window.addEventListener("hashchange", () => setTimeout(polishScanLens, 60));
  setTimeout(polishScanLens, 80);
})();
