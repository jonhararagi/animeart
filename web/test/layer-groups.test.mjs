import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createLayer, isValidDocument, restoreDocument } from "../domain/model.mjs";
import { duplicateLayer, groupLayers, ungroupLayers } from "../domain/document-operations.mjs";

function fixture() {
  const document = createDocument(800, 600);
  const title = createLayer("Título");
  const sticker = createLayer("Destello");
  const background = createLayer("Fondo");
  document.layers = [title, sticker, background];
  return { document, title, sticker, background };
}

test("grouping persists a shared safe group ID without flattening layers", () => {
  const { document, title, sticker, background } = fixture();
  const grouped = groupLayers(document, [title.id, sticker.id]);
  assert.ok(grouped);
  assert.notEqual(grouped.layers[0].groupId, undefined);
  assert.equal(grouped.layers[0].groupId, grouped.layers[1].groupId);
  assert.equal(grouped.layers[2].groupId, undefined);
  assert.equal(grouped.layers.length, 3);
  assert.equal(grouped.layers[0].contentType, "drawing");
  assert.equal(isValidDocument(grouped), true);

  const restored = restoreDocument(JSON.parse(JSON.stringify(grouped)));
  assert.equal(restored.layers[0].groupId, restored.layers[1].groupId);
  assert.equal(isValidDocument(restored), true);
});

test("grouping requires two distinct existing unlocked layers and leaves source unchanged", () => {
  const { document, title, sticker, background } = fixture();
  assert.equal(groupLayers(document, [title.id]), null);
  assert.equal(groupLayers(document, [title.id, title.id]), null);
  assert.equal(groupLayers(document, [title.id, "missing"]), null);
  background.locked = true;
  assert.equal(groupLayers(document, [title.id, background.id]), null);
  title.locked = true;
  assert.equal(groupLayers(document, [title.id, sticker.id]), null);
  assert.equal(document.layers.some(layer => layer.groupId), false);
});

test("ungrouping one member clears membership from every group member", () => {
  const { document, title, sticker, background } = fixture();
  const grouped = groupLayers(document, [title.id, sticker.id]);
  const separated = ungroupLayers(grouped, [title.id]);
  assert.ok(separated);
  assert.equal(separated.layers[0].groupId, undefined);
  assert.equal(separated.layers[1].groupId, undefined);
  assert.equal(separated.layers[2].groupId, undefined);
  assert.equal(separated.layers.length, 3);
  assert.equal(ungroupLayers(separated, [title.id]), null);
});

test("duplicating a grouped layer creates an independent layer, not a hidden group member", () => {
  const { document, title, sticker } = fixture();
  const grouped = groupLayers(document, [title.id, sticker.id]);
  const duplicate = duplicateLayer(grouped, title.id);
  assert.ok(duplicate);
  const newLayer = duplicate.layers.find(layer => layer.id !== title.id && layer.name === title.name + " Copy");
  assert.ok(newLayer);
  assert.equal(newLayer.groupId, undefined);
  assert.equal(duplicate.layers.find(layer => layer.id === title.id).groupId,
    duplicate.layers.find(layer => layer.id === sticker.id).groupId);
});

test("invalid persisted group IDs fail validation and are discarded by normalization", () => {
  const { document, title } = fixture();
  document.layers[0].groupId = "bad group id";
  assert.equal(isValidDocument(document), false);
  const restored = restoreDocument(document);
  assert.equal(restored.layers[0].groupId, undefined);
  assert.equal(isValidDocument(restored), true);
});
