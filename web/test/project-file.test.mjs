import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createImageLayer, createTextLayer } from "../domain/model.mjs";
import { parseProjectFile, serializeProjectFile, PROJECT_FILE_FORMAT } from "../domain/project-file.mjs";

test("project file round-trips document dimensions and editable layers", () => {
  const document = createDocument(1280, 720);
  document.layers = [
    createImageLayer("Background", 32, 24, "data:image/png;base64,aGVsbG8="),
    createTextLayer("Title", { value: "AnimeArt", fontSize: 64, color: "#ffffff" })
  ];
  const encoded = serializeProjectFile(document);
  const decoded = parseProjectFile(encoded);
  assert.equal(decoded.width, 1280);
  assert.equal(decoded.height, 720);
  assert.equal(decoded.layers.length, 2);
  assert.equal(decoded.layers[0].image.source, "data:image/png;base64,aGVsbG8=");
  assert.equal(decoded.layers[1].text.value, "AnimeArt");
});

test("project file rejects malformed JSON, unknown formats and invalid documents", () => {
  assert.throws(() => parseProjectFile("{"), /valid JSON/i);
  assert.throws(() => parseProjectFile(JSON.stringify({ format: "other", formatVersion: 1, document: {} })), /Unsupported/i);
  assert.throws(() => serializeProjectFile({ version: 2, width: -1, height: 10, layers: [] }), /invalid document|dimensions/i);
});

test("project file enforces dimensions, layer count and file-size safety limits", () => {
  const oversized = createDocument(9000, 9000);
  assert.throws(() => serializeProjectFile(oversized), /dimensions|megapixel/i);
  const tooManyLayers = createDocument(100, 100);
  tooManyLayers.layers = Array.from({ length: 201 }, (_, i) => ({ ...createDocument(1,1).layers[0], id: "layer-" + i }));
  assert.throws(() => serializeProjectFile(tooManyLayers), /200 layers/i);
  assert.throws(() => parseProjectFile(" ".repeat(2_500_001)), /2.5 MB/i);
  assert.equal(PROJECT_FILE_FORMAT, "animeart-project");
});
