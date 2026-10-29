import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createViewport, documentToScreen, screenToDocument, zoomAt } from "../domain/viewport.mjs";
import { appendInterpolatedStrokePoint } from "../domain/stroke-smoothing.mjs";

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

test("canvas rendering is frame-coalesced and freehand uses smooth coalesced samples", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(app.includes("redrawScheduler.schedule(drawNow)"));
  assert.ok(app.includes("function drawNow()"));
  assert.ok(app.includes('typeof event.getCoalescedEvents === "function"'));
  assert.ok(app.includes("appendInterpolatedStrokePoint"));
  assert.ok(app.includes("appendSmoothStrokeSamples"));
  assert.ok(app.includes("traceSmoothStrokePath"));
  assert.ok(app.includes("finalStroke"));
  assert.ok(app.includes("currentSelectedLayer"));
  assert.ok(app.includes('dragThreshold: event.pointerType === "touch" ? (layer.contentType === "text" ? 8 : 4) : 2'));
  assert.ok(app.includes("travelled < (interaction.dragThreshold ?? 3)"));
});

test("release position is applied before committing layer transforms", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const pointerUp = app.slice(app.indexOf('canvas.addEventListener("pointerup", event => {'), app.indexOf('canvas.addEventListener("pointerleave"'));
  assert.match(pointerUp, /updateTransformPreview\(event\)/);
  assert.match(pointerUp, /interaction\.previewDelta = snapMoveDelta\(layers, current\.x - interaction\.startDocument\.x, current\.y - interaction\.startDocument\.y\)/);
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



test("freehand interpolation fills gaps and preserves the final pointer position", () => {
  const points = [{ x: 0, y: 0 }];
  const createPoint = (x, y) => ({ x, y });
  const added = appendInterpolatedStrokePoint(points, { x: 10, y: 0 }, createPoint, 3);
  assert.equal(added, 4);
  assert.deepEqual(points.map(point => point.x), [0, 2.5, 5, 7.5, 10]);
  assert.ok(points.every(point => point.y === 0));
});

test("freehand interpolation seeds empty strokes and ignores repeated samples", () => {
  const points = [];
  const createPoint = (x, y) => ({ x, y });
  assert.equal(appendInterpolatedStrokePoint(points, { x: 2, y: 3 }, createPoint, 2), 1);
  assert.deepEqual(points, [{ x: 2, y: 3 }]);
  assert.equal(appendInterpolatedStrokePoint(points, { x: 2.001, y: 3 }, createPoint, 2), 0);
  assert.equal(points.length, 1);
});

test("freehand interpolation safely rejects invalid coordinates and spacing", () => {
  const points = [{ x: 1, y: 1 }];
  const createPoint = (x, y) => ({ x, y });
  assert.equal(appendInterpolatedStrokePoint(points, { x: Number.NaN, y: 2 }, createPoint, 2), 0);
  assert.equal(appendInterpolatedStrokePoint(points, { x: 2, y: 2 }, null, 2), 0);
  assert.throws(() => appendInterpolatedStrokePoint(points, { x: 2, y: 2 }, createPoint, 0), RangeError);
  assert.equal(points.length, 1);
});


test("real-browser E2E protects drag targeting for overlapping stickers", async () => {
  const browserE2E = await readFile(new URL("../scripts/browser-e2e.mjs", import.meta.url), "utf8");
  assert.ok(browserE2E.includes("AA-OVERLAP-DRAG-001"));
  assert.ok(browserE2E.includes("dragging at an overlap moves the already selected sticker underneath"));
  assert.ok(browserE2E.includes("the upper overlapping sticker stays in place"));
});


test("magnetic snapping has a visible reversible toggle and free-move bypass", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(app, /magneticSnappingEnabled: true/);
  assert.match(app, /if \(!state\.magneticSnappingEnabled\) \{ state\.snapGuides = \[\]; return constrained; \}/);
  assert.match(app, /magnetic-snapping-toggle/);
  assert.match(html, /id="magnetic-snapping-toggle"[^>]*aria-pressed="true"/);
  assert.match(app, /Desactivar ajuste magnético y mover libremente/);
  assert.match(app, /Activar ajuste magnético/);
});

test("mobile canvas tool tray can be hidden and restored with finger-sized controls", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="mobile-tools-toggle"/);
  assert.match(app, /mobile-tools-collapsed/);
  assert.match(app, /Mostrar herramientas/);
  assert.match(css, /\.mobile-tools-toggle \{ min-height: 48px; max-height: 48px; \}/);
  assert.match(css, /\.toolbar button, \.mobile-touch-dock button, \.layers button,[\s\S]*?min-height: 48px/);
});
