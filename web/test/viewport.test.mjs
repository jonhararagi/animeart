import test from "node:test";
import assert from "node:assert/strict";
import { createViewport, documentToScreen, isValidViewport, normalizeViewport, panBy, screenToDocument, zoomAt } from "../domain/viewport.mjs";

const center = { x: 400, y: 300 };
const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) <= epsilon;

test("viewport identity maps document and screen coordinates equally", () => {
  const viewport = createViewport();
  const point = { x: 120, y: 80 };
  assert.deepEqual(documentToScreen(point, viewport), point);
  assert.deepEqual(screenToDocument(point, viewport), point);
});

test("viewport zoom scales around the document center", () => {
  const viewport = createViewport(2, 0, 0);
  assert.deepEqual(documentToScreen({ x: 450, y: 350 }, viewport, center), { x: 500, y: 400 });
  assert.deepEqual(screenToDocument({ x: 500, y: 400 }, viewport, center), { x: 450, y: 350 });
});

test("viewport pan translates screen coordinates", () => {
  const viewport = panBy(createViewport(), 25, -10);
  assert.deepEqual(documentToScreen({ x: 120, y: 80 }, viewport), { x: 145, y: 70 });
  assert.deepEqual(screenToDocument({ x: 145, y: 70 }, viewport), { x: 120, y: 80 });
});

test("screen to document round trip is reversible for multiple zoom/pan states", () => {
  for (const viewport of [createViewport(), createViewport(2, 40, -25), createViewport(0.5, -30, 20)]) {
    for (const point of [{ x: 0, y: 0 }, { x: 123.5, y: 456.25 }, { x: -80, y: 220 }]) {
      const screen = documentToScreen(point, viewport, center);
      const document = screenToDocument(screen, viewport, center);
      assert.equal(close(document.x, point.x), true);
      assert.equal(close(document.y, point.y), true);
    }
  }
});

test("zoomAt keeps the document point under the cursor stable", () => {
  const viewport = createViewport(1, 30, -20);
  const cursor = { x: 510, y: 360 };
  const before = screenToDocument(cursor, viewport, center);
  const zoomed = zoomAt(viewport, 2, cursor, center);
  const after = screenToDocument(cursor, zoomed, center);
  assert.equal(close(after.x, before.x), true);
  assert.equal(close(after.y, before.y), true);
});

test("viewport rejects invalid zoom and non-finite pan", () => {
  assert.deepEqual(normalizeViewport({ zoom: 0, panX: Infinity, panY: NaN }), { zoom: 1, panX: 0, panY: 0 });
  assert.equal(isValidViewport(createViewport()), true);
  assert.equal(isValidViewport({ zoom: 0, panX: 0, panY: 0 }), false);
  assert.equal(isValidViewport({ zoom: 1, panX: Infinity, panY: 0 }), false);
});


test("combined zoom and pan maps the same document point under the viewport", () => {
  const viewport = panBy(createViewport(2, 40, -25), 15, 10);
  const point = { x: 250, y: 175 };
  const screen = documentToScreen(point, viewport, center);
  const document = screenToDocument(screen, viewport, center);
  assert.equal(close(document.x, point.x), true);
  assert.equal(close(document.y, point.y), true);
});

test("viewport navigation does not mutate document, stroke point, or layer transform data", () => {
  const strokePoint = { x: 120, y: 80 };
  const layer = { transform: { x: 12, y: -7, scale: 1.5, rotation: 20 } };
  const originalPoint = { ...strokePoint };
  const originalTransform = { ...layer.transform };
  const originalViewport = createViewport();
  const zoomed = zoomAt(originalViewport, 2, { x: 500, y: 350 }, center);
  const panned = panBy(zoomed, 30, -20);
  assert.deepEqual(strokePoint, originalPoint);
  assert.deepEqual(layer.transform, originalTransform);
  assert.deepEqual(originalViewport, { zoom: 1, panX: 0, panY: 0 });
  assert.equal(isValidViewport(panned), true);
});

test("viewport navigation returns new state instead of mutating its input", () => {
  const viewport = createViewport(1, 10, 20);
  const before = { ...viewport };
  panBy(viewport, 5, 6);
  zoomAt(viewport, 2, { x: 450, y: 320 }, center);
  assert.deepEqual(viewport, before);
});
