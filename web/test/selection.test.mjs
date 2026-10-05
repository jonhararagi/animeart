import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer } from "../domain/model.mjs";
import { DocumentHistory } from "../domain/history.mjs";
import { rotateLayer, scaleLayer, translateLayer, updateLayerTransform } from "../domain/document-operations.mjs";
import { hitTestHandle, hitTestLayer, layerLocalBounds, layerCorners, resizeTransformFromCorner, selectionGeometry, transformPoint } from "../domain/selection.mjs";
import { createViewport, documentToScreen, screenToDocument } from "../domain/viewport.mjs";

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


function close(a, b, epsilon = 1e-8) {
  return Math.abs(a - b) <= epsilon;
}

function assertPointClose(actual, expected, epsilon = 1e-8) {
  assert.equal(close(actual.x, expected.x, epsilon), true);
  assert.equal(close(actual.y, expected.y, epsilon), true);
}

function resizeTargetForHandle(layer, pivot, handle, factor = 1.5) {
  const bounds = layerLocalBounds(layer);
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ];
  const names = ["scale-nw", "scale-ne", "scale-se", "scale-sw"];
  const index = names.indexOf(handle);
  const opposite = (index + 2) % 4;
  const fixed = transformPoint(corners[opposite], layer.transform, pivot);
  const dragged = transformPoint(corners[index], layer.transform, pivot);
  return {
    x: fixed.x + (dragged.x - fixed.x) * factor,
    y: fixed.y + (dragged.y - fixed.y) * factor
  };
}

test("precise corner resize keeps the opposite corner fixed for all four handles", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  const pivot = { x: 200, y: 150 };

  for (const handle of ["scale-nw", "scale-ne", "scale-se", "scale-sw"]) {
    const beforeCorners = layerCorners(layer, pivot);
    const target = resizeTargetForHandle(layer, pivot, handle, 1.5);
    const nextTransform = resizeTransformFromCorner(layer, pivot, handle, target);
    assert.ok(nextTransform);

    const afterCorners = layerCorners(layer, pivot, nextTransform);
    const index = ["scale-nw", "scale-ne", "scale-se", "scale-sw"].indexOf(handle);
    const opposite = (index + 2) % 4;
    assertPointClose(afterCorners[opposite], beforeCorners[opposite]);
  }
});

test("precise corner resize produces scale and translation rather than center-only scaling", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  const pivot = { x: 200, y: 150 };
  const target = resizeTargetForHandle(layer, pivot, "scale-se", 1.5);
  const nextTransform = resizeTransformFromCorner(layer, pivot, "scale-se", target);
  assert.ok(nextTransform);
  assert.ok(nextTransform.scale > layer.transform.scale);
  assert.ok(Math.abs(nextTransform.x) > 1e-8 || Math.abs(nextTransform.y) > 1e-8);
});

test("precise corner resize remains stable when the layer is already rotated", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  const pivot = { x: 200, y: 150 };
  layer.transform = { x: 18, y: -12, scale: 1.4, rotation: 37 };
  const beforeCorners = layerCorners(layer, pivot);
  const target = resizeTargetForHandle(layer, pivot, "scale-ne", 1.25);
  const nextTransform = resizeTransformFromCorner(layer, pivot, "scale-ne", target);
  assert.ok(nextTransform);
  assert.equal(nextTransform.rotation, layer.transform.rotation);
  const afterCorners = layerCorners(layer, pivot, nextTransform);
  assertPointClose(afterCorners[3], beforeCorners[3]);
});

test("precise corner resize accepts document targets produced by zoom and pan viewport states", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  const pivot = { x: 200, y: 150 };
  const beforeCorners = layerCorners(layer, pivot);
  const handle = "scale-se";
  const targetDocument = resizeTargetForHandle(layer, pivot, handle, 1.4);

  for (const viewport of [
    createViewport(1, 0, 0),
    createViewport(2, 35, -20),
    createViewport(0.5, -40, 25)
  ]) {
    const screenTarget = documentToScreen(targetDocument, viewport, pivot);
    const reconstructed = screenToDocument(screenTarget, viewport, pivot);
    const nextTransform = resizeTransformFromCorner(layer, pivot, handle, reconstructed);
    assert.ok(nextTransform);
    const afterCorners = layerCorners(layer, pivot, nextTransform);
    assertPointClose(afterCorners[0], beforeCorners[0]);
  }
});

