import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KapiArt anime color studio wires the offline palette, wand and non-destructive layer split", async () => {
  const [html, app, worker, engine, styleLibrary] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("domain/anime-color-studio.mjs", "utf8"),
    readFile("domain/anime-style-library.mjs", "utf8")
  ]);
  for (const id of [
    "recolor-wand-toggle", "recolor-wand-tolerance", "recolor-wand-add",
    "recolor-wand-clear", "recolor-split-layer", "recolor-rectangle-toggle", "recolor-effect-layer", "anime-color-search",
    "anime-color-results", "anime-color-more", "recolor-target-color", "recolor-temperature", "recolor-darkness", "recolor-hue-shift"
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(app, /generateAnimePalette\(\)/);
  assert.match(app, /selectAnimeRegion\(/);
  assert.match(app, /selectAnimeRectangle\(/);
  assert.match(app, /pointerdown/);
  assert.match(app, /combineAnimeRegionSelections\(/);
  assert.match(app, /async function splitAnimeSelectionIntoLayer\(/);
  assert.match(app, /Efecto de color · /);
  assert.match(app, /recolorCanvasPointFromClient/);
  assert.match(html, /id="erase-color-effect"/);
  assert.match(worker, /animeart-web-shell-v75/);
  assert.match(worker,/anime-style-library\.mjs/);
  assert.match(styleLibrary,/export function createAnimeStyleComponentSvg/);
  assert.ok(worker.includes("./domain/anime-color-studio.mjs"));
  assert.match(engine, /Selects a contiguous flat-color region/);
  assert.match(engine, /export function selectAnimeRectangle/);
  assert.doesNotMatch(engine, /https?:\/\//i, "the core color engine must stay local-only");
});
