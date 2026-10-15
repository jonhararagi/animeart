import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("T043 document mutations use existing domain operations for completed layer lifecycle changes", async () => {
  const js = await readFile("app.js", "utf8");
  const operations = await readFile("domain/document-operations.mjs", "utf8");
  assert.match(js, /import \{[^}]*addLayer[^}]*clearLayer[^}]*\} from "\.\/domain\/document-operations.mjs"/);
  assert.match(js, /const next = addLayer\(state\.document, layer\)/);
  assert.match(js, /const next = clearLayer\(state\.document, layer\.id\)/);
  assert.match(operations, /export function addLayer\(/);
  assert.match(operations, /export function clearLayer\(/);
  assert.doesNotMatch(js, /state\.document\.layers\.push\(layer\)/);
  assert.doesNotMatch(js, /layer\.strokes = \[\]/);
  assert.doesNotMatch(js, /AddLayerManager|LayerMutationManager|DocumentMutationManager/);
});

test("T042 architecture uses existing Image Layer and forbids parallel reference systems", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(import.meta.dirname, "..");
  const app = await readFile(join(root, "app.js"), "utf8");
  const model = await readFile(join(root, "domain/model.mjs"), "utf8");
  const operations = await readFile(join(root, "domain/document-operations.mjs"), "utf8");
  assert.match(app, /setLayerReference/);
  assert.match(app, /isReference/);
  assert.match(model, /isReference/);
  assert.match(operations, /export function setLayerReference/);
  assert.doesNotMatch(app + model + operations, /ReferenceImageStore|ReferenceRenderer|ReferenceHistory|ReferencePersistence|ReferenceDocument|ReferenceLayerManager/);
});

test("web entrypoint exists and references the editor", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /AnimeArt Studio \\| Image Editor/);
  assert.match(html, /app\.js/);
});

test("web editor has canvas, local persistence, and history controls", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(js, /getContext/);
  assert.match(html, /id="add-text-layer"/);
  assert.match(html, /id="add-sample-character"/);
  assert.match(js, /CC0 character sample added/);
  assert.match(js, /createTextLayer/);
  assert.match(js, /setLayerText/);
  assert.match(js, /localStorage/);
  assert.match(js, /layers/);
  assert.match(html, /id="undo"/);
  assert.match(html, /id="redo"/);
  assert.match(js, /DocumentHistory/);
  assert.match(js, /history\.record/);
  assert.match(js, /history\.undo/);
  assert.match(js, /history\.redo/);
});

test("web editor restores legacy projects through the domain boundary", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /restoreDocument/);
});

test("web interaction maps document pixels to screen coordinates and keeps persistence explicit", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /screenToDocumentPoint/);
  assert.match(js, /documentFitScale/);
  assert.match(js, /documentCenter\(state\.document\)/);
  assert.match(js, /persistDocumentSnapshot\(localStorage, "animeart-web-document", state\.document\)/);
  assert.doesNotMatch(js, /canvas\.style\.transform/);
  assert.match(js, /event\.pointerId !== state\.drawingPointerId/);
  assert.match(js, /state\.strokeBefore/);
});

test("history integration is document-only and viewport navigation never records history", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /state\.history\.record\(before, state\.document\)/);
  assert.match(js, /state\.viewport = panBy/);
  assert.match(js, /setViewport\(zoomViewportAt/);
  assert.doesNotMatch(js, /history\.record\([^\n]*viewport/);
});


test("layer transform integration uses the existing History boundary", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /applyLayerOperation/);
  assert.match(js, /state\.history\.record\(before, next\)/);
  assert.match(js, /translateLayer/);
  assert.match(js, /scaleLayer/);
  assert.match(js, /rotateLayer/);
});

test("layer transform stays separate from Viewport", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /state\.viewport = panBy/);
  assert.match(js, /setViewport\(zoomViewportAt/);
  assert.match(js, /translateLayer/);
  assert.doesNotMatch(js, /translateLayer\([^\n]*state\.viewport/);
});

test("visual layer selection reuses selectedLayerId and existing transform/history boundaries", async () => {
  const js = await readFile("app.js", "utf8");
  const html = await readFile("index.html", "utf8");
  assert.match(html, /data-tool="select"/);
  assert.match(js, /selectedLayerId/);
  assert.match(js, /selectionGeometry/);
  assert.match(js, /hitTestHandle/);
  assert.match(js, /hitTestLayer/);
  assert.match(js, /document-operations/);
  assert.match(js, /state\.history\.record\(before, next\)/);
});

