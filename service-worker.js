const CACHE = "sourcetro-v44-seller-workflow";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=44",
  "./styles.css?v=44",
  "./trusted-session.js?v=44",
  "./app.js?v=44",
  "./tro-chat.js?v=44",
  "./memory-guard.js?v=44",
  "./ebay-oauth.js?v=44",
  "./ebay-import.js?v=44",
  "./ebay-edit-safety.js?v=44",
  "./seller-workflow.js?v=44",
  "./cloud-sync.js?v=44",
  "./sync-recovery.js?v=44",
  "./mobile-inventory-edit.js?v=44",
  "./ui-stability.js?v=44",
  "./pwa-update.js?v=44",
  "./manifest.webmanifest?v=44",
  "./assets/sourcetro-mark.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
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
          return (await caches.match("./?app=1&v=44")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
