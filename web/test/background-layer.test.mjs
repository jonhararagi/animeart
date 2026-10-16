import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createLayer, isValidDocument, normalizeDocument } from "../domain/model.mjs";
import { setLayerBackground } from "../domain/document-operations.mjs";

test("pinning an image as background locks it and puts it behind other layers", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Photo", 640, 480, "data:image/png;base64,AA==");
  const ink = createLayer("Ink");
  document.layers.push(image, ink);

  const next = setLayerBackground(document, image.id, true);
  assert.ok(next);
  assert.equal(next.layers[0].id, image.id, "background is the first rendered layer");
  assert.equal(next.layers[0].isBackground, true);
  assert.equal(next.layers[0].locked, true, "background cannot be dragged by accident");
  assert.equal(next.layers[0].name, "Fondo del lienzo");
  assert.equal(document.layers[1].locked, false, "original document stays immutable");
  assert.equal(isValidDocument(next), true);
});

test("background metadata survives save/restore normalization and can be unset", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Photo", 320, 240, "data:image/png;base64,AA==");
  document.layers.push(image);
  const pinned = setLayerBackground(document, image.id, true);
  const restored = normalizeDocument(JSON.parse(JSON.stringify(pinned)));

  assert.equal(restored.layers[0].isBackground, true);
  assert.equal(restored.layers[0].locked, true);
  const editable = setLayerBackground(restored, image.id, false);
  assert.ok(editable);
  assert.equal(editable.layers.find(layer => layer.id === image.id).isBackground, false);
  assert.equal(editable.layers.find(layer => layer.id === image.id).locked, false);
  assert.equal(isValidDocument(editable), true);
});

test("a new background replaces the old fixed background without leaving both locked", () => {
  const document = createDocument(800, 600);
  const first = createImageLayer("First", 320, 240, "data:image/png;base64,AA==");
  const second = createImageLayer("Second", 640, 480, "data:image/png;base64,AA==");
  document.layers.push(first, second);
  const once = setLayerBackground(document, first.id, true);
  const twice = setLayerBackground(once, second.id, true);

  const oldBackground = twice.layers.find(layer => layer.id === first.id);
  const newBackground = twice.layers.find(layer => layer.id === second.id);
  assert.equal(oldBackground.isBackground, false);
  assert.equal(oldBackground.locked, false);
  assert.equal(newBackground.isBackground, true);
  assert.equal(newBackground.locked, true);
  assert.equal(twice.layers[0].id, second.id);
});
