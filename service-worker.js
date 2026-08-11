const CACHE = "sourcetro-v43-live-tro-chat";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=43",
  "./styles.css?v=43",
  "./trusted-session.js?v=43",
  "./app.js?v=43",
  "./tro-chat.js?v=43",
  "./memory-guard.js?v=43",
  "./ebay-oauth.js?v=43",
  "./ebay-import.js?v=43",
  "./ebay-edit-safety.js?v=43",
  "./cloud-sync.js?v=43",
  "./sync-recovery.js?v=43",
  "./mobile-inventory-edit.js?v=43",
  "./ui-stability.js?v=43",
  "./pwa-update.js?v=43",
  "./manifest.webmanifest?v=43",
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
          return (await caches.match("./?app=1&v=43")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
