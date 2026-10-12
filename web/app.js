import { DOCUMENT_VERSION, createDocument, createImageLayer, createLayer, createStroke, createStrokePoint, createTextLayer, restoreDocument } from "./domain/model.mjs";
import { cropImageSource, resizeImageSource } from "./domain/image-processing.mjs";
import { parseProjectFile, serializeProjectFile } from "./domain/project-file.mjs";
import { DocumentHistory, cloneDocument } from "./domain/history.mjs";
import { createViewport, panBy } from "./domain/viewport.mjs";
import { documentCenter, documentFitScale, documentToScreenPoint, screenToDocumentPoint, screenViewportForDocument, zoomViewportAt } from "./domain/canvas-space.mjs";
import { addLayer, clearLayer, deleteLayer, duplicateLayer, renameLayer, reorderLayer, rotateLayer, scaleLayer, setLayerAdjustments, setLayerLocked, setLayerOpacity, setLayerReference, setLayerText, setLayerVisibility, replaceImageLayer, transformLayers, translateLayer, translateLayers, updateLayerTransform } from "./domain/document-operations.mjs";
import { LAYER_ADJUSTMENT_PRESETS, areLayerAdjustmentsEqual, layerAdjustmentsToCanvasFilter, normalizeLayerAdjustments } from "./domain/layer-adjustments.mjs";
import { normalizeTextLayer, TEXT_FONT_FAMILIES } from "./domain/text-layer.mjs";
import { applyImageFileImport, persistDocumentSnapshot } from "./domain/image-import.mjs";
import { clipboardImageFile, firstValidImageFile } from "./domain/image-input.mjs";
import { groupRotationTransforms, groupScaleTransforms, hitTestHandle, hitTestLayer, multiSelectionGeometry, normalizeLayerSelection, resizeTransformFromCorner, selectionGeometry, toggleLayerSelection } from "./domain/selection.mjs";
import { canvasToImageBlob, createPngExportCanvas, downloadImageBlob, renderDocumentToCanvas } from "./domain/png-export.mjs";

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const status = document.querySelector("#status");
const recoveryNotice = document.querySelector("#storage-recovery-notice");
const layersEl = document.querySelector("#layers");
const adjustmentLayerName = document.querySelector("#adjustment-layer-name");
const layerAdjustmentControls = document.querySelector("#layer-adjustment-controls");
const resetLayerAdjustmentsButton = document.querySelector("#reset-layer-adjustments");
const adjustmentPresetButtons = [...document.querySelectorAll("[data-adjustment-preset]")];
const textPanel = document.querySelector("#text-panel");
const textContentInput = document.querySelector("#text-content");
const textFontSizeInput = document.querySelector("#text-font-size");
const textFontSizeValue = document.querySelector("#text-font-size-value");
const textFontFamilyInput = document.querySelector("#text-font-family");
const textFontWeightInput = document.querySelector("#text-font-weight");
const textColorInput = document.querySelector("#text-color");
const textAlignInput = document.querySelector("#text-align");
const textLayerName = document.querySelector("#text-layer-name");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const imageFileInput = document.querySelector("#image-file-input");
const cropResizeButton = document.querySelector("#crop-resize-image");
const imageEditDialog = document.querySelector("#image-edit-dialog");
const imageEditForm = document.querySelector("#image-edit-form");
const imageEditSourceSize = document.querySelector("#image-edit-source-size");
const imageCropFields = document.querySelector("#image-crop-fields");
const imageResizeFields = document.querySelector("#image-resize-fields");
const imageCropX = document.querySelector("#image-crop-x");
const imageCropY = document.querySelector("#image-crop-y");
const imageCropWidth = document.querySelector("#image-crop-width");
const imageCropHeight = document.querySelector("#image-crop-height");
const imageResizeWidth = document.querySelector("#image-resize-width");
const imageResizeHeight = document.querySelector("#image-resize-height");
const imageResizeKeepAspect = document.querySelector("#image-resize-keep-aspect");
let imageEditLayerId = null;
let imageEditOriginalSize = null;
const newDocumentButton = document.querySelector("#new-document");
const recoverButton = document.querySelector("#recover-project");
const exportProjectButton = document.querySelector("#export-project");
const importProjectButton = document.querySelector("#import-project");
const projectFileInput = document.querySelector("#project-file-input");
const saveButton = document.querySelector("#save");
const exportPngButton = document.querySelector("#export-png");
const exportFormatInput = document.querySelector("#export-format");
const exportQualityControl = document.querySelector("#export-quality-control");
const exportQualityInput = document.querySelector("#export-quality");
const exportQualityValue = document.querySelector("#export-quality-value");
const exportBackgroundControl = document.querySelector("#export-background-control");
const exportBackgroundInput = document.querySelector("#export-background");
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

const ADJUSTMENT_CONTROL_DEFS = Object.freeze([
  { key: "brightness", label: "Brightness", min: 0, max: 200, step: 1 },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1 },
  { key: "saturation", label: "Saturation", min: 0, max: 200, step: 1 },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1 },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.1 }
]);

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
  adjustmentPreview: null,
  textPreview: null,
  viewport: createViewport(),
  document: createDocument(),
  history: null,
  dirty: false,
  storageRecoveryPending: false,
  storageRecoveryMessage: ""
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
    : normalized[normalized.length - 1] || null;
}

function toggleSelection(layerId) {
  const next = toggleLayerSelection(state.selectedLayerIds, layerId, state.document);
  setSelection(next, layerId);
}

