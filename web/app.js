import { createDocument, createLayer, createStroke, createStrokePoint, restoreDocument } from "./domain/model.mjs";
import { createViewport, documentToScreen, panBy, screenToDocument, zoomAt } from "./domain/viewport.mjs";

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const layersEl = document.querySelector("#layers");

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

const state = {
  tool: "brush",
  drawing: false,
  panning: false,
  selectedLayerId: null,
  panPointerId: null,
  lastPanPoint: null,
  viewport: createViewport(),
  document: createDocument()
};

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

function setViewport(viewport) {
  state.viewport = {
    ...viewport,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom))
  };
  redraw();
}

canvas.addEventListener("pointerdown", event => {
  if (state.tool === "pan") {
    state.panning = true;
    state.panPointerId = event.pointerId;
    state.lastPanPoint = screenPointFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const layer = selectedLayer();
  if (!layer || layer.locked) return;
  state.drawing = true;
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

  if (!state.drawing) return;
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
    return;
  }

  if (!state.drawing) return;
  state.drawing = false;
  markChanged();
});

canvas.addEventListener("pointercancel", event => {
  if (event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
  }
  state.drawing = false;
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

document.querySelector("#add-layer").addEventListener("click", () => {
  const layer = createLayer("Layer " + (state.document.layers.length + 1));
  state.document.layers.push(layer);
  state.selectedLayerId = layer.id;
  renderLayers();
  redraw();
  markChanged();
});

document.querySelector("#clear").addEventListener("click", () => {
  const layer = selectedLayer();
  if (!layer || layer.locked) return;
  layer.strokes = [];
  redraw();
  markChanged();
});

document.querySelector("#save").addEventListener("click", () => {
  localStorage.setItem("animeart-web-document", JSON.stringify(state.document));
  status.textContent = "Saved locally";
});

function load() {
  const raw = localStorage.getItem("animeart-web-document");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.document = restoreDocument(saved) || createDocument();
    state.selectedLayerId = state.document.layers.at(-1)?.id || null;
    status.textContent = "Recovered local project";
  } catch {
    state.document = createDocument();
    state.selectedLayerId = state.document.layers[0].id;
    status.textContent = "New local project";
  }
}

state.selectedLayerId = state.document.layers[0].id;
load();
renderLayers();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
