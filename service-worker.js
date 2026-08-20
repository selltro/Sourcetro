const CACHE = "sourcetro-v73-photo-fallback";
const APP_START = "./?app=1&v=73";
const SHELL = [
  "./",
  "./index.html",
  APP_START,
  "./manifest.webmanifest?v=73",
  "./styles.css?v=73",
  "./mobile-navigation.css?v=73",
  "./assets/sourcetro-mark.svg",
  "./trusted-session.js?v=73",
  "./phone-stability-v52.js?v=73",
  "./mobile-image-pipeline-v52.js?v=73",
  "./app.js?v=73",
  "./tro-chat.js?v=73",
  "./memory-guard.js?v=73",
  "./ebay-oauth.js?v=73",
  "./ebay-import.js?v=73",
  "./ebay-edit-safety.js?v=73",
  "./seller-workflow.js?v=73",
  "./discovery-scan-v52.js?v=73",
  "./cloud-sync.js?v=73",
  "./sync-recovery.js?v=73",
  "./mobile-inventory-edit.js?v=73",
  "./ui-stability.js?v=73",
  "./secure-access-v56.js?v=73",
  "./install-app.js?v=73",
  "./pwa-update.js?v=73",
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
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("sourcetro-") && key !== CACHE).map((key) => caches.delete(key)),
      ))
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

async function navigationResponse(request) {
  const cache = await caches.open(CACHE);

  // Navigations must be network-first. Older SourceTro workers returned their
  // cached app shell before checking the network, which could trap an installed
  // phone on an old build even when the URL requested a newer ?v= value.
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (cacheable(response)) {
      cache.put(request, response.clone()).catch(() => {});
      cache.put("./index.html", response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match(request))
      || (await cache.match(APP_START))
      || (await cache.match("./index.html"))
      || (await cache.match("./"))
      || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(navigationResponse(event.request));
    return;
  }

  event.respondWith(cachedFirst(event.request, event));
});
