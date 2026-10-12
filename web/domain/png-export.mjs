const FORMAT_MIME_TYPES = Object.freeze({
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp"
});

function normalizedFormat(format) {
  const value = String(format || "png").toLowerCase();
  if (!Object.hasOwn(FORMAT_MIME_TYPES, value)) {
    throw new TypeError("Unsupported export format. Choose PNG, JPEG or WebP");
  }
  return value;
}

export function createPngExportCanvas(documentModel, documentObject = globalThis.document) {
  const width = Number(documentModel?.width);
  const height = Number(documentModel?.height);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new TypeError("Image export requires positive document dimensions");
  }
  if (!documentObject || typeof documentObject.createElement !== "function") {
    throw new Error("Browser document API is unavailable");
  }
  const canvas = documentObject.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function renderDocumentToCanvas(documentModel, canvas, renderDocument) {
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Image export canvas is invalid");
  if (typeof renderDocument !== "function") throw new TypeError("Image export renderer is required");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("2D canvas context is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  context.translate(center.x, center.y);
  renderDocument({ context, document: documentModel, center });
  context.restore();
  return canvas;
}

export function canvasToImageBlob(canvas, format = "png", quality = 0.92) {
  if (!canvas) return Promise.reject(new TypeError("Image export canvas is required"));
  let normalized;
  try {
    normalized = normalizedFormat(format);
  } catch (error) {
    return Promise.reject(error);
  }
  const mimeType = FORMAT_MIME_TYPES[normalized];
  const boundedQuality = Math.min(1, Math.max(0.5, Number.isFinite(Number(quality)) ? Number(quality) : 0.92));
  const encode = typeof canvas.convertToBlob === "function"
    ? canvas.convertToBlob.bind(canvas)
    : typeof canvas.toBlob === "function"
      ? options => new Promise((resolve, reject) => {
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Browser could not encode " + normalized.toUpperCase())), options.type, options.quality);
        })
      : null;
  if (!encode) return Promise.reject(new Error("Image encoding API is unavailable"));
  return encode({ type: mimeType, ...(normalized === "png" ? {} : { quality: boundedQuality }) }).then(blob => {
    if (!blob) throw new Error("Browser could not encode " + normalized.toUpperCase());
    if (blob.type && blob.type !== mimeType) {
      throw new Error("This browser does not support " + normalized.toUpperCase() + " export");
    }
    return blob;
  });
}

export function canvasToPngBlob(canvas) {
  return canvasToImageBlob(canvas, "png");
}

export function downloadImageBlob(blob, filename = "animeart.png", format = "png", urlObject = globalThis.URL, documentObject = globalThis.document) {
  if (!blob) throw new TypeError("Image blob is required");
  const normalized = normalizedFormat(format);
  if (!urlObject || typeof urlObject.createObjectURL !== "function") throw new Error("Browser URL API is unavailable");
  if (!documentObject || typeof documentObject.createElement !== "function") throw new Error("Browser document API is unavailable");
  const anchor = documentObject.createElement("a");
  const url = urlObject.createObjectURL(blob);
  const extension = "." + normalized;
  anchor.href = url;
  anchor.download = String(filename || ("animeart" + extension)).replace(/\.(png|jpe?g|webp)$/i, "") + extension;
  anchor.click();
  if (typeof urlObject.revokeObjectURL === "function") {
    globalThis.setTimeout?.(() => urlObject.revokeObjectURL(url), 0);
  }
  return { filename: anchor.download, url };
}

export function downloadPngBlob(blob, filename = "animeart.png", urlObject = globalThis.URL, documentObject = globalThis.document) {
  return downloadImageBlob(blob, filename, "png", urlObject, documentObject);
}
