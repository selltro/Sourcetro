const CACHE = "sourcetro-v48-mobile-stability";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=48",
  "./styles.css?v=48",
  "./mobile-navigation.css?v=48",
  "./trusted-session.js?v=48",
  "./app.js?v=48",
  "./tro-chat.js?v=48",
  "./memory-guard.js?v=48",
  "./ebay-oauth.js?v=48",
  "./ebay-import.js?v=48",
  "./ebay-edit-safety.js?v=48",
  "./seller-workflow.js?v=48",
  "./discovery-scan.js?v=48",
  "./cloud-sync.js?v=48",
  "./sync-recovery.js?v=48",
  "./mobile-inventory-edit.js?v=48",
  "./ui-stability.js?v=48",
  "./pwa-update.js?v=48",
  "./manifest.webmanifest?v=48",
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
          return (await caches.match("./?app=1&v=48")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});