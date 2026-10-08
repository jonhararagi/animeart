import { documentToScreen } from "./viewport.mjs";

export function layerLocalBounds(layer) {
  if (layer?.contentType === "image" && layer.image) {
    const width = Number(layer.image.width);
    const height = Number(layer.image.height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { minX: 0, minY: 0, maxX: width, maxY: height };
    }
  }

  const points = [];
  let strokePadding = 0;
  for (const stroke of layer?.strokes || []) {
    strokePadding = Math.max(strokePadding, Number(stroke.size) || 0);
    for (const point of stroke.points || []) points.push(point);
  }
  if (!points.length) return null;
  const padding = strokePadding / 2;
  const xs = points.map(point => Number(point.x));
  const ys = points.map(point => Number(point.y));
  return { minX: Math.min(...xs) - padding, minY: Math.min(...ys) - padding, maxX: Math.max(...xs) + padding, maxY: Math.max(...ys) + padding };
}

export function transformPoint(point, transform, pivot) {
  const angle = (Number(transform?.rotation) || 0) * Math.PI / 180;
  const scale = Number(transform?.scale) || 1;
  const translated = { x: (point.x - pivot.x) * scale, y: (point.y - pivot.y) * scale };
  return {
    x: translated.x * Math.cos(angle) - translated.y * Math.sin(angle) + pivot.x + (Number(transform?.x) || 0),
    y: translated.x * Math.sin(angle) + translated.y * Math.cos(angle) + pivot.y + (Number(transform?.y) || 0)
  };
}

export function inverseTransformPoint(point, transform, pivot) {
  const angle = -(Number(transform?.rotation) || 0) * Math.PI / 180;
  const scale = Number(transform?.scale) || 1;
  const translated = { x: point.x - pivot.x - (Number(transform?.x) || 0), y: point.y - pivot.y - (Number(transform?.y) || 0) };
  return {
    x: (translated.x * Math.cos(angle) - translated.y * Math.sin(angle)) / scale + pivot.x,
    y: (translated.x * Math.sin(angle) + translated.y * Math.cos(angle)) / scale + pivot.y
  };
}

export function layerCorners(layer, pivot, transformOverride = null) {
  const bounds = layerLocalBounds(layer);
  if (!bounds) return null;
  const transform = transformOverride || layer.transform;
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ].map(point => transformPoint(point, transform, pivot));
}

export function resizeTransformFromCorner(layer, pivot, handle, targetDocumentPoint, minimumScale = 0.05) {
  const bounds = layerLocalBounds(layer);
  if (!bounds || !targetDocumentPoint) return null;

  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ];
  const names = ["scale-nw", "scale-ne", "scale-se", "scale-sw"];
  const index = names.indexOf(handle);
  if (index < 0) return null;

  const oppositeIndex = (index + 2) % 4;
  const transform = layer.transform;
  const fixedCorner = transformPoint(corners[oppositeIndex], transform, pivot);
  const draggedCorner = transformPoint(corners[index], transform, pivot);
  const diagonal = {
    x: draggedCorner.x - fixedCorner.x,
    y: draggedCorner.y - fixedCorner.y
  };
  const diagonalLengthSquared = diagonal.x * diagonal.x + diagonal.y * diagonal.y;
  if (!Number.isFinite(diagonalLengthSquared) || diagonalLengthSquared <= 1e-12) return null;

  const diagonalLength = Math.sqrt(diagonalLengthSquared);
  const axis = { x: diagonal.x / diagonalLength, y: diagonal.y / diagonalLength };
  const targetVector = {
    x: Number(targetDocumentPoint.x) - fixedCorner.x,
    y: Number(targetDocumentPoint.y) - fixedCorner.y
  };
  const projectedLength = targetVector.x * axis.x + targetVector.y * axis.y;
  if (!Number.isFinite(projectedLength)) return null;

  const factor = Math.max(minimumScale, projectedLength / diagonalLength);
  const nextScale = transform.scale * factor;
  if (!Number.isFinite(nextScale) || nextScale <= 0) return null;

  const baseTransform = {
    x: 0,
    y: 0,
    scale: nextScale,
    rotation: transform.rotation
  };
  const baseFixedCorner = transformPoint(corners[oppositeIndex], baseTransform, pivot);
  const next = {
    x: fixedCorner.x - baseFixedCorner.x,
    y: fixedCorner.y - baseFixedCorner.y,
    scale: nextScale,
    rotation: transform.rotation
  };

  if (![next.x, next.y, next.scale, next.rotation].every(Number.isFinite)) return null;
  return next;
}

export function pointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function hitTestLayer(layer, documentPoint, pivot) {
  const bounds = layerLocalBounds(layer);
  if (!bounds) return false;
  const local = inverseTransformPoint(documentPoint, layer.transform, pivot);
  return local.x >= bounds.minX && local.x <= bounds.maxX && local.y >= bounds.minY && local.y <= bounds.maxY;
}

export function selectionGeometry(layer, viewport, center, transformOverride = null) {
  const corners = layerCorners(layer, center, transformOverride);
  if (!corners) return null;
  const screenCorners = corners.map(point => documentToScreen(point, viewport, center));
  const transform = transformOverride || layer.transform;
  const centerScreen = documentToScreen(transformPoint(center, transform, center), viewport, center);
  const topMid = { x: (screenCorners[0].x + screenCorners[1].x) / 2, y: (screenCorners[0].y + screenCorners[1].y) / 2 };
  const outward = { x: topMid.x - centerScreen.x, y: topMid.y - centerScreen.y };
  const length = Math.hypot(outward.x, outward.y) || 1;
  return {
    corners: screenCorners,
    center: centerScreen,
    rotationHandle: { x: topMid.x + outward.x / length * 32, y: topMid.y + outward.y / length * 32 }
  };
}

