import { createId, normalizeDocument, normalizeTransform } from "./model.mjs";
import { isDefaultLayerAdjustments, normalizeLayerAdjustments } from "./layer-adjustments.mjs";
import { normalizeTextLayer } from "./text-layer.mjs";

function cloneDocument(document) {
  const cloned = normalizeDocument(JSON.parse(JSON.stringify(document)));
  if (!cloned) throw new TypeError("Document operation requires a valid Document");
  return cloned;
}

export function addLayer(document, layer) {
  if (!document || !Array.isArray(document.layers) || !layer) return null;
  const next = cloneDocument(document);
  const candidate = cloneDocument({ ...next, layers: [layer] }).layers[0];
  if (!candidate || next.layers.some(item => item.id === candidate.id)) return null;
  next.layers.push(candidate);
  return next;
}

export function clearLayer(document, layerId) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.locked || layer.contentType !== "drawing" || layer.strokes.length === 0) return null;
  layer.strokes = [];
  return next;
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


/**
 * Crop the document viewport while keeping each layer's rendered content at the
 * same document-space position minus the crop origin. This crops the composition
 * (all visible layers together), not the source pixels of an individual image.
 */
export function cropDocumentCanvas(document, rectangle) {
  if (!document || !Array.isArray(document.layers)) return null;
  const sourceWidth = Number(document.width);
  const sourceHeight = Number(document.height);
  const x = Number(rectangle?.x);
  const y = Number(rectangle?.y);
  const width = Number(rectangle?.width);
  const height = Number(rectangle?.height);
  if (![sourceWidth, sourceHeight, x, y, width, height].every(Number.isFinite) ||
      !Number.isInteger(x) || !Number.isInteger(y) ||
      !Number.isInteger(width) || !Number.isInteger(height) ||
      sourceWidth < 1 || sourceHeight < 1 || x < 0 || y < 0 ||
      width < 1 || height < 1 || x + width > sourceWidth || y + height > sourceHeight) {
    return null;
  }

  const next = cloneDocument(document);
  const oldCenter = { x: sourceWidth / 2, y: sourceHeight / 2 };
  const newCenter = { x: width / 2, y: height / 2 };
  const centerDeltaX = newCenter.x - oldCenter.x;
  const centerDeltaY = newCenter.y - oldCenter.y;

  for (const layer of next.layers) {
    const transform = layer.transform;
    const scale = Number(transform.scale) || 1;
    const angle = (Number(transform.rotation) || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Changing document dimensions also changes the transform pivot. Compensate
    // for that pivot shift and then subtract the crop origin for every layer.
    const pivotCorrectionX = (scale * cos - 1) * centerDeltaX - scale * sin * centerDeltaY;
    const pivotCorrectionY = scale * sin * centerDeltaX + (scale * cos - 1) * centerDeltaY;
    layer.transform = normalizeTransform({
      ...transform,
      x: transform.x + pivotCorrectionX - x,
      y: transform.y + pivotCorrectionY - y
    });
  }

  next.width = width;
  next.height = height;
  return next;
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

export function setLayerBackground(document, layerId, isBackground) {
  if (typeof isBackground !== "boolean") return null;
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.contentType !== "image" || !layer.image) return null;
  if (isBackground) {
    const previousBackgroundIds = [];
    for (const candidate of next.layers) {
      if (candidate.isBackground) {
        delete candidate.isBackground;
        candidate.locked = false;
        if (candidate.id !== layerId) previousBackgroundIds.push(candidate.id);
      }
    }
    // Any old fixed background becomes a normal foreground image before the new one is pinned.
    for (const previousId of previousBackgroundIds) {
      const previousIndex = next.layers.findIndex(item => item.id === previousId);
      if (previousIndex >= 0 && previousIndex < next.layers.length - 1) {
        next.layers.push(next.layers.splice(previousIndex, 1)[0]);
      }
    }
    layer.isBackground = true;
    layer.locked = true;
    const index = next.layers.findIndex(item => item.id === layerId);
    if (index > 0) next.layers.unshift(next.layers.splice(index, 1)[0]);
  } else {
    delete layer.isBackground;
    layer.locked = false;
    // Restoring an image to normal layer mode also brings it to the foreground.
    const index = next.layers.findIndex(item => item.id === layerId);
    if (index >= 0 && index < next.layers.length - 1) {
      next.layers.push(next.layers.splice(index, 1)[0]);
    }
  }
  return next;
}

export function flipImageLayer(document, layerId, axis) {
  if (!["horizontal", "vertical"].includes(axis)) return null;
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.locked || layer.contentType !== "image" || !layer.image) return null;
  if (axis === "horizontal") layer.image.flipX = !layer.image.flipX;
  else layer.image.flipY = !layer.image.flipY;
  return next;
}

export function setImageMask(document,layerId,mask){if(!["none","circle","rounded","star","heart","hexagon"].includes(mask))return null;const next=cloneDocument(document),layer=next.layers.find(item=>item.id===layerId);if(!layer||layer.locked||layer.contentType!=="image"||!layer.image)return null;layer.image.mask=mask;return next;}
export function setLayerAdjustments(document, layerId, adjustments) {
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || !adjustments || typeof adjustments !== "object" || Array.isArray(adjustments)) return null;
  const normalized = normalizeLayerAdjustments(adjustments);
  if (isDefaultLayerAdjustments(normalized)) {
    delete layer.adjustments;
  } else {
    layer.adjustments = normalized;
  }
  return next;
}

