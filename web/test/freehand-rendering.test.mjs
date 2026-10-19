import test from "node:test";
import assert from "node:assert/strict";
import { traceSmoothStrokePath } from "../domain/freehand-rendering.mjs";

function createPathRecorder() {
  const calls = [];
  return {
    calls,
    context: {
      beginPath: () => calls.push(["beginPath"]),
      moveTo: (...args) => calls.push(["moveTo", ...args]),
      lineTo: (...args) => calls.push(["lineTo", ...args]),
      quadraticCurveTo: (...args) => calls.push(["quadraticCurveTo", ...args])
    }
  };
}

test("freehand rendering uses smooth quadratic midpoints and reaches the exact final sample", () => {
  const recorder = createPathRecorder();
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 12 },
    { x: 20, y: 4 },
    { x: 30, y: 16 }
  ];

  assert.equal(traceSmoothStrokePath(recorder.context, points), true);
  assert.deepEqual(recorder.calls[0], ["beginPath"]);
  assert.deepEqual(recorder.calls[1], ["moveTo", 0, 0]);
  assert.ok(recorder.calls.some(call => call[0] === "quadraticCurveTo"));
  assert.deepEqual(recorder.calls.at(-1), ["lineTo", 30, 16]);
});

test("two-point freehand stays a direct segment without inventing extra points", () => {
  const recorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(recorder.context, [{ x: 2, y: 3 }, { x: 8, y: 9 }]), true);
  assert.deepEqual(recorder.calls, [
    ["beginPath"],
    ["moveTo", 2, 3],
    ["lineTo", 8, 9]
  ]);
});

test("single-point freehand creates a zero-length segment for a round-cap dot", () => {
  const recorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(recorder.context, [{ x: 7, y: 11 }]), true);
  assert.deepEqual(recorder.calls, [
    ["beginPath"],
    ["moveTo", 7, 11],
    ["lineTo", 7, 11]
  ]);
});

test("empty and non-finite paths are rejected without creating partial paths", () => {
  const emptyRecorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(emptyRecorder.context, []), false);
  assert.deepEqual(emptyRecorder.calls, []);

  const invalidRecorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(invalidRecorder.context, [{ x: 1, y: 2 }, { x: Infinity, y: 3 }]), false);
  assert.deepEqual(invalidRecorder.calls, []);
});
