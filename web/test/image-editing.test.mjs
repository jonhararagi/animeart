import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer } from "../domain/model.mjs";
import { replaceImageLayer } from "../domain/document-operations.mjs";
import { transformPoint } from "../domain/selection.mjs";
import { cropImageSource, normalizeImageCrop, resizeImageSource, validateRasterDimensions } from "../domain/image-processing.mjs";

function fakeEnvironment(width = 100, height = 80) {
  const drawCalls = [];
  const context = { imageSmoothingEnabled: false, imageSmoothingQuality: "low", drawImage(...args) { drawCalls.push(args); } };
  const canvas = { width: 0, height: 0, getContext() { return context; }, toDataURL(type) { return "data:" + type + ";base64," + "A".repeat(40); } };
  class FakeImage {
    constructor() { this.naturalWidth = width; this.naturalHeight = height; }
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
  }
  return { drawCalls, context, canvas, ImageCtor: FakeImage, documentObject: { createElement() { return canvas; } } };
}

test("crop rectangle is integer-bounded and stays inside the source raster", () => {
  assert.deepEqual(normalizeImageCrop({ x: 10, y: 12, width: 40, height: 30 }, 100, 80), { x: 10, y: 12, width: 40, height: 30 });
  assert.throws(() => normalizeImageCrop({ x: -1, y: 0, width: 10, height: 10 }, 100, 80), /Crop rectangle/i);
  assert.throws(() => normalizeImageCrop({ x: 90, y: 0, width: 20, height: 10 }, 100, 80), /Crop rectangle/i);
  assert.throws(() => normalizeImageCrop({ x: 0, y: 0, width: 0, height: 10 }, 100, 80), /Crop rectangle/i);
});

test("raster sizing rejects oversized dimensions before allocating canvas memory", () => {
  assert.deepEqual(validateRasterDimensions(1920, 1080), { width: 1920, height: 1080 });
  assert.throws(() => validateRasterDimensions(8193, 100), /dimensions/i);
  assert.throws(() => validateRasterDimensions(8192, 8192), /dimensions/i);
});

test("crop writes only the chosen source rectangle to a transparent PNG canvas", async () => {
  const env = fakeEnvironment();
  const result = await cropImageSource("data:image/png;base64,source", { x: 10, y: 12, width: 40, height: 30 }, env);
  assert.deepEqual({ width: result.width, height: result.height, format: result.format }, { width: 40, height: 30, format: "image/png" });
  assert.ok(result.source.startsWith("data:image/png;base64,"));
  assert.deepEqual(env.drawCalls[0].slice(1), [10, 12, 40, 30, 0, 0, 40, 30]);
  assert.equal(env.canvas.width, 40);
  assert.equal(env.canvas.height, 30);
  assert.equal(env.context.imageSmoothingQuality, "high");
});

test("resize re-samples to requested dimensions using high-quality smoothing", async () => {
  const env = fakeEnvironment();
  const result = await resizeImageSource("data:image/png;base64,source", 200, 160, env);
  assert.equal(result.width, 200);
  assert.equal(result.height, 160);
  assert.deepEqual(env.drawCalls[0].slice(1), [0, 0, 200, 160]);
  assert.equal(env.canvas.width, 200);
  assert.equal(env.canvas.height, 160);
});

test("cropped image layer preserves the cropped region position under rotation and scale", () => {
  const document = createDocument(400, 300);
  document.layers = [createImageLayer("Photo", 100, 80, "data:image/png;base64,original")];
  document.layers[0].transform = { x: 3, y: 4, scale: 2, rotation: 90 };
  const next = replaceImageLayer(document, document.layers[0].id, { source: "data:image/png;base64,cropped", width: 40, height: 30 }, { cropOrigin: { x: 10, y: 12 } });
  assert.ok(next);
  assert.equal(next.layers[0].image.width, 40);
  assert.equal(next.layers[0].image.height, 30);
  assert.ok(Math.abs(next.layers[0].transform.x - (-21)) < 1e-9);
  assert.ok(Math.abs(next.layers[0].transform.y - 24) < 1e-9);
  assert.equal(document.layers[0].image.width, 100);
  assert.equal(document.layers[0].transform.x, 3);
});

test("resizing maintains display size when aspect ratio is unchanged and rejects locked layers", () => {
  const document = createDocument(400, 300);
  const image = createImageLayer("Photo", 100, 50, "data:image/png;base64,original");
  image.transform.scale = 2;
  document.layers = [image];
  const resized = replaceImageLayer(document, image.id, { source: "data:image/png;base64,resized", width: 200, height: 100 }, { preserveDisplaySize: true });
  assert.ok(resized);
  assert.equal(resized.layers[0].transform.scale, 1);
  assert.equal(resized.layers[0].image.width, 200);
  assert.equal(replaceImageLayer(document, image.id, { source: "data:image/png;base64,resized", width: 200, height: 70 }, { preserveDisplaySize: true }), null);
  const locked = structuredClone(document);
  locked.layers[0].locked = true;
  assert.equal(replaceImageLayer(locked, image.id, { source: "data:image/png;base64,resized", width: 200, height: 100 }), null);
});


test("aspect-locked resize preserves the image position under the document-center transform", () => {
  const document = createDocument(800, 600);
  const image = createImageLayer("Rotated photo", 100, 50, "data:image/png;base64,original");
  image.transform = { x: 17, y: -13, scale: 1.5, rotation: 31 };
  document.layers = [image];
  const pivot = { x: document.width / 2, y: document.height / 2 };
  const oldTransform = structuredClone(image.transform);
  const oldOrigin = transformPoint({ x: 0, y: 0 }, oldTransform, pivot);
  const oldCenter = transformPoint({ x: 50, y: 25 }, oldTransform, pivot);
  const next = replaceImageLayer(document, image.id, {
    source: "data:image/png;base64,resized", width: 200, height: 100
  }, { preserveDisplaySize: true });
  assert.ok(next);
  const resized = next.layers[0];
  const newOrigin = transformPoint({ x: 0, y: 0 }, resized.transform, pivot);
  const newCenter = transformPoint({ x: 100, y: 50 }, resized.transform, pivot);
  assert.ok(Math.abs(oldOrigin.x - newOrigin.x) < 1e-9);
  assert.ok(Math.abs(oldOrigin.y - newOrigin.y) < 1e-9);
  assert.ok(Math.abs(oldCenter.x - newCenter.x) < 1e-9);
  assert.ok(Math.abs(oldCenter.y - newCenter.y) < 1e-9);
  assert.equal(resized.transform.scale, 0.75);
});


test("crop editor provides direct visual selection and common photo aspect ratios", async () => {
  const html = await readFile("index.html", "utf8");
  const app = await readFile("app.js", "utf8");
  assert.match(html, /id="crop-preview"/);
  assert.match(html, /id="image-crop-aspect"/);
  assert.match(html, /value="0\.8"/);
  assert.match(html, /value="1\.7777777778"/);
  assert.match(app, /cropPreviewCanvas\.addEventListener\("pointerdown"/);
  assert.match(app, /cropPreviewCanvas\.addEventListener\("pointermove"/);
  assert.match(app, /function applyCropAspectPreset/);
  assert.match(app, /function drawCropPreview/);
});
