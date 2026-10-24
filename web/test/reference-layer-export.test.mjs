import test from "node:test";
import assert from "node:assert/strict";
import { renderDocumentToCanvas } from "../domain/png-export.mjs";

function stubCanvas() {
  const context = {
    clearRect() {},
    save() {},
    restore() {}
  };
  return { width: 320, height: 240, getContext: () => context };
}

test("reference layers remain editable but are excluded from flattened image exports", () => {
  const original = {
    width: 320, height: 240,
    layers: [
      { id: "ref-eyes", contentType: "image", isReference: true },
      { id: "character", contentType: "image", isReference: false },
      { id: "line-art", contentType: "drawing" }
    ]
  };
  const canvas = stubCanvas();
  let exportDocument;
  renderDocumentToCanvas(original, canvas, ({ document }) => { exportDocument = document; });
  assert.deepEqual(exportDocument.layers.map(layer => layer.id), ["character", "line-art"]);
  assert.notEqual(exportDocument, original);
  assert.equal(original.layers.length, 3, "export must not mutate the editable document");
});

test("documents without reference layers keep the original render input", () => {
  const original = { width: 64, height: 64, layers: [{ id: "paint", isReference: false }] };
  let renderInput;
  renderDocumentToCanvas(original, stubCanvas(), ({ document }) => { renderInput = document; });
  assert.equal(renderInput, original);
});
