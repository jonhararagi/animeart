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
