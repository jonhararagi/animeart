import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(js, /state\.document\)\);/);
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

test("layer lifecycle UI guards locked layers and preserves the single selection", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /if \(layer\.locked\) return;/);
  assert.match(js, /if \(layer\.locked \|\| state\.document\.layers\.length <= 1\) return;/);
  assert.match(js, /state\.selectedLayerId = duplicate\.id/);
});
