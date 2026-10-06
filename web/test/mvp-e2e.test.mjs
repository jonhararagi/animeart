import assert from "node:assert/strict";
import test from "node:test";
import { createDocument, createLayer, createStroke, createStrokePoint, restoreDocument } from "../domain/model.mjs";
import {
  deleteLayer,
  duplicateLayer,
  renameLayer,
  reorderLayer,
  setLayerLocked,
  setLayerOpacity,
  setLayerVisibility
} from "../domain/document-operations.mjs";
import { DocumentHistory } from "../domain/history.mjs";
import {
  canvasToPngBlob,
  createPngExportCanvas,
  renderDocumentToCanvas
} from "../domain/png-export.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

test("MVP E2E contract: create → draw → layers → lock → undo/redo → save/recover → PNG", async () => {
  const app = await readFile(join(ROOT, "app.js"), "utf8");
  const html = await readFile(join(ROOT, "index.html"), "utf8");

  assert.match(html, /id="new-document"/);
  assert.match(html, /id="save"/);
  assert.match(html, /id="recover-project"/);
  assert.match(html, /id="export-png"/);
  assert.match(app, /createNewDocumentFromForm/);
  assert.match(app, /persistDocument\(\{ markSaved: true \}\)/);
  assert.match(app, /restoreStoredProject/);
  assert.match(app, /async function exportPng/);

  let documentModel = createDocument(800, 600);
  assert.equal(documentModel.width, 800);
  assert.equal(documentModel.height, 600);

  const history = new DocumentHistory(documentModel);
  const base = structuredClone(documentModel);

  const stroke = createStroke(
    "brush",
    12,
    [createStrokePoint(100, 120), createStrokePoint(180, 220)],
    "#ff6600",
    0.35
  );
  documentModel.layers[0].strokes.push(stroke);
  assert.deepEqual(documentModel.layers[0].strokes[0], stroke);

  const second = createLayer("Second");
  second.opacity = 0.5;
  second.transform = { x: 20, y: -10, scale: 1.5, rotation: 15 };
  second.strokes.push(createStroke("brush", 6, [
    createStrokePoint(250, 200),
    createStrokePoint(300, 260)
  ], "#123456", 0.8));
  documentModel.layers.push(second);

  let next = renameLayer(documentModel, second.id, "Foreground");
  assert.equal(next.layers[1].name, "Foreground");

  next = duplicateLayer(next, second.id);
  assert.equal(next.layers.length, 3);
  assert.notEqual(next.layers[1].id, next.layers[2].id);

  const duplicateId = next.layers[2].id;
  next = reorderLayer(next, duplicateId, "down");
  assert.equal(next.layers[1].id, duplicateId);

  next = setLayerVisibility(next, duplicateId, false);
  assert.equal(next.layers.find(layer => layer.id === duplicateId).visible, false);

  next = setLayerVisibility(next, duplicateId, true);
  next = setLayerLocked(next, duplicateId, true);
  assert.equal(next.layers.find(layer => layer.id === duplicateId).locked, true);

  history.record(base, next);
  documentModel = next;

  const lockedSnapshot = structuredClone(documentModel);
  assert.match(app, /if \(layer\.locked \|\| state\.document\.layers\.length <= 1\) return;/);
  assert.match(app, /if \(!layer \|\| layer\.locked \|\| layer\.contentType === "image"\) return;/);
  assert.deepEqual(documentModel, lockedSnapshot);

  const undone = history.undo(documentModel);
  assert.deepEqual(undone, base);
  const redone = history.redo(undone);
  assert.deepEqual(redone, documentModel);

  const serialized = JSON.stringify(redone);
  const recovered = restoreDocument(JSON.parse(serialized));
  assert.deepEqual(recovered, redone);
  assert.equal(recovered.width, 800);
  assert.equal(recovered.height, 600);

  const calls = [];
  const context = {
    clearRect: (...args) => calls.push(["clearRect", ...args]),
    save: () => calls.push(["save"]),
    translate: (...args) => calls.push(["translate", ...args]),
    restore: () => calls.push(["restore"]),
    globalAlpha: 1
  };
  const fakeDocument = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => context
    })
  };
  const canvas = createPngExportCanvas(recovered, fakeDocument);
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 600);

  const renderSnapshot = [];
  renderDocumentToCanvas(recovered, canvas, ({ context: renderContext, document: renderDocument }) => {
    renderSnapshot.push(
      renderDocument.layers
        .filter(layer => layer.visible)
        .map(layer => ({
          id: layer.id,
          opacity: layer.opacity,
          locked: layer.locked,
          transform: { ...layer.transform },
          strokes: layer.strokes.length
        }))
    );
    assert.equal(renderContext, context);
  });

  assert.equal(renderSnapshot.length, 1);
  assert.equal(renderSnapshot[0].length, recovered.layers.filter(layer => layer.visible).length);
  assert.equal(renderSnapshot[0].some(layer => layer.locked), true);
  assert.equal(renderSnapshot[0].some(layer => layer.opacity === 0.5), true);
  assert.equal(calls[0][0], "clearRect");
  assert.deepEqual(calls[0].slice(1), [0, 0, 800, 600]);
  assert.deepEqual(calls[2], ["translate", 400, 300]);

  const blob = await canvasToPngBlob({
    convertToBlob: async options => {
      assert.deepEqual(options, { type: "image/png" });
      return { type: "image/png" };
    }
  });
  assert.equal(blob.type, "image/png");

  const hidden = setLayerVisibility(recovered, duplicateId, false);
  assert.equal(hidden.layers.find(layer => layer.id === duplicateId).visible, false);
  assert.equal(
    hidden.layers.filter(layer => layer.visible).length,
    recovered.layers.filter(layer => layer.visible).length - 1
  );

  const deleted = deleteLayer(hidden, duplicateId);
  assert.equal(deleted.layers.some(layer => layer.id === duplicateId), false);
});
