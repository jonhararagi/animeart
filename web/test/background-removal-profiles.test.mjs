import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_BACKGROUND_PROFILES,
  BACKGROUND_PROFILE_STORAGE_KEY,
  deleteBackgroundProfile,
  listBackgroundProfiles,
  normalizeBackgroundProfile,
  saveBackgroundProfile
} from "../domain/background-removal-profiles.mjs";

function memoryStorage(initial = null) {
  const values = new Map(initial ? [[BACKGROUND_PROFILE_STORAGE_KEY, initial]] : []);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("ships local presets for anime ink, flat color, transparent PNG and photography", () => {
  assert.deepEqual(BUILT_IN_BACKGROUND_PROFILES.map(profile => profile.id), ["anime-ink", "flat-color", "transparent-png", "photo"]);
  assert.ok(BUILT_IN_BACKGROUND_PROFILES.every(profile => profile.connectivity === "connected"));
});

test("normalizes unsafe profile values into supported processing bounds", () => {
  assert.deepEqual(normalizeBackgroundProfile({ targetColor: "red", tolerance: 999, feather: -4, edgeSensitivity: Infinity, connectivity: "global" }), {
    targetColor: "#ffffff", tolerance: 160, feather: 0, edgeSensitivity: 42, protectLineArt: true, decontaminate: true, connectivity: "connected"
  });
});

test("saves, restores, updates and deletes a custom local profile", () => {
  const storage = memoryStorage();
  const saved = saveBackgroundProfile("My anime edges", { targetColor: "#aabbcc", tolerance: 44, feather: 12, edgeSensitivity: 20, protectLineArt: true, decontaminate: false }, storage);
  assert.equal(saved.id, "custom-my-anime-edges");
  assert.equal(listBackgroundProfiles(storage).find(profile => profile.id === saved.id).tolerance, 44);
  saveBackgroundProfile("My anime edges", { tolerance: 62 }, storage);
  assert.equal(listBackgroundProfiles(storage).filter(profile => profile.id === saved.id).length, 1);
  assert.equal(listBackgroundProfiles(storage).find(profile => profile.id === saved.id).tolerance, 62);
  assert.equal(deleteBackgroundProfile(saved.id, storage), true);
  assert.equal(listBackgroundProfiles(storage).some(profile => profile.id === saved.id), false);
});

test("does not allow built-in presets to be deleted and recovers from corrupt storage", () => {
  const storage = memoryStorage("{broken");
  assert.equal(listBackgroundProfiles(storage).length, 4);
  assert.equal(deleteBackgroundProfile("anime-ink", storage), false);
  assert.throws(() => saveBackgroundProfile("   ", {}, storage), /name/i);
});
