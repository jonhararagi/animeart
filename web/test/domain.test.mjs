import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createLayer, migrateLegacyDocument, normalizeDocument, restoreDocument } from "../domain/model.mjs";

test("domain creates a document with one reusable layer", () => {
  const document = createDocument(800, 600);
  assert.equal(document.version, 2);
  assert.equal(document.layers.length, 1);
  assert.equal(document.layers[0].visible, true);
  assert.equal(document.layers[0].transform.scale, 1);
});

test("domain normalizes persisted document metadata", () => {
  const document = normalizeDocument({
    layers: [{ id: "layer-1", name: "Sketch", opacity: 0.5, transform: { x: 3, y: 4, scale: 2, rotation: 10 } }]
  });
  assert.equal(document.layers[0].name, "Sketch");
  assert.equal(document.layers[0].opacity, 0.5);
  assert.deepEqual(document.layers[0].transform, { x: 3, y: 4, scale: 2, rotation: 10 });
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
