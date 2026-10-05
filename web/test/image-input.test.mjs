import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  applyImageFileImport,
  importImageFile,
  persistDocumentSnapshot
} from "../domain/image-import.mjs";
import { clipboardImageFile, firstValidImageFile } from "../domain/image-input.mjs";
import { createDocument, restoreDocument } from "../domain/model.mjs";
import { DocumentHistory } from "../domain/history.mjs";

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

class InvalidReader {
  readAsDataURL() {
    queueMicrotask(() => this.onerror?.());
  }
}

class InvalidImage {
  set src(value) {
    queueMicrotask(() => this.onerror?.());
  }
}

function file(name = "asuna.png", type = "image/png", size = 100) {
  return { name, type, size };
}

function createRedoState() {
  const initial = createDocument(400, 300);
  const first = structuredClone(initial);
  first.layers[0].name = "First";
  const second = structuredClone(first);
  second.layers[0].name = "Second";
  const history = new DocumentHistory(initial);
  history.record(initial, first);
  history.record(first, second);
  const current = history.undo(second);
  return { initial, first, second, current, history };
}

test("drop selects the first valid image and reuses the existing validator", () => {
  const selected = firstValidImageFile([
    file("notes.txt", "text/plain"),
    file("asuna.png")
  ]);
  assert.deepEqual(selected, file("asuna.png"));
});

test("drop with no files is a no-op", () => {
  assert.equal(firstValidImageFile(undefined), null);
  assert.equal(firstValidImageFile([]), null);
});

test("drop rejects files when no image is valid", () => {
  assert.equal(firstValidImageFile([file("notes.txt", "text/plain")]), null);
});

test("drop with multiple files imports only the first valid image", () => {
  const selected = firstValidImageFile([
    file("notes.txt", "text/plain"),
    file("asuna.png"),
    file("other.webp", "image/webp")
  ]);
  assert.equal(selected.name, "asuna.png");
});

test("clipboard selects an image item and ignores text items", () => {
  const image = file("clipboard.png");
  const items = [
    { type: "text/plain", getAsFile: () => null },
    { type: "image/png", getAsFile: () => image }
  ];
  assert.equal(clipboardImageFile(items), image);
});

test("clipboard with no image does not produce a File", () => {
  assert.equal(clipboardImageFile([{ type: "text/plain", getAsFile: () => null }]), null);
  assert.equal(clipboardImageFile(undefined), null);
});

test("clipboard skips an image item whose getAsFile returns null", () => {
  const image = file("second.png");
  const items = [
    { type: "image/png", getAsFile: () => null },
    { type: "image/png", getAsFile: () => image }
  ];
  assert.equal(clipboardImageFile(items), image);
});

test("clipboard ignores malformed items without getAsFile", () => {
  assert.equal(clipboardImageFile([{ type: "image/png" }]), null);
});

test("shared import transaction creates one history operation and supports undo/redo", async () => {
  const before = createDocument(400, 300);
  const history = new DocumentHistory(before);
  let persisted = null;
  const result = await applyImageFileImport(file("picker.png"), {
    document: before,
    history,
    persist: next => { persisted = structuredClone(next); },
    Reader: FakeReader,
    ImageCtor: FakeImage
  });
  assert.equal(result.layer.contentType, "image");
  assert.equal(result.document.layers.length, 2);
  assert.equal(history.size(), 1);
  assert.deepEqual(persisted, result.document);
  const undone = history.undo(result.document);
  assert.equal(undone.layers.length, 1);
  const redone = history.redo(undone);
  assert.equal(redone.layers[1].contentType, "image");
});

test("picker import persistence failure preserves document, history and redo", async () => {
  const { initial, second, current, history } = createRedoState();
  const historySize = history.size();
  const storage = { setItem() { throw new Error("quota"); } };
  await assert.rejects(
    () => applyImageFileImport(file("picker-failed.png"), {
      document: current,
      history,
      persist: next => persistDocumentSnapshot(storage, "doc", next),
      Reader: FakeReader,
      ImageCtor: FakeImage
    }),
    /could not be saved/
  );
  assert.deepEqual(current, restoreDocument(JSON.parse(JSON.stringify(current))));
  assert.equal(current.layers.some(layer => layer.name === "picker-failed"), false);
  assert.equal(history.size(), historySize);
  assert.equal(history.canRedo(), true);
  assert.deepEqual(history.redo(current), second);
  assert.deepEqual(history.undo(second), current);
  assert.deepEqual(history.undo(current), initial);
});

