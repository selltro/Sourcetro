const CACHE = "sourcetro-v45-mobile-navigation";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=45",
  "./styles.css?v=45",
  "./mobile-navigation.css?v=45",
  "./trusted-session.js?v=45",
  "./app.js?v=45",
  "./tro-chat.js?v=45",
  "./memory-guard.js?v=45",
  "./ebay-oauth.js?v=45",
  "./ebay-import.js?v=45",
  "./ebay-edit-safety.js?v=45",
  "./seller-workflow.js?v=45",
  "./cloud-sync.js?v=45",
  "./sync-recovery.js?v=45",
  "./mobile-inventory-edit.js?v=45",
  "./ui-stability.js?v=45",
  "./pwa-update.js?v=45",
  "./manifest.webmanifest?v=45",
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
          return (await caches.match("./?app=1&v=45")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
