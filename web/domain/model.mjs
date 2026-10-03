export const DOCUMENT_VERSION = 2;

export function createId() {
  return crypto.randomUUID();
}

export function createLayer(name = "Layer 1") {
  return {
    id: createId(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    strokes: []
  };
}

export function createDocument(width = 0, height = 0) {
  return {
    version: DOCUMENT_VERSION,
    width,
    height,
    layers: [createLayer()]
  };
}

export function normalizeDocument(saved) {
  if (!saved || !Array.isArray(saved.layers)) return null;

  const layers = saved.layers.map((layer, index) => ({
    id: layer.id || createId(),
    name: layer.name || `Layer ${index + 1}`,
    visible: layer.visible !== false,
    locked: layer.locked === true,
    opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
    transform: {
      x: Number(layer.transform?.x) || 0,
      y: Number(layer.transform?.y) || 0,
      scale: Number(layer.transform?.scale) || 1,
      rotation: Number(layer.transform?.rotation) || 0
    },
    strokes: Array.isArray(layer.strokes) ? layer.strokes : []
  }));

  return {
    version: DOCUMENT_VERSION,
    width: Number(saved.width) || 0,
    height: Number(saved.height) || 0,
    layers: layers.length ? layers : [createLayer()]
  };
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
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    strokes: []
  }));
  if (!document.layers.length) document.layers = [createLayer()];
  for (const stroke of saved.strokes) {
    const layer = document.layers[stroke.layerIndex] || document.layers[0];
    layer.strokes.push({
      tool: stroke.tool || "brush",
      size: Number(stroke.size) || 5,
      points: Array.isArray(stroke.points) ? stroke.points : []
    });
  }
  return document;
}