test("drop import persistence failure preserves document and history", async () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  const dropped = firstValidImageFile([file("drop.png")]);
  const storage = { setItem() { throw new Error("quota"); } };
  await assert.rejects(
    () => applyImageFileImport(dropped, {
      document: before,
      history,
      persist: next => persistDocumentSnapshot(storage, "doc", next),
      Reader: FakeReader,
      ImageCtor: FakeImage
    }),
    /could not be saved/
  );
  assert.equal(before.layers.length, 1);
  assert.equal(history.size(), 0);
  assert.equal(history.canRedo(), false);
});

test("clipboard import persistence failure preserves document and history", async () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  const pasted = clipboardImageFile([{ type: "image/png", getAsFile: () => file("paste.png") }]);
  const storage = { setItem() { throw new Error("quota"); } };
  await assert.rejects(
    () => applyImageFileImport(pasted, {
      document: before,
      history,
      persist: next => persistDocumentSnapshot(storage, "doc", next),
      Reader: FakeReader,
      ImageCtor: FakeImage
    }),
    /could not be saved/
  );
  assert.equal(before.layers.some(layer => layer.name === "paste"), false);
  assert.equal(history.size(), 0);
  assert.equal(history.canRedo(), false);
});

test("invalid drop never reaches the import transaction", () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  assert.equal(firstValidImageFile([file("bad.txt", "text/plain")]), null);
  assert.equal(history.size(), 0);
  assert.equal(before.layers.length, 1);
});

test("invalid clipboard image is rejected by the existing import validator", async () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  const pasted = clipboardImageFile([{ type: "image/png", getAsFile: () => file("bad.png", "image/png", 1_500_001) }]);
  await assert.rejects(
    () => applyImageFileImport(pasted, {
      document: before,
      history,
      persist: () => {},
      Reader: FakeReader,
      ImageCtor: FakeImage
    }),
    /too large/
  );
  assert.equal(history.size(), 0);
  assert.equal(before.layers.length, 1);
});

test("clipboard decode failure leaves document and history untouched", async () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  const pasted = clipboardImageFile([{ type: "image/png", getAsFile: () => file("broken.png") }]);
  await assert.rejects(
    () => applyImageFileImport(pasted, {
      document: before,
      history,
      persist: () => {},
      Reader: FakeReader,
      ImageCtor: InvalidImage
    }),
    /could not be decoded/
  );
  assert.equal(history.size(), 0);
  assert.equal(history.canRedo(), false);
  assert.equal(before.layers.length, 1);
});

test("existing image import decoder path remains unchanged", async () => {
  const result = await importImageFile(file("regression.webp", "image/webp"), {
    Reader: FakeReader,
    ImageCtor: FakeImage
  });
  assert.equal(result.layer.image.width, 17);
  assert.equal(result.layer.image.height, 11);
  assert.equal(result.layer.name, "regression");
});

test("picker, drop and clipboard handlers converge on one editor import function", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /imageFileInput\.addEventListener\("change"[\s\S]*?importImageIntoEditor\(file\)/);
  assert.match(app, /canvas\.addEventListener\("drop"[\s\S]*?firstValidImageFile[\s\S]*?importImageIntoEditor\(file\)/);
  assert.match(app, /document\.addEventListener\("paste"[\s\S]*?clipboardImageFile[\s\S]*?importImageIntoEditor\(file\)/);
});

test("drag lifecycle has explicit browser navigation protection and feedback cleanup", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /canvas\.addEventListener\("dragenter"/);
  assert.match(app, /canvas\.addEventListener\("dragover"[\s\S]*?event\.preventDefault\(\)/);
  assert.match(app, /canvas\.addEventListener\("dragleave"/);
  assert.match(app, /canvas\.addEventListener\("dragend"[\s\S]*?clearDropFeedback/);
  assert.match(app, /canvas\.addEventListener\("drop"[\s\S]*?event\.preventDefault\(\)[\s\S]*?clearDropFeedback/);
});

test("clipboard read failure leaves document and history untouched", async () => {
  const before = createDocument();
  const history = new DocumentHistory(before);
  const pasted = clipboardImageFile([{ type: "image/png", getAsFile: () => file("unreadable.png") }]);
  await assert.rejects(
    () => applyImageFileImport(pasted, {
      document: before,
      history,
      persist: () => {},
      Reader: InvalidReader,
      ImageCtor: FakeImage
    }),
    /could not read/
  );
  assert.equal(history.size(), 0);
  assert.equal(before.layers.length, 1);
});
