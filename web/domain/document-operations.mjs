import { normalizeDocument, normalizeTransform } from "./model.mjs";

function cloneDocument(document) {
  const cloned = normalizeDocument(JSON.parse(JSON.stringify(document)));
  if (!cloned) throw new TypeError("Document operation requires a valid Document");
  return cloned;
}

export function updateLayerTransform(document, layerId, transformPatch) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer) return null;
  layer.transform = normalizeTransform({ ...layer.transform, ...transformPatch });
  return next;
}

export function translateLayer(document, layerId, deltaX, deltaY) {
  const layer = document.layers.find(item => item.id === layerId);
  if (!layer) return null;
  return updateLayerTransform(document, layerId, {
    x: layer.transform.x + Number(deltaX || 0),
    y: layer.transform.y + Number(deltaY || 0)
  });
}

export function scaleLayer(document, layerId, factor) {
  const layer = document.layers.find(item => item.id === layerId);
  const multiplier = Number(factor);
  if (!layer || !Number.isFinite(multiplier) || multiplier <= 0) return null;
  return updateLayerTransform(document, layerId, {
    scale: layer.transform.scale * multiplier
  });
}

export function rotateLayer(document, layerId, degrees) {
  const layer = document.layers.find(item => item.id === layerId);
  if (!layer) return null;
  return updateLayerTransform(document, layerId, {
    rotation: layer.transform.rotation + Number(degrees || 0)
  });
}


export function setLayerVisibility(document, layerId, visible) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || typeof visible !== "boolean") return null;
  layer.visible = visible;
  return next;
}

export function setLayerLocked(document, layerId, locked) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || typeof locked !== "boolean") return null;
  layer.locked = locked;
  return next;
}

export function setLayerOpacity(document, layerId, opacity) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  const value = Number(opacity);
  if (!layer || !Number.isFinite(value)) return null;
  layer.opacity = Math.min(1, Math.max(0, value));
  return next;
}
