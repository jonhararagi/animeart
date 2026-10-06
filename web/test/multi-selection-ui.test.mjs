import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Web UI keeps one selection boundary and adds additive Shift selection", () => {
  assert.match(app, /selectedLayerIds/);
  assert.match(app, /event\.shiftKey/);
  assert.match(app, /toggleLayerSelection/);
  assert.match(app, /translateLayers/);
  assert.doesNotMatch(app, /selectedLayerIds\s*=\s*state\.document\.layers/);
});

test("multi-layer movement commits through the existing DocumentHistory", () => {
  assert.match(app, /applyMultiLayerMove/);
  assert.match(app, /state\.history\.record\(before, next\)/);
  assert.match(app, /persistDocument\(\)/);
});

test("PNG export control is unique", () => {
  const matches = index.match(/id="export-png"/g) || [];
  assert.equal(matches.length, 1);
});
