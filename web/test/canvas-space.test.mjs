import test from "node:test";
import assert from "node:assert/strict";
import {
  documentCenter,
  documentFitScale,
  documentToScreenPoint,
  screenToDocumentPoint,
  screenViewportForDocument,
  zoomViewportAt
} from "../domain/canvas-space.mjs";

test("document coordinates fit the exported pixel dimensions inside the editor viewport", () => {
  const documentModel = { width: 800, height: 600 };
  const viewportSize = { width: 400, height: 300 };
  assert.deepEqual(documentCenter(documentModel), { x: 400, y: 300 });
  assert.equal(documentFitScale(documentModel, viewportSize), 0.5);
  assert.deepEqual(documentToScreenPoint({ x: 0, y: 0 }, documentModel, { zoom: 1, panX: 0, panY: 0 }, viewportSize), { x: 0, y: 0 });
  assert.deepEqual(documentToScreenPoint({ x: 800, y: 600 }, documentModel, { zoom: 1, panX: 0, panY: 0 }, viewportSize), { x: 400, y: 300 });
  assert.deepEqual(screenViewportForDocument(documentModel, { zoom: 1, panX: 0, panY: 0 }, viewportSize), { zoom: 0.5, panX: -200, panY: -150 });
});

test("screen/document coordinate mapping is reversible across fit, zoom and pan", () => {
  const documentModel = { width: 1280, height: 720 };
  const viewportSize = { width: 640, height: 480 };
  const viewport = { zoom: 1.75, panX: 23, panY: -17 };
  const source = { x: 1000, y: 321 };
  const screen = documentToScreenPoint(source, documentModel, viewport, viewportSize);
  const roundTrip = screenToDocumentPoint(screen, documentModel, viewport, viewportSize);
  assert.ok(Math.abs(roundTrip.x - source.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - source.y) < 1e-9);
});

test("zoom anchored at a screen point leaves the corresponding document point stationary", () => {
  const documentModel = { width: 800, height: 600 };
  const viewportSize = { width: 500, height: 400 };
  const viewport = { zoom: 1, panX: 5, panY: -7 };
  const screenPoint = { x: 183, y: 211 };
  const before = screenToDocumentPoint(screenPoint, documentModel, viewport, viewportSize);
  const next = zoomViewportAt(viewport, 2, screenPoint, documentModel, viewportSize);
  const after = screenToDocumentPoint(screenPoint, documentModel, next, viewportSize);
  assert.ok(Math.abs(before.x - after.x) < 1e-9);
  assert.ok(Math.abs(before.y - after.y) < 1e-9);
});
