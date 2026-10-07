export const DOCUMENT_VERSION = 2;

const DEFAULT_TRANSFORM = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0 });
export const TEST_IMAGE_SOURCE = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23ffd54f'/><circle cx='32' cy='32' r='20' fill='%232196f3'/><circle cx='24' cy='26' r='4' fill='white'/><circle cx='40' cy='26' r='4' fill='white'/></svg>";

export function createId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}

export function createStrokePoint(x = 0, y = 0) {
  return { x: Number(x) || 0, y: Number(y) || 0 };
}

export function normalizeStrokePoint(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return createStrokePoint(point.x, point.y);
}

export function normalizeStrokeColor(color) {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#111318";
}

export function normalizeStrokeOpacity(opacity) {
  const value = Number(opacity);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

export function createStroke(tool = "brush", size = 5, points = [], color = "#111318", opacity = 1) {
  return {
    tool,
    size: Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 5,
    color: normalizeStrokeColor(color),
    opacity: normalizeStrokeOpacity(opacity),
    points: points.map(normalizeStrokePoint).filter(Boolean)
  };
}

export function normalizeStroke(stroke) {
  if (!stroke || !Array.isArray(stroke.points)) return null;
  return createStroke(stroke.tool || "brush", stroke.size, stroke.points, stroke.color, stroke.opacity);
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
    contentType: "drawing",
    isReference: false,
    strokes: []
  };
}

export function createImageLayer(name = "Image Layer", width = 64, height = 64, source = TEST_IMAGE_SOURCE) {
  const layer = createLayer(name);
  layer.contentType = "image";
  layer.image = {
    source: typeof source === "string" ? source : TEST_IMAGE_SOURCE,
    width: Number.isFinite(Number(width)) && Number(width) > 0 ? Number(width) : 64,
    height: Number.isFinite(Number(height)) && Number(height) > 0 ? Number(height) : 64
  };
  return layer;
}

export function createTestImageLayer(name = "Test Image") {
  return createImageLayer(name, 64, 64, TEST_IMAGE_SOURCE);
}

function normalizeImage(image) {
  if (!image || typeof image.source !== "string") return null;
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return { source: image.source, width, height };
}

function normalizeLayer(layer, index) {
  const contentType = layer?.contentType === "image" ? "image" : "drawing";
  const strokes = Array.isArray(layer?.strokes)
    ? layer.strokes.map(normalizeStroke).filter(Boolean)
    : [];
  const image = contentType === "image" ? normalizeImage(layer?.image) : null;

  return {
    id: layer?.id || createId(),
    name: layer?.name || `Layer ${index + 1}`,
    visible: layer?.visible !== false,
    locked: layer?.locked === true,
    opacity: Number.isFinite(Number(layer?.opacity))
      ? Math.min(1, Math.max(0, Number(layer.opacity)))
      : 1,
    transform: normalizeTransform(layer?.transform),
    contentType,
    isReference: contentType === "image" && layer?.isReference === true,
    strokes,
    ...(image ? { image } : {})
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
    document.layers.every(layer => {
      const validCommon = layer &&
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
        );
      if (!validCommon || !["drawing", "image"].includes(layer.contentType)) return false;
      if (layer.contentType === "drawing") return !layer.image;
      return Boolean(
        layer.image &&
        typeof layer.image.source === "string" &&
        Number.isFinite(layer.image.width) &&
        layer.image.width > 0 &&
        Number.isFinite(layer.image.height) &&
        layer.image.height > 0
      );
    })
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
    contentType: "drawing",
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
