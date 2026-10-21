import test from "node:test";
import assert from "node:assert/strict";
import { selectAnimeRegion, combineAnimeRegionSelections, animeColorFromHsv, findAnimeColorName } from "../domain/anime-region-selection.mjs";

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

test("Spanish color names are accent-insensitive and include useful anime hair and eye tones", () => {
  assert.equal(findAnimeColorName("  MARRÓN CLARO  "), "#b9855a");
  assert.equal(findAnimeColorName("azul petróleo"), "#0f5b66");
  assert.equal(findAnimeColorName("rubio miel"), "#d7a64b");
  assert.equal(findAnimeColorName("piel oscura"), "#71452d");
  assert.equal(findAnimeColorName("123ABC"), "#123abc");
});

test("HSV color generation clamps values and handles invalid inputs", () => {
  assert.equal(animeColorFromHsv(360, 100, 100), "#ff0000");
  assert.equal(animeColorFromHsv(-120, 100, 100), "#0000ff");
  assert.equal(animeColorFromHsv(0, 150, 100), "#ff0000");
  assert.equal(animeColorFromHsv(Number.NaN, Number.NaN, Number.NaN), "#000000");
});

test("two anime eye or hair regions can be added and subtracted without changing their pixels", () => {
  const left = { width:4, height:1, mask:new Uint8Array([1,1,0,0]), sourceColor:"#123456" };
  const right = { width:4, height:1, mask:new Uint8Array([0,1,1,0]), sourceColor:"#abcdef" };
  const added = combineAnimeRegionSelections(left,right,"add");
  assert.deepEqual([...added.mask],[1,1,1,0]);
  assert.equal(added.selectedPixels,3);
  assert.equal(added.sourceColor,"#123456");
  const subtracted = combineAnimeRegionSelections(added,right,"subtract");
  assert.deepEqual([...subtracted.mask],[1,0,0,0]);
  assert.equal(subtracted.selectedPixels,1);
});

test("region selection combination validates image dimensions and operation", () => {
  const a = { width:2, height:1, mask:new Uint8Array([1,0]), sourceColor:"#000000" };
  const b = { width:3, height:1, mask:new Uint8Array([0,1,0]), sourceColor:"#ffffff" };
  assert.throws(() => combineAnimeRegionSelections(a,b,"add"), RangeError);
  assert.throws(() => combineAnimeRegionSelections(a,a,"multiply"), /mode/i);
  assert.equal(combineAnimeRegionSelections(null,a,"add").selectedPixels,1);
  assert.equal(combineAnimeRegionSelections(null,a,"subtract").selectedPixels,0);
});
