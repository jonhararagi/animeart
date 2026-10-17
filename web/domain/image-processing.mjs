export const MAX_RASTER_DIMENSION = 8192;
export const MAX_RASTER_PIXELS = 32_000_000;

export function validateRasterDimensions(width, height) {
  const w = Number(width), h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 ||
      w > MAX_RASTER_DIMENSION || h > MAX_RASTER_DIMENSION || w * h > MAX_RASTER_PIXELS) {
    throw new RangeError("Image dimensions must be positive integers, at most 8192 px per side and 32 megapixels total");
  }
  return { width: w, height: h };
}

export function normalizeImageCrop(rectangle, imageWidth, imageHeight) {
  const sourceWidth = Number(imageWidth), sourceHeight = Number(imageHeight);
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) {
    throw new TypeError("Source image dimensions are invalid");
  }
  const x = Number(rectangle?.x), y = Number(rectangle?.y);
  const width = Number(rectangle?.width), height = Number(rectangle?.height);
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1 ||
      x + width > sourceWidth || y + height > sourceHeight) {
    throw new RangeError("Crop rectangle must stay inside the source image and have a positive whole-pixel size");
  }
  validateRasterDimensions(width, height);
  return { x, y, width, height };
}

function decodeImage(source, ImageCtor) {
  if (typeof source !== "string" || !source) return Promise.reject(new TypeError("Image source is empty"));
  if (typeof ImageCtor !== "function") return Promise.reject(new Error("This browser does not provide an image decoder"));
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => {
      const width = Number(image.naturalWidth || image.width);
      const height = Number(image.naturalHeight || image.height);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        reject(new Error("Image has invalid pixel dimensions"));
        return;
      }
      resolve({ image, width, height });
    };
    image.onerror = () => reject(new Error("Browser could not decode the selected image"));
    try { image.src = source; } catch { reject(new Error("Browser could not decode the selected image")); }
  });
}

function createOutputCanvas(width, height, documentObject) {
  validateRasterDimensions(width, height);
  if (!documentObject || typeof documentObject.createElement !== "function") throw new Error("Browser canvas API is unavailable");
  const canvas = documentObject.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Could not create an image processing canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function encodeRaster(canvas) {
  if (typeof canvas.toDataURL !== "function") throw new Error("Browser image encoding API is unavailable");
  let source = canvas.toDataURL("image/png");
  let format = "image/png";
  if (typeof source !== "string" || !source.startsWith("data:image/png;base64,") || source.length < 32) {
    throw new Error("Browser could not encode the processed image as PNG");
  }
  if (source.length > 2_000_000) {
    source = canvas.toDataURL("image/webp", 0.86);
    format = source.startsWith("data:image/webp;base64,") ? "image/webp" : "image/png";
  }
  if (typeof source !== "string" || source.length > 2_000_000) {
    throw new RangeError("Processed image still exceeds the safe 2 MB image-layer limit. Reduce the output dimensions.");
  }
  return { source, format };
}

import { normalizeCropShape, traceCropShape } from "./crop-shape.mjs";

export async function cropImageSource(source, rectangle, {
  ImageCtor = globalThis.Image,
  documentObject = globalThis.document,
  shape = "rectangle",
  flipX = false,
  flipY = false
} = {}) {
  const decoded = await decodeImage(source, ImageCtor);
  const crop = normalizeImageCrop(rectangle, decoded.width, decoded.height);
  const { canvas, context } = createOutputCanvas(crop.width, crop.height, documentObject);
  context.drawImage(decoded.image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const mask = normalizeCropShape(shape);
  if (mask !== "rectangle") {
    context.save();
    context.globalCompositeOperation = "destination-in";
    context.save();
    if (flipX) { context.translate(crop.width, 0); context.scale(-1, 1); }
    if (flipY) { context.translate(0, crop.height); context.scale(1, -1); }
    traceCropShape(context, 0, 0, crop.width, crop.height, mask);
    context.fillStyle = "#ffffff";
    context.fill();
    context.restore();
    context.restore();
  }
  return { ...encodeRaster(canvas), width: crop.width, height: crop.height };
}

export async function resizeImageSource(source, width, height, { ImageCtor = globalThis.Image, documentObject = globalThis.document } = {}) {
  const dimensions = validateRasterDimensions(width, height);
  const decoded = await decodeImage(source, ImageCtor);
  const { canvas, context } = createOutputCanvas(dimensions.width, dimensions.height, documentObject);
  context.drawImage(decoded.image, 0, 0, dimensions.width, dimensions.height);
  return { ...encodeRaster(canvas), ...dimensions };
}
