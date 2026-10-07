const CACHE_NAME = "animeart-web-shell-v2";
const APP_SHELL = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./domain/document-operations.mjs",
  "./domain/history.mjs",
  "./domain/image-import.mjs",
  "./domain/image-input.mjs",
  "./domain/model.mjs",
  "./domain/png-export.mjs",
  "./domain/selection.mjs",
  "./domain/viewport.mjs"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match("./index.html"))
  );
});
