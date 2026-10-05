import { createDocument, createImageLayer, createLayer, createStroke, createStrokePoint, restoreDocument } from "./domain/model.mjs";
import { DocumentHistory, cloneDocument } from "./domain/history.mjs";
import { createViewport, panBy, screenToDocument, zoomAt } from "./domain/viewport.mjs";
import { rotateLayer, scaleLayer, translateLayer, updateLayerTransform } from "./domain/document-operations.mjs";
import { hitTestHandle, hitTestLayer, resizeTransformFromCorner, selectionGeometry } from "./domain/selection.mjs";

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const layersEl = document.querySelector("#layers");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const HANDLE_RADIUS = 10;
const imageCache = new Map();

const state = {
  tool: "brush",
  drawing: false,
  panning: false,
  selectedLayerId: null,
  panPointerId: null,
  drawingPointerId: null,
  transformPointerId: null,
  lastPanPoint: null,
  strokeBefore: null,
  transformInteraction: null,
  viewport: createViewport(),
  document: createDocument(),
  history: null
};

state.history = new DocumentHistory(state.document);

function selectedLayer() {
  return state.document.layers.find(layer => layer.id === state.selectedLayerId) || state.document.layers[0];
}

function selectedLayerExact() {
  return state.document.layers.find(layer => layer.id === state.selectedLayerId) || null;
}

function canvasCenter() {
  const rect = canvas.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  redraw();
}

function applyViewport() {
  const center = canvasCenter();
  ctx.translate(center.x + state.viewport.panX, center.y + state.viewport.panY);
  ctx.scale(state.viewport.zoom, state.viewport.zoom);
  ctx.translate(-center.x, -center.y);
}

function layerTransformForRender(layer) {
  return state.transformInteraction?.layerId === layer.id
    ? state.transformInteraction.previewTransform
    : layer.transform;
}

function drawImageLayer(layer) {
  if (!layer.image) return;
  let image = imageCache.get(layer.image.source);
  if (!image) {
    image = new Image();
    image.onload = () => {
      imageCache.set(layer.image.source, image);
      redraw();
    };
    image.onerror = () => {
      imageCache.delete(layer.image.source);
      status.textContent = "Image failed to load";
    };
    image.src = layer.image.source;
    imageCache.set(layer.image.source, image);
  }
  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, 0, 0, layer.image.width, layer.image.height);
  }
}

