import test from "node:test";
import assert from "node:assert/strict";
import { getSmartSnapAdjustment } from "../domain/design-snapping.mjs";
test("snaps a moving layer to canvas center and reports transient guides", () => {
  const result = getSmartSnapAdjustment({ movingBounds: { left: 392, right: 492, top: 120, bottom: 220 }, canvasWidth: 800, canvasHeight: 600, threshold: 10 });
  assert.equal(result.dx, 8); assert.equal(result.dy, 0);
  assert.equal(result.guides[0].axis, "vertical"); assert.equal(result.guides[0].coordinate, 400);
});
test("snaps to another layer edges and centers without moving the target", () => {
  const result = getSmartSnapAdjustment({ movingBounds: { id: "moving", left: 204, right: 304, top: 100, bottom: 200 }, otherBounds: [{ id: "fixed", bounds: { left: 100, right: 200, top: 98, bottom: 198 } }], includeCanvas: false, threshold: 5 });
  assert.equal(result.dx, -4); assert.equal(result.dy, -2);
  assert.deepEqual(result.guides.map(guide => guide.axis), ["vertical", "horizontal"]);
});
test("does not snap beyond tolerance and ignores malformed targets", () => {
  const result = getSmartSnapAdjustment({ movingBounds: { left: 20, right: 60, top: 30, bottom: 70 }, otherBounds: [{ id: "bad", bounds: { left: NaN, right: 5, top: 0, bottom: 10 } }], canvasWidth: 800, canvasHeight: 600, threshold: 3 });
  assert.equal(result.snapped, false); assert.equal(result.dx, 0); assert.equal(result.dy, 0);
});
test("can disable canvas snapping and safely handles negative thresholds", () => {
  const result = getSmartSnapAdjustment({ movingBounds: { left: 1, right: 41, top: 1, bottom: 41 }, canvasWidth: 800, canvasHeight: 600, includeCanvas: false, threshold: -4 });
  assert.deepEqual(result, { dx: 0, dy: 0, guides: [], snapped: false });
});
