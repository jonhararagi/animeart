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

test("layer rename changes only the name", async () => {
  const { createDocument, createStroke, createStrokePoint } = await import("../domain/model.mjs");
  const { renameLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument();
  document.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(1, 2), createStrokePoint(3, 4)]));
  document.layers[0].opacity = 0.4;
  const next = renameLayer(document, document.layers[0].id, "Renamed");
  assert.equal(next.layers[0].name, "Renamed");
  assert.deepEqual({ ...next.layers[0], name: document.layers[0].name }, document.layers[0]);
});

test("duplicate layer gets a new id, deep copies content and preserves properties", async () => {
  const { createDocument, createImageLayer } = await import("../domain/model.mjs");
  const { duplicateLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument();
  const image = createImageLayer("Image", 12, 8);
  image.transform = { x: 3, y: 4, scale: 1.5, rotation: 20 }; image.opacity = 0.6;
  document.layers.push(image);
  const next = duplicateLayer(document, image.id);
  const original = next.layers[1], copy = next.layers[2];
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, "Image Copy");
  assert.deepEqual(copy.image, original.image);
  assert.deepEqual(copy.transform, original.transform);
  assert.equal(copy.opacity, original.opacity);
  copy.image.width = 99; copy.transform.x = 100;
  assert.equal(original.image.width, 12); assert.equal(original.transform.x, 3);
});

test("delete layer removes exactly the selected layer and preserves order", async () => {
  const { createDocument, createLayer } = await import("../domain/model.mjs");
  const { deleteLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument(); const second = createLayer("Second"); const third = createLayer("Third");
  document.layers.push(second, third);
  const next = deleteLayer(document, second.id);
  assert.deepEqual(next.layers.map(layer => layer.name), [document.layers[0].name, "Third"]);
  assert.equal(next.layers.some(layer => layer.id === second.id), false);
});

test("delete refuses to leave a document without any layer", async () => {
  const { createDocument } = await import("../domain/model.mjs");
  const { deleteLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument();
  assert.equal(deleteLayer(document, document.layers[0].id), null);
});

test("reorder changes only layer order", async () => {
  const { createDocument, createLayer } = await import("../domain/model.mjs");
  const { reorderLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument(); document.layers[0].name = "One";
  document.layers.push(createLayer("Two"), createLayer("Three")); document.layers[1].transform.x = 17;
  const beforeLayers = structuredClone(document.layers);
  const next = reorderLayer(document, document.layers[1].id, "up");
  assert.deepEqual(next.layers.map(layer => layer.name), ["One", "Three", "Two"]);
  assert.deepEqual(next.layers[1], beforeLayers[2]); assert.deepEqual(next.layers[2], beforeLayers[1]); assert.deepEqual(next.layers[0], beforeLayers[0]);
});

test("lifecycle operations reject invalid ids and blank names", async () => {
  const { createDocument } = await import("../domain/model.mjs");
  const { renameLayer, duplicateLayer, deleteLayer, reorderLayer } = await import("../domain/document-operations.mjs");
  const document = createDocument(); const id = document.layers[0].id;
  assert.equal(renameLayer(document, id, "   "), null); assert.equal(renameLayer(document, "missing", "New"), null);
  assert.equal(duplicateLayer(document, "missing"), null); assert.equal(deleteLayer(document, "missing"), null); assert.equal(reorderLayer(document, id, "sideways"), null);
});

test("lifecycle operations are reversible through the existing DocumentHistory", async () => {
  const { createDocument, createLayer } = await import("../domain/model.mjs");
  const { renameLayer, duplicateLayer, deleteLayer, reorderLayer } = await import("../domain/document-operations.mjs");
  const { DocumentHistory } = await import("../domain/history.mjs");
  const before = createDocument(); before.layers[0].name = "One"; before.layers.push(createLayer("Two"), createLayer("Three"));
  let after = renameLayer(before, before.layers[0].id, "Renamed");
  const originalId = after.layers[1].id;
  after = duplicateLayer(after, originalId); after = reorderLayer(after, after.layers[3].id, "down"); after = deleteLayer(after, originalId);
  const history = new DocumentHistory(before); history.record(before, after);
  assert.deepEqual(history.undo(after), before); assert.deepEqual(history.redo(before), after);
});
