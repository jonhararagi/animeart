import { createDocument, createImageLayer, createLayer, createStroke, createStrokePoint, restoreDocument } from "./domain/model.mjs";
import { DocumentHistory, cloneDocument } from "./domain/history.mjs";
import { createViewport, panBy, screenToDocument, zoomAt } from "./domain/viewport.mjs";
import { deleteLayer, duplicateLayer, renameLayer, reorderLayer, rotateLayer, scaleLayer, setLayerLocked, setLayerOpacity, setLayerVisibility, translateLayer, translateLayers, updateLayerTransform } from "./domain/document-operations.mjs";
import { applyImageFileImport, persistDocumentSnapshot } from "./domain/image-import.mjs";
import { clipboardImageFile, firstValidImageFile } from "./domain/image-input.mjs";
import { hitTestHandle, hitTestLayer, normalizeLayerSelection, resizeTransformFromCorner, selectionGeometry, toggleLayerSelection } from "./domain/selection.mjs";
import { canvasToPngBlob, createPngExportCanvas, downloadPngBlob, renderDocumentToCanvas } from "./domain/png-export.mjs";

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const layersEl = document.querySelector("#layers");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const imageFileInput = document.querySelector("#image-file-input");
const newDocumentButton = document.querySelector("#new-document");
const recoverButton = document.querySelector("#recover-project");
const saveButton = document.querySelector("#save");
const exportPngButton = document.querySelector("#export-png");
const projectDialog = document.querySelector("#project-dialog");
const projectForm = document.querySelector("#project-form");
const widthInput = document.querySelector("#document-width");
const heightInput = document.querySelector("#document-height");
const canvasWrap = document.querySelector(".canvas-wrap");
let dragDepth = 0;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const HANDLE_RADIUS = 10;
const imageCache = new Map();

const BRUSH_DEFAULTS = Object.freeze({ color: "#111318", size: 5, opacity: 1 });
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 100;

const state = {
  tool: "brush",
  brush: { ...BRUSH_DEFAULTS },
  drawing: false,
  panning: false,
  selectedLayerId: null,
  selectedLayerIds: [],
  panPointerId: null,
  drawingPointerId: null,
  transformPointerId: null,
  lastPanPoint: null,
  strokeBefore: null,
  transformInteraction: null,
  multiTransformInteraction: null,
  viewport: createViewport(),
  document: createDocument(),
  history: null,
  dirty: false
};

state.history = new DocumentHistory(state.document);

function selectedLayer() {
  return state.document.layers.find(layer => layer.id === state.selectedLayerId) || state.document.layers[0];
}

function selectedLayerExact() {
  return state.document.layers.find(layer => layer.id === state.selectedLayerId) || null;
}

function selectedLayersExact() {
  const ids = new Set(state.selectedLayerIds);
  return state.document.layers.filter(layer => ids.has(layer.id));
}

function setSelection(layerIds, anchorId = null) {
  const normalized = normalizeLayerSelection(layerIds, state.document);
  state.selectedLayerIds = normalized;
  state.selectedLayerId = anchorId && normalized.includes(anchorId)
    ? anchorId
    : normalized.at(-1) || null;
}

function toggleSelection(layerId) {
  const next = toggleLayerSelection(state.selectedLayerIds, layerId, state.document);
  setSelection(next, layerId);
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
  if (state.multiTransformInteraction?.previewDelta && state.selectedLayerIds.includes(layer.id)) {
    return {
      ...layer.transform,
      x: layer.transform.x + state.multiTransformInteraction.previewDelta.x,
      y: layer.transform.y + state.multiTransformInteraction.previewDelta.y
    };
  }
  return state.transformInteraction?.layerId === layer.id
    ? state.transformInteraction.previewTransform
    : layer.transform;
}

function drawImageLayer(layer, context = ctx) {
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
    context.drawImage(image, 0, 0, layer.image.width, layer.image.height);
  }
}

