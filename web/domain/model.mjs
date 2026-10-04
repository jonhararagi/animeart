export const DOCUMENT_VERSION = 2;

const DEFAULT_TRANSFORM = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0 });

export function createId() {
  return crypto.randomUUID();
}

export function createStrokePoint(x = 0, y = 0) {
  return { x: Number(x) || 0, y: Number(y) || 0 };
}

export function normalizeStrokePoint(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return createStrokePoint(point.x, point.y);
}

export function createStroke(tool = "brush", size = 5, points = []) {
  return {
    tool,
    size: Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 5,
    points: points.map(normalizeStrokePoint).filter(Boolean)
  };
}

export function normalizeStroke(stroke) {
  if (!stroke || !Array.isArray(stroke.points)) return null;
  return createStroke(stroke.tool || "brush", stroke.size, stroke.points);
}

export function normalizeTransform(transform) {
  const scale = Number(transform?.scale);
  return {
    x: Number.isFinite(Number(transform?.x)) ? Number(transform.x) : DEFAULT_TRANSFORM.x,
    y: Number.isFinite(Number(transform?.y)) ? Number(transform.y) : DEFAULT_TRANSFORM.y,
    scale: Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_TRANSFORM.scale,
    rotation: Number.isFinite(Number(transform?.rotation)) ? Number(transform.rotation) : DEFAULT_TRANSFORM.rotation
  };
}

export function createLayer(name = "Layer 1") {
  return {
    id: createId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { ...DEFAULT_TRANSFORM },
    strokes: []
  };
}

function normalizeLayer(layer, index) {
  const strokes = Array.isArray(layer?.strokes)
    ? layer.strokes.map(normalizeStroke).filter(Boolean)
    : [];

  return {
    id: layer?.id || createId(),
    name: layer?.name || `Layer ${index + 1}`,
    visible: layer?.visible !== false,
    locked: layer?.locked === true,
    opacity: Number.isFinite(Number(layer?.opacity))
      ? Math.min(1, Math.max(0, Number(layer.opacity)))
      : 1,
    transform: normalizeTransform(layer?.transform),
    strokes
  };
}

export function createDocument(width = 0, height = 0) {
  return {
    version: DOCUMENT_VERSION,
    width: Number(width) || 0,
    height: Number(height) || 0,
    layers: [createLayer()]
  };
}

export function normalizeDocument(saved) {
  if (!saved || !Array.isArray(saved.layers)) return null;

  const layers = saved.layers.map(normalizeLayer);

  return {
    version: DOCUMENT_VERSION,
    width: Number(saved.width) || 0,
    height: Number(saved.height) || 0,
    layers: layers.length ? layers : [createLayer()]
  };
}

export function isValidDocument(document) {
  return Boolean(
    document &&
    document.version === DOCUMENT_VERSION &&
    Number.isFinite(document.width) &&
    Number.isFinite(document.height) &&
    Array.isArray(document.layers) &&
    document.layers.length > 0 &&
    document.layers.every(layer =>
      layer &&
      typeof layer.id === "string" &&
      typeof layer.name === "string" &&
      typeof layer.visible === "boolean" &&
      typeof layer.locked === "boolean" &&
      Number.isFinite(layer.opacity) &&
      layer.opacity >= 0 &&
      layer.opacity <= 1 &&
      layer.transform &&
      Number.isFinite(layer.transform.x) &&
      Number.isFinite(layer.transform.y) &&
      Number.isFinite(layer.transform.scale) &&
      layer.transform.scale > 0 &&
      Number.isFinite(layer.transform.rotation) &&
      Array.isArray(layer.strokes) &&
      layer.strokes.every(stroke =>
        stroke &&
        typeof stroke.tool === "string" &&
        Number.isFinite(stroke.size) &&
        stroke.size > 0 &&
        Array.isArray(stroke.points) &&
        stroke.points.every(point =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
        )
      )
    )
  );
}

export function migrateLegacyDocument(saved) {
  if (!saved || !Array.isArray(saved.layers) || !Array.isArray(saved.strokes)) return null;
  const document = createDocument(Number(saved.width) || 0, Number(saved.height) || 0);
  document.layers = saved.layers.map((layer, index) => ({
    id: layer.id || createId(),
    name: layer.name || `Layer ${index + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { ...DEFAULT_TRANSFORM },
    strokes: []
  }));
  if (!document.layers.length) document.layers = [createLayer()];
  for (const stroke of saved.strokes) {
    const layer = document.layers[stroke.layerIndex] || document.layers[0];
    const normalized = normalizeStroke(stroke);
    if (normalized) layer.strokes.push(normalized);
  }
  return document;
}

export function restoreDocument(saved) {
  if (!saved) return null;
  const legacy = migrateLegacyDocument(saved);
  if (legacy) return legacy;
  return normalizeDocument(saved);
}
