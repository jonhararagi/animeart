import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { traceSmoothStrokePath } from "../domain/freehand-rendering.mjs";

function createPathRecorder(overrides = {}) {
  const calls = [];
  const context = {
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    quadraticCurveTo: (...args) => calls.push(["quadraticCurveTo", ...args]),
    ...overrides
  };
  return { calls, context };
}

test("freehand drawing uses quadratic midpoints and reaches the exact last point", () => {
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

test("two-point strokes remain straight and preserve both endpoint coordinates", () => {
  const recorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(recorder.context, [{ x: 2, y: 3 }, { x: 8, y: 9 }]), true);
  assert.deepEqual(recorder.calls, [
    ["beginPath"],
    ["moveTo", 2, 3],
    ["lineTo", 8, 9]
  ]);
});

test("one-point brush strokes draw a dot with a zero-length segment", () => {
  const recorder = createPathRecorder();
  assert.equal(traceSmoothStrokePath(recorder.context, [{ x: 7, y: 11 }]), true);
  assert.deepEqual(recorder.calls, [
    ["beginPath"],
    ["moveTo", 7, 11],
    ["lineTo", 7, 11]
  ]);
});

test("empty or non-finite paths are rejected before touching the canvas context", () => {
  const empty = createPathRecorder();
  assert.equal(traceSmoothStrokePath(empty.context, []), false);
  assert.deepEqual(empty.calls, []);

  const invalid = createPathRecorder();
  assert.equal(traceSmoothStrokePath(invalid.context, [{ x: 1, y: 2 }, { x: Infinity, y: 3 }]), false);
  assert.deepEqual(invalid.calls, []);
});

test("smooth curves require quadraticCurveTo only for paths with three or more points", () => {
  const recorder = createPathRecorder({ quadraticCurveTo: undefined });
  assert.equal(traceSmoothStrokePath(recorder.context, [{ x: 0, y: 0 }, { x: 5, y: 5 }]), true);
  const invalid = createPathRecorder({ quadraticCurveTo: undefined });
  assert.equal(traceSmoothStrokePath(invalid.context, [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 9, y: 0 }]), false);
  assert.deepEqual(invalid.calls, []);
});

test("smooth renderer is available in the offline shell and Android package", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  const androidWorkflow = await readFile(new URL("../../.github/workflows/android.yml", import.meta.url), "utf8");

  assert.ok(app.includes('const OFFLINE_CACHE_NAME = "animeart-web-shell-v55"'));
  assert.ok(app.includes('"./domain/freehand-rendering.mjs"'));
  assert.ok(worker.includes('const CACHE_NAME = "animeart-web-shell-v55"'));
  assert.ok(worker.includes('"./domain/freehand-rendering.mjs"'));
  assert.ok(androidWorkflow.includes('test -s "$WEB/domain/freehand-rendering.mjs"'));
});
