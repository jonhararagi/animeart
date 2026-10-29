import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createTextLayer } from "../domain/model.mjs";
import {
  DESIGN_RESIZE_MODES,
  MAX_DESIGN_RESIZE_DIMENSION,
  MAX_DESIGN_RESIZE_PIXELS,
  resizeDocumentForFormat
} from "../domain/design-resize.mjs";

function composition() {
  const document = createDocument(1000, 800);
  const image = createImageLayer("Ilustración", 240, 180, "data:image/png;base64,AA==");
  image.transform = { x: 120, y: -80, scale: 1.25, rotation: 12 };
  image.groupId = "cover-group";
  const title = createTextLayer("Título", { value: "KapiArt", fontSize: 58, color: "#fff4eb" });
  title.transform = { x: -90, y: 150, scale: 0.8, rotation: -4 };
  title.groupId = "cover-group";
  document.layers = [image, title];
  return document;
}

test("fit resizes every editable layer uniformly and keeps the whole composition in frame", () => {
  const source = composition();
  const sourceSnapshot = JSON.stringify(source);
  const imageId = source.layers[0].id;
  const textId = source.layers[1].id;

  const next = resizeDocumentForFormat(source, 600, 1200, "fit");

  assert.equal(next.width, 600);
  assert.equal(next.height, 1200);
  assert.deepEqual(next.layers.map(layer => layer.id), [imageId, textId]);
  assert.deepEqual(next.layers.map(layer => layer.groupId), ["cover-group", "cover-group"]);
  assert.deepEqual(next.layers[0].transform, { x: 72, y: -48, scale: 0.75, rotation: 12 });
  assert.deepEqual(next.layers[1].transform, { x: -54, y: 90, scale: 0.48, rotation: -4 });
  assert.equal(next.layers[0].image.source, "data:image/png;base64,AA==");
  assert.equal(next.layers[1].text.value, "KapiArt");
  assert.equal(JSON.stringify(source), sourceSnapshot, "the source document must remain untouched");
});

test("fill scales layers until the new canvas is covered without flattening or deleting overflow", () => {
  const source = composition();
  const next = resizeDocumentForFormat(source, 200, 1000, "fill");

  assert.deepEqual(next.layers[0].transform, { x: 150, y: -100, scale: 1.5625, rotation: 12 });
  assert.deepEqual(next.layers[1].transform, { x: -112.5, y: 187.5, scale: 1, rotation: -4 });
  assert.equal(next.layers.length, source.layers.length);
  assert.equal(next.layers[0].image.width, source.layers[0].image.width);
  assert.equal(next.layers[0].image.height, source.layers[0].image.height);
});

test("reframe changes only the canvas dimensions and keeps layer geometry unchanged", () => {
  const source = composition();
  const originalTransforms = source.layers.map(layer => ({ ...layer.transform }));
  const next = resizeDocumentForFormat(source, 1080, 1920, "reframe");

  assert.equal(next.width, 1080);
  assert.equal(next.height, 1920);
  assert.deepEqual(next.layers.map(layer => layer.transform), originalTransforms);
});

test("resize exposes supported modes and applies mobile-safe dimension limits", () => {
  assert.deepEqual(DESIGN_RESIZE_MODES, ["fit", "fill", "reframe"]);
  assert.equal(MAX_DESIGN_RESIZE_DIMENSION, 8192);
  assert.equal(MAX_DESIGN_RESIZE_PIXELS, 40_000_000);

  assert.throws(() => resizeDocumentForFormat(composition(), 0, 300, "fit"), /entre 1 y 8192/);
  assert.throws(() => resizeDocumentForFormat(composition(), 8193, 300, "fit"), /entre 1 y 8192/);
  assert.throws(() => resizeDocumentForFormat(composition(), 7000, 7000, "fit"), /40 megapíxeles/);
  assert.throws(() => resizeDocumentForFormat(composition(), 100, 100, "stretch"), /Modo de redimensionado/);
  assert.throws(() => resizeDocumentForFormat(createDocument(0, 0), 100, 100, "fit"), /El lienzo actual/);
  assert.throws(() => resizeDocumentForFormat(null, 100, 100, "fit"), /proyecto editable válido/);
});
