(() => {
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.('[data-route="source-scan"]');
    if (!button || typeof state === "undefined" || state.route === "source-scan") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (typeof setRoute === "function") setRoute("source-scan");
    document.querySelector("#sourcePhotoInput")?.click();
  }, true);
})();
