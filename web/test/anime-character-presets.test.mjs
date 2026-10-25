import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIME_CHARACTER_PRESET_LIMITS,
  ANIME_CHARACTER_SET_STORAGE_KEY,
  ANIME_COLOR_PALETTE_STORAGE_KEY,
  ANIME_TRAIT_FAVORITES_STORAGE_KEY,
  loadAnimeCharacterSets,
  saveAnimeCharacterSet,
  deleteAnimeCharacterSet,
  loadAnimeColorPalettes,
  saveAnimeColorPalette,
  deleteAnimeColorPalette,
  loadAnimeTraitFavorites,
  updateAnimeTraitFavorites
} from "../domain/anime-character-presets.mjs";
import { ANIME_STYLE_COMPONENTS } from "../domain/anime-style-library.mjs";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

class ReadOnlyStorage {
  getItem() { return null; }
}

const colors = { hair: "#BB5533", eyes: "#0099CC", skin: "#F0C2B0", line: "#332211" };
const componentIds = { eyes: "eyes-round-glossy", hair: "hair-twin-tails", face: "face-oval-balanced" };

test("named character sets save, update by name, load, validate categories, and delete", () => {
  const storage = new MemoryStorage();
  const saved = saveAnimeCharacterSet(storage, { name: "  Capy Idol  ", componentIds, colors }, ANIME_STYLE_COMPONENTS, 100);
  assert.equal(saved.name, "Capy Idol");
  assert.equal(saved.colors.hair, "#bb5533");
  assert.deepEqual(loadAnimeCharacterSets(storage), [saved]);
  const updated = saveAnimeCharacterSet(storage, { name: "capy idol", componentIds: { ...componentIds, hair: "hair-straight-bob" }, colors }, ANIME_STYLE_COMPONENTS, 200);
  assert.equal(updated.id, saved.id);
  assert.equal(updated.createdAt, 100);
  assert.equal(updated.updatedAt, 200);
  assert.equal(loadAnimeCharacterSets(storage).length, 1);
  assert.throws(() => saveAnimeCharacterSet(storage, { name: "Wrong part", componentIds: { ...componentIds, eyes: "hair-twin-tails" }, colors }), /eyes, hair and face/);
  assert.equal(deleteAnimeCharacterSet(storage, updated.id), true);
  assert.deepEqual(loadAnimeCharacterSets(storage), []);
  assert.equal(deleteAnimeCharacterSet(storage, updated.id), false);
});

test("color palettes persist separately and reject malformed color input", () => {
  const storage = new MemoryStorage();
  const palette = saveAnimeColorPalette(storage, { name: "Atardecer", colors }, 50);
  assert.equal(palette.colors.eyes, "#0099cc");
  assert.deepEqual(loadAnimeColorPalettes(storage), [palette]);
  assert.throws(() => saveAnimeColorPalette(storage, { name: "Bad", colors: { ...colors, hair: "url(https://bad)" } }), /four colors/);
  assert.equal(deleteAnimeColorPalette(storage, palette.id), true);
  assert.deepEqual(loadAnimeColorPalettes(storage), []);
});

test("favorite traits add without duplication and remove only requested component IDs", () => {
  const storage = new MemoryStorage();
  const added = updateAnimeTraitFavorites(storage, ["eyes-round-glossy", "hair-twin-tails", "eyes-round-glossy", "not-a-trait"]);
  assert.deepEqual(added, ["eyes-round-glossy", "hair-twin-tails"]);
  assert.deepEqual(loadAnimeTraitFavorites(storage), added);
  assert.deepEqual(updateAnimeTraitFavorites(storage, ["eyes-round-glossy"], ANIME_STYLE_COMPONENTS, "remove"), ["hair-twin-tails"]);
  assert.equal(storage.getItem(ANIME_TRAIT_FAVORITES_STORAGE_KEY) !== null, true);
});

test("invalid local JSON is recovered safely, and unavailable/quota-limited storage reports errors", () => {
  const storage = new MemoryStorage();
  storage.setItem(ANIME_CHARACTER_SET_STORAGE_KEY, "{invalid-json");
  storage.setItem(ANIME_COLOR_PALETTE_STORAGE_KEY, JSON.stringify([{ id: "bad", name: "", colors }]));
  assert.deepEqual(loadAnimeCharacterSets(storage), []);
  assert.deepEqual(loadAnimeColorPalettes(storage), []);
  assert.throws(() => saveAnimeColorPalette(new ReadOnlyStorage(), { name: "Offline", colors }), /almacenamiento local no está disponible/i);
  const quota = new MemoryStorage();
  quota.setItem = () => { throw new Error("quota"); };
  assert.throws(() => saveAnimeColorPalette(quota, { name: "Offline", colors }), /save|space/i);
});

test("local preset collections have explicit bounded capacity", () => {
  assert.deepEqual(ANIME_CHARACTER_PRESET_LIMITS, { characterSets: 24, colorPalettes: 24, favorites: 48, nameLength: 48, storageCharacters: 80000 });
  const storage = new MemoryStorage();
  for (let i = 0; i < ANIME_CHARACTER_PRESET_LIMITS.characterSets; i++) {
    saveAnimeCharacterSet(storage, { name: "Set " + i, componentIds, colors }, ANIME_STYLE_COMPONENTS, i + 1);
  }
  assert.throws(() => saveAnimeCharacterSet(storage, { name: "Set overflow", componentIds, colors }), /24 conjuntos/);
});
