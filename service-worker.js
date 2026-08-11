const CACHE = "sourcetro-v47-smart-discovery-scan";
const ASSETS = [
  "./",
  "./index.html",
  "./?app=1&v=47",
  "./styles.css?v=47",
  "./mobile-navigation.css?v=47",
  "./trusted-session.js?v=47",
  "./app.js?v=47",
  "./tro-chat.js?v=47",
  "./memory-guard.js?v=47",
  "./ebay-oauth.js?v=47",
  "./ebay-import.js?v=47",
  "./ebay-edit-safety.js?v=47",
  "./seller-workflow.js?v=47",
  "./discovery-scan.js?v=47",
  "./cloud-sync.js?v=47",
  "./sync-recovery.js?v=47",
  "./mobile-inventory-edit.js?v=47",
  "./ui-stability.js?v=47",
  "./pwa-update.js?v=47",
  "./manifest.webmanifest?v=47",
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
          return (await caches.match("./?app=1&v=47")) || (await caches.match("./index.html"));
        }
        return Response.error();
      }),
  );
});
