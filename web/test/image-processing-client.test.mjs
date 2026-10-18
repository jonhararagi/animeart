import test from "node:test";
import assert from "node:assert/strict";
import { createImageProcessingClient } from "../domain/image-processing-client.mjs";
import { replaceColorRange } from "../domain/color-replacement.mjs";

class FakeWorker {
  constructor(url, options) { this.url = url; this.options = options; this.terminated = false; }
  postMessage(message) {
    queueMicrotask(() => {
      try {
        const imageData = { width: message.width, height: message.height, data: new Uint8ClampedArray(message.buffer) };
        if (message.operation !== "replace-color-range") throw new Error("Unexpected operation: " + message.operation);
        const result = replaceColorRange(imageData, { ...message.options, mutate: true });
        this.onmessage?.({ data: {
          id: message.id, ok: true, width: result.width, height: result.height,
          changed: result.changed, buffer: result.data.buffer
        }});
      } catch (error) {
        this.onmessage?.({ data: { id: message.id, ok: false, error: error.message } });
      }
    });
  }
  terminate() { this.terminated = true; }
}

test("image processing client routes pixel work through a module worker and preserves preview source pixels", async () => {
  const client = createImageProcessingClient({ WorkerCtor: FakeWorker });
  const source = { width: 2, height: 1, data: new Uint8ClampedArray([128,64,32,255,0,0,0,0]) };
  const before = [...source.data];
  const result = await client.run("replace-color-range", source, {
    sourceColor: "#804020", targetColor: "#00aaff", tolerance: 0, softness: 0
  });
  assert.equal(result.width, 2);
  assert.notDeepEqual([...result.data.slice(0,3)], before.slice(0,3));
  assert.deepEqual([...source.data], before);
  assert.deepEqual(client.getDiagnostics(), {
    workerCreated: true, workerOperations: 1, fallbackOperations: 0, lastOperation: "replace-color-range"
  });
});

test("module-worker fallback remains functional when Worker is unavailable", async () => {
  const client = createImageProcessingClient({ WorkerCtor: null });
  const source = { width: 1, height: 1, data: new Uint8ClampedArray([128,64,32,255]) };
  const before = [...source.data];
  const result = await client.run("replace-color-range", source, {
    sourceColor: "#804020", targetColor: "#00aaff", tolerance: 0, softness: 0
  });
  assert.notDeepEqual([...result.data], before);
  assert.deepEqual([...source.data], before);
  assert.deepEqual(client.getDiagnostics(), {
    workerCreated: false, workerOperations: 0, fallbackOperations: 1, lastOperation: "replace-color-range"
  });
});

test("unsupported operations fail closed instead of silently running unknown work", async () => {
  const client = createImageProcessingClient({ WorkerCtor: null });
  await assert.rejects(() => client.run("decode-remote-image", { width: 1, height: 1, data: new Uint8ClampedArray(4) }), /Unsupported image-processing operation/);
});
