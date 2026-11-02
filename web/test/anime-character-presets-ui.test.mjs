import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("anime character presets expose real local favorites, reusable sets, palettes, and layer metadata", async () => {
  const [app, html, worker, workflow, model, domain] = await Promise.all([
    readFile("app.js", "utf8"),
    readFile("index.html", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("../.github/workflows/android.yml", "utf8"),
    readFile("domain/model.mjs", "utf8"),
    readFile("domain/anime-character-presets.mjs", "utf8")
  ]);
  for (const id of [
    "creative-trait-favorites-only", "creative-trait-save-favorites", "creative-trait-remove-favorites",
    "creative-character-set-save", "creative-character-set-load", "creative-character-set-delete",
    "creative-character-palette-save", "creative-character-palette-load", "creative-character-palette-delete"
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(app, /saveCurrentAnimeCharacterSet/);
  assert.match(app, /loadSelectedAnimeCharacterSet/);
  assert.match(app, /saveCurrentAnimeColorPalette/);
  assert.match(app, /loadSelectedAnimeColorPalette/);
  assert.match(app, /updateSelectedAnimeTraitFavorites/);
  assert.match(app, /characterComposition/);
  assert.match(model, /normalizeCharacterComposition/);
  assert.match(domain, /ANIME_CHARACTER_SET_STORAGE_KEY/);
  assert.match(domain, /ANIME_COLOR_PALETTE_STORAGE_KEY/);
  assert.match(domain, /ANIME_TRAIT_FAVORITES_STORAGE_KEY/);
  assert.match(domain, /storageCharacters: 80_000/);
  assert.match(worker, /animeart-web-shell-v79/);
  assert.match(worker, /\.\/domain\/anime-character-presets\.mjs/);
  assert.match(app, /animeart-web-shell-v79/);
  assert.match(app, /\.\/domain\/anime-character-presets\.mjs/);
  assert.match(workflow, /animeart-web-shell-v79/);
  assert.match(workflow, /anime-character-presets\.mjs/);
});
