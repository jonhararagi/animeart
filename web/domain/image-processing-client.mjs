import { replaceColorRange } from "./color-replacement.mjs";
import { applyEraseStrokes, removeConnectedBackground } from "./background-removal.mjs";

const SYNCHRONOUS_OPERATIONS = Object.freeze({
  "replace-color-range": (imageData, options) => replaceColorRange(imageData, options),
  "remove-connected-background": (imageData, options) => removeConnectedBackground(imageData, options),
  "apply-erase-strokes": (imageData, options) => applyEraseStrokes(imageData, options?.strokes || [])
});
const WORKER_URL = new URL("../workers/image-processing-worker.mjs", import.meta.url);
let defaultClient = null;

export function createImageProcessingClient({
  WorkerCtor = globalThis.Worker,
  workerUrl = WORKER_URL
} = {}) {
  let worker = null;
  let workerUnavailable = false;
  let nextRequestId = 1;
  let activeJob = null;
  const queue = [];
  const stats = { workerCreated: false, workerOperations: 0, fallbackOperations: 0, lastOperation: null };

  function publishStats() {
    if (globalThis.__ANIMEART_E2E_DIAGNOSTICS__) {
      globalThis.__ANIMEART_IMAGE_PROCESSING_DIAGNOSTICS__ = { ...stats };
    }
  }

  function runSynchronously(job) {
    stats.fallbackOperations += 1;
    stats.lastOperation = job.operation;
    publishStats();
    try {
      const operation = SYNCHRONOUS_OPERATIONS[job.operation];
      if (!operation) throw new TypeError("Unsupported image-processing operation");
      job.resolve(operation(job.imageData, job.options));
    } catch (error) {
      job.reject(error);
    }
  }

  function ensureWorker() {
    if (worker || workerUnavailable) return worker;
    if (typeof WorkerCtor !== "function") {
      workerUnavailable = true;
      return null;
    }
    try {
      worker = new WorkerCtor(workerUrl, { type: "module" });
      stats.workerCreated = true;
      worker.onmessage = event => {
        const message = event?.data;
        const job = activeJob;
        if (!job || message?.id !== job.id) return;
        activeJob = null;
        if (!message.ok) {
          job.reject(new Error(message.error || "Image processing failed in the worker"));
        } else {
          const result = { width: message.width, height: message.height, data: new Uint8ClampedArray(message.buffer) };
          if (typeof message.changed === "boolean") result.changed = message.changed;
          job.resolve(result);
        }
        publishStats();
        pump();
      };
      worker.onerror = event => {
        const failed = activeJob;
        activeJob = null;
        try { worker?.terminate(); } catch {}
        worker = null;
        workerUnavailable = true;
        if (failed) failed.reject(new Error(event?.message || "Image-processing worker stopped unexpectedly"));
        publishStats();
        pump();
      };
      return worker;
    } catch {
      workerUnavailable = true;
      worker = null;
      return null;
    }
  }

  function pump() {
    if (activeJob || queue.length === 0) return;
    const currentWorker = ensureWorker();
    const job = queue.shift();
    if (!currentWorker) {
      runSynchronously(job);
      queueMicrotask(pump);
      return;
    }

    // Slider previews clone their source once. One-shot pixel edits can transfer
    // their temporary ImageData to avoid another full RGBA allocation.
    const source = job.imageData?.data;
    let pixels;
    if (job.transferInput && source instanceof Uint8ClampedArray &&
        source.byteOffset === 0 && source.byteLength === source.buffer.byteLength) {
      pixels = source;
    } else if (source && typeof source.length === "number") {
      pixels = new Uint8ClampedArray(source);
    } else {
      job.reject(new TypeError("Image processing requires a pixel buffer"));
      queueMicrotask(pump);
      return;
    }

    activeJob = job;
    stats.workerOperations += 1;
    stats.lastOperation = job.operation;
    publishStats();
    try {
      currentWorker.postMessage({
        id: job.id,
        operation: job.operation,
        width: Number(job.imageData.width),
        height: Number(job.imageData.height),
        buffer: pixels.buffer,
        options: job.options
      }, [pixels.buffer]);
    } catch (error) {
      activeJob = null;
      if (job.imageData?.data?.buffer?.byteLength > 0) runSynchronously(job);
      else job.reject(error instanceof Error ? error : new Error("Could not start image processing"));
      pump();
    }
  }

  function run(operation, imageData, options = {}, { transferInput = false } = {}) {
    if (!Object.hasOwn(SYNCHRONOUS_OPERATIONS, operation)) {
      return Promise.reject(new TypeError("Unsupported image-processing operation"));
    }
    if (!imageData || !imageData.data) {
      return Promise.reject(new TypeError("Image processing requires image pixels"));
    }
    return new Promise((resolve, reject) => {
      queue.push({ id: nextRequestId++, operation, imageData, options, transferInput: transferInput === true, resolve, reject });
      pump();
    });
  }

  return Object.freeze({ run, getDiagnostics: () => Object.freeze({ ...stats }) });
}

export function getImageProcessingDiagnostics() {
  return defaultClient?.getDiagnostics() || {
    workerCreated: false, workerOperations: 0, fallbackOperations: 0, lastOperation: null
  };
}

export function runImageProcessing(...args) {
  if (!defaultClient) defaultClient = createImageProcessingClient();
  return defaultClient.run(...args);
}
