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

export function translateLayers(document, layerIds, deltaX, deltaY) {
  const ids = new Set(Array.isArray(layerIds) ? layerIds : []);
  if (!ids.size) return null;
  const next = cloneDocument(document);
  const dx = Number(deltaX);
  const dy = Number(deltaY);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  for (const layer of next.layers) {
    if (!ids.has(layer.id)) continue;
    if (layer.locked) return null;
    layer.transform = normalizeTransform({
      ...layer.transform,
      x: layer.transform.x + dx,
      y: layer.transform.y + dy
    });
  }
  return next;
}

export function transformLayers(document, layerTransforms) {
  if (!Array.isArray(layerTransforms) || !layerTransforms.length) return null;
  const patches = new Map(layerTransforms.map(item => [item?.id, item?.transform]));
  if ([...patches.keys()].some(id => typeof id !== "string") || patches.size !== layerTransforms.length) return null;

  const next = cloneDocument(document);
  for (const layer of next.layers) {
    if (!patches.has(layer.id)) continue;
    if (layer.locked) return null;
    const transform = patches.get(layer.id);
    if (!transform) return null;
    const normalized = normalizeTransform(transform);
    if (![normalized.x, normalized.y, normalized.scale, normalized.rotation].every(Number.isFinite)) return null;
    layer.transform = normalized;
  }
  return next;
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

export function setLayerReference(document, layerId, isReference) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.contentType !== "image" || typeof isReference !== "boolean") return null;
  layer.isReference = isReference;
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


export function renameLayer(document, layerId, name) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!layer || !normalizedName) return null;
  layer.name = normalizedName;
  return next;
}

export function duplicateLayer(document, layerId) {
  const next = cloneDocument(document);
  const index = next.layers.findIndex(item => item.id === layerId);
  if (index < 0) return null;
  const duplicate = cloneDocument({ ...next, layers: [next.layers[index]] }).layers[0];
  duplicate.id = crypto.randomUUID();
  duplicate.name = next.layers[index].name + " Copy";
  next.layers.splice(index + 1, 0, duplicate);
  return next;
}

export function deleteLayer(document, layerId) {
  if (!document || !Array.isArray(document.layers) || document.layers.length <= 1) return null;
  const next = cloneDocument(document);
  const index = next.layers.findIndex(item => item.id === layerId);
  if (index < 0) return null;
  next.layers.splice(index, 1);
  return next;
}

export function reorderLayer(document, layerId, direction) {
  const next = cloneDocument(document);
  const index = next.layers.findIndex(item => item.id === layerId);
  if (index < 0 || !["up", "down"].includes(direction)) return null;
  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= next.layers.length) return null;
  [next.layers[index], next.layers[targetIndex]] = [next.layers[targetIndex], next.layers[index]];
  return next;
}
