import { replaceColorRange } from "../domain/color-replacement.mjs";
import { applyEraseStrokes, removeConnectedBackground } from "../domain/background-removal.mjs";

function execute(operation, imageData, options) {
  if (operation === "replace-color-range") return replaceColorRange(imageData, { ...options, mutate: true });
  if (operation === "remove-connected-background") return removeConnectedBackground(imageData, { ...options, mutate: true });
  if (operation === "apply-erase-strokes") return applyEraseStrokes(imageData, options?.strokes || [], { mutate: true });
  throw new TypeError("Unsupported image-processing operation");
}

self.addEventListener("message", event => {
  const message = event?.data;
  if (!message || !Number.isInteger(message.id) || !(message.buffer instanceof ArrayBuffer)) return;
  try {
    const imageData = { width: Number(message.width), height: Number(message.height), data: new Uint8ClampedArray(message.buffer) };
    const result = execute(message.operation, imageData, message.options || {});
    self.postMessage({
      id: message.id, ok: true, width: result.width, height: result.height,
      changed: typeof result.changed === "boolean" ? result.changed : undefined,
      buffer: result.data.buffer
    }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: error?.message || "Image processing failed" });
  }
});
