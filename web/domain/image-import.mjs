import { createImageLayer } from "./model.mjs";

export const MAX_IMPORT_FILE_BYTES = 1_500_000;
export const MAX_IMAGE_SOURCE_CHARS = 2_000_000;
export const MAX_DOCUMENT_STORAGE_CHARS = 2_500_000;

export function imageImportError(message) {
  return new Error(message);
}

export function validateImageFile(file) {
  if (!file || typeof file !== "object") throw imageImportError("No image file selected");
  if (Number.isFinite(file.size) && file.size > MAX_IMPORT_FILE_BYTES) {
    throw imageImportError("Image is too large for local Web storage (application limit: 1.5 MB per import)");
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

export function decodeImageSource(source, ImageCtor = globalThis.Image) {
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
      resolve({ width, height });
    };
    image.onerror = () => reject(imageImportError("Image could not be decoded by the browser"));
    try {
      image.src = source;
    } catch {
      reject(imageImportError("Image could not be decoded by the browser"));
    }
  });
}

export function createImportedImageLayer(fileName, source, width, height) {
  if (typeof source !== "string" || !source) throw imageImportError("Image source is empty");
  if (source.length > MAX_IMAGE_SOURCE_CHARS) {
    throw imageImportError("Image representation exceeds the conservative localStorage import limit");
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
    throw imageImportError("Image could not be saved in localStorage; the project was not changed");
  }
  return serialized;
}

export async function importImageFile(file, options = {}) {
  const validated = validateImageFile(file);
  const source = await readFileAsDataUrl(validated, options.Reader);
  const decoded = await decodeImageSource(source, options.ImageCtor);
  return {
    layer: createImportedImageLayer(validated.name, source, decoded.width, decoded.height),
    source
  };
}