function drawDocument() {
  for (const layer of state.document.layers) {
    if (!layer.visible) continue;
    const transform = layerTransformForRender(layer);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(transform.x, transform.y);
    ctx.translate(canvasCenter().x, canvasCenter().y);
    ctx.rotate(transform.rotation * Math.PI / 180);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-canvasCenter().x, -canvasCenter().y);

    if (layer.contentType === "image") {
      drawImageLayer(layer);
    } else {
      for (const stroke of layer.strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : "#111318";
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawSelectionOverlay() {
  const layer = selectedLayerExact();
  if (!layer || !layer.visible) return;
  const geometry = selectionGeometry(layer, state.viewport, canvasCenter(), state.transformInteraction?.layerId === layer.id ? state.transformInteraction.previewTransform : null);
  if (!geometry) return;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#2f80ed";
  ctx.beginPath();
  geometry.corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  const topMid = { x: (geometry.corners[0].x + geometry.corners[1].x) / 2, y: (geometry.corners[0].y + geometry.corners[1].y) / 2 };
  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(geometry.rotationHandle.x, geometry.rotationHandle.y);
  ctx.stroke();
  for (const corner of geometry.corners) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2f80ed";
    ctx.beginPath();
    ctx.rect(corner.x - 5, corner.y - 5, 10, 10);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(geometry.rotationHandle.x, geometry.rotationHandle.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function redraw() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  applyViewport();
  drawDocument();
  ctx.restore();
  drawSelectionOverlay();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  return createStrokePoint(screenToDocument(screenPoint, state.viewport, canvasCenter()));
}

function screenPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function renderLayers() {
  layersEl.replaceChildren();
  [...state.document.layers].reverse().forEach(layer => {
    const li = document.createElement("li");
    li.textContent = layer.name + (layer.contentType === "image" ? " [Image]" : "");
    li.dataset.layerId = layer.id;
    if (layer.id === state.selectedLayerId) li.dataset.selected = "true";
    li.addEventListener("click", () => {
      state.selectedLayerId = layer.id;
      renderLayers();
      redraw();
    });
    layersEl.appendChild(li);
  });
}

function persistDocument() {
  localStorage.setItem("animeart-web-document", JSON.stringify(state.document));
  status.textContent = "Saved locally";
}

function refreshHistoryControls() {
  undoButton.disabled = !state.history.canUndo();
  redoButton.disabled = !state.history.canRedo();
}

function syncSelection() {
  if (!state.document.layers.some(layer => layer.id === state.selectedLayerId)) state.selectedLayerId = state.document.layers.at(-1)?.id || null;
}

function refreshDocument(message = "Unsaved local changes") {
  syncSelection();
  renderLayers();
  redraw();
  refreshHistoryControls();
  status.textContent = message;
}

function setViewport(viewport) {
  state.viewport = { ...viewport, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom)) };
  redraw();
}

function undo() {
  if (!state.history.canUndo()) return;
  state.document = state.history.undo(state.document);
  refreshDocument("Undo applied");
  persistDocument();
}

function redo() {
  if (!state.history.canRedo()) return;
  state.document = state.history.redo(state.document);
  refreshDocument("Redo applied");
  persistDocument();
}

function applyLayerOperation(operation, message) {
  const layer = selectedLayer();
  if (!layer || layer.locked) return;
  const before = cloneDocument(state.document);
  const next = operation(state.document, layer.id);
  if (!next) return;
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
}

function beginTransformInteraction(type, event, handle = null) {
  const layer = selectedLayerExact();
  if (!layer || layer.locked) return false;
  const screenPoint = screenPointFromEvent(event);
  const documentPoint = screenToDocument(screenPoint, state.viewport, canvasCenter());
  state.transformPointerId = event.pointerId;
  state.transformInteraction = {
    type,
    handle,
    pointerId: event.pointerId,
    layerId: layer.id,
    startDocument: documentPoint,
    beforeTransform: { ...layer.transform },
    previewTransform: { ...layer.transform },
    pivot: canvasCenter()
  };
  canvas.setPointerCapture(event.pointerId);
  return true;
}

function finishTransformInteraction(cancelled = false) {
  const interaction = state.transformInteraction;
  if (!interaction) return;
  const pointerId = interaction.pointerId;
  state.transformInteraction = null;
  state.transformPointerId = null;
  if (cancelled) {
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    redraw();
    return;
  }
  const layer = state.document.layers.find(item => item.id === interaction.layerId);
  if (!layer) {
    redraw();
    return;
  }
  const before = cloneDocument(state.document);
  const start = interaction.beforeTransform;
  const preview = interaction.previewTransform;
  let next = null;
  if (interaction.type === "move") next = translateLayer(state.document, layer.id, preview.x - start.x, preview.y - start.y);
  if (interaction.type === "scale") next = updateLayerTransform(state.document, layer.id, preview);
  if (interaction.type === "rotate") next = rotateLayer(state.document, layer.id, preview.rotation - start.rotation);
  if (next) {
    state.document = next;
    state.history.record(before, next);
    persistDocument();
  }
  refreshDocument("Layer transformed");
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
}

function updateTransformPreview(event) {
  const interaction = state.transformInteraction;
  if (!interaction || event.pointerId !== interaction.pointerId) return;
  const currentScreen = screenPointFromEvent(event);
  const currentDocument = screenToDocument(currentScreen, state.viewport, canvasCenter());
  const pivot = interaction.pivot;
  const preview = { ...interaction.previewTransform };
  if (interaction.type === "move") {
    preview.x = interaction.beforeTransform.x + currentDocument.x - interaction.startDocument.x;
    preview.y = interaction.beforeTransform.y + currentDocument.y - interaction.startDocument.y;
  } else if (interaction.type === "scale") {
    const nextTransform = resizeTransformFromCorner(
      state.document.layers.find(item => item.id === interaction.layerId),
      interaction.pivot,
      interaction.handle,
      currentDocument
    );
    if (nextTransform) {
      preview.x = nextTransform.x;
      preview.y = nextTransform.y;
      preview.scale = nextTransform.scale;
      preview.rotation = nextTransform.rotation;
    }
  } else if (interaction.type === "rotate") {
    const startAngle = Math.atan2(interaction.startDocument.y - pivot.y, interaction.startDocument.x - pivot.x);
    const currentAngle = Math.atan2(currentDocument.y - pivot.y, currentDocument.x - pivot.x);
    preview.rotation = interaction.beforeTransform.rotation + (currentAngle - startAngle) * 180 / Math.PI;
  }
  interaction.previewTransform = preview;
  redraw();
}

function beginSelectionInteraction(event) {
  const screenPoint = screenPointFromEvent(event);
  const selected = selectedLayerExact();
  const selectedGeometry = selected ? selectionGeometry(selected, state.viewport, canvasCenter()) : null;
  const selectedHit = hitTestHandle(screenPoint, selectedGeometry, HANDLE_RADIUS);
  if (selectedHit === "move") return beginTransformInteraction("move", event);
  if (selectedHit?.startsWith("scale-")) return beginTransformInteraction("scale", event, selectedHit);
  if (selectedHit === "rotate") return beginTransformInteraction("rotate", event);
  const documentPoint = screenToDocument(screenPoint, state.viewport, canvasCenter());
  for (const layer of [...state.document.layers].reverse()) {
    if (!layer.visible) continue;
    if (hitTestLayer(layer, documentPoint, canvasCenter())) {
      state.selectedLayerId = layer.id;
      renderLayers();
      redraw();
      if (!layer.locked) beginTransformInteraction("move", event);
      return;
    }
  }
  state.selectedLayerId = null;
  renderLayers();
  redraw();
}

canvas.addEventListener("pointerdown", event => {
  if (state.tool === "pan") {
    state.transformInteraction = null;
    state.transformPointerId = null;
    state.drawing = false;
    state.drawingPointerId = null;
    state.strokeBefore = null;
    state.panning = true;
    state.panPointerId = event.pointerId;
    state.lastPanPoint = screenPointFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (state.tool === "select") {
    beginSelectionInteraction(event);
    return;
  }
  const layer = selectedLayer();
  if (!layer || layer.locked || layer.contentType === "image") return;
  state.drawing = true;
  state.drawingPointerId = event.pointerId;
  state.strokeBefore = cloneDocument(state.document);
  canvas.setPointerCapture(event.pointerId);
  layer.strokes.push(createStroke(state.tool, 5, [pointFromEvent(event)]));
});

canvas.addEventListener("pointermove", event => {
  if (state.panning && event.pointerId === state.panPointerId) {
    const current = screenPointFromEvent(event);
    const previous = state.lastPanPoint;
    state.lastPanPoint = current;
    if (previous) state.viewport = panBy(state.viewport, current.x - previous.x, current.y - previous.y);
    redraw();
    return;
  }
  if (state.transformInteraction && event.pointerId === state.transformPointerId) {
    updateTransformPreview(event);
    return;
  }
  if (!state.drawing || event.pointerId !== state.drawingPointerId) return;
  const layer = selectedLayer();
  const stroke = layer?.strokes.at(-1);
  if (!stroke) return;
  stroke.points.push(pointFromEvent(event));
  redraw();
});

canvas.addEventListener("pointerup", event => {
  if (state.panning && event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
    state.drawing = false;
    state.drawingPointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (state.transformInteraction && event.pointerId === state.transformPointerId) {
    finishTransformInteraction(false);
    return;
  }
  if (!state.drawing || event.pointerId !== state.drawingPointerId) return;
  state.drawing = false;
  state.drawingPointerId = null;
  const before = state.strokeBefore;
  state.strokeBefore = null;
  if (before) {
    state.history.record(before, state.document);
    persistDocument();
    refreshHistoryControls();
  }
  status.textContent = "Unsaved local changes";
});

canvas.addEventListener("pointercancel", event => {
  if (event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (event.pointerId === state.transformPointerId) {
    finishTransformInteraction(true);
    return;
  }
  if (event.pointerId !== state.drawingPointerId) return;
  state.drawing = false;
  state.drawingPointerId = null;
  const before = state.strokeBefore;
  state.strokeBefore = null;
  if (before) state.document = before;
  refreshDocument("Drawing cancelled");
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  const currentZoom = state.viewport.zoom;
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
  if (nextZoom === currentZoom) return;
  setViewport(zoomAt(state.viewport, nextZoom, screenPointFromEvent(event), canvasCenter()));
}, { passive: false });

document.querySelectorAll(".tool").forEach(button => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    if (state.tool !== "select" && state.transformInteraction) finishTransformInteraction(true);
    document.querySelectorAll(".tool").forEach(b => b.classList.toggle("active", b === button));
    redraw();
  });
});

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

document.querySelector("#add-layer").addEventListener("click", () => {
  const before = cloneDocument(state.document);
  const layer = createLayer("Layer " + (state.document.layers.length + 1));
  state.document.layers.push(layer);
  state.selectedLayerId = layer.id;
  state.history.record(before, state.document);
  refreshDocument();
  persistDocument();
});

document.querySelector("#add-image-layer").addEventListener("click", () => {
  const before = cloneDocument(state.document);
  const layer = createImageLayer("Test Image " + (state.document.layers.length + 1));
  state.document.layers.push(layer);
  state.selectedLayerId = layer.id;
  state.history.record(before, state.document);
  refreshDocument("Image layer created");
  persistDocument();
});

document.querySelectorAll("[data-transform]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.transform;
    if (action === "left") applyLayerOperation((doc, id) => translateLayer(doc, id, -10, 0), "Layer moved");
    if (action === "right") applyLayerOperation((doc, id) => translateLayer(doc, id, 10, 0), "Layer moved");
    if (action === "up") applyLayerOperation((doc, id) => translateLayer(doc, id, 0, -10), "Layer moved");
    if (action === "down") applyLayerOperation((doc, id) => translateLayer(doc, id, 0, 10), "Layer moved");
    if (action === "scale-up") applyLayerOperation((doc, id) => scaleLayer(doc, id, 1.1), "Layer scaled");
    if (action === "scale-down") applyLayerOperation((doc, id) => scaleLayer(doc, id, 1 / 1.1), "Layer scaled");
    if (action === "rotate-left") applyLayerOperation((doc, id) => rotateLayer(doc, id, -5), "Layer rotated");
    if (action === "rotate-right") applyLayerOperation((doc, id) => rotateLayer(doc, id, 5), "Layer rotated");
  });
});

document.querySelector("#clear").addEventListener("click", () => {
  const layer = selectedLayer();
  if (!layer || layer.locked || layer.contentType === "image" || layer.strokes.length === 0) return;
  const before = cloneDocument(state.document);
  layer.strokes = [];
  state.history.record(before, state.document);
  refreshDocument();
  persistDocument();
});

document.querySelector("#save").addEventListener("click", persistDocument);

function load() {
  const raw = localStorage.getItem("animeart-web-document");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.document = restoreDocument(saved) || createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    state.selectedLayerId = state.document.layers.at(-1)?.id || null;
    status.textContent = "Recovered local project";
  } catch {
    state.document = createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    state.selectedLayerId = state.document.layers[0].id;
    status.textContent = "New local project";
  }
}

state.selectedLayerId = state.document.layers[0].id;
load();
renderLayers();
refreshHistoryControls();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
