const CACHE = "sourcetro-v40-stability";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=40",
  "./styles.css?v=40",
  "./app.js?v=40",
  "./trusted-session.js?v=40",
  "./memory-guard.js?v=40",
  "./ebay-oauth.js?v=40",
  "./ebay-import.js?v=40",
  "./ebay-edit-safety.js?v=40",
  "./cloud-sync.js?v=40",
  "./sync-recovery.js?v=40",
  "./mobile-inventory-edit.js?v=40",
  "./ui-stability.js?v=40",
  "./pwa-update.js?v=40",
  "./manifest.webmanifest?v=40",
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
          return (await caches.match("./?app=1&v=40")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
