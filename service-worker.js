const CACHE = "sourcetro-v53-mobile-core";
const APP_START = "./?app=1&v=53";
const SHELL = [
  "./",
  "./index.html",
  APP_START,
  "./manifest.webmanifest?v=53",
  "./styles.css?v=53",
  "./mobile-navigation.css?v=53",
  "./assets/sourcetro-mark.svg",
  "./trusted-session.js?v=53",
  "./phone-stability-v52.js?v=53",
  "./mobile-image-pipeline-v52.js?v=53",
  "./app.js?v=53",
  "./tro-chat.js?v=53",
  "./memory-guard.js?v=53",
  "./ebay-oauth.js?v=53",
  "./ebay-import.js?v=53",
  "./ebay-edit-safety.js?v=53",
  "./seller-workflow.js?v=53",
  "./discovery-scan-v52.js?v=53",
  "./cloud-sync.js?v=53",
  "./sync-recovery.js?v=53",
  "./mobile-inventory-edit.js?v=53",
  "./ui-stability.js?v=53",
  "./pwa-update.js?v=53",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(
      SHELL.map((url) => cache.add(url).catch(() => null)),
    )),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("sourcetro-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(response) {
  return Boolean(response && response.ok && (response.type === "basic" || response.type === "default"));
}

async function cachedFirst(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request, { cache: "no-store" })
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network.then(() => undefined));
    return cached;
  }

  return (await network) || Response.error();
}

async function navigationResponse(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request)
    || await cache.match(APP_START)
    || await cache.match("./index.html")
    || await cache.match("./");

  const network = fetch(request, { cache: "no-store" })
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network.then(() => undefined));
    return cached;
  }

  return (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(navigationResponse(event.request, event));
    return;
  }

  event.respondWith(cachedFirst(event.request, event));
});
