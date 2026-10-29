import { isValidDocument, restoreDocument } from "./model.mjs";

export const MAX_DESIGN_RESIZE_DIMENSION = 8192;
export const MAX_DESIGN_RESIZE_PIXELS = 40_000_000;
export const DESIGN_RESIZE_MODES = Object.freeze(["fit", "fill", "reframe"]);

/**
 * Resize a document's canvas without flattening its layer stack.
 *
 * fit: scale the composition uniformly so all original content fits in the new canvas.
 * fill: scale uniformly until the new canvas is covered; content outside it is clipped
 *       only by the viewport and remains editable if the canvas is enlarged later.
 * reframe: change only the canvas dimensions; retain each layer's display size and offset.
 *
 * Layer x/y values are offsets from the document center, so scaling them by the same
 * factor keeps the composition centered while preserving rotations, layer IDs, groups,
 * text, source image pixels, masks, opacity, visibility and editability.
 */
export function resizeDocumentForFormat(documentModel, width, height, mode = "fit") {
  if (!isValidDocument(documentModel)) {
    throw new TypeError("Redimensionar requiere un proyecto editable válido.");
  }

  const sourceWidth = Number(documentModel.width);
  const sourceHeight = Number(documentModel.height);
  validateDimensions(sourceWidth, sourceHeight, "El lienzo actual");
  const targetWidth = Number(width);
  const targetHeight = Number(height);
  validateDimensions(targetWidth, targetHeight, "El nuevo formato");

  if (!DESIGN_RESIZE_MODES.includes(mode)) {
    throw new TypeError("Modo de redimensionado no válido.");
  }

  const ratioX = targetWidth / sourceWidth;
  const ratioY = targetHeight / sourceHeight;
  const factor = mode === "fit"
    ? Math.min(ratioX, ratioY)
    : mode === "fill"
      ? Math.max(ratioX, ratioY)
      : 1;

  const next = restoreDocument(JSON.parse(JSON.stringify(documentModel)));
  if (!next || !isValidDocument(next)) {
    throw new TypeError("No se pudo preparar una copia válida del proyecto.");
  }

  if (mode !== "reframe") {
    for (const layer of next.layers) {
      layer.transform = {
        ...layer.transform,
        x: layer.transform.x * factor,
        y: layer.transform.y * factor,
        scale: layer.transform.scale * factor
      };
    }
  }

  next.width = targetWidth;
  next.height = targetHeight;
  if (!isValidDocument(next)) {
    throw new RangeError("El nuevo formato produciría un proyecto inválido.");
  }
  return next;
}

function validateDimensions(width, height, label) {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 ||
      width > MAX_DESIGN_RESIZE_DIMENSION || height > MAX_DESIGN_RESIZE_DIMENSION) {
    throw new RangeError(label + " debe medir entre 1 y " + MAX_DESIGN_RESIZE_DIMENSION + " píxeles por lado.");
  }
  if (width * height > MAX_DESIGN_RESIZE_PIXELS) {
    throw new RangeError(label + " supera el límite seguro de 40 megapíxeles.");
  }
}
