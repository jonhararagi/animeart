import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, restoreDocument } from "../domain/model.mjs";
import { DocumentHistory } from "../domain/history.mjs";
import { flipImageLayer, replaceImageLayer } from "../domain/document-operations.mjs";
import { readFile } from "node:fs/promises";

test("image flips toggle horizontal and vertical independently without mutating the input", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Photo", 320, 240, "data:image/png;base64,original");
  document.layers = [image];
  const horizontal = flipImageLayer(document, image.id, "horizontal");
  assert.ok(horizontal);
  assert.equal(horizontal.layers[0].image.flipX, true);
  assert.equal(horizontal.layers[0].image.flipY, false);
  assert.equal(document.layers[0].image.flipX, false);
  const vertical = flipImageLayer(horizontal, image.id, "vertical");
  assert.equal(vertical.layers[0].image.flipX, true);
  assert.equal(vertical.layers[0].image.flipY, true);
  const unflipped = flipImageLayer(vertical, image.id, "horizontal");
  assert.equal(unflipped.layers[0].image.flipX, false);
  assert.equal(unflipped.layers[0].image.flipY, true);
});

test("image flips reject drawing layers, locked layers, missing layers and invalid axes", () => {
  const document = createDocument(100, 100);
  const image = createImageLayer("Photo", 20, 20);
  document.layers.push(image);
  assert.equal(flipImageLayer(document, document.layers[0].id, "horizontal"), null);
  assert.equal(flipImageLayer(document, image.id, "diagonal"), null);
  assert.equal(flipImageLayer(document, "missing", "horizontal"), null);
  const locked = structuredClone(document);
  locked.layers[1].locked = true;
  assert.equal(flipImageLayer(locked, image.id, "horizontal"), null);
});

test("image flips survive history, document normalization and project round trips", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Photo", 320, 240);
  document.layers.push(image);
  const flipped = flipImageLayer(document, image.id, "horizontal");
  const history = new DocumentHistory(document);
  history.record(document, flipped);
  assert.equal(history.undo(flipped).layers[1].image.flipX, false);
  assert.equal(history.redo(document).layers[1].image.flipX, true);
  assert.equal(restoreDocument(JSON.parse(JSON.stringify(flipped))).layers[1].image.flipX, true);
  assert.equal(restoreDocument(JSON.parse(JSON.stringify(flipped))).layers[1].image.flipY, false);
});

test("crop replacement preserves flip orientation and the selected visual crop offset", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Photo", 100, 80, "data:image/png;base64,original");
  image.image.flipX = true;
  image.image.flipY = true;
  document.layers.push(image);
  const next = replaceImageLayer(document, image.id, {
    source: "data:image/png;base64,cropped",
    width: 40,
    height: 30
  }, { cropOrigin: { x: 10, y: 12 } });
  assert.ok(next);
  assert.equal(next.layers[1].image.flipX, true);
  assert.equal(next.layers[1].image.flipY, true);
  assert.equal(next.layers[1].image.width, 40);
  assert.equal(next.layers[1].image.height, 30);
  assert.equal(next.layers[1].transform.x, 10);
  assert.equal(next.layers[1].transform.y, 12);
  assert.equal(document.layers[1].image.width, 100);
});

test("flip controls are connected to the renderer and crop-coordinate mapping", async () => {
  const [html, app, e2e] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("scripts/browser-e2e.mjs", "utf8")
  ]);
  assert.match(html, /id="flip-image-horizontal"/);
  assert.match(html, /id="flip-image-vertical"/);
  assert.match(app, /flipImageLayer\(state\.document, layer\.id, axis\)/);
  assert.match(app, /context\.scale\(-1, 1\)/);
  assert.match(app, /context\.scale\(1, -1\)/);
  assert.match(app, /layer\.image\.width - x - width/);
  assert.match(app, /layer\.image\.height - y - height/);
  assert.match(e2e, /flipX === true/);
});
