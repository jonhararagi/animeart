import test from "node:test";
import assert from "node:assert/strict";
import { canvasToImageBlob, downloadImageBlob, createPngExportCanvas, renderDocumentToCanvas } from "../domain/png-export.mjs";

test("export canvas rejects invalid document dimensions", () => {
  assert.throws(() => createPngExportCanvas({ width: 0, height: 10 }, { createElement() {} }), /dimensions/i);
});

test("image encoder chooses requested format and bounds lossy quality", async () => {
  const calls = [];
  const canvas = {
    toBlob(callback, type, quality) {
      calls.push({ type, quality });
      callback(new Blob(["image"], { type }));
    }
  };
  const jpeg = await canvasToImageBlob(canvas, "jpeg", 1.4);
  assert.equal(jpeg.type, "image/jpeg");
  assert.deepEqual(calls[0], { type: "image/jpeg", quality: 1 });
  const webp = await canvasToImageBlob(canvas, "webp", 0.1);
  assert.equal(webp.type, "image/webp");
  assert.deepEqual(calls[1], { type: "image/webp", quality: 0.5 });
  const png = await canvasToImageBlob(canvas, "png");
  assert.equal(png.type, "image/png");
  assert.equal(calls[2].quality, undefined);
});

test("image encoder rejects unsupported formats and browsers that silently fall back to PNG", async () => {
  await assert.rejects(() => canvasToImageBlob({}, "bmp"), /Unsupported export format/i);
  await assert.rejects(() => canvasToImageBlob({
    toBlob(callback) { callback(new Blob(["png"], { type: "image/png" })); }
  }, "webp"), /does not support WEBP/i);
});

test("download names match the selected format", () => {
  let clicked = false;
  const documentObject = { createElement() { return { click() { clicked = true; } }; } };
  const urlObject = { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} };
  const result = downloadImageBlob(new Blob(["jpeg"], { type: "image/jpeg" }), "my-art.png", "jpeg", urlObject, documentObject);
  assert.equal(result.filename, "my-art.jpeg");
  assert.equal(clicked, true);
});


test("document raster rendering keeps document pixels at the export origin", () => {
  const translations = [];
  const context = {
    clearRect() {},
    save() {},
    restore() {},
    translate(...args) { translations.push(args); }
  };
  const canvas = { width: 800, height: 600, getContext() { return context; } };
  let renderCenter = null;
  renderDocumentToCanvas({ width: 800, height: 600 }, canvas, ({ center }) => { renderCenter = center; });
  assert.deepEqual(renderCenter, { x: 400, y: 300 });
  assert.deepEqual(translations, [], "export does not offset pixel coordinates by a second viewport-center translation");
});


test("transparent preview uses an alpha canvas without baking its checkerboard into export", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const app = await readFile(join(import.meta.dirname, "..", "app.js"), "utf8");
  const html = await readFile(join(import.meta.dirname, "..", "index.html"), "utf8");
  assert.match(app, /getContext\("2d", \{ alpha: true \}\)/);
  assert.match(app, /ctx\.clearRect\(0, 0, rect\.width, rect\.height\)/);
  assert.match(app, /renderDocumentToCanvas\(state\.document, exportCanvas/);
  assert.match(html, /id="export-transparent-png"/);
  assert.match(html, /Los cuadritos indican transparencia\. No aparecerán en el PNG/);
});