test("visual transform drag previews until pointerup and pointercancel clears it", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /transformInteraction/);
  assert.match(js, /finishTransformInteraction/);
  assert.match(js, /pointercancel/);
  assert.match(js, /finishTransformInteraction\(true\)/);
  assert.match(js, /finishTransformInteraction\(false\)/);
  assert.match(js, /event\.pointerId !== interaction\.pointerId/);
});

test("selection remains on existing Screen/Document/Viewport boundaries", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /screenToDocumentPoint\(screenPoint, state\.document, state\.viewport/);
  assert.match(js, /selectionGeometry\(layer, screenViewportForDocument\(state\.document/);
  assert.doesNotMatch(js, /canvas\.style\.transform/);
});


test("layer panel exposes visibility, lock and opacity through existing operation/history boundaries", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /setLayerVisibility/);
  assert.match(js, /setLayerLocked/);
  assert.match(js, /setLayerOpacity/);
  assert.match(js, /className = "layer-controls"/);
  assert.match(js, /type = "range"/);
  assert.match(js, /applyLayerOperation\(\(doc, id\) => setLayerOpacity/);
  assert.doesNotMatch(js, /setLayerVisibility\(doc, id, !layer\.visible\)[\\s\\S]{0,180}allowLocked/);
  assert.doesNotMatch(js, /setLayerOpacity\(doc, id, nextOpacity\)[\\s\\S]{0,180}allowLocked/);
  assert.match(js, /setLayerLocked\(doc, id, !layer\.locked\), layer\.locked \? "Layer unlocked" : "Layer locked", \{ allowLocked: true \}\)/);
  assert.match(js, /state\.history\.record\(before, next\)/);
  assert.match(js, /persistDocument\(\)/);
});

test("layer lifecycle UI reuses the existing selection, operation and history boundaries", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /renameLayer/); assert.match(js, /duplicateLayer/); assert.match(js, /deleteLayer/); assert.match(js, /reorderLayer/);
  assert.match(js, /applyLayerOperation/); assert.match(js, /state\.history\.record/); assert.match(js, /persistDocument\(\)/);
  assert.match(js, /window\.prompt\("Layer name"/);
  assert.doesNotMatch(js, /LayerManager|LayerStore|LayerHistory|LayerRenderer|SelectionManager|PersistenceManager/);
});

test("layer lifecycle UI guards locked layers and preserves the selection anchor", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /if \(layer\.locked\) return;/);
  assert.match(js, /if \(layer\.locked \|\| state\.document\.layers\.length <= 1\) return;/);
  assert.match(js, /setSelection\(\[duplicate\.id\], duplicate\.id\)/);
});


test("document lifecycle exposes new, recover, save and configured dimensions without parallel managers", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(html, /id="new-document"/);
  assert.match(html, /id="recover-project"/);
  assert.match(html, /id="save"/);
  assert.match(html, /id="project-dialog"/);
  assert.match(html, /id="document-width"/);
  assert.match(html, /id="document-height"/);
  assert.match(js, /createDocument\(width, height\)/);
  assert.match(js, /localStorage\.getItem\("animeart-web-document"\)/);
  assert.match(js, /persistDocument\(\{ markSaved: true \}\)/);
  assert.match(js, /persistDocumentSnapshot\(localStorage, "animeart-web-document", state\.document\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\("animeart-web-document", JSON\.stringify\(state\.document\)\)/);
  assert.match(js, /state\.history\.reset\(next\)/);
  assert.match(js, /state\.history\.reset\(restored\)/);
  assert.match(js, /state\.dirty/);
  assert.doesNotMatch(js, /ProjectManager|DocumentManager|PersistenceManager/);
});

test("new document validates positive integer dimensions before replacing the current document", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(html, /min="1" step="1"/);
  assert.match(js, /!Number\.isInteger\(width\) \|\| width < 1/);
  assert.match(js, /!Number\.isInteger\(height\) \|\| height < 1/);
  assert.match(js, /Discard changes since the last explicit save/);
});

test("document lifecycle keeps image compatibility and existing persistence key", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /applyImageFileImport/);
  assert.match(js, /persistDocumentSnapshot\(localStorage, "animeart-web-document"/);
  assert.match(js, /restoreDocument/);
});


test("brush controls are wired to current stroke creation without a parallel manager", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(html, /id="brush-color"/);
  assert.match(html, /id="brush-size"/);
  assert.match(html, /id="brush-opacity"/);
  assert.match(js, /state\.brush/);
  assert.match(js, /setBrushColor/);
  assert.match(js, /setBrushSize/);
  assert.match(js, /setBrushOpacity/);
  assert.match(js, /createStroke\(state\.tool, censor \? Number\(censorInputs\.size\.value\) : state\.brush\.size/);
  assert.match(js, /censor \? censorInputs\.color\.value : state\.brush\.color/);
  assert.match(js, /censor \? Number\(censorInputs\.opacity\.value\) \/ 100 : state\.brush\.opacity/);
  assert.match(js, /stroke\.color/);
  assert.match(js, /stroke\.opacity/);
  assert.doesNotMatch(js, /BrushManager|BrushController|ColorManager|OpacityManager|ToolManager|DrawingManager|StrokeManager|CanvasManager|HistoryManager/);
});

