import { createImageLayer } from "./model.mjs";
import { cloneDocument } from "./history.mjs";

export const MAX_IMPORT_FILE_BYTES = 25_000_000;
export const MAX_IMAGE_SOURCE_CHARS = 2_000_000;
export const MAX_DOCUMENT_STORAGE_CHARS = 2_500_000;
export const MAX_IMPORT_IMAGE_DIMENSION = 8192;
export const MAX_IMPORT_IMAGE_PIXELS = 32_000_000;

export function imageImportError(message) {
  return new Error(message);
}

export function validateImageFile(file) {
  if (!file || typeof file !== "object") throw imageImportError("No image file selected");
  if (Number.isFinite(file.size) && file.size > MAX_IMPORT_FILE_BYTES) {
    throw imageImportError("Image exceeds the 25 MB import limit");
  }
  if (typeof file.type === "string" && file.type && !file.type.startsWith("image/")) {
    throw imageImportError("Selected file is not a supported image");
  }
  return file;
}

export function imageLayerName(fileName = "Image") {
  const name = String(fileName).trim() || "Image";
  return name.replace(/\.[^.]+$/, "") || "Image";
}

export function readFileAsDataUrl(file, Reader = globalThis.FileReader) {
  if (typeof Reader !== "function") return Promise.reject(imageImportError("File API is unavailable"));
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    reader.onload = () => {
      const source = typeof reader.result === "string" ? reader.result : "";
      if (!source) reject(imageImportError("Could not read image file"));
      else resolve(source);
    };
    reader.onerror = () => reject(imageImportError("Could not read image file"));
    try {
      reader.readAsDataURL(file);
    } catch {
      reject(imageImportError("Could not read image file"));
    }
  });
}

function loadImageElement(source, ImageCtor = globalThis.Image) {
  if (typeof source !== "string" || !source) return Promise.reject(imageImportError("Image source is empty"));
  if (typeof ImageCtor !== "function") return Promise.reject(imageImportError("Image decoder is unavailable"));
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => {
      const width = Number(image.naturalWidth || image.width);
      const height = Number(image.naturalHeight || image.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        reject(imageImportError("Image has invalid dimensions"));
        return;
      }
      resolve({ image, width, height });
    };
    image.onerror = () => reject(imageImportError("Image could not be decoded by the browser"));
    try {
      image.src = source;
    } catch {
      reject(imageImportError("Image could not be decoded by the browser"));
    }
  });
}

export async function decodeImageSource(source, ImageCtor = globalThis.Image) {
  const decoded = await loadImageElement(source, ImageCtor);
  return { width: decoded.width, height: decoded.height };
}

function dimensionsWithinLocalLimits(width, height) {
  return width <= MAX_IMPORT_IMAGE_DIMENSION &&
    height <= MAX_IMPORT_IMAGE_DIMENSION &&
    width * height <= MAX_IMPORT_IMAGE_PIXELS;
}

function boundedDimensions(width, height) {
  const scale = Math.min(
    1,
    MAX_IMPORT_IMAGE_DIMENSION / width,
    MAX_IMPORT_IMAGE_DIMENSION / height,
    Math.sqrt(MAX_IMPORT_IMAGE_PIXELS / (width * height))
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  };
}

function encodeCanvas(canvas, type, quality) {
  if (typeof canvas.toDataURL !== "function") throw imageImportError("Browser image encoding API is unavailable");
  try {
    return canvas.toDataURL(type, quality);
  } catch {
    return "";
  }
}

export async function optimizeImageSource(source, {
  ImageCtor = globalThis.Image,
  documentObject = globalThis.document
} = {}) {
  const decoded = await loadImageElement(source, ImageCtor);
  if (source.length <= MAX_IMAGE_SOURCE_CHARS &&
      dimensionsWithinLocalLimits(decoded.width, decoded.height)) {
    return { source, width: decoded.width, height: decoded.height, optimized: false };
  }
  if (!documentObject || typeof documentObject.createElement !== "function") {
    throw imageImportError("Image is too large for local storage and browser canvas processing is unavailable");
  }

  const initial = boundedDimensions(decoded.width, decoded.height);
  let width = initial.width;
  let height = initial.height;
  for (let sizeAttempt = 0; sizeAttempt < 9; sizeAttempt += 1) {
    const canvas = documentObject.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw imageImportError("Could not create an image optimization canvas");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, width, height);
    context.drawImage(decoded.image, 0, 0, width, height);

    for (const quality of [0.94, 0.9, 0.86, 0.82, 0.76, 0.7, 0.64]) {
      const webp = encodeCanvas(canvas, "image/webp", quality);
      if (webp.startsWith("data:image/webp;base64,") && webp.length <= MAX_IMAGE_SOURCE_CHARS) {
        return { source: webp, width, height, optimized: true, format: "image/webp" };
      }
    }

    const png = encodeCanvas(canvas, "image/png");
    if (png.startsWith("data:image/png;base64,") && png.length <= MAX_IMAGE_SOURCE_CHARS) {
      return { source: png, width, height, optimized: true, format: "image/png" };
    }

    width = Math.max(1, Math.floor(width * 0.82));
    height = Math.max(1, Math.floor(height * 0.82));
  }
  throw imageImportError("Could not optimize this image enough for local project storage. Try a smaller image.");
}


