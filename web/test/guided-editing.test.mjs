import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GUIDED_EDITING_FLOWS, canCompleteGuidedStep, completeGuidedStep, createGuidedProgress, getGuidedFlow, getGuidedStep, goToPreviousGuidedStep, hasGuidedImage, isGuidedFlowComplete, recordGuidedActionLaunched } from "../domain/guided-editing.mjs";

test("beginner panel and censor controls are connected to the canonical editor", async () => {
 const html = await readFile("index.html","utf8");
 const app = await readFile("app.js","utf8");
 for (const goal of ["crop","background","erase","eraser","paint","censor","draw","text","color","layers","undo","export"]) assert.ok(html.includes(`data-edit-goal="${goal}"`));
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
 assert.match(app, /clearCanvasBackingStore\(ctx, canvas, dpr\)/);
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
 assert.match(app, /async function openCensorLightDialog\(requestedMode = "censor-light"\)/);
 assert.match(app, /function closeCensorLightDialog\(\)/);
 assert.match(app, /censor: \(\) => openCensorLightDialog\("censor-light"\)/);
 assert.match(app, /refreshDocument\(appliedMessage\)/);
 assert.match(app, /"censor-light": "✨ Luz de censura"/);
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

test("closing an existing text editor commits pending previews while provisional cancellation stays separate", async () => {
 const app = await readFile("app.js","utf8");
 const start = app.indexOf('textEditDialog?.addEventListener("close", () => {');
 const end = app.indexOf("\ntextStylePresetButtons.forEach", start);
 assert.ok(start >= 0 && end > start, "text editor close handler is present");
 const closeHandler = app.slice(start, end);
 assert.match(closeHandler, /const preview = state\.textPreview/);
 assert.match(closeHandler, /contentType === "text"/);
 assert.match(closeHandler, /commitLayerText\(preview\.layerId, preview\.values, "Cambios de texto guardados al cerrar el editor"\)/);
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
 assert.doesNotMatch(app, /function keepImageTransformVisible\(layer, transform\)/);
 assert.match(app, /const delta = constrainMoveDelta\(layer \? \[layer\] : \[\], desiredX, desiredY\)/);
 assert.match(app, /preview\.y = interaction\.beforeTransform\.y \+ delta\.y/);
 for (const preset of ["title", "subtitle", "body", "quote", "label", "elegant"]) {
  assert.ok(html.includes('data-text-style-preset="' + preset + '"'), "missing typography preset: " + preset);
 }
 assert.ok(html.includes('id="selection-mini-edit-text"'));
 assert.match(css, /AA-TYPOGRAPHY-CANVA-001/);
 assert.match(worker, /\.\/app\.js/);
 assert.match(browserE2E, /dragging selected text on the mobile touch path commits a bounded transform/);
 assert.match(app, /function activateSelectionToolForText\(/);
 assert.match(app, /function showTextEditorDialog\(/);
 assert.match(app, /finishTransformInteraction\(false, event\)/);
 assert.match(css, /AA-TYPOGRAPHY-CANVA-002/);
 assert.match(css, /#text-edit-dialog\[open\]/);
 assert.match(worker, /animeart-web-shell-v58/);
 assert.match(browserE2E, /mobile Text fills the available app viewport, remains editable, and switches away from brush mode/);
 assert.match(browserE2E, /dragging text never adds brush strokes/);
 assert.match(browserE2E, /tapping the moved text opens the editor/);
});


test("AA-TOOL-STUDIOS-001 keeps the mobile dock focused and separates image crop from composition crop", async () => {
 const [html, app, css, worker] = await Promise.all([
  readFile("index.html", "utf8"), readFile("app.js", "utf8"),
  readFile("styles.css", "utf8"), readFile("service-worker.js", "utf8")
 ]);
 const dockStart = html.indexOf('<nav class="mobile-touch-dock"');
 const dockEnd = html.indexOf("</nav>", dockStart);
 assert.ok(dockStart >= 0 && dockEnd > dockStart);
 const dock = html.slice(dockStart, dockEnd);
 assert.equal((dock.match(/data-touch-action=/g) || []).length, 6, "main dock should show only six common actions");
 assert.match(html, /id="crop-mode-dialog"/);
 assert.match(html, /id="crop-selected-image"/);
 assert.match(html, /id="crop-whole-canvas"/);
 assert.match(html, /id="canvas-crop-preview"/);
 assert.match(html, /id="canvas-crop-ratio"/);
 assert.match(app, /function openCanvasCropDialog\(/);
 assert.match(app, /cropDocumentCanvas\(state\.document, canvasCropRectangle\)/);
 assert.match(app, /draw: \(\) => \{[\s\S]*?data-tool="brush"[\s\S]*?click\(\)/);
 assert.match(app, /paint: \(\) => openCensorLightDialog\("paint"\)/);
 assert.match(app, /eraser: \(\) => \{[\s\S]*?data-tool="eraser"[\s\S]*?click\(\)/);
 assert.match(app, /openCensorLightDialog\("erase"\)/);
 assert.match(css, /AA-TOOL-STUDIOS-001/);
 assert.match(css, /AA-TOOL-STUDIOS-002/);
 assert.match(css, /#text-edit-dialog\[open\]/);
 assert.match(css, /#shape-maker-dialog\[open\]/);
 assert.match(css, /height: 100dvh/);
 assert.match(css, /#canvas-crop-dialog/);
 assert.match(worker, /animeart-web-shell-v58/);
});

test("KapiArt offers three real, three-step routes using existing editor actions",()=>{
 assert.deepEqual(GUIDED_EDITING_FLOWS.map(flow=>flow.id),["portrait-clean","sticker-anime","anime-cover","cyberpunk-neon","manga-vignette","colored-illustration","anime-wallpaper","photo-improve"]);
 assert.ok(GUIDED_EDITING_FLOWS.every(flow=>flow.steps.length===3));
 assert.ok(GUIDED_EDITING_FLOWS.every(flow=>flow.steps.every(item=>item.action&&item.actionLabel&&item.description&&item.why&&item.advancedTip)));
 assert.equal(getGuidedFlow("sticker-anime").steps[1].action,"remove-background");
 assert.equal(getGuidedFlow("sticker-anime").steps[2].action,"export-transparent");
 assert.equal(getGuidedFlow("anime-cover").steps[1].action,"creative-studio");
 assert.equal(getGuidedStep("portrait-clean",3),null);
 assert.equal(getGuidedFlow("missing"),null);
});
test("advanced routes connect to existing recipes, drawing, canvas, and export tools",()=>{
 assert.equal(getGuidedFlow("cyberpunk-neon").steps[1].action,"quick-recipe-ice-blue");
 assert.equal(getGuidedFlow("manga-vignette").steps[1].action,"quick-recipe-manga-ink");
 assert.equal(getGuidedFlow("colored-illustration").steps[1].secondaryAction.action,"draw-tool");
 assert.equal(getGuidedFlow("anime-wallpaper").steps[0].action,"create-canvas");
 assert.equal(getGuidedFlow("anime-wallpaper").steps.every(item=>!item.requiresImage),true);
 assert.equal(getGuidedFlow("photo-improve").steps[2].action,"export-jpeg");
 assert.equal(getGuidedFlow("photo-improve").steps.length,3);
});
test("wallpaper route can continue on an empty document after the canvas action is launched",()=>{
 const flowId="anime-wallpaper",emptyDocument={layers:[]};
 let progress=createGuidedProgress(flowId);
 assert.equal(canCompleteGuidedStep(progress,flowId,emptyDocument),false);
 progress=recordGuidedActionLaunched(progress,flowId);
 assert.equal(canCompleteGuidedStep(progress,flowId,emptyDocument),true);
 progress=completeGuidedStep(progress,flowId,emptyDocument).progress;
 assert.equal(progress.stepIndex,1);
});
test("guided steps cannot be marked complete before launching their real editor action",()=>{
 const progress=createGuidedProgress("sticker-anime");
 assert.equal(canCompleteGuidedStep(progress,progress.flowId,{layers:[{contentType:"image"}]}),false);
 const launched=recordGuidedActionLaunched(progress,progress.flowId);
 assert.equal(canCompleteGuidedStep(launched,launched.flowId,{layers:[]}),false);
 assert.equal(canCompleteGuidedStep(launched,launched.flowId,{layers:[{contentType:"image"}]}),true);
 assert.throws(()=>completeGuidedStep(progress,progress.flowId,{layers:[{contentType:"image"}]}),/Abre primero/);
 assert.throws(()=>completeGuidedStep(launched,launched.flowId,{layers:[]}),/Importa primero/);
});
test("guided progress advances sequentially, supports Back, and retains completed steps",()=>{
 const flowId="portrait-clean",document={layers:[{contentType:"image",image:{source:"fixture"}}]};
 let progress=recordGuidedActionLaunched(createGuidedProgress(flowId),flowId);
 progress=completeGuidedStep(progress,flowId,document).progress;
 assert.equal(progress.stepIndex,1);
 assert.deepEqual(progress.completedStepIds,["prepare"]);
 progress=goToPreviousGuidedStep(progress,flowId);
 assert.equal(progress.stepIndex,0);
 progress=completeGuidedStep(progress,flowId,document).progress;
 assert.equal(progress.stepIndex,1);
 progress=recordGuidedActionLaunched(progress,flowId);
 progress=completeGuidedStep(progress,flowId,document).progress;
 progress=recordGuidedActionLaunched(progress,flowId);
 const result=completeGuidedStep(progress,flowId,document);
 assert.equal(result.completed,true);
 assert.equal(isGuidedFlowComplete(result.progress,flowId),true);
});
test("image requirement prevents a guide from completing an empty project",()=>{
 assert.equal(hasGuidedImage({layers:[]}),false);
 assert.equal(hasGuidedImage({layers:[{contentType:"drawing"}]}),false);
 assert.equal(hasGuidedImage({layers:[{contentType:"image"}]}),true);
});

test("three-step guide is reachable in desktop and mobile toolbox, with offline module and KapiArt palette",async()=>{
 const [html,app,css,worker]=await Promise.all([readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("styles.css","utf8"),readFile("service-worker.js","utf8")]);
 for(const id of ["guided-editing-open","guided-editing-open-mobile","guided-editing-dialog","guided-flow-select","guided-step-action","guided-step-secondary","guided-step-back","guided-step-complete","guided-editing-cancel"])assert.ok(html.includes('id="'+id+'"'),"missing guided-editing control: "+id);
 for(const flowId of ["portrait-clean","sticker-anime","anime-cover","cyberpunk-neon","manga-vignette","colored-illustration","anime-wallpaper","photo-improve"])assert.ok(html.includes('value="'+flowId+'"'));
 assert.match(app,/function launchGuidedStepAction\(actionId\)/);
 assert.match(app,/mascotTip\.hidden=!helpToggle\.checked/);
 assert.match(html,/src="\.\/assets\/kapiart-mascot\.png"/);
 assert.match(html,/id="guided-mascot-tip"/);
 const focusStart=app.indexOf("function focusGuidedImageLayer()");
 const focusEnd=app.indexOf("\\nfunction launchGuidedStepAction",focusStart);
 const focusBody=app.slice(focusStart,focusEnd);
 assert.match(focusBody,/item\.image/);
 assert.match(focusBody,/refreshImageEditButton\(\)/);
 for(const action of ["import-image","create-canvas","fit-image","remove-background","color-adjustments","crop-image","creative-studio","add-text","add-drawing-layer","draw-tool","quick-recipe-ice-blue","quick-recipe-manga-ink","quick-recipe-soft-dream","export-transparent","export-png","export-document","export-jpeg"])assert.ok(app.includes('"'+action+'"'),"missing real editor action: "+action);
 assert.match(app,/completeGuidedStep\(currentGuidedProgress\(\),activeGuidedFlowId,state\.document\)/);
 assert.match(css,/#241A19/);assert.match(css,/#F2A2A0/);assert.match(css,/min-height:48px/);
 assert.match(worker,/animeart-web-shell-v58/);assert.match(worker,/\.\/domain\/guided-editing\.mjs/);
});


test("AA-GUIDED-STICKER-REAL-FLOW-001 protects the complete sticker guide browser journey", async () => {
  const browserE2E = await readFile(new URL("../scripts/browser-e2e.mjs", import.meta.url), "utf8");
  assert.ok(browserE2E.includes("AA-GUIDED-STICKER-REAL-FLOW-001"));
  assert.ok(browserE2E.includes("guided sticker background removal persists transparent background pixels and opaque subject pixels in the actual edited image"));
  assert.ok(browserE2E.includes("the sticker guide exports a PNG with actual transparent pixels"));
  assert.ok(browserE2E.includes("the guide records all three confirmed steps after the real import, cutout, and PNG export"));
});
