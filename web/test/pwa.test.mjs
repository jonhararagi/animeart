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
  assert.match(worker, /animeart-web-shell-v1/);
  assert.match(worker, /caches\.open/);
  assert.match(worker, /caches\.match/);
  assert.doesNotMatch(app + worker, /DocumentManager|LayerManager|CanvasManager|RendererManager|ViewportManager|HistoryManager|PersistenceManager/);
});
