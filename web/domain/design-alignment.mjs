const ALIGNMENT_MODES = Object.freeze([
  "left", "center-x", "right", "top", "center-y", "bottom",
  "distribute-horizontal", "distribute-vertical"
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function localLayerBounds(layer) {
  if (layer?.contentType === "image" && layer.image) {
    const width = Math.max(0, finite(layer.image.width));
    const height = Math.max(0, finite(layer.image.height));
    return { left: 0, top: 0, right: width, bottom: height };
  }

  if (layer?.contentType === "text" && layer.text) {
    const text = layer.text;
    const lines = String(text.value ?? "").split("\n");
    const fontSize = Math.max(1, finite(text.fontSize, 48));
    const letterSpacing = finite(text.letterSpacing);
    const lineHeight = Math.min(2.5, Math.max(0.8, finite(text.lineHeight, 1.2)));
    const width = Math.max(fontSize * 0.35, ...lines.map(line => {
      const count = [...line].length;
      return count * fontSize * 0.62 + Math.max(0, count - 1) * letterSpacing;
    }));
    const left = finite(text.x) - (text.align === "center" ? width / 2 : text.align === "right" ? width : 0);
    const bottom = finite(text.y) + Math.max(0, lines.length - 1) * fontSize * lineHeight;
    return { left, top: bottom - fontSize, right: left + width, bottom: bottom + fontSize * 0.22 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let pointCount = 0, padding = 0;
  for (const stroke of Array.isArray(layer?.strokes) ? layer.strokes : []) {
    padding = Math.max(padding, finite(stroke?.size) / 2);
    for (const point of Array.isArray(stroke?.points) ? stroke.points : []) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pointCount++;
    }
  }
  if (pointCount) {
    return {
      left: minX - padding,
      top: minY - padding,
      right: maxX + padding,
      bottom: maxY + padding
    };
  }
  return { left: 0, top: 0, right: 0, bottom: 0 };
}

export function getLayerAlignmentBounds(layer, documentModel) {
  if (!layer || !documentModel || !Number.isFinite(Number(documentModel.width)) || !Number.isFinite(Number(documentModel.height))) {
    return null;
  }
  const bounds = localLayerBounds(layer);
  const transform = layer.transform || {};
  const scale = Math.max(0.0001, finite(transform.scale, 1));
  const rotation = finite(transform.rotation) * Math.PI / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const centerX = finite(documentModel.width) / 2;
  const centerY = finite(documentModel.height) / 2;
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ].map(point => {
    const x = (point.x - centerX) * scale;
    const y = (point.y - centerY) * scale;
    return {
      x: centerX + finite(transform.x) + x * cosine - y * sine,
      y: centerY + finite(transform.y) + x * sine + y * cosine
    };
  });
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2, width: right - left, height: bottom - top };
}

function unionBounds(items) {
  return {
    left: Math.min(...items.map(item => item.bounds.left)),
    right: Math.max(...items.map(item => item.bounds.right)),
    top: Math.min(...items.map(item => item.bounds.top)),
    bottom: Math.max(...items.map(item => item.bounds.bottom))
  };
}

export function createLayerAlignmentTransforms(documentModel, layerIds, mode) {
  if (!documentModel || !Array.isArray(documentModel.layers) || !Array.isArray(layerIds)) {
    return { ok: false, error: "Selecciona una o más capas antes de alinear.", transforms: [] };
  }
  if (!ALIGNMENT_MODES.includes(mode)) {
    return { ok: false, error: "El tipo de alineación no es válido.", transforms: [] };
  }
  const wanted = new Set(layerIds);
  const layers = documentModel.layers.filter(layer => wanted.has(layer.id));
  if (!layers.length || layers.length !== wanted.size) {
    return { ok: false, error: "No se encontraron todas las capas seleccionadas.", transforms: [] };
  }
  if (layers.some(layer => layer.locked)) {
    return { ok: false, error: "Desbloquea las capas seleccionadas para alinearlas.", transforms: [] };
  }
  const items = layers.map(layer => ({ layer, bounds: getLayerAlignmentBounds(layer, documentModel) }));
  if (items.some(item => !item.bounds)) return { ok: false, error: "No se pudieron calcular los límites de las capas.", transforms: [] };

  if (mode.startsWith("distribute-") && items.length < 3) {
    return { ok: false, error: "La distribución necesita al menos tres capas seleccionadas.", transforms: [] };
  }

  const target = items.length === 1
    ? { left: 0, right: documentModel.width, top: 0, bottom: documentModel.height }
    : unionBounds(items);
  const targetCenterX = (target.left + target.right) / 2;
  const targetCenterY = (target.top + target.bottom) / 2;
  const deltas = new Map(items.map(item => [item.layer.id, { x: 0, y: 0 }]));

  if (mode === "left" || mode === "center-x" || mode === "right") {
    for (const item of items) {
      const dx = mode === "left" ? target.left - item.bounds.left
        : mode === "right" ? target.right - item.bounds.right
          : targetCenterX - item.bounds.centerX;
      deltas.get(item.layer.id).x = dx;
    }
  } else if (mode === "top" || mode === "center-y" || mode === "bottom") {
    for (const item of items) {
      const dy = mode === "top" ? target.top - item.bounds.top
        : mode === "bottom" ? target.bottom - item.bounds.bottom
          : targetCenterY - item.bounds.centerY;
      deltas.get(item.layer.id).y = dy;
    }
  } else {
    const horizontal = mode === "distribute-horizontal";
    const sorted = [...items].sort((a, b) => horizontal
      ? a.bounds.left - b.bounds.left
      : a.bounds.top - b.bounds.top);
    const start = horizontal ? sorted[0].bounds.left : sorted[0].bounds.top;
    const end = horizontal ? sorted.at(-1).bounds.right : sorted.at(-1).bounds.bottom;
    const total = sorted.reduce((sum, item) => sum + (horizontal ? item.bounds.width : item.bounds.height), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    let cursor = start;
    for (const item of sorted) {
      const currentStart = horizontal ? item.bounds.left : item.bounds.top;
      const delta = cursor - currentStart;
      if (horizontal) deltas.get(item.layer.id).x = delta;
      else deltas.get(item.layer.id).y = delta;
      cursor += (horizontal ? item.bounds.width : item.bounds.height) + gap;
    }
  }

  const transforms = items.map(({ layer }) => {
    const delta = deltas.get(layer.id);
    return {
      id: layer.id,
      transform: {
        ...(layer.transform || {}),
        x: finite(layer.transform?.x) + delta.x,
        y: finite(layer.transform?.y) + delta.y
      }
    };
  }).filter(item => {
    const layer = documentModel.layers.find(candidate => candidate.id === item.id);
    return Math.abs(finite(layer?.transform?.x) - item.transform.x) > 0.0001
      || Math.abs(finite(layer?.transform?.y) - item.transform.y) > 0.0001;
  });

  return { ok: true, error: "", transforms };
}

export const LAYER_ALIGNMENT_MODES = ALIGNMENT_MODES;
