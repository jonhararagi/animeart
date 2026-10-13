import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument, createStroke, isValidDocument, normalizeDocument } from "../domain/model.mjs";

test("brush hardness and effect have safe defaults and bounded values", () => {
  assert.deepEqual(createStroke().hardness, 100);
  assert.equal(createStroke().effect, "normal");
  assert.equal(createStroke("brush", 10, [], "#ff00ff", 1, { hardness: -12, effect: "invalid" }).hardness, 0);
  assert.equal(createStroke("brush", 10, [], "#ff00ff", 1, { hardness: 145, effect: "invalid" }).effect, "normal");
});

test("brush effects and hardness survive project serialization and recovery", () => {
  const document = createDocument(640, 480);
  document.layers[0].strokes.push(createStroke("brush", 12, [{ x: 12, y: 18 }, { x: 40, y: 46 }], "#00e5ff", 0.8, {
    hardness: 42,
    effect: "neon"
  }));
  const restored = normalizeDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(restored.layers[0].strokes[0].hardness, 42);
  assert.equal(restored.layers[0].strokes[0].effect, "neon");
  assert.equal(isValidDocument(restored), true);
});

test("layer stack includes thumbnail rendering for image, text and drawing layers", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /function createLayerThumbnail\(layer\)/);
  assert.match(app, /className = "layer-thumbnail"/);
  assert.match(app, /selectButton\.append\(createLayerThumbnail\(layer\), layerName\)/);
  assert.match(app, /renderLayers\(\);[\s\S]*?canvas\.addEventListener\("pointerleave"/);
});

test("the editor exposes connected brush hardness and visual effect controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /id="brush-hardness"/);
  assert.match(html, /id="brush-effect"/);
  assert.match(app, /brushHardnessInput\.addEventListener\("input"/);
  assert.match(app, /brushEffectInput\.addEventListener\("change"/);
  assert.match(app, /effect === "neon" \? stroke\.size \* 1\.8/);
  assert.match(app, /stroke\.effect \|\| "normal"/);
});
test("drawing eraser uses alpha compositing instead of painting white", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /context\.globalCompositeOperation = erasing \? "destination-out" : "source-over"/);
  assert.match(app, /function drawDrawingLayer\(layer, context, documentModel\)/);
  assert.match(app, /previewContext\.globalCompositeOperation = stroke\.tool === "eraser" \? "destination-out" : "source-over"/);
  assert.doesNotMatch(app, /context\.strokeStyle = erasing \? "#ffffff"/);
});