test("brush control ranges are bounded and eraser remains a distinct existing tool", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(html, /id="brush-size" type="range" min="1" max="100"/);
  assert.match(html, /id="brush-opacity" type="range" min="0" max="100"/);
  assert.match(html, /data-tool="eraser"/);
  assert.match(js, /stroke\.tool === "eraser"/);
  assert.match(js, /MAX_BRUSH_SIZE = 100/);
  assert.match(js, /Math\.min\(1, Math\.max\(0, opacity\)/);
});



test("multi-format export UI uses the existing document renderer and local download pipeline", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(html, /id="export-png"/);
  assert.match(html, /Export image/);
  assert.match(html, /id="export-format"/);
  assert.match(js, /createPngExportCanvas/);
  assert.match(js, /renderDocumentToCanvas/);
  assert.match(js, /drawDocument\(\{ context = ctx, document = state\.document, center = documentCenter\(document\)/);
  assert.match(js, /canvasToImageBlob\(exportCanvas, format, quality\)/);
  assert.match(js, /await saveBlobToDevice\(blob, "animeart\." \+ format, format\)/);
  assert.match(js, /await ensureExportImages\(state\.document\)/);
  assert.match(exporter, /getContext\("2d", \{ alpha: true \}\)/);
  assert.match(exporter, /png: "image\/png"/);
  assert.match(exporter, /jpeg: "image\/jpeg"/);
  assert.match(exporter, /webp: "image\/webp"/);
  assert.match(exporter, /anchor\.download/);
  assert.doesNotMatch(js, /ExportManager|PNGManager|ImageExportManager|RenderManager|CanvasManager|DocumentManager|ProjectManager|LayerManager/);
});

test("PNG export composes visible layers with opacity and transforms while ignoring lock state", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /for \(const layer of document\.layers\)/);
  assert.match(js, /if \(!layer\.visible\) continue/);
  assert.match(js, /context\.globalAlpha = layer\.opacity/);
  assert.match(js, /transformForLayer: layer => layer\.transform/);
  assert.doesNotMatch(js, /layer\.locked.*continue/);
});

test("PNG export uses Document dimensions, not viewport or UI capture", async () => {
  const js = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(js, /createPngExportCanvas\(state\.document\)/);
  assert.match(exporter, /canvas\.width = width/);
  assert.match(exporter, /canvas\.height = height/);
  assert.doesNotMatch(js, /html2canvas|toDataURL\(\)/);
  assert.doesNotMatch(js, /window\.devicePixelRatio[^\n]*export/);
  assert.doesNotMatch(js, /drawSelectionOverlay\([^)]*export/);
});

test("PNG export is non-destructive and existing undo/redo remain intact", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /async function exportPng/);
  assert.doesNotMatch(js, /async function exportPng[\s\S]{0,2200}history\.record/);
  assert.match(js, /undoButton\.addEventListener\("click", undo\)/);
  assert.match(js, /redoButton\.addEventListener\("click", redo\)/);
  assert.match(js, /state\.history\.undo/);
  assert.match(js, /state\.history\.redo/);
});


