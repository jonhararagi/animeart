import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, isValidDocument, normalizeDocument } from "../domain/model.mjs";
import { setLayerAdjustments } from "../domain/document-operations.mjs";
import {
  DEFAULT_LAYER_ADJUSTMENTS,
  areLayerAdjustmentsEqual,
  isDefaultLayerAdjustments,
  isValidLayerAdjustments,
  layerAdjustmentsToCanvasFilter,
  normalizeLayerAdjustments
} from "../domain/layer-adjustments.mjs";

test("layer adjustment normalization clamps bounds and defaults invalid values", () => {
  assert.deepEqual(normalizeLayerAdjustments({
    brightness: -20, contrast: 260, saturation: 64.4, hue: -220, temperature: -130, tint: 140, blur: 25
  }), { brightness: 0, contrast: 200, saturation: 64, hue: -180, temperature: -100, tint: 100, blur: 20 });
  assert.deepEqual(normalizeLayerAdjustments({
    brightness: "not-a-number", contrast: undefined, saturation: null, hue: 30, temperature: undefined, tint: null, blur: 0.26
  }), { brightness: 100, contrast: 100, saturation: 100, hue: 30, temperature: 0, tint: 0, blur: 0.3 });
});

test("neutral adjustments do not add noise to existing document files", () => {
  assert.equal(layerAdjustmentsToCanvasFilter(), "none");
  assert.equal(isDefaultLayerAdjustments({ ...DEFAULT_LAYER_ADJUSTMENTS }), true);
  const document = createDocument(800, 600);
  assert.equal(Object.hasOwn(document.layers[0], "adjustments"), false);
  assert.equal(Object.hasOwn(normalizeDocument(JSON.parse(JSON.stringify(document))).layers[0], "adjustments"), false);
});

test("Canvas filter serializes bounded adjustments deterministically", () => {
  assert.equal(
    layerAdjustmentsToCanvasFilter({ brightness: 125, contrast: 120, saturation: 140, hue: 12, temperature: 50, tint: -20, blur: 1.5 }),
    "brightness(125%) contrast(120%) saturate(140%) hue-rotate(12deg) sepia(21%) hue-rotate(-4deg) saturate(102%) blur(1.5px)"
  );
  assert.equal(layerAdjustmentsToCanvasFilter(DEFAULT_LAYER_ADJUSTMENTS), "none");
});

test("adjustments survive document normalization and validation", () => {
  const document = createDocument(800, 600);
  document.layers[0].adjustments = normalizeLayerAdjustments({ brightness: 130, saturation: 80 });
  const restored = normalizeDocument(JSON.parse(JSON.stringify(document)));
  assert.deepEqual(restored.layers[0].adjustments, { brightness: 130, contrast: 100, saturation: 80, hue: 0, temperature: 0, tint: 0, blur: 0 });
  assert.equal(isValidDocument(restored), true);
  assert.equal(isValidLayerAdjustments(restored.layers[0].adjustments), true);
});

test("setLayerAdjustments is immutable, works on images and resets to neutral", () => {
  const document = createDocument(640, 480);
  const image = createImageLayer("Reference image", 64, 64, "data:image/svg+xml,%3Csvg/%3E");
  document.layers.push(image);

  const changed = setLayerAdjustments(document, image.id, { brightness: 118, hue: 20, blur: 0.5 });
  assert.ok(changed);
  assert.equal(document.layers[1].adjustments, undefined, "source document is not mutated");
  assert.deepEqual(changed.layers[1].adjustments, { brightness: 118, contrast: 100, saturation: 100, hue: 20, temperature: 0, tint: 0, blur: 0.5 });
  assert.equal(changed.layers[1].image.source, "data:image/svg+xml,%3Csvg/%3E");
  assert.equal(isValidDocument(changed), true);

  const reset = setLayerAdjustments(changed, image.id, DEFAULT_LAYER_ADJUSTMENTS);
  assert.ok(reset);
  assert.equal(Object.hasOwn(reset.layers[1], "adjustments"), false);
  assert.equal(areLayerAdjustmentsEqual(reset.layers[1].adjustments, DEFAULT_LAYER_ADJUSTMENTS), true);
});

test("document validation rejects a malformed stored adjustment object", () => {
  const document = createDocument(800, 600);
  document.layers[0].adjustments = { brightness: 500 };
  assert.equal(isValidDocument(document), false);
});

test("the live canvas and PNG export share the existing renderer for layer effects", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const exporter = await readFile(new URL("../domain/png-export.mjs", import.meta.url), "utf8");
  assert.match(app, /context\.filter = layerAdjustmentsToCanvasFilter\(previewAdjustments\)/);
  assert.match(app, /state\.history\.record\(before, next\)/);
  assert.match(app, /persistDocument\(\)/);
  assert.match(app, /layerAdjustmentsToCanvasFilter/);
  assert.match(exporter, /renderDocument\(\{ context, document: documentModel, center \}\)/);
});

test("warm/cool temperature and color cast serialize to reversible layer filters", () => {
  assert.equal(
    layerAdjustmentsToCanvasFilter({ temperature: 75, tint: -40 }),
    "sepia(32%) hue-rotate(-7deg) saturate(104%)"
  );
  assert.equal(
    layerAdjustmentsToCanvasFilter({ temperature: -50 }),
    "hue-rotate(-6deg) saturate(106%)"
  );
  assert.deepEqual(
    normalizeLayerAdjustments({ temperature: 20, tint: -10 }),
    { brightness: 100, contrast: 100, saturation: 100, hue: 0, temperature: 20, tint: -10, blur: 0 }
  );
});
