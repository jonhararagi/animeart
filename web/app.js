import { createDocument, createLayer, createStroke, createStrokePoint, restoreDocument } from "./domain/model.mjs";
import { DocumentHistory, cloneDocument } from "./domain/history.mjs";
import { createViewport, panBy, screenToDocument, zoomAt } from "./domain/viewport.mjs";
import { rotateLayer, scaleLayer, translateLayer } from "./domain/document-operations.mjs";

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const layersEl = document.querySelector("#layers");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

const state = {
  tool: "brush",
  drawing: false,
  panning: false,
  selectedLayerId: null,
  panPointerId: null,
  drawingPointerId: null,
  lastPanPoint: null,
  strokeBefore: null,
  viewport: createViewport(),
  document: createDocument(),
  history: null
};

state.history = new DocumentHistory(state.document);

function selectedLayer() {
  return state.document.layers.find(layer => layer.id === state.selectedLayerId) || state.document.layers[0];
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

function drawDocument() {
  for (const layer of state.document.layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(layer.transform.x, layer.transform.y);
    ctx.translate(canvasCenter().x, canvasCenter().y);
    ctx.rotate(layer.transform.rotation * Math.PI / 180);
    ctx.scale(layer.transform.scale, layer.transform.scale);
    ctx.translate(-canvasCenter().x, -canvasCenter().y);

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
    ctx.restore();
  }
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
    li.textContent = layer.name;
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

function markChanged() {
  status.textContent = "Unsaved local changes";
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
  if (!state.document.layers.some(layer => layer.id === state.selectedLayerId)) {
    state.selectedLayerId = state.document.layers.at(-1)?.id || null;
  }
}

function refreshDocument(message = "Unsaved local changes") {
  syncSelection();
  renderLayers();
  redraw();
  refreshHistoryControls();
  status.textContent = message;
}

function setViewport(viewport) {
  state.viewport = {
    ...viewport,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom))
  };
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

canvas.addEventListener("pointerdown", event => {
  if (state.tool === "pan") {
    state.drawing = false;
    state.drawingPointerId = null;
    state.strokeBefore = null;
    state.panning = true;
    state.panPointerId = event.pointerId;
    state.lastPanPoint = screenPointFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const layer = selectedLayer();
  if (!layer || layer.locked) return;
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
  markChanged();
});

canvas.addEventListener("pointercancel", event => {
  if (event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
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
    document.querySelectorAll(".tool").forEach(b => b.classList.toggle("active", b === button));
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
  if (!layer || layer.locked || layer.strokes.length === 0) return;
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
