import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument, createImageLayer, isValidCharacterComposition, isValidDocument,
  normalizeDocument, normalizeCharacterComposition, restoreDocument
} from "../domain/model.mjs";

const metadata = {
  groupId: "group-001",
  variantIndex: 2,
  part: "hairBack",
  componentIds: { eyes: "eyes-round-glossy", hair: "hair-twin-tails", face: "face-oval-balanced" },
  colors: { hair: "#bb5533", eyes: "#0099cc", skin: "#f0c2b0", line: "#332211" },
  presetId: "set-001"
};

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

test("character metadata is validated, kept on image layers, and survives project restore", () => {
  assert.equal(isValidCharacterComposition(metadata), true);
  const doc = createDocument(640, 480);
  const layer = createImageLayer("Personaje anime V2 · Cabello base", 256, 256, "data:image/svg+xml;base64,AA==");
  layer.characterComposition = metadata;
  doc.layers.push(layer);
  assert.equal(isValidDocument(doc), true);
  const restored = restoreDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(restored.layers[1].characterComposition, metadata);
  assert.deepEqual(normalizeDocument(restored).layers[1].characterComposition, metadata);
});

test("malformed character metadata cannot silently validate as a normal image layer", () => {
  const doc = createDocument(100, 100);
  const image = createImageLayer("Bad character metadata");
  image.characterComposition = { ...metadata, variantIndex: 10 };
  doc.layers.push(image);
  assert.equal(isValidDocument(doc), false);
  assert.equal(normalizeCharacterComposition({ ...metadata, colors: { ...metadata.colors, hair: "url(https://bad)" } }), null);
});

test("legacy image layers without character metadata remain valid", () => {
  const doc = createDocument(100, 100);
  doc.layers.push(createImageLayer("Legacy image"));
  assert.equal(isValidDocument(doc), true);
  assert.equal(restoreDocument(JSON.parse(JSON.stringify(doc))).layers[1].characterComposition, undefined);
});
