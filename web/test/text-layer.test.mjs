import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument, createTextLayer, isValidDocument, normalizeDocument } from "../domain/model.mjs";
import { setLayerText } from "../domain/document-operations.mjs";
import { estimateTextLayerBounds, isValidTextLayer, normalizeTextLayer } from "../domain/text-layer.mjs";
import { DocumentHistory, cloneDocument } from "../domain/history.mjs";

test("text layer normalizes bounded typography and rejects unsafe font or color values", () => {
  assert.deepEqual(normalizeTextLayer({
    value: "line one\r\nline two",
    x: 12,
    y: 30,
    fontSize: 900,
    fontFamily: "url(javascript:alert(1))",
    fontWeight: "heavy",
    color: "red",
    align: "justify"
  }), {
    value: "line one\nline two",
    x: 12,
    y: 30,
    fontSize: 240,
    fontFamily: "Arial",
    fontWeight: "bold",
    color: "#172335",
    align: "left",
    outlineColor: "#ffffff",
    outlineWidth: 0,
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0
  });
  assert.equal(isValidTextLayer(normalizeTextLayer({ value: "AnimeArt", fontSize: 36 })), true);
  assert.equal(isValidTextLayer({ ...normalizeTextLayer(), color: "red" }), false);
  assert.equal(isValidTextLayer({ ...normalizeTextLayer(), fontFamily: "url(x)" }), false);
});

test("text layers survive document normalization and strict validation", () => {
  const document = createDocument(800, 600);
  document.layers.push(createTextLayer("Title", {
    value: "AnimeArt Studio",
    x: 90,
    y: 260,
    fontSize: 68,
    fontFamily: "Georgia",
    fontWeight: "bold",
    color: "#245578",
    align: "center"
  }));
  const restored = normalizeDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(restored.layers[1].contentType, "text");
  assert.deepEqual(restored.layers[1].text, document.layers[1].text);
  assert.equal(isValidDocument(restored), true);

  const malformed = JSON.parse(JSON.stringify(restored));
  malformed.layers[1].text.fontSize = 500;
  assert.equal(isValidDocument(malformed), false);
  assert.equal(isValidDocument(cloneDocument(restored)), true);
});

test("setLayerText is immutable, preserves layer identity and clamps text properties", () => {
  const document = createDocument(640, 480);
  const textLayer = createTextLayer("Caption", { value: "Before", fontSize: 40 });
  document.layers.push(textLayer);
  const updated = setLayerText(document, textLayer.id, { value: "After", fontSize: 500, color: "#0088aa" });

  assert.ok(updated);
  assert.equal(document.layers[1].text.value, "Before");
  assert.equal(updated.layers[1].id, textLayer.id);
  assert.equal(updated.layers[1].text.value, "After");
  assert.equal(updated.layers[1].text.fontSize, 240);
  assert.equal(updated.layers[1].text.color, "#0088aa");
  assert.equal(updated.layers[0].name, document.layers[0].name);
  assert.equal(setLayerText(document, document.layers[0].id, { value: "wrong layer" }), null);
  assert.equal(setLayerText(document, textLayer.id, null), null);
});

test("text bounds account for multiline text and alignment for layer selection", () => {
  const left = estimateTextLayerBounds({ value: "A\nLonger line", x: 100, y: 90, fontSize: 20, align: "left" });
  const centered = estimateTextLayerBounds({ value: "A\nLonger line", x: 100, y: 90, fontSize: 20, align: "center" });
  const right = estimateTextLayerBounds({ value: "A\nLonger line", x: 100, y: 90, fontSize: 20, align: "right" });
  assert.equal(left.minX, 100);
  assert.ok(centered.minX < left.minX);
  assert.ok(right.minX < centered.minX);
  assert.ok(left.maxY > left.minY + 20);
});

test("text edits participate in History and use the existing non-destructive PNG renderer", async () => {
  const app = await readFile("app.js", "utf8");
  const exporter = await readFile("domain/png-export.mjs", "utf8");
  assert.match(app, /layer\.contentType === "text"/);
  assert.match(app, /context\.fillText\(line, previewText\.x, previewText\.y \+ index \* lineHeight\)/);
  assert.match(app, /state\.history\.record\(before, next\)/);
  assert.match(app, /persistDocument\(\)/);
  assert.match(app, /renderDocumentToCanvas\(state\.document, exportCanvas/);
  assert.match(exporter, /renderDocument\(\{ context, document: documentModel, center \}\)/);

  const initial = createDocument(320, 240);
  const title = createTextLayer("Title", { value: "Before" });
  const withText = { ...initial, layers: [...initial.layers, title] };
  const history = new DocumentHistory(withText);
  const changed = setLayerText(withText, title.id, { value: "After" });
  history.record(cloneDocument(withText), changed);
  assert.equal(history.undo(changed).layers[1].text.value, "Before");
  assert.equal(history.redo(withText).layers[1].text.value, "After");
});

test("outlined and shadowed typography is normalized and validated", () => {
  const layer = createTextLayer("Headline", { value: "COMIC!", fontFamily: "Impact", outlineColor: "#111111", outlineWidth: 6, shadowColor: "#ff00cc", shadowBlur: 14, shadowOffsetX: 3, shadowOffsetY: 4 });
  assert.equal(isValidTextLayer(layer.text), true);
  assert.equal(layer.text.outlineWidth, 6);
  assert.equal(layer.text.shadowBlur, 14);
  assert.equal(isValidTextLayer({ ...layer.text, outlineWidth: 99 }), false);
});
