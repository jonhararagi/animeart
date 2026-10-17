import test from "node:test";
import assert from "node:assert/strict";
import { CROP_SHAPE_KINDS, normalizeCropShape, traceCropShape } from "../domain/crop-shape.mjs";
import { exportScaleForResolution } from "../domain/png-export.mjs";

function makePathRecorder() {
  const calls = [];
  const methods = ["beginPath", "rect", "roundRect", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "ellipse", "closePath"];
  const context = Object.fromEntries(methods.map(method => [method, (...args) => calls.push({ method, args })]));
  return { context, calls };
}

test("crop-mask geometry supports the geometric crop catalog", () => {
  assert.deepEqual(CROP_SHAPE_KINDS, [
    "rectangle", "rounded", "circle", "ellipse", "triangle", "diamond",
    "pentagon", "hexagon", "octagon", "star", "heart"
  ]);
  for (const kind of CROP_SHAPE_KINDS) {
    const { context, calls } = makePathRecorder();
    assert.equal(traceCropShape(context, 10, 20, 300, 200, kind), context);
    assert.ok(calls.some(call => call.method === "beginPath"), kind + " starts a fresh path");
    assert.ok(calls.some(call => ["rect", "roundRect", "moveTo", "ellipse"].includes(call.method)), kind + " traces geometry");
  }
});

test("unknown crop masks safely fall back to a rectangle", () => {
  assert.equal(normalizeCropShape("not-a-shape"), "rectangle");
  assert.equal(normalizeCropShape("circle"), "circle");
  const { calls, context } = makePathRecorder();
  traceCropShape(context, 0, 0, 10, 10, "not-a-shape");
  assert.ok(calls.some(call => call.method === "rect"));
});

test("HD export targets 2x while bounding raster memory on phones", () => {
  assert.equal(exportScaleForResolution({ width: 1080, height: 1350 }, "normal"), 1);
  assert.equal(exportScaleForResolution({ width: 1080, height: 1350 }, "hd"), 2);
  const scale = exportScaleForResolution({ width: 3000, height: 3000 }, "hd");
  assert.ok(scale > 1 && scale < 2);
  assert.ok(Math.round(3000 * scale) ** 2 <= 16_000_100);
  assert.equal(exportScaleForResolution({ width: 5000, height: 4000 }, "hd"), 1);
  assert.throws(() => exportScaleForResolution({ width: 0, height: 400 }, "hd"), /positive document dimensions/);
});