export function setLayerText(document, layerId, textPatch) {
  if (!textPatch || typeof textPatch !== "object" || Array.isArray(textPatch)) return null;
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.contentType !== "text") return null;
  layer.text = normalizeTextLayer({ ...layer.text, ...textPatch });
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

export function groupLayers(document, layerIds) {
  if (!document || !Array.isArray(document.layers) || !Array.isArray(layerIds)) return null;
  const ids = [...new Set(layerIds.filter(id => typeof id === "string" && id.length > 0))];
  if (ids.length < 2) return null;
  const next = cloneDocument(document);
  const selected = next.layers.filter(layer => ids.includes(layer.id));
  if (selected.length !== ids.length || selected.some(layer => layer.locked || layer.isBackground)) return null;
  const existingGroups = new Set(selected.map(layer => layer.groupId).filter(Boolean));
  if (next.layers.some(layer => existingGroups.has(layer.groupId) && !ids.includes(layer.id))) return null;
  const groupId = createId();
  for (const layer of selected) layer.groupId = groupId;
  return next;
}

export function ungroupLayers(document, layerIds) {
  if (!document || !Array.isArray(document.layers) || !Array.isArray(layerIds)) return null;
  const ids = new Set(layerIds.filter(id => typeof id === "string" && id.length > 0));
  if (!ids.size) return null;
  const next = cloneDocument(document);
  const selected = next.layers.filter(layer => ids.has(layer.id));
  if (!selected.length) return null;
  const groups = new Set(selected.map(layer => layer.groupId).filter(Boolean));
  if (!groups.size) return null;
  let changed = false;
  for (const layer of next.layers) {
    if (!groups.has(layer.groupId)) continue;
    delete layer.groupId;
    changed = true;
  }
  return changed ? next : null;
}

export function duplicateLayer(document, layerId) {
  const next = cloneDocument(document);
  const index = next.layers.findIndex(item => item.id === layerId);
  if (index < 0) return null;
  const duplicate = cloneDocument({ ...next, layers: [next.layers[index]] }).layers[0];
  duplicate.id = createId();
  delete duplicate.groupId;
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
  const groupCounts = new Map();
  for (const layer of next.layers) {
    if (layer.groupId) groupCounts.set(layer.groupId, (groupCounts.get(layer.groupId) || 0) + 1);
  }
  for (const layer of next.layers) {
    if (layer.groupId && groupCounts.get(layer.groupId) < 2) delete layer.groupId;
  }
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


export function replaceImageLayer(document, layerId, replacement, { cropOrigin = null, preserveDisplaySize = false } = {}) {
  if (!replacement || typeof replacement.source !== "string" || !replacement.source || replacement.source.length > 2_000_000) return null;
  const width = Number(replacement.width), height = Number(replacement.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 8192 || height > 8192 || width * height > 32_000_000) return null;
  const next = cloneDocument(document);
  const layer = next.layers.find(item => item.id === layerId);
  if (!layer || layer.locked || layer.contentType !== "image" || !layer.image) return null;

  const previousWidth = layer.image.width, previousHeight = layer.image.height;
  if (cropOrigin !== null) {
    const x = Number(cropOrigin.x), y = Number(cropOrigin.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
        x + width > previousWidth || y + height > previousHeight) return null;
    const radians = layer.transform.rotation * Math.PI / 180, scale = layer.transform.scale;
    layer.transform = {
      ...layer.transform,
      x: layer.transform.x + scale * (x * Math.cos(radians) - y * Math.sin(radians)),
      y: layer.transform.y + scale * (x * Math.sin(radians) + y * Math.cos(radians))
    };
  } else if (preserveDisplaySize) {
    const scaleX = previousWidth / width, scaleY = previousHeight / height;
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) ||
        Math.abs(scaleX - scaleY) > Math.max(scaleX, scaleY) * 0.002) return null;
    const previousScale = layer.transform.scale;
    const nextScale = previousScale * scaleX;
    const radians = layer.transform.rotation * Math.PI / 180;
    const centerX = Number(next.width) / 2;
    const centerY = Number(next.height) / 2;
    layer.transform = {
      ...layer.transform,
      x: layer.transform.x + (nextScale - previousScale) * (centerX * Math.cos(radians) - centerY * Math.sin(radians)),
      y: layer.transform.y + (nextScale - previousScale) * (centerX * Math.sin(radians) + centerY * Math.cos(radians)),
      scale: nextScale
    };
  }
  layer.image = { source: replacement.source, width, height, flipX: layer.image.flipX === true, flipY: layer.image.flipY === true, mask: layer.image.mask || "none", ...((typeof replacement.restoreSource === "string" && replacement.restoreSource.length <= 2_000_000) ? { restoreSource: replacement.restoreSource } : (typeof layer.image.restoreSource === "string" ? { restoreSource: layer.image.restoreSource } : {})) };
  return next;
}
