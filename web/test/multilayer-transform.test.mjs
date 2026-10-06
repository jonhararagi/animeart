import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createLayer, createStroke } from "../domain/model.mjs";
import { transformLayers } from "../domain/document-operations.mjs";
import { groupRotationTransforms, groupScaleTransforms, layerWorldCenter, multiSelectionGeometry } from "../domain/selection.mjs";
import { serializeDocumentForStorage } from "../domain/image-import.mjs";

function imagePair() {
  const a = createImageLayer("A", 20, 10, "data:image/png;base64,a");
  const b = createImageLayer("B", 20, 10, "data:image/png;base64,b");
  a.transform = { x: 20, y: 0, scale: 1, rotation: 0 };
  b.transform = { x: 60, y: 0, scale: 1, rotation: 0 };
  return { a, b };
}

test("T042 reference uses the existing transform pipeline for move scale and rotation", () => {
  const { a } = imagePair();
  a.isReference = true;
  const document = { ...createDocument(), layers: [a] };
  let next = transformLayers(document, [{
    id: a.id,
    transform: { x: 30, y: 15, scale: 2, rotation: 45 }
  }]);
  assert.deepEqual(next.layers[0].transform, { x: 30, y: 15, scale: 2, rotation: 45 });
  assert.equal(next.layers[0].isReference, true);
});

test("T042 reference visibility and opacity remain ordinary layer state", () => {
  const { a } = imagePair();
  a.isReference = true;
  a.visible = false;
  a.opacity = 0.25;
  const restored = JSON.parse(JSON.stringify({ ...createDocument(), layers: [a] }));
  assert.equal(restored.layers[0].isReference, true);
  assert.equal(restored.layers[0].visible, false);
  assert.equal(restored.layers[0].opacity, 0.25);
});

test("T041 group scale preserves relative centers and scales every selected layer", () => {
  const { a, b } = imagePair();
  const pivot = { x: 0, y: 0 };
  const geometry = multiSelectionGeometry([a, b], pivot);
  assert.deepEqual(geometry.center, { x: 50, y: 5 });

  const transforms = groupScaleTransforms([a, b], pivot, "scale-se", { x: 140, y: 20 });
  assert.equal(transforms.length, 2);
  assert.equal(transforms[0].transform.scale, 2);
  assert.equal(transforms[1].transform.scale, 2);

  const next = transformLayers({ ...createDocument(), layers: [a, b] }, transforms);
  assert.ok(next);
  const aCenter = layerWorldCenter(next.layers[0], pivot);
  const bCenter = layerWorldCenter(next.layers[1], pivot);
  assert.deepEqual(aCenter, { x: 40, y: 10 });
  assert.deepEqual(bCenter, { x: 120, y: 10 });
  assert.equal(bCenter.x - aCenter.x, 80);
});

test("T041 group rotation rotates positions and layer rotations around group center", () => {
  const { a, b } = imagePair();
  const pivot = { x: 0, y: 0 };
  const transforms = groupRotationTransforms([a, b], pivot, { x: 80, y: 5 }, { x: 50, y: -25 });
  assert.equal(transforms.length, 2);
  assert.equal(transforms[0].transform.rotation, 90);
  assert.equal(transforms[1].transform.rotation, 90);

  const next = transformLayers({ ...createDocument(), layers: [a, b] }, transforms);
  const aCenter = layerWorldCenter(next.layers[0], pivot);
  const bCenter = layerWorldCenter(next.layers[1], pivot);
  assert.ok(Math.abs(aCenter.x - 50) < 1e-9);
  assert.ok(Math.abs(aCenter.y + 15) < 1e-9);
  assert.ok(Math.abs(bCenter.x - 50) < 1e-9);
  assert.ok(Math.abs(bCenter.y - 25) < 1e-9);
});

test("T041 locked layers make a group transform atomic", () => {
  const { a, b } = imagePair();
  b.locked = true;
  const document = { ...createDocument(), layers: [a, b] };
  const result = transformLayers(document, [
    { id: a.id, transform: { ...a.transform, scale: 2 } },
    { id: b.id, transform: { ...b.transform, scale: 2 } }
  ]);
  assert.equal(result, null);
  assert.equal(document.layers[0].transform.scale, 1);
  assert.equal(document.layers[1].transform.scale, 1);
});

test("T041 transformed drawing and image layers serialize through the existing persistence boundary", () => {
  const drawing = createLayer("Drawing");
  drawing.strokes.push(createStroke("brush", 5, [{ x: 0, y: 0 }, { x: 10, y: 10 }]));
  drawing.transform = { x: 12, y: 18, scale: 1.5, rotation: 30 };
  const image = createImageLayer("Image", 32, 16, "data:image/png;base64,image");
  image.transform = { x: 40, y: 22, scale: 0.75, rotation: -15 };
  const document = { ...createDocument(100, 100), layers: [drawing, image] };
  const serialized = serializeDocumentForStorage(document);
  const restored = JSON.parse(serialized);
  assert.deepEqual(restored.layers.map(layer => layer.transform), [drawing.transform, image.transform]);
});
