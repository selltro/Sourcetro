const CACHE = "sourcetro-v50-low-memory-phone-scan";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=50",
  "./styles.css?v=50",
  "./mobile-navigation.css?v=50",
  "./trusted-session.js?v=50",
  "./phone-stability-v50.js?v=50",
  "./mobile-image-pipeline-v50.js?v=50",
  "./app.js?v=50",
  "./tro-chat.js?v=50",
  "./memory-guard.js?v=50",
  "./ebay-oauth.js?v=50",
  "./ebay-import.js?v=50",
  "./ebay-edit-safety.js?v=50",
  "./seller-workflow.js?v=50",
  "./scan-polish-v49.js?v=50",
  "./discovery-scan.js?v=50",
  "./cloud-sync.js?v=50",
  "./sync-recovery.js?v=50",
  "./mobile-inventory-edit.js?v=50",
  "./ui-stability.js?v=50",
  "./pwa-update.js?v=50",
  "./manifest.webmanifest?v=50",
  "./assets/sourcetro-mark.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return (await caches.match("./?app=1&v=50")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
