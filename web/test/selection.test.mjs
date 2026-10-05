import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../domain/model.mjs";
import { DocumentHistory } from "../domain/history.mjs";
import { rotateLayer, scaleLayer, translateLayer } from "../domain/document-operations.mjs";
import { hitTestHandle, hitTestLayer, layerLocalBounds, layerCorners, selectionGeometry } from "../domain/selection.mjs";
import { createViewport } from "../domain/viewport.mjs";

function drawableDocument() {
  const document = createDocument(400, 300);
  document.layers[0].strokes = [{
    tool: "brush",
    size: 10,
    points: [{ x: 100, y: 100 }, { x: 200, y: 160 }]
  }];
  return document;
}

test("layer bounds reuse existing Stroke/StrokePoint data", () => {
  const document = drawableDocument();
  assert.deepEqual(layerLocalBounds(document.layers[0]), { minX: 95, minY: 95, maxX: 205, maxY: 165 });
});

test("selection geometry projects transformed bounds through the existing viewport", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  layer.transform = { x: 20, y: -10, scale: 2, rotation: 30 };
  const viewport = createViewport(2, 30, -20);
  const geometry = selectionGeometry(layer, viewport, { x: 200, y: 150 });
  assert.equal(geometry.corners.length, 4);
  assert.ok(geometry.rotationHandle);
  assert.notDeepEqual(geometry.corners, layerCorners(layer, { x: 200, y: 150 }));
});

test("hit testing respects layer translation, scale and rotation", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  layer.transform = { x: 20, y: -10, scale: 1.5, rotation: 25 };
  const pivot = { x: 200, y: 150 };
  const inside = { x: 160, y: 125 };
  assert.equal(hitTestLayer(layer, inside, pivot), true);
  assert.equal(hitTestLayer(layer, { x: 20, y: 20 }, pivot), false);
});

test("screen handles distinguish scale corners, rotation and move", () => {
  const document = drawableDocument();
  const geometry = selectionGeometry(document.layers[0], createViewport(), { x: 200, y: 150 });
  assert.equal(hitTestHandle(geometry.corners[0], geometry), "scale-nw");
  assert.equal(hitTestHandle(geometry.rotationHandle, geometry), "rotate");
  assert.equal(hitTestHandle(geometry.center, geometry), "move");
});

test("move, scale and rotate compose through the existing Document Operations", () => {
  const document = drawableDocument();
  const id = document.layers[0].id;
  const moved = translateLayer(document, id, 10, -5);
  const scaled = scaleLayer(moved, id, 1.5);
  const rotated = rotateLayer(scaled, id, 20);
  assert.deepEqual(rotated.layers[0].transform, { x: 10, y: -5, scale: 1.5, rotation: 20 });
});

test("a completed visual transform records one History operation", () => {
  const before = drawableDocument();
  const id = before.layers[0].id;
  const after = translateLayer(before, id, 40, 20);
  const history = new DocumentHistory(before);
  history.record(before, after);
  assert.equal(history.size(), 1);
  const undone = history.undo(after);
  assert.deepEqual(undone.layers[0].transform, before.layers[0].transform);
  const redone = history.redo(undone);
  assert.deepEqual(redone.layers[0].transform, after.layers[0].transform);
});

test("new transform after Undo clears the Redo branch", () => {
  const before = drawableDocument();
  const id = before.layers[0].id;
  const moved = translateLayer(before, id, 20, 0);
  const scaled = scaleLayer(moved, id, 2);
  const history = new DocumentHistory(before);
  history.record(before, moved);
  history.undo(moved);
  assert.equal(history.canRedo(), true);
  history.record(before, scaled);
  assert.equal(history.canRedo(), false);
});
