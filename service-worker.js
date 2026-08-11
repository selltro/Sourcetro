const CACHE = "sourcetro-v49-mobile-scan-stability";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=49",
  "./styles.css?v=49",
  "./mobile-navigation.css?v=49",
  "./trusted-session.js?v=49",
  "./phone-stability-v49.js?v=49",
  "./app.js?v=49",
  "./tro-chat.js?v=49",
  "./memory-guard.js?v=49",
  "./ebay-oauth.js?v=49",
  "./ebay-import.js?v=49",
  "./ebay-edit-safety.js?v=49",
  "./seller-workflow.js?v=49",
  "./scan-polish-v49.js?v=49",
  "./discovery-scan.js?v=49",
  "./cloud-sync.js?v=49",
  "./sync-recovery.js?v=49",
  "./mobile-inventory-edit.js?v=49",
  "./ui-stability.js?v=49",
  "./pwa-update.js?v=49",
  "./manifest.webmanifest?v=49",
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
          return (await caches.match("./?app=1&v=49")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});