import assert from "node:assert/strict";
import test from "node:test";
import { createDocument } from "../domain/model.mjs";
import { translateLayers } from "../domain/document-operations.mjs";
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