test("T040 drawing commits one history operation and preserves persistence failure feedback", async () => {
  const js = await readFile("app.js", "utf8");
  const pointerUp = js.match(/canvas\.addEventListener\("pointerup",[\s\S]*?canvas\.addEventListener\("pointercancel"/)?.[0] || "";
  assert.match(pointerUp, /state\.history\.record\(before, state\.document\)/);
  assert.match(pointerUp, /persistDocument\(\)/);
  assert.doesNotMatch(pointerUp, /status\.textContent = "Unsaved local changes"/);
  assert.doesNotMatch(pointerUp, /history\.record\([^\n]*state\.viewport/);
});

test("T040 transforms commit before refresh and keep storage failure visible", async () => {
  const js = await readFile("app.js", "utf8");
  const transform = js.match(/function finishTransformInteraction[\s\S]*?\n}\n\nfunction updateTransformPreview/)?.[0] || "";
  assert.match(transform, /state\.history\.record\(before, next\)/);
  assert.match(transform, /refreshDocument\("Layer transformed"\);\n  if \(next\) persistDocument\(\)/);
  assert.doesNotMatch(transform, /persistDocument\(\);\n  refreshDocument\("Layer transformed"/);
});

test("T040 dirty state means changes since the last explicit save", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /state\.dirty = !markSaved/);
  assert.match(js, /state\.dirty = true/);
  assert.match(js, /state\.dirty = false/);
  assert.match(js, /persistDocument\(\{ markSaved: true \}\)/);
  assert.match(js, /state\.history\.reset\(restored\)/);
  assert.match(js, /state\.history\.reset\(next\)/);
  assert.match(js, /Discard changes since the last explicit save/);
});

test("T040 persistence failure keeps the current Document and History intact", async () => {
  const js = await readFile("app.js", "utf8");
  const persist = js.match(/function persistDocument[\s\S]*?\n}\n\nfunction refreshHistoryControls/)?.[0] || "";
  assert.match(persist, /persistDocumentSnapshot\(localStorage, "animeart-web-document", state\.document\)/);
  assert.match(persist, /catch \(error\)/);
  assert.match(persist, /state\.dirty = true/);
  assert.match(persist, /return false/);
  assert.doesNotMatch(persist, /state\.document\s*=/);
  assert.doesNotMatch(persist, /state\.history\./);
  const failureBranch = persist.match(/catch \(error\) \{[\s\S]*?return false;/)?.[0] || "";
  assert.doesNotMatch(failureBranch, /Saved locally/);
});

test("T040 all persistible lifecycle mutations use the existing History then persistence boundary", async () => {
  const js = await readFile("app.js", "utf8");
  const requiredSequences = [
    /state\.history\.record\(before, state\.document\)[\s\S]{0,180}persistDocument\(\)/,
    /state\.history\.record\(before, next\)[\s\S]{0,180}refreshDocument\([^)]+\)[\s\S]{0,80}persistDocument\(\)/,
    /state\.history\.record\(before, state\.document\)[\s\S]{0,220}persistDocument\(\)/
  ];
  for (const pattern of requiredSequences) assert.match(js, pattern);
  assert.doesNotMatch(js, /MutationManager|DocumentTransactionManager|DocumentStore|EditorStateManager|PersistenceManager|HistoryManager/);
});


test("T041 multi-layer transform reuses selection, document operations and existing history/persistence", async () => {
  const js = await readFile("app.js", "utf8");
  const selection = await readFile("domain/selection.mjs", "utf8");
  const operations = await readFile("domain/document-operations.mjs", "utf8");
  assert.match(js, /multiSelectionGeometry/);
  assert.match(js, /groupScaleTransforms/);
  assert.match(js, /groupRotationTransforms/);
  assert.match(js, /transformLayers/);
  assert.match(js, /state\.history\.record\(before, next\)/);
  assert.match(js, /persistDocument\(\)/);
  assert.match(selection, /groupScaleTransforms/);
  assert.match(selection, /groupRotationTransforms/);
  assert.match(selection, /multiSelectionGeometry/);
  assert.match(operations, /export function transformLayers/);
  assert.doesNotMatch(js, /MultiLayerTransformManager|GroupTransformManager|TransformManager|SelectionManager|PersistenceManager|HistoryManager|RenderManager/);
});

test("T041 group transform supports scale and rotation while preserving locked-layer atomicity", async () => {
  const operations = await readFile("domain/document-operations.mjs", "utf8");
  const selection = await readFile("domain/selection.mjs", "utf8");
  assert.match(operations, /if \(layer\.locked\) return null;/);
  assert.match(operations, /layer\.transform = normalized/);
  assert.match(selection, /minimumScale = 0\.05/);
  assert.match(selection, /layer\.transform\.scale \* factor/);
  assert.match(selection, /layer\.transform\.rotation \+ delta/);
});

test("T041 group move, pointercancel and single-layer transform boundaries remain intact", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /applyMultiLayerMove/);
  assert.match(js, /state\.multiTransformInteraction/);
  assert.match(js, /finishTransformInteraction\(true\)/);
  assert.match(js, /resizeTransformFromCorner/);
  assert.match(js, /beginTransformInteraction\("scale"/);
  assert.match(js, /beginTransformInteraction\("rotate"/);
});


