const CACHE = "sourcetro-v46-persistent-ebay-session";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=46",
  "./styles.css?v=46",
  "./mobile-navigation.css?v=46",
  "./trusted-session.js?v=46",
  "./app.js?v=46",
  "./tro-chat.js?v=46",
  "./memory-guard.js?v=46",
  "./ebay-oauth.js?v=46",
  "./ebay-import.js?v=46",
  "./ebay-edit-safety.js?v=46",
  "./seller-workflow.js?v=46",
  "./cloud-sync.js?v=46",
  "./sync-recovery.js?v=46",
  "./mobile-inventory-edit.js?v=46",
  "./ui-stability.js?v=46",
  "./pwa-update.js?v=46",
  "./manifest.webmanifest?v=46",
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
          return (await caches.match("./?app=1&v=46")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
