import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DOCUMENT_STORAGE_CHARS,
  MAX_IMAGE_SOURCE_CHARS,
  MAX_IMPORT_FILE_BYTES,
  createImportedImageLayer,
  decodeImageSource,
  imageLayerName,
  importImageFile,
  persistDocumentSnapshot,
  readFileAsDataUrl,
  serializeDocumentForStorage,
  validateImageFile
} from "../domain/image-import.mjs";
import { createDocument, restoreDocument } from "../domain/model.mjs";
import { DocumentHistory } from "../domain/history.mjs";
import { layerLocalBounds } from "../domain/selection.mjs";

class FakeReader {
  static result = "data:image/svg+xml,<svg width='17' height='11'></svg>";
  readAsDataURL() {
    this.result = FakeReader.result;
    queueMicrotask(() => this.onload?.());
  }
}

class FakeImage {
  constructor() {
    this.naturalWidth = 17;
    this.naturalHeight = 11;
  }
  set src(value) {
    this.value = value;
    queueMicrotask(() => this.onload?.());
  }
}

class InvalidImage {
  set src(value) {
    queueMicrotask(() => this.onerror?.());
  }
}

test("image import constants are explicit and conservative", () => {
  assert.equal(MAX_IMPORT_FILE_BYTES, 1_500_000);
  assert.equal(MAX_IMAGE_SOURCE_CHARS, 2_000_000);
  assert.equal(MAX_DOCUMENT_STORAGE_CHARS, 2_500_000);
});

test("image filename becomes a useful layer name", () => {
  assert.equal(imageLayerName("asuna.png"), "asuna");
  assert.equal(imageLayerName("photo.final.webp"), "photo.final");
  assert.equal(imageLayerName(""), "Image");
});

test("invalid non-image file is rejected before decode", () => {
  assert.throws(() => validateImageFile({ name: "notes.txt", type: "text/plain", size: 10 }), /not a supported image/);
});

test("oversized file is rejected before persistence", () => {
  assert.throws(() => validateImageFile({ name: "large.png", type: "image/png", size: MAX_IMPORT_FILE_BYTES + 1 }), /too large/);
});

test("cancelled file selection is a no-op at the validation boundary", () => {
  assert.throws(() => validateImageFile(undefined), /No image file selected/);
});

test("File API boundary converts a deterministic File-like object to data URL", async () => {
  const source = await readFileAsDataUrl({ name: "fixture.svg", type: "image/svg+xml", size: 10 }, FakeReader);
  assert.match(source, /^data:image\/svg\+xml/);
});

test("browser image boundary returns real decoded dimensions", async () => {
  const dimensions = await decodeImageSource("data:image/svg+xml,<svg width='17' height='11'></svg>", FakeImage);
  assert.deepEqual(dimensions, { width: 17, height: 11 });
});

test("decode failure does not create an Image Layer", async () => {
  await assert.rejects(
    () => decodeImageSource("data:image/invalid", InvalidImage),
    /could not be decoded/
  );
});

test("import flow creates the existing Image Layer contract", async () => {
  const result = await importImageFile(
    { name: "asuna.png", type: "image/png", size: 100 },
    { Reader: FakeReader, ImageCtor: FakeImage }
  );
  assert.equal(result.layer.contentType, "image");
  assert.equal(result.layer.name, "asuna");
  assert.equal(result.layer.image.source, result.source);
  assert.equal(result.layer.image.width, 17);
  assert.equal(result.layer.image.height, 11);
  assert.deepEqual(layerLocalBounds(result.layer), { minX: 0, minY: 0, maxX: 17, maxY: 11 });
});

test("invalid dimensions are rejected", () => {
  assert.throws(() => createImportedImageLayer("bad.png", "data:image/png;base64,AA==", 0, 11), /invalid dimensions/);
});

test("image source over the application limit is rejected", () => {
  assert.throws(
    () => createImportedImageLayer("large.png", "x".repeat(MAX_IMAGE_SOURCE_CHARS + 1), 10, 10),
    /localStorage import limit/
  );
});

test("serialization limit is checked before storage mutation", () => {
  const storage = {
    calls: 0,
    setItem() { this.calls += 1; }
  };
  const document = { huge: "x".repeat(MAX_DOCUMENT_STORAGE_CHARS) };
  assert.throws(() => serializeDocumentForStorage(document), /storage limit/);
  assert.throws(() => persistDocumentSnapshot(storage, "doc", document), /storage limit/);
  assert.equal(storage.calls, 0);
});

test("storage failure is reported without hiding the error", () => {
  const storage = { setItem() { throw new Error("quota"); } };
  assert.throws(
    () => persistDocumentSnapshot(storage, "doc", createDocument()),
    /could not be saved in localStorage/
  );
});

test("import is one logical history operation and survives serialize/restore", async () => {
  const before = createDocument(400, 300);
  const { layer } = await importImageFile(
    { name: "fixture.webp", type: "image/webp", size: 100 },
    { Reader: FakeReader, ImageCtor: FakeImage }
  );
  const after = structuredClone(before);
  after.layers.push(layer);
  const history = new DocumentHistory(before);
  assert.equal(history.record(before, after), true);
  assert.equal(history.size(), 1);

  const undone = history.undo(after);
  assert.equal(undone.layers.length, 1);
  const redone = history.redo(undone);
  assert.equal(redone.layers[1].contentType, "image");

  const restored = restoreDocument(JSON.parse(JSON.stringify(redone)));
  assert.deepEqual(restored.layers[1].image, redone.layers[1].image);
  assert.deepEqual(restored.layers[1].transform, redone.layers[1].transform);
  assert.equal(restored.layers[1].visible, true);
  assert.equal(restored.layers[1].opacity, 1);
});
