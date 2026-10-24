import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("T045 Web offline shell is wired without creating a second editor runtime", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  const manifest = await readFile("manifest.webmanifest", "utf8");
  const worker = await readFile("service-worker.js", "utf8");

  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(worker, /animeart-web-shell-v70/);
  assert.match(worker, /caches\.open/);
  assert.match(worker, /caches\.match/);
  assert.match(app, /layerAdjustmentsToCanvasFilter/);
  assert.match(worker, /\.\/domain\/layer-adjustments\.mjs/);
  assert.match(worker, /\.\/domain\/text-layer\.mjs/);
  assert.match(worker, /\.\/domain\/guided-editing\.mjs/);
  assert.ok(worker.includes("./assets/cc0-detailed-anime-character.png.base64"));
  assert.ok(worker.includes("./assets/ASSET_SOURCES.md"));
  assert.ok(worker.includes("./asset-library.js"));
  assert.ok(worker.includes("./domain/anime-style-library.mjs"));
  assert.ok(worker.includes("./appearance-settings.js"));
  assert.ok(worker.includes("./domain/asset-library.mjs"));
  assert.ok(worker.includes("./domain/quick-edit-recipes.mjs"));
  assert.ok(worker.includes("./domain/image-processing-client.mjs"));
  assert.ok(worker.includes("./workers/image-processing-worker.mjs"));
  assert.match(app, /runImageProcessing\("replace-color-range"/);
  assert.match(app, /runImageProcessing\("remove-connected-background"/);
  assert.match(app, /runImageProcessing\("apply-erase-strokes"/);
  assert.ok(worker.includes("./domain/touch-gestures.mjs"));
  assert.ok(app.includes('"./domain/touch-gestures.mjs"'));
  assert.ok(worker.includes("./domain/background-removal.mjs"));
  assert.ok(worker.includes("./domain/color-replacement.mjs"));
  assert.match(html, /id="recolor-image"/);
  assert.match(html, /id="recolor-dialog"/);
  assert.match(app, /preserveShading:\s*document\.querySelector\("#recolor-preserve-shading"\)\.checked/);
  assert.match(html, /id="remove-background"/);
  assert.match(html, /id="background-removal-dialog"/);
  assert.match(html, /id="poster-template-dialog"/);
  assert.match(html, /class="mobile-touch-dock"/);
  assert.match(html, /id="open-asset-library"/);
  assert.doesNotMatch(app + worker, /DocumentManager|LayerManager|CanvasManager|RendererManager|ViewportManager|HistoryManager|PersistenceManager/);
});


test("export toolbar offers PNG, JPEG and WebP with quality and JPEG background controls", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(html, /id="export-format"/);
  assert.match(html, /id="export-resolution"/);
  assert.match(html, /id="mobile-export-resolution"/);
  assert.match(app, /exportScaleForResolution/);
  assert.match(exporter, /export function exportScaleForResolution/);
  assert.match(html, /value="png"/);
  assert.match(html, /value="jpeg"/);
  assert.match(html, /value="webp"/);
  assert.match(html, /id="export-quality"/);
  assert.match(html, /id="export-background"/);
  assert.match(app, /canvasToImageBlob\(exportCanvas, format, quality\)/);
  assert.match(app, /format === "jpeg"/);
  assert.match(exporter, /export function canvasToImageBlob/);
  assert.match(exporter, /export function downloadImageBlob/);
});


test("project file import and export reuse the existing document and persistence boundaries", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  const worker = await readFile("service-worker.js", "utf8");
  assert.match(html, /id="export-project"/);
  assert.match(html, /id="import-project"/);
  assert.match(html, /id="project-file-input"/);
  assert.match(app, /serializeProjectFile\(state\.document\)/);
  assert.match(app, /parseProjectFile\(await file\.text\(\)\)/);
  assert.match(app, /persistDocumentSnapshot\(localStorage, "animeart-web-document", imported\)/);
  assert.match(app, /state\.history\.reset\(imported\)/);
  assert.match(worker, /\.\/domain\/project-file\.mjs/);
});


test("image editing crop/resize module is included in the offline editor shell", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  const worker = await readFile("service-worker.js", "utf8");
  assert.match(html, /id="crop-resize-image"/);
  assert.match(html, /id="image-edit-dialog"/);
  assert.match(html, /id="image-crop-x"/);
  assert.match(html, /id="image-resize-keep-aspect"/);
  assert.match(app, /cropImageSource/);
  assert.match(app, /resizeImageSource/);
  assert.match(app, /replaceImageLayer/);
  assert.match(worker, /\.\/domain\/image-processing\.mjs/);
  assert.match(worker, /\.\/domain\/crop-shape\.mjs/);
  assert.match(app, /traceCropShape/);
  assert.match(html, /id="image-crop-shape"/);
});


test("canvas coordinate mapping is cached for offline rendering and editing", async () => {
  const app = await readFile("app.js", "utf8");
  const worker = await readFile("service-worker.js", "utf8");
  assert.match(app, /screenToDocumentPoint/);
  assert.match(app, /documentFitScale/);
  assert.match(app, /screenViewportForDocument/);
  assert.match(worker, /\.\/domain\/canvas-space\.mjs/);
  assert.match(worker, /animeart-web-shell-v70/);
});

 
test("mobile touch gestures use bounded two-finger pan/zoom and the offline shell caches their module", async () => {
  const [app, html, css, worker, gestures] = await Promise.all([
    readFile("app.js", "utf8"), readFile("index.html", "utf8"),
    readFile("styles.css", "utf8"), readFile("service-worker.js", "utf8"),
    readFile("domain/touch-gestures.mjs", "utf8")
  ]);
  assert.match(app, /activeTouchPointers/);
  assert.match(app, /beginTouchGesture/);
  assert.match(app, /updateTouchGesture/);
  assert.match(app, /pointercancel/);
  assert.match(gestures, /updatePinchPanViewport/);
  assert.match(gestures, /Math\.min\(maxZoom, Math\.max\(minZoom/);
  assert.match(worker, /animeart-web-shell-v70/);
  assert.match(worker, /\.\/domain\/touch-gestures\.mjs/);
  assert.match(css, /#canvas \{ touch-action: none; \}/);
  assert.match(html, /class="mobile-touch-dock"/);
  assert.match(html, /id="selection-mini-margin"/);
  assert.match(app, /selection-mini-margin/);
});