function canvasCenter() {
  const rect = canvas.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

function canvasSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  redraw();
}

function applyViewport() {
  const screenCenter = canvasCenter();
  const center = documentCenter(state.document);
  const scale = documentFitScale(state.document, canvasSize()) * state.viewport.zoom;
  ctx.translate(screenCenter.x + state.viewport.panX, screenCenter.y + state.viewport.panY);
  ctx.scale(scale, scale);
  ctx.translate(-center.x, -center.y);
}

function layerTransformForRender(layer) {
  const previewTransforms = state.multiTransformInteraction?.previewTransforms;
  if (previewTransforms?.has(layer.id)) return previewTransforms.get(layer.id);
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

function drawDocument({ context = ctx, document = state.document, center = documentCenter(document), transformForLayer = layerTransformForRender } = {}) {
  for (const layer of document.layers) {
    if (!layer.visible) continue;
    const transform = transformForLayer(layer);
    context.save();
    const previewAdjustments = state.adjustmentPreview?.layerId === layer.id
      ? state.adjustmentPreview.values
      : layer.adjustments;
    const previewText = state.textPreview?.layerId === layer.id
      ? state.textPreview.values
      : layer.text;
    context.filter = layerAdjustmentsToCanvasFilter(previewAdjustments);
    context.globalAlpha = layer.opacity;
    context.translate(transform.x, transform.y);
    context.translate(center.x, center.y);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale(transform.scale, transform.scale);
    context.translate(-center.x, -center.y);

    if (layer.contentType === "image") {
      drawImageLayer(layer, context);
    } else if (layer.contentType === "text" && previewText) {
      context.fillStyle = previewText.color;
      context.textAlign = previewText.align;
      context.textBaseline = "alphabetic";
      const safeFamily = TEXT_FONT_FAMILIES.includes(previewText.fontFamily) ? previewText.fontFamily : "Arial";
      const genericFamily = ["sans-serif", "serif", "monospace"].includes(safeFamily);
      const fontFamily = genericFamily ? safeFamily : '"' + safeFamily.replace(/["\\]/g, "") + '"';
      context.font = `${previewText.fontWeight} ${previewText.fontSize}px ${fontFamily}`;
      const lineHeight = previewText.fontSize * 1.2;
      previewText.value.split("\n").forEach((line, index) => {
        context.fillText(line, previewText.x, previewText.y + index * lineHeight);
      });
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
  const selectedLayers = selectedLayersExact();
  if (selectedLayers.length > 1) {
    const geometry = multiSelectionGeometry(selectedLayers.map(layer => ({
      ...layer,
      transform: layerTransformForRender(layer)
    })), documentCenter(state.document));
    if (geometry) {
      const viewportSize = canvasSize();
      const corners = geometry.corners.map(point => documentToScreenPoint(point, state.document, state.viewport, viewportSize));
      const groupGeometry = {
        corners,
        center: documentToScreenPoint(geometry.center, state.document, state.viewport, viewportSize)
      };
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#2f80ed";
      ctx.lineWidth = 2;
      ctx.beginPath();
      corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
      ctx.closePath();
      ctx.stroke();
      const topMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
      const outward = { x: topMid.x - groupGeometry.center.x, y: topMid.y - groupGeometry.center.y };
      const length = Math.hypot(outward.x, outward.y) || 1;
      groupGeometry.rotationHandle = { x: topMid.x + outward.x / length * 32, y: topMid.y + outward.y / length * 32 };
      ctx.setLineDash([]);
      for (const corner of corners) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2f80ed";
        ctx.beginPath();
        ctx.rect(corner.x - 5, corner.y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(topMid.x, topMid.y);
      ctx.lineTo(groupGeometry.rotationHandle.x, groupGeometry.rotationHandle.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(groupGeometry.rotationHandle.x, groupGeometry.rotationHandle.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
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
    const geometry = selectionGeometry(layer, screenViewportForDocument(state.document, state.viewport, canvasSize()), documentCenter(state.document), previewTransform);
    if (!geometry) continue;
    ctx.save();
    ctx.lineWidth = layer.id === state.selectedLayerId ? 1.5 : 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = layer.id === state.selectedLayerId ? "#2f80ed" : "#7aa7e8";
    ctx.beginPath();
    geometry.corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
    ctx.closePath();
    ctx.stroke();
    if (selectedLayers.length > 1 || layer.id !== state.selectedLayerId) {
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
  if (state.document.width > 0 && state.document.height > 0) {
    ctx.beginPath();
    ctx.rect(0, 0, state.document.width, state.document.height);
    ctx.clip();
  }
  drawDocument({ context: ctx, document: state.document, center: documentCenter(state.document) });
  ctx.restore();
  drawSelectionOverlay();
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  return createStrokePoint(screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize()));
}

function screenPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function renderLayers() {
  while (layersEl.firstChild) layersEl.removeChild(layersEl.firstChild);
  [...state.document.layers].reverse().forEach(layer => {
    const li = document.createElement("li");
    li.dataset.layerId = layer.id;
    if (state.selectedLayerIds.includes(layer.id)) li.dataset.selected = "true";

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "layer-select";
    selectButton.textContent = layer.name + (layer.contentType === "image" ? (layer.isReference ? " [Reference]" : " [Image]") : layer.contentType === "text" ? " [Text]" : "");
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

    const referenceButton = document.createElement("button");
    referenceButton.type = "button";
    referenceButton.className = "layer-action";
    referenceButton.textContent = layer.isReference ? "Image" : "Reference";
    referenceButton.title = layer.isReference ? "Convert reference to image" : "Use image as reference";
    referenceButton.setAttribute("aria-label", referenceButton.title);
    referenceButton.disabled = layer.contentType !== "image" || layer.locked;
    referenceButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.contentType !== "image" || layer.locked) return;
      applyLayerOperation(
        (doc, id) => setLayerReference(doc, id, !layer.isReference),
        layer.isReference ? "Reference converted to image" : "Image converted to reference"
      );
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
    const lifecycle = document.createElement("div"); lifecycle.className = "layer-lifecycle"; lifecycle.append(renameButton, referenceButton, duplicateButton, deleteButton, reorderUpButton, reorderDownButton);
    li.append(selectButton, controls, lifecycle);
    layersEl.appendChild(li);
  });
  renderLayerAdjustments();
  renderLayerText();
  refreshImageEditButton();
}

function refreshImageEditButton() {
  if (!cropResizeButton) return;
  const layer = selectedLayerExact();
  const editableImage = Boolean(layer && layer.contentType === "image" && layer.image && !layer.locked);
  cropResizeButton.disabled = !editableImage;
  cropResizeButton.title = editableImage ? "Crop or resize the selected image layer" : "Select an unlocked image layer to crop or resize";
}

function currentImageEditMode() {
  return document.querySelector('input[name="image-edit-mode"]:checked')?.value === "resize" ? "resize" : "crop";
}

function syncImageEditMode() {
  const resize = currentImageEditMode() === "resize";
  imageCropFields.hidden = resize;
  imageResizeFields.hidden = !resize;
  document.querySelector("#apply-image-edit").textContent = resize ? "Resize image" : "Crop image";
}

function syncAspectRatioFromWidth() {
  if (!imageResizeKeepAspect.checked || !imageEditOriginalSize) return;
  const width = Number(imageResizeWidth.value);
  if (Number.isInteger(width) && width > 0) imageResizeHeight.value = String(Math.max(1, Math.round(width * imageEditOriginalSize.height / imageEditOriginalSize.width)));
}

function syncAspectRatioFromHeight() {
  if (!imageResizeKeepAspect.checked || !imageEditOriginalSize) return;
  const height = Number(imageResizeHeight.value);
  if (Number.isInteger(height) && height > 0) imageResizeWidth.value = String(Math.max(1, Math.round(height * imageEditOriginalSize.width / imageEditOriginalSize.height)));
}

cropResizeButton.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "Select an unlocked image layer before cropping or resizing";
    return;
  }
  imageEditLayerId = layer.id;
  imageEditOriginalSize = { width: layer.image.width, height: layer.image.height };
  imageEditSourceSize.textContent = layer.name + " · " + layer.image.width + " × " + layer.image.height + " px";
  imageCropX.value = "0"; imageCropY.value = "0";
  imageCropWidth.value = String(layer.image.width); imageCropHeight.value = String(layer.image.height);
  imageResizeWidth.value = String(layer.image.width); imageResizeHeight.value = String(layer.image.height);
  imageResizeKeepAspect.checked = true;
  document.querySelector('input[name="image-edit-mode"][value="crop"]').checked = true;
  syncImageEditMode();
  imageEditDialog.showModal();
});

document.querySelector("#cancel-image-edit").addEventListener("click", () => imageEditDialog.close());
document.querySelectorAll('input[name="image-edit-mode"]').forEach(input => input.addEventListener("change", syncImageEditMode));
imageResizeWidth.addEventListener("input", syncAspectRatioFromWidth);
imageResizeHeight.addEventListener("input", syncAspectRatioFromHeight);

imageEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  const layer = state.document.layers.find(item => item.id === imageEditLayerId);
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "The selected image layer is no longer available";
    imageEditDialog.close();
    return;
  }
  if (state.storageRecoveryPending) {
    status.textContent = "Saved project is protected. Choose Save to replace it explicitly.";
    return;
  }
  const applyButton = document.querySelector("#apply-image-edit");
  const mode = currentImageEditMode();
  applyButton.disabled = true;
  try {
    let replacement, options = {};
    if (mode === "crop") {
      const x = Number(imageCropX.value), y = Number(imageCropY.value);
      const width = Number(imageCropWidth.value), height = Number(imageCropHeight.value);
      replacement = await cropImageSource(layer.image.source, { x, y, width, height });
      options = { cropOrigin: { x, y } };
    } else {
      const width = Number(imageResizeWidth.value);
      let height = Number(imageResizeHeight.value);
      if (imageResizeKeepAspect.checked && imageEditOriginalSize) {
        height = Math.max(1, Math.round(width * imageEditOriginalSize.height / imageEditOriginalSize.width));
        imageResizeHeight.value = String(height);
      }
      replacement = await resizeImageSource(layer.image.source, width, height);
      options = { preserveDisplaySize: imageResizeKeepAspect.checked };
    }
    const before = cloneDocument(state.document);
    const next = replaceImageLayer(state.document, layer.id, replacement, options);
    if (!next) throw new Error("Image edit was rejected. Check the dimensions and selected layer.");
    state.document = next;
    setSelection([layer.id], layer.id);
    state.history.record(before, next);
    state.adjustmentPreview = null;
    refreshDocument(mode === "crop" ? "Image cropped" : "Image resized");
    persistDocument();
    status.textContent = mode === "crop" ? "Image cropped" : "Image resized";
    imageEditDialog.close();
  } catch (error) {
    status.textContent = error?.message || "Image edit failed";
  } finally {
    applyButton.disabled = false;
  }
});

function getWorkingLayerAdjustments(layer) {
  if (state.adjustmentPreview?.layerId === layer?.id) return state.adjustmentPreview.values;
  return normalizeLayerAdjustments(layer?.adjustments);
}

function formatAdjustmentValue(definition, value) {
  if (definition.key === "blur") return Number(value).toFixed(1) + " px";
  if (definition.key === "hue") return Math.round(Number(value)) + "°";
  return Math.round(Number(value)) + "%";
}

function syncAdjustmentPresetButtons(values) {
  adjustmentPresetButtons.forEach(button => {
    const preset = LAYER_ADJUSTMENT_PRESETS.find(item => item.id === button.dataset.adjustmentPreset);
    button.classList.toggle("active", Boolean(preset && areLayerAdjustmentsEqual(values, preset.values)));
  });
}

function commitLayerAdjustments(layerId, values, message = "Image adjustments updated") {
  const layer = state.document.layers.find(item => item.id === layerId);
  const normalized = normalizeLayerAdjustments(values);
  state.adjustmentPreview = null;
  if (!layer || layer.locked || areLayerAdjustmentsEqual(layer.adjustments, normalized)) {
    redraw();
    renderLayerAdjustments();
    return false;
  }

  const before = cloneDocument(state.document);
  const next = setLayerAdjustments(state.document, layerId, normalized);
  if (!next) {
    redraw();
    return false;
  }
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
  return true;
}

function renderLayerAdjustments() {
  if (!layerAdjustmentControls || !adjustmentLayerName || !resetLayerAdjustmentsButton) return;
  const layer = selectedLayerExact();
  const disabled = !layer || layer.locked;
  const values = layer ? getWorkingLayerAdjustments(layer) : normalizeLayerAdjustments();
  adjustmentLayerName.textContent = layer
    ? layer.name + " · " + (layer.contentType === "image" ? (layer.isReference ? "Reference image" : "Image layer") : layer.contentType === "text" ? "Text layer" : "Drawing layer")
    : "Select a layer to edit";
  resetLayerAdjustmentsButton.disabled = disabled;
  adjustmentPresetButtons.forEach(button => { button.disabled = disabled; });
  syncAdjustmentPresetButtons(values);
  layerAdjustmentControls.replaceChildren();

  for (const definition of ADJUSTMENT_CONTROL_DEFS) {
    const label = document.createElement("label");
    label.className = "adjustment-control";
    label.htmlFor = "adjustment-" + definition.key;

    const heading = document.createElement("span");
    heading.className = "adjustment-control-heading";
    const name = document.createElement("span");
    name.textContent = definition.label;
    const output = document.createElement("output");
    output.textContent = formatAdjustmentValue(definition, values[definition.key]);
    heading.append(name, output);

    const input = document.createElement("input");
    input.id = "adjustment-" + definition.key;
    input.type = "range";
    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(values[definition.key]);
    input.disabled = disabled;
    input.setAttribute("aria-label", definition.label + " for " + (layer?.name || "selected layer"));
    input.addEventListener("input", () => {
      if (!layer || layer.locked) return;
      const nextValues = normalizeLayerAdjustments({
        ...getWorkingLayerAdjustments(layer),
        [definition.key]: Number(input.value)
      });
      state.adjustmentPreview = { layerId: layer.id, values: nextValues };
      output.textContent = formatAdjustmentValue(definition, nextValues[definition.key]);
      syncAdjustmentPresetButtons(nextValues);
      redraw();
    });
    input.addEventListener("change", () => {
      if (!layer || layer.locked) return;
      const preview = state.adjustmentPreview;
      if (preview?.layerId === layer.id) commitLayerAdjustments(layer.id, preview.values);
    });

    label.append(heading, input);
    layerAdjustmentControls.appendChild(label);
  }
}

resetLayerAdjustmentsButton.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (layer && !layer.locked) commitLayerAdjustments(layer.id, {});
});

adjustmentPresetButtons.forEach(button => {
  button.addEventListener("click", () => {
    const layer = selectedLayerExact();
    const preset = LAYER_ADJUSTMENT_PRESETS.find(item => item.id === button.dataset.adjustmentPreset);
    if (layer && !layer.locked && preset) {
      commitLayerAdjustments(layer.id, preset.values, preset.label + " preset applied");
    }
  });
});

function getWorkingLayerText(layer) {
  if (state.textPreview?.layerId === layer?.id) return state.textPreview.values;
  return normalizeTextLayer(layer?.text);
}

function renderLayerText() {
  if (!textPanel) return;
  const layer = selectedLayerExact();
  const isText = layer?.contentType === "text";
  textPanel.hidden = !isText;
  if (!isText) {
    state.textPreview = null;
    return;
  }

  const values = getWorkingLayerText(layer);
  const disabled = layer.locked;
  textLayerName.textContent = layer.name;
  textContentInput.value = values.value;
  textFontSizeInput.value = String(values.fontSize);
  textFontSizeValue.textContent = values.fontSize + " px";
  textFontFamilyInput.value = values.fontFamily;
  textFontWeightInput.value = values.fontWeight;
  textColorInput.value = values.color;
  textAlignInput.value = values.align;
  for (const input of [textContentInput, textFontSizeInput, textFontFamilyInput, textFontWeightInput, textColorInput, textAlignInput]) {
    input.disabled = disabled;
  }
  textFontSizeInput.setAttribute("aria-label", "Font size for " + layer.name);
  textContentInput.setAttribute("aria-label", "Text content for " + layer.name);
}

function updateTextPreview(patch) {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "text" || layer.locked) return;
  state.textPreview = {
    layerId: layer.id,
    values: normalizeTextLayer({ ...getWorkingLayerText(layer), ...patch })
  };
  redraw();
}

