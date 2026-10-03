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
