import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("web entrypoint exists and references the editor", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /AnimeArt Web/);
  assert.match(html, /app\.js/);
});

test("web editor has canvas and local persistence", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /getContext/);
  assert.match(js, /localStorage/);
  assert.match(js, /layers/);
});

test("web editor restores legacy projects through the domain boundary", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /restoreDocument/);
});


test("web interaction keeps viewport, document coordinates and persistence boundaries explicit", async () => {
  const js = await readFile("app.js", "utf8");
  assert.match(js, /screenToDocument\(screenPoint, state\.viewport/);
  assert.match(js, /ctx\.translate\(center\.x \+ state\.viewport\.panX/);
  assert.doesNotMatch(js, /canvas\.style\.transform/);
  assert.match(js, /state\.document\)\);/);
  assert.doesNotMatch(js, /JSON\.stringify\(\{[^}]*viewport/);
  assert.match(js, /event\.pointerId !== state\.drawingPointerId/);
});
