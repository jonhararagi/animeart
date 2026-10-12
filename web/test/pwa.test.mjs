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
  assert.match(worker, /animeart-web-shell-v6/);
  assert.match(worker, /caches\.open/);
  assert.match(worker, /caches\.match/);
  assert.match(app, /layerAdjustmentsToCanvasFilter/);
  assert.match(worker, /\.\/domain\/layer-adjustments\.mjs/);
  assert.match(worker, /\.\/domain\/text-layer\.mjs/);
  assert.ok(worker.includes("./assets/cc0-detailed-anime-character.png.base64"));
  assert.ok(worker.includes("./assets/ASSET_SOURCES.md"));
  assert.doesNotMatch(app + worker, /DocumentManager|LayerManager|CanvasManager|RendererManager|ViewportManager|HistoryManager|PersistenceManager/);
});


test("export toolbar offers PNG, JPEG and WebP with quality and JPEG background controls", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(html, /id="export-format"/);
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
});