test("T062 invalid local projects pause automatic writes and require explicit replacement", async () => {
  const js = await readFile("app.js", "utf8");
  const html = await readFile("index.html", "utf8");
  assert.match(html, /id="storage-recovery-notice"[^>]*role="alert"[^>]*hidden/);
  assert.match(js, /storageRecoveryPending: false/);
  assert.match(js, /if \(state\.storageRecoveryPending && !markSaved\)/);
  assert.match(js, /setStorageRecoveryPending\(true, "The saved project could not be opened/);
  assert.match(js, /setStorageRecoveryPending\(true, "Local project storage could not be read/);
  assert.match(js, /persistDocument\(\{ markSaved: true \}\)/);
  assert.match(js, /if \(markSaved\) setStorageRecoveryPending\(false\)/);
  assert.doesNotMatch(js, /state\.document = restoreDocument\(saved\) \|\| createDocument\(\)/);
});


test("T062 image import cannot bypass the pending-recovery persistence guard", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /persist: next => \{[\s\S]{0,180}state\.storageRecoveryPending[\s\S]{0,180}persistDocumentSnapshot/);
});


test("T062 rejects unsupported document versions while retaining the supported legacy migration path", async () => {
  const js = await readFile("app.js", "utf8");
  assert.ok(js.includes("saved?.version !== undefined"));
  assert.ok(js.includes("saved.version !== DOCUMENT_VERSION"));
  assert.match(js, /saved\?\.version === 1[\s\S]{0,100}Array\.isArray\(saved\.strokes\)/);
  assert.match(js, /return restoreDocument\(saved\)/);
  assert.match(js, /const restored = restoreStoredDocument\(saved\)/);
});


test("T064 persistence writer inventory keeps the project key behind the existing snapshot boundary", async () => {
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(import.meta.dirname, "..");
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (["test", "tests"].includes(entry.name)) continue;
        await visit(path);
      } else if (/\.(?:m?js)$/.test(entry.name) && !/(?:^|[.])test[.]m?js$/.test(entry.name) && !path.endsWith("browser-e2e.mjs")) files.push(path);
    }
  }
  await visit(root);
  const sources = await Promise.all(files.map(async path => [path, await readFile(path, "utf8")]));
  const directWriters = sources.flatMap(([path, source]) =>
    [...source.matchAll(/localStorage\s*\.\s*setItem\s*\(/g)].map(() => path)
  );
  assert.deepEqual(
    directWriters.filter(path => !path.endsWith(join("web", "appearance-settings.js"))),
    [],
    "the project key remains behind the shared snapshot boundary; appearance settings may use their own isolated key"
  );
  const appearanceModule = sources.find(([path]) => path.endsWith(join("web", "appearance-settings.js")));
  assert.ok(appearanceModule, "editor appearance settings are isolated from project document persistence");
  assert.match(appearanceModule[1], /const STORAGE_KEY = "animeart-editor-appearance-v1"/);
  const snapshotModule = sources.find(([path]) => path.endsWith(join("domain", "image-import.mjs")));
  assert.ok(snapshotModule, "existing image-import domain module is included in the writer inventory");
  assert.match(snapshotModule[1], /storage\.setItem\(key, serialized\)/, "the shared snapshot boundary owns the delegated storage write");
  const editor = sources.find(([path]) => path.endsWith("app.js"));
  assert.ok(editor && editor[1].includes('persistDocumentSnapshot(localStorage, "animeart-web-document", state.document)'), "ordinary document persistence delegates through the existing snapshot boundary");
});



test("image crop and resize stay on the existing image-layer, history and persistence boundary", async () => {
  const [html, app, operations, processing, worker] = await Promise.all([
    readFile("index.html", "utf8"), readFile("app.js", "utf8"),
    readFile("domain/document-operations.mjs", "utf8"),
    readFile("domain/image-processing.mjs", "utf8"), readFile("service-worker.js", "utf8")
  ]);
  assert.match(html, /id="crop-resize-image"/);
  assert.match(html, /id="image-crop-fields"/);
  assert.match(html, /id="image-resize-fields"/);
  assert.match(app, /state\.history\.record\(before, next\)/);
  assert.match(app, /refreshDocument\(mode === "crop" \? "Image cropped" : "Image resized"\)/);
  assert.ok(app.includes('if (event.type === "pointerup")'), "crop drag consumes the final pointerup coordinate");
  assert.ok(app.includes("updateCropInputs(drag.before)"), "cancelled crop drag restores the prior crop rectangle");
  assert.match(operations, /export function replaceImageLayer/);
  assert.match(processing, /export async function cropImageSource/);
  assert.match(processing, /export async function resizeImageSource/);
  const workerCache = worker.match(/const CACHE_NAME = "([^"]+)"/)?.[1];
  const appCache = app.match(/const OFFLINE_CACHE_NAME = "([^"]+)"/)?.[1];
  assert.ok(workerCache, "service worker declares a versioned cache");
  assert.equal(appCache, workerCache, "readiness diagnostics and service worker use the same cache version");
});

test("Android WebView fallback clears adjustment controls without requiring replaceChildren", async () => {
  const app = await readFile("app.js", "utf8");
  assert.ok(app.includes("function clearElementChildren(element)"));
  assert.ok(app.includes('typeof element.replaceChildren === "function"'));
  assert.ok(app.includes("while (element.firstChild) element.removeChild(element.firstChild)"));
  assert.ok(app.includes("clearElementChildren(layerAdjustmentControls)"));
  assert.ok(!app.includes("layerAdjustmentControls.replaceChildren()"));
});