function drawDocument({ context = ctx, document = state.document, center = canvasCenter(), transformForLayer = layerTransformForRender } = {}) {
  for (const layer of document.layers) {
    if (!layer.visible) continue;
    const transform = transformForLayer(layer);
    context.save();
    context.globalAlpha = layer.opacity;
    context.translate(transform.x, transform.y);
    context.translate(center.x, center.y);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale(transform.scale, transform.scale);
    context.translate(-center.x, -center.y);

    if (layer.contentType === "image") {
      drawImageLayer(layer, context);
    } else {
      for (const stroke of layer.strokes) {
        if (stroke.points.length < 2) continue;
        context.beginPath();
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
        context.lineWidth = stroke.size;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.globalAlpha = layer.opacity * (stroke.tool === "eraser" ? 1 : stroke.opacity);
        context.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
        context.stroke();
      }
    }
    context.restore();
  }
}

function drawSelectionOverlay() {
  for (const layer of selectedLayersExact()) {
    if (!layer.visible) continue;
    const previewTransform = state.transformInteraction?.layerId === layer.id
      ? state.transformInteraction.previewTransform
      : state.multiTransformInteraction?.previewDelta && state.selectedLayerIds.includes(layer.id)
        ? {
            ...layer.transform,
            x: layer.transform.x + state.multiTransformInteraction.previewDelta.x,
            y: layer.transform.y + state.multiTransformInteraction.previewDelta.y
          }
        : null;
    const geometry = selectionGeometry(layer, state.viewport, canvasCenter(), previewTransform);
    if (!geometry) continue;
    ctx.save();
    ctx.lineWidth = layer.id === state.selectedLayerId ? 1.5 : 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = layer.id === state.selectedLayerId ? "#2f80ed" : "#7aa7e8";
    ctx.beginPath();
    geometry.corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
    ctx.closePath();
    ctx.stroke();
    if (layer.id !== state.selectedLayerId) {
      ctx.restore();
      continue;
    }
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
}
function redraw() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  applyViewport();
  drawDocument({ context: ctx, document: state.document, center: canvasCenter() });
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
    li.dataset.layerId = layer.id;
    if (state.selectedLayerIds.includes(layer.id)) li.dataset.selected = "true";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "layer-select";
    selectButton.textContent = layer.name + (layer.contentType === "image" ? " [Image]" : "");
    selectButton.setAttribute("aria-label", "Select " + layer.name);
    selectButton.addEventListener("click", event => {
      if (event.shiftKey) {
        toggleSelection(layer.id);
      } else {
        setSelection([layer.id], layer.id);
      }
      renderLayers();
      redraw();
    });

    const visibilityButton = document.createElement("button");
    visibilityButton.type = "button";
    visibilityButton.className = "layer-toggle";
    visibilityButton.textContent = layer.visible ? "◉" : "○";
    visibilityButton.title = layer.visible ? "Hide layer" : "Show layer";
    visibilityButton.setAttribute("aria-label", visibilityButton.title);
    visibilityButton.addEventListener("click", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerVisibility(doc, id, !layer.visible), layer.visible ? "Layer hidden" : "Layer shown");
    });

    const lockButton = document.createElement("button");
    lockButton.type = "button";
    lockButton.className = "layer-toggle";
    lockButton.textContent = layer.locked ? "🔒" : "🔓";
    lockButton.title = layer.locked ? "Unlock layer" : "Lock layer";
    lockButton.setAttribute("aria-label", lockButton.title);
    lockButton.addEventListener("click", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerLocked(doc, id, !layer.locked), layer.locked ? "Layer unlocked" : "Layer locked", { allowLocked: true });
    });

    const opacity = document.createElement("input");
    opacity.type = "range"; opacity.min = "0"; opacity.max = "1"; opacity.step = "0.01";
    opacity.value = String(layer.opacity); opacity.className = "layer-opacity"; opacity.title = "Layer opacity";
    opacity.setAttribute("aria-label", "Opacity for " + layer.name);
    opacity.addEventListener("click", event => event.stopPropagation());
    opacity.addEventListener("change", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerOpacity(doc, id, Number(event.currentTarget.value)), "Layer opacity changed");
    });

    const renameButton = document.createElement("button");
    renameButton.type = "button"; renameButton.className = "layer-action"; renameButton.textContent = "Rename"; renameButton.title = "Rename layer";
    renameButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked) return;
      const requested = window.prompt("Layer name", layer.name);
      if (requested === null) return;
      applyLayerOperation((doc, id) => renameLayer(doc, id, requested), "Layer renamed");
    });

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button"; duplicateButton.className = "layer-action"; duplicateButton.textContent = "Duplicate"; duplicateButton.title = "Duplicate layer";
    duplicateButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked) return;
      const before = cloneDocument(state.document);
      const next = duplicateLayer(state.document, layer.id);
      if (!next) return;
      const originalIndex = state.document.layers.findIndex(item => item.id === layer.id);
      const duplicate = next.layers[originalIndex + 1];
      state.document = next; setSelection([duplicate.id], duplicate.id);
      state.history.record(before, next); refreshDocument("Layer duplicated"); persistDocument();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button"; deleteButton.className = "layer-action"; deleteButton.textContent = "Delete"; deleteButton.title = "Delete layer";
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked || state.document.layers.length <= 1) return;
      applyLayerOperation(deleteLayer, "Layer deleted");
    });

    const reorderUpButton = document.createElement("button");
    reorderUpButton.type = "button"; reorderUpButton.className = "layer-action"; reorderUpButton.textContent = "↑"; reorderUpButton.title = "Move layer up";
    reorderUpButton.addEventListener("click", event => {
      event.stopPropagation(); if (layer.locked) return;
      applyLayerOperation((doc, id) => reorderLayer(doc, id, "up"), "Layer moved up");
    });

    const reorderDownButton = document.createElement("button");
    reorderDownButton.type = "button"; reorderDownButton.className = "layer-action"; reorderDownButton.textContent = "↓"; reorderDownButton.title = "Move layer down";
    reorderDownButton.addEventListener("click", event => {
      event.stopPropagation(); if (layer.locked) return;
      applyLayerOperation((doc, id) => reorderLayer(doc, id, "down"), "Layer moved down");
    });

    const controls = document.createElement("div"); controls.className = "layer-controls"; controls.append(visibilityButton, lockButton, opacity);
    const lifecycle = document.createElement("div"); lifecycle.className = "layer-lifecycle"; lifecycle.append(renameButton, duplicateButton, deleteButton, reorderUpButton, reorderDownButton);
    li.append(selectButton, controls, lifecycle);
    layersEl.appendChild(li);
  });
}

