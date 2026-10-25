import { ANIME_STYLE_COMPONENTS } from "./anime-style-library.mjs";

export const ANIME_CHARACTER_SET_STORAGE_KEY = "kapiart.anime.character-sets.v1";
export const ANIME_COLOR_PALETTE_STORAGE_KEY = "kapiart.anime.color-palettes.v1";
export const ANIME_TRAIT_FAVORITES_STORAGE_KEY = "kapiart.anime.trait-favorites.v1";
export const ANIME_CHARACTER_PRESET_LIMITS = Object.freeze({
  characterSets: 24,
  colorPalettes: 24,
  favorites: 48,
  nameLength: 48,
  storageCharacters: 80_000
});

const COMPONENT_KEYS = ["eyes", "hair", "face"];
const COLOR_KEYS = ["hair", "eyes", "skin", "line"];
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]{0,95}$/i;
const RECORD_ID = /^[a-zA-Z0-9._:-]{1,96}$/;
let fallbackId = 0;

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("El almacenamiento local no está disponible en este contexto.");
  }
  return storage;
}

function readArray(storage, key) {
  requireStorage(storage);
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    throw new Error("No se pudo leer la biblioteca local. Comprueba el espacio y los permisos del navegador.");
  }
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt local entries are treated as an empty collection; the next successful
    // save replaces the malformed value instead of crashing the creative editor.
    return [];
  }
}

function writeArray(storage, key, value) {
  requireStorage(storage);
  const encoded = JSON.stringify(value);
  if (encoded.length > ANIME_CHARACTER_PRESET_LIMITS.storageCharacters) {
    throw new RangeError("La biblioteca de rasgos supera el límite seguro de almacenamiento local.");
  }
  try {
    storage.setItem(key, encoded);
  } catch {
    throw new Error("No se pudo guardar en este dispositivo. Libera espacio del navegador e inténtalo de nuevo.");
  }
}

function safeName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= ANIME_CHARACTER_PRESET_LIMITS.nameLength ? name : null;
}

function safeRecordId(value) {
  return typeof value === "string" && RECORD_ID.test(value) ? value : null;
}

function makeRecordId(prefix, now) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return prefix + "-" + cryptoApi.randomUUID();
  fallbackId = (fallbackId + 1) % 1_000_000;
  return prefix + "-" + Math.max(0, Math.floor(Number(now) || Date.now())).toString(36) + "-" + fallbackId.toString(36);
}

function safeTimestamp(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function componentMap(components = ANIME_STYLE_COMPONENTS) {
  return new Map((Array.isArray(components) ? components : ANIME_STYLE_COMPONENTS)
    .filter(item => item && typeof item.id === "string" && COMPONENT_ID.test(item.id) &&
      ["eyes", "hair", "face"].includes(item.part))
    .map(item => [item.id, item]));
}

function normalizeComponentIds(value, components = ANIME_STYLE_COMPONENTS) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const byId = componentMap(components);
  const result = {};
  for (const part of COMPONENT_KEYS) {
    const id = value[part];
    if (typeof id !== "string" || !COMPONENT_ID.test(id) || byId.get(id)?.part !== part) return null;
    result[part] = id;
  }
  return result;
}