test("image eraser edits selected image pixels and records the edit for undo", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /async function finishImageErase\(interaction\)/);
  assert.match(js, /applyEraseStrokes\(pixels/);
  assert.match(js, /state\.history\.record\(before, next\)/);
  assert.match(js, /Image pixels erased/);
  assert.match(js, /inverseTransformPoint/);
});

test("mobile dock actions call history directly and keep the active drawing tool in sync", async () => {
  const [html, js, css] = await Promise.all([
    readFile("index.html", "utf8"), readFile("app.js", "utf8"), readFile("styles.css", "utf8")
  ]);
  assert.match(html, /data-touch-action="tool" data-tool="brush" aria-pressed="false"><span aria-hidden="true">🖌️<\/span><span>Dibujar<\/span>/);
  assert.match(html, /data-touch-action="more" aria-expanded="false"><span aria-hidden="true">☰<\/span><span>Más<\/span>/);
  assert.match(html, /data-edit-goal="crop"/);\n  assert.match(html, /id="crop-resize-image"/);
  assert.match(js, /Primero seleccioná una imagen en el lienzo o en Capas; después tocá Recortar/);
  assert.match(js, /La imagen está bloqueada\. Desbloqueala desde Capas para poder recortarla/);
  assert.doesNotMatch(html, /data-touch-action="more" aria-expanded="false">More/);
  assert.match(js, /if \(action === "undo"\) \{ undo\(\); return; \}/);
  assert.match(js, /if \(action === "redo"\) \{ redo\(\); return; \}/);
  assert.match(css, /Mobile editor controls: fixed canvas/);
});


test("editor appearance supports custom accent, workspace color and local wallpaper without changing artwork export", async () => {
  const [html, app, styles, worker, appearance] = await Promise.all([
    readFile("index.html", "utf8"), readFile("app.js", "utf8"),
    readFile("styles.css", "utf8"), readFile("service-worker.js", "utf8"),
    readFile("appearance-settings.js", "utf8")
  ]);
  assert.match(html, /id="appearance-open"/);
  assert.match(html, /id="appearance-dialog"/);
  assert.match(html, /id="appearance-wallpaper-file"/);
  assert.match(html, /id="appearance-open"/);
  assert.match(app, /initializeAppearanceSettings\(\)/);
  assert.match(app, /animeart-web-shell-v21/);
  assert.match(worker, /animeart-web-shell-v21/);
  assert.match(worker, /\.\/appearance-settings\.js/);
  assert.match(appearance, /animeart-editor-appearance-v1/);
  assert.match(appearance, /MAX_WALLPAPER_BYTES = 2 \* 1024 \* 1024/);
  assert.match(appearance, /--editor-workspace/);
  assert.match(styles, /Picsart-inspired mobile-first editor polish/);
});

test("background-removal profiles are local, reusable and wired to the existing apply pipeline", async () => {
  const [html, app, profiles, tests] = await Promise.all([
    readFile("index.html", "utf8"), readFile("app.js", "utf8"),
    readFile("domain/background-removal-profiles.mjs", "utf8"),
    readFile("test/background-removal-profiles.test.mjs", "utf8")
  ]);
  assert.match(html, /id="background-removal-profile"/);
  assert.match(html, /id="save-background-profile"/);
  assert.match(html, /id="delete-background-profile"/);
  assert.match(app, /applyBackgroundRemovalProfile/);
  assert.match(app, /const automatic = removeConnectedBackground\(session\.original, currentBackgroundRemovalSettings\(\)\)/);
  assert.match(app, /applyEraseStrokes\(automatic, session\.strokes\)/);
  assert.match(profiles, /BACKGROUND_PROFILE_STORAGE_KEY/);
  assert.match(profiles, /anime-ink/);
  assert.match(profiles, /flat-color/);
  assert.match(profiles, /transparent-png/);
  assert.match(profiles, /id: "photo"/);
  assert.match(tests, /saves, restores, updates and deletes a custom local profile/);
});

