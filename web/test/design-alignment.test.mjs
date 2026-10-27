import test from "node:test";
import assert from "node:assert/strict";
import { createLayerAlignmentTransforms, getLayerAlignmentBounds } from "../domain/design-alignment.mjs";
import { createTextLayer } from "../domain/model.mjs";

function imageLayer(id, x, y, width = 100, height = 80, patch = {}) {
  return {
    id,
    name: id,
    contentType: "image",
    image: { width, height, source: "data:image/png;base64,AA==" },
    visible: true,
    locked: false,
    transform: { x, y, scale: 1, rotation: 0, ...(patch.transform || {}) },
    ...Object.fromEntries(Object.entries(patch).filter(([key]) => key !== "transform"))
  };
}

function doc(layers) {
  return { width: 800, height: 600, layers };
}

function outputFor(result, id) {
  return result.transforms.find(item => item.id === id)?.transform;
}

test("single layer aligns against the full canvas", () => {
  const documentModel = doc([imageLayer("a", 120, 70)]);
  const result = createLayerAlignmentTransforms(documentModel, ["a"], "center-x");
  assert.equal(result.ok, true);
  assert.equal(outputFor(result, "a").x, 350);
  assert.equal(outputFor(result, "a").y, 70);
});

test("multiple layers align to the aggregate selection edge without changing scale or rotation", () => {
  const documentModel = doc([
    imageLayer("a", 20, 10, 100, 80),
    imageLayer("b", 240, 50, 50, 30, { transform: { scale: 1.6, rotation: 12 } })
  ]);
  const before = documentModel.layers[1].transform;
  const result = createLayerAlignmentTransforms(documentModel, ["a", "b"], "left");
  assert.equal(result.ok, true);
  const aligned = { ...documentModel.layers[1], transform: outputFor(result, "b") };
  const boundsA = getLayerAlignmentBounds(documentModel.layers[0], documentModel);
  const boundsB = getLayerAlignmentBounds(aligned, documentModel);
  assert.ok(Math.abs(boundsA.left - boundsB.left) < 0.0001);
  assert.equal(outputFor(result, "b").scale, before.scale);
  assert.equal(outputFor(result, "b").rotation, before.rotation);
});

test("horizontal distribution leaves first and last edges in place and equalizes gaps", () => {
  const documentModel = doc([
    imageLayer("a", 0, 0, 100, 20),
    imageLayer("b", 180, 10, 50, 20),
    imageLayer("c", 420, 0, 80, 20)
  ]);
  const result = createLayerAlignmentTransforms(documentModel, ["a", "b", "c"], "distribute-horizontal");
  assert.equal(result.ok, true);
  const layers = documentModel.layers.map(layer => ({ ...layer, transform: outputFor(result, layer.id) || layer.transform }));
  const bounds = layers.map(layer => getLayerAlignmentBounds(layer, documentModel));
  const gaps = [bounds[1].left - bounds[0].right, bounds[2].left - bounds[1].right];
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 0.0001);
  assert.ok(Math.abs(bounds[0].left) < 0.0001);
  assert.ok(Math.abs(bounds[2].right - 500) < 0.0001);
});

test("distribution requires three unlocked selected layers and leaves unselected layers untouched", () => {
  const documentModel = doc([
    imageLayer("a", 0, 0),
    imageLayer("b", 140, 0),
    imageLayer("c", 400, 0),
    imageLayer("outside", 700, 500)
  ]);
  const tooFew = createLayerAlignmentTransforms(documentModel, ["a", "b"], "distribute-horizontal");
  assert.equal(tooFew.ok, false);
  assert.match(tooFew.error, /tres capas/i);
  documentModel.layers[1].locked = true;
  const locked = createLayerAlignmentTransforms(documentModel, ["a", "b", "c"], "center-y");
  assert.equal(locked.ok, false);
  assert.match(locked.error, /desbloquea/i);
  const invalid = createLayerAlignmentTransforms(documentModel, ["a", "missing"], "left");
  assert.equal(invalid.ok, false);
});

test("drawing bounds handle long strokes without argument-list overflows", () => {
  const points = Array.from({ length: 150_000 }, (_, index) => ({
    x: index % 1000,
    y: Math.floor(index / 1000)
  }));
  const layer = {
    id: "long-ink",
    contentType: "drawing",
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    strokes: [{ size: 8, points }]
  };
  const bounds = getLayerAlignmentBounds(layer, doc([]));
  assert.ok(bounds);
  assert.equal(bounds.left, -4);
  assert.equal(bounds.right, 1003);
  assert.equal(bounds.top, -4);
  assert.equal(bounds.bottom, 153);
});

test("text alignment bounds honor stored letter spacing and line height", () => {
  const base = createTextLayer("Base", { value: "AB\nCD", x: 100, y: 100, fontSize: 30, letterSpacing: 0, lineHeight: 1.2 });
  const open = createTextLayer("Open", { value: "AB\nCD", x: 100, y: 100, fontSize: 30, letterSpacing: 12, lineHeight: 2 });
  const baseBounds = getLayerAlignmentBounds(base, doc([base]));
  const openBounds = getLayerAlignmentBounds(open, doc([open]));
  assert.ok(openBounds.width > baseBounds.width);
  assert.ok(openBounds.bottom - openBounds.top > baseBounds.bottom - baseBounds.top);
});

test("single-layer vertical alignment and invalid modes are predictable", () => {
  const documentModel = doc([imageLayer("a", 60, 120)]);
  const aligned = createLayerAlignmentTransforms(documentModel, ["a"], "bottom");
  assert.equal(aligned.ok, true);
  assert.equal(outputFor(aligned, "a").y, 520);
  assert.equal(createLayerAlignmentTransforms(documentModel, ["a"], "magic").ok, false);
});