function persistDocument({ markSaved = false } = {}) {
  localStorage.setItem("animeart-web-document", JSON.stringify(state.document));
  state.dirty = !markSaved;
  status.textContent = markSaved ? "Saved locally" : "Local backup updated";
}

function refreshHistoryControls() {
  undoButton.disabled = !state.history.canUndo();
  redoButton.disabled = !state.history.canRedo();
}

function syncSelection() {
  const normalized = normalizeLayerSelection(state.selectedLayerIds, state.document);
  if (!normalized.length) {
    const fallback = state.document.layers.at(-1)?.id || null;
    setSelection(fallback ? [fallback] : [], fallback);
    return;
  }
  setSelection(normalized, state.selectedLayerId);
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

function applyLayerOperation(operation, message, { allowLocked = false } = {}) {
  const layer = selectedLayer();
  if (!layer || (layer.locked && !allowLocked)) return;
  const before = cloneDocument(state.document);
  const next = operation(state.document, layer.id);
  if (!next) return;
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
}

function applyMultiLayerMove(deltaX, deltaY, message = "Layers moved") {
  const layers = selectedLayersExact();
  if (layers.length < 2 || layers.some(layer => layer.locked)) return false;
  const before = cloneDocument(state.document);
  const next = translateLayers(state.document, layers.map(layer => layer.id), deltaX, deltaY);
  if (!next) return false;
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
  return true;
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
  if (state.selectedLayerIds.length > 1) {
    const documentPoint = screenToDocument(screenPoint, state.viewport, canvasCenter());
    const hitSelectedLayer = [...state.document.layers].reverse().find(layer =>
      layer.visible &&
      state.selectedLayerIds.includes(layer.id) &&
      hitTestLayer(layer, documentPoint, canvasCenter())
    );
    if (hitSelectedLayer && selectedLayersExact().every(layer => !layer.locked)) {
      state.selectedLayerId = hitSelectedLayer.id;
      state.multiTransformInteraction = {
        pointerId: event.pointerId,
        startDocument: documentPoint,
        previewDelta: { x: 0, y: 0 }
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
  if (selectedHit === "move" && state.selectedLayerIds.length === 1) {
  if (selectedHit === "move") return beginTransformInteraction("move", event);
  if (selectedHit?.startsWith("scale-")) return beginTransformInteraction("scale", event, selectedHit);
  if (selectedHit === "rotate") return beginTransformInteraction("rotate", event);
  const documentPoint = screenToDocument(screenPoint, state.viewport, canvasCenter());
  for (const layer of [...state.document.layers].reverse()) {
    if (!layer.visible) continue;
    if (hitTestLayer(layer, documentPoint, canvasCenter())) {
      if (event.shiftKey) toggleSelection(layer.id);
      else setSelection([layer.id], layer.id);
      renderLayers();
      redraw();
      if (!event.shiftKey && !layer.locked) beginTransformInteraction("move", event);
      return;
    }
  }
  if (!event.shiftKey) setSelection([], null);
  renderLayers();
  redraw();
}

canvas.addEventListener("pointerdown", event => {
  if (state.tool === "pan") {
    state.transformInteraction = null;
    state.transformPointerId = null;
    state.multiTransformInteraction = null;
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
  layer.strokes.push(createStroke(state.tool, state.brush.size, [pointFromEvent(event)], state.brush.color, state.brush.opacity));
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
  if (state.multiTransformInteraction && event.pointerId === state.multiTransformInteraction.pointerId) {
    const current = screenToDocument(screenPointFromEvent(event), state.viewport, canvasCenter());
    const start = state.multiTransformInteraction.startDocument;
    state.multiTransformInteraction.previewDelta = { x: current.x - start.x, y: current.y - start.y };
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
  if (state.multiTransformInteraction && event.pointerId === state.multiTransformInteraction.pointerId) {
    const interaction = state.multiTransformInteraction;
    state.multiTransformInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const delta = interaction.previewDelta || { x: 0, y: 0 };
    if (delta.x !== 0 || delta.y !== 0) applyMultiLayerMove(delta.x, delta.y);
    else redraw();
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
  if (state.multiTransformInteraction?.pointerId === event.pointerId) {
    state.multiTransformInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
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

function setBrushColor(value) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return false;
  state.brush.color = value;
  return true;
}

function setBrushSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return false;
  const clamped = Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, size));
  state.brush.size = clamped;
  return true;
}

function setBrushOpacity(value) {
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return false;
  state.brush.opacity = Math.min(1, Math.max(0, opacity));
  return true;
}

const brushColorInput = document.querySelector("#brush-color");
const brushSizeInput = document.querySelector("#brush-size");
const brushSizeValue = document.querySelector("#brush-size-value");
const brushOpacityInput = document.querySelector("#brush-opacity");
const brushOpacityValue = document.querySelector("#brush-opacity-value");

brushColorInput.addEventListener("input", event => {
  if (setBrushColor(event.currentTarget.value)) redraw();
});

brushSizeInput.addEventListener("input", event => {
  if (!setBrushSize(event.currentTarget.value)) return;
  brushSizeValue.textContent = String(state.brush.size);
});

brushOpacityInput.addEventListener("input", event => {
  if (!setBrushOpacity(Number(event.currentTarget.value) / 100)) return;
  brushOpacityValue.textContent = Math.round(state.brush.opacity * 100) + "%";
});

function syncBrushControls() {
  brushColorInput.value = state.brush.color;
  brushSizeInput.value = String(state.brush.size);
  brushSizeValue.textContent = String(state.brush.size);
  brushOpacityInput.value = String(Math.round(state.brush.opacity * 100));
  brushOpacityValue.textContent = Math.round(state.brush.opacity * 100) + "%";
}

document.querySelectorAll(".tool").forEach(button => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    if (state.tool !== "select" && state.multiTransformInteraction) {
    state.multiTransformInteraction = null;
  }
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
  setSelection([layer.id], layer.id);
  state.history.record(before, state.document);
  refreshDocument();
  persistDocument();
});

async function importImageIntoEditor(file, message = "Image imported") {
  if (!file) return false;
  try {
    const result = await applyImageFileImport(file, {
      document: state.document,
      history: state.history,
      persist: next => persistDocumentSnapshot(localStorage, "animeart-web-document", next)
    });
    state.document = result.document;
    setSelection([result.layer.id], result.layer.id);
    state.dirty = true;
    refreshDocument(message);
    return true;
  } catch (error) {
    status.textContent = error?.message || "Image import failed";
    return false;
  }
}
function setDropFeedback(active) {
  canvasWrap.classList.toggle("drop-active", active);
  if (active) status.textContent = "Drop image to import";
}

function clearDropFeedback(message = null) {
  dragDepth = 0;
  canvasWrap.classList.remove("drop-active");
  if (message) status.textContent = message;
}

document.querySelector("#add-image-layer").addEventListener("click", () => {
  imageFileInput.click();
});

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files?.[0];
  imageFileInput.value = "";
  if (!file) {
    status.textContent = "Import cancelled";
    return;
  }
  await importImageIntoEditor(file);
});

canvas.addEventListener("dragenter", event => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  dragDepth += 1;
  setDropFeedback(true);
});

canvas.addEventListener("dragover", event => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  setDropFeedback(true);
});

canvas.addEventListener("dragleave", event => {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) clearDropFeedback();
});

canvas.addEventListener("dragend", () => clearDropFeedback());

canvas.addEventListener("drop", async event => {
  event.preventDefault();
  const file = firstValidImageFile(event.dataTransfer?.files);
  clearDropFeedback();
  if (!file) {
    status.textContent = "No supported image dropped";
    return;
  }
  await importImageIntoEditor(file);
});

document.addEventListener("paste", async event => {
  const file = clipboardImageFile(event.clipboardData?.items);
  if (!file) return;
  event.preventDefault();
  await importImageIntoEditor(file);
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

function restoreStoredProject({ confirmDiscard = true } = {}) {
  const raw = localStorage.getItem("animeart-web-document");
  if (!raw) {
    status.textContent = "No local project to recover";
    return false;
  }
  if (confirmDiscard && state.dirty && !window.confirm("Discard changes since the last explicit save?")) return false;
  try {
    const saved = JSON.parse(raw);
    const restored = restoreDocument(saved);
    if (!restored) throw new Error("Stored project is invalid");
    state.document = restored;
    state.history.reset(restored);
    setSelection(restored.layers.at(-1)?.id ? [restored.layers.at(-1).id] : [], restored.layers.at(-1)?.id || null);
    state.viewport = createViewport();
    state.transformInteraction = null;
    state.multiTransformInteraction = null;
    state.drawing = false;
    state.strokeBefore = null;
    state.dirty = false;
    refreshDocument("Recovered local project");
    return true;
  } catch {
    status.textContent = "Stored project could not be recovered";
    return false;
  }
}

function createNewDocumentFromForm() {
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    status.textContent = "Width and height must be positive whole numbers";
    return false;
  }
  if (state.dirty && !window.confirm("Discard changes since the last explicit save?")) return false;
  const next = createDocument(width, height);
  state.document = next;
  state.history.reset(next);
  setSelection([next.layers[0].id], next.layers[0].id);
  state.viewport = createViewport();
  state.transformInteraction = null;
  state.multiTransformInteraction = null;
  state.drawing = false;
  state.strokeBefore = null;
  state.dirty = false;
  refreshDocument("New document created");
  return true;
}

newDocumentButton.addEventListener("click", () => {
  widthInput.value = String(state.document.width > 0 ? state.document.width : 800);
  heightInput.value = String(state.document.height > 0 ? state.document.height : 600);
  projectDialog.showModal();
  widthInput.focus();
});

document.querySelector("#cancel-document").addEventListener("click", () => projectDialog.close());

projectForm.addEventListener("submit", event => {
  event.preventDefault();
  if (createNewDocumentFromForm()) projectDialog.close();
});

recoverButton.addEventListener("click", () => {
  restoreStoredProject();
});

saveButton.addEventListener("click", () => {
  try {
    persistDocument({ markSaved: true });
  } catch {
    status.textContent = "Could not save project locally";
  }
});

async function exportPng() {
  const documentBefore = JSON.stringify(state.document);
  const historyBeforeUndo = state.history.canUndo();
  const historyBeforeRedo = state.history.canRedo();
  exportPngButton.disabled = true;
  status.textContent = "Exporting PNG…";
  try {
    await ensureExportImages(state.document);
    const exportCanvas = createPngExportCanvas(state.document);
    renderDocumentToCanvas(state.document, exportCanvas, ({ context, document, center }) => {
      drawDocument({
        context,
        document,
        center,
        transformForLayer: layer => layer.transform
      });
    });
    const blob = await canvasToPngBlob(exportCanvas);
    downloadPngBlob(blob, "animeart.png");
    if (JSON.stringify(state.document) !== documentBefore ||
        state.history.canUndo() !== historyBeforeUndo ||
        state.history.canRedo() !== historyBeforeRedo) {
      throw new Error("PNG export modified editor state");
    }
    status.textContent = "PNG exported";
  } catch (error) {
    status.textContent = error?.message || "PNG export failed";
  } finally {
    exportPngButton.disabled = false;
  }
}

exportPngButton.addEventListener("click", exportPng);

function ensureExportImages(document) {
  const pending = document.layers
    .filter(layer => layer.visible && layer.contentType === "image" && layer.image?.source)
    .map(layer => new Promise((resolve, reject) => {
      let image = imageCache.get(layer.image.source);
      if (image?.complete && image.naturalWidth > 0) {
        resolve(image);
        return;
      }
      if (!image) {
        image = new Image();
        imageCache.set(layer.image.source, image);
      }
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image could not be prepared for PNG export"));
      image.src = layer.image.source;
    }));
  return Promise.all(pending);
}



function load() {
  const raw = localStorage.getItem("animeart-web-document");
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    state.document = restoreDocument(saved) || createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    setSelection(state.document.layers.at(-1)?.id ? [state.document.layers.at(-1).id] : [], state.document.layers.at(-1)?.id || null);
    state.dirty = false;
    status.textContent = "Recovered local project";
  } catch {
    state.document = createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    setSelection([state.document.layers[0].id], state.document.layers[0].id);
    state.dirty = false;
    status.textContent = "New local project";
  }
}

setSelection([state.document.layers[0].id], state.document.layers[0].id);
load();
renderLayers();
refreshHistoryControls();
syncBrushControls();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