function commitLayerText(layerId, textValues, message = "Text style updated") {
  const layer = state.document.layers.find(item => item.id === layerId);
  const normalized = normalizeTextLayer(textValues);
  state.textPreview = null;
  if (!layer || layer.contentType !== "text" || layer.locked || JSON.stringify(layer.text) === JSON.stringify(normalized)) {
    redraw();
    renderLayerText();
    return false;
  }

  const before = cloneDocument(state.document);
  const next = setLayerText(state.document, layerId, normalized);
  if (!next) {
    redraw();
    return false;
  }
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
  return true;
}

function commitTextPreview(message = "Text style updated") {
  const preview = state.textPreview;
  if (!preview) return false;
  return commitLayerText(preview.layerId, preview.values, message);
}

textContentInput.addEventListener("input", () => updateTextPreview({ value: textContentInput.value }));
textContentInput.addEventListener("change", () => commitTextPreview("Text content updated"));
textFontSizeInput.addEventListener("input", () => {
  const fontSize = Number(textFontSizeInput.value);
  textFontSizeValue.textContent = fontSize + " px";
  updateTextPreview({ fontSize });
});
textFontSizeInput.addEventListener("change", () => commitTextPreview("Text size updated"));
textFontFamilyInput.addEventListener("change", () => {
  updateTextPreview({ fontFamily: textFontFamilyInput.value });
  commitTextPreview("Text font updated");
});
textFontWeightInput.addEventListener("change", () => {
  updateTextPreview({ fontWeight: textFontWeightInput.value });
  commitTextPreview("Text weight updated");
});
textColorInput.addEventListener("input", () => updateTextPreview({ color: textColorInput.value }));
textColorInput.addEventListener("change", () => commitTextPreview("Text color updated"));
textAlignInput.addEventListener("change", () => {
  updateTextPreview({ align: textAlignInput.value });
  commitTextPreview("Text alignment updated");
});

