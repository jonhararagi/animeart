import test from "node:test";
import assert from "node:assert/strict";
import { createFrameScheduler } from "../domain/frame-scheduler.mjs";

function fakeFrames() {
  let nextId = 1;
  const callbacks = new Map();
  const cancelled = [];
  return {
    callbacks,
    cancelled,
    request(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      cancelled.push(id);
      callbacks.delete(id);
    },
    flush(id = callbacks.keys().next().value) {
      const callback = callbacks.get(id);
      if (!callback) return false;
      callbacks.delete(id);
      callback();
      return true;
    }
  };
}

test("many redraw requests are coalesced into one frame using the latest callback", () => {
  const frames = fakeFrames();
  const scheduler = createFrameScheduler(frames.request, frames.cancel);
  const calls = [];
  scheduler.schedule(() => calls.push("first"));
  scheduler.schedule(() => calls.push("second"));
  scheduler.schedule(() => calls.push("final"));
  assert.equal(frames.callbacks.size, 1);
  assert.equal(scheduler.pending, true);
  frames.flush();
  assert.deepEqual(calls, ["final"]);
  assert.equal(scheduler.pending, false);
});

test("cancel removes the pending frame and prevents stale callbacks", () => {
  const frames = fakeFrames();
  const scheduler = createFrameScheduler(frames.request, frames.cancel);
  let rendered = false;
  scheduler.schedule(() => { rendered = true; });
  const id = frames.callbacks.keys().next().value;
  scheduler.cancel();
  assert.deepEqual(frames.cancelled, [id]);
  assert.equal(scheduler.pending, false);
  assert.equal(frames.flush(id), false);
  assert.equal(rendered, false);
});

test("scheduler can be reused after cancellation and after a completed frame", () => {
  const frames = fakeFrames();
  const scheduler = createFrameScheduler(frames.request, frames.cancel);
  let calls = 0;
  scheduler.schedule(() => calls++);
  scheduler.cancel();
  scheduler.schedule(() => calls++);
  frames.flush();
  scheduler.schedule(() => calls++);
  frames.flush();
  assert.equal(calls, 2);
});

test("scheduler rejects missing callback and invalid frame functions", () => {
  assert.throws(() => createFrameScheduler(null, () => {}), /requires request and cancel/);
  const frames = fakeFrames();
  const scheduler = createFrameScheduler(frames.request, frames.cancel);
  assert.throws(() => scheduler.schedule(null), /frame callback is required/);
});
