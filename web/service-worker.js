const CACHE_NAME = "animeart-web-shell-v56";
const APP_SHELL = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./asset-library.js",
  "./appearance-settings.js",
  "./domain/asset-library.mjs",
  "./domain/creative-catalog.mjs",
  "./manifest.webmanifest",
  "./icons/animeart-mark.svg",
  "./assets/kapiart-mascot.png",
  "./service-worker.js",
  "./assets/cc0-detailed-anime-character.png.base64",
  "./assets/ASSET_SOURCES.md",
  "./domain/document-operations.mjs",
  "./domain/history.mjs",
  "./domain/image-import.mjs",
  "./domain/image-input.mjs",
  "./domain/image-processing.mjs",
  "./domain/crop-shape.mjs",
  "./domain/color-replacement.mjs",
  "./domain/anime-color-studio.mjs",
  "./domain/image-processing-client.mjs",
  "./workers/image-processing-worker.mjs",
  "./domain/canvas-space.mjs",
  "./domain/touch-gestures.mjs",
  "./domain/layer-adjustments.mjs",
  "./domain/quick-edit-recipes.mjs",
  "./domain/guided-editing.mjs",
  "./domain/background-removal.mjs",
  "./domain/background-removal-profiles.mjs",
  "./domain/text-layer.mjs",
  "./domain/model.mjs",
  "./domain/png-export.mjs",
  "./domain/project-file.mjs",
  "./domain/selection.mjs",
  "./domain/viewport.mjs",
  "./domain/frame-scheduler.mjs",
  "./domain/stroke-smoothing.mjs",
  "./domain/freehand-rendering.mjs",
  "./domain/canvas-rendering.mjs"
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
