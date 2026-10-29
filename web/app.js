import { DOCUMENT_VERSION, createId, createDocument, createImageLayer, createLayer, createStroke, createStrokePoint, createTextLayer, restoreDocument } from "./domain/model.mjs";
import { createLayerAlignmentTransforms, getLayerAlignmentBounds } from "./domain/design-alignment.mjs";
import { getSmartSnapAdjustment } from "./domain/design-snapping.mjs";
import { resizeDocumentForFormat } from "./domain/design-resize.mjs";
import { deleteDesign, duplicateDesign, listDesigns, loadDesign, renameDesign, saveDesign } from "./domain/design-library.mjs";
import { addMultiPagePage, copyLayerToPage, createMultiPageProject, deleteMultiPagePage, deleteMultiPageProject, listMultiPageProjects, loadMultiPagePage, renameMultiPagePage, renameMultiPageProject, reorderMultiPagePage, saveMultiPagePage, setActiveMultiPagePage } from "./domain/multi-page-project.mjs";
import { buildMultiPagePdf } from "./domain/pdf-export.mjs";
import { initializeAssetLibrary } from "./asset-library.js";
import { getEditingHelpPreference, initializeAppearanceSettings, setEditingHelpPreference } from "./appearance-settings.js";
import { cropImageSource, resizeImageSource } from "./domain/image-processing.mjs";
import { combineAnimeRegionSelections } from "./domain/anime-region-selection.mjs";
import { traceCropShape } from "./domain/crop-shape.mjs";
import { runImageProcessing } from "./domain/image-processing-client.mjs";
import { parseProjectFile, serializeProjectFile } from "./domain/project-file.mjs";
import { DocumentHistory, cloneDocument } from "./domain/history.mjs";
import { createViewport, panBy } from "./domain/viewport.mjs";
import { documentCenter, documentFitScale, documentToScreenPoint, screenToDocumentPoint, screenViewportForDocument, zoomViewportAt } from "./domain/canvas-space.mjs";
import { distanceBetweenTouches, midpointBetweenTouches, updatePinchPanViewport } from "./domain/touch-gestures.mjs";
import { createFrameScheduler } from "./domain/frame-scheduler.mjs";
import { appendInterpolatedStrokePoint } from "./domain/stroke-smoothing.mjs";
import { ANIME_COLOR_PRESETS, combineAnimeSelections, countAnimeSelection, generateAnimePalette, searchAnimeColors, selectAnimeRectangle, selectAnimeRegion } from "./domain/anime-color-studio.mjs";
import { mirrorFreehandPoints, traceSmoothStrokePath } from "./domain/freehand-rendering.mjs";
import { clearCanvasBackingStore } from "./domain/canvas-rendering.mjs";
import { addLayer, clearLayer, cropDocumentCanvas, deleteLayer, duplicateLayer, renameLayer, reorderLayer, rotateLayer, scaleLayer, setLayerAdjustments, setLayerLocked, setLayerOpacity, setLayerReference, setLayerText, setLayerVisibility, setLayerBackground, flipImageLayer, replaceImageLayer, setImageMask, groupLayers, transformLayers, translateLayer, translateLayers, ungroupLayers, updateLayerTransform } from "./domain/document-operations.mjs";
import { LAYER_ADJUSTMENT_PRESETS, areLayerAdjustmentsEqual, layerAdjustmentsToCanvasFilter, normalizeLayerAdjustments } from "./domain/layer-adjustments.mjs";
import { applyQuickEditRecipe, QUICK_EDIT_RECIPES } from "./domain/quick-edit-recipes.mjs";
import { GUIDED_EDITING_FLOWS, canCompleteGuidedStep, completeGuidedStep, createGuidedProgress, getGuidedFlow, getGuidedStep, goToPreviousGuidedStep, hasGuidedImage, isGuidedFlowComplete, persistGuidedEditingProgress, recordGuidedActionLaunched } from "./domain/guided-editing.mjs";

import { BUILT_IN_BACKGROUND_PROFILES, deleteBackgroundProfile, listBackgroundProfiles, saveBackgroundProfile } from "./domain/background-removal-profiles.mjs";
import { applyEraseStrokes, removeConnectedBackground } from "./domain/background-removal.mjs";
import { fitImportedImageTransform } from "./domain/image-import.mjs";
import { normalizeTextLayer, TEXT_FONT_FAMILIES } from "./domain/text-layer.mjs";
import { applyImageFileImport, optimizeImageSource, persistDocumentSnapshot, MAX_IMPORT_FILE_BYTES } from "./domain/image-import.mjs";
import { clipboardImageFile, firstValidImageFile } from "./domain/image-input.mjs";
import { clampSelectionHandles, constrainTranslationToDocument, groupRotationTransforms, groupScaleTransforms, hitTestHandle, hitTestLayer, inverseTransformPoint, layerCorners, multiSelectionGeometry, normalizeLayerSelection, resizeTransformFromCorner, selectionGeometry, toggleLayerSelection } from "./domain/selection.mjs";
import { canvasToImageBlob, createPngExportCanvas, downloadImageBlob, exportScaleForResolution, renderDocumentToCanvas } from "./domain/png-export.mjs";
import { CREATIVE_TEMPLATES, STICKER_CATALOG, WORD_ART_PRESETS, STYLE_PACKS, createStickerSvg, createPosterSvg, svgDataUrl, getCreativeTemplate, getSticker, getWordArtPreset, getStylePack } from "./domain/creative-catalog.mjs";
import { ELEMENT_CATALOG, createDesignElementSvg, getDesignElement, searchDesignElements } from "./domain/element-library.mjs";
import { ANIME_STYLE_COMPONENTS, getAnimeStyleComponent, searchAnimeStyleComponents, createAnimeStyleComponentSvg, createAnimeCharacterParts } from "./domain/anime-style-library.mjs";
import { loadAnimeCharacterSets, saveAnimeCharacterSet, deleteAnimeCharacterSet, loadAnimeColorPalettes, saveAnimeColorPalette, deleteAnimeColorPalette, loadAnimeTraitFavorites, updateAnimeTraitFavorites } from "./domain/anime-character-presets.mjs";

const canvas = document.querySelector("#canvas");
const removeSelectedImageButton = document.querySelector("#remove-selected-image");
const ctx = canvas.getContext("2d", { alpha: true });
const status = document.querySelector("#status");
const mobileFeedback = document.querySelector("#mobile-feedback");
let mobileFeedbackTimer = null;
function showMobileFeedback(message, kind = "info") {
  if (status) status.textContent = message;
  if (!mobileFeedback) return;
  mobileFeedback.textContent = message;
  mobileFeedback.dataset.kind = kind;
  mobileFeedback.hidden = false;
  if (mobileFeedbackTimer) window.clearTimeout(mobileFeedbackTimer);
  mobileFeedbackTimer = window.setTimeout(() => { mobileFeedback.hidden = true; }, kind === "error" ? 7000 : 3500);
}
function openImagePicker() {
  if (!imageFileInput) {
    showMobileFeedback("No se encontró el selector de imágenes. Recargá AnimeArt.", "error");
    return;
  }
  try {
    // Keep the picker activation on the original trusted click path used by Android WebView and E2E.
    imageFileInput.click();
  } catch {
    showMobileFeedback("Android no pudo abrir la galería. Recargá la app e intentá otra vez.", "error");
  }
}
const recoveryNotice = document.querySelector("#storage-recovery-notice");
const layersEl = document.querySelector("#layers");
const adjustmentLayerName = document.querySelector("#adjustment-layer-name");
const layerAdjustmentControls = document.querySelector("#layer-adjustment-controls");
const resetLayerAdjustmentsButton = document.querySelector("#reset-layer-adjustments");
const adjustmentPresetButtons = [...document.querySelectorAll("[data-adjustment-preset]")];
const textPanel = document.querySelector("#text-panel");
const textEditDialog = document.querySelector("#text-edit-dialog");
// .layers is hidden in the mobile workspace. Keep this modal at the document root so Android WebView can always display it.
if (textEditDialog && textEditDialog.parentElement !== document.body) document.body.append(textEditDialog);
let newlyCreatedTextLayerId = null;
const closeTextEditButton = document.querySelector("#close-text-edit");
const textContentInput = document.querySelector("#text-content");
const textFontSizeInput = document.querySelector("#text-font-size");
const textFontSizeValue = document.querySelector("#text-font-size-value");
const textFontFamilyInput = document.querySelector("#text-font-family");
const textFontWeightInput = document.querySelector("#text-font-weight");
const textColorInput = document.querySelector("#text-color");
const textOutlineColorInput = document.querySelector("#text-outline-color");
const textOutlineWidthInput = document.querySelector("#text-outline-width");
const textOutlineWidthValue = document.querySelector("#text-outline-width-value");
const textShadowColorInput = document.querySelector("#text-shadow-color");
const textShadowBlurInput = document.querySelector("#text-shadow-blur");
const textShadowBlurValue = document.querySelector("#text-shadow-blur-value");
const textShadowXInput = document.querySelector("#text-shadow-x");
const textShadowXValue = document.querySelector("#text-shadow-x-value");
const textShadowYInput = document.querySelector("#text-shadow-y");
const textShadowYValue = document.querySelector("#text-shadow-y-value");
const textStylePresetButtons = [...document.querySelectorAll("[data-text-style-preset]")];
const imageMaskPanel = document.querySelector("#image-mask-panel");
const imageMaskInput = document.querySelector("#image-mask");
const objectStyleDialog = document.querySelector("#object-style-dialog");
const shapeMakerDialog = document.querySelector("#shape-maker-dialog");
const shapeMakerPreview = document.querySelector("#shape-maker-preview");
let shapeEditingLayerId = null;
const textAlignInput = document.querySelector("#text-align");
const textLetterSpacingInput = document.querySelector("#text-letter-spacing");
const textLetterSpacingValue = document.querySelector("#text-letter-spacing-value");
const textLineHeightInput = document.querySelector("#text-line-height");
const textLineHeightValue = document.querySelector("#text-line-height-value");
const saveTextStyleButton = document.querySelector("#save-text-style");
const savedTextStylesContainer = document.querySelector("#saved-text-styles");
const SAVED_TEXT_STYLE_KEY = "kapiart-saved-text-styles-v1";
const MAX_SAVED_TEXT_STYLES = 20;
const TEXT_STYLE_FIELDS = ["fontFamily","fontWeight","fontSize","color","align","letterSpacing","lineHeight","outlineColor","outlineWidth","shadowColor","shadowBlur","shadowOffsetX","shadowOffsetY"];
const textLayerName = document.querySelector("#text-layer-name");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const mobileTopUndoButton = document.querySelector('.mobile-top-actions [data-mobile-top-action="undo"]');
const mobileTopRedoButton = document.querySelector('.mobile-top-actions [data-mobile-top-action="redo"]');
const mobileUndoButton = document.querySelector('.mobile-touch-dock [data-touch-action="undo"]');
const mobileRedoButton = document.querySelector('.mobile-touch-dock [data-touch-action="redo"]');
const imageFileInput = document.querySelector("#image-file-input");
const cropResizeButton = document.querySelector("#crop-resize-image");
const removeBackgroundButton = document.querySelector("#remove-background");
const recolorButton = document.querySelector("#recolor-image");
const recolorDialog = document.querySelector("#recolor-dialog");
const recolorCanvas = document.querySelector("#recolor-preview");
const recolorContext = recolorCanvas?.getContext("2d", { willReadFrequently: true });
let recolorSession = null;
let recolorSampleMode = false;
let recolorWandMode = false;
let recolorRegionSelectionMode = "replace";
let recolorRectangleMode = false;
let recolorRectangleStart = null;
let animeSelectionOverlay = null;
const backgroundRemovalDialog = document.querySelector("#background-removal-dialog");
const backgroundRemovalCanvas = document.querySelector("#background-removal-preview");
const backgroundRemovalContext = backgroundRemovalCanvas?.getContext("2d", { willReadFrequently: true });
let backgroundRemovalSession = null;
let backgroundRemovalSampleMode = false;
let backgroundRemovalPointerId = null;
let backgroundRemovalPan = null;
let backgroundRemovalZoom = 1;
const flipImageHorizontalButton = document.querySelector("#flip-image-horizontal");
const flipImageVerticalButton = document.querySelector("#flip-image-vertical");
const toolboxDialog = document.querySelector("#toolbox-dialog");
const cropModeDialog = document.querySelector("#crop-mode-dialog");
const canvasCropDialog = document.querySelector("#canvas-crop-dialog");
const canvasCropPreview = document.querySelector("#canvas-crop-preview");
const canvasCropStatus = document.querySelector("#canvas-crop-status");
const canvasCropBase = document.createElement("canvas");
const canvasCropContext = canvasCropPreview?.getContext("2d");
let canvasCropDocument = null;
let canvasCropRectangle = null;
let canvasCropDrag = null;
let canvasCropPreviewScale = 1;
const imageEditDialog = document.querySelector("#image-edit-dialog");
const imageEditForm = document.querySelector("#image-edit-form");
const imageEditSourceSize = document.querySelector("#image-edit-source-size");
const imageCropFields = document.querySelector("#image-crop-fields");
const imageResizeFields = document.querySelector("#image-resize-fields");
const imageCropX = document.querySelector("#image-crop-x");
const imageCropY = document.querySelector("#image-crop-y");
const imageCropWidth = document.querySelector("#image-crop-width");
const imageCropHeight = document.querySelector("#image-crop-height");
const cropPreviewCanvas = document.querySelector("#crop-preview");
const cropPreviewHint = document.querySelector("#crop-preview-hint");
const cropAspectInput = document.querySelector("#image-crop-aspect");
const cropShapeInput = document.querySelector("#image-crop-shape");
const cropPreviewOverlayCanvas = document.createElement("canvas");
const cropPreviewOverlayContext = cropPreviewOverlayCanvas.getContext("2d");
const imageResizeWidth = document.querySelector("#image-resize-width");
const imageResizeHeight = document.querySelector("#image-resize-height");
const imageResizeKeepAspect = document.querySelector("#image-resize-keep-aspect");
let imageEditLayerId = null;
let imageEditOriginalSize = null;
let imageEditOriginalFlip = { flipX: false, flipY: false };
let imageEditPreviewImage = null;
let cropPreviewDrag = null;
const newDocumentButton = document.querySelector("#new-document");
const recoverButton = document.querySelector("#recover-project");
const exportProjectButton = document.querySelector("#export-project");
const importProjectButton = document.querySelector("#import-project");
const projectFileInput = document.querySelector("#project-file-input");
const saveButton = document.querySelector("#save");
const exportPngButton = document.querySelector("#export-png");
const exportFormatInput = document.querySelector("#export-format");
const exportResolutionInput = document.querySelector("#export-resolution");
const mobileExportResolutionInput = document.querySelector("#mobile-export-resolution");
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
const HANDLE_RADIUS = 22;
const imageCache = new Map();
const drawingLayerRasterCache = new WeakMap();

const BRUSH_DEFAULTS = Object.freeze({ color: "#111318", size: 5, opacity: 1, hardness: 100, effect: "normal", symmetry: false });
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 100;

const ADJUSTMENT_CONTROL_DEFS = Object.freeze([
  { key: "brightness", label: "Brightness", min: 0, max: 200, step: 1 },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1 },
  { key: "saturation", label: "Saturation", min: 0, max: 200, step: 1 },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1 },
  { key: "temperature", label: "Warm / Cool", min: -100, max: 100, step: 1 },
  { key: "tint", label: "Color Cast", min: -100, max: 100, step: 1 },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.1 }
]);

const activeTouchPointers = new Map();
let touchGesture = null;

let frameBoundaryMode = "free";

const state = {
  tool: "select",
  interactionMode: "simple",
  brush: { ...BRUSH_DEFAULTS },
  censorCursorPoint: null,
  drawing: false,
  panning: false,
  selectedLayerId: null,
  selectedLayerIds: [],
  panPointerId: null,
  drawingPointerId: null,
  transformPointerId: null,
  lastPanPoint: null,
  strokeBefore: null,
  activeMirrorStroke: null,
  imageEraseInteraction: null,
  imageRestoreInteraction: null,
  pixelEditProcessingPreview: null,
  magicEraseInteraction: null,
  transformInteraction: null,
  multiTransformInteraction: null,
  snapGuides: [],
  magneticSnappingEnabled: true,
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
let activeMultiPageSession = null;
let multiPagePersistenceQueue = Promise.resolve();

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
  const base = normalizeLayerSelection(layerIds, state.document);
  const groupIds = new Set(state.document.layers
    .filter(layer => base.includes(layer.id) && layer.groupId)
    .map(layer => layer.groupId));
  const expanded = groupIds.size
    ? [...base, ...state.document.layers.filter(layer => groupIds.has(layer.groupId)).map(layer => layer.id)]
    : base;
  const normalized = normalizeLayerSelection(expanded, state.document);
  state.selectedLayerIds = normalized;
  state.selectedLayerId = anchorId && normalized.includes(anchorId)
    ? anchorId
    : normalized[normalized.length - 1] || null;
  updateSelectionIndicator();
}

function updateSelectionMiniPanel(layer = selectedLayerExact()) {
  const panel = document.querySelector("#selection-mini-panel");
  if (!panel) return;
  const hasEditableContent = Boolean(layer && (
    (layer.contentType === "image" && layer.image) ||
    (layer.contentType === "text" && layer.text) ||
    (Array.isArray(layer.strokes) && layer.strokes.some(stroke => Array.isArray(stroke.points) && stroke.points.length > 0))
  ));
  panel.hidden = !hasEditableContent;
  const editText = document.querySelector("#selection-mini-edit-text");
  const selectedText = layer?.contentType === "text";
  if (editText) {
    editText.hidden = !selectedText;
    editText.disabled = !selectedText || Boolean(layer?.locked);
    editText.title = layer?.locked ? "Desbloqueá la capa para editar el texto" : "Abrir el editor de texto y tipografía";
  }
  // On mobile the contextual canvas strip is intentionally hidden. Reuse the
  // always-visible bottom-dock action and make its purpose explicit for a text selection.
  const mobileTextAction = document.querySelector('.mobile-touch-dock [data-touch-action="add-text"]');
  if (mobileTextAction) {
    const label = mobileTextAction.querySelector("span:last-child");
    mobileTextAction.setAttribute("aria-label", selectedText ? "Editar texto seleccionado" : "Añadir título o texto");
    mobileTextAction.title = selectedText ? "Editar el texto seleccionado" : "Añadir un título o texto";
    if (label) label.textContent = selectedText ? "Editar texto" : "Texto";
  }
  if (!hasEditableContent) return;

  const name = document.querySelector("#selection-mini-layer-name");
  if (name) name.textContent = layer.name + (layer.locked ? " · bloqueada" : "");

  const lock = document.querySelector("#selection-mini-lock");
  if (lock) {
    lock.textContent = layer.locked ? "🔓 Desbloquear" : "🔒 Bloquear";
    lock.setAttribute("aria-pressed", String(layer.locked));
    lock.title = layer.locked ? "Desbloquear capa" : "Bloquear capa para no moverla por accidente";
  }

  const index = state.document.layers.findIndex(item => item.id === layer.id);
  const back = document.querySelector("#selection-mini-back");
  const front = document.querySelector("#selection-mini-front");
  if (back) back.disabled = layer.locked || index <= 0;
  if (front) front.disabled = layer.locked || index < 0 || index >= state.document.layers.length - 1;

  const fit = document.querySelector("#selection-mini-fit");
  if (fit) fit.disabled = layer.locked || layer.contentType !== "image" || !layer.image;
  const background = document.querySelector("#selection-mini-background");
  if (background) {
    background.disabled = !(layer.contentType === "image" && layer.image) || (layer.locked && !layer.isBackground);
    background.setAttribute("aria-pressed", String(Boolean(layer.isBackground)));
    background.textContent = layer.isBackground ? "↩ Desfijar fondo" : "🖼️ Como fondo";
    background.title = layer.isBackground ? "Volver a tratar la imagen como una capa normal" : "Fijar esta imagen al fondo del lienzo";
  }
  const remove = document.querySelector("#selection-mini-delete");
  if (remove) remove.disabled = Boolean(layer.locked);
  const mobileRemove = document.querySelector('.mobile-touch-dock [data-touch-action="delete-selected"]');
  if (mobileRemove) mobileRemove.disabled = Boolean(layer.locked);
  const textRemove = document.querySelector("#delete-text-layer");
  if (textRemove) textRemove.disabled = layer.contentType !== "text" || Boolean(layer.locked);
  const textApply = document.querySelector("#apply-text-layer");
  if (textApply) textApply.disabled = layer.contentType !== "text" || Boolean(layer.locked);
}

function updateSelectionIndicator() {
  const layer = selectedLayerExact();
  const groupButton = document.querySelector("#layer-group-selection");
  const ungroupButton = document.querySelector("#layer-ungroup-selection");
  const selected = selectedLayersExact();
  if (groupButton) {
    groupButton.disabled = selected.length < 2 || selected.some(item => item.locked || item.isBackground);
    groupButton.title = groupButton.disabled
      ? "Seleccioná al menos dos capas desbloqueadas para agrupar"
      : "Agrupar las capas seleccionadas y moverlas como una unidad";
  }
  if (ungroupButton) {
    ungroupButton.disabled = !selected.some(item => item.groupId);
    ungroupButton.title = ungroupButton.disabled
      ? "Seleccioná una capa que pertenezca a un grupo"
      : "Separar el grupo; cada capa conservará su contenido y posición";
  }
  updateSelectionMiniPanel(layer);
  const indicator = document.querySelector("#selection-indicator");
  if (!indicator) return;
  if (!layer) {
    indicator.dataset.kind = "none";
    indicator.textContent = "🖼️ Seleccioná una imagen para editar";
    indicator.title = "Tocá una imagen o elegí una capa en el panel Capas.";
  } else if (layer.contentType === "image") {
    indicator.dataset.kind = "image";
    indicator.textContent = "🖼️ Imagen seleccionada: " + layer.name;
    indicator.title = "Imagen seleccionada. Podés moverla, transformarla o quitarle el fondo.";
  } else {
    indicator.dataset.kind = "layer";
    indicator.textContent = "🗂️ Capa seleccionada: " + layer.name + " (no es una imagen)";
    indicator.title = "Seleccioná una capa de imagen para quitar el fondo. El borrador actúa sobre la capa activa.";
  }
}

function updateRemoveImageControl() {
  const layer = selectedLayerExact();
  const effectEraserButton = document.querySelector("#erase-color-effect");
  const isColorEffect = Boolean(layer && layer.contentType === "image" && layer.image && String(layer.name || "").startsWith("Efecto de color · "));
  if (effectEraserButton) {
    effectEraserButton.disabled = !isColorEffect || Boolean(layer?.locked);
    effectEraserButton.title = isColorEffect ? "Selecciona el borrador y arrastra sobre esta capa para revelar el dibujo original" : "Selecciona una capa «Efecto de color» para borrar solo ese efecto";
  }
  if (!removeSelectedImageButton) return;
  const validImage = Boolean(layer && layer.contentType === "image" && layer.image);
  removeSelectedImageButton.hidden = !validImage || document.querySelector("#view-transparency")?.getAttribute("aria-pressed") === "true";
  removeSelectedImageButton.disabled = !validImage || Boolean(layer?.locked);
  removeSelectedImageButton.setAttribute("aria-label", validImage ? "Quitar imagen seleccionada: " + layer.name : "Quitar imagen");
  removeSelectedImageButton.title = layer?.locked ? "Desbloqueá la imagen para quitarla" : "Quitar solo esta imagen. Podés deshacer.";
  if (validImage) {
    const geometry = selectionGeometry(layer, screenViewportForDocument(state.document, state.viewport, canvasSize()), documentCenter(state.document));
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = document.querySelector(".canvas-wrap").getBoundingClientRect();
    if (geometry) {
      const right = Math.max(...geometry.corners.map(point => point.x));
      const left = Math.min(...geometry.corners.map(point => point.x));
      const top = Math.min(...geometry.corners.map(point => point.y));
      const buttonSize = window.matchMedia("(max-width: 620px)").matches ? 50 : 46;
      const safeGap = 28;
      const canvasOffsetX = canvasRect.left - wrapRect.left;
      const canvasOffsetY = canvasRect.top - wrapRect.top;
      const rightPosition = canvasOffsetX + right + safeGap;
      const leftPosition = canvasOffsetX + left - buttonSize - safeGap;
      const enoughRight = rightPosition + buttonSize <= wrapRect.width - 4;
      const enoughLeft = leftPosition >= 4;
      if (enoughRight) {
        removeSelectedImageButton.style.left = rightPosition + "px";
      } else if (enoughLeft) {
        removeSelectedImageButton.style.left = leftPosition + "px";
      } else {
        // Never cover a transform handle. The layer list still provides deletion.
        removeSelectedImageButton.hidden = true;
        return;
      }
      const y = canvasOffsetY + top - Math.round(buttonSize / 2);
      removeSelectedImageButton.style.top = Math.max(4, Math.min(wrapRect.height - buttonSize - 4, y)) + "px";
    } else {
      removeSelectedImageButton.hidden = true;
    }
  }
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

function canvasRenderDpr(rect) {
  const deviceDpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  const mobile = window.matchMedia("(max-width: 920px)").matches;
  const deviceCap = mobile ? 2 : 2.5;
  const pixelBudget = mobile ? 2_000_000 : 4_000_000;
  const cssPixels = Math.max(1, rect.width * rect.height);
  return Math.max(1, Math.min(deviceDpr, deviceCap, Math.sqrt(pixelBudget / cssPixels)));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvasRenderDpr(rect);
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

function traceImageMask(context,width,height,mask){context.beginPath();if(mask==="circle")context.ellipse(width/2,height/2,width/2,height/2,0,0,Math.PI*2);else if(mask==="rounded"){const r=Math.min(width,height)*.12;if(typeof context.roundRect==="function")context.roundRect(0,0,width,height,r);else context.rect(0,0,width,height);}else if(mask==="star"){const cx=width/2,cy=height/2,o=Math.min(width,height)/2,inn=o*.43;for(let i=0;i<10;i++){const r=i%2===0?o:inn,a=-Math.PI/2+i*Math.PI/5,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;if(i===0)context.moveTo(x,y);else context.lineTo(x,y);}context.closePath();}else if(mask==="heart"){context.moveTo(width/2,height*.92);context.bezierCurveTo(width*.42,height*.78,width*.02,height*.52,width*.08,height*.28);context.bezierCurveTo(width*.13,height*.03,width*.39,height*.02,width/2,height*.23);context.bezierCurveTo(width*.61,height*.02,width*.87,height*.03,width*.92,height*.28);context.bezierCurveTo(width*.98,height*.52,width*.58,height*.78,width/2,height*.92);context.closePath();}else if(mask==="hexagon"){for(let i=0;i<6;i++){const a=-Math.PI/3+i*Math.PI/3,x=width/2+Math.cos(a)*width/2,y=height/2+Math.sin(a)*height/2;if(i===0)context.moveTo(x,y);else context.lineTo(x,y);}context.closePath();}else context.rect(0,0,width,height);}
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
    context.save();
    const mask=layer.image.mask||"none";if(mask!=="none"){traceImageMask(context,layer.image.width,layer.image.height,mask);context.clip();}
    if (layer.image.flipX) {
      context.translate(layer.image.width, 0);
      context.scale(-1, 1);
    }
    if (layer.image.flipY) {
      context.translate(0, layer.image.height);
      context.scale(1, -1);
    }
    context.drawImage(image, 0, 0, layer.image.width, layer.image.height);
    context.restore();
  }
}


function drawStrokeCollection(context, strokes, baseOpacity = 1) {
  for (const stroke of strokes || []) {
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) continue;
    const erasing = stroke.tool === "eraser";
    const censorLight = stroke.tool === "censor-light";
    const effect = erasing ? "normal" : (stroke.effect || "normal");
    context.save();
    context.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    context.globalAlpha = baseOpacity * (Number.isFinite(Number(stroke.opacity)) ? Math.max(0, Math.min(1, Number(stroke.opacity))) : 1);
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = erasing ? "#000000" : stroke.color;
    context.shadowColor = erasing || (effect === "normal" && !censorLight) ? "transparent" : stroke.color;
    context.shadowBlur = censorLight
      ? stroke.size * Math.max(Math.min(100, Math.max(0, Number(stroke.glow ?? 0))), 100 - Math.min(100, Math.max(0, Number(stroke.hardness ?? 100)))) / 100 * 1.2
      : effect === "neon" ? stroke.size * 1.8
        : effect === "glow" ? stroke.size * 1.2
          : effect === "soft" ? stroke.size * 0.7
            : stroke.size * (1 - Math.min(100, Math.max(0, Number(stroke.hardness ?? 100))) / 100) * 0.45;
    if (stroke.points.length === 1 && censorLight) {
      context.beginPath();
      context.arc(stroke.points[0].x, stroke.points[0].y, Math.max(0.5, stroke.size / 2), 0, Math.PI * 2);
      context.fillStyle = stroke.color;
      context.fill();
    } else if (traceSmoothStrokePath(context, stroke.points)) {
      // Midpoint-based quadratic segments smooth the path while retaining the
      // exact first and last input points. A one-point stroke becomes a round dot.
      context.stroke();
    }
    if (effect === "neon" && !erasing) {
      context.shadowBlur = 0;
      context.strokeStyle = "#ffffff";
      context.lineWidth = Math.max(1, stroke.size * 0.32);
      context.globalAlpha = baseOpacity * Math.max(0, Math.min(1, Number(stroke.opacity) || 0));
      context.globalCompositeOperation = "source-over";
      context.stroke();
    }
    context.restore();
  }
}

function drawDrawingLayer(layer, context, documentModel) {
  const hasEraser = (layer.strokes || []).some(stroke => stroke.tool === "eraser");
  if (!hasEraser) {
    drawStrokeCollection(context, layer.strokes, layer.opacity);
    return;
  }
  const width = Math.max(1, Math.ceil(Number(documentModel.width) || 512));
  const height = Math.max(1, Math.ceil(Number(documentModel.height) || 512));
  const editingThisLayer = state.drawing && layer.id === state.selectedLayerId;
  let raster = editingThisLayer ? null : drawingLayerRasterCache.get(layer);
  if (raster && (raster.width !== width || raster.height !== height)) raster = null;
  if (editingThisLayer) drawingLayerRasterCache.delete(layer);
  if (!raster) {
    raster = document.createElement("canvas");
    raster.width = width;
    raster.height = height;
    const rasterContext = raster.getContext("2d");
    if (!rasterContext) return;
    drawStrokeCollection(rasterContext, layer.strokes, 1);
    if (!editingThisLayer) drawingLayerRasterCache.set(layer, raster);
  }
  context.drawImage(raster, 0, 0, width, height);
}

function drawTextWithLetterSpacing(context, text, x, y, letterSpacing, outline = false) {
 const paint = outline ? context.strokeText.bind(context) : context.fillText.bind(context);
 const spacing = Number(letterSpacing) || 0;
 if (Math.abs(spacing) < 0.001 || Array.from(text).length < 2) { paint(text, x, y); return; }
 if ("letterSpacing" in context && typeof context.letterSpacing === "string") {
  const previous = context.letterSpacing;
  let renderedNatively = false;
  try {
   context.letterSpacing = spacing + "px";
   if (context.letterSpacing === spacing + "px") { paint(text, x, y); renderedNatively = true; }
  } catch { /* Some WebViews expose the property without a writable implementation. */ }
  finally { try { context.letterSpacing = previous; } catch {} }
  if (renderedNatively) return;
 }
 const segments = typeof Intl.Segmenter === "function"
  ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(part => part.segment)
  : Array.from(text);
 const totalWidth = context.measureText(text).width + Math.max(0, segments.length - 1) * spacing;
 const originalAlign = context.textAlign;
 let cursor = originalAlign === "center" ? x - totalWidth / 2 : originalAlign === "right" ? x - totalWidth : x;
 context.textAlign = "left";
 try { for (const segment of segments) { paint(segment, cursor, y); cursor += context.measureText(segment).width + spacing; } }
 finally { context.textAlign = originalAlign; }
}
function drawDocument({ context = ctx, document = state.document, center = documentCenter(document), transformForLayer = layerTransformForRender, allowOffDocumentPreview = false, includeLivePreviews = true } = {}) {
  const layersInRenderOrder = [...document.layers].sort((a, b) => Number(Boolean(b.isBackground)) - Number(Boolean(a.isBackground)));
  for (const layer of layersInRenderOrder) {
    if (!layer.visible) continue;
    const transform = transformForLayer(layer);
    context.save();
    // The editable workspace may reveal image/text pixels beyond the document in Libre mode.
    // Backgrounds and paint layers stay inside the page; export/crop renderers use the safe default.
    const allowOutsideDocument = allowOffDocumentPreview &&
      frameBoundaryMode === "free" &&
      !layer.isBackground &&
      (layer.contentType === "image" || layer.contentType === "text");
    if (!allowOutsideDocument) {
      context.beginPath();
      context.rect(0, 0, Number(document.width) || 0, Number(document.height) || 0);
      context.clip();
    }
    const previewAdjustments = includeLivePreviews && state.adjustmentPreview?.layerId === layer.id
      ? state.adjustmentPreview.values
      : layer.adjustments;
    const previewText = includeLivePreviews && state.textPreview?.layerId === layer.id
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
      const lineHeight = previewText.fontSize * (previewText.lineHeight || 1.2);
      context.shadowColor = previewText.shadowBlur > 0 ? previewText.shadowColor : "transparent";
      context.shadowBlur = previewText.shadowBlur;
      context.shadowOffsetX = previewText.shadowOffsetX;
      context.shadowOffsetY = previewText.shadowOffsetY;
      previewText.value.split("\n").forEach((line, index) => {
        const x = previewText.x;
        const y = previewText.y + index * lineHeight;
        if (previewText.outlineWidth > 0) {
          context.strokeStyle = previewText.outlineColor;
          context.lineWidth = previewText.outlineWidth;
          context.lineJoin = "round";
          drawTextWithLetterSpacing(context, line, x, y, previewText.letterSpacing, true);
        }
        drawTextWithLetterSpacing(context, line, x, y, previewText.letterSpacing, false);
      });
    } else {
      drawDrawingLayer(layer, context, document);
    }
    context.restore();
  }
}

function selectionHandleInset() {
  return window.matchMedia("(max-width: 920px)").matches ? 22 : 21;
}

function drawObjectSelectionHandle(point, kind) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const radius = window.matchMedia("(max-width: 920px)").matches ? 20 : 19;
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = kind === "close" ? "#e74f78" : kind === "rotate" ? "#168da6" : kind === "move" ? "#0aa6a6" : "#7058f5";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "close") {
    ctx.moveTo(point.x - 5.5, point.y - 5.5); ctx.lineTo(point.x + 5.5, point.y + 5.5);
    ctx.moveTo(point.x + 5.5, point.y - 5.5); ctx.lineTo(point.x - 5.5, point.y + 5.5);
  } else if (kind === "rotate") {
    ctx.arc(point.x, point.y, 6.5, -Math.PI * 0.15, Math.PI * 1.45, false);
    ctx.moveTo(point.x + 5, point.y - 6); ctx.lineTo(point.x + 7, point.y + 0.5); ctx.lineTo(point.x + 0.5, point.y - 1);
  } else if (kind === "move") {
    ctx.moveTo(point.x - 8, point.y); ctx.lineTo(point.x + 8, point.y);
    ctx.moveTo(point.x, point.y - 8); ctx.lineTo(point.x, point.y + 8);
    ctx.moveTo(point.x - 8, point.y); ctx.lineTo(point.x - 3, point.y - 3);
    ctx.moveTo(point.x - 8, point.y); ctx.lineTo(point.x - 3, point.y + 3);
    ctx.moveTo(point.x + 8, point.y); ctx.lineTo(point.x + 3, point.y - 3);
    ctx.moveTo(point.x + 8, point.y); ctx.lineTo(point.x + 3, point.y + 3);
    ctx.moveTo(point.x, point.y - 8); ctx.lineTo(point.x - 3, point.y - 3);
    ctx.moveTo(point.x, point.y - 8); ctx.lineTo(point.x + 3, point.y - 3);
    ctx.moveTo(point.x, point.y + 8); ctx.lineTo(point.x - 3, point.y + 3);
    ctx.moveTo(point.x, point.y + 8); ctx.lineTo(point.x + 3, point.y + 3);
  } else {
    ctx.moveTo(point.x - 6, point.y - 6); ctx.lineTo(point.x + 6, point.y + 6);
    ctx.moveTo(point.x - 6, point.y - 6); ctx.lineTo(point.x - 6, point.y - 1);
    ctx.moveTo(point.x - 6, point.y - 6); ctx.lineTo(point.x - 1, point.y - 6);
    ctx.moveTo(point.x + 6, point.y + 6); ctx.lineTo(point.x + 6, point.y + 1);
    ctx.moveTo(point.x + 6, point.y + 6); ctx.lineTo(point.x + 1, point.y + 6);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSelectionOverlay() {
  if (window.__ANIMEART_E2E_DIAGNOSTICS__) window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__ = null;
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
        center: documentToScreenPoint(geometry.center, state.document, state.viewport, viewportSize),
        closeHandle: corners[1],
        resizeHandle: corners[2]
      };
      const visibleGroupHandles = clampSelectionHandles(groupGeometry, viewportSize, selectionHandleInset());
      if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
        window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__ = {
          closeHandle: visibleGroupHandles.closeHandle,
          resizeHandle: visibleGroupHandles.resizeHandle,
          canvasSize: viewportSize,
          kind: "group"
        };
      }
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#00eaff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      drawObjectSelectionHandle(visibleGroupHandles.closeHandle, "close");
      drawObjectSelectionHandle(visibleGroupHandles.resizeHandle, "resize");
      drawObjectSelectionHandle(visibleGroupHandles.moveHandle, "move");
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
    ctx.strokeStyle = layer.id === state.selectedLayerId ? "#00eaff" : "#a66bff";
    ctx.beginPath();
    geometry.corners.forEach((corner, index) => index === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y));
    ctx.closePath();
    ctx.stroke();
    if (selectedLayers.length > 1 || layer.id !== state.selectedLayerId) {
      ctx.restore();
      continue;
    }
    ctx.setLineDash([]);
    const visibleHandles = clampSelectionHandles(geometry, canvasSize(), selectionHandleInset());
    if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
      window.__ANIMEART_SELECTION_HANDLE_DIAGNOSTICS__ = {
        closeHandle: visibleHandles.closeHandle,
        resizeHandle: visibleHandles.resizeHandle,
        moveHandle: visibleHandles.moveHandle,
        rotationHandle: geometry.rotationHandle,
        center: geometry.center,
        canvasSize: canvasSize(),
        kind: "layer"
      };
    }
    const rotationHandle = geometry.rotationHandle;
    const topMid = { x: (geometry.corners[0].x + geometry.corners[1].x) / 2, y: (geometry.corners[0].y + geometry.corners[1].y) / 2 };
    ctx.beginPath();
    ctx.moveTo(topMid.x, topMid.y);
    ctx.lineTo(rotationHandle.x, rotationHandle.y);
    ctx.strokeStyle = "#8bdcf0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawObjectSelectionHandle(visibleHandles.closeHandle, "close");
    drawObjectSelectionHandle(visibleHandles.resizeHandle, "resize");
    drawObjectSelectionHandle(visibleHandles.moveHandle, "move");
    drawObjectSelectionHandle(rotationHandle, "rotate");
    ctx.restore();
  }
}
const redrawScheduler = createFrameScheduler(callback => window.requestAnimationFrame(callback), frameId => window.cancelAnimationFrame(frameId));

function redraw() {
  redrawScheduler.schedule(drawNow);
}

function drawPixelEditPreview() {
  const active = state.imageEraseInteraction
    ? { ...state.imageEraseInteraction, mode: "erase" }
    : state.imageRestoreInteraction
      ? { ...state.imageRestoreInteraction, mode: "restore" }
      : null;
  const preview = active || state.pixelEditProcessingPreview;
  const points = preview?.previewPoints;
  if (!Array.isArray(points) || points.length === 0) {
    if (window.__ANIMEART_E2E_DIAGNOSTICS__) window.__ANIMEART_PIXEL_EDIT_PREVIEW_DIAGNOSTICS__ = null;
    return;
  }
  const zoom = Math.max(0.25, Number(preview.zoom) || state.viewport.zoom || 1);
  const width = Math.max(8, Math.min(96, (Number(preview.brushSize) || state.brush.size) * zoom));
  const color = preview.mode === "restore" ? "rgba(0, 229, 255, 0.92)" : "rgba(255, 79, 216, 0.92)";
  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const trace = () => {
    ctx.beginPath();
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = width + 5;
  trace();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  trace();
  if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
    window.__ANIMEART_PIXEL_EDIT_PREVIEW_DIAGNOSTICS__ = { mode: preview.mode, pointCount: points.length, width, color };
  }
  ctx.restore();
}

function drawOffDocumentVeil(rect, dpr) {
  if (frameBoundaryMode !== "free") return;
  const viewportSize = canvasSize();
  const corners = [
    documentToScreenPoint({ x: 0, y: 0 }, state.document, state.viewport, viewportSize),
    documentToScreenPoint({ x: state.document.width, y: 0 }, state.document, state.viewport, viewportSize),
    documentToScreenPoint({ x: state.document.width, y: state.document.height }, state.document, state.viewport, viewportSize),
    documentToScreenPoint({ x: 0, y: state.document.height }, state.document, state.viewport, viewportSize)
  ];
  if (!corners.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return;
  // Off-document pixels stay movable in Free mode, but the frame clearly shows
  // which pixels belong to the exported document.
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  ctx.rect(0, 0, rect.width, rect.height);
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const point of corners.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = "rgba(7, 7, 16, 0.14)";
  ctx.fill("evenodd");
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const point of corners.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 79, 216, 0.62)";
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(255, 79, 216, 0.18)";
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.restore();
  if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
    window.__ANIMEART_OFF_DOCUMENT_VEIL_DIAGNOSTICS__ = { enabled: true, cornerCount: corners.length, corners, devicePixelRatio: dpr };
  }
}

function drawSmartSnapGuides() {
  if (!Array.isArray(state.snapGuides) || state.snapGuides.length === 0) return;
  const width = state.document.width, height = state.document.height;
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 91, 210, 0.95)";
  for (const guide of state.snapGuides) {
    const start = guide.axis === "vertical"
      ? documentToScreenPoint({ x: guide.coordinate, y: 0 }, state.document, state.viewport, canvasSize())
      : documentToScreenPoint({ x: 0, y: guide.coordinate }, state.document, state.viewport, canvasSize());
    const end = guide.axis === "vertical"
      ? documentToScreenPoint({ x: guide.coordinate, y: height }, state.document, state.viewport, canvasSize())
      : documentToScreenPoint({ x: width, y: guide.coordinate }, state.document, state.viewport, canvasSize());
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
  }
  ctx.restore();
}

function drawNow() {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvasRenderDpr(rect);
  clearCanvasBackingStore(ctx, canvas, dpr);
  ctx.save();
  applyViewport();
  if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
    const frameSize = canvasSize();
    window.__ANIMEART_DOCUMENT_FRAME_DIAGNOSTICS__ = {
      topLeft: documentToScreenPoint({ x: 0, y: 0 }, state.document, state.viewport, frameSize),
      topRight: documentToScreenPoint({ x: state.document.width, y: 0 }, state.document, state.viewport, frameSize),
      bottomLeft: documentToScreenPoint({ x: 0, y: state.document.height }, state.document, state.viewport, frameSize),
      bottomRight: documentToScreenPoint({ x: state.document.width, y: state.document.height }, state.document, state.viewport, frameSize),
      width: state.document.width,
      height: state.document.height
    };
  }
  drawDocument({
    context: ctx,
    document: state.document,
    center: documentCenter(state.document),
    allowOffDocumentPreview: frameBoundaryMode === "free"
  });
  ctx.restore();
  drawOffDocumentVeil(rect, dpr);
  if (!transparencyPreview) drawSelectionOverlay();
  drawPixelEditPreview();
  drawSmartSnapGuides();
  updateRemoveImageControl();
  if (!transparencyPreview && ["censor-light", "brush", "eraser"].includes(state.tool) && state.censorCursorPoint) {
    const point = documentToScreenPoint(state.censorCursorPoint, state.document, state.viewport, canvasSize());
    const brushSize = state.tool === "censor-light"
      ? Number(document.querySelector("#censor-light-size").value)
      : Number(state.brush.size);
    const radius = brushSize * state.viewport.zoom / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2, radius), 0, Math.PI * 2);
    ctx.strokeStyle = "#111318"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2, radius), 0, Math.PI * 2);
    ctx.strokeStyle = state.tool === "eraser" ? "#ff8a9a" : "#ffffff"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
  // createStrokePoint accepts numeric x/y arguments, not a point object. Passing
  // the object as the first argument silently normalized every freehand sample to (0, 0).
  return createStrokePoint(documentPoint.x, documentPoint.y);
}

function screenPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// Densify fast pointer samples in document coordinates and discard movement
// smaller than a fraction of a screen pixel. Coalesced samples preserve hardware
// input; interpolation fills gaps and quadratic rendering smooths the visible path.
function appendSmoothStrokeSamples(stroke, events) {
  if (!stroke || !Array.isArray(stroke.points) || !Array.isArray(events)) return;
  const spacing = Math.max(0.75, Math.min(3, (Number(stroke.size) || 5) * 0.3));
  const screenScale = Math.max(Number.EPSILON, documentFitScale(state.document, canvasSize()) * state.viewport.zoom);
  for (const event of events) {
    const point = pointFromEvent(event);
    const previous = stroke.points[stroke.points.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) * screenScale < 0.15) continue;
    appendInterpolatedStrokePoint(stroke.points, point, createStrokePoint, spacing);
  }
}

function syncActiveMirrorStroke(sourceStroke) {
  if (!sourceStroke || !state.activeMirrorStroke) return false;
  const mirroredPoints = mirrorFreehandPoints(sourceStroke.points, state.document.width);
  if (!mirroredPoints) return false;
  state.activeMirrorStroke.points = mirroredPoints;
  return true;
}

function createLayerThumbnail(layer) {
  const thumbnail = document.createElement("span");
  thumbnail.className = "layer-thumbnail";
  thumbnail.setAttribute("aria-hidden", "true");
  if (layer.contentType === "image" && layer.image?.source) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = layer.image.source;
    thumbnail.appendChild(image);
  } else if (layer.contentType === "text") {
    thumbnail.classList.add("layer-thumbnail-text");
    thumbnail.textContent = "Tt";
  } else {
    const preview = document.createElement("canvas");
    preview.width = 52;
    preview.height = 36;
    const previewContext = preview.getContext("2d");
    const width = Math.max(1, Number(state.document.width) || 512);
    const height = Math.max(1, Number(state.document.height) || 512);
    if (previewContext) {
      const scale = Math.min(preview.width / width, preview.height / height);
      previewContext.translate((preview.width - width * scale) / 2, (preview.height - height * scale) / 2);
      previewContext.scale(scale, scale);
      for (const stroke of layer.strokes || []) {
        if (stroke.points.length < 2) continue;
        previewContext.beginPath();
        previewContext.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) previewContext.lineTo(point.x, point.y);
        previewContext.lineWidth = Math.max(1 / scale, stroke.size);
        previewContext.lineCap = "round";
        previewContext.lineJoin = "round";
        previewContext.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
        previewContext.strokeStyle = stroke.tool === "eraser" ? "#000000" : stroke.color;
        previewContext.globalAlpha = stroke.opacity ?? 1;
        previewContext.stroke();
      }
    }
    thumbnail.appendChild(preview);
  }
  return thumbnail;
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
    const layerName = document.createElement("span");
    layerName.className = "layer-name";
    layerName.textContent = layer.name + (layer.groupId ? " [Grupo]" : "") + (layer.isBackground ? " [Fondo fijo]" : layer.contentType === "image" ? (layer.isReference ? " [Referencia]" : " [Imagen]") : layer.contentType === "text" ? " [Texto]" : "");
    selectButton.append(createLayerThumbnail(layer), layerName);
    selectButton.setAttribute("aria-label", "Seleccionar capa " + layer.name);
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
    visibilityButton.title = layer.visible ? "Ocultar capa" : "Mostrar capa";
    visibilityButton.setAttribute("aria-label", visibilityButton.title);
    visibilityButton.addEventListener("click", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerVisibility(doc, id, !layer.visible), layer.visible ? "Capa ocultada" : "Capa visible");
    });

    const lockButton = document.createElement("button");
    lockButton.type = "button";
    lockButton.className = "layer-toggle";
    lockButton.textContent = layer.locked ? "🔒" : "🔓";
    lockButton.title = layer.locked ? "Desbloquear capa" : "Bloquear capa";
    lockButton.setAttribute("aria-label", lockButton.title);
    lockButton.addEventListener("click", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerLocked(doc, id, !layer.locked), layer.locked ? "Capa desbloqueada" : "Capa bloqueada", { allowLocked: true });
    });

    const opacity = document.createElement("input");
    opacity.type = "range"; opacity.min = "0"; opacity.max = "1"; opacity.step = "0.01";
    opacity.value = String(layer.opacity); opacity.className = "layer-opacity"; opacity.title = "Opacidad de la capa";
    opacity.setAttribute("aria-label", "Opacidad de la capa " + layer.name);
    opacity.addEventListener("click", event => event.stopPropagation());
    opacity.addEventListener("change", event => {
      event.stopPropagation();
      applyLayerOperation((doc, id) => setLayerOpacity(doc, id, Number(event.currentTarget.value)), "Opacidad de capa actualizada");
    });

    const renameButton = document.createElement("button");
    renameButton.type = "button"; renameButton.className = "layer-action"; renameButton.textContent = "Renombrar"; renameButton.title = "Renombrar capa"; renameButton.setAttribute("aria-label", "Renombrar capa " + layer.name);
    renameButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked) return;
      const requested = window.prompt("Nombre de la capa", layer.name);
      if (requested === null) return;
      applyLayerOperation((doc, id) => renameLayer(doc, id, requested), "Capa renombrada");
    });

    const referenceButton = document.createElement("button");
    referenceButton.type = "button";
    referenceButton.className = "layer-action";
    referenceButton.textContent = layer.isReference ? "Imagen" : "Referencia";
    referenceButton.title = layer.isReference ? "Convertir referencia en imagen" : "Usar imagen como referencia";
    referenceButton.setAttribute("aria-label", referenceButton.title);
    referenceButton.disabled = layer.contentType !== "image" || layer.locked;
    referenceButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.contentType !== "image" || layer.locked) return;
      applyLayerOperation(
        (doc, id) => setLayerReference(doc, id, !layer.isReference),
        layer.isReference ? "Referencia convertida en imagen" : "Imagen convertida en referencia"
      );
    });

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button"; duplicateButton.className = "layer-action"; duplicateButton.textContent = "Duplicar"; duplicateButton.title = "Duplicar capa"; duplicateButton.setAttribute("aria-label", "Duplicar capa " + layer.name);
    duplicateButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked) return;
      const before = cloneDocument(state.document);
      const next = duplicateLayer(state.document, layer.id);
      if (!next) return;
      const originalIndex = state.document.layers.findIndex(item => item.id === layer.id);
      const duplicate = next.layers[originalIndex + 1];
      state.document = next; setSelection([duplicate.id], duplicate.id);
      state.history.record(before, next); refreshDocument("Capa duplicada"); persistDocument();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button"; deleteButton.className = "layer-action"; deleteButton.textContent = "Eliminar"; deleteButton.title = "Eliminar capa"; deleteButton.setAttribute("aria-label", "Eliminar capa " + layer.name);
    deleteButton.addEventListener("click", event => {
      event.stopPropagation();
      if (layer.locked || state.document.layers.length <= 1) return;
      applyLayerOperation(deleteLayer, "Capa eliminada");
    });

    const reorderUpButton = document.createElement("button");
    reorderUpButton.type = "button"; reorderUpButton.className = "layer-action"; reorderUpButton.textContent = "↑ Subir"; reorderUpButton.title = "Subir capa un nivel"; reorderUpButton.setAttribute("aria-label", "Subir capa " + layer.name);
    reorderUpButton.addEventListener("click", event => {
      event.stopPropagation(); if (layer.locked) return;
      applyLayerOperation((doc, id) => reorderLayer(doc, id, "up"), "Capa subida un nivel");
    });

    const reorderDownButton = document.createElement("button");
    reorderDownButton.type = "button"; reorderDownButton.className = "layer-action"; reorderDownButton.textContent = "↓ Bajar"; reorderDownButton.title = "Bajar capa un nivel"; reorderDownButton.setAttribute("aria-label", "Bajar capa " + layer.name);
    reorderDownButton.addEventListener("click", event => {
      event.stopPropagation(); if (layer.locked) return;
      applyLayerOperation((doc, id) => reorderLayer(doc, id, "down"), "Capa bajada un nivel");
    });

    const controls = document.createElement("div"); controls.className = "layer-controls"; controls.append(visibilityButton, lockButton, opacity);
    const lifecycle = document.createElement("div"); lifecycle.className = "layer-lifecycle"; lifecycle.append(renameButton, referenceButton, duplicateButton, deleteButton, reorderUpButton, reorderDownButton);
    li.append(selectButton, controls, lifecycle);
    layersEl.appendChild(li);
  });
  renderLayerAdjustments();
  renderLayerText();
  renderImageMask();
  refreshImageEditButton();
  updateSelectionMiniPanel();
}

function cropPreviewClamp(value, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(0, number));
}

function cropPreviewPoint(event) {
  if (!imageEditOriginalSize) return null;
  const bounds = cropPreviewCanvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    x: Math.round(cropPreviewClamp((event.clientX - bounds.left) / bounds.width * imageEditOriginalSize.width, imageEditOriginalSize.width)),
    y: Math.round(cropPreviewClamp((event.clientY - bounds.top) / bounds.height * imageEditOriginalSize.height, imageEditOriginalSize.height))
  };
}

function updateCropInputs(rectangle) {
  imageCropX.value = String(rectangle.x);
  imageCropY.value = String(rectangle.y);
  imageCropWidth.value = String(rectangle.width);
  imageCropHeight.value = String(rectangle.height);
}

function drawCropPreview() {
  if (!cropPreviewCanvas || !imageEditPreviewImage?.complete ||
      imageEditPreviewImage.naturalWidth < 1 || !imageEditOriginalSize) return;
  const sourceWidth = imageEditOriginalSize.width;
  const sourceHeight = imageEditOriginalSize.height;
  const previewScale = Math.min(1, 720 / sourceWidth, 420 / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * previewScale));
  const height = Math.max(1, Math.round(sourceHeight * previewScale));
  if (cropPreviewCanvas.width !== width) cropPreviewCanvas.width = width;
  if (cropPreviewCanvas.height !== height) cropPreviewCanvas.height = height;
  const context = cropPreviewCanvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();
  if (imageEditOriginalFlip.flipX) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  if (imageEditOriginalFlip.flipY) {
    context.translate(0, height);
    context.scale(1, -1);
  }
  context.drawImage(imageEditPreviewImage, 0, 0, width, height);
  context.restore();
  if (currentImageEditMode() !== "crop") return;

  const left = cropPreviewClamp(imageCropX.value, sourceWidth) / sourceWidth * width;
  const top = cropPreviewClamp(imageCropY.value, sourceHeight) / sourceHeight * height;
  const right = cropPreviewClamp(Number(imageCropX.value) + Number(imageCropWidth.value), sourceWidth) / sourceWidth * width;
  const bottom = cropPreviewClamp(Number(imageCropY.value) + Number(imageCropHeight.value), sourceHeight) / sourceHeight * height;
  if (cropPreviewOverlayCanvas.width !== width) cropPreviewOverlayCanvas.width = width;
  if (cropPreviewOverlayCanvas.height !== height) cropPreviewOverlayCanvas.height = height;
  if (cropPreviewOverlayContext) {
    cropPreviewOverlayContext.clearRect(0, 0, width, height);
    cropPreviewOverlayContext.globalCompositeOperation = "source-over";
    cropPreviewOverlayContext.fillStyle = "rgba(5, 9, 15, 0.62)";
    cropPreviewOverlayContext.fillRect(0, 0, width, height);
    cropPreviewOverlayContext.globalCompositeOperation = "destination-out";
    traceCropShape(cropPreviewOverlayContext, left, top, right - left, bottom - top, cropShapeInput?.value || "rectangle");
    cropPreviewOverlayContext.fill();
    cropPreviewOverlayContext.globalCompositeOperation = "source-over";
    context.drawImage(cropPreviewOverlayCanvas, 0, 0);
  } else {
    context.fillStyle = "rgba(5, 9, 15, 0.62)";
    context.fillRect(0, 0, width, Math.max(0, top));
    context.fillRect(0, bottom, width, Math.max(0, height - bottom));
    context.fillRect(0, top, Math.max(0, left), Math.max(0, bottom - top));
    context.fillRect(right, top, Math.max(0, width - right), Math.max(0, bottom - top));
  }

  if (right - left < 1 || bottom - top < 1) return;
  context.save();
  traceCropShape(context, left, top, right - left, bottom - top, cropShapeInput?.value || "rectangle");
  context.strokeStyle = "#f5fbff";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  context.save();
  traceCropShape(context, left, top, right - left, bottom - top, cropShapeInput?.value || "rectangle");
  context.clip();
  context.strokeStyle = "rgba(255,255,255,0.58)";
  context.lineWidth = 1;
  for (const fraction of [1 / 3, 2 / 3]) {
    context.beginPath();
    context.moveTo(left + (right - left) * fraction, top);
    context.lineTo(left + (right - left) * fraction, bottom);
    context.moveTo(left, top + (bottom - top) * fraction);
    context.lineTo(right, top + (bottom - top) * fraction);
    context.stroke();
  }
  context.restore();
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const handleSize = Math.max(6, Math.min(10, Math.min(width, height) / 55));
  const handlePoints = [
    [left, top], [centerX, top], [right, top], [right, centerY],
    [right, bottom], [centerX, bottom], [left, bottom], [left, centerY]
  ];
  for (const [x, y] of handlePoints) {
    context.fillStyle = "#f8fcff";
    context.strokeStyle = "#17374c";
    context.lineWidth = 1.5;
    context.beginPath();
    context.rect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    context.fill();
    context.stroke();
  }
}

function applyCropAspectPreset() {
  if (!imageEditOriginalSize) return;
  const ratio = Number(cropAspectInput.value);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    drawCropPreview();
    return;
  }
  const sourceWidth = imageEditOriginalSize.width;
  const sourceHeight = imageEditOriginalSize.height;
  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceWidth / sourceHeight > ratio) width = Math.max(1, Math.floor(sourceHeight * ratio));
  else height = Math.max(1, Math.floor(sourceWidth / ratio));
  updateCropInputs({
    x: Math.floor((sourceWidth - width) / 2),
    y: Math.floor((sourceHeight - height) / 2),
    width,
    height
  });
  drawCropPreview();
}

function cropDragRectangle(start, current) {
  const sourceWidth = imageEditOriginalSize.width;
  const sourceHeight = imageEditOriginalSize.height;
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  let width = Math.abs(dx);
  let height = Math.abs(dy);
  const ratio = Number(cropAspectInput.value);
  const fixedRatio = Number.isFinite(ratio) && ratio > 0;
  if (fixedRatio) {
    if (width === 0 && height === 0) {
      width = 1;
      height = 1 / ratio;
    } else if (width > height * ratio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    const maxWidth = dx < 0 ? start.x : sourceWidth - start.x;
    const maxHeight = dy < 0 ? start.y : sourceHeight - start.y;
    const factor = Math.min(1, maxWidth / Math.max(width, 1), maxHeight / Math.max(height, 1));
    width *= factor;
    height *= factor;
  }
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  if (fixedRatio) {
    if (width / height > ratio) width = Math.max(1, Math.floor(height * ratio));
    else height = Math.max(1, Math.floor(width / ratio));
  }
  width = Math.min(width, sourceWidth);
  height = Math.min(height, sourceHeight);
  const x = Math.max(0, Math.min(sourceWidth - width, dx < 0 ? start.x - width : start.x));
  const y = Math.max(0, Math.min(sourceHeight - height, dy < 0 ? start.y - height : start.y));
  return { x, y, width, height };
}

function loadCropPreview(source) {
  imageEditPreviewImage = new Image();
  imageEditPreviewImage.onload = () => {
    if (cropPreviewHint) cropPreviewHint.textContent = "Arrastrá dentro del marco para moverlo y usá los puntos blancos para ajustar el recorte. Los valores exactos están debajo.";
    drawCropPreview();
  };
  imageEditPreviewImage.onerror = () => {
    if (cropPreviewHint) cropPreviewHint.textContent = "No se pudo mostrar la vista previa. Podés usar los campos de píxeles de abajo.";
  };
  imageEditPreviewImage.src = source;
}

function refreshImageEditButton() {
  if (!cropResizeButton) return;
  const layer = selectedLayerExact();
  const editableImage = Boolean(layer && layer.contentType === "image" && layer.image && !layer.locked);
  cropResizeButton.disabled = !editableImage;
  if (removeBackgroundButton) removeBackgroundButton.disabled = !editableImage;
  const fitButton = document.querySelector("#fit-image-to-canvas");
  if (fitButton) fitButton.disabled = !editableImage;
  if (recolorButton) recolorButton.disabled = !editableImage;
  cropResizeButton.title = editableImage ? "Crop or resize the selected image layer" : "Select an unlocked image layer to crop or resize";
  for (const button of [flipImageHorizontalButton, flipImageVerticalButton]) {
    if (!button) continue;
    button.disabled = !editableImage;
    button.title = editableImage ? "Mirror selected image " + (button === flipImageHorizontalButton ? "left to right" : "top to bottom") : "Select an unlocked image layer first";
  }
}

function currentImageEditMode() {
  return document.querySelector('input[name="image-edit-mode"]:checked')?.value === "resize" ? "resize" : "crop";
}

function syncImageEditMode() {
  const resize = currentImageEditMode() === "resize";
  imageCropFields.hidden = resize;
  imageResizeFields.hidden = !resize;
  document.querySelector("#apply-image-edit").textContent = resize ? "Cambiar tamaño" : "Recortar imagen";
  drawCropPreview();
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

function toggleSelectedImageFlip(axis) {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "Select an unlocked image layer to flip";
    return;
  }
  const before = cloneDocument(state.document);
  const next = flipImageLayer(state.document, layer.id, axis);
  if (!next) {
    status.textContent = "Image flip was rejected";
    return;
  }
  state.document = next;
  state.history.record(before, next);
  refreshDocument(axis === "horizontal" ? "Image flipped horizontally" : "Image flipped vertically");
  persistDocument();
}

document.querySelector("#fit-image-to-canvas")?.addEventListener("click", fitSelectedImageToCanvas);
flipImageHorizontalButton.addEventListener("click", () => toggleSelectedImageFlip("horizontal"));
flipImageVerticalButton.addEventListener("click", () => toggleSelectedImageFlip("vertical"));

cropResizeButton.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "Select an unlocked image layer before cropping or resizing";
    return;
  }
  imageEditLayerId = layer.id;
  imageEditOriginalSize = { width: layer.image.width, height: layer.image.height };
  imageEditOriginalFlip = { flipX: layer.image.flipX === true, flipY: layer.image.flipY === true };
  imageEditSourceSize.textContent = layer.name + " · " + layer.image.width + " × " + layer.image.height + " px";
  imageCropX.value = "0"; imageCropY.value = "0";
  imageCropWidth.value = String(layer.image.width); imageCropHeight.value = String(layer.image.height);
  imageResizeWidth.value = String(layer.image.width); imageResizeHeight.value = String(layer.image.height);
  imageResizeKeepAspect.checked = true;
  cropAspectInput.value = "";
  if (cropShapeInput) cropShapeInput.value = "rectangle";
  document.querySelector('input[name="image-edit-mode"][value="crop"]').checked = true;
  loadCropPreview(layer.image.source);
  syncImageEditMode();
  imageEditDialog.showModal();
  drawCropPreview();
});

document.querySelector("#cancel-image-edit").addEventListener("click", () => imageEditDialog.close());
document.querySelector("#close-image-edit")?.addEventListener("click", () => imageEditDialog.close());
imageEditDialog.addEventListener("close", () => {
  cropPreviewDrag = null;
  if (imageEditPreviewImage) {
    imageEditPreviewImage.onload = null;
    imageEditPreviewImage.onerror = null;
  }
  imageEditPreviewImage = null;
});
document.querySelectorAll('input[name="image-edit-mode"]').forEach(input => input.addEventListener("change", syncImageEditMode));
imageResizeWidth.addEventListener("input", syncAspectRatioFromWidth);
imageResizeHeight.addEventListener("input", syncAspectRatioFromHeight);
cropAspectInput.addEventListener("change", applyCropAspectPreset);
cropShapeInput?.addEventListener("change", () => {
  if (cropShapeInput.value === "circle" && cropAspectInput.value !== "1") {
    cropAspectInput.value = "1";
    applyCropAspectPreset();
    return;
  }
  drawCropPreview();
});
for (const input of [imageCropX, imageCropY, imageCropWidth, imageCropHeight]) {
  input.addEventListener("input", drawCropPreview);
}

function currentCropRectangle() {
  if (!imageEditOriginalSize) return { x: 0, y: 0, width: 1, height: 1 };
  const maxWidth = imageEditOriginalSize.width;
  const maxHeight = imageEditOriginalSize.height;
  const width = Math.max(1, Math.min(maxWidth, Math.round(Number(imageCropWidth.value) || maxWidth)));
  const height = Math.max(1, Math.min(maxHeight, Math.round(Number(imageCropHeight.value) || maxHeight)));
  const x = Math.max(0, Math.min(maxWidth - width, Math.round(Number(imageCropX.value) || 0)));
  const y = Math.max(0, Math.min(maxHeight - height, Math.round(Number(imageCropY.value) || 0)));
  return { x, y, width, height };
}

function cropPreviewHitHandle(point, rectangle) {
  const bounds = cropPreviewCanvas.getBoundingClientRect();
  const toleranceX = Math.max(6, imageEditOriginalSize.width / Math.max(1, bounds.width) * 16);
  const toleranceY = Math.max(6, imageEditOriginalSize.height / Math.max(1, bounds.height) * 16);
  const left = rectangle.x;
  const top = rectangle.y;
  const right = left + rectangle.width;
  const bottom = top + rectangle.height;
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  const handles = [
    ["nw", left, top], ["n", midX, top], ["ne", right, top],
    ["e", right, midY], ["se", right, bottom], ["s", midX, bottom],
    ["sw", left, bottom], ["w", left, midY]
  ];
  let nearest = null;
  let nearestDistance = Infinity;
  for (const [name, x, y] of handles) {
    const dx = (point.x - x) / toleranceX;
    const dy = (point.y - y) / toleranceY;
    const distance = dx * dx + dy * dy;
    if (Math.abs(point.x - x) <= toleranceX && Math.abs(point.y - y) <= toleranceY && distance < nearestDistance) {
      nearest = name;
      nearestDistance = distance;
    }
  }
  if (nearest) return "resize-" + nearest;
  const isFullImageSelection =
    rectangle.x === 0 && rectangle.y === 0 &&
    rectangle.width >= imageEditOriginalSize.width &&
    rectangle.height >= imageEditOriginalSize.height;
  if (!isFullImageSelection &&
      point.x >= left && point.x <= right &&
      point.y >= top && point.y <= bottom) return "move";
  return "new";
}

function moveCropRectangle(before, point, start) {
  const maxWidth = imageEditOriginalSize.width;
  const maxHeight = imageEditOriginalSize.height;
  return {
    ...before,
    x: Math.max(0, Math.min(maxWidth - before.width, before.x + point.x - start.x)),
    y: Math.max(0, Math.min(maxHeight - before.height, before.y + point.y - start.y))
  };
}

function resizeCropRectangle(before, point, handle) {
  const maxWidth = imageEditOriginalSize.width;
  const maxHeight = imageEditOriginalSize.height;
  const ratio = Number(cropAspectInput.value);
  const fixedRatio = Number.isFinite(ratio) && ratio > 0;
  const left = before.x;
  const top = before.y;
  const right = left + before.width;
  const bottom = top + before.height;

  if (["nw", "ne", "se", "sw"].includes(handle)) {
    const anchors = {
      nw: { x: right, y: bottom },
      ne: { x: left, y: bottom },
      se: { x: left, y: top },
      sw: { x: right, y: top }
    };
    return cropDragRectangle(anchors[handle], point);
  }

  let x = left, y = top, width = before.width, height = before.height;
  if (handle === "e" || handle === "w") {
    const movingX = Math.max(0, Math.min(maxWidth, Math.round(point.x)));
    if (handle === "e") width = Math.max(1, movingX - left);
    else { width = Math.max(1, right - movingX); x = Math.min(right - 1, movingX); }
    if (fixedRatio) {
      height = Math.max(1, Math.min(maxHeight, Math.round(width / ratio)));
      y = Math.round((top + bottom - height) / 2);
    }
  } else {
    const movingY = Math.max(0, Math.min(maxHeight, Math.round(point.y)));
    if (handle === "s") height = Math.max(1, movingY - top);
    else { height = Math.max(1, bottom - movingY); y = Math.min(bottom - 1, movingY); }
    if (fixedRatio) {
      width = Math.max(1, Math.min(maxWidth, Math.round(height * ratio)));
      x = Math.round((left + right - width) / 2);
    }
  }

  width = Math.max(1, Math.min(maxWidth, width));
  height = Math.max(1, Math.min(maxHeight, height));
  x = Math.max(0, Math.min(maxWidth - width, x));
  y = Math.max(0, Math.min(maxHeight - height, y));
  return { x, y, width, height };
}

cropPreviewCanvas.addEventListener("pointerdown", event => {
  if (currentImageEditMode() !== "crop" || !imageEditPreviewImage || !imageEditOriginalSize) return;
  const point = cropPreviewPoint(event);
  if (!point) return;
  event.preventDefault();
  const before = currentCropRectangle();
  const mode = cropPreviewHitHandle(point, before);
  cropPreviewDrag = { pointerId: event.pointerId, start: point, before, mode };
  try { cropPreviewCanvas.setPointerCapture(event.pointerId); } catch {}
  if (mode === "new") updateCropInputs({ x: point.x, y: point.y, width: 1, height: 1 });
  drawCropPreview();
});
cropPreviewCanvas.addEventListener("pointermove", event => {
  if (!cropPreviewDrag || cropPreviewDrag.pointerId !== event.pointerId) return;
  const point = cropPreviewPoint(event);
  if (!point) return;
  const drag = cropPreviewDrag;
  if (drag.mode === "new") updateCropInputs(cropDragRectangle(drag.start, point));
  else if (drag.mode === "move") updateCropInputs(moveCropRectangle(drag.before, point, drag.start));
  else if (drag.mode.startsWith("resize-")) updateCropInputs(resizeCropRectangle(drag.before, point, drag.mode.slice(7)));
  drawCropPreview();
});
function finishCropPreviewDrag(event) {
  if (!cropPreviewDrag || cropPreviewDrag.pointerId !== event.pointerId) return;
  const drag = cropPreviewDrag;
  if (event.type === "pointerup") {
    const point = cropPreviewPoint(event);
    if (point) {
      if (drag.mode === "new") updateCropInputs(cropDragRectangle(drag.start, point));
      else if (drag.mode === "move") updateCropInputs(moveCropRectangle(drag.before, point, drag.start));
      else if (drag.mode.startsWith("resize-")) updateCropInputs(resizeCropRectangle(drag.before, point, drag.mode.slice(7)));
    }
  } else {
    updateCropInputs(drag.before);
  }
  cropPreviewDrag = null;
  drawCropPreview();
  try { if (cropPreviewCanvas.hasPointerCapture(event.pointerId)) cropPreviewCanvas.releasePointerCapture(event.pointerId); } catch {}
}
cropPreviewCanvas.addEventListener("pointerup", finishCropPreviewDrag);
cropPreviewCanvas.addEventListener("pointercancel", finishCropPreviewDrag);

document.querySelector("#crop-reset-selection")?.addEventListener("click", () => {
  if (!imageEditOriginalSize || currentImageEditMode() !== "crop") return;
  updateCropInputs({
    x: 0,
    y: 0,
    width: imageEditOriginalSize.width,
    height: imageEditOriginalSize.height
  });
  cropAspectInput.value = "";
  drawCropPreview();
  if (cropPreviewHint) cropPreviewHint.textContent = "Marco restablecido a la imagen completa. Arrastrá para elegir o ajustar otro recorte.";
});

imageEditForm.addEventListener("submit", async event => {
  event.preventDefault();
  const layer = state.document.layers.find(item => item.id === imageEditLayerId);
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "The selected image layer is no longer available";
    imageEditDialog.close();
    return;
  }
  if (state.storageRecoveryPending) {
    status.textContent = "El proyecto anterior está protegido. Pulsa Guardar para reemplazarlo de forma explícita.";
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
      const sourceX = layer.image.flipX ? layer.image.width - x - width : x;
      const sourceY = layer.image.flipY ? layer.image.height - y - height : y;
      replacement = await cropImageSource(layer.image.source, { x: sourceX, y: sourceY, width, height }, {
        shape: cropShapeInput?.value || "rectangle",
        flipX: layer.image.flipX === true,
        flipY: layer.image.flipY === true
      });
      // Layer offset uses the visible crop origin; raster crop uses source pixel coordinates.
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


function hideMobileToolSheets() {
  closeMobileContextPanel();
  document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
  mobileDock?.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
  mobileDock?.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
}

function openCropModeDialog() {
  hideMobileToolSheets();
  if (!cropModeDialog?.open) cropModeDialog?.showModal();
}

document.querySelector("#close-crop-mode")?.addEventListener("click", () => cropModeDialog?.close());
document.querySelector("#crop-selected-image")?.addEventListener("click", () => {
  cropModeDialog?.close();
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image) {
    status.textContent = "Para recortar una imagen, seleccioná primero una capa de imagen. También podés elegir “Recortar lienzo completo”.";
    return;
  }
  if (layer.locked) {
    status.textContent = "La imagen está bloqueada. Desbloqueala desde Capas antes de recortar sus píxeles.";
    return;
  }
  cropResizeButton?.click();
});
document.querySelector("#crop-whole-canvas")?.addEventListener("click", () => {
  void openCanvasCropDialog();
});

function canvasCropPoint(event) {
  if (!canvasCropPreview || !canvasCropDocument) return null;
  const bounds = canvasCropPreview.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    x: Math.max(0, Math.min(canvasCropDocument.width, (event.clientX - bounds.left) / bounds.width * canvasCropDocument.width)),
    y: Math.max(0, Math.min(canvasCropDocument.height, (event.clientY - bounds.top) / bounds.height * canvasCropDocument.height))
  };
}

function canvasCropFullRectangle() {
  if (!canvasCropDocument) return { x: 0, y: 0, width: 1, height: 1 };
  return { x: 0, y: 0, width: canvasCropDocument.width, height: canvasCropDocument.height };
}

function canvasCropIsFullRectangle(rectangle) {
  return Boolean(canvasCropDocument && rectangle &&
    rectangle.x === 0 && rectangle.y === 0 &&
    rectangle.width === canvasCropDocument.width && rectangle.height === canvasCropDocument.height);
}

function updateCanvasCropFields() {
  if (!canvasCropRectangle || !canvasCropDocument) return;
  document.querySelector("#canvas-crop-x").value = String(canvasCropRectangle.x);
  document.querySelector("#canvas-crop-y").value = String(canvasCropRectangle.y);
  document.querySelector("#canvas-crop-width").value = String(canvasCropRectangle.width);
  document.querySelector("#canvas-crop-height").value = String(canvasCropRectangle.height);
  const full = canvasCropIsFullRectangle(canvasCropRectangle);
  document.querySelector("#apply-canvas-crop").disabled = full;
  canvasCropStatus.textContent = full
    ? "Está seleccionado el lienzo completo. Arrastrá el marco o ajustá X, Y, ancho y alto para recortar."
    : "Recorte seleccionado: " + canvasCropRectangle.width + " × " + canvasCropRectangle.height +
      " px · " + canvasCropDocument.layers.length + " capas se conservarán.";
}

function drawCanvasCropPreview() {
  if (!canvasCropContext || !canvasCropPreview || !canvasCropBase.width || !canvasCropBase.height ||
      !canvasCropDocument || !canvasCropRectangle) return;
  const width = canvasCropPreview.width, height = canvasCropPreview.height;
  canvasCropContext.clearRect(0, 0, width, height);
  canvasCropContext.drawImage(canvasCropBase, 0, 0, width, height);
  const sx = width / canvasCropDocument.width;
  const sy = height / canvasCropDocument.height;
  const rectangle = {
    x: canvasCropRectangle.x * sx,
    y: canvasCropRectangle.y * sy,
    width: canvasCropRectangle.width * sx,
    height: canvasCropRectangle.height * sy
  };
  const right = rectangle.x + rectangle.width, bottom = rectangle.y + rectangle.height;
  canvasCropContext.save();
  canvasCropContext.fillStyle = "rgba(4, 7, 15, .60)";
  canvasCropContext.fillRect(0, 0, width, rectangle.y);
  canvasCropContext.fillRect(0, bottom, width, Math.max(0, height - bottom));
  canvasCropContext.fillRect(0, rectangle.y, rectangle.x, rectangle.height);
  canvasCropContext.fillRect(right, rectangle.y, Math.max(0, width - right), rectangle.height);
  canvasCropContext.strokeStyle = "#fff";
  canvasCropContext.lineWidth = Math.max(1.5, width / 500);
  canvasCropContext.setLineDash([]);
  canvasCropContext.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  const handleSize = Math.max(6, Math.min(12, width / 45));
  for (const [x, y] of [[rectangle.x, rectangle.y], [right, rectangle.y], [right, bottom], [rectangle.x, bottom]]) {
    canvasCropContext.fillStyle = "#ffffff";
    canvasCropContext.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    canvasCropContext.strokeStyle = "#17141e";
    canvasCropContext.lineWidth = 1;
    canvasCropContext.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  }
  canvasCropContext.restore();
  updateCanvasCropFields();
}

function clampCanvasCropRect(rectangle) {
  if (!canvasCropDocument) return null;
  const width = canvasCropDocument.width, height = canvasCropDocument.height;
  const cropWidth = Math.max(1, Math.min(width, Math.round(Number(rectangle.width) || 1)));
  const cropHeight = Math.max(1, Math.min(height, Math.round(Number(rectangle.height) || 1)));
  const x = Math.max(0, Math.min(width - cropWidth, Math.round(Number(rectangle.x) || 0)));
  const y = Math.max(0, Math.min(height - cropHeight, Math.round(Number(rectangle.y) || 0)));
  return { x, y, width: cropWidth, height: cropHeight };
}

function canvasCropRectangleFromDrag(start, current) {
  const ratio = Number(document.querySelector("#canvas-crop-ratio").value);
  let width = Math.abs(current.x - start.x);
  let height = Math.abs(current.y - start.y);
  if (Number.isFinite(ratio) && ratio > 0) {
    if (width > height * ratio) height = width / ratio;
    else width = height * ratio;
  }
  const x = current.x < start.x ? start.x - width : start.x;
  const y = current.y < start.y ? start.y - height : start.y;
  return clampCanvasCropRect({ x, y, width, height });
}

async function openCanvasCropDialog() {
  hideMobileToolSheets();
  if (cropModeDialog?.open) cropModeDialog.close();
  const current = state.document;
  if (!current || !Number.isInteger(current.width) || current.width < 1 ||
      !Number.isInteger(current.height) || current.height < 1) {
    status.textContent = "Primero creá un lienzo con ancho y alto válidos.";
    return;
  }
  try {
    canvasCropDocument = cloneDocument(current);
    const maxPreviewDimension = 1400;
    canvasCropPreviewScale = Math.min(1, maxPreviewDimension / Math.max(current.width, current.height));
    const width = Math.max(1, Math.round(current.width * canvasCropPreviewScale));
    const height = Math.max(1, Math.round(current.height * canvasCropPreviewScale));
    canvasCropBase.width = width;
    canvasCropBase.height = height;
    canvasCropPreview.width = width;
    canvasCropPreview.height = height;

    // Load all image assets first so the preview actually represents the entire
    // flattened composition rather than a thumbnail of only the selected layer.
    await Promise.all(canvasCropDocument.layers
      .filter(layer => layer.visible && layer.contentType === "image" && layer.image?.source)
      .map(layer => new Promise((resolve, reject) => {
        const cached = imageCache.get(layer.image.source);
        if (cached?.complete && cached.naturalWidth > 0) { resolve(cached); return; }
        const image = cached || new Image();
        image.onload = () => { imageCache.set(layer.image.source, image); resolve(image); };
        image.onerror = () => reject(new Error("No se pudo cargar una imagen de la composición para previsualizar el recorte."));
        image.src = layer.image.source;
        imageCache.set(layer.image.source, image);
      })));

    renderDocumentToCanvas(canvasCropDocument, canvasCropBase, ({ context, document: model }) => {
      context.scale(canvasCropPreviewScale, canvasCropPreviewScale);
      drawDocument({
        context,
        document: model,
        center: documentCenter(model),
        transformForLayer: layer => layer.transform
      });
    });
    const insetX = Math.round(current.width * 0.06);
    const insetY = Math.round(current.height * 0.06);
    canvasCropRectangle = clampCanvasCropRect({
      x: insetX, y: insetY,
      width: Math.max(1, current.width - insetX * 2),
      height: Math.max(1, current.height - insetY * 2)
    });
    document.querySelector("#canvas-crop-document-size").textContent =
      current.width + " × " + current.height + " px · " + canvasCropDocument.layers.length + " capas";
    document.querySelector("#canvas-crop-ratio").value = "";
    if (!canvasCropDialog.open) canvasCropDialog.showModal();
    drawCanvasCropPreview();
  } catch (error) {
    canvasCropDocument = null;
    canvasCropRectangle = null;
    status.textContent = error?.message || "No se pudo preparar la vista previa del lienzo completo.";
  }
}

canvasCropPreview?.addEventListener("pointerdown", event => {
  if (!canvasCropDocument || !canvasCropRectangle) return;
  const point = canvasCropPoint(event);
  if (!point) return;
  const rectangle = canvasCropRectangle;
  const bounds = canvasCropPreview.getBoundingClientRect();
  const toleranceX = canvasCropDocument.width * 16 / Math.max(1, bounds.width);
  const toleranceY = canvasCropDocument.height * 16 / Math.max(1, bounds.height);
  const corners = {
    nw: { x: rectangle.x, y: rectangle.y },
    ne: { x: rectangle.x + rectangle.width, y: rectangle.y },
    se: { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height },
    sw: { x: rectangle.x, y: rectangle.y + rectangle.height }
  };
  let mode = null;
  for (const [name, corner] of Object.entries(corners)) {
    if (Math.abs(point.x - corner.x) <= toleranceX && Math.abs(point.y - corner.y) <= toleranceY) {
      mode = "resize-" + name;
      break;
    }
  }
  if (!mode && point.x >= rectangle.x && point.x <= rectangle.x + rectangle.width &&
      point.y >= rectangle.y && point.y <= rectangle.y + rectangle.height) mode = "move";
  if (!mode) mode = "new";
  canvasCropDrag = { pointerId: event.pointerId, start: point, before: { ...rectangle }, mode };
  event.preventDefault();
  try { canvasCropPreview.setPointerCapture(event.pointerId); } catch {}
});

canvasCropPreview?.addEventListener("pointermove", event => {
  const drag = canvasCropDrag;
  if (!drag || drag.pointerId !== event.pointerId || !canvasCropDocument) return;
  const point = canvasCropPoint(event);
  if (!point) return;
  if (drag.mode === "new") {
    const next = canvasCropRectangleFromDrag(drag.start, point);
    if (next && next.width > 2 && next.height > 2) canvasCropRectangle = next;
  } else if (drag.mode === "move") {
    canvasCropRectangle = clampCanvasCropRect({
      ...drag.before,
      x: drag.before.x + point.x - drag.start.x,
      y: drag.before.y + point.y - drag.start.y
    });
  } else {
    const name = drag.mode.slice("resize-".length);
    const leftSide = name.endsWith("w");
    const topSide = name.startsWith("n");
    const anchorX = leftSide ? drag.before.x + drag.before.width : drag.before.x;
    const anchorY = topSide ? drag.before.y + drag.before.height : drag.before.y;
    const ratio = Number(document.querySelector("#canvas-crop-ratio").value);
    let nextWidth = Math.max(1, Math.abs(point.x - anchorX));
    let nextHeight = Math.max(1, Math.abs(point.y - anchorY));
    if (Number.isFinite(ratio) && ratio > 0) {
      if (nextWidth > nextHeight * ratio) nextHeight = nextWidth / ratio;
      else nextWidth = nextHeight * ratio;
    }
    canvasCropRectangle = clampCanvasCropRect({
      x: leftSide ? anchorX - nextWidth : anchorX,
      y: topSide ? anchorY - nextHeight : anchorY,
      width: nextWidth, height: nextHeight
    });
  }
  drawCanvasCropPreview();
});
function finishCanvasCropDrag(event) {
  if (!canvasCropDrag || canvasCropDrag.pointerId !== event.pointerId) return;
  canvasCropDrag = null;
  try { if (canvasCropPreview.hasPointerCapture(event.pointerId)) canvasCropPreview.releasePointerCapture(event.pointerId); } catch {}
  drawCanvasCropPreview();
}
canvasCropPreview?.addEventListener("pointerup", finishCanvasCropDrag);
canvasCropPreview?.addEventListener("pointercancel", finishCanvasCropDrag);

for (const id of ["x", "y", "width", "height"]) {
  document.querySelector("#canvas-crop-" + id)?.addEventListener("change", () => {
    if (!canvasCropDocument || !canvasCropRectangle) return;
    const candidate = {
      x: Number(document.querySelector("#canvas-crop-x").value),
      y: Number(document.querySelector("#canvas-crop-y").value),
      width: Number(document.querySelector("#canvas-crop-width").value),
      height: Number(document.querySelector("#canvas-crop-height").value)
    };
    if (![candidate.x, candidate.y, candidate.width, candidate.height].every(Number.isFinite)) return;
    canvasCropRectangle = clampCanvasCropRect(candidate);
    drawCanvasCropPreview();
  });
}
document.querySelector("#canvas-crop-ratio")?.addEventListener("change", () => {
  if (!canvasCropDocument || !canvasCropRectangle) return;
  const ratio = Number(document.querySelector("#canvas-crop-ratio").value);
  if (Number.isFinite(ratio) && ratio > 0) {
    let width = canvasCropRectangle.width, height = canvasCropRectangle.height;
    if (width / height > ratio) width = Math.round(height * ratio);
    else height = Math.round(width / ratio);
    canvasCropRectangle = clampCanvasCropRect({
      x: canvasCropRectangle.x + Math.round((canvasCropRectangle.width - width) / 2),
      y: canvasCropRectangle.y + Math.round((canvasCropRectangle.height - height) / 2),
      width, height
    });
  }
  drawCanvasCropPreview();
});
document.querySelector("#canvas-crop-reset")?.addEventListener("click", () => {
  canvasCropRectangle = canvasCropFullRectangle();
  drawCanvasCropPreview();
});
document.querySelector("#close-canvas-crop")?.addEventListener("click", () => canvasCropDialog?.close());
document.querySelector("#cancel-canvas-crop")?.addEventListener("click", () => canvasCropDialog?.close());
canvasCropDialog?.addEventListener("close", () => {
  canvasCropDrag = null;
  canvasCropDocument = null;
  canvasCropRectangle = null;
});
document.querySelector("#apply-canvas-crop")?.addEventListener("click", () => {
  if (!canvasCropRectangle || !canvasCropDocument || canvasCropIsFullRectangle(canvasCropRectangle)) return;
  if (state.storageRecoveryPending) {
    canvasCropStatus.textContent = "El proyecto está protegido. Guardalo primero antes de cambiar el lienzo.";
    return;
  }
  const before = cloneDocument(state.document);
  const next = cropDocumentCanvas(state.document, canvasCropRectangle);
  if (!next) {
    canvasCropStatus.textContent = "El marco de recorte no es válido. Ajustá X, Y, ancho y alto.";
    return;
  }
  const selectedIds = [...state.selectedLayerIds];
  const selectedId = selectedLayerExact()?.id || selectedIds.at(-1) || null;
  state.document = next;
  state.history.record(before, next);
  setSelection(selectedIds.filter(id => next.layers.some(layer => layer.id === id)), selectedId && next.layers.some(layer => layer.id === selectedId) ? selectedId : null);
  refreshDocument("✂️ Lienzo recortado: todas las capas se conservaron en el nuevo encuadre.");
  persistDocument();
  canvasCropDialog.close();
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

function clearElementChildren(element) {
  if (!element) return;
  if (typeof element.replaceChildren === "function") {
    element.replaceChildren();
    return;
  }
  while (element.firstChild) element.removeChild(element.firstChild);
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
  clearElementChildren(layerAdjustmentControls);

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


const quickRecipeButtons=[...document.querySelectorAll("[data-quick-recipe]")];
const quickRecipeStatus=document.querySelector("#quick-recipe-status");
function runQuickEditRecipe(recipeId){
 if(!quickRecipeStatus)return false;
 try{
  const result=applyQuickEditRecipe(state.document,recipeId,state.selectedLayerIds);
  const before=cloneDocument(state.document);
  state.document=result.document;
  state.history.record(before,state.document);
  refreshDocument(result.message);
  persistDocument();
  quickRecipeStatus.textContent=result.message;
  quickRecipeStatus.dataset.state="ready";
  return true;
 }catch(error){
  quickRecipeStatus.textContent=error.message||"Could not apply the quick-edit recipe.";
  quickRecipeStatus.dataset.state="error";
  status.textContent="Quick edit needs attention";
  return false;
 }
}
quickRecipeButtons.forEach(button=>button.addEventListener("click",()=>runQuickEditRecipe(button.dataset.quickRecipe)));
document.addEventListener("keydown",event=>{
 const target=event.target;
 const editingText=target instanceof HTMLElement&&(target.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(target.tagName));
 if(editingText||document.querySelector("dialog[open]"))return;
 if(!(event.ctrlKey||event.metaKey)||!event.altKey||event.shiftKey)return;
 const number=Number(event.key);
 if(!Number.isInteger(number)||number<1||number>8)return;
 const recipe=QUICK_EDIT_RECIPES[number-1];
 if(!recipe)return;
 event.preventDefault();
 runQuickEditRecipe(recipe.id);
});

function activateSelectionToolForText() {
  const selectButton = document.querySelector('.toolbar .tool[data-tool="select"]');
  if (state.tool !== "select") {
    if (selectButton) selectButton.click();
    else state.tool = "select";
  }
  document.querySelectorAll('.mobile-touch-dock [data-touch-action="tool"]').forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.tool === "select"));
  });
}

function showTextEditorDialog() {
  if (!textEditDialog) return false;
  if (!textEditDialog.open) {
    try {
      if (typeof textEditDialog.showModal === "function") textEditDialog.showModal();
      else {
        // Mark non-modal Android WebView fallback so it can sit above the fixed dock.
        textEditDialog.dataset.openFallback = "true";
        textEditDialog.setAttribute("open", "");
      }
    } catch {
      // Older Android WebViews can reject showModal(). Keep editing available
      // through a fixed, non-modal fallback rather than leaving Text unresponsive.
      textEditDialog.dataset.openFallback = "true";
      try {
        if (typeof textEditDialog.show === "function") textEditDialog.show();
        else textEditDialog.setAttribute("open", "");
      } catch {
        textEditDialog.setAttribute("open", "");
      }
    }
  }
  if (!textEditDialog.open) {
    textEditDialog.dataset.openFallback = "true";
    textEditDialog.setAttribute("open", "");
  }
  return Boolean(textEditDialog.open);
}

function openTextEditorForLayer(layerId = selectedLayerExact()?.id) {
  const layer = state.document.layers.find(item => item.id === layerId);
  if (!layer || layer.contentType !== "text") {
    status.textContent = "Seleccioná primero un texto en el lienzo o en Capas.";
    return false;
  }
  activateSelectionToolForText();
  newlyCreatedTextLayerId = null;
  state.textPreview = null;
  setSelection([layer.id], layer.id);
  renderLayerText();
  if (!showTextEditorDialog()) {
    status.textContent = "No se pudo abrir el editor de texto. Cerrá otros paneles e intentá de nuevo.";
    return false;
  }
  window.requestAnimationFrame(() => {
    if (!textEditDialog?.open || layer.locked || !textContentInput) return;
    textContentInput.focus({ preventScroll: true });
    const end = textContentInput.value.length;
    textContentInput.setSelectionRange(newlyCreatedTextLayerId === layer.id ? 0 : end, end);
  });
  return true;
}

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
  textOutlineColorInput.value = values.outlineColor;
  textOutlineWidthInput.value = String(values.outlineWidth);
  textOutlineWidthValue.textContent = values.outlineWidth + " px";
  textShadowColorInput.value = values.shadowColor;
  textShadowBlurInput.value = String(values.shadowBlur);
  textShadowBlurValue.textContent = values.shadowBlur + " px";
  textShadowXInput.value = String(values.shadowOffsetX);
  textShadowXValue.textContent = values.shadowOffsetX + " px";
  textShadowYInput.value = String(values.shadowOffsetY);
  textShadowYValue.textContent = values.shadowOffsetY + " px";
  textAlignInput.value = values.align;
textLetterSpacingInput.value = String(values.letterSpacing);
textLetterSpacingValue.textContent = values.letterSpacing + " px";
textLineHeightInput.value = String(values.lineHeight);
textLineHeightValue.textContent = values.lineHeight.toFixed(2) + "×";
if (saveTextStyleButton) saveTextStyleButton.disabled = disabled;
renderSavedTextStyles();
  for (const input of [textContentInput, textFontSizeInput, textFontFamilyInput, textFontWeightInput, textColorInput, textOutlineColorInput, textOutlineWidthInput, textAlignInput, textShadowColorInput, textShadowBlurInput, textShadowXInput, textShadowYInput]) {
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
textOutlineColorInput.addEventListener("input", () => updateTextPreview({ outlineColor: textOutlineColorInput.value }));
textOutlineColorInput.addEventListener("change", () => commitTextPreview("Text outline color updated"));
textOutlineWidthInput.addEventListener("input", () => {
  textOutlineWidthValue.textContent = textOutlineWidthInput.value + " px";
  updateTextPreview({ outlineWidth: Number(textOutlineWidthInput.value) });
});
textOutlineWidthInput.addEventListener("change", () => commitTextPreview("Text outline updated"));
textAlignInput.addEventListener("change", () => {
  updateTextPreview({ align: textAlignInput.value });
  commitTextPreview("Text alignment updated");
});
textLetterSpacingInput?.addEventListener("input", () => { textLetterSpacingValue.textContent = Number(textLetterSpacingInput.value).toFixed(1) + " px"; updateTextPreview({ letterSpacing: Number(textLetterSpacingInput.value) }); });
textLetterSpacingInput?.addEventListener("change", () => commitTextPreview("Text letter spacing updated"));
textLineHeightInput?.addEventListener("input", () => { textLineHeightValue.textContent = Number(textLineHeightInput.value).toFixed(2) + "×"; updateTextPreview({ lineHeight: Number(textLineHeightInput.value) }); });
textLineHeightInput?.addEventListener("change", () => commitTextPreview("Text line height updated"));
textShadowColorInput.addEventListener("input",()=>updateTextPreview({shadowColor:textShadowColorInput.value}));textShadowColorInput.addEventListener("change",()=>commitTextPreview("Text shadow color updated"));
textShadowBlurInput.addEventListener("input",()=>{const v=Number(textShadowBlurInput.value);textShadowBlurValue.textContent=v+" px";updateTextPreview({shadowBlur:v});});textShadowBlurInput.addEventListener("change",()=>commitTextPreview("Text shadow updated"));
textShadowXInput.addEventListener("input", () => { const v = Number(textShadowXInput.value); textShadowXValue.textContent = v + " px"; updateTextPreview({ shadowOffsetX: v }); });
textShadowXInput.addEventListener("change", () => commitTextPreview("Text shadow horizontal offset updated"));
textShadowYInput.addEventListener("input", () => { const v = Number(textShadowYInput.value); textShadowYValue.textContent = v + " px"; updateTextPreview({ shadowOffsetY: v }); });
textShadowYInput.addEventListener("change", () => commitTextPreview("Text shadow vertical offset updated"));
function cancelNewlyCreatedTextLayer() {
  const id = newlyCreatedTextLayerId;
  newlyCreatedTextLayerId = null;
  if (!id) return false;
  const layer = state.document.layers.find(item => item.id === id && item.contentType === "text");
  if (!layer) return false;
  setSelection([layer.id], layer.id);
  const removed = removeSelectedLayer();
  if (textEditDialog?.open) textEditDialog.close();
  return removed;
}
closeTextEditButton?.addEventListener("click", () => {
  if (newlyCreatedTextLayerId) { cancelNewlyCreatedTextLayer(); return; }
  textEditDialog?.close();
});
textEditDialog?.addEventListener("cancel", event => {
  if (newlyCreatedTextLayerId) {
    event.preventDefault();
    cancelNewlyCreatedTextLayer();
  }
});
document.querySelector("#apply-text-layer")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "text") {
    textEditDialog?.close();
    return;
  }
  commitTextPreview("Texto aplicado al lienzo");
  newlyCreatedTextLayerId = null;
  textEditDialog?.close();
  status.textContent = "Texto aplicado al lienzo. Podés moverlo o eliminarlo desde la barra inferior.";
});
document.querySelector("#delete-text-layer")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "text") return;
  newlyCreatedTextLayerId = null;
  if (removeSelectedLayer()) textEditDialog?.close();
});
textEditDialog?.addEventListener("close", () => {
  delete textEditDialog.dataset.openFallback;
  // Keep edits to an existing text layer when the user closes the editor with X or Escape.
  // Canceling a newly created provisional layer removes it before this close event, so its
  // pending preview has no layer to commit and is safely discarded.
  if (state.textPreview) {
    const preview = state.textPreview;
    const layer = state.document.layers.find(item => item.id === preview.layerId && item.contentType === "text");
    state.textPreview = null;
    if (layer) {
      commitLayerText(preview.layerId, preview.values, "Cambios de texto guardados al cerrar el editor");
    }
  }
  redraw();
  renderLayerText();
});
textStylePresetButtons.forEach(button => button.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "text" || layer.locked) return;
  const presets = {
    title: { fontFamily: "Arial Black", fontWeight: "bold", fontSize: 76, color: "#ffffff", outlineWidth: 0, shadowColor: "#10131a", shadowBlur: 5, shadowOffsetX: 0, shadowOffsetY: 3, align: "center", letterSpacing: -0.5, lineHeight: 1.0 },
    subtitle: { fontFamily: "Georgia", fontWeight: "bold", fontSize: 44, color: "#f4f3ff", outlineWidth: 0, shadowColor: "#171323", shadowBlur: 2, shadowOffsetX: 0, shadowOffsetY: 2, align: "center", letterSpacing: 0.25, lineHeight: 1.15 },
    body: { fontFamily: "Arial", fontWeight: "normal", fontSize: 30, color: "#f4f5f7", outlineWidth: 0, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, align: "left", letterSpacing: 0, lineHeight: 1.5 },
    quote: { fontFamily: "Palatino Linotype", fontWeight: "normal", fontSize: 50, color: "#fff4dd", outlineWidth: 0, shadowColor: "#20180f", shadowBlur: 3, shadowOffsetX: 0, shadowOffsetY: 2, align: "center", letterSpacing: 0.3, lineHeight: 1.35 },
    label: { fontFamily: "Arial Black", fontWeight: "bold", fontSize: 26, color: "#ffe08a", outlineWidth: 0, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, align: "left", letterSpacing: 1.5, lineHeight: 1.05 },
    elegant: { fontFamily: "Georgia", fontWeight: "normal", fontSize: 62, color: "#f5e7d5", outlineWidth: 0, shadowColor: "#30201c", shadowBlur: 2, shadowOffsetX: 0, shadowOffsetY: 2, align: "center", letterSpacing: 0.8, lineHeight: 1.15 },
    comic: { fontFamily: "Impact", fontWeight: "bold", color: "#fff200", outlineColor: "#171717", outlineWidth: 5, shadowColor: "#171717", shadowBlur: 0, shadowOffsetX: 5, shadowOffsetY: 6, letterSpacing: 0.5, lineHeight: 0.95 },
    poster: { fontFamily: "Arial Black", fontWeight: "bold", color: "#ffffff", outlineColor: "#101014", outlineWidth: 2, shadowColor: "#000000", shadowBlur: 8, shadowOffsetX: 2, shadowOffsetY: 4, letterSpacing: 0.8, lineHeight: 1.0 },
    manga: { fontFamily: "Georgia", fontWeight: "bold", color: "#111111", outlineColor: "#ffffff", outlineWidth: 0, shadowColor: "#777777", shadowBlur: 1, shadowOffsetX: 1, shadowOffsetY: 2, letterSpacing: 0, lineHeight: 1.1 },
    neon: { fontFamily: "Arial Black", fontWeight: "bold", color: "#ffffff", outlineColor: "#f000c8", outlineWidth: 3, shadowColor: "#00dfff", shadowBlur: 18, shadowOffsetX: 0, shadowOffsetY: 0, letterSpacing: 1.2, lineHeight: 0.95 }
  }[button.dataset.textStylePreset];
  if (presets) {
    updateTextPreview(presets);
    commitTextPreview(button.dataset.textStylePreset + " text style applied");
  }
}));

function extractReusableTextStyle(values) {
 const normalized = normalizeTextLayer(values || {});
 return Object.fromEntries(TEXT_STYLE_FIELDS.map(key => [key, normalized[key]]));
}
function readSavedTextStyles() {
 try {
  const parsed = JSON.parse(localStorage.getItem(SAVED_TEXT_STYLE_KEY) || "[]");
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(item => item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim())
   .slice(0, MAX_SAVED_TEXT_STYLES)
   .map(item => ({ id: item.id.slice(0, 80), name: item.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48), style: extractReusableTextStyle(item.style) }))
   .filter(item => item.name);
 } catch { return []; }
}
function writeSavedTextStyles(styles) {
 try { localStorage.setItem(SAVED_TEXT_STYLE_KEY, JSON.stringify(styles.slice(0, MAX_SAVED_TEXT_STYLES))); return true; }
 catch { setTextStyleStatus("No se pudieron guardar los estilos en este dispositivo. Comprueba el almacenamiento local.", "error"); return false; }
}
function setTextStyleStatus(message, kind = "info") {
 let statusNode = document.querySelector("#saved-text-styles-status");
 if (!statusNode && savedTextStylesContainer?.parentElement) {
  statusNode = document.createElement("p"); statusNode.id = "saved-text-styles-status"; statusNode.className = "saved-text-styles-status"; statusNode.setAttribute("role", "status"); statusNode.setAttribute("aria-live", "polite"); savedTextStylesContainer.after(statusNode);
 }
 if (statusNode) { statusNode.textContent = String(message || ""); statusNode.dataset.kind = kind; }
}
function renderSavedTextStyles() {
 if (!savedTextStylesContainer) return;
 savedTextStylesContainer.replaceChildren();
 const styles = readSavedTextStyles();
 if (!styles.length) {
  const empty = document.createElement("p"); empty.className = "saved-text-styles-empty"; empty.textContent = "Tus estilos guardados aparecerán aquí. Se conservan en este dispositivo."; savedTextStylesContainer.append(empty); return;
 }
 for (const preset of styles) {
  const card = document.createElement("div"); card.className = "saved-text-style-card";
  const apply = document.createElement("button"); apply.type = "button"; apply.className = "saved-text-style-apply"; apply.dataset.savedTextStyleApply = preset.id; apply.textContent = preset.name;
  const detail = document.createElement("small"); detail.textContent = preset.style.fontFamily + " · " + preset.style.fontSize + " px · " + preset.style.letterSpacing + " px";
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "saved-text-style-remove"; remove.dataset.savedTextStyleRemove = preset.id; remove.textContent = "Quitar"; remove.setAttribute("aria-label", "Eliminar estilo " + preset.name);
  card.append(apply, detail, remove); savedTextStylesContainer.append(card);
 }
}
function saveSelectedTextStyle() {
 const layer = selectedLayerExact();
 if (!layer || layer.contentType !== "text" || layer.locked) { setTextStyleStatus("Selecciona una capa de texto desbloqueada para guardar su estilo.", "error"); return; }
 const nameInput = window.prompt("Nombre para este estilo reutilizable:", "Mi estilo");
 if (nameInput === null) return;
 const name = String(nameInput).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48);
 if (!name) { setTextStyleStatus("Escribe un nombre para guardar el estilo.", "error"); return; }
 const styles = readSavedTextStyles();
 if (styles.length >= MAX_SAVED_TEXT_STYLES) { setTextStyleStatus("Llegaste al máximo de 20 estilos. Elimina uno antes de guardar otro.", "error"); return; }
 if (styles.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()) && !window.confirm("Ya existe un estilo con ese nombre. ¿Guardar otra copia con el mismo nombre?")) return;
 styles.unshift({ id: createId(), name, style: extractReusableTextStyle(getWorkingLayerText(layer)) });
 if (writeSavedTextStyles(styles)) { renderSavedTextStyles(); setTextStyleStatus("Estilo guardado: " + name, "success"); }
}
function handleSavedTextStyleClick(event) {
 const button = event.target.closest("button[data-saved-text-style-apply],button[data-saved-text-style-remove]");
 if (!button) return;
 const styles = readSavedTextStyles();
 if (button.dataset.savedTextStyleApply) {
  const item = styles.find(style => style.id === button.dataset.savedTextStyleApply);
  const layer = selectedLayerExact();
  if (!item) { setTextStyleStatus("Ese estilo ya no existe.", "error"); renderSavedTextStyles(); return; }
  if (!layer || layer.contentType !== "text" || layer.locked) { setTextStyleStatus("Selecciona una capa de texto desbloqueada.", "error"); return; }
  updateTextPreview(item.style); commitTextPreview("Saved text style applied"); setTextStyleStatus("Estilo aplicado: " + item.name, "success"); return;
 }
 const id = button.dataset.savedTextStyleRemove;
 const item = styles.find(style => style.id === id);
 if (!item || !window.confirm("¿Eliminar el estilo guardado «" + item.name + "»?")) return;
 if (writeSavedTextStyles(styles.filter(style => style.id !== id))) { renderSavedTextStyles(); setTextStyleStatus("Estilo eliminado.", "success"); }
}
saveTextStyleButton?.addEventListener("click", saveSelectedTextStyle);
savedTextStylesContainer?.addEventListener("click", handleSavedTextStyleClick);

function renderImageMask(){if(!imageMaskPanel||!imageMaskInput)return;const layer=selectedLayerExact(),isImage=layer?.contentType==="image"&&Boolean(layer.image);imageMaskPanel.hidden=!isImage;imageMaskInput.disabled=!isImage||layer.locked;imageMaskInput.value=isImage?(layer.image.mask||"none"):"none";}
imageMaskInput.addEventListener("change",()=>{const layer=selectedLayerExact();if(!layer||layer.contentType!=="image"||!layer.image||layer.locked)return;const before=cloneDocument(state.document),next=setImageMask(state.document,layer.id,imageMaskInput.value);if(!next)return;state.document=next;state.history.record(before,next);refreshDocument("Image mask updated");persistDocument();});


const SHAPE_MAKER_KINDS = new Set(["rectangle","rounded","circle","ellipse","star","heart","hexagon","pentagon","octagon","diamond","trapezoid","parallelogram","cross","arrow","chevron","triangle","speech","lightning","cloud"]);
const shapeFieldIds = ["shape-maker-kind","shape-maker-width","shape-maker-height","shape-maker-fill","shape-maker-stroke","shape-maker-stroke-width","shape-maker-shadow-color","shape-maker-shadow-blur","shape-maker-shadow-x","shape-maker-shadow-y"];
const shapeLabels = {rectangle:"Rectángulo",rounded:"Rectángulo redondeado",circle:"Círculo",ellipse:"Óvalo",star:"Estrella",heart:"Corazón",hexagon:"Hexágono",pentagon:"Pentágono",octagon:"Octágono",diamond:"Rombo",trapezoid:"Trapecio",parallelogram:"Paralelogramo",cross:"Cruz",arrow:"Flecha",chevron:"Chevron",triangle:"Triángulo",speech:"Globo de diálogo",lightning:"Rayo",cloud:"Nube"};
function shapeMakerValues() {
  const number = (id, fallback, min, max) => Math.max(min, Math.min(max, Math.round(Number(document.querySelector("#"+id).value) || fallback)));
  return {
    kind: SHAPE_MAKER_KINDS.has(document.querySelector("#shape-maker-kind").value) ? document.querySelector("#shape-maker-kind").value : "rectangle",
    width: number("shape-maker-width",320,80,1600),
    height: number("shape-maker-height",240,80,1600),
    fill: /^#[0-9a-f]{6}$/i.test(document.querySelector("#shape-maker-fill").value) ? document.querySelector("#shape-maker-fill").value : "#ff4fd8",
    stroke: /^#[0-9a-f]{6}$/i.test(document.querySelector("#shape-maker-stroke").value) ? document.querySelector("#shape-maker-stroke").value : "#ffffff",
    strokeWidth: number("shape-maker-stroke-width",4,0,32),
    shadowColor: /^#[0-9a-f]{6}$/i.test(document.querySelector("#shape-maker-shadow-color").value) ? document.querySelector("#shape-maker-shadow-color").value : "#171324",
    shadowBlur: number("shape-maker-shadow-blur",12,0,48),
    shadowX: number("shape-maker-shadow-x",3,-40,40),
    shadowY: number("shape-maker-shadow-y",5,-40,40)
  };
}
function setShapeMakerValues(values = {}) {
  const v = {kind:"rectangle",width:320,height:240,fill:"#ff4fd8",stroke:"#ffffff",strokeWidth:4,shadowColor:"#171324",shadowBlur:12,shadowX:3,shadowY:5,...values};
  document.querySelector("#shape-maker-kind").value = SHAPE_MAKER_KINDS.has(v.kind) ? v.kind : "rectangle";
  for (const key of ["width","height","fill","stroke"]) document.querySelector("#shape-maker-"+key).value = String(v[key]);
  document.querySelector("#shape-maker-stroke-width").value = String(v.strokeWidth);
  document.querySelector("#shape-maker-shadow-color").value = String(v.shadowColor);
  document.querySelector("#shape-maker-shadow-blur").value = String(v.shadowBlur);
  document.querySelector("#shape-maker-shadow-x").value = String(v.shadowX);
  document.querySelector("#shape-maker-shadow-y").value = String(v.shadowY);
  syncShapeMakerOutputs();
}
function syncShapeMakerOutputs() {
  for (const [id,suffix] of [["shape-maker-stroke-width"," px"],["shape-maker-shadow-blur"," px"],["shape-maker-shadow-x"," px"],["shape-maker-shadow-y"," px"]]) {
    const output = document.querySelector("#"+id+"-value");
    if (output) output.textContent = document.querySelector("#"+id).value+suffix;
  }
}
function shapeSvgSource(values) {
  const {kind,width,height,fill,stroke,strokeWidth,shadowColor,shadowBlur,shadowX,shadowY}=values;
  const inset=Math.min(Math.floor(Math.min(width,height)*.16),Math.max(5,Math.ceil(strokeWidth/2+2)));
  const left=inset,top=inset,innerWidth=Math.max(1,width-inset*2),innerHeight=Math.max(1,height-inset*2);
  const right=left+innerWidth,bottom=top+innerHeight,cx=width/2,cy=height/2;
  const polygon=points=>points.map(p=>p.map(n=>Number(n.toFixed(2))).join(",")).join(" ");
  let geometry="";
  if(kind==="rectangle") geometry=`<rect x="${left}" y="${top}" width="${innerWidth}" height="${innerHeight}" />`;
  else if(kind==="rounded") geometry=`<rect x="${left}" y="${top}" width="${innerWidth}" height="${innerHeight}" rx="${Math.min(innerWidth,innerHeight)*.16}" />`;
  else if(kind==="circle"||kind==="ellipse") geometry=`<ellipse cx="${cx}" cy="${cy}" rx="${innerWidth/2}" ry="${innerHeight/2}" />`;
  else if(kind==="star") {
    const points=[]; for(let i=0;i<10;i++){const radius=Math.min(innerWidth,innerHeight)/2*(i%2===0?1:.43);const angle=-Math.PI/2+i*Math.PI/5;points.push([cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius]);}
    geometry=`<polygon points="${polygon(points)}" />`;
  } else if(kind==="heart") {
    geometry=`<path d="M ${cx} ${bottom-2} C ${cx-innerWidth*.12} ${top+innerHeight*.68}, ${left} ${top+innerHeight*.48}, ${left+innerWidth*.07} ${top+innerHeight*.27} C ${left+innerWidth*.13} ${top+innerHeight*.02}, ${cx-innerWidth*.12} ${top}, ${cx} ${top+innerHeight*.23} C ${cx+innerWidth*.12} ${top}, ${right-innerWidth*.13} ${top+innerHeight*.02}, ${right-innerWidth*.07} ${top+innerHeight*.27} C ${right} ${top+innerHeight*.48}, ${cx+innerWidth*.12} ${top+innerHeight*.68}, ${cx} ${bottom-2} Z" />`;
  } else if(kind==="hexagon") {
    geometry=`<polygon points="${polygon([[left+innerWidth*.25,top],[right-innerWidth*.25,top],[right,top+innerHeight*.5],[right-innerWidth*.25,bottom],[left+innerWidth*.25,bottom],[left,top+innerHeight*.5]])}" />`;
  } else if(kind==="diamond") {
    geometry=`<polygon points="${polygon([[cx,top],[right,cy],[cx,bottom],[left,cy]])}" />`;
  } else if(kind==="pentagon"||kind==="octagon") {
    const sides=kind==="pentagon"?5:8,points=[];
    for(let i=0;i<sides;i++){const angle=-Math.PI/2+i*Math.PI*2/sides;points.push([cx+Math.cos(angle)*innerWidth/2,cy+Math.sin(angle)*innerHeight/2]);}
    geometry=`<polygon points="${polygon(points)}" />`;
  } else if(kind==="trapezoid") {
    geometry=`<polygon points="${polygon([[left+innerWidth*.2,top],[right-innerWidth*.2,top],[right,bottom],[left,bottom]])}" />`;
  } else if(kind==="parallelogram") {
    geometry=`<polygon points="${polygon([[left+innerWidth*.18,top],[right,top],[right-innerWidth*.18,bottom],[left,bottom]])}" />`;
  } else if(kind==="cross") {
    geometry=`<polygon points="${polygon([[cx-innerWidth*.16,top],[cx+innerWidth*.16,top],[cx+innerWidth*.16,cy-innerHeight*.16],[right,cy-innerHeight*.16],[right,cy+innerHeight*.16],[cx+innerWidth*.16,cy+innerHeight*.16],[cx+innerWidth*.16,bottom],[cx-innerWidth*.16,bottom],[cx-innerWidth*.16,cy+innerHeight*.16],[left,cy+innerHeight*.16],[left,cy-innerHeight*.16],[cx-innerWidth*.16,cy-innerHeight*.16]])}" />`;
  } else if(kind==="arrow") {
    geometry=`<polygon points="${polygon([[left,cy-innerHeight*.18],[left+innerWidth*.58,cy-innerHeight*.18],[left+innerWidth*.58,top],[right,bottom===top?top:cy],[left+innerWidth*.58,bottom],[left+innerWidth*.58,cy+innerHeight*.18],[left,cy+innerHeight*.18]])}" />`;
  } else if(kind==="chevron") {
    geometry=`<polygon points="${polygon([[left,top],[left+innerWidth*.3,top],[right,cy],[left+innerWidth*.3,bottom],[left,bottom],[left+innerWidth*.68,cy]])}" />`;
  } else if(kind==="triangle") {
    geometry=`<polygon points="${polygon([[cx,top],[right,bottom],[left,bottom]])}" />`;
  } else if(kind==="speech") {
    const tail=Math.min(innerHeight*.22,innerWidth*.18),radius=Math.min(24,innerWidth*.12,innerHeight*.12);
    geometry=`<path d="M ${left+radius} ${top} H ${right-radius} Q ${right} ${top} ${right} ${top+radius} V ${bottom-tail-radius} Q ${right} ${bottom-tail} ${right-radius} ${bottom-tail} H ${left+innerWidth*.38} L ${left+innerWidth*.22} ${bottom} L ${left+innerWidth*.2} ${bottom-tail} H ${left+radius} Q ${left} ${bottom-tail} ${left} ${bottom-tail-radius} V ${top+radius} Q ${left} ${top} ${left+radius} ${top} Z" />`;
  } else if(kind==="lightning") {
    geometry=`<polygon points="${polygon([[left+innerWidth*.56,top],[left+innerWidth*.19,top+innerHeight*.54],[left+innerWidth*.45,top+innerHeight*.54],[left+innerWidth*.35,bottom],[right-innerWidth*.1,top+innerHeight*.39],[left+innerWidth*.61,top+innerHeight*.39]])}" />`;
  } else {
    geometry=`<path d="M ${left+innerWidth*.18} ${bottom} C ${left-innerWidth*.05} ${bottom} ${left-innerWidth*.02} ${top+innerHeight*.6} ${left+innerWidth*.17} ${top+innerHeight*.55} C ${left+innerWidth*.1} ${top+innerHeight*.2} ${left+innerWidth*.42} ${top-innerHeight*.04} ${cx} ${top+innerHeight*.28} C ${right-innerWidth*.05} ${top+innerHeight*.12} ${right+innerWidth*.06} ${top+innerHeight*.48} ${right-innerWidth*.82} ${top+innerHeight*.59} C ${right+innerWidth*.05} ${bottom-innerHeight*.03} ${right-innerWidth*.1} ${bottom} ${right-innerWidth*.18} ${bottom} Z" />`;
  }
  const shadowFilter=`<filter id="aa-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="${shadowX}" dy="${shadowY}" stdDeviation="${shadowBlur/2}" flood-color="${shadowColor}" flood-opacity=".68"/></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-aa-shape="${kind}" data-aa-fill="${fill}" data-aa-stroke="${stroke}" data-aa-stroke-width="${strokeWidth}" data-aa-shadow-color="${shadowColor}" data-aa-shadow-blur="${shadowBlur}" data-aa-shadow-x="${shadowX}" data-aa-shadow-y="${shadowY}"><defs>${shadowFilter}</defs><g fill="${fill}" stroke="${strokeWidth>0?stroke:"none"}" stroke-width="${strokeWidth}" stroke-linejoin="round" filter="url(#aa-shadow)">${geometry}</g></svg>`;
}
function shapeSourceUrl(values) { return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(shapeSvgSource(values)); }
function readShapeMetadata(source) {
  if(typeof source!=="string"||!source.startsWith("data:image/svg+xml")) return null;
  try {
    const comma=source.indexOf(",");
    const svg=decodeURIComponent(source.slice(comma+1));
    const get=name=>svg.match(new RegExp(name+'="([^"]*)"'))?.[1] ?? null;
    const kind=get("data-aa-shape");
    if(!kind||!SHAPE_MAKER_KINDS.has(kind))return null;
    const num=(key,fallback)=>{const value=Number(get(key));return Number.isFinite(value)?value:fallback;};
    const colour=(key,fallback)=>/^#[0-9a-f]{6}$/i.test(get(key)||"")?get(key):fallback;
    return {kind,width:num("width",320),height:num("height",240),fill:colour("data-aa-fill","#ff4fd8"),stroke:colour("data-aa-stroke","#ffffff"),strokeWidth:num("data-aa-stroke-width",4),shadowColor:colour("data-aa-shadow-color","#171324"),shadowBlur:num("data-aa-shadow-blur",12),shadowX:num("data-aa-shadow-x",3),shadowY:num("data-aa-shadow-y",5)};
  } catch { return null; }
}
function previewShapeMaker() {
  const values=shapeMakerValues(),source=shapeSourceUrl(values);
  if(shapeMakerPreview)shapeMakerPreview.src=source;
  const description=document.querySelector("#shape-maker-description");
  if(description)description.textContent=shapeEditingLayerId?"Actualiza la forma seleccionada; puedes cancelar sin cambiarla.":"Elige una figura, personaliza color, contorno y sombra.";
  syncShapeMakerOutputs();
}
function openShapeMaker(layer = null) {
  shapeEditingLayerId=null;
  let values;
  const meta=layer?.contentType==="image"&&layer.image?readShapeMetadata(layer.image.source):null;
  if(meta) { shapeEditingLayerId=layer.id; values=meta; }
  else {
    const docWidth=Math.max(320,Number(state.document.width)||800),docHeight=Math.max(240,Number(state.document.height)||600);
    values={kind:"rounded",width:Math.min(720,Math.max(160,Math.round(docWidth*.36))),height:Math.min(720,Math.max(140,Math.round(docHeight*.34))),fill:"#ff4fd8",stroke:"#ffffff",strokeWidth:4,shadowColor:"#171324",shadowBlur:12,shadowX:3,shadowY:5};
  }
  setShapeMakerValues(values);
  document.querySelector("#shape-maker-title").textContent=shapeEditingLayerId?"Editar forma":"Añadir forma";
  document.querySelector("#shape-maker-apply").textContent=shapeEditingLayerId?"Aplicar cambios":"Añadir forma";
  document.querySelector("#shape-maker-status").textContent=shapeEditingLayerId?"Los cambios se aplicarán solo al confirmar.":"La forma será una capa separada que podrás mover, redimensionar y ordenar.";
  previewShapeMaker();
  if(window.matchMedia("(max-width: 920px)").matches) {
    document.body.classList.remove("mobile-tools-open","mobile-tools-collapsed","mobile-layers-open");
    mobileDock?.querySelectorAll('[data-touch-action="more"],[data-touch-action="layers"]').forEach(item=>item.setAttribute("aria-expanded","false"));
  }
  if(!shapeMakerDialog.open)shapeMakerDialog.showModal();
}
function selectedShapeMetadata(layer=selectedLayerExact()) {
  return layer?.contentType==="image"&&layer.image?readShapeMetadata(layer.image.source):null;
}
function openSelectedObjectStyle() {
  const layer=selectedLayerExact();
  if(!layer){status.textContent="Seleccioná primero un objeto en el lienzo o en Capas.";return;}
  if(layer.contentType==="text") {
    openTextEditorForLayer(layer.id);
    return;
  }
  if(selectedShapeMetadata(layer)){openShapeMaker(layer);return;}
  const locked=Boolean(layer.locked),isImage=layer.contentType==="image"&&Boolean(layer.image);
  document.querySelector("#object-style-layer-name").textContent=layer.name+(locked?" · bloqueada":"");
  document.querySelector("#object-style-description").textContent=isImage?"Recorte, opacidad y ajustes de color para esta imagen.":"Color, grosor y efecto de los trazos de esta capa.";
  document.querySelector("#object-style-image-options").hidden=!isImage;
  document.querySelector("#object-style-drawing-options").hidden=isImage;
  document.querySelector("#object-style-opacity").value=String(Math.round(layer.opacity*100));
  document.querySelector("#object-style-opacity-value").textContent=Math.round(layer.opacity*100)+"%";
  document.querySelector("#object-style-opacity").disabled=locked;
  const imageControls=["object-style-mask","object-style-brightness","object-style-contrast","object-style-saturation"];
  imageControls.forEach(id=>{const input=document.querySelector("#"+id);if(input)input.disabled=locked;});
  const adjustments=normalizeLayerAdjustments(layer.adjustments||{});
  document.querySelector("#object-style-mask").value=isImage?(layer.image.mask||"none"):"none";
  for(const key of ["brightness","contrast","saturation"]){const input=document.querySelector("#object-style-"+key);input.value=String(adjustments[key]);document.querySelector("#object-style-"+key+"-value").textContent=adjustments[key]+"%";}
  const visibleStroke=(layer.strokes||[]).find(stroke=>stroke.tool!=="eraser");
  document.querySelector("#object-style-drawing-color").value=visibleStroke?.color||state.brush.color;
  document.querySelector("#object-style-drawing-size").value=String(visibleStroke?.size||state.brush.size);
  document.querySelector("#object-style-drawing-effect").value=visibleStroke?.effect||state.brush.effect;
  for(const id of ["object-style-drawing-color","object-style-drawing-size","object-style-drawing-effect"])document.querySelector("#"+id).disabled=locked;
  document.querySelector("#object-style-drawing-size-value").textContent=(visibleStroke?.size||state.brush.size)+" px";
  document.querySelector("#object-style-apply").disabled=locked;
  document.querySelector("#object-style-recolor").disabled=locked||!isImage;
  document.querySelector("#object-style-status").textContent=locked?"Está bloqueado. Desbloquéalo desde Capas para cambiarlo.":"Puedes cancelar sin alterar el objeto.";
  if(window.matchMedia("(max-width: 920px)").matches) {
    document.body.classList.remove("mobile-tools-open","mobile-tools-collapsed","mobile-layers-open");
    mobileDock?.querySelectorAll('[data-touch-action="more"],[data-touch-action="layers"]').forEach(item=>item.setAttribute("aria-expanded","false"));
  }
  if(!objectStyleDialog.open)objectStyleDialog.showModal();
}
for(const id of shapeFieldIds)document.querySelector("#"+id)?.addEventListener("input",previewShapeMaker);
document.querySelector("#shape-maker-close")?.addEventListener("click",()=>shapeMakerDialog.close());
document.querySelector("#shape-maker-cancel")?.addEventListener("click",()=>shapeMakerDialog.close());
shapeMakerDialog?.addEventListener("close",()=>{shapeEditingLayerId=null;});
document.querySelector("#shape-maker-apply")?.addEventListener("click",()=>{
  const values=shapeMakerValues(),source=shapeSourceUrl(values);
  if(source.length>2_000_000){document.querySelector("#shape-maker-status").textContent="La forma excede el límite local. Reduce su tamaño o los efectos.";return;}
  const editingId=shapeEditingLayerId;
  if(editingId) {
    const current=state.document.layers.find(item=>item.id===editingId);
    if(!current||current.locked||current.contentType!=="image"){status.textContent="La capa cambió o está bloqueada; no se aplicaron cambios.";return;}
    const before=cloneDocument(state.document),next=replaceImageLayer(state.document,editingId,{source,width:values.width,height:values.height});
    if(!next){document.querySelector("#shape-maker-status").textContent="No se pudo actualizar la forma. Comprueba su tamaño.";return;}
    imageCache.delete(current.image.source);state.document=next;state.history.record(before,next);setSelection([editingId],editingId);
    refreshDocument("Forma actualizada");persistDocument();shapeMakerDialog.close();return;
  }
  const layer=createImageLayer("Forma · "+(shapeLabels[values.kind]||"Figura"),values.width,values.height,source);
  const before=cloneDocument(state.document),next=addLayer(state.document,layer);
  if(!next){document.querySelector("#shape-maker-status").textContent="No se pudo agregar la forma a este proyecto.";return;}
  state.document=next;state.textPreview=null;setSelection([layer.id],layer.id);state.history.record(before,next);
  refreshDocument("Forma añadida: "+(shapeLabels[values.kind]||"Figura"));persistDocument();shapeMakerDialog.close();
});
document.querySelector("#object-style-close")?.addEventListener("click",()=>objectStyleDialog.close());
document.querySelector("#object-style-cancel")?.addEventListener("click",()=>objectStyleDialog.close());
document.querySelector("#object-style-recolor")?.addEventListener("click",()=>{objectStyleDialog.close();recolorButton?.click();});
document.querySelector("#object-style-opacity")?.addEventListener("input",event=>{document.querySelector("#object-style-opacity-value").textContent=event.currentTarget.value+"%";});
for(const key of ["brightness","contrast","saturation"])document.querySelector("#object-style-"+key)?.addEventListener("input",event=>{document.querySelector("#object-style-"+key+"-value").textContent=event.currentTarget.value+"%";});
document.querySelector("#object-style-drawing-size")?.addEventListener("input",event=>{document.querySelector("#object-style-drawing-size-value").textContent=event.currentTarget.value+" px";});
document.querySelector("#object-style-apply")?.addEventListener("click",()=>{
  const layer=selectedLayerExact();if(!layer||layer.locked)return;
  const before=cloneDocument(state.document);
  let next=setLayerOpacity(state.document,layer.id,Number(document.querySelector("#object-style-opacity").value)/100);
  if(layer.contentType==="image"&&layer.image) {
    next=setImageMask(next,layer.id,document.querySelector("#object-style-mask").value)||next;
    next=setLayerAdjustments(next,layer.id,normalizeLayerAdjustments({...layer.adjustments,brightness:Number(document.querySelector("#object-style-brightness").value),contrast:Number(document.querySelector("#object-style-contrast").value),saturation:Number(document.querySelector("#object-style-saturation").value)}))||next;
  } else if(layer.contentType==="drawing") {
    const draft=cloneDocument(next),target=draft.layers.find(item=>item.id===layer.id);
    const colour=document.querySelector("#object-style-drawing-color").value,size=Number(document.querySelector("#object-style-drawing-size").value),effect=document.querySelector("#object-style-drawing-effect").value;
    target.strokes=target.strokes.map(stroke=>stroke.tool==="eraser"?stroke:{...stroke,color:colour,size,effect});
    next=draft;setBrushColor(colour);setBrushSize(size);setBrushEffect(effect);syncBrushControls();
  }
  state.document=next;state.history.record(before,next);state.dirty=true;refreshDocument("Estilo aplicado: "+layer.name);persistDocument();objectStyleDialog.close();
});
document.querySelector("#selection-mini-style")?.addEventListener("click",openSelectedObjectStyle);
document.querySelector("#selection-mini-edit-text")?.addEventListener("click", () => openTextEditorForLayer());


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
    status.textContent = error?.message || "No se pudo guardar el proyecto localmente";
    return false;
  }
  state.dirty = !markSaved;
  if (markSaved) setStorageRecoveryPending(false);
  if (activeMultiPageSession && !state.storageRecoveryPending) void queueActiveMultiPagePageSave();
  status.textContent = markSaved ? "Guardado localmente" : "Copia local actualizada";
  return true;
}

function refreshHistoryControls() {
  const canUndo = state.history.canUndo();
  const canRedo = state.history.canRedo();
  undoButton.disabled = !canUndo;
  redoButton.disabled = !canRedo;
  if (mobileTopUndoButton) mobileTopUndoButton.disabled = !canUndo;
  if (mobileTopRedoButton) mobileTopRedoButton.disabled = !canRedo;
  if (mobileUndoButton) mobileUndoButton.disabled = !canUndo;
  if (mobileRedoButton) mobileRedoButton.disabled = !canRedo;
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

function removeSelectedImage() {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image) {
    status.textContent = "Primero tocá la imagen que querés quitar";
    return false;
  }
  if (layer.locked) {
    status.textContent = "Desbloqueá la imagen antes de quitarla";
    return false;
  }

  const before = cloneDocument(state.document);
  let sourceDocument = state.document;
  if (sourceDocument.layers.length <= 1) {
    const placeholder = createLayer("Capa vacía");
    sourceDocument = addLayer(sourceDocument, placeholder);
    if (!sourceDocument) {
      status.textContent = "No se pudo preparar el lienzo para quitar la imagen";
      return false;
    }
  }
  const next = deleteLayer(sourceDocument, layer.id);
  if (!next) {
    status.textContent = "No se pudo quitar la imagen seleccionada";
    return false;
  }
  state.document = next;
  const nextSelection = [...next.layers].reverse().find(item => item.contentType === "image") || next.layers.at(-1) || null;
  setSelection(nextSelection ? [nextSelection.id] : [], nextSelection?.id || null);
  state.history.record(before, next);
  refreshDocument("Imagen quitada: " + layer.name + ". Podés deshacer.");
  persistDocument();
  return true;
}

function removeSelectedLayer() {
  const layer = selectedLayerExact();
  if (!layer) {
    status.textContent = "Primero seleccioná un elemento para eliminarlo.";
    return false;
  }
  if (layer.locked) {
    status.textContent = "Desbloqueá el elemento antes de eliminarlo.";
    return false;
  }
  const before = cloneDocument(state.document);
  let sourceDocument = state.document;
  if (sourceDocument.layers.length <= 1) {
    sourceDocument = addLayer(sourceDocument, createLayer("Capa vacía"));
    if (!sourceDocument) {
      status.textContent = "No se pudo preparar el lienzo para eliminar el elemento.";
      return false;
    }
  }
  const next = deleteLayer(sourceDocument, layer.id);
  if (!next) {
    status.textContent = "No se pudo eliminar el elemento seleccionado.";
    return false;
  }
  if (state.textPreview?.layerId === layer.id) state.textPreview = null;
  state.document = next;
  const nextSelection = [...next.layers].reverse().find(item => item.contentType === "image") || next.layers.at(-1) || null;
  setSelection(nextSelection ? [nextSelection.id] : [], nextSelection?.id || null);
  state.history.record(before, next);
  refreshDocument((layer.contentType === "text" ? "Texto eliminado: " : "Elemento eliminado: ") + layer.name + ". Podés deshacer.");
  persistDocument();
  return true;
}

function constrainMoveDelta(layers, deltaX, deltaY) {
  if (frameBoundaryMode !== "inside") return { x: deltaX, y: deltaY };
  return constrainTranslationToDocument(
    layers,
    documentCenter(state.document),
    { width: state.document.width, height: state.document.height },
    deltaX,
    deltaY
  );
}

function interactionLayers(interaction) {
  const ids = Array.isArray(interaction?.layerIds) ? interaction.layerIds : state.selectedLayerIds;
  const byId = new Map(state.document.layers.map(layer => [layer.id, layer]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

function snapMoveDelta(layers, desiredX, desiredY) {
  const constrained = constrainMoveDelta(layers, desiredX, desiredY);
  if (!state.magneticSnappingEnabled) { state.snapGuides = []; return constrained; }
  const bounds = layers.map(layer => getLayerAlignmentBounds(layer, state.document)).filter(Boolean);
  if (!bounds.length) { state.snapGuides = []; return constrained; }
  const movingBounds = {
    left: Math.min(...bounds.map(item => item.left)) + constrained.x,
    right: Math.max(...bounds.map(item => item.right)) + constrained.x,
    top: Math.min(...bounds.map(item => item.top)) + constrained.y,
    bottom: Math.max(...bounds.map(item => item.bottom)) + constrained.y
  };
  const movingIds = new Set(layers.map(layer => layer.id));
  const otherBounds = state.document.layers
    .filter(layer => layer.visible && !layer.locked && !movingIds.has(layer.id))
    .map(layer => ({ id: layer.id, bounds: getLayerAlignmentBounds(layer, state.document) }))
    .filter(item => item.bounds);
  const screenScale = Math.max(Number.EPSILON, documentFitScale(state.document, canvasSize()) * state.viewport.zoom);
  const snap = getSmartSnapAdjustment({
    movingBounds, otherBounds,
    canvasWidth: state.document.width, canvasHeight: state.document.height,
    threshold: 8 / screenScale
  });
  const adjusted = constrainMoveDelta(layers, constrained.x + snap.dx, constrained.y + snap.dy);
  state.snapGuides = snap.guides.length && Math.abs(adjusted.x - constrained.x - snap.dx) < 0.001 &&
    Math.abs(adjusted.y - constrained.y - snap.dy) < 0.001 ? snap.guides : [];
  return adjusted;
}

function applyMultiLayerMove(deltaX, deltaY, message = "Layers moved", layerIds = state.selectedLayerIds) {

  const ids = Array.isArray(layerIds) ? [...new Set(layerIds)] : [];
  const layers = interactionLayers({ layerIds: ids });
  if (ids.length < 2 || layers.length !== ids.length || layers.some(layer => layer.locked)) return false;
  const before = cloneDocument(state.document);
  const next = translateLayers(state.document, ids, deltaX, deltaY);
  if (!next) return false;
  state.document = next;
  state.history.record(before, next);
  refreshDocument(message);
  persistDocument();
  return true;
}

function beginTransformInteraction(type, event, handle = null, handleOffset = null) {
  const layer = selectedLayerExact();
  if (!layer || layer.locked) return false;
  const screenPoint = screenPointFromEvent(event);
  const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
  state.transformPointerId = event.pointerId;
  state.transformInteraction = {
    type,
    handle,
    handleOffset: handleOffset && Number.isFinite(handleOffset.x) && Number.isFinite(handleOffset.y)
      ? { x: handleOffset.x, y: handleOffset.y } : { x: 0, y: 0 },
    pointerId: event.pointerId,
    dragThreshold: event.pointerType === "touch" ? (layer.contentType === "text" ? 8 : 4) : 2,
    layerId: layer.id,
    startScreen: { ...screenPoint },
    startClient: { x: event.clientX, y: event.clientY },
    screenScaleAtStart: Math.max(Number.EPSILON, documentFitScale(state.document, canvasSize()) * state.viewport.zoom),
    startDocument: documentPoint,
    beforeTransform: { ...layer.transform },
    previewTransform: { ...layer.transform },
    pivot: documentCenter(state.document)
  };
  canvas.setPointerCapture(event.pointerId);
  return true;
}

function finishTransformInteraction(cancelled = false, finalEvent = null) {
  const interaction = state.transformInteraction;
  if (!interaction) return;
  const pointerId = interaction.pointerId;
  state.transformInteraction = null;
  state.transformPointerId = null;
  state.snapGuides = [];
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
  // On touch screens a tap edits text; a deliberate drag moves it. This
  // avoids making users find a tiny secondary edit button on the phone.
  if (!cancelled && finalEvent?.pointerType === "touch" &&
      interaction.type === "move" && layer.contentType === "text" &&
      interaction.startScreen) {
    const clientDeltaX = Number(finalEvent.clientX) - interaction.startClient.x;
    const clientDeltaY = Number(finalEvent.clientY) - interaction.startClient.y;
    if (Math.hypot(clientDeltaX, clientDeltaY) <= 8) {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      redraw();
      openTextEditorForLayer(layer.id);
      return;
    }
  }
  // A stationary tap selects the object only. Changes in the canvas bounding box
  // must never manufacture a move or a history entry.
  // Finger contact is noisy on mobile. Ignore tiny involuntary shifts on a tap,
  // but keep deliberate drags responsive once they pass a comfortable threshold.
  if (finalEvent && interaction.type === "move" && interaction.startClient &&
      Math.hypot(Number(finalEvent.clientX) - interaction.startClient.x,
        Number(finalEvent.clientY) - interaction.startClient.y) <= (interaction.dragThreshold ?? 3)) {
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
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
  if (interaction.type === "move" && interaction.startClient) {
    const travelled = Math.hypot(
      Number(event.clientX) - interaction.startClient.x,
      Number(event.clientY) - interaction.startClient.y
    );
    if (travelled < (interaction.dragThreshold ?? 3)) {
      interaction.previewTransform = { ...interaction.beforeTransform };
      redraw();
      return;
    }
  }
  const currentScreen = screenPointFromEvent(event);
  const targetOffset = interaction.type === "scale" ? interaction.handleOffset : null;
  const targetScreen = targetOffset
    ? { x: currentScreen.x + targetOffset.x, y: currentScreen.y + targetOffset.y }
    : currentScreen;
  // Translate from the pointer's original client coordinates and the original CSS
  // scale. Using a newly measured canvas rect here makes a stationary finger look
  // like a large drag whenever mobile layout/selection controls reflow the canvas.
  const currentDocument = interaction.type === "move" && interaction.startClient &&
    Number.isFinite(interaction.screenScaleAtStart) && interaction.screenScaleAtStart > 0
    ? {
        x: interaction.startDocument.x + (Number(event.clientX) - interaction.startClient.x) / interaction.screenScaleAtStart,
        y: interaction.startDocument.y + (Number(event.clientY) - interaction.startClient.y) / interaction.screenScaleAtStart
      }
    : screenToDocumentPoint(targetScreen, state.document, state.viewport, canvasSize());
  const pivot = interaction.pivot;
  const preview = { ...interaction.previewTransform };
  if (interaction.type === "move") {
    const desiredX = currentDocument.x - interaction.startDocument.x;
    const desiredY = currentDocument.y - interaction.startDocument.y;
    const layer = state.document.layers.find(item => item.id === interaction.layerId);
    const delta = snapMoveDelta(layer ? [layer] : [], desiredX, desiredY);
    preview.x = interaction.beforeTransform.x + delta.x;
    preview.y = interaction.beforeTransform.y + delta.y;
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

function closeSelectionBox() {
  setSelection([], null);
  const message = "Selección cerrada. El elemento sigue en el lienzo.";
  if (window.matchMedia("(max-width: 920px)").matches) showMobileFeedback(message);
  else status.textContent = message;
  redraw();
}

function beginSelectionInteraction(event) {
  const screenPoint = screenPointFromEvent(event);
  const selected = selectedLayerExact();
  const rawSelectedGeometry = selected ? selectionGeometry(selected, screenViewportForDocument(state.document, state.viewport, canvasSize()), documentCenter(state.document)) : null;
  const selectedGeometry = clampSelectionHandles(rawSelectedGeometry, canvasSize(), selectionHandleInset());
  const selectedHit = hitTestHandle(screenPoint, selectedGeometry, HANDLE_RADIUS);
  if (window.__ANIMEART_E2E_DIAGNOSTICS__) {
    window.__ANIMEART_LAST_SELECTION_POINTER__ = {
      point: screenPoint,
      hit: selectedHit,
      layerId: selected?.id || null,
      selectedLayerIds: [...state.selectedLayerIds],
      rotationHandle: selectedGeometry?.rotationHandle || null,
      closeHandle: selectedGeometry?.closeHandle || null,
      resizeHandle: selectedGeometry?.resizeHandle || null
    };
  }
  // In multi-selection, prefer the group bounds before interpreting the anchor layer's X.
  // Otherwise a group-interior drag can overlap the active layer's own close handle.
  if (selectedHit === "close" && state.selectedLayerIds.length <= 1) {
    // On mobile the canvas X is the primary image-removal control, not a selection dismiss button.
    if (selected?.contentType === "image") removeSelectedImage();
    else closeSelectionBox();
    return;
  }
  if (state.selectedLayerIds.length > 1) {
    const layers = selectedLayersExact();
    const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
    const groupDocumentGeometry = multiSelectionGeometry(layers, documentCenter(state.document));
    const groupScreenGeometry = groupDocumentGeometry ? clampSelectionHandles({
      ...groupDocumentGeometry,
      corners: groupDocumentGeometry.corners.map(point => documentToScreenPoint(point, state.document, state.viewport, canvasSize())),
      center: documentToScreenPoint(groupDocumentGeometry.center, state.document, state.viewport, canvasSize()),
      closeHandle: documentToScreenPoint(groupDocumentGeometry.corners[1], state.document, state.viewport, canvasSize()),
      resizeHandle: documentToScreenPoint(groupDocumentGeometry.corners[2], state.document, state.viewport, canvasSize())
    }, canvasSize(), selectionHandleInset()) : null;
    if (groupScreenGeometry) {
      const groupHit = hitTestHandle(screenPoint, groupScreenGeometry, HANDLE_RADIUS);
      if (window.__ANIMEART_E2E_DIAGNOSTICS__) console.error("AA_MULTI_POINTERDOWN", JSON.stringify({screenPoint, groupHit, pointerId: event.pointerId, selectedIds: layers.map(layer => layer.id), corners: groupScreenGeometry.corners}));
      if (groupHit === "close") {
        closeSelectionBox();
        return;
      }
      // A hit inside the group bounds is itself a valid drag target. Do not
      // depend on a second per-layer hit test, which can miss edge pixels.
      if (groupHit === "move") {
        if (layers.some(layer => layer.locked)) return;
        state.multiTransformInteraction = {
          pointerId: event.pointerId,
          type: "move",
          layerIds: layers.map(layer => layer.id),
          startDocument: documentPoint,
          startClient: { x: event.clientX, y: event.clientY },
          screenScaleAtStart: Math.max(Number.EPSILON, documentFitScale(state.document, canvasSize()) * state.viewport.zoom),
          previewDelta: { x: 0, y: 0 }
        };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (groupHit === "scale-nw" || groupHit === "scale-ne" || groupHit === "scale-se" || groupHit === "scale-sw") {
        if (layers.some(layer => layer.locked)) return;
        state.multiTransformInteraction = { pointerId: event.pointerId, type: "scale", handle: groupHit, handleOffset: groupScreenGeometry.resizeHandleOffset, startDocument: documentPoint, layerIds: layers.map(layer => layer.id), previewTransforms: new Map(layers.map(layer => [layer.id, { ...layer.transform }])) };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (groupHit === "rotate") {
        if (layers.some(layer => layer.locked)) return;
        state.multiTransformInteraction = { pointerId: event.pointerId, type: "rotate", startDocument: documentPoint, layerIds: layers.map(layer => layer.id), previewTransforms: new Map(layers.map(layer => [layer.id, { ...layer.transform }])) };
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
        layerIds: layers.map(layer => layer.id),
        startDocument: documentPoint,
        startClient: { x: event.clientX, y: event.clientY },
        screenScaleAtStart: Math.max(Number.EPSILON, documentFitScale(state.document, canvasSize()) * state.viewport.zoom),
        previewDelta: { x: 0, y: 0 }
      };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }
  if (selectedHit === "move" && state.selectedLayerIds.length === 1) {
    return beginTransformInteraction("move", event);
  }
  if (selectedHit?.startsWith("scale-")) return beginTransformInteraction("scale", event, selectedHit, selectedGeometry?.resizeHandleOffset);
  if (selectedHit === "rotate") return beginTransformInteraction("rotate", event);
  const documentPoint = screenToDocumentPoint(screenPoint, state.document, state.viewport, canvasSize());
  // When objects overlap, keep the current selection as the drag target.
  // Otherwise a sticker placed over a character can steal every touch intended
  // to nudge the sticker underneath. The layer list remains the explicit way
  // to switch to another overlapping object.
  const currentSelectedLayer = selectedLayerExact();
  if (!event.shiftKey && currentSelectedLayer?.visible && !currentSelectedLayer.locked &&
      hitTestLayer(currentSelectedLayer, documentPoint, documentCenter(state.document))) {
    return beginTransformInteraction("move", event);
  }
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

function beginTouchGesture() {
  const points = [...activeTouchPointers.values()].slice(0, 2);
  if (points.length < 2) return false;
  const first = points[0];
  const second = points[1];
  const startDistance = distanceBetweenTouches(first, second);
  if (startDistance < 1) return false;

  state.magicEraseInteraction = null;
  if (state.drawing && state.strokeBefore) state.document = state.strokeBefore;
  state.drawing = false;
  state.drawingPointerId = null;
  state.strokeBefore = null;
  state.activeMirrorStroke = null;
  state.panning = false;
  state.panPointerId = null;
  state.lastPanPoint = null;
  if (state.transformInteraction) finishTransformInteraction(true);
  state.multiTransformInteraction = null;

  touchGesture = {
    pointerIds: [first.pointerId, second.pointerId],
    startDistance,
    startMidpoint: midpointBetweenTouches(first, second),
    startViewport: { ...state.viewport }
  };
  for (const point of points) {
    try { canvas.setPointerCapture(point.pointerId); } catch {}
  }
  redraw();
  status.textContent = "Two-finger gesture: move to pan, pinch to zoom";
  return true;
}

function updateTouchGesture() {
  if (!touchGesture) return false;
  const first = activeTouchPointers.get(touchGesture.pointerIds[0]);
  const second = activeTouchPointers.get(touchGesture.pointerIds[1]);
  if (!first || !second) return false;
  const currentDistance = distanceBetweenTouches(first, second);
  const currentMidpoint = midpointBetweenTouches(first, second);
  state.viewport = updatePinchPanViewport({
    startViewport: touchGesture.startViewport,
    startDistance: touchGesture.startDistance,
    currentDistance,
    startMidpoint: touchGesture.startMidpoint,
    currentMidpoint,
    documentModel: state.document,
    viewportSize: canvasSize(),
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM
  });
  redraw();
  status.textContent = "Touch zoom " + Math.round(state.viewport.zoom * 100) + "%";
  return true;
}

function endTouchPointer(event) {
  if (event.pointerType !== "touch") return false;
  activeTouchPointers.delete(event.pointerId);
  if (touchGesture) {
    // When a pinch becomes a one-finger gesture, continue from the remaining
    // finger's current position as a canvas pan. Never reuse the old pinch
    // midpoint or object-drag origin, which would cause a visible jump.
    const remaining = activeTouchPointers.values().next().value || null;
    touchGesture = null;
    state.drawing = false;
    state.drawingPointerId = null;
    state.strokeBefore = null;
    state.transformInteraction = null;
    state.transformPointerId = null;
    state.multiTransformInteraction = null;
    state.panning = Boolean(remaining);
    state.panPointerId = remaining?.pointerId ?? null;
    state.lastPanPoint = remaining ? { x: remaining.x, y: remaining.y } : null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
    return true;
  }
  return false;
}


function imageErasePoint(event, layer) {
  const documentPoint = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
  const local = inverseTransformPoint(documentPoint, layer.transform, documentCenter(state.document));
  return {
    x: Math.max(0, Math.min(layer.image.width, layer.image.flipX ? layer.image.width - local.x : local.x)),
    y: Math.max(0, Math.min(layer.image.height, layer.image.flipY ? layer.image.height - local.y : local.y))
  };
}


let pendingMagicErase = null;

function drawMagicPreview(canvasElement, source) {
  if (!canvasElement || !source) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 520, maxHeight = 380;
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      canvasElement.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvasElement.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvasElement.getContext("2d");
      if (!context) { reject(new Error("No se pudo mostrar la vista previa")); return; }
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      context.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
      resolve();
    };
    image.onerror = () => reject(new Error("No se pudo cargar la vista previa"));
    image.src = source;
  });
}

async function openMagicErasePreview({ layerId, originalSource, resultSource, width, height }) {
  const dialog = document.querySelector("#magic-eraser-preview-dialog");
  const applyButton = document.querySelector("#magic-eraser-apply");
  pendingMagicErase = { layerId, originalSource, resultSource, width, height };
  if (applyButton) {
    applyButton.disabled = false;
    applyButton.textContent = "Aplicar borrado";
  }
  try {
    await Promise.all([
      drawMagicPreview(document.querySelector("#magic-eraser-before-preview"), originalSource),
      drawMagicPreview(document.querySelector("#magic-eraser-after-preview"), resultSource)
    ]);
    if (!dialog) throw new Error("No se encontró la ventana de vista previa del borrado mágico.");
    if (!dialog.open) dialog.showModal();
    status.textContent = "Revisá el resultado y pulsá «Aplicar borrado». La imagen no cambia hasta confirmar.";
  } catch (error) {
    pendingMagicErase = null;
    status.textContent = error?.message || "No se pudo crear la vista previa. La imagen original sigue intacta.";
  }
}

function cancelMagicErasePreview() {
  pendingMagicErase = null;
  const dialog = document.querySelector("#magic-eraser-preview-dialog");
  if (dialog?.open) dialog.close();
  status.textContent = "Borrado mágico cancelado. La imagen original sigue intacta.";
}

async function applyMagicErasePreview() {
  const pending = pendingMagicErase;
  const applyButton = document.querySelector("#magic-eraser-apply");
  if (!pending || applyButton?.disabled) {
    if (!pending) status.textContent = "No hay un borrado pendiente para aplicar. Repetí la selección.";
    return;
  }
  const layer = state.document.layers.find(item => item.id === pending.layerId);
  if (!layer || layer.contentType !== "image" || layer.locked || !layer.image) {
    cancelMagicErasePreview();
    status.textContent = "La capa cambió. Volvé a seleccionar la imagen e intentá otra vez.";
    return;
  }
  if (applyButton) {
    applyButton.disabled = true;
    applyButton.textContent = "Aplicando…";
  }
  try {
    const before = cloneDocument(state.document);
    // Keep the layer's logical dimensions. The optimized preview source can be
    // a few pixels smaller after local compression, and using those rounded
    // dimensions made preserveDisplaySize reject an otherwise valid erase.
    const next = replaceImageLayer(state.document, layer.id, {
      source: pending.resultSource,
      width: Math.round(layer.image.width),
      height: Math.round(layer.image.height),
      restoreSource: layer.image.restoreSource || pending.originalSource
    }, { preserveDisplaySize: true });
    if (!next) {
      status.textContent = "No se pudo aplicar el borrado. La imagen original sigue intacta. Probá de nuevo o usá Deshacer.";
      return;
    }
    imageCache.delete(layer.image.source);
    state.document = next;
    state.history.record(before, next);
    state.dirty = true;
    await persistDocument();
    pendingMagicErase = null;
    const dialog = document.querySelector("#magic-eraser-preview-dialog");
    if (dialog?.open) dialog.close();
    refreshDocument("Borrado mágico aplicado. Deshacer revierte el cambio; Restaurar recupera píxeles del original.");
  } catch (error) {
    status.textContent = error?.message || "No se pudo aplicar el borrado mágico. La imagen original sigue intacta.";
  } finally {
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.textContent = "Aplicar borrado";
    }
  }
}

async function finishMagicErase(interaction) {
  const layer = state.document.layers.find(item => item.id === interaction.layerId);
  if (!layer || layer.contentType !== "image" || layer.locked || !layer.image?.source) return;
  if (layer.image.width * layer.image.height > 16000000) {
    status.textContent = "El borrado mágico admite hasta 16 MP. Reducí la imagen primero.";
    return;
  }
  try {
    const source = layer.image.source;
    let image = imageCache.get(source);
    if (!image || !image.complete || image.naturalWidth < 1) {
      image = await new Promise((resolve, reject) => {
        const candidate = new Image();
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => reject(new Error("No se pudo abrir la imagen para el borrado mágico"));
        candidate.src = source;
        imageCache.set(source, candidate);
      });
    }
    const width = Math.max(1, Math.round(layer.image.width));
    const height = Math.max(1, Math.round(layer.image.height));
    const raster = document.createElement("canvas");
    raster.width = width;
    raster.height = height;
    const context = raster.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("El lienzo de edición no está disponible");
    context.drawImage(image, 0, 0, width, height);
    const original = context.getImageData(0, 0, width, height);
    const x = Math.max(0, Math.min(width - 1, Math.floor(interaction.point.x)));
    const y = Math.max(0, Math.min(height - 1, Math.floor(interaction.point.y)));
    const offset = (y * width + x) * 4;
    if (original.data[offset + 3] < 16) {
      status.textContent = "Ese píxel ya es transparente. Tocá un píxel opaco del fondo.";
      return;
    }
    const targetColor = "#" + [original.data[offset], original.data[offset + 1], original.data[offset + 2]]
      .map(value => value.toString(16).padStart(2, "0")).join("");
    const result = await runImageProcessing("remove-connected-background", original, {
      targetColor, tolerance: Number(document.querySelector("#magic-eraser-tolerance")?.value || 28), feather: 12, edgeSensitivity: 48,
      protectLineArt: true, decontaminate: true, seedPoints: [{ x, y }]
    }, { transferInput: true });
    if (!result.changed) {
      status.textContent = "No se encontró una región conectada de ese color. Probá un píxel cercano o Quitar fondo.";
      return;
    }
    context.putImageData(new ImageData(result.data, width, height), 0, 0);
    const optimized = await optimizeImageSource(raster.toDataURL("image/png"));
    await openMagicErasePreview({
      layerId: layer.id, originalSource: source, resultSource: optimized.source,
      width: optimized.width, height: optimized.height
    });
  } catch (error) {
    status.textContent = error?.message || "Falló el borrado mágico";
  }
}

async function finishImageRestore(interaction) {
  const layer = state.document.layers.find(item => item.id === interaction.layerId);
  if (!layer || layer.contentType !== "image" || layer.locked || !layer.image?.source) return;
  const backupSource = layer.image.restoreSource;
  if (!backupSource) {
    status.textContent = "Esta imagen no tiene una copia original para Restaurar. Usá Deshacer si el borrado fue reciente.";
    return;
  }
  try {
    const loadImage = source => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo abrir la copia original"));
      image.src = source;
    });
    const [currentImage, originalImage] = await Promise.all([loadImage(layer.image.source), loadImage(backupSource)]);
    const width = Math.round(layer.image.width), height = Math.round(layer.image.height);
    if (originalImage.naturalWidth !== width || originalImage.naturalHeight !== height ||
        currentImage.naturalWidth !== width || currentImage.naturalHeight !== height) {
      status.textContent = "La imagen cambió de tamaño después del borrado. Deshacer sigue disponible; la restauración por pincel requiere el tamaño original.";
      return;
    }
    const raster = document.createElement("canvas");
    raster.width = width; raster.height = height;
    const context = raster.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("El lienzo de restauración no está disponible");
    context.drawImage(currentImage, 0, 0);
    const current = context.getImageData(0, 0, width, height);
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = width; originalCanvas.height = height;
    const originalContext = originalCanvas.getContext("2d", { willReadFrequently: true });
    if (!originalContext) throw new Error("La copia original no está disponible");
    originalContext.drawImage(originalImage, 0, 0);
    const original = originalContext.getImageData(0, 0, width, height);
    const radius = Math.max(1, state.brush.size / Math.max(0.05, Number(layer.transform.scale) || 1) / 2);
    const points = interaction.points;
    const stamp = point => {
      const minX = Math.max(0, Math.floor(point.x - radius)), maxX = Math.min(width - 1, Math.ceil(point.x + radius));
      const minY = Math.max(0, Math.floor(point.y - radius)), maxY = Math.min(height - 1, Math.ceil(point.y + radius));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const dx = px - point.x, dy = py - point.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        const index = (py * width + px) * 4;
        current.data[index] = original.data[index];
        current.data[index + 1] = original.data[index + 1];
        current.data[index + 2] = original.data[index + 2];
        current.data[index + 3] = original.data[index + 3];
      }
    };
    if (points.length === 1) stamp(points[0]);
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1], to = points[i];
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.45)));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        stamp({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
      }
    }
    context.putImageData(current, 0, 0);
    const optimized = await optimizeImageSource(raster.toDataURL("image/png"));
    const before = cloneDocument(state.document);
    const next = replaceImageLayer(state.document, layer.id, {
      source: optimized.source, width: optimized.width, height: optimized.height, restoreSource: backupSource
    }, { preserveDisplaySize: true });
    if (!next) throw new Error("No se pudo aplicar la restauración");
    state.document = next;
    state.history.record(before, next);
    state.dirty = true;
    persistDocument();
    refreshDocument("Pincel Restaurar aplicado. Deshacer revierte la restauración.");
  } catch (error) {
    status.textContent = error?.message || "Falló el pincel Restaurar";
  }
}

function fitSelectedImageToCanvas() {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
    status.textContent = "Seleccioná primero una capa de imagen desbloqueada."; 
    return;
  }
  const before = cloneDocument(state.document);
  const next = cloneDocument(state.document);
  const target = next.layers.find(item => item.id === layer.id);
  target.transform = { ...target.transform, ...fitImportedImageTransform(layer.image.width, layer.image.height, next.width, next.height) };
  state.document = next;
  state.history.record(before, next);
  refreshDocument("Imagen ajustada al lienzo · resolución conservada");
  persistDocument();
}

async function finishImageErase(interaction) {
  const layer = state.document.layers.find(item => item.id === interaction.layerId);
  if (!layer || layer.contentType !== "image" || layer.locked || !layer.image?.source) return;
  if (interaction.points.length === 1) interaction.points.push({ ...interaction.points[0] });
  const source = layer.image.source;
  let image = imageCache.get(source);
  if (!image || !image.complete || image.naturalWidth < 1) {
    image = await new Promise((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error("No se pudo cargar la imagen seleccionada para borrar."));
      candidate.src = source;
      imageCache.set(source, candidate);
    });
  }
  const width = Math.max(1, Math.round(layer.image.width));
  const height = Math.max(1, Math.round(layer.image.height));
  const raster = document.createElement("canvas");
  raster.width = width;
  raster.height = height;
  const context = raster.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El lienzo de edición de imagen no está disponible.");
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const scale = Math.max(0.05, Number(layer.transform.scale) || 1);
  let result;
  try {
    result = await runImageProcessing("apply-erase-strokes", pixels, {
      strokes: [{ size: Math.max(1, state.brush.size / scale), points: interaction.points }]
    }, { transferInput: true });
  } catch (error) {
    status.textContent = error?.message || "No se pudo procesar el borrado en segundo plano.";
    return;
  }
  context.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
  const encoded = raster.toDataURL("image/png");
  const optimized = await optimizeImageSource(encoded);
  const before = cloneDocument(state.document);
  const next = replaceImageLayer(state.document, layer.id, {
    source: optimized.source,
    width: optimized.width,
    height: optimized.height
  }, { preserveDisplaySize: true });
  if (!next) throw new Error("No se pudo aplicar el trazo de borrado a esta imagen.");
  imageCache.delete(source);
  state.document = next;
  state.history.record(before, next);
  state.dirty = true;
  persistDocument();
  refreshDocument("🧽 Píxeles borrados. Deshacer recupera la imagen anterior.");
}

canvas.addEventListener("dblclick", event => {
  const point = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
  const layer = [...state.document.layers].reverse().find(item => item.visible && item.contentType === "text" && item.text && hitTestLayer(item, point, documentCenter(state.document)));
  if (layer) openTextEditorForLayer(layer.id);
});

canvas.addEventListener("pointerdown", event => {
  if (state.pixelEditProcessingPreview) {
    status.textContent = "Esperá a que termine de procesarse el trazo actual.";
    return;
  }
  if (event.pointerType === "touch") {
    activeTouchPointers.set(event.pointerId, { ...screenPointFromEvent(event), pointerId: event.pointerId });
    if (activeTouchPointers.size >= 2 && beginTouchGesture()) return;
  }
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
  if (state.tool !== "select") {
    // A selected text layer is an object, not a paint surface. If a drawing
    // tool was left active, touching text must switch to Move instead of
    // accumulating accidental strokes on the text layer during a drag.
    const documentPoint = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
    const topHitLayer = [...state.document.layers].reverse().find(layer =>
      layer.visible && hitTestLayer(layer, documentPoint, documentCenter(state.document))
    );
    if (topHitLayer?.contentType === "text" && !topHitLayer.locked) {
      activateSelectionToolForText();
      beginSelectionInteraction(event);
      return;
    }
  }
  if (state.tool === "select") {
    beginSelectionInteraction(event);
    return;
  }
  if (state.tool === "restore-brush") {
    const imageLayer = selectedLayerExact();
    if (!imageLayer || imageLayer.contentType !== "image" || !imageLayer.image || imageLayer.locked) {
      status.textContent = "Seleccioná una capa de imagen desbloqueada para restaurar píxeles.";
      return;
    }
    if (!imageLayer.image.restoreSource) {
      status.textContent = "Esta imagen no tiene copia original guardada. El pincel Restaurar aparece disponible después de usar Borrado mágico.";
      return;
    }
    state.imageRestoreInteraction = {
      pointerId: event.pointerId,
      layerId: imageLayer.id,
      points: [imageErasePoint(event, imageLayer)],
      previewPoints: [screenPointFromEvent(event)],
      brushSize: state.brush.size,
      zoom: state.viewport.zoom
    };
    canvas.setPointerCapture(event.pointerId);
    redraw();
    status.textContent = "🩹 Restaurando píxeles originales. Soltá para aplicar.";
    return;
  }
  if (state.tool === "magic-eraser") {
    const imageLayer = selectedLayerExact();
    if (!imageLayer || imageLayer.contentType !== "image" || !imageLayer.image || imageLayer.locked) {
      status.textContent = "Seleccioná una imagen desbloqueada y tocá el fondo que querés hacer transparente."; 
      return;
    }
    const documentPoint = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
    if (!hitTestLayer(imageLayer, documentPoint, documentCenter(state.document))) {
      status.textContent = "Tocá dentro de la imagen seleccionada para borrar esa región del fondo."; 
      return;
    }
    state.magicEraseInteraction = { pointerId: event.pointerId, layerId: imageLayer.id, point: imageErasePoint(event, imageLayer), startScreen: screenPointFromEvent(event), moved: false };
    canvas.setPointerCapture(event.pointerId);
    status.textContent = "🪄 Tap the background color to make that connected region transparent";
    return;
  }
  const pointerDocumentPoint = screenToDocumentPoint(screenPointFromEvent(event), state.document, state.viewport, canvasSize());
  const hitImage = [...state.document.layers].reverse().find(candidate =>
    candidate.visible && candidate.contentType === "image" && candidate.image &&
    hitTestLayer(candidate, pointerDocumentPoint, documentCenter(state.document))
  );
  const currentSelection = selectedLayerExact();
  const keepPaintingLayer = currentSelection?.contentType === "drawing" && !currentSelection.locked;
  if (hitImage && hitImage.id !== state.selectedLayerId &&
      ["brush", "eraser", "censor-light"].includes(state.tool) &&
      !keepPaintingLayer) {
    // Select the hit image but keep processing this same pointer gesture. Previously
    // the early return made the first drawing/erase touch appear to do nothing.
    setSelection([hitImage.id], hitImage.id);
    renderLayers();
  }
  let layer = selectedLayer();
  if (!layer || layer.locked) return;
  if (state.tool === "eraser" && layer.contentType === "image") {
    state.imageEraseInteraction = {
      pointerId: event.pointerId,
      layerId: layer.id,
      points: [imageErasePoint(event, layer)],
      previewPoints: [screenPointFromEvent(event)],
      brushSize: state.brush.size,
      zoom: state.viewport.zoom
    };
    canvas.setPointerCapture(event.pointerId);
    redraw();
    status.textContent = "🧽 Deslizá para borrar píxeles de la imagen. Soltá para aplicar.";
    return;
  }
  if (layer.contentType === "image") {
    const paintLayer = createLayer("Capa de pintura " + (state.document.layers.filter(item => item.contentType === "drawing").length + 1));
    const before = cloneDocument(state.document);
    const next = addLayer(state.document, paintLayer);
    if (!next) return;
    state.document = next;
    setSelection([paintLayer.id], paintLayer.id);
    layer = selectedLayer();
    state.history.record(before, next);
    persistDocument();
    refreshDocument("Capa de pintura transparente agregada.");
  }
  state.drawing = true;
  state.drawingPointerId = event.pointerId;
  state.strokeBefore = cloneDocument(state.document);
  canvas.setPointerCapture(event.pointerId);
  const censor = state.tool === "censor-light";
  const sourceStroke = createStroke(state.tool, censor ? Number(censorInputs.size.value) : state.brush.size, [pointFromEvent(event)], censor ? censorInputs.color.value : state.brush.color, censor ? Number(censorInputs.opacity.value) / 100 : state.brush.opacity, {
    hardness: censor ? 100 - Number(censorInputs.softness.value) : state.brush.hardness,
    effect: censor ? "normal" : state.brush.effect,
    glow: censor ? Number(censorInputs.glow.value) : 0
  });
  state.activeMirrorStroke = null;
  if (state.brush.symmetry && layer.contentType === "drawing" && ["brush", "eraser"].includes(state.tool)) {
    const mirroredPoints = mirrorFreehandPoints(sourceStroke.points, state.document.width);
    if (mirroredPoints) {
      state.activeMirrorStroke = createStroke(sourceStroke.tool, sourceStroke.size, mirroredPoints,
        sourceStroke.color, sourceStroke.opacity, {
          hardness: sourceStroke.hardness, effect: sourceStroke.effect, glow: sourceStroke.glow
        });
      layer.strokes.push(state.activeMirrorStroke);
    }
  }
  layer.strokes.push(sourceStroke);
});

canvas.addEventListener("pointermove", event => {
  if (!state.drawing && ["censor-light", "brush", "eraser"].includes(state.tool)) {
    state.censorCursorPoint = pointFromEvent(event);
    redraw();
  }
  if (event.pointerType === "touch" && activeTouchPointers.has(event.pointerId)) {
    activeTouchPointers.set(event.pointerId, { ...screenPointFromEvent(event), pointerId: event.pointerId });
    if (touchGesture && updateTouchGesture()) return;
  }
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
    const currentScreen = screenPointFromEvent(event);
    const handleOffset = interaction.type === "scale" ? interaction.handleOffset : null;
    const targetScreen = handleOffset
      ? { x: currentScreen.x + handleOffset.x, y: currentScreen.y + handleOffset.y }
      : currentScreen;
    const current = interaction.type === "move" && interaction.startClient &&
      Number.isFinite(interaction.screenScaleAtStart) && interaction.screenScaleAtStart > 0
      ? {
          x: interaction.startDocument.x + (Number(event.clientX) - interaction.startClient.x) / interaction.screenScaleAtStart,
          y: interaction.startDocument.y + (Number(event.clientY) - interaction.startClient.y) / interaction.screenScaleAtStart
        }
      : screenToDocumentPoint(targetScreen, state.document, state.viewport, canvasSize());
    const layers = interactionLayers(interaction);
    if (interaction.type === "move") {
      const start = interaction.startDocument;
      interaction.previewDelta = snapMoveDelta(layers, current.x - start.x, current.y - start.y);
      if (window.__ANIMEART_E2E_DIAGNOSTICS__) console.error("AA_MULTI_POINTERMOVE", JSON.stringify({current, start, delta: interaction.previewDelta, pointerId: event.pointerId}));
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
  if (state.magicEraseInteraction && event.pointerId === state.magicEraseInteraction.pointerId) {
    const current = screenPointFromEvent(event);
    if (Math.hypot(current.x - state.magicEraseInteraction.startScreen.x, current.y - state.magicEraseInteraction.startScreen.y) > 12) state.magicEraseInteraction.moved = true;
    return;
  }
  if (state.imageEraseInteraction && event.pointerId === state.imageEraseInteraction.pointerId) {
    const layer = state.document.layers.find(item => item.id === state.imageEraseInteraction.layerId);
    if (layer?.image) state.imageEraseInteraction.points.push(imageErasePoint(event, layer));
    state.imageEraseInteraction.previewPoints.push(screenPointFromEvent(event));
    redraw();
    return;
  }
  if (state.imageRestoreInteraction && event.pointerId === state.imageRestoreInteraction.pointerId) {
    const layer = state.document.layers.find(item => item.id === state.imageRestoreInteraction.layerId);
    if (layer?.image) state.imageRestoreInteraction.points.push(imageErasePoint(event, layer));
    state.imageRestoreInteraction.previewPoints.push(screenPointFromEvent(event));
    redraw();
    return;
  }
  if (!state.drawing || event.pointerId !== state.drawingPointerId) return;
  const layer = selectedLayer();
  const stroke = layer?.strokes[layer.strokes.length - 1];
  if (!stroke) return;
  const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
  appendSmoothStrokeSamples(stroke, samples.length ? [...samples, event] : [event]);
  syncActiveMirrorStroke(stroke);
  redraw();
});

canvas.addEventListener("pointerup", event => {
  if (event.pointerType === "touch" && activeTouchPointers.has(event.pointerId)) {
    activeTouchPointers.set(event.pointerId, { ...screenPointFromEvent(event), pointerId: event.pointerId });
    if (touchGesture) { endTouchPointer(event); return; }
    activeTouchPointers.delete(event.pointerId);
  }
  if (state.panning && event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
    state.drawing = false;
    state.drawingPointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  // Consume the release position before committing, so a fast final movement is never lost.
  if (state.transformInteraction && event.pointerId === state.transformPointerId) {
    updateTransformPreview(event);
  }
  if (state.multiTransformInteraction && event.pointerId === state.multiTransformInteraction.pointerId) {
    const interaction = state.multiTransformInteraction;
    const currentScreen = screenPointFromEvent(event);
    const handleOffset = interaction.type === "scale" ? interaction.handleOffset : null;
    const targetScreen = handleOffset
      ? { x: currentScreen.x + handleOffset.x, y: currentScreen.y + handleOffset.y }
      : currentScreen;
    const current = interaction.type === "move" && interaction.startClient &&
      Number.isFinite(interaction.screenScaleAtStart) && interaction.screenScaleAtStart > 0
      ? {
          x: interaction.startDocument.x + (Number(event.clientX) - interaction.startClient.x) / interaction.screenScaleAtStart,
          y: interaction.startDocument.y + (Number(event.clientY) - interaction.startClient.y) / interaction.screenScaleAtStart
        }
      : screenToDocumentPoint(targetScreen, state.document, state.viewport, canvasSize());
    const layers = interactionLayers(interaction);
    if (interaction.type === "move") {
      interaction.previewDelta = snapMoveDelta(layers, current.x - interaction.startDocument.x, current.y - interaction.startDocument.y);
    } else if (interaction.type === "scale") {
      const transforms = groupScaleTransforms(layers, documentCenter(state.document), interaction.handle, current);
      if (transforms) interaction.previewTransforms = new Map(transforms.map(item => [item.id, item.transform]));
    } else if (interaction.type === "rotate") {
      const transforms = groupRotationTransforms(layers, documentCenter(state.document), current, interaction.startDocument);
      if (transforms) interaction.previewTransforms = new Map(transforms.map(item => [item.id, item.transform]));
    }
  }
  if (state.multiTransformInteraction && event.pointerId === state.multiTransformInteraction.pointerId) {
    const interaction = state.multiTransformInteraction;
    state.multiTransformInteraction = null;
    state.snapGuides = [];
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (interaction.type === "move") {
      const delta = interaction.previewDelta || { x: 0, y: 0 };
      if (window.__ANIMEART_E2E_DIAGNOSTICS__) console.error("AA_MULTI_POINTERUP", JSON.stringify({delta, layerIds: interaction.layerIds}));
      if (delta.x !== 0 || delta.y !== 0) applyMultiLayerMove(delta.x, delta.y, "Layers moved", interaction.layerIds);
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
    finishTransformInteraction(false, event);
    return;
  }
  if (state.magicEraseInteraction && event.pointerId === state.magicEraseInteraction.pointerId) {
    const interaction = state.magicEraseInteraction;
    state.magicEraseInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!interaction.moved) finishMagicErase(interaction);
    else status.textContent = "Borrado mágico cancelado porque moviste el lienzo."; 
    return;
  }
  if (state.imageRestoreInteraction && event.pointerId === state.imageRestoreInteraction.pointerId) {
    const interaction = state.imageRestoreInteraction;
    const layer = state.document.layers.find(item => item.id === interaction.layerId);
    if (layer?.image) interaction.points.push(imageErasePoint(event, layer));
    interaction.previewPoints.push(screenPointFromEvent(event));
    state.imageRestoreInteraction = null;
    state.pixelEditProcessingPreview = {
      mode: "restore", previewPoints: interaction.previewPoints.slice(),
      brushSize: interaction.brushSize, zoom: interaction.zoom
    };
    const pendingPreview = state.pixelEditProcessingPreview;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
    finishImageRestore(interaction).catch(error => {
      status.textContent = error?.message || "Falló el pincel Restaurar";
    }).finally(() => {
      if (state.pixelEditProcessingPreview === pendingPreview) state.pixelEditProcessingPreview = null;
      redraw();
    });
    return;
  }
  if (state.imageEraseInteraction && event.pointerId === state.imageEraseInteraction.pointerId) {
    const interaction = state.imageEraseInteraction;
    const layer = state.document.layers.find(item => item.id === interaction.layerId);
    if (layer?.image) interaction.points.push(imageErasePoint(event, layer));
    interaction.previewPoints.push(screenPointFromEvent(event));
    state.imageEraseInteraction = null;
    state.pixelEditProcessingPreview = {
      mode: "erase", previewPoints: interaction.previewPoints.slice(),
      brushSize: interaction.brushSize, zoom: interaction.zoom
    };
    const pendingPreview = state.pixelEditProcessingPreview;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
    finishImageErase(interaction).catch(error => {
      status.textContent = error?.message || "Falló el borrado de píxeles";
    }).finally(() => {
      if (state.pixelEditProcessingPreview === pendingPreview) state.pixelEditProcessingPreview = null;
      redraw();
    });
    return;
  }
  if (!state.drawing || event.pointerId !== state.drawingPointerId) return;
  // Include the release coordinate too: Android can deliver pointerup at a
  // position newer than the last pointermove, especially during fast strokes.
  const finalLayer = selectedLayer();
  const finalStroke = finalLayer?.strokes[finalLayer.strokes.length - 1];
  if (finalStroke) appendSmoothStrokeSamples(finalStroke, [event]);
  syncActiveMirrorStroke(finalStroke);
  state.activeMirrorStroke = null;
  state.drawing = false;
  state.drawingPointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const before = state.strokeBefore;
  state.strokeBefore = null;
  if (before) {
    state.history.record(before, state.document);
    persistDocument();
    refreshHistoryControls();
    renderLayers();
  }
});

canvas.addEventListener("pointerleave", () => {
  state.censorCursorPoint = null;
  if (state.tool === "censor-light") redraw();
});

canvas.addEventListener("pointercancel", event => {
  if (event.pointerType === "touch" && activeTouchPointers.has(event.pointerId)) {
    if (touchGesture) { endTouchPointer(event); return; }
    activeTouchPointers.delete(event.pointerId);
  }
  if (event.pointerId === state.panPointerId) {
    state.panning = false;
    state.panPointerId = null;
    state.lastPanPoint = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    return;
  }
  if (state.multiTransformInteraction?.pointerId === event.pointerId) {
    state.multiTransformInteraction = null;
    state.snapGuides = [];
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    redraw();
    return;
  }
  if (event.pointerId === state.transformPointerId) {
    finishTransformInteraction(true);
    return;
  }
  if (state.magicEraseInteraction?.pointerId === event.pointerId) {
    state.magicEraseInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    status.textContent = "Borrado mágico cancelado."; 
    return;
  }
  if (state.imageRestoreInteraction?.pointerId === event.pointerId) {
    state.imageRestoreInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    status.textContent = "Restauración cancelada; no se modificó la imagen.";
    redraw();
    return;
  }
  if (state.imageEraseInteraction?.pointerId === event.pointerId) {
    state.imageEraseInteraction = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    status.textContent = "Borrado cancelado; la imagen quedó intacta.";
    redraw();
    return;
  }
  if (event.pointerId !== state.drawingPointerId) return;
  state.drawing = false;
  state.drawingPointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  const before = state.strokeBefore;
  state.strokeBefore = null;
  state.activeMirrorStroke = null;
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

function setBrushHardness(value) {
  const hardness = Number(value);
  if (!Number.isFinite(hardness)) return false;
  state.brush.hardness = Math.min(100, Math.max(0, hardness));
  return true;
}

function setBrushEffect(value) {
  if (!["normal", "soft", "glow", "neon"].includes(value)) return false;
  state.brush.effect = value;
  return true;
}

const brushColorInput = document.querySelector("#brush-color");
const brushSizeInput = document.querySelector("#brush-size");
const brushSizeValue = document.querySelector("#brush-size-value");
const brushOpacityInput = document.querySelector("#brush-opacity");
const brushOpacityValue = document.querySelector("#brush-opacity-value");
const brushHardnessInput = document.querySelector("#brush-hardness");
const brushHardnessValue = document.querySelector("#brush-hardness-value");
const brushEffectInput = document.querySelector("#brush-effect");
const brushSymmetryInput = document.querySelector("#brush-symmetry");
const brushSymmetryMobileInput = document.querySelector("#brush-symmetry-mobile");

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

brushHardnessInput.addEventListener("input", event => {
  if (!setBrushHardness(event.currentTarget.value)) return;
  brushHardnessValue.textContent = Math.round(state.brush.hardness) + "%";
});

brushEffectInput.addEventListener("change", event => {
  if (!setBrushEffect(event.currentTarget.value)) return;
  status.textContent = "Brush effect: " + brushEffectInput.selectedOptions[0].textContent;
});

function setBrushSymmetryEnabled(enabled) {
  state.brush.symmetry = enabled === true;
  if (brushSymmetryInput) brushSymmetryInput.checked = state.brush.symmetry;
  if (brushSymmetryMobileInput) brushSymmetryMobileInput.checked = state.brush.symmetry;
  status.textContent = state.brush.symmetry
    ? "Simetría vertical activada para pincel y borrador de capa."
    : "Simetría vertical desactivada.";
}
brushSymmetryInput.addEventListener("change", event => setBrushSymmetryEnabled(event.currentTarget.checked));
brushSymmetryMobileInput?.addEventListener("change", event => setBrushSymmetryEnabled(event.currentTarget.checked));

const censorInputs = {
  color: document.querySelector("#censor-light-color"),
  size: document.querySelector("#censor-light-size"),
  opacity: document.querySelector("#censor-light-opacity"),
  softness: document.querySelector("#censor-light-softness"),
  glow: document.querySelector("#censor-light-glow")
};
for (const [key, input] of Object.entries(censorInputs)) {
  input.addEventListener("input", () => {
    const output = document.querySelector("#censor-light-" + key + "-value");
    output.textContent = key === "size" ? input.value + " px" : input.value + "%";
    if (state.tool === "censor-light") redraw();
  });
}

const censorDialog = document.querySelector("#censor-light-dialog");
const censorPreviewCanvas = document.querySelector("#censor-image-preview");
const censorPreviewContext = censorPreviewCanvas?.getContext("2d");
let censorDialogSession = null;
let censorDialogPointer = null;

function drawCensorDialogPreview() {
  const session = censorDialogSession;
  const context = censorPreviewContext;
  if (!session || !context || !session.image) return;
  const { width, height, layer } = session;
  if (censorPreviewCanvas.width !== width) censorPreviewCanvas.width = width;
  if (censorPreviewCanvas.height !== height) censorPreviewCanvas.height = height;
  context.clearRect(0, 0, width, height);
  drawImageLayer(layer, context);
  for (const stroke of session.strokes) {
    if (!stroke.points.length) continue;
    const erasing = stroke.mode === "erase";
    const effect = stroke.effect || "normal";
    context.save();
    context.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    context.globalAlpha = erasing ? Math.max(0.05, stroke.opacity) : stroke.opacity;
    context.strokeStyle = erasing ? "#000000" : stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = erasing || effect === "normal" ? "transparent" : stroke.color;
    context.shadowBlur = erasing ? 0 : stroke.mode === "censor-light"
      ? stroke.size * (stroke.softness / 100 * 0.5 + stroke.glow / 100 * 1.25)
      : effect === "soft" ? stroke.size * stroke.softness / 100
        : effect === "glow" ? stroke.size * 0.55
          : effect === "neon" ? stroke.size * 1.25 : 0;
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
  }
  const undo = document.querySelector("#censor-dialog-undo");
  if (undo) undo.disabled = session.strokes.length === 0;
}

function censorDialogPoint(event) {
  if (!censorPreviewCanvas || !censorDialogSession) return null;
  const rect = censorPreviewCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: Math.max(0, Math.min(censorDialogSession.width, (event.clientX - rect.left) / rect.width * censorDialogSession.width)),
    y: Math.max(0, Math.min(censorDialogSession.height, (event.clientY - rect.top) / rect.height * censorDialogSession.height))
  };
}

async function openCensorLightDialog(requestedMode = "censor-light") {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image) {
    status.textContent = "Primero seleccioná la imagen a la que querés aplicar Luz de censura.";
    document.querySelector("#selection-indicator")?.focus?.();
    return;
  }
  if (layer.locked) {
    status.textContent = "La imagen está fijada/bloqueada. Desfijala antes de aplicar Luz de censura.";
    return;
  }
  const mode = ["censor-light", "paint", "erase"].includes(requestedMode) ? requestedMode : "censor-light";
  try {
    const image = await new Promise((resolve, reject) => {
      const cached = imageCache.get(layer.image.source);
      if (cached?.complete && cached.naturalWidth > 0) { resolve(cached); return; }
      const candidate = cached || new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error("No se pudo cargar la imagen seleccionada."));
      candidate.src = layer.image.source;
      imageCache.set(layer.image.source, candidate);
    });
    const width = layer.image.width;
    const height = layer.image.height;
    if (width * height > 16_000_000) throw new RangeError("Para evitar bloqueos, Luz de censura limita esta operación a 16 megapíxeles. Reducí el tamaño de la imagen y volvé a intentarlo.");
    censorDialogSession = {
      layerId: layer.id,
      source: layer.image.source,
      layer: { ...layer, image: { ...layer.image } },
      image,
      width,
      height,
      strokes: [],
      mode
    };
    const studioTitles = {
      "censor-light": "✨ Luz de censura",
      paint: "🖌️ Pintar píxeles",
      erase: "🧽 Borrar píxeles"
    };
    const studioDescriptions = {
      "censor-light": "Pintá luz sobre la imagen. El original no cambia hasta pulsar Aplicar.",
      paint: "Pintá sobre la imagen en una ventana independiente. Probá color, grosor y acabado; el original sigue intacto hasta Aplicar.",
      erase: "Borrá partes de esta imagen desde la vista previa. Se conserva el original hasta Aplicar y podés deshacer el último trazo."
    };
    document.querySelector("#censor-dialog-title").textContent = studioTitles[mode];
    document.querySelector("#pixel-studio-eyebrow").textContent = mode === "erase" ? "BORRADOR DE PÍXELES · VISTA PREVIA" : mode === "paint" ? "PINCEL · VISTA PREVIA" : "ESTUDIO DE PÍXELES · VISTA PREVIA";
    document.querySelector("#censor-dialog-description").textContent = studioDescriptions[mode];
    document.querySelector("#censor-dialog-image-name").textContent = layer.name + " · " + width + " × " + height + " px";
    document.querySelector("#censor-dialog-color").value = mode === "erase" ? "#111318" : mode === "paint" ? "#ff4fd8" : "#ffffff";
    document.querySelector("#censor-dialog-size").value = mode === "censor-light" ? "36" : mode === "paint" ? "18" : "32";
    document.querySelector("#censor-dialog-size-value").textContent = document.querySelector("#censor-dialog-size").value + " px";
    document.querySelector("#censor-dialog-opacity").value = mode === "censor-light" ? "90" : "100";
    document.querySelector("#censor-dialog-opacity-value").textContent = document.querySelector("#censor-dialog-opacity").value + "%";
    document.querySelector("#censor-dialog-softness").value = mode === "censor-light" ? "35" : "0";
    document.querySelector("#censor-dialog-softness-value").textContent = document.querySelector("#censor-dialog-softness").value + "%";
    document.querySelector("#censor-dialog-glow").value = mode === "censor-light" ? "55" : "0";
    document.querySelector("#censor-dialog-glow-value").textContent = document.querySelector("#censor-dialog-glow").value + "%";
    document.querySelector("#censor-dialog-effect").value = "normal";
    document.querySelector("#censor-dialog-color-label").firstChild.textContent = mode === "erase" ? "Color de fondo de previsualización " : mode === "paint" ? "Color del pincel " : "Color de luz ";
    document.querySelector("#censor-dialog-opacity-label").firstChild.textContent = mode === "erase" ? "Intensidad del borrado " : mode === "paint" ? "Opacidad " : "Intensidad ";
    document.querySelector("#censor-dialog-softness").closest("label").hidden = mode === "erase";
    document.querySelector("#censor-dialog-glow").closest("label").hidden = mode !== "censor-light";
    document.querySelector("#censor-dialog-effect").closest("label").hidden = mode === "censor-light";
    document.querySelector("#censor-dialog-apply").textContent = mode === "erase" ? "✓ Aplicar borrado" : mode === "paint" ? "✓ Aplicar pintura" : "✓ Aplicar a la imagen";
    document.querySelector("#censor-dialog-status").textContent = mode === "erase"
      ? "Deslizá sobre la vista previa para borrar. Nada cambia hasta Aplicar."
      : mode === "paint" ? "Deslizá sobre la vista previa para pintar. Nada cambia hasta Aplicar."
        : "Deslizá sobre la imagen para pintar. Nada se cambia hasta pulsar Aplicar.";
    if (!censorDialog.open) censorDialog.showModal();
    drawCensorDialogPreview();
  } catch (error) {
    censorDialogSession = null;
    status.textContent = error?.message || "No se pudo abrir Luz de censura.";
  }
}

function closeCensorLightDialog() {
  censorDialogPointer = null;
  censorDialogSession = null;
  if (censorDialog?.open) censorDialog.close();
}

for (const [id, suffix] of [["size"," px"],["opacity","%"],["softness","%"],["glow","%"]]) {
  document.querySelector("#censor-dialog-" + id)?.addEventListener("input", event => {
    document.querySelector("#censor-dialog-" + id + "-value").textContent = event.currentTarget.value + suffix;
  });
}
censorPreviewCanvas?.addEventListener("pointerdown", event => {
  if (!censorDialogSession) return;
  const point = censorDialogPoint(event);
  if (!point) return;
  event.preventDefault();
  const stroke = {
    mode: censorDialogSession.mode || "censor-light",
    effect: document.querySelector("#censor-dialog-effect").value,
    color: document.querySelector("#censor-dialog-color").value,
    size: Number(document.querySelector("#censor-dialog-size").value),
    opacity: Number(document.querySelector("#censor-dialog-opacity").value) / 100,
    softness: Number(document.querySelector("#censor-dialog-softness").value),
    glow: Number(document.querySelector("#censor-dialog-glow").value),
    points: [point]
  };
  censorDialogSession.strokes.push(stroke);
  censorDialogPointer = event.pointerId;
  try { censorPreviewCanvas.setPointerCapture(event.pointerId); } catch {}
  drawCensorDialogPreview();
});
censorPreviewCanvas?.addEventListener("pointermove", event => {
  if (censorDialogPointer !== event.pointerId || !censorDialogSession) return;
  const point = censorDialogPoint(event);
  if (!point) return;
  const stroke = censorDialogSession.strokes.at(-1);
  if (!stroke) return;
  stroke.points.push(point);
  drawCensorDialogPreview();
});
function finishCensorDialogStroke(event) {
  if (censorDialogPointer !== event.pointerId) return;
  censorDialogPointer = null;
  try { if (censorPreviewCanvas.hasPointerCapture(event.pointerId)) censorPreviewCanvas.releasePointerCapture(event.pointerId); } catch {}
  drawCensorDialogPreview();
}
censorPreviewCanvas?.addEventListener("pointerup", finishCensorDialogStroke);
censorPreviewCanvas?.addEventListener("pointercancel", finishCensorDialogStroke);
document.querySelector("#censor-dialog-undo")?.addEventListener("click", () => {
  if (!censorDialogSession) return;
  censorDialogSession.strokes.pop();
  document.querySelector("#censor-dialog-status").textContent = "Se quitó el último trazo. El original sigue intacto.";
  drawCensorDialogPreview();
});
document.querySelector("#censor-dialog-cancel")?.addEventListener("click", closeCensorLightDialog);
document.querySelector("#censor-dialog-close")?.addEventListener("click", closeCensorLightDialog);
censorDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  closeCensorLightDialog();
});
document.querySelector("#censor-dialog-apply")?.addEventListener("click", async event => {
  const session = censorDialogSession;
  if (!session || !session.strokes.length) {
    document.querySelector("#censor-dialog-status").textContent = "Pintá al menos un trazo antes de aplicar.";
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (state.storageRecoveryPending) throw new Error("El proyecto recuperado está protegido. Guardalo primero para permitir modificaciones.");
    const layer = state.document.layers.find(item => item.id === session.layerId);
    if (!layer || layer.contentType !== "image" || !layer.image || layer.locked || layer.image.source !== session.source) {
      throw new Error("La imagen seleccionada cambió. Cancelá y volvé a abrir Luz de censura.");
    }
    drawCensorDialogPreview();
    const source = censorPreviewCanvas.toDataURL("image/png");
    const optimized = await optimizeImageSource(source);
    const before = cloneDocument(state.document);
    const next = replaceImageLayer(state.document, layer.id, { source: optimized.source, width: optimized.width, height: optimized.height }, { preserveDisplaySize: true });
    if (!next) throw new Error("No se pudo aplicar el efecto a esta imagen.");
    const changedLayer = next.layers.find(item => item.id === layer.id);
    if (changedLayer?.image) {
      changedLayer.image.flipX = false;
      changedLayer.image.flipY = false;
    }
    imageCache.delete(session.source);
    state.document = next;
    setSelection([layer.id], layer.id);
    state.history.record(before, next);
    const appliedMessage = session.mode === "erase" ? "🧽 Borrado aplicado a la imagen. Deshacer recupera los píxeles originales."
      : session.mode === "paint" ? "🖌️ Pintura aplicada a la imagen. Deshacer restaura la versión original."
        : "✨ Luz de censura aplicada solo a la imagen. Deshacer restaura los píxeles originales.";
    refreshDocument(appliedMessage);
    persistDocument();
    closeCensorLightDialog();
  } catch (error) {
    document.querySelector("#censor-dialog-status").textContent = error?.message || "No se pudo aplicar Luz de censura.";
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll("[data-censor-preset]").forEach(button => button.addEventListener("click", () => {
  const presets = {
    point: { size: 10, opacity: 100, softness: 0, glow: 15 },
    normal: { size: 28, opacity: 100, softness: 25, glow: 35 },
    large: { size: 72, opacity: 100, softness: 18, glow: 50 },
    line: { size: 18, opacity: 100, softness: 0, glow: 20 }
  };
  const preset = presets[button.dataset.censorPreset];
  if (!preset) return;
  for (const [key, value] of Object.entries(preset)) {
    censorInputs[key].value = String(value);
    document.querySelector("#censor-light-" + key + "-value").textContent = key === "size" ? value + " px" : value + "%";
  }
  if (state.tool === "censor-light") redraw();
}));


function syncBrushControls() {
  brushColorInput.value = state.brush.color;
  brushSizeInput.value = String(state.brush.size);
  brushSizeValue.textContent = String(state.brush.size);
  brushOpacityInput.value = String(Math.round(state.brush.opacity * 100));
  brushOpacityValue.textContent = Math.round(state.brush.opacity * 100) + "%";
  brushHardnessInput.value = String(Math.round(state.brush.hardness));
  brushHardnessValue.textContent = Math.round(state.brush.hardness) + "%";
  brushEffectInput.value = state.brush.effect;
}


document.querySelectorAll("[data-brush-color]").forEach(button => {
  button.addEventListener("click", () => {
    if (!setBrushColor(button.dataset.brushColor)) return;
    syncBrushControls();
    document.querySelectorAll("[data-brush-color]").forEach(item => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    redraw();
  });
});

// This control sits outside the canvas event surface: toggling the tools must never paint or erase.
const magneticSnappingToggle = document.querySelector("#magnetic-snapping-toggle");
function syncMagneticSnappingToggle() {
  if (!magneticSnappingToggle) return;
  magneticSnappingToggle.setAttribute("aria-pressed", String(state.magneticSnappingEnabled));
  magneticSnappingToggle.dataset.active = String(state.magneticSnappingEnabled);
  magneticSnappingToggle.title = state.magneticSnappingEnabled
    ? "Ajuste magnético activado. Toca para permitir movimiento libre"
    : "Movimiento libre activado. Toca para alinear automáticamente";
  magneticSnappingToggle.setAttribute("aria-label", state.magneticSnappingEnabled
    ? "Desactivar ajuste magnético y mover libremente"
    : "Activar ajuste magnético");
  magneticSnappingToggle.querySelector(".magnet-label").textContent = state.magneticSnappingEnabled ? "Imán: activado" : "Imán: apagado";
}
magneticSnappingToggle?.addEventListener("click", () => {
  state.magneticSnappingEnabled = !state.magneticSnappingEnabled;
  state.snapGuides = [];
  syncMagneticSnappingToggle();
  redraw();
  status.textContent = state.magneticSnappingEnabled
    ? "Ajuste magnético activado"
    : "Movimiento libre: ajuste magnético desactivado";
});
syncMagneticSnappingToggle();

const mobileToolsToggle = document.querySelector("#mobile-tools-toggle");
mobileToolsToggle?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  document.body.classList.remove("mobile-tools-open", "mobile-layers-open");
  document.querySelectorAll('.mobile-touch-dock [data-touch-action="more"], .mobile-touch-dock [data-touch-action="layers"]').forEach(item => item.setAttribute("aria-expanded", "false"));
  const collapsed = document.body.classList.toggle("mobile-tools-collapsed");
  mobileToolsToggle.setAttribute("aria-expanded", String(!collapsed));
  mobileToolsToggle.setAttribute("aria-label", collapsed ? "Mostrar herramientas" : "Ocultar herramientas");
  mobileToolsToggle.title = collapsed ? "Mostrar herramientas para elegir una acción" : "Ocultar herramientas para ampliar el lienzo";
  mobileToolsToggle.querySelector("span").textContent = collapsed ? "⌃" : "⌄";
});

const mobileDock = document.querySelector(".mobile-touch-dock");
const mobileContextHeading = document.querySelector("#mobile-context-heading");
function closeMobileContextPanel() {
  document.body.classList.remove("mobile-draw-panel-open");
  if (mobileContextHeading) mobileContextHeading.hidden = true;
}
function openMobileContextPanel(panel = "draw") {
  document.body.classList.remove("mobile-layers-open", "mobile-tools-collapsed");
  document.body.classList.add("mobile-tools-open", "mobile-draw-panel-open");
  // Brush controls live in the More tools disclosure; expand it when the drawing sheet opens.
  const brushControlsDisclosure = document.querySelector(".workspace > .toolbar > details.more-tools");
  if (brushControlsDisclosure) brushControlsDisclosure.open = true;
  if (mobileContextHeading) mobileContextHeading.hidden = false;
  const title = document.querySelector("#mobile-context-title");
  const description = document.querySelector("#mobile-context-description");
  if (title) title.textContent = panel === "erase" ? "Borrar" : panel === "censor" ? "Luz de censura" : "Dibujar";
  if (description) description.textContent = panel === "erase"
    ? "Ajustá el borrador y deslizá sobre la zona que querés quitar."
    : panel === "censor" ? "Elegí color y tamaño; dibujá una cobertura de luz sobre la zona deseada."
      : "Elegí el color, el grosor y el efecto. Después dibujá sobre el lienzo.";
  document.querySelector('.mobile-touch-dock [data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
  document.querySelector('.mobile-touch-dock [data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
  mobileToolsToggle?.setAttribute("aria-expanded", "true");
  mobileToolsToggle?.setAttribute("aria-label", "Ocultar herramientas");
  if (mobileToolsToggle) mobileToolsToggle.querySelector("span").textContent = "⌄";
}
document.querySelector("#mobile-context-close")?.addEventListener("click", () => {
  closeMobileContextPanel();
  document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed");
});
if (mobileDock) {
  mobileDock.addEventListener("click", event => {
    const button = event.target.closest("[data-touch-action]");
    if (!button) return;
    const action = button.dataset.touchAction;
    if (action === "tool") {
      const wasDrawingPanelOpen = document.body.classList.contains("mobile-draw-panel-open");
      document.querySelector('.toolbar [data-tool="' + button.dataset.tool + '"]')?.click();
      mobileDock.querySelectorAll('[data-touch-action="tool"]').forEach(item => {
        item.setAttribute("aria-pressed", String(item.dataset.tool === state.tool));
      });
      if (button.dataset.tool === "brush") {
        if (wasDrawingPanelOpen) {
          closeMobileContextPanel();
          document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
        } else {
          openMobileContextPanel("draw");
        }
        return;
      }
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-layers-open", "mobile-tools-collapsed");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      mobileDock.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
      return;
    }
    if (action === "paint") {
      if (toolboxDialog?.open) toolboxDialog.close();
      hideMobileToolSheets();
      document.querySelector('.toolbar .tool[data-tool="brush"]')?.click();
      openMobileContextPanel("draw");
      status.textContent = "Dibujar en capa activo. El lienzo no necesita una imagen seleccionada.";
      return;
    }
    if (action === "crop") {
      if (toolboxDialog?.open) toolboxDialog.close();
      openCropModeDialog();
      return;
    }
    if (action === "rotate-left") { document.querySelector('[data-transform="rotate-left"]')?.click(); return; }
    if (action === "rotate-right") { document.querySelector('[data-transform="rotate-right"]')?.click(); return; }
    if (action === "flip-horizontal") { flipImageHorizontalButton?.click(); return; }
    if (action === "flip-vertical") { flipImageVerticalButton?.click(); return; }
    if (action === "undo") { undo(); return; }
    if (action === "redo") { redo(); return; }
    if (action === "export") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      exportPngButton?.click();
      return;
    }
    if (action === "crop-image") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileToolsToggle?.setAttribute("aria-expanded", "true");
      mobileToolsToggle?.setAttribute("aria-label", "Ocultar herramientas");
      if (mobileToolsToggle) mobileToolsToggle.querySelector("span").textContent = "⌄";
      mobileDock.querySelectorAll('[data-touch-action="more"], [data-touch-action="layers"]').forEach(item => item.setAttribute("aria-expanded", "false"));
      const layer = selectedLayerExact();
      if (!layer || layer.contentType !== "image" || !layer.image) {
        status.textContent = "Primero seleccioná una imagen en el lienzo o en Capas; después tocá Recortar.";
        return;
      }
      if (layer.locked) {
        status.textContent = "La imagen está bloqueada. Desbloqueala desde Capas para poder recortarla.";
        return;
      }
      cropResizeButton.click();
      return;
    }
    if (action === "import-image") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      mobileDock.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
      openImagePicker();
      return;
    }
    if (action === "delete-selected") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      mobileDock.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
      removeSelectedLayer();
      return;
    }
    if (action === "asset-library") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      document.querySelector("#open-asset-library")?.click();
      return;
    }
    if (action === "add-text") {
      closeMobileContextPanel();
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed", "mobile-layers-open");
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      mobileDock.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
      const selected = selectedLayerExact();
      if (selected?.contentType === "text" && textEditDialog) {
        openTextEditorForLayer(selected.id);
      } else {
        document.querySelector("#add-text-layer")?.click();
      }
      return;
    }
    if (action === "export") { exportPngButton.click(); return; }
    if (action === "appearance") { document.querySelector("#appearance-open")?.click(); return; }
    if (action === "zoom-in" || action === "zoom-out") {
      const factor = action === "zoom-in" ? 1.2 : 1 / 1.2;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.viewport.zoom * factor));
      setViewport(zoomViewportAt(state.viewport, zoom, canvasCenter(), state.document, canvasSize()));
      status.textContent = "Zoom " + Math.round(zoom * 100) + "%";
      return;
    }
    if (action === "layers") {
      closeMobileContextPanel();
      const open = document.body.classList.toggle("mobile-layers-open");
      button.setAttribute("aria-expanded", String(open));
      document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed");
      mobileToolsToggle?.setAttribute("aria-expanded", "true");
      mobileToolsToggle?.setAttribute("aria-label", "Ocultar herramientas");
      if (mobileToolsToggle) mobileToolsToggle.querySelector("span").textContent = "⌄";
      mobileDock.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
      return;
    }
    if (action === "more") {
      // "Más" is a separate tool catalog, not an expansion of the crowded toolbar.
      if (toolboxDialog?.open) {
        toolboxDialog.close();
        document.body.classList.remove("mobile-tools-open");
        button.setAttribute("aria-expanded", "false");
        return;
      }
      hideMobileToolSheets();
      document.body.classList.remove("mobile-layers-open", "mobile-tools-collapsed");
      const isMobile = window.matchMedia("(max-width: 920px)").matches;
      if (isMobile) {
        toolboxDialog?.show(); // non-modal bottom sheet keeps the dock available for closing
        document.body.classList.add("mobile-tools-open");
      } else {
        toolboxDialog?.showModal();
      }
      button.setAttribute("aria-expanded", "true");
      mobileDock.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", "false");
      return;
    }
  });
}

// AA-MOBILE-PICSART-PANEL-LAW: universal actions stay in the compact top bar on phones.
document.querySelectorAll("[data-mobile-top-action]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.mobileTopAction;
    if (action === "undo") undo();
    else if (action === "redo") redo();
    else if (action === "export") exportPngButton?.click();
  });
});

function setInteractionMode(mode) {
  state.interactionMode = mode === "interactive" ? "interactive" : "simple";
  const modeToggle = document.querySelector("#editor-mode-toggle");
  if (modeToggle) {
    modeToggle.textContent = state.interactionMode === "interactive" ? "Modo simple" : "Modo interactivo";
    modeToggle.setAttribute("aria-label", state.interactionMode === "interactive" ? "Cambiar a modo simple" : "Cambiar a modo interactivo");
  }
  document.body.classList.toggle("interactive-mode", state.interactionMode === "interactive");
  document.body.classList.toggle("simple-mode", state.interactionMode === "simple");
  document.querySelectorAll("[data-editor-mode]").forEach(button => {
    const active = button.dataset.editorMode === state.interactionMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const help = document.querySelector("#editing-help-card");
  if (help) help.hidden = state.interactionMode === "interactive" || !document.querySelector("#editing-help-enabled")?.checked;
  const details = document.querySelector(".more-tools");
  if (details && state.interactionMode === "interactive") details.open = false;
  try { sessionStorage.setItem("animeart-editor-mode-v1", state.interactionMode); } catch {}
  status.textContent = state.interactionMode === "interactive"
    ? "Modo interactivo: mové el elemento desde dentro del marco, usá el tirador inferior para cambiar tamaño y la herramienta Rotar para girarlo."
    : "Modo simple: elegí una tarea guiada. También podés tocar y arrastrar una imagen para acomodarla.";
}
document.querySelectorAll("[data-editor-mode]").forEach(button => button.addEventListener("click", () => setInteractionMode(button.dataset.editorMode)));
document.querySelector("#editor-mode-toggle")?.addEventListener("click", () => setInteractionMode(state.interactionMode === "interactive" ? "simple" : "interactive"));
try { setInteractionMode(sessionStorage.getItem("animeart-editor-mode-v1") || "simple"); } catch { setInteractionMode("simple"); }

 const magicTolerance = document.querySelector("#magic-eraser-tolerance");
const magicToleranceValue = document.querySelector("#magic-eraser-tolerance-value");
magicTolerance?.addEventListener("input", () => {
  if (magicToleranceValue) magicToleranceValue.value = magicTolerance.value;
});

 document.querySelectorAll(".tool").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.tool === "censor-light") { openCensorLightDialog(); return; }
    state.tool = button.dataset.tool;
    if (state.tool !== "select" && state.multiTransformInteraction) {
      state.multiTransformInteraction = null;
    }
    if (state.tool !== "select" && state.transformInteraction) finishTransformInteraction(true);
    state.magicEraseInteraction = null;
    document.querySelectorAll(".tool").forEach(b => {
      b.classList.toggle("active", b === button);
      if (b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", String(b === button));
    });
    mobileDock?.querySelectorAll('[data-touch-action="tool"]').forEach(item => item.setAttribute("aria-pressed", String(item.dataset.tool === state.tool)));
    document.querySelector(".censor-light-controls")?.classList.toggle("is-active", state.tool === "censor-light");
    if (state.tool === "censor-light") { document.querySelector(".more-tools").open = true; status.textContent = "Luz de censura activa"; }
    redraw();
  });
});


const helpGoals = {
  move: ["Mover / acomodar", "Toca la imagen y arrástrala. Usa las esquinas para cambiar el tamaño y el tirador de arriba para girar. Pulsa fuera del elemento para quitar el cuadro de selección."],
  fit: ["Ajustar al lienzo", "Centra la imagen y haz que encaje dentro del lienzo sin deformar sus proporciones. Puedes volver a moverla después."],
  crop: ["Recortar", "Seleccioná una imagen. Arrastrá el marco sobre la vista previa, movelo o cambiá su tamaño con los tiradores. Elige la proporción y pulsa ✂️ Recortar; la X cancela."],
  background: ["Quitar fondo", "Seleccioná una imagen con fondo liso. Probá Detectar color de fondo o tocá el color exacto en la vista previa, revisá el resultado y pulsa Aplicar. Para casos difíciles, abrí Más ajustes."],
  erase: ["Borrar píxeles", "Abre el estudio de píxeles de la imagen seleccionada. Revisá el resultado y aplicá solo cuando esté listo."],
  eraser: ["Borrar con pincel", "Arrastrá sobre una imagen para borrar píxeles o sobre una capa de pintura para quitar trazos. Deshacer recupera el cambio."],
  paint: ["Pintar píxeles", "Pinta dentro de una imagen seleccionada con vista previa. Aplicar confirma los píxeles; Cancelar conserva el original."],
  censor: ["Luz de censura", "Seleccioná una imagen y pintá el resplandor directamente en su vista previa. Deshacer quita el último trazo; X cancela sin cambiar la foto y Aplicar confirma el resultado."],
  draw: ["Dibujar en capa", "Elegí color, grosor y efecto; dibujá incluso sobre un lienzo vacío. Los trazos quedan en una capa separada de la imagen y se pueden deshacer."],
  text: ["Texto", "Al tocar Texto se abre un editor con estilos Cómic, Cartel, Manga y Neón, tipografía, tamaño, color, contorno y sombra. Aplicar conserva el texto; X cancela el texto nuevo."],
  shapes: ["Formas", "Añade rectángulos, círculos, estrellas, corazones, globos y otras figuras. Define relleno, contorno y sombra antes de insertarlas como capas."],
  "object-style": ["Apariencia del elemento", "Seleccioná un elemento para cambiar opacidad, forma de recorte, brillo, contraste o saturación, según el tipo de capa."],
  color: ["Mejorar color", "Selecciona una imagen y ajusta brillo, contraste o saturación en Image adjustments."],
  layers: ["Capas", "Toca una capa para seleccionarla. Cambia el orden, visibilidad y opacidad con los controles disponibles."],
  undo: ["Deshacer", "Pulsa Deshacer para volver un paso atrás. Rehacer recupera el cambio."],
  export: ["Guardar / Exportar", "Guardar localmente conserva el proyecto editable. Exportar imagen crea una imagen compuesta."],
  appearance: ["Apariencia", "Personaliza los detalles visuales del editor desde este panel, sin ocupar la zona del lienzo."]
};
let lastEditGoal = "crop";
function showGoalHelp(goal) {
  const item = helpGoals[goal] || ["Ayúdame a editar", "Importa una imagen y elige la tarea que quieras realizar."];
  document.querySelector("#editing-help-title").textContent = item[0];
  document.querySelector("#editing-help-copy").textContent = item[1];
  const list = document.querySelector("#editing-help-steps");
  list.replaceChildren();
  item[1].split(/(?<=\.)\s+/).filter(Boolean).forEach(step => {
    const li = document.createElement("li");
    li.textContent = step;
    list.append(li);
  });
  list.hidden = !list.childElementCount;
  document.querySelector("#editing-help-card").hidden = !document.querySelector("#editing-help-enabled").checked;
}
function setMobileLayersPanelOpen(open) {
  closeMobileContextPanel();
  document.body.classList.toggle("mobile-layers-open", Boolean(open));
  document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed");
  mobileDock?.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
  mobileDock?.querySelector('[data-touch-action="layers"]')?.setAttribute("aria-expanded", String(Boolean(open)));
  mobileToolsToggle?.setAttribute("aria-expanded", "true");
  mobileToolsToggle?.setAttribute("aria-label", "Mostrar u ocultar herramientas");
}

function runEditGoal(goal) {
  lastEditGoal = goal;
  showGoalHelp(goal);
  const actions = {
    move: () => {
      document.querySelector('.toolbar [data-tool="select"]')?.click();
      canvas.scrollIntoView({ block: "center", behavior: "smooth" });
      status.textContent = "Toca la imagen y arrástrala para moverla. Usa las esquinas para cambiar el tamaño.";
    },
    fit: () => document.querySelector("#fit-image-to-canvas")?.click(),
    "rotate-left": () => document.querySelector('[data-transform="rotate-left"]')?.click(),
    "rotate-right": () => document.querySelector('[data-transform="rotate-right"]')?.click(),
    "flip-horizontal": () => flipImageHorizontalButton?.click(),
    "flip-vertical": () => flipImageVerticalButton?.click(),
    crop: () => openCropModeDialog(),
    "crop-image": () => {
      const layer = selectedLayerExact();
      if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) {
        status.textContent = "Seleccioná una imagen desbloqueada para recortar solo sus píxeles.";
        return;
      }
      cropResizeButton.click();
    },
    "crop-canvas": () => void openCanvasCropDialog(),
    background: () => {
      const layer = selectedLayerExact();
      if (!layer || layer.contentType !== "image" || !layer.image) {
        status.textContent = "Seleccioná primero una capa de imagen en el lienzo o en Capas para quitar el fondo.";
        document.querySelector("#selection-indicator")?.focus?.();
        return;
      }
      removeBackgroundButton.click();
    },
    erase: () => openCensorLightDialog("erase"),
    eraser: () => {
      document.querySelector('.toolbar .tool[data-tool="eraser"]')?.click();
      status.textContent = "Borrar con pincel activo. Deslizá sobre la imagen o los trazos de la capa seleccionada; Deshacer recupera el cambio.";
    },
    censor: () => openCensorLightDialog("censor-light"),
    draw: () => {
      document.querySelector('.toolbar .tool[data-tool="brush"]')?.click();
      status.textContent = "Dibujar en capa activo. Tus trazos quedan separados de las imágenes.";
    },
    paint: () => openCensorLightDialog("paint"),
    text: () => selectedLayerExact()?.contentType === "text" ? openTextEditorForLayer(selectedLayerExact().id) : document.querySelector("#add-text-layer").click(),
    shapes: () => openShapeMaker(),
    "object-style": () => openSelectedObjectStyle(),
    color: () => {
      if (window.matchMedia("(max-width: 920px)").matches) setMobileLayersPanelOpen(true);
      document.querySelector("#adjustments-title")?.scrollIntoView({ block: "nearest" });
    },
    layers: () => {
      if (window.matchMedia("(max-width: 920px)").matches) {
        setMobileLayersPanelOpen(!document.body.classList.contains("mobile-layers-open"));
      } else {
        document.querySelector("#layers")?.scrollIntoView({ block: "nearest" });
      }
    },
    undo: () => undoButton.click(),
    redo: () => redoButton.click(),
    "delete-selected": () => removeSelectedLayer(),
    export: () => exportPngButton.click(),
    "creative-studio": () => openCreativeStudio(),
    appearance: () => document.querySelector("#appearance-open")?.click()
  };
  actions[goal]?.();
}
document.querySelector("#toolbox-open")?.addEventListener("click", () => {
  if (!toolboxDialog?.open) toolboxDialog?.showModal();
});
document.querySelector("#toolbox-close")?.addEventListener("click", () => toolboxDialog?.close());
toolboxDialog?.addEventListener("close", () => {
  document.body.classList.remove("mobile-tools-open");
  mobileDock?.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
});
document.querySelectorAll("[data-edit-goal]").forEach(button => button.addEventListener("click", () => {
  if (toolboxDialog?.open) toolboxDialog.close();
  const goal = button.dataset.editGoal;
  runEditGoal(goal);
  if (window.matchMedia("(max-width: 920px)").matches) {
    if (goal === "draw") {
      hideMobileToolSheets();
      openMobileContextPanel("draw");
      return;
    }
    if (goal === "eraser") {
      hideMobileToolSheets();
      openMobileContextPanel("erase");
      return;
    }
    if (["paint", "erase", "censor", "crop"].includes(goal)) {
      hideMobileToolSheets();
      return;
    }
    closeMobileContextPanel();
    document.body.classList.remove("mobile-tools-open", "mobile-tools-collapsed");
    mobileDock?.querySelector('[data-touch-action="more"]')?.setAttribute("aria-expanded", "false");
  }
}));
document.querySelector("#show-edit-example").addEventListener("click", () => showGoalHelp(state.tool === "censor-light" ? "censor" : lastEditGoal));
document.querySelector("#show-edit-example-action").addEventListener("click", () => runEditGoal(state.tool === "censor-light" ? "censor" : lastEditGoal));
document.querySelector("#close-editing-help").addEventListener("click", () => { document.querySelector("#editing-help-card").hidden = true; });
const helpToggle = document.querySelector("#editing-help-enabled");
helpToggle.checked = getEditingHelpPreference();
helpToggle.addEventListener("change", () => {
  setEditingHelpPreference(helpToggle.checked);
  document.querySelector("#editing-help-card").hidden = !helpToggle.checked;
  if (guidedEditingDialog?.open) renderGuidedEditingDialog();
});


const GUIDED_PROGRESS_STORAGE_KEY = "kapiart-guided-editing-progress-v1";
const guidedEditingDialog = document.querySelector("#guided-editing-dialog");
const guidedFlowSelect = document.querySelector("#guided-flow-select");
const guidedProgressByFlow = Object.create(null);
let activeGuidedFlowId = "portrait-clean";
function sanitizeGuidedProgress(saved,flowId){
 const fresh=createGuidedProgress(flowId),flow=getGuidedFlow(flowId);
 if(!saved||saved.flowId!==flowId)return fresh;
 const validIds=new Set(flow.steps.map(item=>item.id));
 const completedStepIds=Array.isArray(saved.completedStepIds)?[...new Set(saved.completedStepIds.filter(id=>validIds.has(id)))]:[];
 const launchedStepIds=Array.isArray(saved.launchedStepIds)?[...new Set(saved.launchedStepIds.filter(id=>validIds.has(id)))]:[];
 const numericIndex=Number.isInteger(saved.stepIndex)?saved.stepIndex:0;
 return {flowId,stepIndex:Math.max(0,Math.min(flow.steps.length-1,numericIndex)),completedStepIds,launchedStepIds};
}
function loadGuidedEditingState(){
 const fallback={activeFlowId:"portrait-clean",progressByFlow:Object.create(null)};
 for(const flow of GUIDED_EDITING_FLOWS)fallback.progressByFlow[flow.id]=createGuidedProgress(flow.id);
 try{
  const saved=JSON.parse(localStorage.getItem(GUIDED_PROGRESS_STORAGE_KEY)||"null");
  if(!saved||saved.version!==1||!saved.progressByFlow)return fallback;
  const restored={activeFlowId:getGuidedFlow(saved.activeFlowId)?saved.activeFlowId:fallback.activeFlowId,progressByFlow:Object.create(null)};
  for(const flow of GUIDED_EDITING_FLOWS)restored.progressByFlow[flow.id]=sanitizeGuidedProgress(saved.progressByFlow[flow.id],flow.id);
  return restored;
 }catch{return fallback;}
}
let guidedEditingState=loadGuidedEditingState();
activeGuidedFlowId=guidedEditingState.activeFlowId;
Object.assign(guidedProgressByFlow,guidedEditingState.progressByFlow);
function currentGuidedProgress(){return guidedProgressByFlow[activeGuidedFlowId];}
function persistGuidedEditingState(){
 persistGuidedEditingProgress(localStorage,GUIDED_PROGRESS_STORAGE_KEY,{version:1,activeFlowId:activeGuidedFlowId,progressByFlow:guidedProgressByFlow});
}
function renderGuidedEditingDialog(){
 const flow=getGuidedFlow(activeGuidedFlowId);if(!flow)return;
 const progress=currentGuidedProgress(),step=getGuidedStep(flow.id,progress.stepIndex);if(!step)return;
 guidedFlowSelect.value=flow.id;
 const completedCount=progress.completedStepIds.length,flowComplete=isGuidedFlowComplete(progress,flow.id);
 const stepComplete=progress.completedStepIds.includes(step.id),launched=progress.launchedStepIds.includes(step.id);
 document.querySelector("#guided-progress-label").textContent=flowComplete?"Guía completada":"Paso "+(progress.stepIndex+1)+" de "+flow.steps.length;
 document.querySelector("#guided-progress-count").textContent=completedCount+" de "+flow.steps.length+" completados";
 document.querySelector("#guided-progress-track").setAttribute("aria-valuenow",String(completedCount));
 document.querySelector("#guided-progress-fill").style.width=Math.round(completedCount/flow.steps.length*100)+"%";
 const list=document.querySelector("#guided-step-list");list.replaceChildren();
 flow.steps.forEach((item,index)=>{
  const li=document.createElement("li"),marker=document.createElement("span"),label=document.createElement("span");
  marker.className="guided-step-marker";marker.textContent=progress.completedStepIds.includes(item.id)?"✓":String(index+1);
  label.className="guided-step-list-label";label.textContent=item.title;
  li.dataset.state=progress.completedStepIds.includes(item.id)?"complete":index===progress.stepIndex?"current":"upcoming";
  if(index===progress.stepIndex)li.setAttribute("aria-current","step");
  li.append(marker,label);list.append(li);
 });
 document.querySelector("#guided-step-kicker").textContent="PASO "+(progress.stepIndex+1);
 document.querySelector("#guided-step-title").textContent=step.title;
 document.querySelector("#guided-step-description").textContent=step.description;
 document.querySelector("#guided-step-what").textContent=step.description;
 document.querySelector("#guided-step-why").textContent=step.why;
 document.querySelector("#guided-step-advanced").textContent=step.advancedTip;
 const mascotTip=document.querySelector("#guided-mascot-tip");
 if(mascotTip){
  mascotTip.hidden=!helpToggle.checked;
  document.querySelector("#guided-mascot-tip-copy").textContent=step.why;
 }
 const notice=document.querySelector("#guided-step-notice");
 if(flowComplete)notice.textContent="¡Buen trabajo! La ruta está completa. Puedes seguir editando las capas o empezar otra guía.";
 else if(stepComplete)notice.textContent="Este paso ya está confirmado. Puedes volver a revisarlo o continuar.";
 else if(!hasGuidedImage(state.document))notice.textContent="Importa una imagen con la acción indicada. Si cancelas el selector, la guía no marcará el paso como terminado.";
 else if(launched)notice.textContent="Ya abriste la herramienta. Revisa y confirma el resultado antes de continuar; puedes deshacer desde el editor.";
 else notice.textContent="Abre la herramienta real, revisa su resultado y vuelve aquí para confirmar el paso.";
 const secondary=document.querySelector("#guided-step-secondary");
 secondary.hidden=!step.secondaryAction;secondary.textContent=step.secondaryAction?.label||"Otra herramienta";
 document.querySelector("#guided-step-action").textContent=step.actionLabel;
 document.querySelector("#guided-step-back").disabled=progress.stepIndex===0;
 const completeButton=document.querySelector("#guided-step-complete");
 completeButton.disabled=flowComplete||!canCompleteGuidedStep(progress,flow.id,state.document);
 completeButton.textContent=flowComplete?"Guía completada ✓":stepComplete?"Continuar →":progress.stepIndex===flow.steps.length-1?"Confirmar y terminar":"Confirmar paso y continuar";
}
function openGuidedEditingDialog(){
 if(toolboxDialog?.open)toolboxDialog.close();
 renderGuidedEditingDialog();
 if(!guidedEditingDialog.open)guidedEditingDialog.showModal();
}
function focusGuidedImageLayer(){
 let layer=selectedLayerExact();
 if(!layer||layer.contentType!=="image"||!layer.image||layer.locked)layer=[...state.document.layers].reverse().find(item=>item.contentType==="image"&&item.image&&!item.locked);
 if(!layer){status.textContent="Primero importa una imagen y selecciona una capa de imagen desbloqueada.";return false;}
 if(layer.id!==state.selectedLayerId)setSelection([layer.id],layer.id);
 // setSelection updates the selection indicator, but image buttons refresh in renderLayers().
 // Refresh the real controls now so a previously selected text layer cannot leave them disabled.
 refreshImageEditButton();
 return true;
}
function launchGuidedStepAction(actionId){
 const actionMap={
  "import-image":{selector:"#add-image-layer",needsImage:false,run:()=>document.querySelector("#add-image-layer")?.click()},
  "create-canvas":{selector:"#new-document",needsImage:false,run:()=>document.querySelector("#new-document")?.click()},
  "fit-image":{selector:"#fit-image-to-canvas",needsImage:true,run:()=>runEditGoal("fit")},
  "quick-recipe-ice-blue":{selector:'[data-quick-recipe="ice-blue"]',needsImage:true,run:()=>document.querySelector('[data-quick-recipe="ice-blue"]')?.click()},
  "quick-recipe-manga-ink":{selector:'[data-quick-recipe="manga-ink"]',needsImage:true,run:()=>document.querySelector('[data-quick-recipe="manga-ink"]')?.click()},
  "quick-recipe-soft-dream":{selector:'[data-quick-recipe="soft-dream"]',needsImage:true,run:()=>document.querySelector('[data-quick-recipe="soft-dream"]')?.click()},
  "add-drawing-layer":{selector:"#add-layer",needsImage:true,run:()=>document.querySelector("#add-layer")?.click()},
  "draw-tool":{selector:'.toolbar .tool[data-tool="brush"]',needsImage:false,run:()=>runEditGoal("draw")},
  "remove-background":{selector:"#remove-background",needsImage:true,run:()=>runEditGoal("background")},
  "color-adjustments":{selector:"#adjustments-title",needsImage:true,run:()=>runEditGoal("color")},
  "crop-image":{selector:"#crop-resize-image",needsImage:true,run:()=>runEditGoal("crop-image")},
  "creative-studio":{selector:"#creative-studio-open",needsImage:false,run:()=>runEditGoal("creative-studio")},
  "add-text":{selector:"#add-text-layer",needsImage:false,run:()=>runEditGoal("text")},
  "export-transparent":{selector:"#export-transparent-png",needsImage:true,run:()=>document.querySelector("#export-transparent-png")?.click()},
  "export-png":{selector:"#export-png",needsImage:true,run:()=>document.querySelector("#export-png")?.click()},
  "export-document":{selector:"#export-png",needsImage:false,run:()=>document.querySelector("#export-png")?.click()},
  "export-jpeg":{selector:"#export-png",needsImage:true,run:()=>{const format=document.querySelector("#export-format");if(format)format.value="jpeg";document.querySelector("#export-png")?.click();}}
 };
 const action=actionMap[actionId],flow=getGuidedFlow(activeGuidedFlowId),progress=currentGuidedProgress();
 if(!action||!flow||!getGuidedStep(flow.id,progress.stepIndex))return false;
 if(action.needsImage&&!focusGuidedImageLayer()){
  document.querySelector("#guided-step-notice").textContent="Esta acción necesita una capa de imagen desbloqueada. Importa o selecciona una antes de continuar.";return false;
 }
 const element=document.querySelector(action.selector);
 if(!element){document.querySelector("#guided-step-notice").textContent="Esta herramienta no está disponible en esta versión. No se ha simulado la operación.";return false;}
 if(element.disabled){document.querySelector("#guided-step-notice").textContent="Desbloquea la capa seleccionada y vuelve a abrir esta herramienta.";return false;}
 guidedProgressByFlow[flow.id]=recordGuidedActionLaunched(progress,flow.id);
 persistGuidedEditingState();guidedEditingDialog.close();action.run();return true;
}
document.querySelector("#guided-editing-open")?.addEventListener("click",openGuidedEditingDialog);
document.querySelector("#guided-editing-open-mobile")?.addEventListener("click",openGuidedEditingDialog);
document.querySelector("#guided-editing-close")?.addEventListener("click",()=>guidedEditingDialog.close());
document.querySelector("#guided-editing-cancel")?.addEventListener("click",()=>{persistGuidedEditingState();guidedEditingDialog.close();});
guidedEditingDialog?.addEventListener("close",persistGuidedEditingState);
guidedFlowSelect?.addEventListener("change",()=>{
 const nextFlowId=guidedFlowSelect.value;if(!getGuidedFlow(nextFlowId))return;
 activeGuidedFlowId=nextFlowId;persistGuidedEditingState();renderGuidedEditingDialog();
});
document.querySelector("#guided-step-action")?.addEventListener("click",()=>{
 const step=getGuidedStep(activeGuidedFlowId,currentGuidedProgress().stepIndex);if(step)launchGuidedStepAction(step.action);
});
document.querySelector("#guided-step-secondary")?.addEventListener("click",()=>{
 const step=getGuidedStep(activeGuidedFlowId,currentGuidedProgress().stepIndex);if(step?.secondaryAction)launchGuidedStepAction(step.secondaryAction.action);
});
document.querySelector("#guided-step-back")?.addEventListener("click",()=>{
 guidedProgressByFlow[activeGuidedFlowId]=goToPreviousGuidedStep(currentGuidedProgress(),activeGuidedFlowId);
 persistGuidedEditingState();renderGuidedEditingDialog();
});
document.querySelector("#guided-step-complete")?.addEventListener("click",()=>{
 try{
  guidedProgressByFlow[activeGuidedFlowId]=completeGuidedStep(currentGuidedProgress(),activeGuidedFlowId,state.document).progress;
  persistGuidedEditingState();renderGuidedEditingDialog();
 }catch(error){document.querySelector("#guided-step-notice").textContent=error.message||"Revisa el paso antes de continuar.";}
});

undoButton.addEventListener("click", undo);

document.querySelector("#selection-mini-lock")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer) return;
  applyLayerOperation(
    (doc, id) => setLayerLocked(doc, id, !layer.locked),
    layer.locked ? "Capa desbloqueada" : "Capa bloqueada",
    { allowLocked: true }
  );
});
document.querySelector("#selection-mini-back")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.locked) return;
  applyLayerOperation((doc, id) => reorderLayer(doc, id, "down"), "Capa enviada hacia atrás");
});
document.querySelector("#selection-mini-front")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.locked) return;
  applyLayerOperation((doc, id) => reorderLayer(doc, id, "up"), "Capa traída hacia adelante");
});
document.querySelector("#selection-mini-fit")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.locked || layer.contentType !== "image" || !layer.image) return;
  document.querySelector("#fit-image-to-canvas")?.click();
});
document.querySelector("#selection-mini-margin")?.addEventListener("click", () => {
  // Free movement needs visible pasteboard around the document, especially on phones
  // where fit-to-width makes the page touch the viewport edges.
  frameBoundaryMode = "free";
  frameBoundaryButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.frameBoundaryMode === "free"));
  });
  state.viewport = { ...state.viewport, zoom: 0.8, panX: 0, panY: 0 };
  redraw();
  const message = "Movimiento libre activado. Vista centrada con margen para sacar y recuperar capas.";
  if (window.matchMedia("(max-width: 920px)").matches) showMobileFeedback(message);
  else status.textContent = message;
});
document.querySelector("#selection-mini-background")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || (layer.locked && !layer.isBackground)) {
    status.textContent = "Seleccioná una imagen desbloqueada para fijarla como fondo.";
    return;
  }
  const wasBackground = Boolean(layer.isBackground);
  const before = cloneDocument(state.document);
  const next = setLayerBackground(state.document, layer.id, !wasBackground);
  if (!next) { status.textContent = "No se pudo cambiar el modo de fondo."; return; }
  state.document = next;
  setSelection([layer.id], layer.id);
  state.history.record(before, next);
  refreshDocument(wasBackground ? "La imagen volvió a ser una capa normal." : "Fondo fijado. Ya no se mueve por accidente; podés desfijarlo desde esta barra.");
  persistDocument();
});
document.querySelector("#selection-mini-delete")?.addEventListener("click", () => removeSelectedLayer());

document.querySelector("#magic-eraser-apply")?.addEventListener("click", applyMagicErasePreview);
document.querySelector("#magic-eraser-cancel")?.addEventListener("click", cancelMagicErasePreview);
document.querySelector("#magic-eraser-cancel-secondary")?.addEventListener("click", cancelMagicErasePreview);
document.querySelector("#magic-eraser-preview-dialog")?.addEventListener("cancel", () => { pendingMagicErase = null; });

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


document.querySelector("#add-meme-text").addEventListener("click", () => {
  const width = Math.max(300, state.document.width || canvas.width || 300);
  const height = Math.max(180, state.document.height || canvas.height || 180);
  const fontSize = Math.max(24, Math.min(88, Math.round(height * 0.105)));
  const outlineWidth = Math.max(2, Math.round(fontSize * 0.075));
  const top = createTextLayer("Meme Top", {
    value: "TOP TEXT", x: Math.round(width / 2), y: Math.round(height * 0.14),
    fontSize, fontFamily: "Impact", fontWeight: "bold", color: "#ffffff", align: "center",
    outlineColor: "#000000", outlineWidth
  });
  const bottom = createTextLayer("Meme Bottom", {
    value: "BOTTOM TEXT", x: Math.round(width / 2), y: Math.round(height * 0.9),
    fontSize, fontFamily: "Impact", fontWeight: "bold", color: "#ffffff", align: "center",
    outlineColor: "#000000", outlineWidth
  });
  const before = cloneDocument(state.document);
  let next = addLayer(state.document, top);
  if (!next) return;
  next = addLayer(next, bottom);
  if (!next) return;
  state.document = next;
  state.textPreview = null;
  setSelection([bottom.id], bottom.id);
  state.history.record(before, next);
  refreshDocument("Meme captions added. Edit each text layer in the inspector.");
  persistDocument();
});

document.querySelector("#add-text-layer").addEventListener("click", () => {
  activateSelectionToolForText();
  const index = state.document.layers.filter(layer => layer.contentType === "text").length + 1;
  const width = Math.max(300, state.document.width || canvas.width || 300);
  const height = Math.max(180, state.document.height || canvas.height || 180);
  const layer = createTextLayer("Text " + index, {
    value: "Escribe aquí",
    x: Math.round(width * 0.5),
    y: Math.round(height * 0.5),
    fontSize: Math.max(24, Math.min(64, Math.round(height * 0.1))),
    fontFamily: "Arial",
    fontWeight: "bold",
    color: "#ffffff",
    outlineColor: "#111318",
    outlineWidth: 2,
    align: "center"
  });
  const before = cloneDocument(state.document);
  const next = addLayer(state.document, layer);
  if (!next) return;
  state.document = next;
  state.textPreview = null;
  newlyCreatedTextLayerId = layer.id;
  setSelection([layer.id], layer.id);
  state.history.record(before, next);
  refreshDocument("Text layer added");
  persistDocument();
  renderLayerText();
  if (!showTextEditorDialog()) status.textContent = "Texto añadido. Seleccionalo y tocá Editar texto para continuar.";
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


function currentBackgroundRemovalSettings() {
  return {
    targetColor: document.querySelector("#background-removal-color").value,
    tolerance: Number(document.querySelector("#background-removal-tolerance").value),
    feather: Number(document.querySelector("#background-removal-feather").value),
    edgeSensitivity: Number(document.querySelector("#background-removal-edge-sensitivity").value),
    protectLineArt: document.querySelector("#background-removal-protect-line-art").checked,
    decontaminate: document.querySelector("#background-removal-decontaminate").checked,
    connectivity: "connected"
  };
}
function populateBackgroundRemovalProfiles(selectedId = "anime-ink") {
  const select = document.querySelector("#background-removal-profile");
  if (!select) return;
  const profiles = listBackgroundProfiles();
  select.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    select.append(option);
  }
  select.value = profiles.some(profile => profile.id === selectedId) ? selectedId : "anime-ink";
  document.querySelector("#delete-background-profile").disabled = !select.value.startsWith("custom-");
}
function applyBackgroundRemovalProfile(profileId, render = true) {
  const profile = listBackgroundProfiles().find(item => item.id === profileId) || BUILT_IN_BACKGROUND_PROFILES[0];
  const values = {
    "background-removal-color": profile.targetColor,
    "background-removal-tolerance": profile.tolerance,
    "background-removal-feather": profile.feather,
    "background-removal-edge-sensitivity": profile.edgeSensitivity
  };
  for (const [id, value] of Object.entries(values)) {
    const input = document.querySelector("#" + id);
    input.value = String(value);
    const output = document.querySelector("#" + id + "-value");
    if (output) output.textContent = String(value);
  }
  document.querySelector("#background-removal-protect-line-art").checked = profile.protectLineArt;
  document.querySelector("#background-removal-decontaminate").checked = profile.decontaminate;
  document.querySelector("#background-removal-profile-name").value = profile.name;
  document.querySelector("#delete-background-profile").disabled = !profile.id.startsWith("custom-");
  if (render && backgroundRemovalSession?.removalRequested) renderBackgroundRemovalPreview(true);
}
document.querySelector("#background-removal-profile").addEventListener("change", event => {
  applyBackgroundRemovalProfile(event.currentTarget.value);
});
document.querySelector("#save-background-profile").addEventListener("click", () => {
  try {
    const profile = saveBackgroundProfile(document.querySelector("#background-removal-profile-name").value, currentBackgroundRemovalSettings());
    populateBackgroundRemovalProfiles(profile.id);
    applyBackgroundRemovalProfile(profile.id);
    document.querySelector("#background-removal-status").textContent = "Perfil local guardado: " + profile.name;
  } catch (error) {
    document.querySelector("#background-removal-status").textContent = error.message || "No se pudo guardar el perfil de procesamiento."; 
  }
});
document.querySelector("#delete-background-profile").addEventListener("click", () => {
  const selectedId = document.querySelector("#background-removal-profile").value;
  if (!selectedId.startsWith("custom-")) return;
  if (!deleteBackgroundProfile(selectedId)) {
    document.querySelector("#background-removal-status").textContent = "No se pudo eliminar este perfil local."; 
    return;
  }
  populateBackgroundRemovalProfiles("anime-ink");
  applyBackgroundRemovalProfile("anime-ink");
  document.querySelector("#background-removal-status").textContent = "Perfil local eliminado."; 
});

function backgroundRemovalColorHex(data, offset) {
  return "#" + [data[offset], data[offset + 1], data[offset + 2]].map(value => Number(value).toString(16).padStart(2, "0")).join("");
}
function backgroundRemovalPoint(event) {
  const rect = backgroundRemovalCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(backgroundRemovalCanvas.width - 1, (event.clientX - rect.left) * backgroundRemovalCanvas.width / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(backgroundRemovalCanvas.height - 1, (event.clientY - rect.top) * backgroundRemovalCanvas.height / Math.max(1, rect.height)))
  };
}
function syncBackgroundRemovalApplyButton() {
  const button = document.querySelector("#apply-background-removal");
  const session = backgroundRemovalSession;
  if (button) button.disabled = backgroundRemovalProcessing || !session || (!session.removalRequested && session.strokes.length === 0);
}

function backgroundRemovalFitScale() {
  const session = backgroundRemovalSession;
  const wrap = document.querySelector(".background-removal-preview-wrap");
  if (!session || !wrap) return 1;
  const width = Math.max(1, wrap.clientWidth - 20);
  const height = Math.max(1, wrap.clientHeight - 20);
  return Math.max(0.01, Math.min(1, width / session.width, height / session.height));
}

function updateBackgroundRemovalZoom(nextZoom = backgroundRemovalZoom, { resetScroll = false } = {}) {
  const session = backgroundRemovalSession;
  const wrap = document.querySelector(".background-removal-preview-wrap");
  const zoomOut = document.querySelector("#background-removal-zoom-out");
  const zoomIn = document.querySelector("#background-removal-zoom-in");
  const zoomValue = document.querySelector("#background-removal-zoom-value");
  if (!session || !wrap) return;

  const oldRect = backgroundRemovalCanvas.getBoundingClientRect();
  const oldScale = oldRect.width > 0 ? oldRect.width / session.width : backgroundRemovalFitScale() * backgroundRemovalZoom;
  const focusX = oldScale > 0 ? (wrap.scrollLeft + wrap.clientWidth / 2) / oldScale : session.width / 2;
  const focusY = oldScale > 0 ? (wrap.scrollTop + wrap.clientHeight / 2) / oldScale : session.height / 2;
  backgroundRemovalZoom = Math.min(8, Math.max(1, Number(nextZoom) || 1));
  const scale = backgroundRemovalFitScale() * backgroundRemovalZoom;
  backgroundRemovalCanvas.style.width = Math.max(1, Math.round(session.width * scale)) + "px";
  backgroundRemovalCanvas.style.height = Math.max(1, Math.round(session.height * scale)) + "px";
  wrap.classList.toggle("is-zoomed", backgroundRemovalZoom > 1.001);

  if (zoomOut) zoomOut.disabled = backgroundRemovalZoom <= 1.001;
  if (zoomIn) zoomIn.disabled = backgroundRemovalZoom >= 7.999;
  if (zoomValue) zoomValue.textContent = backgroundRemovalZoom <= 1.001
    ? "Ajustar"
    : Math.round(backgroundRemovalZoom * 100) + "%";

  requestAnimationFrame(() => {
    if (resetScroll || backgroundRemovalZoom <= 1.001) {
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
      return;
    }
    const nextScale = backgroundRemovalCanvas.getBoundingClientRect().width / session.width;
    wrap.scrollLeft = Math.max(0, focusX * nextScale - wrap.clientWidth / 2);
    wrap.scrollTop = Math.max(0, focusY * nextScale - wrap.clientHeight / 2);
  });
}

document.querySelector("#background-removal-zoom-out")?.addEventListener("click", () => {
  updateBackgroundRemovalZoom(backgroundRemovalZoom / 1.5);
});
document.querySelector("#background-removal-zoom-in")?.addEventListener("click", () => {
  updateBackgroundRemovalZoom(backgroundRemovalZoom * 1.5);
});
document.querySelector("#background-removal-zoom-fit")?.addEventListener("click", () => {
  updateBackgroundRemovalZoom(1, { resetScroll: true });
});
window.addEventListener("resize", () => {
  if (backgroundRemovalDialog?.open && backgroundRemovalSession) updateBackgroundRemovalZoom(backgroundRemovalZoom);
});

let backgroundPreviewRevision = 0;
let backgroundPreviewRenderedRevision = 0;
let backgroundPreviewRunning = false;
let backgroundPreviewNeedsRecompute = false;
let backgroundRemovalProcessing = false;

function renderBackgroundRemovalPreview(recompute = false) {
  backgroundPreviewRevision += 1;
  if (recompute) backgroundPreviewNeedsRecompute = true;
  if (!backgroundPreviewRunning) void pumpBackgroundRemovalPreview();
}

async function pumpBackgroundRemovalPreview() {
  if (backgroundPreviewRunning) return;
  backgroundPreviewRunning = true;
  backgroundRemovalProcessing = true;
  syncBackgroundRemovalApplyButton();
  try {
    while (backgroundRemovalSession && backgroundRemovalContext) {
      const session = backgroundRemovalSession;
      const revision = backgroundPreviewRevision;
      const shouldRecompute = backgroundPreviewNeedsRecompute;
      backgroundPreviewNeedsRecompute = false;
      let automatic = session.automatic;
      try {
        if (session.removalRequested && (shouldRecompute || !automatic || automatic === session.original)) {
          document.querySelector("#background-removal-status").textContent = "Procesando la vista previa en segundo plano…";
          automatic = await runImageProcessing("remove-connected-background", session.original, {
            targetColor: document.querySelector("#background-removal-color").value,
            tolerance: Number(document.querySelector("#background-removal-tolerance").value),
            feather: Number(document.querySelector("#background-removal-feather").value),
            edgeSensitivity: Number(document.querySelector("#background-removal-edge-sensitivity").value),
            protectLineArt: document.querySelector("#background-removal-protect-line-art").checked,
            decontaminate: document.querySelector("#background-removal-decontaminate").checked
          });
          if (session !== backgroundRemovalSession) continue;
          session.automatic = automatic;
        }
        const base = session.removalRequested ? (automatic || session.original) : session.original;
        const result = session.strokes.length
          ? await runImageProcessing("apply-erase-strokes", base, { strokes: session.strokes })
          : base;
        if (session !== backgroundRemovalSession || revision !== backgroundPreviewRevision) continue;
        backgroundRemovalContext.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
        document.querySelector("#background-removal-status").textContent = session.removalRequested
          ? "Vista previa del borrado · " + result.width + " × " + result.height + " px. No se aplica hasta pulsar Aplicar."
          : session.strokes.length
            ? "La imagen original sigue intacta; hay " + session.strokes.length + " trazo(s) manual(es) en la vista previa."
            : "Imagen original intacta. Pulsa “Previsualizar quitar fondo” para generar la transparencia.";
        document.querySelector("#undo-background-erase").disabled = session.strokes.length === 0;
        backgroundPreviewRenderedRevision = revision;
        break;
      } catch (error) {
        if (session !== backgroundRemovalSession || revision !== backgroundPreviewRevision) continue;
        document.querySelector("#background-removal-status").textContent = error.message || "No se pudo procesar esta imagen";
        backgroundPreviewRenderedRevision = revision;
        break;
      }
    }
  } finally {
    backgroundPreviewRunning = false;
    backgroundRemovalProcessing = false;
    syncBackgroundRemovalApplyButton();
    if (backgroundRemovalSession && backgroundPreviewRenderedRevision !== backgroundPreviewRevision) {
      void pumpBackgroundRemovalPreview();
    }
  }
}
async function openBackgroundRemoval() {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image || layer.locked) return;
  try {
    if (layer.image.width * layer.image.height > 16000000) {
      throw new RangeError("Background removal is limited to 16 megapixels. Resize the image first.");
    }
    const image = await new Promise((resolve, reject) => {
      const cached = imageCache.get(layer.image.source);
      if (cached && cached.complete && cached.naturalWidth > 0) { resolve(cached); return; }
      const candidate = cached || new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error("Could not decode the selected image"));
      candidate.src = layer.image.source;
      imageCache.set(layer.image.source, candidate);
    });
    const width = layer.image.width, height = layer.image.height;
    backgroundRemovalCanvas.width = width;
    backgroundRemovalCanvas.height = height;
    backgroundRemovalContext.clearRect(0, 0, width, height);
    backgroundRemovalContext.drawImage(image, 0, 0, width, height);
    const original = backgroundRemovalContext.getImageData(0, 0, width, height);
    backgroundRemovalSession = { layerId: layer.id, source: layer.image.source, width, height, original, automatic: original, removalRequested: false, strokes: [], activeStroke: null };
    backgroundRemovalZoom = 1;
    backgroundRemovalPan = null;
    backgroundRemovalSampleMode = false;
    document.querySelector("#background-removal-manual").checked = false;
    document.querySelector("#background-removal-color").value = "#ffffff";
    document.querySelector("#background-removal-tolerance").value = "36";
    document.querySelector("#background-removal-tolerance-value").textContent = "36";
    document.querySelector("#background-removal-feather").value = "18";
    document.querySelector("#background-removal-feather-value").textContent = "18";
    document.querySelector("#background-removal-edge-sensitivity").value = "42";
    document.querySelector("#background-removal-edge-sensitivity-value").textContent = "42";
    document.querySelector("#background-removal-protect-line-art").checked = true;
    document.querySelector("#background-removal-decontaminate").checked = true;
    populateBackgroundRemovalProfiles("anime-ink");
    applyBackgroundRemovalProfile("anime-ink", false);
    document.querySelector("#background-removal-brush-size").value = "28";
    document.querySelector("#background-removal-brush-size-value").textContent = "28 px";
    backgroundRemovalDialog.showModal();
    updateBackgroundRemovalZoom(1, { resetScroll: true });
    renderBackgroundRemovalPreview(false);
  } catch (error) {
    status.textContent = error.message || "Could not open background removal";
  }
}
if (removeBackgroundButton) removeBackgroundButton.addEventListener("click", openBackgroundRemoval);
document.querySelector("#cancel-background-removal").addEventListener("click", () => {
  backgroundRemovalDialog.close();
  backgroundRemovalSession = null;
  backgroundRemovalSampleMode = false;
  backgroundRemovalZoom = 1;
  backgroundRemovalPan = null;
});
function setQuickBackgroundColor(color, tolerance, feather) {
  if (backgroundRemovalSession) backgroundRemovalSession.removalRequested = true;
  const colorInput = document.querySelector("#background-removal-color");
  const toleranceInput = document.querySelector("#background-removal-tolerance");
  const featherInput = document.querySelector("#background-removal-feather");
  colorInput.value = color;
  toleranceInput.value = String(tolerance);
  featherInput.value = String(feather);
  document.querySelector("#background-removal-tolerance-value").textContent = String(tolerance);
  document.querySelector("#background-removal-feather-value").textContent = String(feather);
  document.querySelector("#background-removal-status").textContent = "Revisá la vista previa; los píxeles transparentes se aplican solo al pulsar Aplicar.";
  backgroundRemovalSampleMode = false;
  renderBackgroundRemovalPreview(true);
}
document.querySelector("#preview-background-removal")?.addEventListener("click", () => {
  if (!backgroundRemovalSession) return;
  backgroundRemovalSession.removalRequested = true;
  renderBackgroundRemovalPreview(true);
});
document.querySelector("#background-auto-detect")?.addEventListener("click", () => {
  const image = backgroundRemovalSession?.original;
  if (!image || image.width < 1 || image.height < 1) return;
  const points = [[0,0],[image.width-1,0],[0,image.height-1],[image.width-1,image.height-1],[Math.floor(image.width/2),0]];
  const colors = new Map();
  for (const [x,y] of points) {
    const i=(y*image.width+x)*4;
    if (image.data[i+3] < 24) continue;
    const color="#" + [image.data[i],image.data[i+1],image.data[i+2]].map(v=>v.toString(16).padStart(2,"0")).join("");
    colors.set(color,(colors.get(color)||0)+1);
  }
  const color=[...colors.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || "#ffffff";
  setQuickBackgroundColor(color, 46, 20);
});
document.querySelector("#background-preset-white")?.addEventListener("click", () => setQuickBackgroundColor("#ffffff", 46, 20));
document.querySelector("#background-preset-dark")?.addEventListener("click", () => setQuickBackgroundColor("#101014", 52, 18));
document.querySelector("#sample-background-color").addEventListener("click", () => {
  backgroundRemovalSampleMode = true;
  document.querySelector("#background-removal-manual").checked = false;
  document.querySelector("#background-removal-status").textContent = "Ahora tocá el color del fondo dentro de la vista previa. Después revisá el resultado.";
});
for (const id of ["background-removal-color", "background-removal-tolerance", "background-removal-feather", "background-removal-edge-sensitivity", "background-removal-protect-line-art", "background-removal-decontaminate"]) {
  document.querySelector("#" + id).addEventListener("input", () => {
    const input = document.querySelector("#" + id);
    const output = document.querySelector("#" + id + "-value");
    if (output) output.textContent = input.type === "checkbox" ? (input.checked ? "On" : "Off") : input.value;
    renderBackgroundRemovalPreview(true);
  });
}
document.querySelector("#background-removal-brush-size").addEventListener("input", event => {
  document.querySelector("#background-removal-brush-size-value").textContent = event.currentTarget.value + " px";
});
document.querySelector("#undo-background-erase").addEventListener("click", () => {
  if (!backgroundRemovalSession) return;
  backgroundRemovalSession.strokes.pop();
  renderBackgroundRemovalPreview(false);
});
document.querySelector("#clear-background-erase").addEventListener("click", () => {
  if (!backgroundRemovalSession) return;
  backgroundRemovalSession.strokes = [];
  renderBackgroundRemovalPreview(false);
});
backgroundRemovalCanvas.addEventListener("pointerdown", event => {
  if (!backgroundRemovalSession) return;
  const point = backgroundRemovalPoint(event);
  if (backgroundRemovalSampleMode) {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    const offset = (y * backgroundRemovalSession.width + x) * 4;
    document.querySelector("#background-removal-color").value = backgroundRemovalColorHex(backgroundRemovalSession.original.data, offset);
    backgroundRemovalSampleMode = false;
    backgroundRemovalSession.removalRequested = true;
    renderBackgroundRemovalPreview(true);
    return;
  }
  if (!document.querySelector("#background-removal-manual").checked) {
    if (backgroundRemovalZoom > 1.001) {
      const wrap = document.querySelector(".background-removal-preview-wrap");
      backgroundRemovalPan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: wrap.scrollLeft,
        scrollTop: wrap.scrollTop
      };
      event.preventDefault();
      backgroundRemovalCanvas.setPointerCapture(event.pointerId);
    }
    return;
  }
  event.preventDefault();
  backgroundRemovalPointerId = event.pointerId;
  backgroundRemovalCanvas.setPointerCapture(event.pointerId);
  backgroundRemovalSession.activeStroke = { size: Number(document.querySelector("#background-removal-brush-size").value), points: [point] };
  backgroundRemovalSession.strokes.push(backgroundRemovalSession.activeStroke);
  renderBackgroundRemovalPreview(false);
});
backgroundRemovalCanvas.addEventListener("pointermove", event => {
  if (backgroundRemovalPan?.pointerId === event.pointerId) {
    const wrap = document.querySelector(".background-removal-preview-wrap");
    wrap.scrollLeft = backgroundRemovalPan.scrollLeft - (event.clientX - backgroundRemovalPan.startX);
    wrap.scrollTop = backgroundRemovalPan.scrollTop - (event.clientY - backgroundRemovalPan.startY);
    return;
  }
  if (!backgroundRemovalSession || backgroundRemovalPointerId !== event.pointerId || !backgroundRemovalSession.activeStroke) return;
  backgroundRemovalSession.activeStroke.points.push(backgroundRemovalPoint(event));
  renderBackgroundRemovalPreview(false);
});
function finishBackgroundRemovalStroke(event) {
  if (backgroundRemovalPan?.pointerId === event.pointerId) {
    backgroundRemovalPan = null;
    return;
  }
  if (backgroundRemovalPointerId !== event.pointerId) return;
  backgroundRemovalPointerId = null;
  if (backgroundRemovalSession) backgroundRemovalSession.activeStroke = null;
  renderBackgroundRemovalPreview(false);
}
backgroundRemovalCanvas.addEventListener("pointerup", finishBackgroundRemovalStroke);
backgroundRemovalCanvas.addEventListener("pointercancel", finishBackgroundRemovalStroke);
document.querySelector("#apply-background-removal").addEventListener("click", async () => {
  const session = backgroundRemovalSession;
  const layer = session && state.document.layers.find(item => item.id === session.layerId);
  if (!session || (!session.removalRequested && session.strokes.length === 0)) return;
  if (!layer || layer.locked || layer.contentType !== "image" || layer.image?.source !== session.source) {
    document.querySelector("#background-removal-status").textContent = "The selected layer changed. Close this tool and reopen it.";
    return;
  }
  try {
    const automatic = session.removalRequested
      ? removeConnectedBackground(session.original, currentBackgroundRemovalSettings())
      : session.original;
    const result = applyEraseStrokes(automatic, session.strokes);
    backgroundRemovalContext.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
    const source = backgroundRemovalCanvas.toDataURL("image/webp", 0.88);
    const optimized = await optimizeImageSource(source);
    const before = cloneDocument(state.document);
    const next = replaceImageLayer(state.document, layer.id, { source: optimized.source, width: optimized.width, height: optimized.height }, { preserveDisplaySize: true });
    if (!next) throw new Error("The edited image exceeds the document's image limit. Resize it and try again.");
    imageCache.delete(session.source);
    state.document = next;
    state.history.record(before, next);
    state.dirty = true;
    refreshDocument("Background removed · transparent pixels applied");
    persistDocument();
    backgroundRemovalDialog.close();
    backgroundRemovalSession = null;
    backgroundRemovalSampleMode = false;
  } catch (error) {
    document.querySelector("#background-removal-status").textContent = error.message || "Could not apply transparency";
  }
});


function pixelHex(data, offset) { return "#" + [data[offset],data[offset+1],data[offset+2]].map(v=>v.toString(16).padStart(2,"0")).join(""); }
let recolorPreviewRevision = 0;
let recolorPreviewRenderedRevision = 0;
let recolorPreviewRunning = false;
let recolorPreviewResult = null;
let recolorPreviewKey = null;
function currentRecolorOptions() {
 // Global recolor protects high-contrast line art by default. An explicit anime selection mask
 // remains authoritative, allowing dark hair/clothing fills to be recolored without selecting outlines.
 return {
  sourceColor: recolorSession?.sourceColor || "#806050",
  targetColor: document.querySelector("#recolor-target-color").value,
  tolerance: Number(document.querySelector("#recolor-tolerance").value),
  softness: Number(document.querySelector("#recolor-softness").value),
  preserveShading: document.querySelector("#recolor-preserve-shading").checked,
  preserveLineArt: true,
  temperature: Number(document.querySelector("#recolor-temperature").value),
  darkness: Number(document.querySelector("#recolor-darkness").value),
  hueShift: Number(document.querySelector("#recolor-hue-shift").value),
  selectionMask: recolorSession?.selectionMask || null,
  animeRecolor: Boolean(recolorSession?.selectionMask)
 };
}
function recolorOptionsKey(session, options) {
 return JSON.stringify([session?.layerId, session?.source, session?.selectionVersion || 0, options.sourceColor, options.targetColor, options.tolerance, options.softness, options.preserveShading, options.temperature, options.darkness, options.hueShift]);
}
function renderRecolorPreview() {
 recolorPreviewRevision += 1;
 if (!recolorPreviewRunning) void pumpRecolorPreview();
}
async function pumpRecolorPreview() {
 if (recolorPreviewRunning) return;
 recolorPreviewRunning = true;
 const applyButton = document.querySelector("#apply-recolor");
 if (applyButton) applyButton.disabled = true;
 try {
  while (recolorSession && recolorContext) {
   const revision = recolorPreviewRevision;
   const session = recolorSession;
   const options = currentRecolorOptions();
   const key = recolorOptionsKey(session, options);
   try {
    document.querySelector("#recolor-status").textContent = session.sourceColor
      ? "Procesando la vista previa en segundo plano…"
      : "Elige «Muestra de color» y toca un tono de la imagen.";
    const result = session.sourceColor
      ? await runImageProcessing("replace-color-range", session.original, options)
      : session.original;
    if (session !== recolorSession || revision !== recolorPreviewRevision) continue;
    recolorContext.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);
    recolorPreviewResult = result;
    recolorPreviewKey = key;
    document.querySelector("#recolor-tolerance-value").textContent = document.querySelector("#recolor-tolerance").value;
    document.querySelector("#recolor-softness-value").textContent = document.querySelector("#recolor-softness").value;
    document.querySelector("#recolor-temperature-value").textContent = document.querySelector("#recolor-temperature").value;
    document.querySelector("#recolor-darkness-value").textContent = document.querySelector("#recolor-darkness").value;
    document.querySelector("#recolor-hue-shift-value").textContent = document.querySelector("#recolor-hue-shift").value;
    document.querySelector("#recolor-status").textContent = session.sourceColor
      ? "Vista previa lista. El sombreado y la transparencia se conservan."
      : "Elige «Muestra de color» y toca un tono de la imagen.";
    recolorPreviewRenderedRevision = revision;
    break;
   } catch (error) {
    if (session !== recolorSession || revision !== recolorPreviewRevision) continue;
    document.querySelector("#recolor-status").textContent = error.message || "Preview failed";
    recolorPreviewRenderedRevision = revision;
    break;
   }
  }
 } finally {
  recolorPreviewRunning = false;
  if (applyButton) applyButton.disabled = !recolorSession?.sourceColor || recolorPreviewRenderedRevision !== recolorPreviewRevision;
  if (recolorSession && recolorPreviewRenderedRevision !== recolorPreviewRevision) void pumpRecolorPreview();
 }
}
async function openRecolorTool() {
 const layer=selectedLayerExact();if(!layer||layer.contentType!=="image"||!layer.image||layer.locked)return;
 try {
  if(layer.image.width*layer.image.height>16000000)throw new RangeError("Color replacement is limited to 16 megapixels. Resize the image first.");
  const image=await new Promise((resolve,reject)=>{const cached=imageCache.get(layer.image.source);if(cached&&cached.complete&&cached.naturalWidth>0){resolve(cached);return;}const candidate=cached||new Image();candidate.onload=()=>resolve(candidate);candidate.onerror=()=>reject(new Error("Could not decode the selected image"));candidate.src=layer.image.source;imageCache.set(layer.image.source,candidate);});
  const width=layer.image.width,height=layer.image.height;recolorCanvas.width=width;recolorCanvas.height=height;recolorContext.clearRect(0,0,width,height);recolorContext.drawImage(image,0,0,width,height);
  recolorSession={layerId:layer.id,source:layer.image.source,original:recolorContext.getImageData(0,0,width,height),sourceColor:null,selectionMask:null,selectionVersion:0};recolorSampleMode=false;recolorWandMode=false;recolorRegionSelectionMode="replace";
  document.querySelector("#recolor-source-color").value="#806050";document.querySelector("#recolor-target-color").value="#C62845";document.querySelector("#recolor-tolerance").value="36";document.querySelector("#recolor-softness").value="28";document.querySelector("#recolor-preserve-shading").checked=true;
  document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed","false");recolorRectangleMode=false;recolorRectangleStart=null;recolorWandMode=false;document.querySelector("#recolor-effect-layer").checked=true;document.querySelector("#recolor-wand-add").checked=false;syncAnimeRegionModeButtons();document.querySelector("#recolor-wand-tolerance").value="28";document.querySelector("#recolor-wand-tolerance-value").textContent="28";document.querySelector("#recolor-temperature").value="0";document.querySelector("#recolor-darkness").value="0";document.querySelector("#recolor-hue-shift").value="0";document.querySelector("#recolor-selection-status").textContent="Sin zona seleccionada. Usa la varita y toca una zona plana del dibujo anime.";
  document.querySelector("#anime-color-search").value="";animePalettePage=0;renderAnimeColorResults();syncAnimeSelectionControls();
  recolorDialog.showModal();renderRecolorPreview();
 } catch(error){status.textContent=error.message||"No se pudo abrir la herramienta de color";}
}
if(recolorButton)recolorButton.addEventListener("click",openRecolorTool);
function closeRecolorTool(){recolorPreviewRevision += 1; recolorDialog.close();recolorSession=null;recolorSampleMode=false;recolorWandMode=false;recolorRegionSelectionMode="replace";syncAnimeRegionModeButtons();recolorRectangleMode=false;recolorRectangleStart=null;recolorPreviewResult=null;recolorPreviewKey=null;document.querySelector("#apply-recolor").disabled=true;document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-preview").style.cursor="default";if(animeSelectionOverlay)animeSelectionOverlay.hidden=true;}
document.querySelector("#cancel-recolor").addEventListener("click",closeRecolorTool);
document.querySelector("#cancel-recolor-bottom").addEventListener("click",closeRecolorTool);
document.querySelector("#sample-recolor-source").addEventListener("click",()=>{recolorSampleMode=true;recolorWandMode=false;document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-status").textContent="Toca un color en la vista previa para tomarlo como muestra.";});
const animeGeneratedPalette = generateAnimePalette();
let animePalettePage = 0;
const ANIME_PALETTE_PAGE_SIZE = 48;
function renderAnimeColorResults(){
 const input=document.querySelector("#anime-color-search"),container=document.querySelector("#anime-color-results"),more=document.querySelector("#anime-color-more"),previous=document.querySelector("#anime-color-previous"),pageLabel=document.querySelector("#anime-color-page");
 if(!input||!container)return;
 const query=input.value.trim();
 let choices=[];
 if(query){
  choices=searchAnimeColors(query,40);
  const hexQuery=query.replace(/^#/,"").toLowerCase();
  if(/^[0-9a-f]{2,6}$/i.test(hexQuery)){
   const hexMatches=animeGeneratedPalette.filter(color=>color.hex.toLowerCase().includes(hexQuery)).slice(0,40);
   const seen=new Set(choices.map(color=>color.hex.toLowerCase()));
   for(const color of hexMatches)if(!seen.has(color.hex.toLowerCase())){choices.push(color);seen.add(color.hex.toLowerCase());}
  }
  choices=choices.slice(0,48);
  more.hidden=true;previous.hidden=true;pageLabel.hidden=true;
 }else{
  choices=[...ANIME_COLOR_PRESETS.slice(0,18),...animeGeneratedPalette.slice(animePalettePage*ANIME_PALETTE_PAGE_SIZE,(animePalettePage+1)*ANIME_PALETTE_PAGE_SIZE)];
  more.hidden=animePalettePage>=(Math.ceil(animeGeneratedPalette.length/ANIME_PALETTE_PAGE_SIZE)-1);
  previous.hidden=animePalettePage===0;
  pageLabel.hidden=false;
  pageLabel.textContent="Tonos "+(animePalettePage+1)+" de "+Math.ceil(animeGeneratedPalette.length/ANIME_PALETTE_PAGE_SIZE);
 }
 container.replaceChildren();container.dataset.search=query?"true":"false";
 for(const color of choices){
  const button=document.createElement("button");button.type="button";button.className="anime-color-swatch"+(color.generated?" is-generated":"");
  button.style.setProperty("--anime-swatch",color.hex);button.setAttribute("aria-label",color.name+": "+color.hex);button.title=color.name+" · "+color.hex;
  const patch=document.createElement("span");patch.className="anime-color-swatch-patch";
  const label=document.createElement("span");label.className="anime-color-swatch-label";label.textContent=color.generated?color.hex:color.name;
  button.append(patch,label);
  button.addEventListener("click",()=>{document.querySelector("#recolor-target-color").value=color.hex.toLowerCase();renderRecolorPreview();document.querySelector("#recolor-status").textContent="Color elegido: "+color.name+" ("+color.hex+"). La imagen original se conserva hasta Aplicar.";});
  container.append(button);
 }
 if(!choices.length){const empty=document.createElement("p");empty.className="anime-color-empty";empty.textContent="No encontramos ese nombre. Prueba «marrón claro», «rubio miel» o pega un código HEX.";container.append(empty);}
}
document.querySelector("#anime-color-search").addEventListener("input",renderAnimeColorResults);
document.querySelector("#anime-color-more").addEventListener("click",()=>{animePalettePage=Math.min(Math.ceil(animeGeneratedPalette.length/ANIME_PALETTE_PAGE_SIZE)-1,animePalettePage+1);renderAnimeColorResults();});
document.querySelector("#anime-color-previous").addEventListener("click",()=>{animePalettePage=Math.max(0,animePalettePage-1);renderAnimeColorResults();});
function syncAnimeRegionModeButtons(){
 const modes=[["select-anime-region","replace"],["recolor-add-region","add"],["recolor-subtract-region","subtract"]];
 for(const [id,mode] of modes){const button=document.querySelector("#"+id);if(button)button.setAttribute("aria-pressed",String(recolorRegionSelectionMode===mode));}
}
function armRecolorRegionSelection(mode="replace"){
 if(!["replace","add","subtract"].includes(mode))mode="replace";
 recolorRegionSelectionMode=mode;recolorWandMode=true;recolorSampleMode=false;recolorRectangleMode=false;recolorRectangleStart=null;
 document.querySelector("#recolor-wand-add").checked=mode==="add";
 document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","true");
 document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed","false");
 document.querySelector("#recolor-preview").style.cursor="crosshair";
 syncAnimeRegionModeButtons();
 const status={
  replace:"Varita activa: toca una zona para reemplazar la selección actual.",
  add:"Sumar zona activo: toca más regiones para agregarlas a la selección.",
  subtract:"Restar zona activo: toca una región para quitarla de la selección actual."
 };
 document.querySelector("#recolor-status").textContent=status[mode];
}
document.querySelector("#recolor-wand-toggle").addEventListener("click",()=>{
 if(recolorWandMode){recolorWandMode=false;document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-preview").style.cursor="default";document.querySelector("#recolor-status").textContent="Varita pausada.";return;}
 armRecolorRegionSelection(recolorRegionSelectionMode);
});
for(const [id,mode] of [["select-anime-region","replace"],["recolor-add-region","add"],["recolor-subtract-region","subtract"]]){
 document.querySelector("#"+id).addEventListener("click",()=>armRecolorRegionSelection(mode));
}
document.querySelector("#recolor-wand-add").addEventListener("change",event=>{
 recolorRegionSelectionMode=event.currentTarget.checked?"add":"replace";
 syncAnimeRegionModeButtons();
 if(recolorWandMode)document.querySelector("#recolor-status").textContent=recolorRegionSelectionMode==="add"?"Suma de zonas activa: toca otra región para agregarla.":"Varita activa: la próxima zona reemplazará la selección.";
});

function applyAnimeRegionSelection(nextMask,sourceColor,pixelCount){
 const session=recolorSession;if(!session||!(nextMask instanceof Uint8Array))return null;
 if(recolorRegionSelectionMode==="subtract"&&!session.selectionMask){
  document.querySelector("#recolor-status").textContent="Primero selecciona una zona; después podrás restar regiones.";
  return null;
 }
 const nextRegion={width:session.original.width,height:session.original.height,mask:nextMask,sourceColor:sourceColor||null};
 let result;
 if(recolorRegionSelectionMode==="replace"||!session.selectionMask){
  result={mask:new Uint8Array(nextMask),selectedPixels:countAnimeSelection(nextMask)};
 }else{
  const currentRegion={width:session.original.width,height:session.original.height,mask:session.selectionMask,sourceColor:session.sourceColor||null};
  const combined=combineAnimeRegionSelections(currentRegion,nextRegion,recolorRegionSelectionMode);
  result={mask:combined.mask,selectedPixels:combined.selectedPixels};
  if(recolorRegionSelectionMode==="subtract"&&result.selectedPixels===0){
   document.querySelector("#recolor-status").textContent="La resta eliminaría toda la selección. Conservé la zona anterior.";
   return null;
  }
 }
 session.selectionMask=result.mask;
 session.selectionVersion=(session.selectionVersion||0)+1;
 if(recolorRegionSelectionMode!=="subtract"||!session.sourceColor)session.sourceColor=sourceColor||session.sourceColor;
 syncAnimeRegionModeButtons();
 return result;
}
function syncAnimeSelectionControls(){
 const count=countAnimeSelection(recolorSession?.selectionMask);
 const split=document.querySelector("#recolor-split-layer"),clear=document.querySelector("#recolor-wand-clear");
 if(split)split.disabled=count===0;
 if(clear)clear.disabled=count===0;
 const status=document.querySelector("#recolor-selection-status");
 if(status)status.textContent=count?count.toLocaleString("es-AR")+" píxeles de la imagen seleccionados. Puedes añadir otra zona o separarla en una capa.":"Sin zona seleccionada. La varita funciona mejor en rellenos planos con bordes oscuros.";
}
function clearAnimeRegionSelection(){
 if(!recolorSession)return;
 recolorSession.selectionMask=null;recolorSession.selectionVersion=(recolorSession.selectionVersion||0)+1;
 recolorRegionSelectionMode="replace";document.querySelector("#recolor-wand-add").checked=false;syncAnimeRegionModeButtons();
 if(animeSelectionOverlay)animeSelectionOverlay.hidden=true;
 syncAnimeSelectionControls();renderRecolorPreview();
 document.querySelector("#recolor-status").textContent="Selección de zona limpiada. La muestra de color sigue disponible.";
}
document.querySelector("#recolor-wand-clear").addEventListener("click",clearAnimeRegionSelection);
document.querySelector("#clear-anime-region-selection").addEventListener("click",clearAnimeRegionSelection);
function getAnimeSelectionOverlay(){
 if(animeSelectionOverlay)return animeSelectionOverlay;
 const wrapper=recolorCanvas?.parentElement;if(!wrapper)return null;
 wrapper.classList.add("anime-rectangle-selection-host");
 animeSelectionOverlay=document.createElement("div");animeSelectionOverlay.id="recolor-selection-rectangle";animeSelectionOverlay.hidden=true;animeSelectionOverlay.setAttribute("aria-hidden","true");wrapper.append(animeSelectionOverlay);return animeSelectionOverlay;
}
function updateAnimeRectangleOverlay(start,end){
 const overlay=getAnimeSelectionOverlay();if(!overlay||!start||!end)return;
 const wrapper=recolorCanvas.parentElement,wrapperRect=wrapper.getBoundingClientRect(),wrapperStyle=getComputedStyle(wrapper);
 const borderLeft=Number.parseFloat(wrapperStyle.borderLeftWidth)||0,borderTop=Number.parseFloat(wrapperStyle.borderTopWidth)||0;
 const left=start.display.drawnLeft+Math.min(start.x,end.x)*start.display.scale;
 const top=start.display.drawnTop+Math.min(start.y,end.y)*start.display.scale;
 const width=(Math.abs(end.x-start.x)+1)*start.display.scale,height=(Math.abs(end.y-start.y)+1)*start.display.scale;
 overlay.style.left=(left-wrapperRect.left-borderLeft)+"px";overlay.style.top=(top-wrapperRect.top-borderTop)+"px";
 overlay.style.width=Math.max(1,width)+"px";overlay.style.height=Math.max(1,height)+"px";overlay.hidden=false;
}
function finishAnimeRectangleSelection(start,end){
 const session=recolorSession;
 if(!session||!start||!end)return;
 const region=selectAnimeRectangle(session.original,{x1:start.x,y1:start.y,x2:end.x,y2:end.y});
 if(!region.pixelCount){document.querySelector("#recolor-status").textContent="El rectángulo no contiene píxeles visibles. Prueba una zona que cubra el dibujo.";if(animeSelectionOverlay)animeSelectionOverlay.hidden=true;return;}
 const combined=applyAnimeRegionSelection(region.mask,region.seedColor,region.pixelCount);
 if(!combined)return;
 document.querySelector("#recolor-source-color").value=session.sourceColor||region.seedColor;
 syncAnimeSelectionControls();renderRecolorPreview();document.querySelector("#recolor-status").textContent="Área rectangular procesada: "+combined.selectedPixels.toLocaleString("es-AR")+" píxeles seleccionados. Ajusta color, temperatura u oscuridad.";
}
document.querySelector("#recolor-rectangle-toggle").addEventListener("click",()=>{
 recolorRectangleMode=!recolorRectangleMode;recolorWandMode=false;recolorSampleMode=false;recolorRectangleStart=null;
 document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed",String(recolorRectangleMode));
 document.querySelector("#recolor-preview").style.cursor=recolorRectangleMode?"crosshair":"default";
 document.querySelector("#recolor-status").textContent=recolorRectangleMode?"Arrastra sobre la imagen para delimitar el área del efecto.":"Selección rectangular pausada.";
});
recolorCanvas.addEventListener("pointerdown",event=>{
 if(!recolorRectangleMode||!recolorSession)return;
 const point=recolorCanvasPointFromClient(event);if(!point)return;
 event.preventDefault();recolorRectangleStart={x:point.x,y:point.y,display:point};
 try{recolorCanvas.setPointerCapture(event.pointerId);}catch{}
 updateAnimeRectangleOverlay(recolorRectangleStart,recolorRectangleStart);
});
recolorCanvas.addEventListener("pointermove",event=>{
 if(!recolorRectangleMode||!recolorRectangleStart)return;
 const point=recolorCanvasPointFromClient(event);if(!point)return;
 updateAnimeRectangleOverlay(recolorRectangleStart,{x:point.x,y:point.y,display:point});
});
function completeAnimeRectanglePointer(event){
 if(!recolorRectangleMode||!recolorRectangleStart)return;
 const start=recolorRectangleStart,point=recolorCanvasPointFromClient(event);
 recolorRectangleStart=null;recolorRectangleMode=false;
 document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-preview").style.cursor="default";
 try{if(point)finishAnimeRectangleSelection(start,{x:point.x,y:point.y,display:point});}
 catch(error){document.querySelector("#recolor-status").textContent=error.message||"No se pudo seleccionar el rectángulo.";}
 finally{try{recolorCanvas.releasePointerCapture(event.pointerId);}catch{}}
}
recolorCanvas.addEventListener("pointerup",completeAnimeRectanglePointer);
recolorCanvas.addEventListener("pointercancel",event=>{if(!recolorRectangleStart)return;recolorRectangleStart=null;recolorRectangleMode=false;document.querySelector("#recolor-rectangle-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-preview").style.cursor="default";if(animeSelectionOverlay)animeSelectionOverlay.hidden=true;try{recolorCanvas.releasePointerCapture(event.pointerId);}catch{};document.querySelector("#recolor-status").textContent="Selección rectangular cancelada.";});
document.querySelector("#recolor-wand-tolerance").addEventListener("input",event=>{document.querySelector("#recolor-wand-tolerance-value").textContent=event.currentTarget.value;});
document.querySelector("#recolor-wand-tolerance").addEventListener("change",()=>{document.querySelector("#recolor-status").textContent="Tolerancia actualizada. Activa la varita y toca la zona para volver a seleccionarla.";});
function recolorCanvasPointFromClient(event){
 const rect=recolorCanvas.getBoundingClientRect();
 const style=getComputedStyle(recolorCanvas);
 const number=value=>Number.parseFloat(value)||0;
 const borderLeft=number(style.borderLeftWidth),borderRight=number(style.borderRightWidth);
 const borderTop=number(style.borderTopWidth),borderBottom=number(style.borderBottomWidth);
 const paddingLeft=number(style.paddingLeft),paddingRight=number(style.paddingRight);
 const paddingTop=number(style.paddingTop),paddingBottom=number(style.paddingBottom);
 const boxLeft=rect.left+borderLeft+paddingLeft;
 const boxTop=rect.top+borderTop+paddingTop;
 const boxWidth=rect.width-borderLeft-borderRight-paddingLeft-paddingRight;
 const boxHeight=rect.height-borderTop-borderBottom-paddingTop-paddingBottom;
 if(boxWidth<=0||boxHeight<=0||recolorCanvas.width<=0||recolorCanvas.height<=0)return null;
 // Canvas CSS can be constrained to a box with a different aspect ratio. object-fit:contain
 // draws the bitmap inside that box, so taps must exclude letterboxed space and CSS borders.
 const scale=Math.min(boxWidth/recolorCanvas.width,boxHeight/recolorCanvas.height);
 const drawnWidth=recolorCanvas.width*scale,drawnHeight=recolorCanvas.height*scale;
 const drawnLeft=boxLeft+(boxWidth-drawnWidth)/2,drawnTop=boxTop+(boxHeight-drawnHeight)/2;
 if(event.clientX<drawnLeft||event.clientY<drawnTop||event.clientX>=drawnLeft+drawnWidth||event.clientY>=drawnTop+drawnHeight)return null;
 return {
  x:Math.max(0,Math.min(recolorCanvas.width-1,Math.floor((event.clientX-drawnLeft)/scale))),
  y:Math.max(0,Math.min(recolorCanvas.height-1,Math.floor((event.clientY-drawnTop)/scale))),
  scale, drawnLeft, drawnTop
 };
}
recolorCanvas.addEventListener("click",event=>{
 const s=recolorSession;if(!s)return;
 const point=recolorCanvasPointFromClient(event);
 if(!point){document.querySelector("#recolor-status").textContent="Toca dentro de la imagen, no en el margen transparente.";return;}
 const {x,y}=point;
 const o=(y*recolorCanvas.width+x)*4;
 if(window.__ANIMEART_E2E_DIAGNOSTICS__)window.__ANIMEART_RECOLOR_SAMPLE_DIAGNOSTICS__={x,y,alpha:s.original.data[o+3],pixel:pixelHex(s.original.data,o),sampleMode:recolorSampleMode,wandMode:recolorWandMode,clientX:event.clientX,clientY:event.clientY,canvasWidth:recolorCanvas.width,canvasHeight:recolorCanvas.height};
 if(recolorWandMode){
  try{
   const region=selectAnimeRegion(s.original,{x,y,tolerance:Number(document.querySelector("#recolor-wand-tolerance").value),protectLineArt:true});
   if(!region.pixelCount){document.querySelector("#recolor-status").textContent="Esa zona es transparente. Toca un píxel visible del dibujo.";return;}
   const combined=applyAnimeRegionSelection(region.mask,region.seedColor||pixelHex(s.original.data,o),region.pixelCount);
   if(!combined)return;
   s.sourceColor=region.seedColor||pixelHex(s.original.data,o);document.querySelector("#recolor-source-color").value=s.sourceColor;
   recolorWandMode=false;document.querySelector("#recolor-wand-toggle").setAttribute("aria-pressed","false");document.querySelector("#recolor-preview").style.cursor="default";
   syncAnimeSelectionControls();renderRecolorPreview();
   document.querySelector("#recolor-status").textContent="Zona anime seleccionada: "+combined.selectedPixels.toLocaleString("es-AR")+" píxeles después de combinar. Elige un color para previsualizar.";
  }catch(error){document.querySelector("#recolor-status").textContent=error.message||"No se pudo seleccionar esta zona.";}
  return;
 }
 if(!recolorSampleMode)return;
 if(s.original.data[o+3]===0){document.querySelector("#recolor-status").textContent="Ese píxel es transparente. Toca un color visible.";return;}
 s.sourceColor=pixelHex(s.original.data,o);document.querySelector("#recolor-source-color").value=s.sourceColor;recolorSampleMode=false;renderRecolorPreview();
});
for(const id of ["recolor-target-color","recolor-tolerance","recolor-softness","recolor-preserve-shading","recolor-temperature","recolor-darkness","recolor-hue-shift"]){document.querySelector("#"+id).addEventListener("input",renderRecolorPreview);document.querySelector("#"+id).addEventListener("change",renderRecolorPreview);}
async function splitAnimeSelectionIntoLayer(){
 const s=recolorSession,layer=s&&state.document.layers.find(item=>item.id===s.layerId),mask=s?.selectionMask;
 if(!s||!layer||layer.locked||layer.contentType!=="image"||layer.image?.source!==s.source||!mask){document.querySelector("#recolor-status").textContent="Selecciona una zona válida antes de separarla.";return;}
 const button=document.querySelector("#recolor-split-layer");button.disabled=true;
 try{
  const width=s.original.width,height=s.original.height,source=s.original.data;
  const selectedPixels=new Uint8ClampedArray(source),remainingPixels=new Uint8ClampedArray(source);let selectedCount=0;
  for(let pixel=0,offset=0;pixel<mask.length;pixel+=1,offset+=4){
   if(mask[pixel]>0&&source[offset+3]>0){selectedCount+=1;remainingPixels[offset]=0;remainingPixels[offset+1]=0;remainingPixels[offset+2]=0;remainingPixels[offset+3]=0;}
   else{selectedPixels[offset]=0;selectedPixels[offset+1]=0;selectedPixels[offset+2]=0;selectedPixels[offset+3]=0;}
  }
  if(!selectedCount)throw new Error("La selección no contiene píxeles visibles.");
  const encode=async pixels=>{
   const temp=document.createElement("canvas");temp.width=width;temp.height=height;
   const context=temp.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("No se pudo preparar la zona para separarla.");
   context.putImageData(new ImageData(pixels,width,height),0,0);
   const dataUrl=temp.toDataURL("image/png");temp.width=0;temp.height=0;
   return optimizeImageSource(dataUrl);
  };
  const [remaining,selected]=await Promise.all([encode(remainingPixels),encode(selectedPixels)]);
  const before=cloneDocument(state.document);
  const baseNext=replaceImageLayer(state.document,layer.id,{source:remaining.source,width:remaining.width,height:remaining.height},{preserveDisplaySize:true});
  if(!baseNext)throw new Error("No se pudo actualizar la capa original.");
  const separated=createImageLayer("Zona anime · "+String(layer.name||"selección").slice(0,42),width,height,selected.source);
  separated.transform={...layer.transform};
  if("opacity" in layer)separated.opacity=layer.opacity;
  if("visible" in layer)separated.visible=layer.visible;
  const next=addLayer(baseNext,separated);if(!next)throw new Error("No se pudo crear la nueva capa.");
  imageCache.delete(s.source);state.document=next;state.history.record(before,next);state.dirty=true;state.textPreview=null;
  setSelection([separated.id],separated.id);refreshDocument("Zona separada en una capa independiente. Deshacer recupera la imagen original.");
  persistDocument();closeRecolorTool();
 }catch(error){document.querySelector("#recolor-status").textContent=error.message||"No se pudo separar la zona.";syncAnimeSelectionControls();}
 finally{if(recolorSession)button.disabled=countAnimeSelection(recolorSession.selectionMask)===0;}
}
document.querySelector("#recolor-split-layer").addEventListener("click",splitAnimeSelectionIntoLayer);

document.querySelector("#apply-recolor").addEventListener("click",async()=>{
 const s=recolorSession,layer=s&&state.document.layers.find(item=>item.id===s.layerId);
 if(!s||!layer||layer.locked||layer.contentType!=="image"||layer.image?.source!==s.source){document.querySelector("#recolor-status").textContent="La capa seleccionada cambió. Cierra y vuelve a abrir la herramienta.";return;}
 if(!s.sourceColor){document.querySelector("#recolor-status").textContent="Toma una muestra o selecciona una zona antes de aplicar.";return;}
 const button=document.querySelector("#apply-recolor");button.disabled=true;
 try {
  const options=currentRecolorOptions(),key=recolorOptionsKey(s,options);
  const result=recolorPreviewKey===key&&recolorPreviewResult?recolorPreviewResult:await runImageProcessing("replace-color-range",s.original,options);
  if(s!==recolorSession||state.document.layers.find(item=>item.id===s.layerId)?.image?.source!==s.source)throw new Error("La imagen cambió durante el proceso. Cierra y vuelve a abrir la herramienta.");
  const before=cloneDocument(state.document);
  if(document.querySelector("#recolor-effect-layer").checked){
   const effectPixels=new Uint8ClampedArray(result.data);let changedPixels=0;
   for(let pixel=0,offset=0;pixel<options.selectionMask?.length||pixel<s.original.width*s.original.height;pixel+=1,offset+=4){
    const originalAlpha=s.original.data[offset+3];
    const changed=result.data[offset]!==s.original.data[offset]||result.data[offset+1]!==s.original.data[offset+1]||result.data[offset+2]!==s.original.data[offset+2];
    const inSelection=options.selectionMask?options.selectionMask[pixel]>0:changed;
    // Opaque selected pixels become the editable effect layer. Soft/transparent antialiasing and line art stay on the unchanged original.
    if(inSelection&&changed&&originalAlpha>=250){effectPixels[offset+3]=255;changedPixels+=1;}
    else{effectPixels[offset]=0;effectPixels[offset+1]=0;effectPixels[offset+2]=0;effectPixels[offset+3]=0;}
   }
   if(!changedPixels)throw new Error("No hay píxeles opacos que cambien con estos ajustes. Prueba otro color, una selección distinta o desactiva «capa independiente» para aplicar directamente.");
   const effectCanvas=document.createElement("canvas");effectCanvas.width=result.width;effectCanvas.height=result.height;
   const effectContext=effectCanvas.getContext("2d",{willReadFrequently:true});if(!effectContext)throw new Error("No se pudo crear la capa de efecto.");
   effectContext.putImageData(new ImageData(effectPixels,result.width,result.height),0,0);
   const optimized=await optimizeImageSource(effectCanvas.toDataURL("image/png"));effectCanvas.width=0;effectCanvas.height=0;
   const effectLayer=createImageLayer("Efecto de color · "+String(layer.name||"imagen").slice(0,42),result.width,result.height,optimized.source);
   effectLayer.transform={...layer.transform};
   const next=addLayer(state.document,effectLayer);if(!next)throw new Error("No se pudo crear la capa borrable.");
   state.document=next;state.history.record(before,next);state.dirty=true;state.textPreview=null;
   setSelection([effectLayer.id],effectLayer.id);
   refreshDocument("Efecto aplicado en una capa independiente. Selecciona esa capa y usa «Borrar efecto de color» para retirar zonas.");
   persistDocument();closeRecolorTool();
  }else{
   recolorContext.putImageData(new ImageData(result.data,result.width,result.height),0,0);
   const optimized=await optimizeImageSource(recolorCanvas.toDataURL("image/webp",0.88));
   const next=replaceImageLayer(state.document,layer.id,{source:optimized.source,width:optimized.width,height:optimized.height},{preserveDisplaySize:true});
   if(!next)throw new Error("La imagen recoloreada supera el límite del documento. Redimensiónala e inténtalo de nuevo.");
   imageCache.delete(s.source);state.document=next;state.history.record(before,next);state.dirty=true;refreshDocument("Color aplicado directamente. Puedes deshacer para restaurar el original.");persistDocument();closeRecolorTool();
  }
 }catch(error){document.querySelector("#recolor-status").textContent=error.message||"No se pudo aplicar el color.";}
 finally{button.disabled=!recolorSession?.sourceColor;}
});
document.querySelector("#erase-color-effect").addEventListener("click",()=>{
 const layer=selectedLayerExact();
 if(!layer||layer.contentType!=="image"||!String(layer.name||"").startsWith("Efecto de color · ")){
  status.textContent="Selecciona primero una capa «Efecto de color». La capa original está debajo para que el borrador pueda recuperarla.";return;
 }
 const eraser=document.querySelector('.tool[data-tool="eraser"]');
 if(!eraser){status.textContent="No se encontró el borrador de pincel.";return;}
 eraser.click();status.textContent="Borrador de efecto activo: arrastra sobre la capa para revelar el dibujo original. Deshacer restaura los píxeles borrados.";
});

async function importImageIntoEditor(file, message = "Imagen importada") {
  if (!file) return false;
  showMobileFeedback("Importando imagen…", "info");
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
    refreshDocument(result.optimized ? `${message} (optimizada para el teléfono)` : message);
    redraw();
    showMobileFeedback(result.optimized ? "Imagen añadida y optimizada. Ya está en el lienzo." : "Imagen añadida al lienzo.", "success");
    return true;
  } catch (error) {
    const reason = error?.message || "No se pudo importar la imagen.";
    status.textContent = reason;
    showMobileFeedback("No se pudo añadir la imagen: " + reason, "error");
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

document.querySelector("#add-image-layer").addEventListener("click", openImagePicker);
document.querySelector("#quick-import-images")?.addEventListener("click", openImagePicker);
document.querySelector("#quick-open-asset-library")?.addEventListener("click", () => {
  document.querySelector("#open-asset-library")?.click();
});
document.querySelector("#canvas-import-images")?.addEventListener("click", openImagePicker);
document.querySelector("#canvas-open-asset-library")?.addEventListener("click", () => {
  document.querySelector("#open-asset-library")?.click();
});

const MAX_IMAGES_PER_IMPORT_BATCH = 3;

imageFileInput.addEventListener("change", async () => {
  // Android's picker can expose a very large library. Keep only a tiny batch in
  // memory and never try to decode every selected item at once.
  const selected = imageFileInput.files;
  const selectedCount = selected?.length || 0;
  const files = [];
  for (let index = 0; index < Math.min(selectedCount, MAX_IMAGES_PER_IMPORT_BATCH); index += 1) {
    const file = selected.item(index);
    if (file && (!file.type || file.type.startsWith("image/"))) files.push(file);
  }
  imageFileInput.value = "";
  if (!selectedCount) return;

  const omitted = Math.max(0, selectedCount - files.length);
  if (!files.length) {
    showMobileFeedback("Elegí imágenes compatibles. Los archivos APK se abren con el instalador de Android, no como imágenes.", "error");
    return;
  }

  if (state.storageRecoveryPending) {
    const warning = "El proyecto guardado está protegido. Pulsa Guardar para reemplazarlo antes de importar imágenes.";
    status.textContent = warning;
    showMobileFeedback(warning, "error");
    return;
  }

  let imported = 0;
  let rejectedForSize = 0;
  showMobileFeedback(
    "Procesando " + files.length + " imagen(es) de forma secuencial para cuidar la memoria…",
    "info"
  );
  for (const file of files) {
    if (Number.isFinite(file.size) && file.size > MAX_IMPORT_FILE_BYTES) {
      rejectedForSize += 1;
      showMobileFeedback(
        "Se omitió " + file.name + ": supera el límite de 25 MB por imagen. Probá una copia más liviana.",
        "error"
      );
      continue;
    }
    if (await importImageIntoEditor(file, "Imagen importada")) imported += 1;
  }

  const summary = "Importadas " + imported + " de " + files.length + " imágenes.";
  const limits = [
    omitted ? " Se omitieron " + omitted + " archivos para evitar un pico de memoria; elegí un lote de hasta " + MAX_IMAGES_PER_IMPORT_BATCH + "." : "",
    rejectedForSize ? " " + rejectedForSize + " imagen(es) superaban 25 MB." : ""
  ].join("");
  // Do not hide a storage-recovery failure behind the batch summary.
  // A failed import must keep the protected-project warning actionable.
  if (imported > 0 || (!state.storageRecoveryPending && !rejectedForSize)) {
    const singleImageSuccess = imported === 1 && files.length === 1 && selectedCount === 1 && !omitted && !rejectedForSize;
    const feedbackMessage = singleImageSuccess ? "Imagen añadida al lienzo." : summary + limits;
    status.textContent = feedbackMessage;
    showMobileFeedback(feedbackMessage, imported > 0 ? "success" : "error");
  } else if (state.storageRecoveryPending) {
    status.textContent = "Proyecto protegido. Guardá explícitamente para reemplazarlo antes de importar.";
    showMobileFeedback("Proyecto protegido. Guardá explícitamente para reemplazarlo antes de importar.", "error");
  }
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
    setStorageRecoveryPending(true, "No se pudo leer el almacenamiento local. El guardado automático está pausado para proteger tus datos.");
    status.textContent = "Almacenamiento local no disponible";
    return false;
  }
  if (!raw) {
    status.textContent = "No hay ningún proyecto local para recuperar";
    return false;
  }
  if (confirmDiscard && state.dirty && !window.confirm("¿Descartar los cambios desde el último guardado explícito?")) return false;
  try {
    const saved = JSON.parse(raw);
    const restored = restoreStoredDocument(saved);
    if (!restored) throw new Error("Stored project is invalid");
    if (!detachActiveMultiPageSessionForReplacement("el proyecto recuperado")) return false;
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
    setStorageRecoveryPending(true, "No se pudo abrir el proyecto guardado. Los datos originales están protegidos y el guardado automático está pausado. Crea un documento nuevo y pulsa Guardar solo si deseas reemplazar el proyecto anterior.");
    status.textContent = "No se pudo recuperar el proyecto guardado";
    return false;
  }
}


function posterSvgSource(width,height,background,accent,style){return svgDataUrl(createPosterSvg(width,height,background,accent,style));}
const CREATIVE_ELEMENT_FAVORITES_KEY = "kapiart-creative-element-favorites-v1";
function loadCreativeElementFavorites() {
  const storage = animePresetStorage();
  if (!storage) return new Set();
  try {
    const value = JSON.parse(storage.getItem(CREATIVE_ELEMENT_FAVORITES_KEY) || "[]");
    return new Set((Array.isArray(value) ? value : []).filter(id => Boolean(getDesignElement(id))).slice(0, ELEMENT_CATALOG.length));
  } catch { return new Set(); }
}
let creativeElementFavoriteIds = loadCreativeElementFavorites();
function toggleCreativeElementFavorite(id) {
  if (!getDesignElement(id)) return false;
  if (creativeElementFavoriteIds.has(id)) creativeElementFavoriteIds.delete(id);
  else creativeElementFavoriteIds.add(id);
  const storage = animePresetStorage();
  let persisted = false;
  try {
    if (storage) { storage.setItem(CREATIVE_ELEMENT_FAVORITES_KEY, JSON.stringify([...creativeElementFavoriteIds])); persisted = true; }
  } catch {}
  const message = creativeElementFavoriteIds.has(id) ? "Elemento guardado en favoritos." : "Elemento quitado de favoritos.";
  const statusNode = document.querySelector("#creative-studio-status");
  if (statusNode) statusNode.textContent = message + (persisted ? " Se conserva en este dispositivo." : " El navegador no permitió guardar el cambio de forma permanente.");
  renderCreativeCatalog();
  return true;
}
let activeCreativeTab="covers";
let selectedCreativeTemplateId="anime-awakening";
const selectedAnimeTraitIds = new Set();
const MAX_SELECTED_ANIME_TRAITS = 4;
let animeTraitFavoriteIds = new Set();
let savedAnimeCharacterSets = [];
let savedAnimeColorPalettes = [];
let activeAnimeCharacterPresetId = null;
function validCreativeColor(value,fallback){return typeof value==="string"&&/^#[0-9a-fA-F]{6}$/.test(value)?value:fallback;}
function animePresetStorage(){try{return window.localStorage||null;}catch{return null;}}
function currentAnimeCharacterColors(){return {
 hair:validCreativeColor(document.querySelector("#creative-trait-hair-color")?.value,"#3a2b45"),
 eyes:validCreativeColor(document.querySelector("#creative-trait-eye-color")?.value,"#6dd6e8"),
 skin:validCreativeColor(document.querySelector("#creative-trait-skin-color")?.value,"#f4c7b7"),
 line:validCreativeColor(document.querySelector("#creative-trait-line-color")?.value,"#2b2035")
};}
function setAnimeCharacterPresetStatus(message){const node=document.querySelector("#creative-character-presets-status");if(node)node.textContent=String(message||"");}
function populateAnimePresetSelect(id,records,placeholder){
 const select=document.querySelector("#"+id);if(!select)return;const previous=select.value;select.replaceChildren();
 const empty=document.createElement("option");empty.value="";empty.textContent=placeholder;select.append(empty);
 for(const record of records){const option=document.createElement("option");option.value=record.id;option.textContent=record.name;select.append(option);}
 select.value=records.some(record=>record.id===previous)?previous:"";select.disabled=records.length===0;
}
function refreshAnimeCharacterPresetControls(message=""){
 try{
  const storage=animePresetStorage();
  animeTraitFavoriteIds=new Set(loadAnimeTraitFavorites(storage,ANIME_STYLE_COMPONENTS));
  savedAnimeCharacterSets=loadAnimeCharacterSets(storage,ANIME_STYLE_COMPONENTS);
  savedAnimeColorPalettes=loadAnimeColorPalettes(storage);
  populateAnimePresetSelect("creative-character-set-select",savedAnimeCharacterSets,"Elegir conjunto guardado…");
  populateAnimePresetSelect("creative-character-palette-select",savedAnimeColorPalettes,"Elegir paleta guardada…");
  document.querySelector("#creative-trait-save-favorites").disabled=selectedAnimeTraitIds.size===0;
  document.querySelector("#creative-trait-remove-favorites").disabled=selectedAnimeTraitIds.size===0||![...selectedAnimeTraitIds].some(id=>animeTraitFavoriteIds.has(id));
  document.querySelector("#creative-character-set-load").disabled=savedAnimeCharacterSets.length===0;
  document.querySelector("#creative-character-set-delete").disabled=savedAnimeCharacterSets.length===0;
  document.querySelector("#creative-character-palette-load").disabled=savedAnimeColorPalettes.length===0;
  document.querySelector("#creative-character-palette-delete").disabled=savedAnimeColorPalettes.length===0;
  if(message)setAnimeCharacterPresetStatus(message);
 }catch(error){
  animeTraitFavoriteIds=new Set();savedAnimeCharacterSets=[];savedAnimeColorPalettes=[];
  populateAnimePresetSelect("creative-character-set-select",[],"Almacenamiento no disponible");
  populateAnimePresetSelect("creative-character-palette-select",[],"Almacenamiento no disponible");
  setAnimeCharacterPresetStatus(error?.message||"No se pudo leer la biblioteca local de personajes.");
 }
}
function selectedAnimeCharacterComponents(){
 const components=[...selectedAnimeTraitIds].map(getAnimeStyleComponent).filter(Boolean);
 const eyes=components.filter(item=>item.part==="eyes"),hair=components.filter(item=>item.part==="hair"),face=components.filter(item=>item.part==="face"),expression=components.filter(item=>item.part==="expression");
 const valid=eyes.length===1&&hair.length===1&&face.length===1&&expression.length<=1&&components.length===3+expression.length&&new Set(components.map(item=>item.part)).size===components.length;
 return valid?{eyes:eyes[0],hair:hair[0],face:face[0],...(expression.length?{expression:expression[0]}:{})}:null;
}
function saveCurrentAnimeCharacterSet(){
 const selected=selectedAnimeCharacterComponents();
 if(!selected){setAnimeCharacterPresetStatus("Selecciona exactamente un rasgo de ojos, cabello y rostro antes de guardar el conjunto.");return false;}
 try{
  const record=saveAnimeCharacterSet(animePresetStorage(),{name:document.querySelector("#creative-character-set-name").value,componentIds:{eyes:selected.eyes.id,hair:selected.hair.id,face:selected.face.id,...(selected.expression?{expression:selected.expression.id}:{})},colors:currentAnimeCharacterColors()},ANIME_STYLE_COMPONENTS);
  activeAnimeCharacterPresetId=record.id;refreshAnimeCharacterPresetControls('Conjunto "'+record.name+'" guardado en este dispositivo.');
  document.querySelector("#creative-character-set-select").value=record.id;return true;
 }catch(error){setAnimeCharacterPresetStatus(error?.message||"No se pudo guardar el conjunto.");return false;}
}
function loadSelectedAnimeCharacterSet(){
 const record=savedAnimeCharacterSets.find(item=>item.id===document.querySelector("#creative-character-set-select").value);
 if(!record){setAnimeCharacterPresetStatus("Elige un conjunto guardado para cargarlo.");return false;}
 selectedAnimeTraitIds.clear();for(const part of ["eyes","hair","face"])selectedAnimeTraitIds.add(record.componentIds[part]);if(record.componentIds.expression)selectedAnimeTraitIds.add(record.componentIds.expression);
 document.querySelector("#creative-trait-hair-color").value=record.colors.hair;
 document.querySelector("#creative-trait-eye-color").value=record.colors.eyes;
 document.querySelector("#creative-trait-skin-color").value=record.colors.skin;
 document.querySelector("#creative-trait-line-color").value=record.colors.line;
 document.querySelector("#creative-trait-favorites-only").checked=false;document.querySelector("#creative-trait-part").value="all";
 activeAnimeCharacterPresetId=record.id;updateAnimeTraitSelectionUi();renderCreativeCatalog();
 setAnimeCharacterPresetStatus('Conjunto "'+record.name+'" cargado. Puedes modificar los rasgos o los colores antes de crear otra variante.');return true;
}
function deleteSelectedAnimeCharacterSet(){
 const id=document.querySelector("#creative-character-set-select").value,record=savedAnimeCharacterSets.find(item=>item.id===id);
 if(!record){setAnimeCharacterPresetStatus("Elige un conjunto que quieras eliminar.");return false;}
 try{const removed=deleteAnimeCharacterSet(animePresetStorage(),id,ANIME_STYLE_COMPONENTS);if(activeAnimeCharacterPresetId===id)activeAnimeCharacterPresetId=null;
  refreshAnimeCharacterPresetControls(removed?'Conjunto "'+record.name+'" eliminado de este dispositivo.':"Ese conjunto ya no existe.");return removed;
 }catch(error){setAnimeCharacterPresetStatus(error?.message||"No se pudo eliminar el conjunto.");return false;}
}
function saveCurrentAnimeColorPalette(){
 try{const record=saveAnimeColorPalette(animePresetStorage(),{name:document.querySelector("#creative-character-palette-name").value,colors:currentAnimeCharacterColors()});
  refreshAnimeCharacterPresetControls('Paleta "'+record.name+'" guardada en este dispositivo.');document.querySelector("#creative-character-palette-select").value=record.id;return true;
 }catch(error){setAnimeCharacterPresetStatus(error?.message||"No se pudo guardar la paleta.");return false;}
}
function loadSelectedAnimeColorPalette(){
 const record=savedAnimeColorPalettes.find(item=>item.id===document.querySelector("#creative-character-palette-select").value);
 if(!record){setAnimeCharacterPresetStatus("Elige una paleta guardada para cargarla.");return false;}
 document.querySelector("#creative-trait-hair-color").value=record.colors.hair;
 document.querySelector("#creative-trait-eye-color").value=record.colors.eyes;
 document.querySelector("#creative-trait-skin-color").value=record.colors.skin;
 document.querySelector("#creative-trait-line-color").value=record.colors.line;activeAnimeCharacterPresetId=null;
 setAnimeCharacterPresetStatus('Paleta "'+record.name+'" aplicada a los controles de color.');return true;
}
function deleteSelectedAnimeColorPalette(){
 const id=document.querySelector("#creative-character-palette-select").value,record=savedAnimeColorPalettes.find(item=>item.id===id);
 if(!record){setAnimeCharacterPresetStatus("Elige una paleta que quieras eliminar.");return false;}
 try{const removed=deleteAnimeColorPalette(animePresetStorage(),id);refreshAnimeCharacterPresetControls(removed?'Paleta "'+record.name+'" eliminada de este dispositivo.':"Esa paleta ya no existe.");return removed;}
 catch(error){setAnimeCharacterPresetStatus(error?.message||"No se pudo eliminar la paleta.");return false;}
}
function updateSelectedAnimeTraitFavorites(mode){
 const ids=[...selectedAnimeTraitIds];if(!ids.length){setAnimeCharacterPresetStatus("Selecciona uno o varios rasgos antes de cambiar sus favoritos.");return false;}
 try{updateAnimeTraitFavorites(animePresetStorage(),ids,ANIME_STYLE_COMPONENTS,mode);refreshAnimeCharacterPresetControls(mode==="add"?"Rasgos seleccionados guardados como favoritos.":"Favoritos de los rasgos seleccionados eliminados.");renderCreativeCatalog();return true;}
 catch(error){setAnimeCharacterPresetStatus(error?.message||"No se pudieron actualizar los favoritos.");return false;}
}

function openCreativeStudio(){
  if(toolboxDialog?.open)toolboxDialog.close();
  const dialog=document.querySelector("#creative-studio-dialog");
  if(!dialog)return;
  if(!dialog.open)dialog.showModal();
  refreshAnimeCharacterPresetControls();
  setCreativeTab("covers");
  renderCreativeCatalog();
}
function setCreativeTab(tab){
  activeCreativeTab=["covers","stickers","words","packs","traits","elements"].includes(tab)?tab:"covers";
  document.querySelectorAll("[data-creative-tab]").forEach(button=>{
    const active=button.dataset.creativeTab===activeCreativeTab;
    button.setAttribute("aria-selected",String(active));
    button.classList.toggle("is-active",active);
  });
  document.querySelector("#creative-template-settings").hidden=activeCreativeTab!=="covers";
  document.querySelector("#creative-word-field").hidden=activeCreativeTab!=="words";
  document.querySelector("#creative-create-cover").hidden=activeCreativeTab!=="covers";
  document.querySelector("#creative-customize-template").hidden=activeCreativeTab!=="covers";
  const traitControls=document.querySelector("#creative-traits-controls");
  if(traitControls)traitControls.hidden=activeCreativeTab!=="traits";
  const elementControls=document.querySelector("#creative-elements-controls");
  if(elementControls)elementControls.hidden=activeCreativeTab!=="elements";
  const search=document.querySelector("#creative-catalog-search");
  search.placeholder=activeCreativeTab==="covers"?"Buscar anime, galaxia, sakura…"
    :activeCreativeTab==="stickers"?"Buscar flor, planeta, brillo…"
    :activeCreativeTab==="words"?"Buscar estilo de letra…"
    :activeCreativeTab==="traits"?"Buscar ojos, coletas, mandíbula…"
    :activeCreativeTab==="elements"?"Buscar globos, marcos, texturas, flechas…"
    :"Buscar conjunto de estilo…";
  updateAnimeTraitSelectionUi();
}
function selectCreativeTemplate(id,refresh=true){
  const template=getCreativeTemplate(id);
  if(!template)return false;
  selectedCreativeTemplateId=template.id;
  document.querySelector("#creative-cover-title").value=template.defaultTitle;
  document.querySelector("#creative-cover-subtitle").value=template.defaultSubtitle;
  document.querySelector("#creative-cover-background").value=template.background;
  document.querySelector("#creative-cover-accent").value=template.accent;
  const formatControl=document.querySelector("#creative-cover-size");
  if(formatControl&&["portrait","square","story","banner"].includes(template.defaultFormat))formatControl.value=template.defaultFormat;
  document.querySelector("#creative-studio-status").textContent="Seleccionada: "+template.label+". Cambia el título, los colores o el formato y crea la portada.";
  if(refresh)renderCreativeCatalog();
  return true;
}
function createCreativeCardPreview(tab,item){
  const preview=document.createElement("span");
  preview.className="creative-card-preview creative-card-preview-"+tab;
  if(tab==="covers"){
    const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=svgDataUrl(createPosterSvg(360,460,item.background,item.accent,item.id));
    const stamp=document.createElement("span");stamp.className="creative-cover-stamp";stamp.textContent="ANIMEART ORIGINAL";
    const sample=document.createElement("span");sample.className="creative-cover-sample";sample.textContent=item.defaultTitle;
    preview.append(image,stamp,sample);
  }else if(tab==="stickers"){
    const checker=document.createElement("span");checker.className="creative-sticker-checker";
    const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=svgDataUrl(createStickerSvg(item.id));checker.append(image);preview.append(checker);
  }else if(tab==="elements"){ const checker=document.createElement("span");checker.className="creative-sticker-checker";const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=svgDataUrl(createDesignElementSvg(item.id));checker.append(image);preview.append(checker); }else if(tab==="words"){
    const style=item.style,sample=document.createElement("span");sample.className="creative-word-sample";sample.textContent=item.sample;
    sample.style.color=style.color;sample.style.fontFamily=style.fontFamily;
    sample.style.webkitTextStroke=Math.max(1,Math.min(4,style.outlineWidth/2))+"px "+style.outlineColor;
    sample.style.textShadow=style.shadowOffsetX+"px "+style.shadowOffsetY+"px "+Math.max(1,style.shadowBlur/2)+"px "+style.shadowColor;
    const tag=document.createElement("span");tag.className="creative-word-tag";tag.textContent="TEXTO EDITABLE";preview.append(sample,tag);
  }else if(tab==="traits"){
    const checker=document.createElement("span");checker.className="creative-sticker-checker creative-trait-checker";
    const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=svgDataUrl(createAnimeStyleComponentSvg(item.id));
    checker.append(image);preview.append(checker);
  }else{
    const title=document.createElement("span");title.className="creative-pack-title";title.textContent=item.title;
    const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=svgDataUrl(createStickerSvg(item.stickerId));
    const palette=document.createElement("span");palette.className="creative-pack-palette";
    item.colors.forEach(color=>{const swatch=document.createElement("i");swatch.style.background=color;palette.append(swatch);});
    preview.append(title,image,palette);
  }
  return preview;
}
function updateAnimeTraitSelectionUi(){
  const button=document.querySelector("#creative-trait-add-selected");
  const message=document.querySelector("#creative-trait-selection-status");
  const count=selectedAnimeTraitIds.size;
  const saveFavorites=document.querySelector("#creative-trait-save-favorites");
  const removeFavorites=document.querySelector("#creative-trait-remove-favorites");
  if(saveFavorites)saveFavorites.disabled=count===0;
  if(removeFavorites)removeFavorites.disabled=count===0||![...selectedAnimeTraitIds].some(id=>animeTraitFavoriteIds.has(id));
  if(button){button.disabled=count===0;button.textContent=count?"Añadir "+count+" referencia"+(count===1?"":"s")+" al lienzo":"Añadir referencias seleccionadas";}
  if(message)message.textContent=count
    ?count+" de "+MAX_SELECTED_ANIME_TRAITS+" rasgos seleccionados. Puedes añadirlos como referencias o crear un personaje si eliges uno de cada categoría."
    :"Elige ojos, un peinado y un rostro para crear un personaje editable; también puedes añadir rasgos como referencias separadas.";
  updateAnimeCharacterComposerUi();
}
function updateAnimeCharacterComposerUi(){
  const button=document.querySelector("#creative-trait-create-character");
  const statusMessage=document.querySelector("#creative-character-status");
  if(!button)return;
  const selected=[...selectedAnimeTraitIds].map(getAnimeStyleComponent).filter(Boolean);
  const parts=["eyes","hair","face"];
  const expressionCount=selected.filter(component=>component.part==="expression").length;
  const valid=parts.every(part=>selected.filter(component=>component.part===part).length===1)&&expressionCount<=1&&selected.length===3+expressionCount&&new Set(selected.map(component=>component.part)).size===selected.length;
  button.disabled=!valid;
  if(statusMessage)statusMessage.textContent=valid
    ?"Listo: se crearán cinco capas alineadas y editables, incluida la expresión. Puedes generar otra variación sin reemplazar esta."
    :"Selecciona un rasgo de Ojos, uno de Cabello y uno de Rostro. La expresión es opcional.";
}
function toggleAnimeTraitSelection(id){
  if(!getAnimeStyleComponent(id))return false;
  if(selectedAnimeTraitIds.has(id))selectedAnimeTraitIds.delete(id);
  else if(selectedAnimeTraitIds.size>=MAX_SELECTED_ANIME_TRAITS){
    document.querySelector("#creative-studio-status").textContent="Puedes añadir como máximo cuatro referencias por lote; añade estas y luego elige otras.";
    return false;
  }else selectedAnimeTraitIds.add(id);
  activeAnimeCharacterPresetId=null;
  updateAnimeTraitSelectionUi();renderCreativeCatalog();return true;
}
function createAnimeCharacterFromSelectedTraits(){
  const selected=[...selectedAnimeTraitIds].map(getAnimeStyleComponent).filter(Boolean);
  const eyes=selected.filter(component=>component.part==="eyes");
  const hair=selected.filter(component=>component.part==="hair");
  const face=selected.filter(component=>component.part==="face");
  const expression=selected.filter(component=>component.part==="expression");
  if(selected.length!==3+expression.length||expression.length>1||eyes.length!==1||hair.length!==1||face.length!==1||new Set(selected.map(component=>component.part)).size!==selected.length){
    const message="Selecciona un rasgo de Ojos, uno de Cabello y uno de Rostro; la expresión es opcional.";
    document.querySelector("#creative-character-status").textContent=message;
    document.querySelector("#creative-studio-status").textContent=message;
    return false;
  }
  const width=Number(state.document?.width),height=Number(state.document?.height);
  if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1){
    const message="Crea un documento o importa una imagen antes de crear un personaje.";
    status.textContent=message;document.querySelector("#creative-character-status").textContent=message;
    document.querySelector("#creative-studio-status").textContent=message;return false;
  }
  const parts=createAnimeCharacterParts({
    eyesId:eyes[0].id,
    hairId:hair[0].id,
    faceId:face[0].id,
    expressionId:expression[0]?.id,
    hairColor:document.querySelector("#creative-trait-hair-color").value,
    eyeColor:document.querySelector("#creative-trait-eye-color").value,
    skinColor:document.querySelector("#creative-trait-skin-color").value,
    lineColor:document.querySelector("#creative-trait-line-color").value
  });
  const usedVariants=new Set(state.document.layers.map(layer=>{
    const match=/^Personaje anime V(\d+) ·/.exec(String(layer.name||""));
    return match?Number(match[1]):0;
  }).filter(number=>number>0));
  const variant=Array.from({length:9},(_,index)=>index+1).find(number=>!usedVariants.has(number));
  if(!variant){
    const message="Este documento ya contiene nueve variaciones visibles. Guarda una copia o crea otro documento para conservar más versiones.";
    document.querySelector("#creative-character-status").textContent=message;
    document.querySelector("#creative-studio-status").textContent=message;
    return false;
  }
  const positions=[
    {x:.50,y:.50},{x:.27,y:.50},{x:.73,y:.50},
    {x:.27,y:.25},{x:.73,y:.25},{x:.27,y:.75},
    {x:.73,y:.75},{x:.50,y:.25},{x:.50,y:.75}
  ];
  const position=positions[variant-1];
  const size=Math.min(width*.29,height*.22);
  const scale=Math.max(.16,Math.min(1.25,size/256));
  const targetX=width*position.x;
  const targetY=height*position.y;
  const transform={
    x:(targetX-width/2)+scale*(width/2-128),
    y:(targetY-height/2)+scale*(height/2-128),
    scale,rotation:0
  };
  const specs=[
    ["hairBack","Cabello base · "+hair[0].label],
    ["face","Rostro · "+face[0].label],
    ["hairFront","Flequillo · "+hair[0].label],
    ["eyes","Ojos · "+eyes[0].label],
    ["expression","Expresión · "+(expression[0]?.label||"Sonrisa suave")]
  ];
  const characterGroupId=createId();
  const compositionBase={groupId:characterGroupId,variantIndex:variant,componentIds:{...parts.componentIds},colors:{...parts.colors},presetId:activeAnimeCharacterPresetId};
  const layers=specs.map(([part,label])=>{
    const layer=createImageLayer("Personaje anime V"+variant+" · "+label,256,256,svgDataUrl(parts[part]));
    layer.isReference=false;layer.transform={...transform};layer.characterComposition={...compositionBase,part};return layer;
  });
  const expressionLabel=expression[0]?.label||"Sonrisa suave";
  const message="Personaje anime V"+variant+" creado en cinco capas editables: cabello base, rostro, flequillo, ojos y expresión ("+expressionLabel+"). Cambia los colores o selecciona otros rasgos para crear variantes sin reemplazar el original.";
  if(!commitCreativeLayers(layers,message))return false;
  document.querySelector("#creative-studio-status").textContent=message;
  updateAnimeCharacterComposerUi();
  renderCreativeCatalog();
  document.querySelector("#creative-character-status").textContent=message;
  return true;
}

function addSelectedAnimeStyleReferences(){
  const selected=[...selectedAnimeTraitIds].map(getAnimeStyleComponent).filter(Boolean);
  if(!selected.length)return false;
  const width=Number(state.document?.width),height=Number(state.document?.height);
  if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1){
    const message="Crea un documento o importa una imagen antes de añadir referencias anime.";
    status.textContent=message;document.querySelector("#creative-studio-status").textContent=message;return false;
  }
  const size=Math.max(64,Math.min(124,Math.round(Math.min(width,height)*.18)));
  const scale=size/256,gap=Math.max(8,Math.round(size*.1)),margin=Math.max(8,Math.round(Math.min(width,height)*.025));
  const layers=selected.map((component,index)=>{
    const layer=createImageLayer("Referencia anime · "+component.label,256,256,svgDataUrl(createAnimeStyleComponentSvg(component.id)));
    layer.isReference=true;layer.opacity=.88;
    const column=index%2,row=Math.floor(index/2);
    const targetX=width-margin-size/2-column*(size+gap);
    const targetY=margin+size/2+row*(size+gap);
    layer.transform={x:(targetX-width/2)+scale*(width/2-128),y:(targetY-height/2)+scale*(height/2-128),scale,rotation:0};
    return layer;
  });
  const message="Se añadieron "+layers.length+" referencias anime como capas separadas. Puedes moverlas, ocultarlas o eliminarlas; no se aplanan y se omiten de la exportación final.";
  if(!commitCreativeLayers(layers,message))return false;
  selectedAnimeTraitIds.clear();updateAnimeTraitSelectionUi();renderCreativeCatalog();
  return true;
}
function renderCreativeCatalog(){
  const grid=document.querySelector("#creative-catalog-grid");
  if(!grid)return;
  grid.replaceChildren();
  const query=document.querySelector("#creative-catalog-search").value.trim();
  const data={covers:CREATIVE_TEMPLATES,stickers:STICKER_CATALOG,words:WORD_ART_PRESETS,packs:STYLE_PACKS,elements:ELEMENT_CATALOG};
  const part=document.querySelector("#creative-trait-part")?.value||"all";
  const category=document.querySelector("#creative-element-category")?.value||"all";
  let items=activeCreativeTab==="traits"
    ?searchAnimeStyleComponents(query,part)
    :activeCreativeTab==="elements"
      ?searchDesignElements(query,category)
      :(data[activeCreativeTab]||[]).filter(item=>{
        const haystack=[item.label,item.category,item.description,item.keywords,item.sample,item.title,item.subtitle].filter(Boolean).join(" ").toLocaleLowerCase();
        return !query||haystack.includes(query.toLocaleLowerCase());
      });
  if(activeCreativeTab==="traits"&&document.querySelector("#creative-trait-favorites-only")?.checked)items=items.filter(item=>animeTraitFavoriteIds.has(item.id));
  if(activeCreativeTab==="elements"&&document.querySelector("#creative-element-favorites-only")?.checked)items=items.filter(item=>creativeElementFavoriteIds.has(item.id));
  const actionName={covers:"select-template",stickers:"add-sticker",words:"add-word",packs:"apply-pack",traits:"select-trait",elements:"add-element"}[activeCreativeTab];
  items.forEach(item=>{
    const wrapper=activeCreativeTab==="elements"?document.createElement("article"):null;
    if(wrapper)wrapper.className="creative-card-wrap-elements";
    const card=document.createElement("button");
    card.type="button";card.className="creative-card creative-card-"+activeCreativeTab;
    card.dataset.creativeAction=actionName;card.dataset.itemId=item.id;
    const actionLabel={covers:"Seleccionar portada",stickers:"Añadir sticker como capa",words:"Añadir palabra decorativa editable",packs:"Aplicar conjunto de capas",traits:"Seleccionar referencia anime",elements:"Añadir elemento como capa editable"}[activeCreativeTab];
    const selected=(activeCreativeTab==="covers"&&item.id===selectedCreativeTemplateId)||(activeCreativeTab==="traits"&&selectedAnimeTraitIds.has(item.id));
    const isFavorite=(activeCreativeTab==="traits"&&animeTraitFavoriteIds.has(item.id))||(activeCreativeTab==="elements"&&creativeElementFavoriteIds.has(item.id));
    card.setAttribute("aria-label",item.label+" · "+actionLabel+(isFavorite?" · Favorito":""));
    card.title=isFavorite?"Favorito guardado en este dispositivo":"";
    card.setAttribute("aria-pressed",String(Boolean(selected)));
    card.classList.toggle("is-selected",Boolean(selected));
    card.classList.toggle("is-favorite",Boolean(isFavorite));
    card.append(createCreativeCardPreview(activeCreativeTab,item));
    const caption=document.createElement("span");caption.className="creative-card-caption";
    const heading=document.createElement("strong");heading.textContent=item.label;
    const description=document.createElement("small");description.textContent=item.description;
    const action=document.createElement("span");action.className="creative-card-action-label";
    action.textContent=activeCreativeTab==="traits"
      ?(selected?"✓ Seleccionado":"＋ Seleccionar rasgo")+(isFavorite?" · ★ Favorito":"")
      :{covers:selected?"✓ Seleccionada":"Usar portada",stickers:"＋ Añadir sticker",words:"＋ Añadir título editable",packs:"＋ Añadir conjunto",elements:"＋ Añadir elemento"}[activeCreativeTab];
    caption.append(heading,description,action);card.append(caption);
    card.addEventListener("click",()=>{
      if(activeCreativeTab==="covers")selectCreativeTemplate(item.id);
      else if(activeCreativeTab==="stickers")addCreativeStickerLayer(item.id);
      else if(activeCreativeTab==="words")addCreativeWordArt(item.id);
      else if(activeCreativeTab==="traits")toggleAnimeTraitSelection(item.id);
      else if(activeCreativeTab==="elements")addCreativeElementLayer(item.id);
      else applyCreativeStylePack(item.id);
    });
    if(activeCreativeTab==="elements"){
      const favorite=document.createElement("button");
      favorite.type="button";favorite.className="creative-card-favorite";
      favorite.dataset.elementFavorite=item.id;
      favorite.setAttribute("aria-pressed",String(isFavorite));
      favorite.setAttribute("aria-label",(isFavorite?"Quitar de favoritos: ":"Guardar en favoritos: ")+item.label);
      favorite.title=isFavorite?"Quitar de favoritos":"Guardar en favoritos";
      favorite.textContent=isFavorite?"★":"☆";
      favorite.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();toggleCreativeElementFavorite(item.id);});
      wrapper.append(card,favorite);grid.append(wrapper);
    }else grid.append(card);
  });
  if(!items.length){
    const empty=document.createElement("p");empty.className="creative-catalog-empty";
    empty.textContent=activeCreativeTab==="traits"&&document.querySelector("#creative-trait-favorites-only")?.checked
      ?"Todavía no hay favoritos que coincidan. Selecciona rasgos y pulsa Guardar favoritos."
      :activeCreativeTab==="elements"&&document.querySelector("#creative-element-favorites-only")?.checked
        ?"Todavía no guardaste elementos favoritos que coincidan con este filtro."
        :activeCreativeTab==="traits"?"No hay rasgos para este filtro. Prueba otra categoría o búsqueda."
          :"No encontramos diseños con esa búsqueda. Prueba otra palabra.";
    grid.append(empty);
  }
  updateAnimeTraitSelectionUi();
}
function commitCreativeLayers(layers,message){
  if(state.storageRecoveryPending){
    const warning="El proyecto guardado está protegido. Pulsa Guardar antes de añadir elementos.";
    status.textContent=warning;document.querySelector("#creative-studio-status").textContent=warning;return false;
  }
  if(!Array.isArray(layers)||!layers.length)return false;
  const before=cloneDocument(state.document);let next=state.document;
  for(const layer of layers){next=addLayer(next,layer);if(!next){status.textContent="No se pudo añadir el elemento al proyecto.";return false;}}
  state.document=next;state.textPreview=null;
  setSelection([layers[layers.length-1].id],layers[layers.length-1].id);
  state.history.record(before,next);refreshDocument(message);persistDocument();
  status.textContent=message;document.querySelector("#creative-studio-status").textContent=message;return true;
}
function createCreativeStickerLayer(id,position="center",customName=""){
  const sticker=getSticker(id);if(!sticker)return null;
  const width=Math.max(320,Number(state.document.width)||canvas.width||640);
  const height=Math.max(240,Number(state.document.height)||canvas.height||480);
  const size=Math.max(96,Math.min(360,Math.round(Math.min(width,height)*(position==="pack"?.23:.31))));
  const scale=size/256,layer=createImageLayer(customName||("Sticker · "+sticker.label),256,256,svgDataUrl(createStickerSvg(id)));
  const targetX=position==="pack"?width*.78:width*.5,targetY=position==="pack"?height*.24:height*.5;
  layer.transform={x:(targetX-width/2)+scale*(width/2-128),y:(targetY-height/2)+scale*(height/2-128),scale,rotation:0};
  return layer;
}
function addCreativeStickerLayer(id){
  const sticker=getSticker(id),layer=createCreativeStickerLayer(id);
  if(!sticker||!layer)return false;
  return commitCreativeLayers([layer],"Sticker añadido como una capa independiente. Puedes moverlo, girarlo, cambiar su tamaño o eliminarlo.");
}
function createCreativeElementLayer(id){
  const element=getDesignElement(id);
  if(!element)return null;
  const width=Math.max(320,Number(state.document.width)||canvas.width||640);
  const height=Math.max(240,Number(state.document.height)||canvas.height||480);
  const size=Math.max(88,Math.min(320,Math.round(Math.min(width,height)*.34)));
  const scale=size/256;
  const layer=createImageLayer("Elemento · "+element.label,256,256,svgDataUrl(createDesignElementSvg(id)));
  layer.transform={x:scale*(width/2-128),y:scale*(height/2-128),scale,rotation:0};
  return layer;
}
function addCreativeElementLayer(id){
  const element=getDesignElement(id),layer=createCreativeElementLayer(id);
  if(!element||!layer)return false;
  return commitCreativeLayers([layer],"Elemento añadido como una capa SVG editable: "+element.label+". Puedes moverlo, girarlo, cambiar su tamaño o eliminarlo.");
}
function addCreativeWordArt(id){
  const preset=getWordArtPreset(id);if(!preset)return false;
  const width=Math.max(320,Number(state.document.width)||canvas.width||640),height=Math.max(240,Number(state.document.height)||canvas.height||480);
  const custom=document.querySelector("#creative-custom-word").value.trim();
  const layer=createTextLayer("Título · "+preset.label,{value:custom||preset.sample,x:Math.round(width/2),y:Math.round(height*.52),fontSize:Math.max(32,Math.min(180,Math.round(height*.13))),...preset.style,align:"center"});
  return commitCreativeLayers([layer],"Título añadido como texto editable. Selecciónalo para cambiar la frase, la letra y los efectos.");
}
function applyCreativeStylePack(id){
  const pack=getStylePack(id);if(!pack)return false;
  const titlePreset=getWordArtPreset(pack.titlePreset),subtitlePreset=getWordArtPreset(pack.subtitlePreset);
  const sticker=createCreativeStickerLayer(pack.stickerId,"pack","Conjunto · "+pack.label+" · Sticker");
  if(!titlePreset||!subtitlePreset||!sticker)return false;
  const width=Math.max(320,Number(state.document.width)||canvas.width||640),height=Math.max(240,Number(state.document.height)||canvas.height||480);
  const title=createTextLayer("Conjunto · "+pack.label+" · Título",{value:pack.title,x:Math.round(width/2),y:Math.round(height*.43),fontSize:Math.max(42,Math.min(168,Math.round(height*.13))),...titlePreset.style,align:"center"});
  const subtitle=createTextLayer("Conjunto · "+pack.label+" · Subtítulo",{value:pack.subtitle,x:Math.round(width/2),y:Math.round(height*.56),fontSize:Math.max(22,Math.min(64,Math.round(height*.05))),...subtitlePreset.style,align:"center"});
  return commitCreativeLayers([title,subtitle,sticker],"Conjunto añadido en 3 capas editables: título, subtítulo y sticker. Puedes ordenarlas por separado.");
}
function createPosterTemplate(id,background,accent,title,subtitle,dimensions){
  const template=getCreativeTemplate(id)||getCreativeTemplate("poster"),safeBackground=validCreativeColor(background,template.background),safeAccent=validCreativeColor(accent,template.accent);
  const width=dimensions==="square"?1080:dimensions==="banner"?1920:1080,height=dimensions==="square"?1080:dimensions==="banner"?1080:dimensions==="story"?1920:1350;
  if(state.storageRecoveryPending){status.textContent="El proyecto guardado está protegido. Pulsa Guardar antes de reemplazarlo con una portada.";return false;}
  if(state.dirty&&!window.confirm("¿Reemplazar el lienzo actual por una portada nueva? Guarda o exporta tu trabajo antes si lo necesitas."))return false;
  if(!detachActiveMultiPageSessionForReplacement("una portada nueva"))return false;
  const next=createDocument(width,height),legacy=["poster","comic","manga"].includes(template.id);
  const bg=createImageLayer(legacy?"Poster background":"Fondo · "+template.label,width,height,posterSvgSource(width,height,safeBackground,safeAccent,template.id));
  const heading=createTextLayer(legacy?"Poster title":"Título · "+template.label,{value:String(title||template.defaultTitle).slice(0,180),x:width*.5,y:height*.34,fontSize:Math.round(height*.085),...template.titleStyle,align:"center",fontWeight:"bold"});
  const sub=createTextLayer(legacy?"Poster subtitle":"Subtítulo · "+template.label,{value:String(subtitle||template.defaultSubtitle).slice(0,240),x:width*.5,y:height*.78,fontSize:Math.round(height*.032),...template.subtitleStyle,align:"center",fontWeight:"bold"});
  next.layers=[bg,heading,sub];state.document=next;state.history.reset(next);state.textPreview=null;
  setSelection([heading.id],heading.id);state.viewport=createViewport();state.dirty=true;
  refreshDocument("Portada creada: "+template.label+". Fondo, título y subtítulo son capas editables.");persistDocument();
  document.querySelector("#poster-template-dialog")?.close();document.querySelector("#creative-studio-dialog")?.close();return true;
}
document.querySelectorAll("[data-creative-tab]").forEach(button=>button.addEventListener("click",()=>{setCreativeTab(button.dataset.creativeTab);renderCreativeCatalog();}));
document.querySelector("#creative-element-category")?.addEventListener("change",renderCreativeCatalog);
document.querySelector("#creative-element-favorites-only")?.addEventListener("change",renderCreativeCatalog);

document.querySelector("#creative-catalog-search")?.addEventListener("input",renderCreativeCatalog);
document.querySelector("#creative-trait-part")?.addEventListener("change",renderCreativeCatalog);
document.querySelector("#creative-trait-add-selected")?.addEventListener("click",addSelectedAnimeStyleReferences);
document.querySelector("#creative-trait-create-character")?.addEventListener("click",createAnimeCharacterFromSelectedTraits);
document.querySelector("#creative-trait-favorites-only")?.addEventListener("change",renderCreativeCatalog);
document.querySelector("#creative-trait-save-favorites")?.addEventListener("click",()=>updateSelectedAnimeTraitFavorites("add"));
document.querySelector("#creative-trait-remove-favorites")?.addEventListener("click",()=>updateSelectedAnimeTraitFavorites("remove"));
document.querySelector("#creative-character-set-save")?.addEventListener("click",saveCurrentAnimeCharacterSet);
document.querySelector("#creative-character-set-load")?.addEventListener("click",loadSelectedAnimeCharacterSet);
document.querySelector("#creative-character-set-delete")?.addEventListener("click",deleteSelectedAnimeCharacterSet);
document.querySelector("#creative-character-palette-save")?.addEventListener("click",saveCurrentAnimeColorPalette);
document.querySelector("#creative-character-palette-load")?.addEventListener("click",loadSelectedAnimeColorPalette);
document.querySelector("#creative-character-palette-delete")?.addEventListener("click",deleteSelectedAnimeColorPalette);
document.querySelectorAll('.creative-character-colors input[type="color"]').forEach(input=>input.addEventListener("input",()=>{activeAnimeCharacterPresetId=null;}));

document.querySelector("#creative-studio-open")?.addEventListener("click",openCreativeStudio);
document.querySelector("#quick-open-creative-studio")?.addEventListener("click",openCreativeStudio);
document.querySelector("#creative-studio-x")?.addEventListener("click",()=>document.querySelector("#creative-studio-dialog")?.close());
document.querySelector("#creative-studio-close")?.addEventListener("click",()=>document.querySelector("#creative-studio-dialog")?.close());
document.querySelector("#creative-create-cover")?.addEventListener("click",()=>createPosterTemplate(selectedCreativeTemplateId,document.querySelector("#creative-cover-background").value,document.querySelector("#creative-cover-accent").value,document.querySelector("#creative-cover-title").value,document.querySelector("#creative-cover-subtitle").value,document.querySelector("#creative-cover-size").value));
document.querySelector("#creative-customize-template")?.addEventListener("click",()=>{
  const template=getCreativeTemplate(selectedCreativeTemplateId)||getCreativeTemplate("anime-awakening");
  document.querySelector("#creative-studio-dialog")?.close();
  document.querySelector("#poster-template-style").value=template.id;
  document.querySelector("#poster-background-color").value=document.querySelector("#creative-cover-background").value;
  document.querySelector("#poster-accent-color").value=document.querySelector("#creative-cover-accent").value;
  document.querySelector("#poster-title-value").value=document.querySelector("#creative-cover-title").value;
  document.querySelector("#poster-subtitle-value").value=document.querySelector("#creative-cover-subtitle").value;
  document.querySelector("#poster-size").value=document.querySelector("#creative-cover-size").value;
  document.querySelector("#poster-template-dialog")?.showModal();
});
const posterForm=document.querySelector("#poster-template-form");
document.querySelector("#poster-templates").addEventListener("click",()=>{if(!document.querySelector("#poster-template-dialog").open)document.querySelector("#poster-template-dialog").showModal();});
document.querySelector("#cancel-poster-template").addEventListener("click",()=>document.querySelector("#poster-template-dialog").close());
posterForm.addEventListener("submit",event=>{event.preventDefault();createPosterTemplate(document.querySelector("#poster-template-style").value,document.querySelector("#poster-background-color").value,document.querySelector("#poster-accent-color").value,document.querySelector("#poster-title-value").value,document.querySelector("#poster-subtitle-value").value,document.querySelector("#poster-size").value);});


function createNewDocumentFromForm() {
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    status.textContent = "Width and height must be positive whole numbers";
    return false;
  }
  if (state.dirty && !window.confirm("Discard changes since the last explicit save?")) return false;
  if (!detachActiveMultiPageSessionForReplacement("un documento nuevo")) return false;
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

async function saveBlobToDevice(blob, filename, imageFormat = null) {
  if (!(blob instanceof Blob) || blob.size < 1) throw new Error("There is no file data to export");
  const nativeBridge = globalThis.AnimeArtNative;
  if (nativeBridge && typeof nativeBridge.saveFile === "function") {
    if (blob.size > 50 * 1024 * 1024) throw new Error("Android export limit is 50 MB");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
    }
    const mimeType = blob.type || (imageFormat === "jpeg" ? "image/jpeg" : imageFormat === "webp" ? "image/webp" : imageFormat === "png" ? "image/png" : "application/json");
    nativeBridge.saveFile(btoa(binary), mimeType, filename);
    return "native";
  }
  if (imageFormat) {
    downloadImageBlob(blob, filename, imageFormat);
    return "browser";
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "browser";
}

async function shareBlobToDevice(blob, filename, imageFormat) {
  if (!(blob instanceof Blob) || blob.size < 1) throw new Error("No hay datos para compartir.");
  const nativeBridge = globalThis.AnimeArtNative;
  if (nativeBridge && typeof nativeBridge.shareFile === "function") {
    if (blob.size > 50 * 1024 * 1024) throw new Error("El límite para compartir en Android es 50 MB.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
    }
    nativeBridge.shareFile(btoa(binary), blob.type || "image/png", filename);
    return "native";
  }
  if (typeof navigator.share === "function" && typeof File === "function") {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "AnimeArt · diseño" });
        return "shared";
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      // Retain a local download fallback if the browser cannot share files.
    }
  }
  downloadImageBlob(blob, filename, imageFormat);
  return "download";
}

exportProjectButton.addEventListener("click", async () => {
  try {
    const serialized = serializeProjectFile(state.document);
    const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
    const destination = await saveBlobToDevice(blob, "animeart-project.json");
    status.textContent = destination === "native" ? "Choose where to save the project file" : "Project file exported";
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
    if (!detachActiveMultiPageSessionForReplacement("el archivo de proyecto importado")) return;
    await multiPagePersistenceQueue.catch(() => null);
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
  if (mobileExportResolutionInput && mobileExportResolutionInput.value !== exportResolutionInput.value) {
    mobileExportResolutionInput.value = exportResolutionInput.value;
  }
}

async function exportPng() {
  const hasCensorStrokes = state.document.layers.some(layer => layer.visible && (layer.strokes || []).some(stroke => stroke.tool === "censor-light"));
  if (hasCensorStrokes && !document.querySelector("#censor-permanent-export").checked) {
    status.textContent = "Activa “Censura permanente al exportar” para confirmar que los trazos se aplanarán en el archivo final.";
    return;
  }
  const documentBefore = JSON.stringify(state.document);
  const historyBeforeUndo = state.history.canUndo();
  const historyBeforeRedo = state.history.canRedo();
  exportPngButton.disabled = true;
  const format = exportFormatInput.value;
  status.textContent = "Exporting " + format.toUpperCase() + "…";
  try {
    await ensureExportImages(state.document);
    const resolution = exportResolutionInput?.value === "hd" ? "hd" : "normal";
    const exportScale = exportScaleForResolution(state.document, resolution);
    const outputWidth = Math.max(1, Math.round(state.document.width * exportScale));
    const outputHeight = Math.max(1, Math.round(state.document.height * exportScale));
    const exportCanvas = createPngExportCanvas({ ...state.document, width: outputWidth, height: outputHeight });
    renderDocumentToCanvas(state.document, exportCanvas, ({ context, document }) => {
      if (format === "jpeg") {
        context.save();
        context.fillStyle = exportBackgroundInput.value || "#ffffff";
        context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        context.restore();
      }
      context.scale(exportScale, exportScale);
      drawDocument({
        context,
        document,
        center: { x: document.width / 2, y: document.height / 2 },
        transformForLayer: layer => layer.transform
      });
    });
    const quality = Number(exportQualityInput.value) / 100;
    const blob = await canvasToImageBlob(exportCanvas, format, quality);
    const destination = await saveBlobToDevice(blob, "animeart." + format, format);
    if (JSON.stringify(state.document) !== documentBefore ||
        state.history.canUndo() !== historyBeforeUndo ||
        state.history.canRedo() !== historyBeforeRedo) {
      throw new Error("PNG export modified editor state");
    }
    status.textContent = destination === "native" ? "Choose where to save the image" : format.toUpperCase() + " exported";
  } catch (error) {
    status.textContent = error?.message || "PNG export failed";
  } finally {
    exportPngButton.disabled = false;
  }
}

exportPngButton.addEventListener("click", exportPng);

async function shareCurrentDesign() {
  const shareButton = document.querySelector("#share-current-design");
  if (shareButton?.disabled) return;
  const hasCensorStrokes = state.document.layers.some(layer =>
    layer.visible && (layer.strokes || []).some(stroke => stroke.tool === "censor-light")
  );
  if (hasCensorStrokes && !document.querySelector("#censor-permanent-export").checked) {
    status.textContent = "Activa «Censura permanente al exportar» para confirmar que esos trazos se aplanarán.";
    return;
  }
  const documentBefore = JSON.stringify(state.document);
  const historyBeforeUndo = state.history.canUndo();
  const historyBeforeRedo = state.history.canRedo();
  let shareCanvas = null;
  if (shareButton) shareButton.disabled = true;
  status.textContent = "Preparando imagen para compartir…";
  try {
    await ensureExportImages(state.document);
    const format = exportFormatInput.value;
    const resolution = exportResolutionInput?.value === "hd" ? "hd" : "normal";
    const exportScale = exportScaleForResolution(state.document, resolution);
    const outputWidth = Math.max(1, Math.round(state.document.width * exportScale));
    const outputHeight = Math.max(1, Math.round(state.document.height * exportScale));
    shareCanvas = createPngExportCanvas({ ...state.document, width: outputWidth, height: outputHeight });
    renderDocumentToCanvas(state.document, shareCanvas, ({ context, document }) => {
      if (format === "jpeg") {
        context.save();
        context.fillStyle = exportBackgroundInput.value || "#ffffff";
        context.fillRect(0, 0, shareCanvas.width, shareCanvas.height);
        context.restore();
      }
      context.scale(exportScale, exportScale);
      drawDocument({
        context,
        document,
        center: { x: document.width / 2, y: document.height / 2 },
        transformForLayer: layer => layer.transform
      });
    });
    const quality = Number(exportQualityInput.value) / 100;
    const blob = await canvasToImageBlob(shareCanvas, format, quality);
    const destination = await shareBlobToDevice(blob, "animeart." + format, format);
    if (JSON.stringify(state.document) !== documentBefore ||
        state.history.canUndo() !== historyBeforeUndo ||
        state.history.canRedo() !== historyBeforeRedo) {
      throw new Error("Compartir modificó el estado del editor.");
    }
    status.textContent = destination === "native"
      ? "Elige Canva u otra app compatible en el menú de Android."
      : destination === "shared"
        ? "Diseño compartido."
        : "No hay una app compatible para compartir; la imagen se descargó localmente.";
  } catch (error) {
    status.textContent = error?.name === "AbortError"
      ? "Compartir cancelado. Tu proyecto sigue abierto en AnimeArt."
      : error?.message || "No se pudo compartir el diseño.";
  } finally {
    if (shareCanvas) { shareCanvas.width = 0; shareCanvas.height = 0; }
    if (shareButton) shareButton.disabled = false;
  }
}


const transparencyButton = document.querySelector("#view-transparency");
const canvasWrapElement = document.querySelector(".canvas-wrap");
const backgroundModeButtons = [...document.querySelectorAll("[data-canvas-background]")];
const frameBoundaryButtons = [...document.querySelectorAll("[data-frame-boundary-mode]")];
function setFrameBoundaryMode(mode) {
  frameBoundaryMode = mode === "inside" ? "inside" : "free";
  frameBoundaryButtons.forEach(button => {
    const active = button.dataset.frameBoundaryMode === frameBoundaryMode;
    button.setAttribute("aria-pressed", String(active));
  });
  const message = frameBoundaryMode === "inside"
    ? "Marco bloqueado: al mover capas, se mantienen dentro del documento cuando su tamaño lo permite."
    : "Movimiento libre: las capas pueden salir del marco; solo se recorta al exportar.";
  if (window.matchMedia("(max-width: 920px)").matches) showMobileFeedback(message);
  else status.textContent = message;
  redraw();
}
frameBoundaryButtons.forEach(button => button.addEventListener("click", () => setFrameBoundaryMode(button.dataset.frameBoundaryMode)));
let transparencyPreview = false;
function setCanvasBackground(mode) {
  canvasWrapElement.dataset.background = mode;
  backgroundModeButtons.forEach(button => {
    const active = button.dataset.canvasBackground === mode;
    button.setAttribute("aria-pressed", String(active));
  });
  status.textContent = mode === "checkerboard"
    ? "Los cuadritos representan píxeles transparentes; no se exportan. El blanco dentro del dibujo sigue siendo opaco."
    : "Fondo de vista cambiado. Esta opción solo cambia la vista, no los píxeles de la imagen.";
}
transparencyButton?.addEventListener("click", () => {
  transparencyPreview = !transparencyPreview;
  transparencyButton.setAttribute("aria-pressed", String(transparencyPreview));
  transparencyButton.textContent = transparencyPreview ? "Salir de vista previa" : "Ver transparencia";
  status.textContent = transparencyPreview
    ? "Vista previa de transparencia: los controles de selección no se incluyen en el PNG. El patrón no se exporta."
    : "Volviste al modo de edición. Los cuadritos solo representan transparencia.";
  redraw();
  updateRemoveImageControl();
});
backgroundModeButtons.forEach(button => button.addEventListener("click", () => setCanvasBackground(button.dataset.canvasBackground)));
const toggleLayersPanelButton = document.querySelector("#toggle-layers-panel");
toggleLayersPanelButton?.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("layers-collapsed");
  toggleLayersPanelButton.setAttribute("aria-pressed", String(!collapsed));
  toggleLayersPanelButton.textContent = collapsed ? "Mostrar capas" : "Ocultar capas";
  toggleLayersPanelButton.title = collapsed ? "Volver a mostrar capas y propiedades" : "Ocultar capas y propiedades para ampliar el lienzo";
});
removeSelectedImageButton?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  removeSelectedImage();
});
document.querySelector("#quick-remove-image")?.addEventListener("click", () => removeSelectedImage());
document.querySelector("#quick-remove-background")?.addEventListener("click", () => {
  const layer = selectedLayerExact();
  if (!layer || layer.contentType !== "image" || !layer.image) {
    status.textContent = "Seleccioná una imagen antes de quitar el fondo.";
    return;
  }
  removeBackgroundButton.click();
});
document.querySelector("#quick-recover")?.addEventListener("click", () => undoButton.click());
document.querySelector("#export-transparent-png")?.addEventListener("click", () => {
  exportFormatInput.value = "png";
  syncExportFormatControls();
  exportPngButton.click();
});
updateSelectionIndicator();
setCanvasBackground("checkerboard");
setFrameBoundaryMode(frameBoundaryMode);
if (transparencyButton) {
  transparencyButton.setAttribute("aria-pressed", "false");
  transparencyButton.textContent = "Ver transparencia";
}
const mobileExportFormatInput = document.querySelector("#mobile-export-format");
if (mobileExportFormatInput) {
  mobileExportFormatInput.value = exportFormatInput.value;
  mobileExportFormatInput.addEventListener("change", () => {
    exportFormatInput.value = mobileExportFormatInput.value;
    syncExportFormatControls();
  });
  exportFormatInput.addEventListener("change", () => {
    mobileExportFormatInput.value = exportFormatInput.value;
  });
}
exportFormatInput.addEventListener("change", syncExportFormatControls);
exportQualityInput.addEventListener("input", syncExportFormatControls);
exportResolutionInput?.addEventListener("change", syncExportFormatControls);
if (mobileExportResolutionInput) {
  mobileExportResolutionInput.value = exportResolutionInput?.value || "normal";
  mobileExportResolutionInput.addEventListener("change", () => {
    if (exportResolutionInput) exportResolutionInput.value = mobileExportResolutionInput.value;
    syncExportFormatControls();
  });
  exportResolutionInput?.addEventListener("change", () => {
    mobileExportResolutionInput.value = exportResolutionInput.value;
  });
}
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
    setStorageRecoveryPending(true, "No se pudo leer el almacenamiento local. El guardado automático está pausado para proteger tus datos.");
    status.textContent = "Almacenamiento local no disponible";
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
    setStorageRecoveryPending(true, "No se pudo abrir el proyecto guardado. Los datos originales están protegidos y el guardado automático está pausado. Crea un documento nuevo y pulsa Guardar solo si deseas reemplazar el proyecto anterior.");
    status.textContent = "No se pudo recuperar el proyecto guardado";
  }
}


function applySelectedLayerAlignment(mode){
 const ids=[...state.selectedLayerIds],result=createLayerAlignmentTransforms(state.document,ids,mode),feedback=document.querySelector("#layer-alignment-status");
 if(!result.ok){if(feedback)feedback.textContent=result.error;status.textContent=result.error;return false;}
 if(!result.transforms.length){if(feedback)feedback.textContent="Las capas ya están alineadas.";return true;}
 const before=cloneDocument(state.document),next=transformLayers(state.document,result.transforms);
 if(!next){if(feedback)feedback.textContent="No se pudo alinear la selección.";return false;}
 state.document=next;state.history.record(before,next);refreshDocument("Alineación aplicada.");persistDocument();
 if(feedback)feedback.textContent="Listo. Puedes deshacer la alineación.";return true;
}
function setDesignLibraryStatus(message,kind="info"){const node=document.querySelector("#design-library-status");if(node){node.textContent=String(message||"");node.dataset.kind=kind;}}

async function createDesignThumbnail(documentModel){
 const imageLayers=(documentModel.layers||[]).filter(layer=>layer.visible&&layer.contentType==="image"&&layer.image?.source);
 await Promise.all(imageLayers.map(layer=>new Promise(resolve=>{
  const source=layer.image.source,existing=imageCache.get(source);
  if(existing?.complete){resolve();return;}
  const image=existing||new Image();
  image.onload=()=>{imageCache.set(source,image);resolve();};
  image.onerror=()=>resolve();
  if(!existing){imageCache.set(source,image);image.src=source;}
 })));
 try{
  const scale=Math.min(1,240/Math.max(1,documentModel.width),200/Math.max(1,documentModel.height));
  const preview=document.createElement("canvas");
  preview.width=Math.max(1,Math.round(documentModel.width*scale));
  preview.height=Math.max(1,Math.round(documentModel.height*scale));
  const context=preview.getContext("2d",{alpha:true});
  if(!context)return "";
  context.scale(scale,scale);
  drawDocument({context,document:documentModel,center:documentCenter(documentModel),transformForLayer:layer=>layer.transform,allowOffDocumentPreview:false});
  const thumbnail=preview.toDataURL("image/webp",0.7);
  return thumbnail.length<=280000?thumbnail:"";
 }catch{return "";}
}
function renderDesignLibrary(){
 const grid=document.querySelector("#design-library-list");if(!grid)return Promise.resolve();
 grid.replaceChildren();const loading=document.createElement("p");loading.className="design-library-empty";loading.textContent="Cargando tus diseños…";grid.append(loading);
 return listDesigns().then(records=>{
  grid.replaceChildren();
  if(!records.length){const empty=document.createElement("p");empty.className="design-library-empty";empty.textContent="Todavía no guardaste diseños. Escribe un nombre y pulsa «Guardar diseño actual».";grid.append(empty);return;}
  for(const record of records){
   const card=document.createElement("article");card.className="design-library-card";
   const preview=document.createElement("div");preview.className="design-library-visual";
   if(record.thumbnail){const img=document.createElement("img");img.src=record.thumbnail;img.alt="Vista previa de "+record.name;preview.append(img);}
   else{const mock=document.createElement("div");mock.className="design-library-placeholder";mock.textContent="KapiArt";mock.setAttribute("aria-hidden","true");preview.append(mock);}
   const details=document.createElement("div");details.className="design-library-copy";
   const name=document.createElement("strong");name.textContent=record.name;
   const meta=document.createElement("small");meta.textContent=record.width+" × "+record.height+" px · "+record.layerCount+" capas";
   const updated=document.createElement("small");updated.textContent="Actualizado "+new Date(record.updatedAt).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"});
   details.append(name,meta,updated);
   const actions=document.createElement("div");actions.className="design-library-card-actions";
   for(const [action,label] of [["open","Abrir"],["duplicate","Duplicar"],["rename","Renombrar"],["delete","Eliminar"]]){
    const button=document.createElement("button");button.type="button";button.dataset.designAction=action;button.dataset.designId=record.id;button.textContent=label;if(action==="delete")button.className="design-library-delete";actions.append(button);
   }
   card.append(preview,details,actions);grid.append(card);
  }
 }).catch(error=>{grid.replaceChildren();const msg=document.createElement("p");msg.className="design-library-empty";msg.textContent=error?.message||"No se pudo abrir la biblioteca local.";grid.append(msg);setDesignLibraryStatus(msg.textContent,"error");});
}
function showDesignLibraryDialog(){
 const dialog=document.querySelector("#design-library-dialog");if(!dialog)return;
 if(!dialog.open){try{dialog.showModal();}catch{dialog.setAttribute("open","");}}
 const name=document.querySelector("#design-library-name");if(name&&!name.value)name.value="Mi diseño";
 renderDesignLibrary();
}

function setMultiPageStatus(message, kind = "info") {
 const node = document.querySelector("#multi-page-status");
 if (node) { node.textContent = String(message || ""); node.dataset.kind = kind; }
}
function detachActiveMultiPageSessionForReplacement(replacementLabel = "un documento independiente") {
 if (!activeMultiPageSession) return true;
 const name = activeMultiPageSession.name || "este proyecto";
 const approved = window.confirm("La página actual pertenece a «" + name + "». KapiArt conservará la página guardada y abrirá " + replacementLabel + " fuera del proyecto multipágina. ¿Continuar?");
 if (!approved) return false;
 const finalPageSave = queueActiveMultiPagePageSave();
 activeMultiPageSession = null;
 void finalPageSave.catch(() => null);
 setMultiPageStatus("Página anterior conservada en «" + name + "». El nuevo lienzo queda fuera del proyecto.", "success");
 return true;
}
function queueActiveMultiPagePageSave() {
 if (!activeMultiPageSession || state.storageRecoveryPending) return Promise.resolve(null);
 const projectId = activeMultiPageSession.id, pageId = activeMultiPageSession.activePageId;
 const snapshot = cloneDocument(state.document);
 multiPagePersistenceQueue = multiPagePersistenceQueue.catch(() => null).then(async () => {
  const result = await saveMultiPagePage(projectId, pageId, snapshot);
  if (activeMultiPageSession?.id === projectId && activeMultiPageSession?.activePageId === pageId) activeMultiPageSession = { ...result.project, activePageId: pageId };
  return result;
 }).catch(error => { setMultiPageStatus(error?.message || "No se pudo guardar la página.", "error"); return null; });
 return multiPagePersistenceQueue;
}
async function saveActiveMultiPagePage({ withThumbnail = true, announce = true } = {}) {
 if (!activeMultiPageSession) return null;
 if (state.storageRecoveryPending) throw new Error("Resuelve primero el aviso de recuperación del almacenamiento.");
 await multiPagePersistenceQueue.catch(() => null);
 const session = activeMultiPageSession, pageId = session.activePageId, projectId = session.id;
 const snapshot = cloneDocument(state.document);
 const options = withThumbnail ? { thumbnail: await createDesignThumbnail(snapshot) } : {};
 const result = await saveMultiPagePage(projectId, pageId, snapshot, options);
 if (activeMultiPageSession?.id === projectId && activeMultiPageSession?.activePageId === pageId) activeMultiPageSession = { ...result.project, activePageId: pageId };
 state.dirty = false;
 if (announce) setMultiPageStatus("Página guardada: " + (result.page?.name || "Página actual"), "success");
 return result;
}
function installMultiPageDocument(project, pageId, documentModel, message) {
 activeMultiPageSession = { ...project, activePageId: pageId };
 persistDocumentSnapshot(localStorage, "animeart-web-document", documentModel);
 state.document = documentModel;
 state.history.reset(documentModel);
 const last = documentModel.layers.at(-1)?.id || null;
 setSelection(last ? [last] : [], last);
 state.viewport = createViewport();
 state.transformInteraction = null; state.multiTransformInteraction = null; state.adjustmentPreview = null;
 state.imageEraseInteraction = null; state.imageRestoreInteraction = null; state.magicEraseInteraction = null;
 state.drawing = false; state.strokeBefore = null; state.textPreview = null; state.dirty = false;
 setStorageRecoveryPending(false);
 refreshDocument(message);
 state.dirty = false;
 status.textContent = message;
 setMultiPageStatus(message, "success");
}
function showMultiPageDialog() {
 const dialog = document.querySelector("#multi-page-dialog");
 if (!dialog) return;
 if (!dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); } }
 const input = document.querySelector("#multi-page-project-name");
 if (input && !input.value.trim()) input.value = activeMultiPageSession?.name || "Mi cómic";
 void renderMultiPageDialog();
}
async function renderMultiPageDialog() {
 const pageList = document.querySelector("#multi-page-page-list"), projectList = document.querySelector("#multi-page-project-list");
 const activePanel = document.querySelector("#multi-page-active");
 if (!pageList || !projectList || !activePanel) return;
 pageList.replaceChildren(); projectList.replaceChildren();
 try {
  if (activeMultiPageSession) await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
  const records = await listMultiPageProjects();
  if (activeMultiPageSession) {
   const fresh = records.find(project => project.id === activeMultiPageSession.id);
   if (fresh) activeMultiPageSession = { ...fresh, activePageId: activeMultiPageSession.activePageId };
  }
  const session = activeMultiPageSession;
  activePanel.hidden = !session;
  if (session) {
   const currentPage = session.pages.find(page => page.id === session.activePageId);
   document.querySelector("#multi-page-active-name").textContent = session.name;
   document.querySelector("#multi-page-active-page").textContent = currentPage
    ? currentPage.name + " · Página " + (session.pages.findIndex(page => page.id === currentPage.id) + 1) + " de " + session.pages.length
    : "No hay una página activa";
   const copyTarget = document.querySelector("#multi-page-copy-target");
   copyTarget.replaceChildren();
   const alternatives = session.pages.filter(page => page.id !== session.activePageId);
   if (!alternatives.length) {
    const option = document.createElement("option"); option.value = ""; option.textContent = "Crea otra página primero"; copyTarget.append(option);
   } else {
    for (const page of alternatives) { const option = document.createElement("option"); option.value = page.id; option.textContent = page.name; copyTarget.append(option); }
   }
   document.querySelector("#multi-page-copy-layer").disabled = !alternatives.length || !state.selectedLayerId;
   for (let index = 0; index < session.pages.length; index++) {
    const page = session.pages[index], card = document.createElement("article");
    card.className = "multi-page-page-card" + (page.id === session.activePageId ? " is-active" : "");
    const preview = document.createElement("div"); preview.className = "multi-page-page-preview";
    if (page.thumbnail) { const image = document.createElement("img"); image.src = page.thumbnail; image.alt = "Vista previa de " + page.name; image.loading = "lazy"; preview.append(image); }
    else { const placeholder = document.createElement("span"); placeholder.textContent = "P" + (index + 1); placeholder.setAttribute("aria-hidden", "true"); preview.append(placeholder); }
    const info = document.createElement("div"); info.className = "multi-page-page-info";
    const name = document.createElement("strong"); name.textContent = page.name;
    const meta = document.createElement("small"); meta.textContent = page.width + " × " + page.height + " px · " + page.layerCount + " capas";
    info.append(name, meta);
    const actions = document.createElement("div"); actions.className = "multi-page-card-actions";
    const defs = [["open","Editar",page.id === session.activePageId],["duplicate","Duplicar",session.pages.length >= 10],["rename","Renombrar",false],["up","↑",index === 0],["down","↓",index === session.pages.length - 1],["delete","Eliminar",session.pages.length <= 1]];
    for (const [action,label,disabled] of defs) {
     const button = document.createElement("button"); button.type = "button"; button.dataset.multiPageAction = action;
     button.dataset.projectId = session.id; button.dataset.pageId = page.id; button.textContent = label; button.disabled = disabled;
     if (action === "delete") button.className = "multi-page-delete";
     if (action === "open" && disabled) button.textContent = "Actual";
     actions.append(button);
    }
    card.append(preview, info, actions); pageList.append(card);
   }
  } else {
   const empty = document.createElement("p"); empty.className = "multi-page-empty";
   empty.textContent = "Crea un proyecto desde el lienzo actual para empezar a añadir páginas. Cada página conserva sus capas editables.";
   pageList.append(empty);
  }
  if (!records.length) {
   const empty = document.createElement("p"); empty.className = "multi-page-empty"; empty.textContent = "Todavía no tienes proyectos multipágina guardados."; projectList.append(empty);
  } else {
   for (const project of records) {
    const card = document.createElement("article"); card.className = "multi-page-project-card";
    const copy = document.createElement("div"); copy.className = "multi-page-project-copy";
    const name = document.createElement("strong"); name.textContent = project.name;
    const meta = document.createElement("small"); meta.textContent = project.pageCount + " páginas · actualizado " + new Date(project.updatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    copy.append(name, meta);
    const actions = document.createElement("div"); actions.className = "multi-page-card-actions";
    for (const [action,label] of [["open","Abrir"],["rename","Renombrar"],["delete","Eliminar"]]) {
     const button = document.createElement("button"); button.type = "button"; button.dataset.multiProjectAction = action; button.dataset.projectId = project.id; button.textContent = label;
     if (action === "delete") button.className = "multi-page-delete";
     actions.append(button);
    }
    card.append(copy, actions); projectList.append(card);
   }
  }
 } catch (error) { setMultiPageStatus(error?.message || "No se pudo leer la biblioteca multipágina.", "error"); }
}
async function activateMultiPagePage(projectId, pageId, { skipConfirm = false } = {}) {
 if (state.storageRecoveryPending) throw new Error("Resuelve primero el aviso de recuperación del almacenamiento.");
 if (!activeMultiPageSession && state.dirty && !skipConfirm && !window.confirm("¿Abrir un proyecto multipágina? Tu documento actual conserva su copia local, pero dejará de ser el lienzo activo.")) return false;
 if (activeMultiPageSession) await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
 const records = await listMultiPageProjects(), found = records.find(project => project.id === projectId);
 if (!found) throw new Error("No se encontró el proyecto multipágina.");
 const page = found.pages.find(item => item.id === pageId);
 if (!page) throw new Error("No se encontró la página seleccionada.");
 const next = await loadMultiPagePage(projectId, pageId);
 if (!next) throw new Error("La página no contiene un documento válido.");
 const updated = await setActiveMultiPagePage(projectId, pageId);
 installMultiPageDocument(updated || found, pageId, next, "Página abierta: " + page.name);
 await renderMultiPageDialog();
 return true;
}
async function createMultiPageFromCurrentCanvas(name) {
 if (state.storageRecoveryPending) throw new Error("Resuelve primero el aviso de recuperación del almacenamiento.");
 if (state.document.width <= 0 || state.document.height <= 0) throw new Error("Crea primero un lienzo con ancho y alto definidos.");
 if (activeMultiPageSession) await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
 const snapshot = cloneDocument(state.document), thumbnail = await createDesignThumbnail(snapshot);
 const project = await createMultiPageProject({ name, document: snapshot, thumbnail });
 activeMultiPageSession = { ...project, activePageId: project.pages[0].id };
 state.dirty = false;
 setMultiPageStatus("Proyecto creado: " + project.name, "success");
 await renderMultiPageDialog();
}
async function addBlankMultiPagePage() {
 if (!activeMultiPageSession) throw new Error("Crea o abre primero un proyecto multipágina.");
 await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
 const name = "Página " + (activeMultiPageSession.pages.length + 1), projectId = activeMultiPageSession.id;
 const blank = createDocument(state.document.width, state.document.height);
 const added = await addMultiPagePage(projectId, { name, document: blank });
 await activateMultiPagePage(projectId, added.page.id, { skipConfirm: true });
 setMultiPageStatus("Se creó " + added.page.name + ".", "success");
}
async function duplicateMultiPagePageFrom(pageId) {
 if (!activeMultiPageSession) throw new Error("Crea o abre primero un proyecto multipágina.");
 const session = activeMultiPageSession;
 if (session.pages.length >= 10) throw new Error("Este proyecto llegó al máximo de 10 páginas.");
 await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
 const sourcePage = session.pages.find(page => page.id === pageId);
 if (!sourcePage) throw new Error("No se encontró la página que quieres duplicar.");
 const source = await loadMultiPagePage(session.id, pageId);
 if (!source) throw new Error("No se pudo leer la página que quieres duplicar.");
 const added = await addMultiPagePage(session.id, { name: sourcePage.name + " (copia)", document: source, thumbnail: sourcePage.thumbnail });
 await activateMultiPagePage(session.id, added.page.id, { skipConfirm: true });
 setMultiPageStatus("Página duplicada: " + added.page.name, "success");
}
async function handleMultiPageItemAction(button) {
 const action = button.dataset.multiPageAction, projectId = button.dataset.projectId, pageId = button.dataset.pageId;
 const records = await listMultiPageProjects(), project = records.find(item => item.id === projectId);
 if (!project) throw new Error("No se encontró el proyecto multipágina.");
 const page = project.pages.find(item => item.id === pageId);
 if (!page) throw new Error("No se encontró la página.");
 if (action === "open") { await activateMultiPagePage(projectId, pageId); return; }
 if (action === "duplicate") { if (activeMultiPageSession?.id !== projectId) await activateMultiPagePage(projectId, pageId); await duplicateMultiPagePageFrom(pageId); return; }
 if (action === "rename") {
  const name = window.prompt("Nombre de la página:", page.name); if (name === null) return;
  const updated = await renameMultiPagePage(projectId, pageId, name);
  if (activeMultiPageSession?.id === projectId) activeMultiPageSession = { ...updated, activePageId: activeMultiPageSession.activePageId };
  setMultiPageStatus("Nombre de página actualizado.", "success"); await renderMultiPageDialog(); return;
 }
 if (action === "up" || action === "down") {
  if (activeMultiPageSession?.id === projectId) await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
  const index = project.pages.findIndex(item => item.id === pageId);
  const updated = await reorderMultiPagePage(projectId, pageId, index + (action === "up" ? -1 : 1));
  if (activeMultiPageSession?.id === projectId) activeMultiPageSession = { ...updated, activePageId: activeMultiPageSession.activePageId };
  setMultiPageStatus("Orden de páginas actualizado.", "success"); await renderMultiPageDialog(); return;
 }
 if (action === "delete") {
  if (!window.confirm("¿Eliminar «" + page.name + "»? Esta acción no se puede deshacer.")) return;
  const wasActive = activeMultiPageSession?.id === projectId && activeMultiPageSession?.activePageId === pageId;
  if (activeMultiPageSession?.id === projectId) await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
  const updated = await deleteMultiPagePage(projectId, pageId);
  if (activeMultiPageSession?.id === projectId) {
   activeMultiPageSession = { ...updated, activePageId: updated.activePageId };
   if (wasActive) {
    const nextPage = updated.pages.find(item => item.id === updated.activePageId) || updated.pages[0];
    const next = await loadMultiPagePage(projectId, nextPage.id);
    installMultiPageDocument(updated, nextPage.id, next, "Página eliminada. Abriendo " + nextPage.name + ".");
   }
  }
  setMultiPageStatus("Página eliminada.", "success"); await renderMultiPageDialog();
 }
}
async function handleMultiProjectAction(button) {
 const action = button.dataset.multiProjectAction, id = button.dataset.projectId;
 const projects = await listMultiPageProjects(), project = projects.find(item => item.id === id);
 if (!project) throw new Error("No se encontró el proyecto.");
 if (action === "open") { const target = project.pages.find(page => page.id === project.activePageId) || project.pages[0]; await activateMultiPagePage(id, target.id); return; }
 if (action === "rename") {
  const name = window.prompt("Nombre del proyecto:", project.name); if (name === null) return;
  const updated = await renameMultiPageProject(id, name);
  if (activeMultiPageSession?.id === id) activeMultiPageSession = { ...updated, activePageId: activeMultiPageSession.activePageId };
  setMultiPageStatus("Proyecto renombrado.", "success"); await renderMultiPageDialog(); return;
 }
 if (action === "delete") {
  if (!window.confirm("¿Eliminar el proyecto «" + project.name + "» con todas sus páginas? Esta acción no se puede deshacer.")) return;
  if (activeMultiPageSession?.id === id) { await saveActiveMultiPagePage({ withThumbnail: true, announce: false }); activeMultiPageSession = null; }
  await deleteMultiPageProject(id);
  setMultiPageStatus("Proyecto eliminado de este dispositivo.", "success"); await renderMultiPageDialog();
 }
}

async function awaitDocumentImage(source) {
 const cached = imageCache.get(source);
 const image = cached || new Image();
 if (!cached) imageCache.set(source, image);
 if (image.complete) {
  if (image.naturalWidth > 0) return image;
  throw new Error("No se pudo cargar una imagen necesaria para exportar el PDF.");
 }
 await new Promise((resolve, reject) => {
  const cleanup = () => { image.removeEventListener("load", loaded); image.removeEventListener("error", failed); };
  const loaded = () => { cleanup(); resolve(); };
  const failed = () => { cleanup(); reject(new Error("Una imagen de una de las páginas no se pudo cargar. Revisa el proyecto y vuelve a intentarlo.")); };
  image.addEventListener("load", loaded, { once: true });
  image.addEventListener("error", failed, { once: true });
  if (!cached) image.src = source;
  if (image.complete) { if (image.naturalWidth > 0) loaded(); else failed(); }
 });
 if (!image.complete || image.naturalWidth < 1) throw new Error("Una imagen de una página no está disponible para exportar.");
 return image;
}
async function renderMultiPagePdfImage(documentModel, scale) {
 const sources = [...new Set((documentModel.layers || []).filter(layer => layer.visible && layer.contentType === "image" && layer.image?.source).map(layer => layer.image.source))];
 await Promise.all(sources.map(awaitDocumentImage));
 const width = Math.max(1, Math.round(documentModel.width * scale)), height = Math.max(1, Math.round(documentModel.height * scale));
 const canvas = createPngExportCanvas({ width, height });
 renderDocumentToCanvas(documentModel, canvas, ({ context, document: exportDocument }) => {
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.save(); context.scale(canvas.width / exportDocument.width, canvas.height / exportDocument.height);
  drawDocument({ context, document: exportDocument, center: { x: exportDocument.width / 2, y: exportDocument.height / 2 },
   transformForLayer: layer => layer.transform, allowOffDocumentPreview: false, includeLivePreviews: false });
  context.restore();
 });
 const blob = await canvasToImageBlob(canvas, "jpeg", 0.88);
 if (blob.size < 4) throw new Error("El navegador no pudo renderizar una página para el PDF.");
 return { width, height, jpegBytes: new Uint8Array(await blob.arrayBuffer()), blobSize: blob.size };
}
async function exportActiveMultiPagePdf() {
 if (!activeMultiPageSession) throw new Error("Abre o crea primero un proyecto multipágina.");
 if (state.storageRecoveryPending) throw new Error("Resuelve primero el aviso de recuperación del almacenamiento.");
 const button = document.querySelector("#multi-page-export-pdf");
 if (button) button.disabled = true;
 try {
  await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
  await multiPagePersistenceQueue.catch(() => null);
  const records = await listMultiPageProjects(), project = records.find(item => item.id === activeMultiPageSession?.id);
  if (!project || !project.pages.length) throw new Error("El proyecto no contiene páginas para exportar.");
  const documents = [];
  for (const page of project.pages) {
   const documentModel = await loadMultiPagePage(project.id, page.id);
   if (!documentModel) throw new Error("No se pudo abrir la página «" + page.name + "» para exportar.");
   documents.push({ page, document: documentModel });
  }
  const totalPixels = documents.reduce((sum, item) => sum + item.document.width * item.document.height, 0);
  const largestPagePixels = Math.max(...documents.map(item => item.document.width * item.document.height));
  const scale = Math.min(1, Math.sqrt(16_000_000 / largestPagePixels), Math.sqrt(48_000_000 / totalPixels));
  const pdfPages = []; let totalJpegBytes = 0;
  for (let index = 0; index < documents.length; index++) {
   const item = documents[index];
   setMultiPageStatus("Renderizando página " + (index + 1) + " de " + documents.length + "…", "info");
   const rendered = await renderMultiPagePdfImage(item.document, scale);
   totalJpegBytes += rendered.blobSize;
   if (totalJpegBytes > 44 * 1024 * 1024) throw new Error("El PDF supera el límite seguro de exportación de 45 MB. Reduce la resolución o exporta menos páginas por proyecto.");
   pdfPages.push({ width: item.document.width, height: item.document.height, imageWidth: rendered.width, imageHeight: rendered.height, jpegBytes: rendered.jpegBytes });
  }
  const pdf = buildMultiPagePdf(pdfPages), blob = new Blob([pdf], { type: "application/pdf" });
  const baseName = String(project.name || "kapiart").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "kapiart";
  await saveBlobToDevice(blob, baseName + ".pdf");
  setMultiPageStatus("PDF exportado correctamente: " + project.name + " · " + project.pages.length + " páginas.", "success");
 } catch (error) {
  setMultiPageStatus(error?.message || "No se pudo exportar el PDF.", "error");
 } finally { if (button) button.disabled = false; }
}

async function copySelectedLayerToAnotherPage() {
 if (!activeMultiPageSession) throw new Error("Abre primero un proyecto multipágina.");
 if (!state.selectedLayerId) throw new Error("Selecciona una capa para copiar.");
 const targetId = document.querySelector("#multi-page-copy-target")?.value;
 if (!targetId) throw new Error("Elige otra página de destino.");
 await saveActiveMultiPagePage({ withThumbnail: true, announce: false });
 const session = activeMultiPageSession, target = session.pages.find(page => page.id === targetId);
 if (!target) throw new Error("No se encontró la página de destino.");
 const targetDocument = await loadMultiPagePage(session.id, targetId);
 if (!targetDocument) throw new Error("No se pudo abrir la página de destino.");
 const copied = copyLayerToPage(state.document, targetDocument, state.selectedLayerId);
 if (!copied.ok) throw new Error(copied.error);
 const thumbnail = await createDesignThumbnail(copied.document);
 const saved = await saveMultiPagePage(session.id, targetId, copied.document, { thumbnail });
 activeMultiPageSession = { ...saved.project, activePageId: session.activePageId };
 setMultiPageStatus("Capa copiada a «" + target.name + "». Se conservó editable.", "success");
 await renderMultiPageDialog();
}


function setLayerGroupingStatus(message, kind = "info") {
  const node = document.querySelector("#layer-grouping-status");
  if (node) { node.textContent = String(message || ""); node.dataset.kind = kind; }
}
function applyGroupSelection() {
  const selectedIds = [...state.selectedLayerIds];
  if (selectedIds.length < 2) {
    setLayerGroupingStatus("Seleccioná al menos dos capas para agrupar.", "error");
    showMobileFeedback("Seleccioná al menos dos capas para agrupar.", "error");
    return false;
  }
  const before = cloneDocument(state.document);
  const next = groupLayers(state.document, selectedIds);
  if (!next) {
    setLayerGroupingStatus("No se pudo agrupar. Comprobá que las capas existan y estén desbloqueadas.", "error");
    showMobileFeedback("No se pudo agrupar. Comprobá que las capas existan y estén desbloqueadas.", "error");
    return false;
  }
  state.document = next;
  state.history.record(before, next);
  setSelection(selectedIds, state.selectedLayerId);
  refreshDocument("Grupo creado. Las capas siguen siendo independientes y puedes desagruparlas.");
  persistDocument();
  setLayerGroupingStatus("Grupo creado. Las capas seleccionadas se moverán como una unidad.", "success");
  showMobileFeedback("Grupo creado. Moverás sus capas como una unidad.", "success");
  return true;
}
function applyUngroupSelection() {
  const selectedIds = [...state.selectedLayerIds];
  const before = cloneDocument(state.document);
  const next = ungroupLayers(state.document, selectedIds);
  if (!next) {
    setLayerGroupingStatus("Seleccioná una capa agrupada para desagruparla.", "error");
    showMobileFeedback("Seleccioná una capa agrupada para desagruparla.", "error");
    return false;
  }
  state.document = next;
  state.history.record(before, next);
  setSelection(selectedIds, state.selectedLayerId);
  refreshDocument("Grupo separado. Cada capa conserva su contenido y transformación.");
  persistDocument();
  setLayerGroupingStatus("Grupo separado. Cada capa vuelve a editarse por separado.", "success");
  showMobileFeedback("Grupo separado. Cada capa vuelve a editarse por separado.", "success");
  return true;
}

function initializeCanvaWorkflowTools(){
 const resizeDialog=document.querySelector("#design-resize-dialog");
 const resizeForm=document.querySelector("#design-resize-form");
 const resizePreset=document.querySelector("#design-resize-preset");
 const resizeWidth=document.querySelector("#design-resize-width");
 const resizeHeight=document.querySelector("#design-resize-height");
 const resizeCurrent=document.querySelector("#design-resize-current");
 const resizeStatus=document.querySelector("#design-resize-status");
 const resizeApply=document.querySelector("#design-resize-apply");
 const resizePresets={square:[1080,1080],post:[1080,1350],story:[1080,1920],video:[1920,1080],wallpaper:[1440,3200],a4:[2480,3508]};
 const resizeModeLabels={fit:"Ajustar todo",fill:"Cubrir el lienzo",reframe:"Cambiar solo el marco"};
 const updateResizeAvailability=()=>{
  if(!resizeApply)return;
  const width=Number(resizeWidth?.value),height=Number(resizeHeight?.value);
  resizeApply.disabled=!(Number.isInteger(width)&&width>0&&width<=8192&&Number.isInteger(height)&&height>0&&height<=8192&&width*height<=40000000&&state.document.width>0&&state.document.height>0);
 };
 const openResizeDialog=()=>{
  if(!resizeDialog||!resizeWidth||!resizeHeight)return;
  resizeWidth.value=String(state.document.width>0?state.document.width:800);
  resizeHeight.value=String(state.document.height>0?state.document.height:600);
  if(resizePreset)resizePreset.value="custom";
  if(resizeCurrent)resizeCurrent.textContent=state.document.width>0&&state.document.height>0
   ?"Lienzo actual: "+state.document.width+" × "+state.document.height+" px · "+state.document.layers.length+" capas editables."
   :"Primero crea un lienzo para poder adaptar su composición.";
  if(resizeStatus)resizeStatus.textContent="Las capas seguirán separadas. Puedes deshacer el cambio con el botón Deshacer.";
  updateResizeAvailability();
  if(!resizeDialog.open)resizeDialog.showModal();
 };
 document.querySelector("#open-design-resize")?.addEventListener("click",openResizeDialog);
 document.querySelector("#quick-open-design-resize")?.addEventListener("click",()=>{if(toolboxDialog?.open)toolboxDialog.close();openResizeDialog();});
 document.querySelector("#design-resize-close")?.addEventListener("click",()=>resizeDialog?.close());
 document.querySelector("#design-resize-cancel")?.addEventListener("click",()=>resizeDialog?.close());
 resizePreset?.addEventListener("change",()=>{
  const dimensions=resizePresets[resizePreset.value];
  if(dimensions){resizeWidth.value=String(dimensions[0]);resizeHeight.value=String(dimensions[1]);}
  updateResizeAvailability();
 });
 [resizeWidth,resizeHeight].forEach(input=>input?.addEventListener("input",()=>{
  if(resizePreset)resizePreset.value="custom";
  updateResizeAvailability();
 }));
 resizeForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(state.storageRecoveryPending){
   if(resizeStatus)resizeStatus.textContent="El proyecto está protegido. Guarda o exporta una copia antes de adaptar el lienzo.";
   return;
  }
  const width=Number(resizeWidth?.value),height=Number(resizeHeight?.value);
  const mode=resizeForm.querySelector('input[name="design-resize-mode"]:checked')?.value||"fit";
  if(!resizeApply)return;
  resizeApply.disabled=true;
  try{
   const before=cloneDocument(state.document);
   const next=resizeDocumentForFormat(state.document,width,height,mode);
   state.document=next;
   state.history.record(before,next);
   state.viewport=createViewport();
   state.transformInteraction=null;
   state.multiTransformInteraction=null;
   state.drawing=false;
   state.strokeBefore=null;
   state.textPreview=null;
   state.dirty=true;
   const message="Formato adaptado: "+width+" × "+height+" px. Se conservaron "+next.layers.length+" capas editables.";
   refreshDocument(message);
   persistDocument();
   let notice=message+" Modo: "+resizeModeLabels[mode]+".";
   if(activeMultiPageSession){
    try{await saveActiveMultiPagePage({withThumbnail:true,announce:false});}
    catch(error){notice+=" Aviso: no se pudo actualizar la copia multipágina guardada; abre Páginas y pulsa «Guardar página». "+(error?.message||"");}
   }
   if(resizeCurrent)resizeCurrent.textContent="Nuevo lienzo: "+width+" × "+height+" px · "+next.layers.length+" capas editables.";
   if(resizeStatus)resizeStatus.textContent=notice;
   resizeDialog.close();
   showMobileFeedback(notice,notice.startsWith(message+" Modo:")?"success":"info");
  }catch(error){
   if(resizeStatus)resizeStatus.textContent=error?.message||"No se pudo adaptar el lienzo. No se han aplanado las capas.";
  }finally{updateResizeAvailability();}
 });
 document.querySelectorAll("[data-layer-align]").forEach(button=>button.addEventListener("click",()=>applySelectedLayerAlignment(button.dataset.layerAlign)));
 document.querySelector("#layer-group-selection")?.addEventListener("click",applyGroupSelection);
 document.querySelector("#layer-ungroup-selection")?.addEventListener("click",applyUngroupSelection);
 const dialog=document.querySelector("#design-library-dialog"),input=document.querySelector("#design-library-name"),list=document.querySelector("#design-library-list");
 document.querySelector("#design-library-open")?.addEventListener("click",showDesignLibraryDialog);
 document.querySelector("#quick-open-design-library")?.addEventListener("click",()=>{if(toolboxDialog?.open)toolboxDialog.close();showDesignLibraryDialog();});
 document.querySelector("#design-library-close")?.addEventListener("click",()=>{if(dialog?.open)dialog.close();else dialog?.removeAttribute("open");});
 document.querySelector("#design-library-refresh")?.addEventListener("click",renderDesignLibrary);
 document.querySelector("#design-library-save-form")?.addEventListener("submit",async event=>{
  event.preventDefault();
  if(state.storageRecoveryPending){setDesignLibraryStatus("El guardado actual está protegido. Recupera o exporta sus datos antes de guardar este estado.","error");return;}
  const button=document.querySelector("#design-library-save-current");button.disabled=true;
  try{const documentCopy=cloneDocument(state.document);const thumbnail=await createDesignThumbnail(documentCopy);const record=await saveDesign({name:input?.value,document:documentCopy,thumbnail});input.value=record.name;setDesignLibraryStatus("Diseño guardado localmente: "+record.name,"success");await renderDesignLibrary();}
  catch(error){setDesignLibraryStatus(error?.message||"No se pudo guardar el diseño.","error");}finally{button.disabled=false;}
 });
 list?.addEventListener("click",async event=>{
  const button=event.target.closest("button[data-design-action]");if(!button)return;const action=button.dataset.designAction,id=button.dataset.designId;button.disabled=true;
  try{
   const records=await listDesigns(),record=records.find(item=>item.id===id);if(!record)throw new Error("Ese diseño ya no está en la biblioteca.");
   if(action==="open"){
    if(state.storageRecoveryPending)throw new Error("El almacenamiento actual está protegido. Recupera o exporta sus datos antes de abrir otro proyecto.");
    if(state.dirty&&!window.confirm("¿Descartar los cambios no guardados y abrir «"+record.name+"»? Guarda primero una copia en Mis diseños si necesitas conservarlos."))return;
    if(activeMultiPageSession){await saveActiveMultiPagePage({withThumbnail:true,announce:false});activeMultiPageSession=null;await multiPagePersistenceQueue.catch(()=>null);}
    const next=await loadDesign(id);if(!next)throw new Error("El diseño no se encontró o no es válido.");
    persistDocumentSnapshot(localStorage,"animeart-web-document",next);
    state.document=next;state.history.reset(next);const last=next.layers.at(-1)?.id||null;setSelection(last?[last]:[],last);
    state.viewport=createViewport();state.transformInteraction=null;state.multiTransformInteraction=null;state.drawing=false;state.strokeBefore=null;state.textPreview=null;state.dirty=false;setStorageRecoveryPending(false);
    refreshDocument("Diseño abierto: "+record.name);state.dirty=false;if(dialog?.open)dialog.close();else dialog?.removeAttribute("open");status.textContent="Diseño abierto: "+record.name;return;
   }
   if(action==="duplicate"){const name=window.prompt("Nombre de la copia:",record.name+" (copia)");if(name===null)return;const copied=await duplicateDesign(id,name);setDesignLibraryStatus("Copia creada: "+copied.name,"success");}
   else if(action==="rename"){const name=window.prompt("Nuevo nombre:",record.name);if(name===null)return;await renameDesign(id,name);setDesignLibraryStatus("Nombre actualizado.","success");}
   else if(action==="delete"){if(!window.confirm("¿Eliminar «"+record.name+"» de Mis diseños? Esta acción no se puede deshacer."))return;await deleteDesign(id);setDesignLibraryStatus("Diseño eliminado de la biblioteca local.","success");}
   await renderDesignLibrary();
  }catch(error){setDesignLibraryStatus(error?.message||"La operación no se pudo completar.","error");}finally{button.disabled=false;}
 });

 const multiDialog=document.querySelector("#multi-page-dialog");
 const projectName=document.querySelector("#multi-page-project-name");
 document.querySelector("#multi-page-open")?.addEventListener("click",showMultiPageDialog);
 document.querySelector("#quick-open-page-manager")?.addEventListener("click",()=>{if(toolboxDialog?.open)toolboxDialog.close();showMultiPageDialog();});
 document.querySelector("#multi-page-close")?.addEventListener("click",()=>{if(multiDialog?.open)multiDialog.close();else multiDialog?.removeAttribute("open");});
 document.querySelector("#multi-page-create-form")?.addEventListener("submit",async event=>{
  event.preventDefault();const button=document.querySelector("#multi-page-create-project");button.disabled=true;
  try{await createMultiPageFromCurrentCanvas(projectName?.value);if(projectName)projectName.value=activeMultiPageSession?.name||projectName.value;}
  catch(error){setMultiPageStatus(error?.message||"No se pudo crear el proyecto multipágina.","error");}
  finally{button.disabled=false;}
 });
 document.querySelector("#multi-page-save-page")?.addEventListener("click",async()=>{
  try{await saveActiveMultiPagePage({withThumbnail:true});await renderMultiPageDialog();}
  catch(error){setMultiPageStatus(error?.message||"No se pudo guardar la página.","error");}
 });
 document.querySelector("#multi-page-add-blank")?.addEventListener("click",async()=>{
  try{await addBlankMultiPagePage();}
  catch(error){setMultiPageStatus(error?.message||"No se pudo crear la página.","error");}
 });
 document.querySelector("#multi-page-duplicate-page")?.addEventListener("click",async()=>{
  try{if(!activeMultiPageSession)throw new Error("Abre primero un proyecto multipágina.");await duplicateMultiPagePageFrom(activeMultiPageSession.activePageId);}
  catch(error){setMultiPageStatus(error?.message||"No se pudo duplicar la página.","error");}
 });
 document.querySelector("#multi-page-export-pdf")?.addEventListener("click",()=>{void exportActiveMultiPagePdf();});
 document.querySelector("#multi-page-copy-layer")?.addEventListener("click",async()=>{
  try{await copySelectedLayerToAnotherPage();}
  catch(error){setMultiPageStatus(error?.message||"No se pudo copiar la capa.","error");}
 });
 document.querySelector("#multi-page-page-list")?.addEventListener("click",async event=>{
  const button=event.target.closest("button[data-multi-page-action]");if(!button)return;button.disabled=true;
  try{await handleMultiPageItemAction(button);}
  catch(error){setMultiPageStatus(error?.message||"No se pudo completar la acción de página.","error");}
  finally{button.disabled=false;}
 });
 document.querySelector("#multi-page-project-list")?.addEventListener("click",async event=>{
  const button=event.target.closest("button[data-multi-project-action]");if(!button)return;button.disabled=true;
  try{await handleMultiProjectAction(button);}
  catch(error){setMultiPageStatus(error?.message||"No se pudo completar la acción de proyecto.","error");}
  finally{button.disabled=false;}
 });
}

function initializeBrandLaunchpad() {
  document.querySelector("#home-create-cover")?.addEventListener("click", () => {
    document.querySelector("#creative-studio-open")?.click();
    document.querySelector('[data-creative-tab="covers"]')?.click();
  });
  document.querySelector("#home-add-title")?.addEventListener("click", () => {
    document.querySelector("#add-text-layer")?.click();
  });
  document.querySelector("#home-open-stickers")?.addEventListener("click", () => {
    document.querySelector("#creative-studio-open")?.click();
    document.querySelector('[data-creative-tab="stickers"]')?.click();
  });
  document.querySelector("#home-import-image")?.addEventListener("click", openImagePicker);
  document.querySelector("#share-current-design")?.addEventListener("click", shareCurrentDesign);
  document.querySelector("#open-apk-installer")?.addEventListener("click", () => {
    const bridge = globalThis.AnimeArtNative;
    if (typeof bridge?.openApkInstaller === "function") {
      bridge.openApkInstaller();
      return;
    }
    showMobileFeedback(
      "Para instalar un APK, abrilo desde la app Archivos de Android y elegí Instalador de paquetes. Esta versión web no instala aplicaciones.",
      "info"
    );
  });
}
initializeBrandLaunchpad(); initializeCanvaWorkflowTools(); initializeAssetLibrary({ onImportImage: importImageIntoEditor, onStatus: message => { status.textContent = message; } });
initializeAppearanceSettings();
setSelection([state.document.layers[0].id], state.document.layers[0].id);
load();
renderLayers();
refreshHistoryControls();
syncBrushControls();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Mobile sheets can resize the editor without causing a window resize event.
// Keep the backing bitmap and selection geometry aligned with the actual canvas box.
if (typeof ResizeObserver === "function") {
  const canvasResizeObserver = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvasRenderDpr(rect);
    const expectedWidth = Math.round(rect.width * dpr);
    const expectedHeight = Math.round(rect.height * dpr);
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) resizeCanvas();
  });
  canvasResizeObserver.observe(canvas.parentElement || canvas);
}


// Multipage PDF export stays local and caps raster work to protect mobile memory.
const OFFLINE_CACHE_NAME = "animeart-web-shell-v78";
const OFFLINE_REQUIRED_RESOURCES = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./asset-library.js",
  "./appearance-settings.js",
  "./domain/asset-library.mjs",
  "./domain/asset-deduplication.mjs",
  "./domain/asset-library-pagination.mjs",
  "./domain/creative-catalog.mjs", "./domain/design-alignment.mjs", "./domain/design-snapping.mjs", "./domain/design-resize.mjs", "./domain/design-library.mjs", "./domain/multi-page-project.mjs", "./domain/element-library.mjs",
  "./domain/anime-style-library.mjs",
  "./domain/anime-character-presets.mjs",
  "./manifest.webmanifest",
  "./icons/animeart-mark.svg",
  "./service-worker.js",
  "./assets/cc0-detailed-anime-character.png.base64",
  "./assets/ASSET_SOURCES.md",
  "./domain/document-operations.mjs",
  "./domain/history.mjs",
  "./domain/image-import.mjs",
  "./domain/image-input.mjs",
  "./domain/image-processing.mjs",
  "./domain/crop-shape.mjs",
  "./domain/color-replacement.mjs",
  "./domain/anime-region-selection.mjs",
  "./domain/anime-color-studio.mjs",
  "./domain/image-processing-client.mjs",
  "./workers/image-processing-worker.mjs",
  "./domain/canvas-space.mjs",
  "./domain/layer-adjustments.mjs",
  "./domain/quick-edit-recipes.mjs",
  "./domain/background-removal.mjs",
  "./domain/background-removal-profiles.mjs",
  "./domain/model.mjs",
  "./domain/text-layer.mjs",
  "./domain/png-export.mjs",
  "./domain/selection.mjs",
  "./domain/viewport.mjs",
  "./domain/touch-gestures.mjs",
  "./domain/frame-scheduler.mjs",
  "./domain/stroke-smoothing.mjs",
  "./domain/freehand-rendering.mjs"
];

async function reportServiceWorkerReadiness() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    document.documentElement.dataset.serviceWorkerActive = "false";
    document.documentElement.dataset.cacheReady = "false";
    document.documentElement.dataset.cacheMissing = "service-worker-unavailable";
    document.documentElement.dataset.serviceWorkerDiagnostic = "unavailable";
    console.warn("ANIMEART_OFFLINE_DIAGNOSTIC", "Service worker or Cache API is unavailable");
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
    document.documentElement.dataset.serviceWorkerActive = String(active);
    document.documentElement.dataset.cacheReady = String(missing.length === 0);
    document.documentElement.dataset.cacheMissing = missing.join("|");
    document.documentElement.dataset.serviceWorkerDiagnostic = ready ? "ready" : "missing-resources";
    console.log("ANIMEART_OFFLINE_DIAGNOSTIC", JSON.stringify({registered:true,active,cache:OFFLINE_CACHE_NAME,cachedCount:requests.length,requiredCount:OFFLINE_REQUIRED_RESOURCES.length,missing,canvas:Boolean(canvas)}));
  } catch (error) {
    document.documentElement.dataset.serviceWorkerDiagnostic = "failed";
    console.error("ANIMEART_OFFLINE_DIAGNOSTIC", error);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => reportServiceWorkerReadiness())
      .catch(error => {
        document.documentElement.dataset.serviceWorkerDiagnostic = "registration-failed";
        console.error("ANIMEART_OFFLINE_DIAGNOSTIC", error);
      });
  });
}