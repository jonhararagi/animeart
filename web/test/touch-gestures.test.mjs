import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../domain/model.mjs";
import { createViewport } from "../domain/viewport.mjs";
import {
  distanceBetweenTouches,
  midpointBetweenTouches,
  updatePinchPanViewport
} from "../domain/touch-gestures.mjs";

const documentModel = createDocument(1000, 1000);
const viewportSize = { width: 500, height: 500 };

test("touch helpers calculate distance and midpoint from two contacts", () => {
  assert.equal(distanceBetweenTouches({x:0,y:0},{x:3,y:4}),5);
  assert.deepEqual(midpointBetweenTouches({x:10,y:20},{x:30,y:60}),{x:20,y:40});
  assert.throws(() => distanceBetweenTouches({x:NaN,y:0},{x:0,y:0}), /finite/);
});

test("pinch gesture zooms in around the fingers and stays within editor limits", () => {
  const viewport = createViewport();
  const next = updatePinchPanViewport({
    startViewport: viewport, startDistance: 100, currentDistance: 180,
    startMidpoint: {x:250,y:250}, currentMidpoint: {x:250,y:250},
    documentModel, viewportSize, minZoom: 0.25, maxZoom: 4
  });
  assert.equal(next.zoom, 1.8);
  const capped = updatePinchPanViewport({
    startViewport: viewport, startDistance: 10, currentDistance: 1000,
    startMidpoint: {x:250,y:250}, currentMidpoint: {x:250,y:250},
    documentModel, viewportSize, minZoom: 0.25, maxZoom: 4
  });
  assert.equal(capped.zoom, 4);
});

test("two-finger translation pans without changing zoom and pinch-out zooms out", () => {
  const viewport = createViewport();
  const moved = updatePinchPanViewport({
    startViewport: viewport, startDistance: 100, currentDistance: 100,
    startMidpoint: {x:200,y:200}, currentMidpoint: {x:235,y:220},
    documentModel, viewportSize
  });
  assert.equal(moved.zoom, viewport.zoom);
  assert.equal(moved.panX, viewport.panX + 35);
  assert.equal(moved.panY, viewport.panY + 20);
  const zoomedOut = updatePinchPanViewport({
    startViewport: viewport, startDistance: 100, currentDistance: 50,
    startMidpoint: {x:250,y:250}, currentMidpoint: {x:250,y:250},
    documentModel, viewportSize
  });
  assert.equal(zoomedOut.zoom, 0.5);
});

test("invalid pinch input leaves the starting viewport unchanged", () => {
  const viewport = {zoom:1.5,panX:20,panY:-8};
  assert.deepEqual(updatePinchPanViewport({
    startViewport: viewport, startDistance: 0, currentDistance: 10,
    startMidpoint: {x:0,y:0}, currentMidpoint: {x:1,y:1},
    documentModel, viewportSize
  }), viewport);
});
