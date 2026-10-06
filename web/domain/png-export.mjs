export function createPngExportCanvas(documentModel, documentObject = globalThis.document) {
  const width = Number(documentModel?.width);
  const height = Number(documentModel?.height);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new TypeError("PNG export requires positive document dimensions");
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
  if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("PNG export canvas is invalid");
  if (typeof renderDocument !== "function") throw new TypeError("PNG export renderer is required");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("2D canvas context is unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  renderDocument({ context, document: documentModel, center });
  context.restore();
  return canvas;
}

export function canvasToPngBlob(canvas) {
  if (!canvas) return Promise.reject(new TypeError("PNG export canvas is required"));
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: "image/png" });
  }
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Browser could not encode PNG")), "image/png");
    });
  }
  return Promise.reject(new Error("PNG encoding API is unavailable"));
}

export function downloadPngBlob(blob, filename = "animeart.png", urlObject = globalThis.URL, documentObject = globalThis.document) {
  if (!blob) throw new TypeError("PNG blob is required");
  if (!urlObject || typeof urlObject.createObjectURL !== "function") throw new Error("Browser URL API is unavailable");
  if (!documentObject || typeof documentObject.createElement !== "function") throw new Error("Browser document API is unavailable");
  const anchor = documentObject.createElement("a");
  const url = urlObject.createObjectURL(blob);
  anchor.href = url;
  anchor.download = filename.endsWith(".png") ? filename : filename + ".png";
  anchor.click();
  if (typeof urlObject.revokeObjectURL === "function") {
    globalThis.setTimeout?.(() => urlObject.revokeObjectURL(url), 0);
  }
  return { filename: anchor.download, url };
}