test("Android native export bridge and browser fallback are wired to the canonical editor", async () => {
  const [app, activity, worker] = await Promise.all([
    readFile("app.js", "utf8"),
    readFile("../app/src/main/java/com/jonhararagi/animeart/MainActivity.kt", "utf8"),
    readFile("service-worker.js", "utf8")
  ]);
  assert.match(app, /async function saveBlobToDevice\(blob, filename, imageFormat = null\)/);
  assert.match(app, /nativeBridge\.saveFile\(btoa\(binary\)/);
  assert.match(app, /downloadImageBlob\(blob, filename, imageFormat\)/);
  assert.ok(activity.includes("NativeExportBridge"));
  assert.ok(activity.includes("Intent.ACTION_CREATE_DOCUMENT"));
  assert.match(worker, /\.\/domain\/background-removal-profiles\.mjs/);
  assert.match(worker, /animeart-web-shell-v21/);
});

test("mobile image editing exposes Magic Eraser, fit-to-canvas and fixed-size layer thumbnails", async () => {
  const [html, app, css, worker, removal] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("domain/background-removal.mjs", "utf8")
  ]);
  assert.match(html, /data-tool="magic-eraser"/);
  assert.match(html, /data-tool="magic-eraser"/);
  assert.match(html, /id="fit-image-to-canvas"/);
  assert.match(app, /function finishMagicErase\(interaction\)/);
  assert.match(app, /seedPoints: \[\{ x, y \}\]/);
  assert.match(app, /state\.magicEraseInteraction/);
  assert.match(css, /\.layer-thumbnail \{ flex: 0 0 56px; width: 56px; height: 56px/);
  assert.match(css, /\.layers #layers \.layer-select \{ min-height: 60px/);
  assert.match(removal, /seedPoints=\[\]/);
  assert.match(worker, /animeart-web-shell-v21/);
});


test("Android export enforces the native size limit and reports native versus browser save routing", async () => {
  const app = await readFile("app.js", "utf8");
  assert.match(app, /const nativeBridge = globalThis\.AnimeArtNative/);
  assert.match(app, /blob\.size > 50 \* 1024 \* 1024/);
  assert.match(app, /return "native"/);
  assert.match(app, /return "browser"/);
  assert.match(app, /destination === "native" \? "Choose where to save/);
});


test("AA-PICSART-UX-001 defaults to direct layer selection and exposes simple and interactive modes", async () => {
  const [html, app, css, worker] = await Promise.all([readFile("index.html", "utf8"), readFile("app.js", "utf8"), readFile("styles.css", "utf8"), readFile("service-worker.js", "utf8")]);
  assert.match(app, /tool: "select"/);
  assert.match(app, /const HANDLE_RADIUS = 22/);
  assert.match(app, /function setInteractionMode\(mode\)/);
  assert.match(app, /animeart-editor-mode-v1/);
  assert.match(app, /state\.interactionMode === "interactive"/);
  assert.match(html, /data-editor-mode="simple"/);
  assert.match(html, /data-editor-mode="interactive"/);
  assert.match(html, /data-tool="select" aria-pressed="true">🖐️ Seleccionar \/ mover/);
  assert.match(css, /\.editor-mode-switch button\.active/);
  assert.match(worker, /animeart-web-shell-v21/);
  assert.match(app, /animeart-web-shell-v21/);
});

test("Magic Eraser tolerance is user-adjustable instead of hardcoded", async () => {
  const [html, app] = await Promise.all([readFile("index.html", "utf8"), readFile("app.js", "utf8")]);
  assert.match(html, /id="magic-eraser-tolerance" type="range"/);
  assert.match(app, /tolerance: Number\(document\.querySelector\("#magic-eraser-tolerance"\)\?\.value \|\| 28\)/);
  assert.match(app, /magicTolerance\?\.addEventListener\("input"/);
});


test("interaction mode remains reachable from the mobile header when the tool panel is hidden", async () => {
  const [html, app, css] = await Promise.all([readFile("index.html", "utf8"), readFile("app.js", "utf8"), readFile("styles.css", "utf8")]);
  assert.match(html, /id="editor-mode-toggle"/);
  assert.match(app, /editor-mode-toggle.*addEventListener\("click"/);
  assert.match(app, /modeToggle\.textContent = state\.interactionMode === "interactive" \? "Modo simple" : "Modo interactivo"/);
  assert.match(css, /#editor-mode-toggle/);
});


test("beginner quick actions expose direct move and fit-to-canvas", async () => {
  const [html, app] = await Promise.all([readFile("index.html", "utf8"), readFile("app.js", "utf8")]);
  assert.match(html, /data-edit-goal="move"/);
  assert.match(html, /data-edit-goal="fit"/);
  assert.match(app, /move: \(\) => \{/);
  assert.match(app, /fit: \(\) => document\.querySelector\("#fit-image-to-canvas"\)\?\.click\(\)/);
  assert.match(app, /Toca la imagen y arrástrala/);
});


test("AA-PICSART-UX-001 magic erase is preview-first and supports pixel restoration", async () => {
  const js = await readFile("app.js", "utf8");
  const html = await readFile("index.html", "utf8");
  const model = await readFile("domain/model.mjs", "utf8");
  const operations = await readFile("domain/document-operations.mjs", "utf8");
  assert.match(js, /openMagicErasePreview\(/);
  assert.match(js, /applyMagicErasePreview\(/);
  assert.match(js, /cancelMagicErasePreview\(/);
  assert.match(js, /async function finishImageRestore\(/);
  assert.match(js, /state\.tool === "restore-brush"/);
  assert.match(html, /id="magic-eraser-preview-dialog"/);
  assert.match(html, /id="magic-eraser-before-preview"/);
  assert.match(html, /id="magic-eraser-after-preview"/);
  assert.match(html, /data-tool="restore-brush"/);
  assert.match(html, /data-tool="restore-brush"/);
  assert.match(model, /image\.restoreSource/);
  assert.match(operations, /replacement\.restoreSource/);
});


test("magic erase confirmation keeps the source intact on failure and preserves the layer's logical dimensions", async () => {
  const app = await readFile("app.js", "utf8");
  const html = await readFile("index.html", "utf8");
  const css = await readFile("styles.css", "utf8");
  assert.match(app, /async function applyMagicErasePreview\(\)/);
  assert.match(app, /width: Math\.round\(layer\.image\.width\)/);
  assert.match(app, /height: Math\.round\(layer\.image\.height\)/);
  assert.match(app, /No se pudo aplicar el borrado\. La imagen original sigue intacta/);
  assert.match(app, /applyButton\.disabled = true/);
  assert.match(html, /id="magic-eraser-apply"/);
  assert.match(css, /AA-EDITOR-WORKSPACE-002/);
  assert.match(css, /body\.mobile-tools-open \.toolbar/);
  assert.match(css, /\.mobile-touch-dock\s*\{\s*position: static/);
});


test("touch tools toggle collapses without activating the canvas tool and remains reachable", async () => {
  const [html, app, css] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("styles.css", "utf8")
  ]);
  assert.match(html, /id="mobile-tools-toggle"/);
  assert.match(html, /aria-expanded="true" aria-label="Ocultar herramientas"/);
  assert.match(app, /mobileToolsToggle\?\.addEventListener\("click", event => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?classList\.toggle\("mobile-tools-collapsed"\)/);
  assert.match(css, /\.mobile-tools-toggle\s*\{[\s\S]*?touch-action:\s*manipulation/);
  assert.match(css, /body\.mobile-tools-collapsed \.toolbar\s*\{[\s\S]*?display:\s*none !important/);
});


test("multi-layer drag snapshots selected layer IDs until the pointer interaction commits", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /function interactionLayers\(interaction\)/);
  assert.match(js, /layerIds: layers\.map\(layer => layer\.id\)/);
  assert.match(js, /applyMultiLayerMove\(delta\.x, delta\.y, "Layers moved", interaction\.layerIds\)/);
  assert.match(js, /ids\.length < 2 \|\| layers\.length !== ids\.length \|\| layers\.some\(layer => layer\.locked\)/);
});


test("multi-selection group bounds initiate a move without requiring a per-layer hit", async () => {
  const js = await readFile("app.js", "utf8");
  const start = js.indexOf("const groupHit = hitTestHandle(screenPoint, groupScreenGeometry, HANDLE_RADIUS)");
  const end = js.indexOf('if (groupHit === "scale-nw"', start);
  assert.ok(start >= 0 && end > start, "group hit-test and scale controls are present");
  const groupHitHandling = js.slice(start, end);
  assert.match(groupHitHandling, /if \(groupHit === "move"\)/);
  assert.match(groupHitHandling, /type: "move"/);
  assert.match(groupHitHandling, /layerIds: layers\.map\(layer => layer\.id\)/);
  assert.match(groupHitHandling, /canvas\.setPointerCapture\(event\.pointerId\)/);
});


test("selection status indicator never intercepts canvas pointer gestures", async () => {
  const css = await readFile("styles.css", "utf8");
  assert.match(css, /#selection-indicator\s*\{[^}]*pointer-events:\s*none/);
});


test("AA-BOTTOM-BAR-BEGINNER-001 keeps five clear Spanish primary actions in the mobile bottom bar", async () => {
  const [html, css] = await Promise.all([readFile("index.html", "utf8"), readFile("styles.css", "utf8")]);
  const dock = html.match(/<nav class="mobile-touch-dock"[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(dock, /aria-label="Herramientas principales"/);
  for (const label of ["Mover", "Dibujar", "Borrar", "Texto", "Más"]) assert.match(dock, new RegExp(label));
  assert.equal((dock.match(/data-touch-action=/g) || []).length, 5);
  assert.match(css, /AA-BOTTOM-BAR-BEGINNER-001/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
});
