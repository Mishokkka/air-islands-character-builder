const CACHE_NAME = "air-islands-character-builder-1.5.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./core.bundle.js",
  "./zip.bundle.js",
  "./app.js",
  "./mortar-ui.js"
];
const NETWORK_FIRST_SHELL = /\.(?:html|css|js)$/iu;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("air-islands-character-builder-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function keepCacheWriteAlive(event, key, responsePromise) {
  const cacheUpdate = responsePromise
    .then(response => {
      if (!response) return undefined;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then(cache => cache.put(key, copy));
    })
    .catch(() => undefined);
  event.waitUntil(cacheUpdate);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.endsWith("/rules/manifest.json") || url.pathname.endsWith(".flrules")) return;

  const sameOrigin = url.origin === self.location.origin;
  const networkFirst = request.mode === "navigate" || (sameOrigin && NETWORK_FIRST_SHELL.test(url.pathname));
  if (networkFirst) {
    const networkResponse = fetch(request);
    const key = request.mode === "navigate" ? "./index.html" : request;
    keepCacheWriteAlive(event, key, networkResponse);
    event.respondWith(
      networkResponse.catch(() => request.mode === "navigate" ? caches.match("./index.html") : caches.match(request))
    );
    return;
  }

  if (!sameOrigin) return;
  const cachedResponse = caches.match(request);
  const networkResponse = cachedResponse.then(cached => cached ? null : fetch(request));
  keepCacheWriteAlive(event, request, networkResponse);
  event.respondWith(cachedResponse.then(cached => cached || networkResponse));
});
