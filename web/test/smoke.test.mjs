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
  assert.match(html, /AnimeArt Web/);
  assert.match(html, /app\.js/);
});

test("web editor has canvas, local persistence, and history controls", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(js, /getContext/);
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

test("web interaction keeps viewport, document coordinates and persistence boundaries explicit", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /screenToDocument\(screenPoint, state\.viewport/);
  assert.match(js, /ctx\.translate\(center\.x \+ state\.viewport\.panX/);
  assert.doesNotMatch(js, /canvas\.style\.transform/);
  assert.match(js, /persistDocumentSnapshot\(localStorage, "animeart-web-document", state\.document\)/);
  assert.doesNotMatch(js, /JSON\.stringify\(\{[^}]*viewport/);
  assert.match(js, /event\.pointerId !== state\.drawingPointerId/);
  assert.match(js, /state\.strokeBefore/);
});

test("history integration is document-only and viewport navigation never records history", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /state\.history\.record\(before, state\.document\)/);
  assert.match(js, /state\.viewport = panBy/);
  assert.match(js, /setViewport\(zoomAt/);
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
  assert.match(js, /setViewport\(zoomAt/);
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
  assert.match(js, /screenToDocument\(screenPoint, state\.viewport/);
  assert.match(js, /selectionGeometry\(layer, state\.viewport/);
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
  assert.match(js, /createStroke\(state\.tool, state\.brush\.size/);
  assert.match(js, /state\.brush\.color, state\.brush\.opacity/);
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



test("PNG export UI uses the existing document renderer and local download pipeline", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(html, /id="export-png"/);
  assert.match(html, /Exportar PNG/);
  assert.match(js, /createPngExportCanvas/);
  assert.match(js, /renderDocumentToCanvas/);
  assert.match(js, /drawDocument\(\{ context = ctx, document = state\.document, center = canvasCenter\(\)/);
  assert.match(js, /canvasToPngBlob/);
  assert.match(js, /downloadPngBlob\(blob, "animeart\.png"\)/);
  assert.match(js, /await ensureExportImages\(state\.document\)/);
  assert.match(exporter, /getContext\("2d", \{ alpha: true \}\)/);
  assert.match(exporter, /type: "image\/png"/);
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
