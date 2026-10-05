import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  createImageLayer,
  createLayer,
  createStroke,
  createStrokePoint,
  isValidDocument,
  migrateLegacyDocument,
  normalizeDocument,
  normalizeTransform,
  restoreDocument,
  TEST_IMAGE_SOURCE
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


test("domain creates a deterministic Image Layer with minimal image content", () => {
  const layer = createImageLayer("Reference", 120, 80, TEST_IMAGE_SOURCE);
  assert.equal(layer.contentType, "image");
  assert.deepEqual(layer.image, { source: TEST_IMAGE_SOURCE, width: 120, height: 80 });
  assert.deepEqual(layer.strokes, []);
  assert.equal(layer.visible, true);
  assert.equal(layer.locked, false);
  assert.equal(layer.opacity, 1);
});

test("domain normalizes and validates Image Layer content", () => {
  const document = normalizeDocument({
    width: 400,
    height: 300,
    layers: [{
      id: "image-1",
      name: "Image",
      contentType: "image",
      visible: true,
      locked: true,
      opacity: 0.5,
      transform: { x: 10, y: -5, scale: 2, rotation: 30 },
      strokes: [],
      image: { source: TEST_IMAGE_SOURCE, width: 120, height: 80 }
    }]
  });
  assert.equal(document.layers[0].contentType, "image");
  assert.deepEqual(document.layers[0].image, { source: TEST_IMAGE_SOURCE, width: 120, height: 80 });
  assert.equal(isValidDocument(document), true);
});

test("Image Layer survives serialize and restore without an external URL", () => {
  const image = createImageLayer("Persisted", 64, 64);
  const document = createDocument(400, 300);
  document.layers.push(image);
  const restored = restoreDocument(JSON.parse(JSON.stringify(document)));
  assert.deepEqual(restored, document);
  assert.equal(restored.layers[1].image.source.startsWith("data:image/svg+xml,"), true);
});

test("Drawing and Image layers coexist in one Document", () => {
  const document = createDocument(400, 300);
  document.layers[0].strokes = [createStroke("brush", 5, [createStrokePoint(10, 20), createStrokePoint(30, 40)])];
  const image = createImageLayer("Image", 64, 64);
  document.layers.push(image);
  assert.equal(isValidDocument(document), true);
  assert.equal(document.layers.filter(layer => layer.contentType === "drawing").length, 1);
  assert.equal(document.layers.filter(layer => layer.contentType === "image").length, 1);
});

test("Image Layer state retains visibility, opacity and lock through restore", () => {
  const image = createImageLayer("State", 64, 64);
  image.visible = false;
  image.opacity = 0.5;
  image.locked = true;
  const document = createDocument();
  document.layers.push(image);
  const restored = restoreDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(restored.layers[1].visible, false);
  assert.equal(restored.layers[1].opacity, 0.5);
  assert.equal(restored.layers[1].locked, true);
});


test("Image Layer state is valid for renderer-facing visibility, opacity and lock flags", () => {
  const document = createDocument();
  const image = createImageLayer("Render State");
  image.visible = false;
  image.opacity = 0.5;
  image.locked = true;
  document.layers.push(image);
  assert.equal(isValidDocument(document), true);
  assert.equal(document.layers[1].visible, false);
  assert.equal(document.layers[1].opacity, 0.5);
  assert.equal(document.layers[1].locked, true);
});