export function fitImportedImageScale(imageWidth, imageHeight, documentWidth, documentHeight, fill = 0.9) {
  const imageW = Number(imageWidth), imageH = Number(imageHeight);
  const canvasW = Number(documentWidth), canvasH = Number(documentHeight);
  const margin = Number(fill);
  if (![imageW,imageH,canvasW,canvasH,margin].every(Number.isFinite) ||
      imageW <= 0 || imageH <= 0 || canvasW <= 0 || canvasH <= 0 || margin <= 0 || margin > 1) {
    throw imageImportError("Image fit dimensions are invalid");
  }
  return Math.max(0.01, Math.min(48, canvasW * margin / imageW, canvasH * margin / imageH));
}

export function fitImportedImageTransform(imageWidth, imageHeight, documentWidth, documentHeight, fill = 0.9) {
  const scale = fitImportedImageScale(imageWidth, imageHeight, documentWidth, documentHeight, fill);
  const canvasW = Number(documentWidth), canvasH = Number(documentHeight);
  const imageW = Number(imageWidth), imageH = Number(imageHeight);
  return {
    scale,
    x: scale * (canvasW - imageW) / 2,
    y: scale * (canvasH - imageH) / 2
  };
}

export function createImportedImageLayer(fileName, source, width, height) {
  if (typeof source !== "string" || !source) throw imageImportError("Image source is empty");
  if (source.length > MAX_IMAGE_SOURCE_CHARS) {
    throw imageImportError("Image representation exceeds the local project storage limit");
  }
  if (!Number.isFinite(Number(width)) || Number(width) <= 0 || !Number.isFinite(Number(height)) || Number(height) <= 0) {
    throw imageImportError("Image has invalid dimensions");
  }
  return createImageLayer(imageLayerName(fileName), Number(width), Number(height), source);
}

export function serializeDocumentForStorage(document) {
  const serialized = JSON.stringify(document);
  if (serialized.length > MAX_DOCUMENT_STORAGE_CHARS) {
    throw imageImportError("Project exceeds the conservative localStorage storage limit");
  }
  return serialized;
}

export function persistDocumentSnapshot(storage, key, document) {
  const serialized = serializeDocumentForStorage(document);
  try {
    storage.setItem(key, serialized);
  } catch {
    throw imageImportError("Project could not be saved in localStorage; the current document was not changed");
  }
  return serialized;
}

export async function importImageFile(file, options = {}) {
  const validated = validateImageFile(file);
  const source = await readFileAsDataUrl(validated, options.Reader);
  const original = await decodeImageSource(source, options.ImageCtor);
  const optimized = await optimizeImageSource(source, {
    ImageCtor: options.ImageCtor,
    documentObject: options.documentObject
  });
  const layer = createImportedImageLayer(validated.name, optimized.source, optimized.width, optimized.height);
  if (optimized.width !== original.width || optimized.height !== original.height) {
    layer.transform.scale = Math.max(original.width / optimized.width, original.height / optimized.height);
  }
  return { layer, source: optimized.source, optimized: optimized.optimized === true, originalWidth: original.width, originalHeight: original.height };
}

export async function applyImageFileImport(file, { document, history, persist, Reader, ImageCtor, documentObject } = {}) {
  if (!document || !history || typeof persist !== "function") {
    throw imageImportError("Image import transaction is not configured");
  }
  const { layer, optimized } = await importImageFile(file, { Reader, ImageCtor, documentObject });
  if (Number(document.width) > 0 && Number(document.height) > 0) {
    layer.transform = { ...layer.transform, ...fitImportedImageTransform(layer.image.width, layer.image.height, document.width, document.height) };
  }
  const before = cloneDocument(document);
  const next = cloneDocument(document);
  next.layers.push(layer);
  if (!history.record(before, next)) {
    throw imageImportError("Image import did not create a history operation");
  }
  try {
    persist(next);
  } catch (error) {
    history.discardLastRecord();
    throw error;
  }
  return { document: next, layer, optimized };
}
