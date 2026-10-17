import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("beginner panel and censor controls are connected to the canonical editor", async () => {
 const html = await readFile("index.html","utf8");
 const app = await readFile("app.js","utf8");
 for (const goal of ["crop","background","erase","censor","draw","text","color","layers","undo","export"]) assert.ok(html.includes(`data-edit-goal="${goal}"`));
 assert.ok(html.includes("id=\"editing-help-enabled\""));
 assert.ok(html.includes("id=\"censor-light-size\""));
 assert.ok(html.includes("data-censor-preset=\"point\""));
 assert.ok(app.includes("function runEditGoal(goal)"));
 assert.ok(app.includes("const censor = state.tool === \"censor-light\""));
 assert.ok(app.includes("renderDocumentToCanvas(state.document, exportCanvas"));
});

test("painting over an image selects the independent transparent layer before recording strokes", async () => {
 const app = await readFile("app.js","utf8");
 assert.match(app, /setSelection\(\[paintLayer\.id\], paintLayer\.id\);\s*layer = selectedLayer\(\);/);
 assert.match(app, /state\.history\.record\(before, next\)/);
 assert.match(app, /hasCensorStrokes && !document\.querySelector\("#censor-permanent-export"\)\.checked/);
});


test("selection and transparency controls are visible and explicitly wired", async () => {
 const html = await readFile("index.html","utf8");
 const app = await readFile("app.js","utf8");
 const css = await readFile("styles.css","utf8");
 assert.ok(html.includes('id="selection-indicator"'));
 assert.ok(html.includes('id="view-transparency"'));
 assert.ok(html.includes('id="quick-remove-background"'));
 assert.ok(html.includes('id="quick-recover"'));
 assert.ok(html.includes('id="export-transparent-png"'));
 for (const mode of ["checkerboard","white","black","gray"]) assert.ok(html.includes(`data-canvas-background="${mode}"`));
 assert.match(app, /getContext\("2d", \{ alpha: true \}\)/);
 assert.match(app, /ctx\.clearRect\(0, 0, rect\.width, rect\.height\)/);
 assert.match(app, /function updateSelectionIndicator\(\)/);
 assert.match(app, /renderDocumentToCanvas\(state\.document, exportCanvas/);
 assert.match(css, /\.canvas-wrap\[data-background="checkerboard"\] canvas/);
 assert.match(css, /\.canvas-wrap\[data-background="white"\] canvas/);
 assert.match(css, /\.canvas-wrap\[data-background="black"\] canvas/);
 assert.match(css, /\.canvas-wrap\[data-background="gray"\] canvas/);
});

test("first brush touch on a different image keeps the gesture and starts the edit", async () => {
 const app = await readFile("app.js","utf8");
 assert.match(app, /const hitImage = \[\.\.\.state\.document\.layers\]\.reverse\(\)/);
 const start = app.indexOf('if (hitImage && hitImage.id !== state.selectedLayerId');
 const end = app.indexOf('let layer = selectedLayer();', start);
 assert.ok(start >= 0 && end > start, "image hit handling is present");
 const branch = app.slice(start, end);
 assert.match(branch, /setSelection\(\[hitImage\.id\], hitImage\.id\)/);
 assert.match(branch, /keep processing this same pointer gesture/);
 assert.doesNotMatch(branch, /\breturn\s*;/, "first touch must not exit before creating the brush stroke");
});


test("AA-UX-DELETE-001 exposes a functional selected-image removal action separate from pixel erasing", async () => {
 const [html, app, css] = await Promise.all([
  readFile("index.html", "utf8"), readFile("app.js", "utf8"), readFile("styles.css", "utf8")
 ]);
 assert.ok(html.includes('id="remove-selected-image"'));
 assert.ok(html.includes('id="quick-remove-image"'));
 assert.match(app, /function removeSelectedImage\(\)/);
 assert.match(app, /deleteLayer\(sourceDocument, layer\.id\)/);
 assert.match(app, /state\.history\.record\(before, next\)/);
 assert.match(app, /Primero tocá la imagen que querés quitar/);
 assert.match(app, /removeSelectedImageButton\?\.addEventListener\("click"/);
 assert.match(app, /function updateRemoveImageControl\(\)/);
 assert.match(css, /#remove-selected-image[\s\S]*?width: 46px/);
});


test("censor light uses a cancellable per-image preview instead of the drawing tool", async () => {
 const [html, app, css] = await Promise.all([
  readFile("index.html","utf8"), readFile("app.js","utf8"), readFile("styles.css","utf8")
 ]);
 for (const id of ["censor-light-dialog","censor-image-preview","censor-dialog-cancel","censor-dialog-undo","censor-dialog-apply"]) {
  assert.ok(html.includes('id="' + id + '"'), "missing censor dialog control: " + id);
 }
 assert.match(html, /class="censor-light-controls"[^>]*hidden/);
 assert.match(html, /<details class="background-removal-advanced">/);
 assert.ok(html.includes('id="background-auto-detect"'));
 assert.match(app, /async function openCensorLightDialog\(\)/);
 assert.match(app, /function closeCensorLightDialog\(\)/);
 assert.match(app, /censor: \(\) => openCensorLightDialog\(\)/);
 assert.match(app, /refreshDocument\("✨ Luz de censura aplicada solo a la imagen/);
 assert.match(app, /replaceImageLayer\(state\.document, layer\.id/);
 assert.match(css, /#censor-image-preview[\s\S]*?touch-action: none/);
});


test("canceling the new-text dialog removes the provisional text layer", async () => {
 const app = await readFile("app.js","utf8");
 assert.match(app, /function cancelNewlyCreatedTextLayer\(\)/);
 assert.match(app, /newlyCreatedTextLayerId = layer\.id/);
 assert.match(app, /if \(newlyCreatedTextLayerId\) \{ cancelNewlyCreatedTextLayer\(\); return; \}/);
 assert.match(app, /event\.preventDefault\(\);\s*cancelNewlyCreatedTextLayer\(\)/);
 assert.match(app, /newlyCreatedTextLayerId = null;\s*textEditDialog\?\.close\(\)/);
});


test("AA-TYPOGRAPHY-CANVA-001 keeps the text modal reachable on mobile and supports title-first editing", async () => {
 const [html, app, css, worker, browserE2E] = await Promise.all([
  readFile("index.html", "utf8"), readFile("app.js", "utf8"),
  readFile("styles.css", "utf8"), readFile("service-worker.js", "utf8"),
  readFile("scripts/browser-e2e.mjs", "utf8")
 ]);
 assert.match(app, /document\.body\.append\(textEditDialog\)/);
 assert.match(app, /function openTextEditorForLayer\(/);
 assert.match(app, /selection-mini-edit-text/);
 assert.match(app, /text: \(\) => selectedLayerExact\(\)\?\.contentType === "text"/);
 assert.match(app, /function canvasRenderDpr\(rect\)/);
 assert.match(app, /function keepImageTransformVisible\(layer, transform\)/);
 for (const preset of ["title", "subtitle", "body", "quote", "label", "elegant"]) {
  assert.ok(html.includes('data-text-style-preset="' + preset + '"'), "missing typography preset: " + preset);
 }
 assert.ok(html.includes('id="selection-mini-edit-text"'));
 assert.match(css, /AA-TYPOGRAPHY-CANVA-001/);
 assert.match(worker, /\.\/app\.js/);
 assert.match(browserE2E, /dragging selected text on the mobile touch path commits a bounded transform/);
 assert.match(app, /function activateSelectionToolForText\\(/);
 assert.match(app, /function showTextEditorDialog\\(/);
 assert.match(app, /finishTransformInteraction\\(false, event\\)/);
 assert.match(css, /AA-TYPOGRAPHY-CANVA-002/);
 assert.match(css, /#text-edit-dialog\\[open\\]/);
 assert.match(worker, /animeart-web-shell-v33/);
 assert.match(browserE2E, /mobile Text opens a reachable Canva-style editor above the dock and switches away from brush mode/);
 assert.match(browserE2E, /dragging text never adds brush strokes/);
 assert.match(browserE2E, /tapping the moved text opens the editor/);
});
