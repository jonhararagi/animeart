import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createLayer } from "../domain/model.mjs";
import { rotateLayer, scaleLayer, setLayerLocked, setLayerOpacity, setLayerVisibility, translateLayer, updateLayerTransform } from "../domain/document-operations.mjs";

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


test("layer property operations are immutable and preserve unrelated layers", () => {
  const document = twoLayerDocument();
  const targetId = document.layers[0].id;
  let next = setLayerVisibility(document, targetId, false);
  next = setLayerLocked(next, targetId, true);
  next = setLayerOpacity(next, targetId, 0.4);

  assert.equal(document.layers[0].visible, true);
  assert.equal(document.layers[0].locked, false);
  assert.equal(document.layers[0].opacity, 1);
  assert.equal(next.layers[0].visible, false);
  assert.equal(next.layers[0].locked, true);
  assert.equal(next.layers[0].opacity, 0.4);
  assert.deepEqual(next.layers[1], document.layers[1]);
});

test("layer opacity clamps to the existing document contract", () => {
  const document = createDocument();
  const low = setLayerOpacity(document, document.layers[0].id, -2);
  const high = setLayerOpacity(document, document.layers[0].id, 2);
  assert.equal(low.layers[0].opacity, 0);
  assert.equal(high.layers[0].opacity, 1);
});

test("layer property operations safely reject missing layers and invalid values", () => {
  const document = createDocument();
  assert.equal(setLayerVisibility(document, "missing", true), null);
  assert.equal(setLayerLocked(document, "missing", true), null);
  assert.equal(setLayerOpacity(document, "missing", 0.5), null);
  assert.equal(setLayerOpacity(document, document.layers[0].id, Number.NaN), null);
});

test("layer property changes use the existing DocumentHistory boundary", () => {
  const before = createDocument();
  const after = setLayerOpacity(before, before.layers[0].id, 0.5);
  const history = new DocumentHistory(before);
  history.record(before, after);
  assert.equal(history.undo(after).layers[0].opacity, 1);
  assert.equal(history.redo(before).layers[0].opacity, 0.5);
});


test("locked layers reject visibility and opacity changes", () => {
  const document = createDocument();
  const locked = setLayerLocked(document, document.layers[0].id, true);
  assert.equal(locked.layers[0].locked, true);
  assert.equal(setLayerVisibility(locked, locked.layers[0].id, false).layers[0].visible, false);
  assert.equal(setLayerOpacity(locked, locked.layers[0].id, 0.25).layers[0].opacity, 0.25);
});
