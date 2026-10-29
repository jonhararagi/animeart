import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../domain/model.mjs";
import {
  DESIGN_LIBRARY_LIMIT,
  createDesignMetadata,
  listDesigns,
  normalizeDesignName,
  saveDesign
} from "../domain/design-library.mjs";

test("design names are trimmed, bounded and stripped of control characters", () => {
  assert.equal(normalizeDesignName("  Portada\u0000 Sakura  "), "Portada Sakura");
  assert.equal(normalizeDesignName("  "), "");
  assert.equal(normalizeDesignName("A".repeat(120)).length, 90);
});

test("metadata describes an editable document without storing document pixels in the index", () => {
  const document = createDocument(1080, 1350);
  const metadata = createDesignMetadata({
    id: "design-one",
    name: "  Portada Sakura ",
    document,
    createdAt: 100,
    updatedAt: 200,
    thumbnail: "data:image/webp;base64,abc"
  });
  assert.deepEqual({
    id: metadata.id,
    name: metadata.name,
    width: metadata.width,
    height: metadata.height,
    layerCount: metadata.layerCount,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt
  }, {
    id: "design-one",
    name: "Portada Sakura",
    width: 1080,
    height: 1350,
    layerCount: document.layers.length,
    createdAt: 100,
    updatedAt: 200
  });
  assert.equal(metadata.thumbnail, "data:image/webp;base64,abc");
  assert.equal(Object.hasOwn(metadata, "document"), false);
});

test("metadata rejects an invalid document and empty names", () => {
  assert.throws(() => createDesignMetadata({ name: "Sin lienzo", document: null }), /documento válido/i);
  assert.throws(() => createDesignMetadata({ name: " ", document: createDocument(10, 10) }), /nombre/i);
});

test("library declares a bounded local collection and reports unsupported storage clearly", async () => {
  assert.equal(DESIGN_LIBRARY_LIMIT, 40);
  await assert.rejects(listDesigns({ indexedDBApi: null }), /IndexedDB/i);
  await assert.rejects(saveDesign({ name: "Test", document: createDocument(10, 10) }, { indexedDBApi: null }), /IndexedDB/i);
});
