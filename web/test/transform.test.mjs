import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createLayer } from "../domain/model.mjs";
import { rotateLayer, scaleLayer, translateLayer, updateLayerTransform } from "../domain/document-operations.mjs";

function twoLayerDocument() {
  const document = createDocument();
  document.layers.push(createLayer("Layer 2"));
  return document;
}

test("layer transform operation updates only the selected layer", () => {
  const document = twoLayerDocument();
  const originalSecond = { ...document.layers[1].transform };
  const next = translateLayer(document, document.layers[0].id, 12, -8);
  assert.deepEqual(next.layers[0].transform, { x: 12, y: -8, scale: 1, rotation: 0 });
  assert.deepEqual(next.layers[1].transform, originalSecond);
  assert.deepEqual(document.layers[0].transform, { x: 0, y: 0, scale: 1, rotation: 0 });
});

test("layer transform operations are immutable at the Document boundary", () => {
  const document = createDocument();
  const next = updateLayerTransform(document, document.layers[0].id, { x: 20, rotation: 15 });
  assert.notStrictEqual(next, document);
  assert.deepEqual(document.layers[0].transform, { x: 0, y: 0, scale: 1, rotation: 0 });
  assert.deepEqual(next.layers[0].transform, { x: 20, y: 0, scale: 1, rotation: 15 });
});

test("scale and rotation preserve the existing transform dimensions", () => {
  const document = createDocument();
  document.layers[0].transform = { x: 4, y: -3, scale: 2, rotation: 10 };
  const scaled = scaleLayer(document, document.layers[0].id, 1.1);
  const rotated = rotateLayer(scaled, document.layers[0].id, 5);
  assert.equal(rotated.layers[0].transform.x, 4);
  assert.equal(rotated.layers[0].transform.y, -3);
  assert.equal(rotated.layers[0].transform.scale, 2.2);
  assert.equal(rotated.layers[0].transform.rotation, 15);
});

test("invalid or missing layer operations are safe no-ops", () => {
  const document = createDocument();
  assert.equal(translateLayer(document, "missing", 10, 10), null);
  assert.equal(scaleLayer(document, document.layers[0].id, 0), null);
  assert.equal(rotateLayer(document, "missing", 10), null);
});

import { DocumentHistory } from "../domain/history.mjs";

test("layer transform operation integrates with the existing DocumentHistory", () => {
  const before = createDocument();
  const after = translateLayer(before, before.layers[0].id, 25, 5);
  const history = new DocumentHistory(before);
  history.record(before, after);
  const undone = history.undo(after);
  assert.deepEqual(undone.layers[0].transform, { x: 0, y: 0, scale: 1, rotation: 0 });
  const redone = history.redo(undone);
  assert.deepEqual(redone.layers[0].transform, { x: 25, y: 5, scale: 1, rotation: 0 });
});


test("existing transform operations apply unchanged to Image Layer content", () => {
  const document = createDocument();
  const image = createImageLayer("Image", 120, 80);
  document.layers.push(image);
  let next = translateLayer(document, image.id, 12, -8);
  next = scaleLayer(next, image.id, 2);
  next = rotateLayer(next, image.id, 45);
  assert.deepEqual(next.layers[1].transform, { x: 12, y: -8, scale: 2, rotation: 45 });
  assert.deepEqual(next.layers[1].image, image.image);
  assert.equal(next.layers[1].contentType, "image");
});
