import assert from "node:assert/strict";
import test from "node:test";
import { createDocument } from "../domain/model.mjs";
import { cropDocumentCanvas, translateLayers } from "../domain/document-operations.mjs";
import { transformPoint } from "../domain/selection.mjs";
import { normalizeLayerSelection, toggleLayerSelection } from "../domain/selection.mjs";

function documentWithLayers() {
  const document = createDocument(800, 600);
  document.layers[0].id = "layer-1";
  document.layers.push({
    ...document.layers[0],
    id: "layer-2",
    name: "Layer 2",
    transform: { ...document.layers[0].transform }
  });
  return document;
}

test("multi-selection normalizes duplicate and unknown ids", () => {
  const document = documentWithLayers();
  assert.deepEqual(
    normalizeLayerSelection(["layer-2", "missing", "layer-2", "layer-1"], document),
    ["layer-2", "layer-1"]
  );
});

test("shift-style toggle selects and deselects within the existing selection boundary", () => {
  const document = documentWithLayers();
  assert.deepEqual(toggleLayerSelection(["layer-1"], "layer-2", document), ["layer-1", "layer-2"]);
  assert.deepEqual(toggleLayerSelection(["layer-1", "layer-2"], "layer-1", document), ["layer-2"]);
});

test("multi-layer translation updates every selected layer immutably", () => {
  const document = documentWithLayers();
  const next = translateLayers(document, ["layer-1", "layer-2"], 12, -7);
  assert.equal(next.layers[0].transform.x, 12);
  assert.equal(next.layers[0].transform.y, -7);
  assert.equal(next.layers[1].transform.x, 12);
  assert.equal(next.layers[1].transform.y, -7);
  assert.equal(document.layers[0].transform.x, 0);
  assert.equal(document.layers[1].transform.y, 0);
});

test("locked layer blocks an atomic multi-layer translation", () => {
  const document = documentWithLayers();
  document.layers[1].locked = true;
  assert.equal(translateLayers(document, ["layer-1", "layer-2"], 10, 10), null);
});


test("composition crop changes canvas bounds and preserves each layer at the same visible position minus crop origin", () => {
  const document = createDocument(800, 600);
  document.layers[0].transform = { x: 27, y: -13, scale: 1.4, rotation: 26 };
  document.layers[0].strokes = [{ tool: "brush", size: 12, color: "#ff00ff", points: [{ x: 120, y: 80 }, { x: 220, y: 160 }] }];
  document.layers.push({
    ...document.layers[0],
    id: "second-layer",
    name: "Second layer",
    contentType: "text",
    image: undefined,
    text: { value: "Title", x: 200, y: 180, fontFamily: "Arial", fontSize: 48, fontWeight: "bold", color: "#ffffff", align: "left" },
    strokes: [],
    transform: { x: -14, y: 32, scale: 0.8, rotation: -17 }
  });
  const originalTransforms = document.layers.map(layer => ({ ...layer.transform }));
  const originalPoints = [
    { x: 160, y: 130 },
    { x: 245, y: 225 }
  ];
  const oldCenter = { x: document.width / 2, y: document.height / 2 };
  const before = document.layers.map((layer, index) => transformPoint(originalPoints[index], originalTransforms[index], oldCenter));

  const next = cropDocumentCanvas(document, { x: 40, y: 30, width: 640, height: 480 });
  assert.ok(next);
  assert.equal(next.width, 640);
  assert.equal(next.height, 480);
  assert.equal(next.layers.length, 2);
  assert.deepEqual(document.layers.map(layer => layer.transform), originalTransforms, "source document is immutable");
  const newCenter = { x: next.width / 2, y: next.height / 2 };
  const after = next.layers.map((layer, index) => transformPoint(originalPoints[index], layer.transform, newCenter));
  for (let index = 0; index < before.length; index++) {
    assert.ok(Math.abs(after[index].x - (before[index].x - 40)) < 1e-8);
    assert.ok(Math.abs(after[index].y - (before[index].y - 30)) < 1e-8);
  }
});

test("composition crop rejects empty or out-of-bounds rectangles without changing the project", () => {
  const document = createDocument(800, 600);
  assert.equal(cropDocumentCanvas(document, { x: -1, y: 0, width: 100, height: 100 }), null);
  assert.equal(cropDocumentCanvas(document, { x: 750, y: 0, width: 100, height: 100 }), null);
  assert.equal(cropDocumentCanvas(document, { x: 0, y: 0, width: 0, height: 100 }), null);
  assert.equal(document.width, 800);
  assert.equal(document.height, 600);
});
