export function createFrameScheduler(requestFrame, cancelFrame) {
  if (typeof requestFrame !== "function" || typeof cancelFrame !== "function") {
    throw new TypeError("Frame scheduler requires request and cancel functions");
  }

  let frameId = null;
  let pendingCallback = null;

  function schedule(callback) {
    if (typeof callback !== "function") throw new TypeError("A frame callback is required");
    pendingCallback = callback;
    if (frameId !== null) return;
    frameId = requestFrame(() => {
      frameId = null;
      const current = pendingCallback;
      pendingCallback = null;
      current?.();
    });
  }

  function cancel() {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    pendingCallback = null;
  }

  return Object.freeze({ schedule, cancel, get pending() { return frameId !== null; } });
}
