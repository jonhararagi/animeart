import { isValidDocument, restoreDocument } from "./model.mjs";

const TEXT_STYLE_KEYS = Object.freeze([
  "fontSize", "fontFamily", "fontWeight", "color", "align",
  "letterSpacing", "lineHeight", "outlineColor", "outlineWidth",
  "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"
]);
const MAX_PAGE_CHARS = 2_500_000;

export function applyTextStyleToPage(sourceDocument, targetDocument, sourceLayerId) {
  if (!isValidDocument(sourceDocument) || !isValidDocument(targetDocument)) {
    return { ok: false, error: "No se pudieron validar las páginas.", document: null, updatedCount: 0 };
  }
  const sourceLayer = sourceDocument.layers.find(layer => layer.id === String(sourceLayerId));
  if (!sourceLayer || sourceLayer.contentType !== "text" || !sourceLayer.text) {
    return { ok: false, error: "Selecciona una capa de texto para usar su estilo.", document: null, updatedCount: 0 };
  }
  const targets = targetDocument.layers.filter(layer => layer.contentType === "text" && layer.text && !layer.locked);
  if (!targets.length) {
    return { ok: false, error: "La página de destino no contiene textos editables desbloqueados.", document: null, updatedCount: 0 };
  }
  const style = Object.fromEntries(TEXT_STYLE_KEYS.map(key => [key, sourceLayer.text[key]]));
  const layers = targetDocument.layers.map(layer => {
    if (layer.contentType !== "text" || !layer.text || layer.locked) return layer;
    return { ...layer, text: { ...layer.text, ...style } };
  });
  const next = restoreDocument({ ...targetDocument, layers });
  if (!isValidDocument(next)) {
    return { ok: false, error: "El estilo no produjo una página editable válida.", document: null, updatedCount: 0 };
  }
  if (JSON.stringify(next).length > MAX_PAGE_CHARS) {
    return { ok: false, error: "La página superaría el límite de 2,5 MB.", document: null, updatedCount: 0 };
  }
  return { ok: true, error: "", document: next, updatedCount: targets.length };
}