function setStorageRecoveryPending(pending, message = "") {
  state.storageRecoveryPending = pending;
  state.storageRecoveryMessage = pending ? message : "";
  recoveryNotice.hidden = !pending;
  recoveryNotice.textContent = pending ? message : "";
}

function restoreStoredDocument(saved) {
  const supportedLegacyDocument = saved?.version === 1 &&
    Array.isArray(saved.layers) &&
    Array.isArray(saved.strokes);
  if (saved?.version !== undefined &&
      saved.version !== DOCUMENT_VERSION &&
      !supportedLegacyDocument) {
    return null;
  }
  return restoreDocument(saved);
}

function persistDocument({ markSaved = false } = {}) {
  if (state.storageRecoveryPending && !markSaved) {
    state.dirty = true;
    status.textContent = "Saved project is protected. Choose Save to replace it explicitly.";
    return false;
  }
  try {
    persistDocumentSnapshot(localStorage, "animeart-web-document", state.document);
  } catch (error) {
    state.dirty = true;
    status.textContent = error?.message || "Could not save project locally";
    return false;
  }
  state.dirty = !markSaved;
  if (markSaved) setStorageRecoveryPending(false);
  status.textContent = markSaved ? "Saved locally" : "Local backup updated";
  return true;
}

function refreshHistoryControls() {
  undoButton.disabled = !state.history.canUndo();
  redoButton.disabled = !state.history.canRedo();
}

