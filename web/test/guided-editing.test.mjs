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

test("touching a different image selects it before the next edit to avoid changing the wrong layer", async () => {
 const app = await readFile("app.js","utf8");
 assert.match(app, /const hitImage = \[\.\.\.state\.document\.layers\]\.reverse\(\)/);
 assert.match(app, /setSelection\(\[hitImage\.id\], hitImage\.id\)/);
 assert.match(app, /Imagen seleccionada\. Volvé a tocar para usar/);
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
