export function clearCanvasBackingStore(context, canvas, devicePixelRatio = 1) {
  if (!context || typeof context.setTransform !== "function" || typeof context.clearRect !== "function") throw new TypeError("A Canvas 2D rendering context is required");
  const width = Number(canvas?.width), height = Number(canvas?.height), ratio = Number(devicePixelRatio);
  if (!Number.isInteger(width) || width < 0 || !Number.isInteger(height) || height < 0) throw new TypeError("Canvas backing dimensions must be non-negative integers");
  if (!Number.isFinite(ratio) || ratio <= 0) throw new TypeError("Device pixel ratio must be a positive finite number");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, devicePixelRatio: ratio };
}