function normalizeColors(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const colors = {};
  for (const key of COLOR_KEYS) {
    if (typeof value[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(value[key])) return null;
    colors[key] = value[key].toLowerCase();
  }
  return colors;
}

function normalizeCharacterSet(value, components) {
  const id = safeRecordId(value?.id);
  const name = safeName(value?.name);
  const componentIds = normalizeComponentIds(value?.componentIds, components);
  const colors = normalizeColors(value?.colors);
  if (!id || !name || !componentIds || !colors) return null;
  const createdAt = safeTimestamp(value?.createdAt);
  const updatedAt = safeTimestamp(value?.updatedAt, createdAt);
  return { id, name, componentIds, colors, createdAt, updatedAt };
}

function normalizePalette(value) {
  const id = safeRecordId(value?.id);
  const name = safeName(value?.name);
  const colors = normalizeColors(value?.colors);
  if (!id || !name || !colors) return null;
  const createdAt = safeTimestamp(value?.createdAt);
  const updatedAt = safeTimestamp(value?.updatedAt, createdAt);
  return { id, name, colors, createdAt, updatedAt };
}

export function loadAnimeCharacterSets(storage, components = ANIME_STYLE_COMPONENTS) {
  return readArray(storage, ANIME_CHARACTER_SET_STORAGE_KEY)
    .map(item => normalizeCharacterSet(item, components))
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export function saveAnimeCharacterSet(storage, input, components = ANIME_STYLE_COMPONENTS, now = Date.now()) {
  const name = safeName(input?.name);
  const componentIds = normalizeComponentIds(input?.componentIds, components);
  const colors = normalizeColors(input?.colors);
  if (!name) throw new TypeError("Escribe un nombre de conjunto de hasta 48 caracteres.");
  if (!componentIds) throw new TypeError("El conjunto debe contener un rasgo válido de ojos, cabello y rostro.");
  if (!colors) throw new TypeError("Revisa los cuatro colores del conjunto.");
  const collection = loadAnimeCharacterSets(storage, components);
  const current = collection.find(item => item.id === input?.id) ||
    collection.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (!current && collection.length >= ANIME_CHARACTER_PRESET_LIMITS.characterSets) {
    throw new RangeError("La biblioteca admite hasta 24 conjuntos. Elimina uno antes de guardar otro.");
  }
  const time = safeTimestamp(now, Date.now());
  const record = {
    id: current?.id || safeRecordId(input?.id) || makeRecordId("set", time),
    name,
    componentIds,
    colors,
    createdAt: current?.createdAt || time,
    updatedAt: time
  };
  const next = [record, ...collection.filter(item => item.id !== record.id)]
    .slice(0, ANIME_CHARACTER_PRESET_LIMITS.characterSets);
  writeArray(storage, ANIME_CHARACTER_SET_STORAGE_KEY, next);
  return record;
}

export function deleteAnimeCharacterSet(storage, id, components = ANIME_STYLE_COMPONENTS) {
  const collection = loadAnimeCharacterSets(storage, components);
  const next = collection.filter(item => item.id !== id);
  if (next.length === collection.length) return false;
  writeArray(storage, ANIME_CHARACTER_SET_STORAGE_KEY, next);
  return true;
}

export function loadAnimeColorPalettes(storage) {
  return readArray(storage, ANIME_COLOR_PALETTE_STORAGE_KEY)
    .map(normalizePalette)
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export function saveAnimeColorPalette(storage, input, now = Date.now()) {
  const name = safeName(input?.name);
  const colors = normalizeColors(input?.colors);
  if (!name) throw new TypeError("Escribe un nombre de paleta de hasta 48 caracteres.");
  if (!colors) throw new TypeError("Revisa los cuatro colores de la paleta.");
  const collection = loadAnimeColorPalettes(storage);
  const current = collection.find(item => item.id === input?.id) ||
    collection.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (!current && collection.length >= ANIME_CHARACTER_PRESET_LIMITS.colorPalettes) {
    throw new RangeError("La biblioteca admite hasta 24 paletas. Elimina una antes de guardar otra.");
  }
  const time = safeTimestamp(now, Date.now());
  const record = {
    id: current?.id || safeRecordId(input?.id) || makeRecordId("palette", time),
    name,
    colors,
    createdAt: current?.createdAt || time,
    updatedAt: time
  };
  writeArray(storage, ANIME_COLOR_PALETTE_STORAGE_KEY,
    [record, ...collection.filter(item => item.id !== record.id)].slice(0, ANIME_CHARACTER_PRESET_LIMITS.colorPalettes));
  return record;
}

export function deleteAnimeColorPalette(storage, id) {
  const collection = loadAnimeColorPalettes(storage);
  const next = collection.filter(item => item.id !== id);
  if (next.length === collection.length) return false;
  writeArray(storage, ANIME_COLOR_PALETTE_STORAGE_KEY, next);
  return true;
}

export function loadAnimeTraitFavorites(storage, components = ANIME_STYLE_COMPONENTS) {
  const allowed = componentMap(components);
  return [...new Set(readArray(storage, ANIME_TRAIT_FAVORITES_STORAGE_KEY)
    .filter(id => typeof id === "string" && allowed.has(id)))].slice(0, ANIME_CHARACTER_PRESET_LIMITS.favorites);
}

export function updateAnimeTraitFavorites(storage, ids, components = ANIME_STYLE_COMPONENTS, mode = "add") {
  if (mode !== "add" && mode !== "remove") throw new TypeError("Favorite mode must be add or remove");
  const allowed = componentMap(components);
  const requested = [...new Set((Array.isArray(ids) ? ids : [])
    .filter(id => typeof id === "string" && allowed.has(id)))];
  const current = loadAnimeTraitFavorites(storage, components);
  const next = mode === "add"
    ? [...new Set([...current, ...requested])].slice(0, ANIME_CHARACTER_PRESET_LIMITS.favorites)
    : current.filter(id => !requested.includes(id));
  writeArray(storage, ANIME_TRAIT_FAVORITES_STORAGE_KEY, next);
  return next;
}