export function layerWorldCenter(layer, pivot) {
  const bounds = layerLocalBounds(layer);
  if (!bounds) return null;
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
  return transformPoint(center, layer.transform, pivot);
}

export function multiSelectionGeometry(layers, pivot) {
  const visibleLayers = (Array.isArray(layers) ? layers : []).filter(Boolean);
  const corners = visibleLayers.flatMap(layer => layerCorners(layer, pivot) || []);
  if (corners.length < 4) return null;
  const minX = Math.min(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y));
  const maxX = Math.max(...corners.map(point => point.x));
  const maxY = Math.max(...corners.map(point => point.y));
  return {
    corners: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ],
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  };
}

function rotateAround(point, pivot, degrees) {
  const angle = Number(degrees) * Math.PI / 180;
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle)
  };
}

function transformForWorldCenter(layer, pivot, worldCenter, scale, rotation) {
  const bounds = layerLocalBounds(layer);
  if (!bounds) return null;
  const localCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
  const base = transformPoint(localCenter, { x: 0, y: 0, scale, rotation }, pivot);
  return {
    ...layer.transform,
    x: worldCenter.x - (base.x - pivot.x),
    y: worldCenter.y - (base.y - pivot.y),
    scale,
    rotation
  };
}

export function groupScaleTransforms(layers, pivot, handle, targetDocumentPoint, minimumScale = 0.05) {
  const geometry = multiSelectionGeometry(layers, pivot);
  if (!geometry || !targetDocumentPoint) return null;
  const names = ["scale-nw", "scale-ne", "scale-se", "scale-sw"];
  const index = names.indexOf(handle);
  if (index < 0) return null;

  const corners = geometry.corners;
  const opposite = corners[(index + 2) % 4];
  const start = corners[index];
  const diagonal = { x: start.x - opposite.x, y: start.y - opposite.y };
  const lengthSquared = diagonal.x * diagonal.x + diagonal.y * diagonal.y;
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 1e-12) return null;

  const target = {
    x: Number(targetDocumentPoint.x) - opposite.x,
    y: Number(targetDocumentPoint.y) - opposite.y
  };
  const factor = Math.max(minimumScale, (target.x * diagonal.x + target.y * diagonal.y) / lengthSquared);
  if (!Number.isFinite(factor) || factor <= 0) return null;

  const transforms = [];
  for (const layer of layers) {
    const center = layerWorldCenter(layer, pivot);
    if (!center) return null;
    const nextCenter = {
      x: opposite.x + (center.x - opposite.x) * factor,
      y: opposite.y + (center.y - opposite.y) * factor
    };
    const nextScale = layer.transform.scale * factor;
    const next = transformForWorldCenter(layer, pivot, nextCenter, nextScale, layer.transform.rotation);
    if (!next) return null;
    transforms.push({ id: layer.id, transform: next });
  }
  return transforms;
}

export function groupRotationTransforms(layers, pivot, targetDocumentPoint, startDocumentPoint) {
  const geometry = multiSelectionGeometry(layers, pivot);
  if (!geometry || !targetDocumentPoint || !startDocumentPoint) return null;
  const startAngle = Math.atan2(startDocumentPoint.y - geometry.center.y, startDocumentPoint.x - geometry.center.x);
  const currentAngle = Math.atan2(targetDocumentPoint.y - geometry.center.y, targetDocumentPoint.x - geometry.center.x);
  if (![startAngle, currentAngle].every(Number.isFinite)) return null;
  const delta = (currentAngle - startAngle) * 180 / Math.PI;

  return layers.map(layer => {
    const center = layerWorldCenter(layer, pivot);
    if (!center) return null;
    const nextCenter = rotateAround(center, geometry.center, delta);
    return {
      id: layer.id,
      transform: transformForWorldCenter(
        layer,
        pivot,
        nextCenter,
        layer.transform.scale,
        layer.transform.rotation + delta
      )
    };
  });
}

export function hitTestHandle(screenPoint, geometry, radius = 10) {
  if (!geometry) return null;
  const names = ["scale-nw", "scale-ne", "scale-se", "scale-sw"];
  for (let i = 0; i < geometry.corners.length; i += 1) {
    const corner = geometry.corners[i];
    if (Math.hypot(screenPoint.x - corner.x, screenPoint.y - corner.y) <= radius) return names[i];
  }
  if (Math.hypot(screenPoint.x - geometry.rotationHandle.x, screenPoint.y - geometry.rotationHandle.y) <= radius) return "rotate";
  if (pointInPolygon(screenPoint, geometry.corners)) return "move";
  return null;
}


export function normalizeLayerSelection(layerIds, document) {
  const validIds = new Set((document?.layers || []).map(layer => layer.id));
  return [...new Set(Array.isArray(layerIds) ? layerIds : [])].filter(id => validIds.has(id));
}

export function toggleLayerSelection(layerIds, layerId, document) {
  const current = normalizeLayerSelection(layerIds, document);
  if (!validLayerId(layerId, document)) return current;
  return current.includes(layerId)
    ? current.filter(id => id !== layerId)
    : [...current, layerId];
}

function validLayerId(layerId, document) {
  return Boolean(layerId && document?.layers?.some(layer => layer.id === layerId));
}
