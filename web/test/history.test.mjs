import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createLayer, createStroke, createStrokePoint, restoreDocument } from "../domain/model.mjs";
import { DocumentHistory, cloneDocument } from "../domain/history.mjs";
import { createViewport, panBy, zoomAt } from "../domain/viewport.mjs";
import { rotateLayer, scaleLayer, translateLayer } from "../domain/document-operations.mjs";

function documentWithStroke() {
  const document = createDocument();
  document.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(10, 20), createStrokePoint(30, 40)]));
  return document;
}

test("empty history: undo and redo are safe no-ops", () => {
  const document = createDocument();
  const history = new DocumentHistory(document);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.undo(document), document);
  assert.deepEqual(history.redo(document), document);
});

test("single stroke: undo removes it and redo restores it", () => {
  const before = createDocument();
  const after = documentWithStroke();
  const history = new DocumentHistory(before);
  history.record(before, after);
  assert.equal(history.size(), 1);
  assert.equal(history.undo(after).layers[0].strokes.length, 0);
  const restored = history.redo(before);
  assert.equal(restored.layers[0].strokes.length, 1);
  assert.deepEqual(restored.layers[0].strokes[0].points, after.layers[0].strokes[0].points);
});

test("multiple strokes undo and redo preserve exact order", () => {
  const a = createDocument();
  const b = cloneDocument(a);
  b.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(1, 1)]));
  const c = cloneDocument(b);
  c.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(2, 2)]));
  const d = cloneDocument(c);
  d.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(3, 3)]));
  const history = new DocumentHistory(a);
  history.record(a, b);
  history.record(b, c);
  history.record(c, d);
  assert.equal(history.undo(d).layers[0].strokes.length, 2);
  assert.equal(history.undo(c).layers[0].strokes.length, 1);
  assert.equal(history.undo(b).layers[0].strokes.length, 0);
  const one = history.redo(a);
  const two = history.redo(one);
  const three = history.redo(two);
  assert.deepEqual(three.layers[0].strokes.map(s => s.points[0]), [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
});

test("new operation after undo clears the redo branch", () => {
  const a = createDocument();
  const b = documentWithStroke();
  const c = cloneDocument(b);
  c.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(50, 60)]));
  const d = cloneDocument(a);
  d.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(70, 80)]));
  const history = new DocumentHistory(a);
  history.record(a, b);
  history.record(b, c);
  const afterUndo = history.undo(c);
  assert.equal(afterUndo.layers[0].strokes.length, 1);
  history.record(afterUndo, d);
  assert.equal(history.canRedo(), false);
});

test("clear layer is reversible", () => {
  const before = documentWithStroke();
  before.layers[0].strokes.push(createStroke("brush", 5, [createStrokePoint(50, 60)]));
  const after = cloneDocument(before);
  after.layers[0].strokes = [];
  const history = new DocumentHistory(before);
  history.record(before, after);
  assert.equal(history.undo(after).layers[0].strokes.length, 2);
  assert.equal(history.redo(before).layers[0].strokes.length, 0);
});

test("create layer is reversible", () => {
  const before = createDocument();
  const after = cloneDocument(before);
  const layer = createLayer("Layer 2");
  after.layers.push(layer);
  const history = new DocumentHistory(before);
  history.record(before, after);
  assert.equal(history.undo(after).layers.length, 1);
  const restored = history.redo(before);
  assert.equal(restored.layers.length, 2);
  assert.equal(restored.layers[1].id, layer.id);
});

test("undo changes Document but never changes Viewport", () => {
  const before = createDocument();
  const after = documentWithStroke();
  let viewport = zoomAt(createViewport(), 2, { x: 500, y: 350 }, { x: 400, y: 300 });
  viewport = panBy(viewport, 30, -20);
  const originalViewport = { ...viewport };
  const history = new DocumentHistory(before);
  history.record(before, after);
  const undone = history.undo(after);
  assert.equal(undone.layers[0].strokes.length, 0);
  assert.deepEqual(viewport, originalViewport);
});

test("zoom and pan do not create history entries", () => {
  const document = createDocument();
  const history = new DocumentHistory(document);
  let viewport = zoomAt(createViewport(), 2, { x: 500, y: 350 }, { x: 400, y: 300 });
  viewport = panBy(viewport, 25, -10);
  viewport = zoomAt(viewport, 1.5, { x: 450, y: 320 }, { x: 400, y: 300 });
  assert.equal(history.size(), 0);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
});

test("persistence round-trip restores the current Document after undo and redo", () => {
  const before = createDocument();
  const after = documentWithStroke();
  const history = new DocumentHistory(before);
  history.record(before, after);
  const undone = history.undo(after);
  const restoredAfterUndo = restoreDocument(JSON.parse(JSON.stringify(undone)));
  assert.deepEqual(restoredAfterUndo, undone);
  const redone = history.redo(undone);
  const restoredAfterRedo = restoreDocument(JSON.parse(JSON.stringify(redone)));
  assert.deepEqual(restoredAfterRedo, redone);
});

test("history snapshots are mutation-safe", () => {
  const before = createDocument();
  const after = documentWithStroke();
  const history = new DocumentHistory(before);
  history.record(before, after);
  after.layers[0].strokes[0].points[0].x = 9999;
  const undone = history.undo(after);
  assert.equal(undone.layers[0].strokes.length, 0);
  const redone = history.redo(undone);
  assert.equal(redone.layers[0].strokes[0].points[0].x, 10);
});


test("Image Layer creation is reversible through DocumentHistory", () => {
  const before = createDocument();
  const after = cloneDocument(before);
  const image = createImageLayer("Image");
  after.layers.push(image);
  const history = new DocumentHistory(before);
  history.record(before, after);
  const undone = history.undo(after);
  assert.equal(undone.layers.length, 1);
  const redone = history.redo(undone);
  assert.equal(redone.layers[1].contentType, "image");
  assert.equal(redone.layers[1].image.width, 64);
});

test("Image Layer transform is reversible through the same DocumentHistory", () => {
  const before = createDocument();
  const image = createImageLayer("Image");
  const withImage = cloneDocument(before);
  withImage.layers.push(image);
  const id = image.id;
  let after = translateLayer(withImage, id, 20, -10);
  after = scaleLayer(after, id, 1.5);
  after = rotateLayer(after, id, 30);
  const history = new DocumentHistory(withImage);
  history.record(withImage, after);
  const undone = history.undo(after);
  assert.deepEqual(undone.layers[1].transform, { x: 0, y: 0, scale: 1, rotation: 0 });
  const redone = history.redo(undone);
  assert.deepEqual(redone.layers[1].transform, { x: 20, y: -10, scale: 1.5, rotation: 30 });
});
