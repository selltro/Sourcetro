(() => {
  let installPrompt = null;
  const isStandalone = () => window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  function styles() {
    if (document.querySelector("#sourceTroInstallStyles")) return;
    const style = document.createElement("style");
    style.id = "sourceTroInstallStyles";
    style.textContent = `
      .st-install-button{position:fixed;right:18px;bottom:18px;z-index:9000;border:0;border-radius:999px;padding:12px 17px;background:#173044;color:#fff;font:800 14px/1.1 "DM Sans",sans-serif;box-shadow:0 10px 30px rgba(22,40,58,.28);cursor:pointer}
      .st-install-button span{color:#7bd1ee;margin-right:6px}.st-install-button[hidden]{display:none!important}
      .st-install-overlay{position:fixed;inset:0;z-index:10020;background:rgba(7,19,29,.72);display:grid;place-items:center;padding:18px}.st-install-overlay[hidden]{display:none!important}
      .st-install-card{width:min(100%,460px);background:#fff;border-radius:24px;padding:22px;color:#173044;box-shadow:0 24px 80px rgba(0,0,0,.35)}.st-install-card h2{margin:5px 0 8px}.st-install-card p{color:#64747d;margin:0 0 14px}.st-install-steps{display:grid;gap:10px;margin:16px 0}.st-install-step{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center;background:#f4f8f6;border-radius:14px;padding:11px}.st-install-step b{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#dff2ea;color:#1c664b}.st-install-step strong{display:block}.st-install-step small{display:block;color:#6a7981;margin-top:2px}.st-install-close{width:100%;border:0;border-radius:12px;padding:12px;background:#173044;color:#fff;font-weight:800;cursor:pointer}
      @media(max-width:820px){.st-install-button{bottom:84px;right:12px;padding:11px 14px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if (isStandalone() || document.querySelector("#sourceTroInstallButton")) return;
    styles();
    const button = document.createElement("button");
    button.id = "sourceTroInstallButton";
    button.className = "st-install-button";
    button.type = "button";
    button.innerHTML = "<span>↓</span> Install SourceTro";
    button.addEventListener("click", install);
    document.body.appendChild(button);
  }

  function showGuide() {
    styles();
    let overlay = document.querySelector("#sourceTroInstallOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sourceTroInstallOverlay";
      overlay.className = "st-install-overlay";
      overlay.innerHTML = `<div class="st-install-card" role="dialog" aria-modal="true" aria-labelledby="stInstallTitle">
        <span class="st52-kicker">Add SourceTro to your phone</span>
        <h2 id="stInstallTitle">${isIOS ? "Install on iPhone" : "Install SourceTro"}</h2>
        <p>${isIOS ? "Use Safari for this one-time step." : "Use your browser menu to install the app."}</p>
        <div class="st-install-steps">
          <div class="st-install-step"><b>1</b><div><strong>${isIOS ? "Tap the Share button" : "Open the browser menu"}</strong><small>${isIOS ? "The square with the arrow pointing up." : "Usually the three dots at the top."}</small></div></div>
          <div class="st-install-step"><b>2</b><div><strong>${isIOS ? "Choose Add to Home Screen" : "Choose Install app"}</strong><small>Keep the name SourceTro.</small></div></div>
          <div class="st-install-step"><b>3</b><div><strong>Tap Add</strong><small>Open SourceTro from the new phone icon.</small></div></div>
        </div>
        <button class="st-install-close" type="button">Got it</button>
      </div>`;
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest(".st-install-close")) overlay.hidden = true;
      });
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
  }

  async function install() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") document.querySelector("#sourceTroInstallButton")?.remove();
      installPrompt = null;
      return;
    }
    showGuide();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    ensureUI();
  });
  window.addEventListener("appinstalled", () => document.querySelector("#sourceTroInstallButton")?.remove());
  window.addEventListener("load", ensureUI);
  window.SourceTroInstall = { open: install };
})();