function syncSelection() {
  const normalized = normalizeLayerSelection(state.selectedLayerIds, state.document);
  if (!normalized.length) {
    const fallback = state.document.layers[state.document.layers.length - 1]?.id || null;
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
  const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
  state.transformPointerId = event.pointerId;
  state.transformInteraction = {
    type,
    handle,
    pointerId: event.pointerId,
    layerId: layer.id,
    startDocument: documentPoint,
    beforeTransform: { ...layer.transform },
    previewTransform: { ...layer.transform },
    pivot: documentCenter(state.document)
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
  }
  refreshDocument("Layer transformed");
  if (next) persistDocument();
  if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
}

function updateTransformPreview(event) {
  const interaction = state.transformInteraction;
  if (!interaction || event.pointerId !== interaction.pointerId) return;
  const currentScreen = screenPointFromEvent(event);
  const currentDocument = screenToDocumentPoint(currentScreen, state.document, state.viewport, canvasSize());
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
  const selectedGeometry = selected ? selectionGeometry(selected, screenViewportForDocument(state.document, state.viewport, canvasSize()), documentCenter(state.document)) : null;
  const selectedHit = hitTestHandle(screenPoint, selectedGeometry, HANDLE_RADIUS);
  if (state.selectedLayerIds.length > 1) {
    const layers = selectedLayersExact();
    const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
    const groupDocumentGeometry = multiSelectionGeometry(layers, documentCenter(state.document));
    const groupScreenGeometry = groupDocumentGeometry ? {
      ...groupDocumentGeometry,
      corners: groupDocumentGeometry.corners.map(point => documentToScreenPoint(point, state.document, state.viewport, canvasSize())),
      center: documentToScreenPoint(groupDocumentGeometry.center, state.document, state.viewport, canvasSize())
    } : null;
    if (groupScreenGeometry) {
      const topMid = { x: (groupScreenGeometry.corners[0].x + groupScreenGeometry.corners[1].x) / 2, y: (groupScreenGeometry.corners[0].y + groupScreenGeometry.corners[1].y) / 2 };
      const outward = { x: topMid.x - groupScreenGeometry.center.x, y: topMid.y - groupScreenGeometry.center.y };
      const length = Math.hypot(outward.x, outward.y) || 1;
      groupScreenGeometry.rotationHandle = { x: topMid.x + outward.x / length * 32, y: topMid.y + outward.y / length * 32 };
      const groupHit = hitTestHandle(screenPoint, groupScreenGeometry, HANDLE_RADIUS);
      if (groupHit === "scale-nw" || groupHit === "scale-ne" || groupHit === "scale-se" || groupHit === "scale-sw") {
        if (layers.some(layer => layer.locked)) return;
        state.multiTransformInteraction = { pointerId: event.pointerId, type: "scale", handle: groupHit, startDocument: documentPoint, previewTransforms: new Map(layers.map(layer => [layer.id, { ...layer.transform }])) };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (groupHit === "rotate") {
        if (layers.some(layer => layer.locked)) return;
        state.multiTransformInteraction = { pointerId: event.pointerId, type: "rotate", startDocument: documentPoint, previewTransforms: new Map(layers.map(layer => [layer.id, { ...layer.transform }])) };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    const hitSelectedLayer = [...state.document.layers].reverse().find(layer =>
      layer.visible &&
      state.selectedLayerIds.includes(layer.id) &&
      hitTestLayer(layer, documentPoint, documentCenter(state.document))
    );
    if (hitSelectedLayer && layers.every(layer => !layer.locked)) {
      state.selectedLayerId = hitSelectedLayer.id;
      state.multiTransformInteraction = {
        pointerId: event.pointerId,
        type: "move",
        startDocument: documentPoint,
        previewDelta: { x: 0, y: 0 }
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
  if (selectedHit === "move" && state.selectedLayerIds.length === 1) {
    return beginTransformInteraction("move", event);
  }
  if (selectedHit?.startsWith("scale-")) return beginTransformInteraction("scale", event, selectedHit);
  if (selectedHit === "rotate") return beginTransformInteraction("rotate", event);
  const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
  for (const layer of [...state.document.layers].reverse()) {
    if (!layer.visible) continue;
    if (hitTestLayer(layer, documentPoint, documentCenter(state.document))) {
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
    const interaction = state.multiTransformInteraction;
    const current = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
    const layers = selectedLayersExact();
    if (interaction.type === "move") {
      const start = interaction.startDocument;
      interaction.previewDelta = { x: current.x - start.x, y: current.y - start.y };
    } else if (interaction.type === "scale") {
      const transforms = groupScaleTransforms(layers, documentCenter(state.document), interaction.handle, current);
      if (transforms) interaction.previewTransforms = new Map(transforms.map(item => [item.id, item.transform]));
    } else if (interaction.type === "rotate") {
      const transforms = groupRotationTransforms(layers, documentCenter(state.document), current, interaction.startDocument);
      if (transforms) interaction.previewTransforms = new Map(transforms.map(item => [item.id, item.transform]));
    }
    redraw();
    return;
  }
  if (state.transformInteraction && event.pointerId === state.transformPointerId) {
    updateTransformPreview(event);
    return;
  }
  if (!state.drawing || event.pointerId !== state.drawingPointerId) return;
  const layer = selectedLayer();
  const stroke = layer?.strokes[layer.strokes.length - 1];
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
    if (interaction.type === "move") {
      const delta = interaction.previewDelta || { x: 0, y: 0 };
      if (delta.x !== 0 || delta.y !== 0) applyMultiLayerMove(delta.x, delta.y);
      else redraw();
    } else {
      const transforms = [...(interaction.previewTransforms?.entries() || [])].map(([id, transform]) => ({ id, transform }));
      const changed = transforms.some(({ id, transform }) => {
        const layer = state.document.layers.find(item => item.id === id);
        return layer && JSON.stringify(layer.transform) !== JSON.stringify(transform);
      });
      if (changed) {
        const before = cloneDocument(state.document);
        const next = transformLayers(state.document, transforms);
        if (next) {
          state.document = next;
          state.history.record(before, next);
          refreshDocument(interaction.type === "scale" ? "Layers scaled" : "Layers rotated");
          persistDocument();
        }
      } else {
        redraw();
      }
    }
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
  setViewport(zoomViewportAt(state.viewport, nextZoom, screenPointFromEvent(event), state.document, canvasSize()));
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
  const layer = createLayer("Layer " + (state.document.layers.length + 1));
  const before = cloneDocument(state.document);
  const next = addLayer(state.document, layer);
  if (!next) return;
  state.document = next;
  setSelection([layer.id], layer.id);
  state.history.record(before, next);
  refreshDocument();
  persistDocument();
});

document.querySelector("#add-text-layer").addEventListener("click", () => {
  const index = state.document.layers.filter(layer => layer.contentType === "text").length + 1;
  const width = Math.max(300, state.document.width || canvas.width || 300);
  const height = Math.max(180, state.document.height || canvas.height || 180);
  const layer = createTextLayer("Text " + index, {
    value: "Your text",
    x: Math.round(width * 0.12),
    y: Math.round(height * 0.5),
    fontSize: Math.max(24, Math.min(64, Math.round(height * 0.1))),
    fontFamily: "Arial",
    fontWeight: "bold",
    color: "#172335",
    align: "left"
  });
  const before = cloneDocument(state.document);
  const next = addLayer(state.document, layer);
  if (!next) return;
  state.document = next;
  state.textPreview = null;
  setSelection([layer.id], layer.id);
  state.history.record(before, next);
  refreshDocument("Text layer added");
  persistDocument();
});

document.querySelector("#add-sample-character").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch("./assets/cc0-detailed-anime-character.png.base64");
    if (!response.ok) throw new Error("CC0 sample asset is unavailable");
    const encoded = (await response.text()).trim().replaceAll("\n", "").replaceAll("\r", "").replaceAll(" ", "");
    if (!encoded.startsWith("iVBOR")) throw new Error("CC0 sample asset is not a valid PNG payload");
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], "battleworn_knight.png", { type: "image/png" });
    await importImageIntoEditor(file, "CC0 character sample added");
  } catch (error) {
    status.textContent = error?.message || "Could not load CC0 character sample";
  } finally {
    button.disabled = false;
  }
});

async function importImageIntoEditor(file, message = "Image imported") {
  if (!file) return false;
  try {
    const result = await applyImageFileImport(file, {
      document: state.document,
      history: state.history,
      persist: next => {
        if (state.storageRecoveryPending) {
          throw new Error("Saved project is protected. Choose Save to replace it explicitly.");
        }
        return persistDocumentSnapshot(localStorage, "animeart-web-document", next);
      }
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
  if (!layer || layer.locked || layer.contentType !== "drawing" || layer.strokes.length === 0) return;
  const before = cloneDocument(state.document);
  const next = clearLayer(state.document, layer.id);
  if (!next) return;
  state.document = next;
  state.history.record(before, next);
  refreshDocument();
  persistDocument();
});

function restoreStoredProject({ confirmDiscard = true } = {}) {
  let raw;
  try {
    raw = localStorage.getItem("animeart-web-document");
  } catch {
    setStorageRecoveryPending(true, "Local project storage could not be read. Automatic saving is paused to protect existing data.");
    status.textContent = "Local project storage unavailable";
    return false;
  }
  if (!raw) {
    status.textContent = "No local project to recover";
    return false;
  }
  if (confirmDiscard && state.dirty && !window.confirm("Discard changes since the last explicit save?")) return false;
  try {
    const saved = JSON.parse(raw);
    const restored = restoreStoredDocument(saved);
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
    setStorageRecoveryPending(false);
    refreshDocument("Recovered local project");
    return true;
  } catch {
    setStorageRecoveryPending(true, "The saved project could not be opened. Its original data is preserved. Automatic saving is paused. Create a new document, then choose Save only if you want to replace the saved project.");
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

exportProjectButton.addEventListener("click", () => {
  try {
    const serialized = serializeProjectFile(state.document);
    const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "animeart-project.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Project file exported";
  } catch (error) {
    status.textContent = error?.message || "Could not export project file";
  }
});

importProjectButton.addEventListener("click", () => projectFileInput.click());

projectFileInput.addEventListener("change", async () => {
  const file = projectFileInput.files?.[0];
  if (!file) return;
  if (file.size > 2_500_000) {
    status.textContent = "Project file exceeds the 2.5 MB local-project limit";
    projectFileInput.value = "";
    return;
  }
  if (state.dirty && !window.confirm("Discard unsaved changes and open this project file?")) {
    projectFileInput.value = "";
    return;
  }
  try {
    const imported = parseProjectFile(await file.text());
    persistDocumentSnapshot(localStorage, "animeart-web-document", imported);
    state.document = imported;
    state.history.reset(imported);
    const activeLayerId = imported.layers.at(-1)?.id || null;
    setSelection(activeLayerId ? [activeLayerId] : [], activeLayerId);
    state.viewport = createViewport();
    state.transformInteraction = null;
    state.multiTransformInteraction = null;
    state.adjustmentPreview = null;
    state.textPreview = null;
    state.drawing = false;
    state.strokeBefore = null;
    state.dirty = false;
    setStorageRecoveryPending(false);
    refreshDocument("Project file opened");
  } catch (error) {
    status.textContent = error?.message || "Project file could not be opened";
  } finally {
    projectFileInput.value = "";
  }
});

saveButton.addEventListener("click", () => {
  persistDocument({ markSaved: true });
});

function syncExportFormatControls() {
  const format = exportFormatInput.value;
  const lossy = format === "jpeg" || format === "webp";
  exportQualityControl.hidden = !lossy;
  exportBackgroundControl.hidden = format !== "jpeg";
  exportPngButton.textContent = "Export " + format.toUpperCase();
  exportQualityValue.value = exportQualityInput.value + "%";
  exportQualityValue.textContent = exportQualityInput.value + "%";
}

async function exportPng() {
  const documentBefore = JSON.stringify(state.document);
  const historyBeforeUndo = state.history.canUndo();
  const historyBeforeRedo = state.history.canRedo();
  exportPngButton.disabled = true;
  const format = exportFormatInput.value;
  status.textContent = "Exporting " + format.toUpperCase() + "…";
  try {
    await ensureExportImages(state.document);
    const exportCanvas = createPngExportCanvas(state.document);
    renderDocumentToCanvas(state.document, exportCanvas, ({ context, document, center }) => {
      if (format === "jpeg") {
        context.save();
        context.fillStyle = exportBackgroundInput.value || "#ffffff";
        context.fillRect(-center.x, -center.y, document.width, document.height);
        context.restore();
      }
      drawDocument({
        context,
        document,
        center,
        transformForLayer: layer => layer.transform
      });
    });
    const quality = Number(exportQualityInput.value) / 100;
    const blob = await canvasToImageBlob(exportCanvas, format, quality);
    downloadImageBlob(blob, "animeart." + format, format);
    if (JSON.stringify(state.document) !== documentBefore ||
        state.history.canUndo() !== historyBeforeUndo ||
        state.history.canRedo() !== historyBeforeRedo) {
      throw new Error("PNG export modified editor state");
    }
    status.textContent = format.toUpperCase() + " exported";
  } catch (error) {
    status.textContent = error?.message || "PNG export failed";
  } finally {
    exportPngButton.disabled = false;
  }
}

exportPngButton.addEventListener("click", exportPng);
exportFormatInput.addEventListener("change", syncExportFormatControls);
exportQualityInput.addEventListener("input", syncExportFormatControls);
syncExportFormatControls();

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
  let raw;
  try {
    raw = localStorage.getItem("animeart-web-document");
  } catch {
    state.document = createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    setSelection([state.document.layers[0].id], state.document.layers[0].id);
    state.dirty = false;
    setStorageRecoveryPending(true, "Local project storage could not be read. Automatic saving is paused to protect existing data.");
    status.textContent = "Local project storage unavailable";
    return;
  }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    const restored = restoreStoredDocument(saved);
    if (!restored) throw new Error("Stored project is invalid");
    state.document = restored;
    state.history.reset(state.document);
    refreshHistoryControls();
    setSelection(state.document.layers.at(-1)?.id ? [state.document.layers.at(-1).id] : [], state.document.layers.at(-1)?.id || null);
    state.dirty = false;
    setStorageRecoveryPending(false);
    status.textContent = "Recovered local project";
  } catch {
    state.document = createDocument();
    state.history.reset(state.document);
    refreshHistoryControls();
    setSelection([state.document.layers[0].id], state.document.layers[0].id);
    state.dirty = false;
    setStorageRecoveryPending(true, "The saved project could not be opened. Its original data is preserved. Automatic saving is paused. Create a new document, then choose Save only if you want to replace the saved project.");
    status.textContent = "Stored project could not be recovered";
  }
}

setSelection([state.document.layers[0].id], state.document.layers[0].id);
load();
renderLayers();
refreshHistoryControls();
syncBrushControls();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);


const OFFLINE_CACHE_NAME = "animeart-web-shell-v7";
const OFFLINE_REQUIRED_RESOURCES = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./assets/cc0-detailed-anime-character.png.base64",
  "./assets/ASSET_SOURCES.md",
  "./domain/document-operations.mjs",
  "./domain/history.mjs",
  "./domain/image-import.mjs",
  "./domain/image-input.mjs",
  "./domain/image-processing.mjs",
  "./domain/canvas-space.mjs",
  "./domain/layer-adjustments.mjs",
  "./domain/model.mjs",
  "./domain/text-layer.mjs",
  "./domain/png-export.mjs",
  "./domain/selection.mjs",
  "./domain/viewport.mjs"
];

async function reportServiceWorkerReadiness() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    status.textContent = "SW UNAVAILABLE";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const requests = await cache.keys();
    const cachedUrls = new Set(requests.map(request => request.url));
    const missing = OFFLINE_REQUIRED_RESOURCES.filter(resource => !cachedUrls.has(new URL(resource, location.href).href));
    const active = Boolean(registration.active);
    const ready = active && missing.length === 0;
    status.textContent = ready
      ? `SW ACTIVE; CACHE ${OFFLINE_REQUIRED_RESOURCES.length}/${OFFLINE_REQUIRED_RESOURCES.length}; CANVAS READY`
      : `SW ${active ? "ACTIVE" : "NOT ACTIVE"}; CACHE ${OFFLINE_REQUIRED_RESOURCES.length - missing.length}/${OFFLINE_REQUIRED_RESOURCES.length}; CANVAS ${canvas ? "READY" : "MISSING"}`;
    document.documentElement.dataset.serviceWorkerActive = String(active);
    document.documentElement.dataset.cacheReady = String(missing.length === 0);
    document.documentElement.dataset.cacheMissing = missing.join("|");
    console.log("ANIMEART_OFFLINE_DIAGNOSTIC", JSON.stringify({registered:true,active,cache:OFFLINE_CACHE_NAME,cachedCount:requests.length,requiredCount:OFFLINE_REQUIRED_RESOURCES.length,missing,canvas:Boolean(canvas)}));
  } catch (error) {
    status.textContent = "SW DIAGNOSTIC FAILED";
    console.error("ANIMEART_OFFLINE_DIAGNOSTIC", error);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => reportServiceWorkerReadiness())
      .catch(() => {
        status.textContent = "SW REGISTER FAILED";
      });
  });
}
