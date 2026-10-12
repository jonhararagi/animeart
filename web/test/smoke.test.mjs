import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("T043 document mutations use existing domain operations for completed layer lifecycle changes", async () => {
  const js = await readFile("app.js", "utf8");
  const operations = await readFile("domain/document-operations.mjs", "utf8");
  assert.match(js, /import \{[^}]*addLayer[^}]*clearLayer[^}]*\} from "\.\/domain\/document-operations.mjs"/);
  assert.match(js, /const next = addLayer\(state\.document, layer\)/);
  assert.match(js, /const next = clearLayer\(state\.document, layer\.id\)/);
  assert.match(operations, /export function addLayer\(/);
  assert.match(operations, /export function clearLayer\(/);
  assert.doesNotMatch(js, /state\.document\.layers\.push\(layer\)/);
  assert.doesNotMatch(js, /layer\.strokes = \[\]/);
  assert.doesNotMatch(js, /AddLayerManager|LayerMutationManager|DocumentMutationManager/);
});

test("T042 architecture uses existing Image Layer and forbids parallel reference systems", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = join(import.meta.dirname, "..");
  const app = await readFile(join(root, "app.js"), "utf8");
  const model = await readFile(join(root, "domain/model.mjs"), "utf8");
  const operations = await readFile(join(root, "domain/document-operations.mjs"), "utf8");
  assert.match(app, /setLayerReference/);
  assert.match(app, /isReference/);
  assert.match(model, /isReference/);
  assert.match(operations, /export function setLayerReference/);
  assert.doesNotMatch(app + model + operations, /ReferenceImageStore|ReferenceRenderer|ReferenceHistory|ReferencePersistence|ReferenceDocument|ReferenceLayerManager/);
});

test("web entrypoint exists, identifies AnimeArt Studio, and references the editor module", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /AnimeArt Studio \| Image Editor/);
  assert.match(html, /app\.js/);
});

test("web editor has canvas, local persistence, and history controls", async () => {
  const html = await readFile("index.html", "utf8");
  const js = await readFile("app.js", "utf8");
  assert.match(js, /getContext/);
  assert.match(js, /localStorage/);
  assert.match(js, /layers/);
  assert.match(html, /id="undo"/);
  assert.match(html, /id="redo"/);
  assert.match(js, /DocumentHistory/);
  assert.match(js, /history\.record/);
  assert.match(js, /history\.undo/);
  assert.match(js, /history\.redo/);
});

test("web editor restores legacy projects through the domain boundary", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /restoreDocument/);
});