test("move, rotate, scale and reverse transform sequences remain finite", () => {
  const document = drawableDocument();
  const id = document.layers[0].id;
  const pivot = { x: 200, y: 150 };
  let next = translateLayer(document, id, 20, -15);
  next = rotateLayer(next, id, 30);
  const layerAfterRotation = next.layers[0];
  const target = resizeTargetForHandle(layerAfterRotation, pivot, "scale-sw", 1.3);
  const resize = resizeTransformFromCorner(layerAfterRotation, pivot, "scale-sw", target);
  assert.ok(resize);
  next = updateLayerTransform(next, id, resize);
  next = translateLayer(next, id, -8, 11);
  for (const value of Object.values(next.layers[0].transform)) assert.equal(Number.isFinite(value), true);
});

test("rotate, scale, move sequence remains finite and preserves the fixed corner", () => {
  const document = drawableDocument();
  const id = document.layers[0].id;
  const pivot = { x: 200, y: 150 };
  let next = rotateLayer(document, id, -22);
  const before = layerCorners(next.layers[0], pivot);
  const target = resizeTargetForHandle(next.layers[0], pivot, "scale-nw", 1.2);
  const resize = resizeTransformFromCorner(next.layers[0], pivot, "scale-nw", target);
  assert.ok(resize);
  next = updateLayerTransform(next, id, resize);
  next = translateLayer(next, id, 13, -9);
  const after = layerCorners(next.layers[0], pivot);
  for (const value of Object.values(next.layers[0].transform)) assert.equal(Number.isFinite(value), true);
  assertPointClose(after[2], { x: before[2].x + 13, y: before[2].y - 9 });
});

test("degenerate corner geometry safely returns null instead of NaN or Infinity", () => {
  const document = drawableDocument();
  const layer = document.layers[0];
  layer.strokes = [{ tool: "brush", size: 0, points: [{ x: 100, y: 100 }] }];
  const result = resizeTransformFromCorner(layer, { x: 200, y: 150 }, "scale-se", { x: 100, y: 100 });
  assert.equal(result, null);

  const normal = drawableDocument().layers[0];
  const nearZero = resizeTransformFromCorner(normal, { x: 200, y: 150 }, "scale-se", { x: 95.000001, y: 95.000001 }, 0.05);
  assert.ok(nearZero);
  for (const value of Object.values(nearZero)) assert.equal(Number.isFinite(value), true);
  assert.ok(nearZero.scale > 0);
  assert.ok(nearZero.scale >= 0.05);
});


test("Image Layer bounds use image dimensions", () => {
  const layer = createImageLayer("Image", 120, 80);
  assert.deepEqual(layerLocalBounds(layer), { minX: 0, minY: 0, maxX: 120, maxY: 80 });
});

test("Image Layer selection bounds follow transform and viewport zoom/pan", () => {
  const layer = createImageLayer("Image", 120, 80);
  layer.transform = { x: 20, y: -10, scale: 1.5, rotation: 30 };
  const viewport = createViewport(0.5, 40, -25);
  const geometry = selectionGeometry(layer, viewport, { x: 200, y: 150 });
  assert.equal(geometry.corners.length, 4);
  const hit = hitTestLayer(layer, transformPoint({ x: 60, y: 40 }, layer.transform, { x: 200, y: 150 }), { x: 200, y: 150 });
  assert.equal(hit, true);
});

test("Image Layer exposes the same selection handles for move resize and rotate", () => {
  const layer = createImageLayer("Image", 120, 80);
  const viewport = createViewport(2, -30, 15);
  const geometry = selectionGeometry(layer, viewport, { x: 200, y: 150 });
  assert.equal(hitTestHandle(geometry.corners[0], geometry), "scale-nw");
  assert.equal(hitTestHandle(geometry.corners[1], geometry), "scale-ne");
  assert.equal(hitTestHandle(geometry.corners[2], geometry), "scale-se");
  assert.equal(hitTestHandle(geometry.corners[3], geometry), "scale-sw");
  assert.equal(hitTestHandle(geometry.rotationHandle, geometry), "rotate");
  assert.equal(hitTestHandle({ x: geometry.center.x, y: geometry.center.y }, geometry), "move");
});

test("Image Layer resize keeps the opposite corner fixed", () => {
  const layer = createImageLayer("Image", 120, 80);
  layer.transform = { x: 15, y: -8, scale: 1, rotation: 22 };
  const pivot = { x: 200, y: 150 };
  const before = layerCorners(layer, pivot);
  const target = {
    x: before[2].x + 30,
    y: before[2].y + 20
  };
  const nextTransform = resizeTransformFromCorner(layer, pivot, "scale-se", target);
  assert.ok(nextTransform);
  const nextLayer = { ...layer, transform: nextTransform };
  const after = layerCorners(nextLayer, pivot);
  assertPointClose(after[0], before[0]);
  assert.ok(nextTransform.scale > 0);
});
