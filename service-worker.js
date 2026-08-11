const CACHE = "sourcetro-v37-local-overrides";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=37",
  "./styles.css?v=37",
  "./app.js?v=37",
  "./memory-guard.js?v=37",
  "./ebay-oauth.js?v=37",
  "./local-item-overrides.js?v=37",
  "./ebay-import.js?v=37",
  "./ebay-edit-safety.js?v=37",
  "./cloud-sync.js?v=37",
  "./sync-recovery.js?v=37",
  "./mobile-inventory-edit.js?v=37",
  "./ebay-local-fields.js?v=37",
  "./pwa-update.js?v=37",
  "./manifest.webmanifest?v=37",
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
          return (await caches.match("./?app=1&v=37")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
