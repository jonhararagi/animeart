import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createViewport, documentToScreen, screenToDocument, zoomAt } from "../domain/viewport.mjs";

test("screen/document coordinates remain reversible at 25%, 100% and 400% zoom", () => {
  const center = { x: 400, y: 300 };
  const point = { x: 123.25, y: 456.75 };
  for (const zoom of [0.25, 1, 4]) {
    const viewport = createViewport(zoom, 37, -21);
    const screen = documentToScreen(point, viewport, center);
    const roundTrip = screenToDocument(screen, viewport, center);
    assert.ok(Math.abs(roundTrip.x - point.x) < 1e-9, `x mismatch at zoom ${zoom}`);
    assert.ok(Math.abs(roundTrip.y - point.y) < 1e-9, `y mismatch at zoom ${zoom}`);
  }
});

test("zoom anchor remains under the cursor while changing zoom", () => {
  const center = { x: 400, y: 300 };
  const cursor = { x: 117, y: 239 };
  const viewport = createViewport(0.25, -35, 19);
  const anchoredDocumentPoint = screenToDocument(cursor, viewport, center);
  const next = zoomAt(viewport, 4, cursor, center);
  const after = screenToDocument(cursor, next, center);
  assert.ok(Math.abs(after.x - anchoredDocumentPoint.x) < 1e-9);
  assert.ok(Math.abs(after.y - anchoredDocumentPoint.y) < 1e-9);
});

test("canvas rendering is frame-coalesced and freehand consumes coalesced pointer samples", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /redrawScheduler\.schedule\(drawNow\)/);
  assert.match(app, /function drawNow\(\)/);
  assert.match(app, /function appendFreehandPointerSamples\(stroke, event/);
  assert.match(app, /const points = samples\.length \? \[\.\.\.samples, event\] : \[event\]/);
  assert.match(app, /appendFreehandPointerSamples\(stroke, event\)/);
  assert.match(app, /appendFinalFreehandPoint\(activeStroke, event\)/);
  assert.match(app, /traceSmoothStrokePath\(context, stroke\.points\)/);
});

test("release position is applied before committing layer transforms", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const pointerUp = app.slice(app.indexOf('canvas.addEventListener("pointerup", event => {'), app.indexOf('canvas.addEventListener("pointerleave"'));
  assert.match(pointerUp, /updateTransformPreview\(event\)/);
  assert.match(pointerUp, /interaction\.previewDelta = constrainMoveDelta\(layers, current\.x - interaction\.startDocument\.x, current\.y - interaction\.startDocument\.y\)/);
});

test("pinch-to-one-finger transition establishes a fresh pan origin", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const endTouch = app.slice(app.indexOf("function endTouchPointer(event)"), app.indexOf("function imageErasePoint(event"));
  assert.match(endTouch, /const remaining = activeTouchPointers\.values\(\)\.next\(\)\.value/);
  assert.match(endTouch, /state\.panning = Boolean\(remaining\)/);
  assert.match(endTouch, /state\.lastPanPoint = remaining \? \{ x: remaining\.x, y: remaining\.y \} : null/);
});

test("reduced-motion preference disables UI animation without disabling interaction logic", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition-duration: 0\.01ms !important/);
  assert.match(app, /canvas\.addEventListener\("pointerdown"/);
  assert.match(app, /canvas\.addEventListener\("pointercancel"/);
  assert.match(app, /dragThreshold: event\.pointerType === "touch" \? \(layer\.contentType === "text" \? 8 : 4\) : 2/);
  assert.match(app, /travelled < \(interaction\.dragThreshold \?\? 3\)/);
});

test("freehand event coordinates are passed to createStrokePoint as separate document x/y numbers", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const pointFromEvent = app.slice(
    app.indexOf("function pointFromEvent(event)"),
    app.indexOf("function screenPointFromEvent(event)")
  );
  assert.match(pointFromEvent, /const documentPoint = screenToDocumentPoint\(screenPoint, state\.document, state\.viewport, canvasSize\(\)\)/);
  assert.match(pointFromEvent, /createStrokePoint\(documentPoint\.x, documentPoint\.y\)/);
  assert.doesNotMatch(pointFromEvent, /createStrokePoint\(screenToDocumentPoint\(/);
});

