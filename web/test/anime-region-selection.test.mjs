import test from "node:test";
import assert from "node:assert/strict";
import { selectAnimeRegion, animeColorFromHsv, findAnimeColorName } from "../domain/anime-region-selection.mjs";

function image(width, height, colors) {
  const data = new Uint8ClampedArray(width * height * 4);
  colors.forEach((color, index) => data.set([...color, 255], index * 4));
  return { width, height, data };
}

test("anime varita selects only the connected flat-color region", () => {
  const black = [20, 20, 20], hair = [80, 35, 25], skin = [230, 180, 145];
  const source = image(4, 2, [hair, hair, black, skin, hair, hair, black, skin]);
  const selected = selectAnimeRegion(source, 0, 0, { tolerance: 4 });
  assert.equal(selected.selectedPixels, 4);
  assert.equal(selected.mask[0], 1);
  assert.equal(selected.mask[1], 1);
  assert.equal(selected.mask[2], 0);
  assert.equal(selected.mask[3], 0);
  assert.equal(selected.sourceColor, "#502319");
});

test("selection ignores transparent pixels and rejects outside taps", () => {
  const source = image(2, 1, [[20, 20, 20], [20, 20, 20]]);
  source.data[3] = 0;
  assert.equal(selectAnimeRegion(source, 0, 0).selectedPixels, 0);
  assert.throws(() => selectAnimeRegion(source, 2, 0), RangeError);
});

test("HSV creates a large continuous palette and named colors resolve", () => {
  assert.equal(animeColorFromHsv(0, 100, 100), "#ff0000");
  assert.equal(animeColorFromHsv(120, 100, 100), "#00ff00");
  assert.equal(findAnimeColorName("marrón claro"), "#b9855a");
  assert.equal(findAnimeColorName("#123abc"), "#123abc");
  assert.equal(findAnimeColorName("color inexistente"), null);
});
