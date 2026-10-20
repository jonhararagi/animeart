import test from "node:test";
import assert from "node:assert/strict";
import { replaceColorRange } from "../domain/color-replacement.mjs";
import {
  ANIME_COLOR_PRESETS,
  combineAnimeSelections,
  countAnimeSelection,
  generateAnimePalette,
  searchAnimeColors,
  selectAnimeRegion
} from "../domain/anime-color-studio.mjs";

function image(width, height, pixels) {
  return { width, height, data: new Uint8ClampedArray(pixels.flat()) };
}

test("anime palette contains thousands of distinct local colors without bitmap assets", () => {
  const palette = generateAnimePalette();
  assert.ok(palette.length >= 2000);
  assert.ok(new Set(palette.map(color => color.hex)).size >= 2000);
  assert.ok(palette.every(color => /^#[0-9A-F]{6}$/.test(color.hex)));
});

test("named color search understands Spanish hair color queries", () => {
  assert.equal(searchAnimeColors("marrón claro")[0].name, "Marrón claro");
  assert.ok(searchAnimeColors("rubio miel").some(color => color.hex === "#D8A747"));
  assert.ok(searchAnimeColors("castaño").length > 0);
  assert.ok(ANIME_COLOR_PRESETS.length >= 40);
});

test("anime wand selects only a connected flat-color region and preserves disconnected islands", () => {
  const fill = [128, 64, 32, 255];
  const line = [24, 20, 24, 255];
  const clear = [0, 0, 0, 0];
  const source = image(5, 3, [
    ...fill, ...fill, ...line, ...fill, ...fill,
    ...fill, ...fill, ...line, ...clear, ...fill,
    ...line, ...line, ...line, ...fill, ...fill
  ]);
  const result = selectAnimeRegion(source, { x: 0, y: 0, tolerance: 0, protectLineArt: true });
  assert.equal(result.pixelCount, 4);
  assert.deepEqual(result.bounds, { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(result.mask[0], 255);
  assert.equal(result.mask[3], 0);
  assert.equal(result.mask[14], 0);
});

test("anime wand treats dark line art as a boundary around a brighter fill", () => {
  const fill = [190, 80, 65, 255];
  const line = [18, 15, 20, 255];
  const source = image(3, 3, [
    ...line, ...line, ...line,
    ...line, ...fill, ...line,
    ...line, ...line, ...line
  ]);
  const result = selectAnimeRegion(source, { x: 1, y: 1, tolerance: 255, protectLineArt: true });
  assert.equal(result.pixelCount, 1);
  assert.deepEqual(result.bounds, { x: 1, y: 1, width: 1, height: 1 });
});

test("transparent pixels cannot be selected and taps outside the image are rejected", () => {
  const source = image(2, 1, [[0, 0, 0, 0], [30, 30, 30, 255]]);
  assert.equal(selectAnimeRegion(source, { x: 0, y: 0 }).pixelCount, 0);
  assert.throws(() => selectAnimeRegion(source, { x: 3, y: 0 }), /inside the image/i);
});

test("anime selection masks can add regions and clear pixels with a bounded typed array", () => {
  const first = new Uint8Array([255, 0, 255, 0]);
  const second = new Uint8Array([0, 255, 255, 0]);
  assert.deepEqual([...combineAnimeSelections(first, second, "add")], [255, 255, 255, 0]);
  assert.deepEqual([...combineAnimeSelections(first, second, "subtract")], [255, 0, 0, 0]);
  assert.equal(countAnimeSelection(combineAnimeSelections(first, second)), 3);
});

test("masked anime recolor changes only the selected region and lifts black hair into the chosen hue", () => {
  const source = { width: 3, height: 1, data: new Uint8ClampedArray([
    12, 10, 15, 255,
    12, 10, 15, 255,
    255, 255, 255, 128
  ]) };
  const before = [...source.data];
  const result = replaceColorRange(source, {
    sourceColor: "#0C0A0F", targetColor: "#C62845",
    selectionMask: new Uint8Array([255, 0, 255]), animeRecolor: true,
    preserveShading: true
  });
  assert.notDeepEqual([...result.data.slice(0, 3)], before.slice(0, 3));
  assert.deepEqual([...result.data.slice(4, 8)], before.slice(4, 8));
  assert.ok(result.data[0] > result.data[1], "the dark selected pixel should take on the red hue");
  assert.equal(result.data[3], 255);
  assert.equal(result.data[11], 128, "source alpha must remain unchanged");
  assert.deepEqual([...source.data], before, "the default API must not mutate preview source pixels");
});

test("masked anime recolor rejects masks that do not match the pixel buffer", () => {
  const source = { width: 2, height: 1, data: new Uint8ClampedArray([0,0,0,255,255,255,255,255]) };
  assert.throws(() => replaceColorRange(source, {
    sourceColor: "#000000", targetColor: "#FF0000", selectionMask: new Uint8Array([255])
  }), /mask must match/i);
});
