import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  createLayer,
  createStroke,
  createStrokePoint,
  isValidDocument,
  migrateLegacyDocument,
  normalizeDocument,
  normalizeTransform,
  restoreDocument
} from "../domain/model.mjs";

test("domain creates a document with one reusable layer", () => {
  const document = createDocument(800, 600);
  assert.equal(document.version, 2);
  assert.equal(document.layers.length, 1);
  assert.equal(document.layers[0].visible, true);
  assert.deepEqual(document.layers[0].transform, { x: 0, y: 0, scale: 1, rotation: 0 });
});

test("domain creates minimal stroke and stroke point contracts", () => {
  const point = createStrokePoint(12, 24);
  const stroke = createStroke("brush", 7, [point]);
  assert.deepEqual(point, { x: 12, y: 24 });
  assert.equal(stroke.tool, "brush");
  assert.equal(stroke.size, 7);
  assert.deepEqual(stroke.points, [{ x: 12, y: 24 }]);
});

test("domain normalizes persisted document, layer, stroke and transform metadata", () => {
  const document = normalizeDocument({
    width: 800,
    height: 600,
    layers: [{
      id: "layer-1",
      name: "Sketch",
      opacity: 2,
      transform: { x: 3, y: 4, scale: 2, rotation: 10 },
      strokes: [{
        tool: "brush",
        size: 7,
        points: [{ x: 1, y: 2 }, { x: "bad", y: 4 }]
      }]
    }]
  });
  assert.equal(document.layers[0].name, "Sketch");
  assert.equal(document.layers[0].opacity, 1);
  assert.deepEqual(document.layers[0].transform, { x: 3, y: 4, scale: 2, rotation: 10 });
  assert.deepEqual(document.layers[0].strokes[0].points, [{ x: 1, y: 2 }]);
  assert.equal(isValidDocument(document), true);
});

test("domain normalizes invalid transform values to safe defaults", () => {
  assert.deepEqual(normalizeTransform({ x: "bad", y: null, scale: 0, rotation: "bad" }), {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
});

test("domain migrates the existing v1 web persistence shape", () => {
  const document = migrateLegacyDocument({
    layers: [{ id: "layer-1", name: "Lineart" }],
    strokes: [{ layerIndex: 0, tool: "brush", size: 7, points: [{ x: 1, y: 2 }] }]
  });
  assert.equal(document.version, 2);
  assert.equal(document.layers[0].strokes.length, 1);
  assert.deepEqual(document.layers[0].strokes[0].points, [{ x: 1, y: 2 }]);
});

test("restoreDocument preserves legacy strokes instead of normalizing them away", () => {
  const document = restoreDocument({
    layers: [{ id: "layer-1", name: "Lineart" }],
    strokes: [{ layerIndex: 0, tool: "brush", size: 7, points: [{ x: 1, y: 2 }] }]
  });
  assert.equal(document.layers[0].strokes.length, 1);
  assert.equal(document.layers[0].strokes[0].size, 7);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createLayer } from "../domain/model.mjs";
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
