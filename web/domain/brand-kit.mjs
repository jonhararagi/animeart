import { normalizeTextLayer, TEXT_FONT_FAMILIES } from "./text-layer.mjs";

export const BRAND_KIT_STORAGE_KEY = "kapiart-brand-kit-v1";
export const BRAND_KIT_VERSION = 1;
export const BRAND_KIT_MAX_COLORS = 12;
export const BRAND_KIT_MAX_TEXT_STYLES = 20;
export const BRAND_KIT_MAX_LOGOS = 4;
export const BRAND_KIT_MAX_LOGO_SOURCE_CHARS = 300_000;
export const BRAND_KIT_MAX_SERIALIZED_CHARS = 1_500_000;
export const BRAND_KIT_TEXT_STYLE_FIELDS = Object.freeze([
  "fontFamily", "fontWeight", "fontSize", "color", "align", "letterSpacing", "lineHeight",
  "outlineColor", "outlineWidth", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY"
]);
const BRAND_KIT_COLOR = /^#[0-9a-f]{6}$/i;
const BRAND_KIT_LOGO_SOURCE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const BRAND_KIT_NAME_MAX = 60;
const BRAND_KIT_LOGO_NAME_MAX = 80;

function makeId(prefix) {
  if (typeof globalThis.crypto?.randomUUID === "function") return prefix + "-" + globalThis.crypto.randomUUID();
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

function safeName(value, max = BRAND_KIT_NAME_MAX) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function safeColor(value) {
  const color = String(value ?? "").trim();
  return BRAND_KIT_COLOR.test(color) ? color.toLowerCase() : null;
}

function normalizeColorEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = safeName(entry.name);
  const value = safeColor(entry.value);
  if (!name || !value) return null;
  return { id: safeName(entry.id, 100) || makeId("brand-color"), name, value };
}

export function extractBrandTextStyle(textLayer) {
  const normalized = normalizeTextLayer(textLayer);
  return Object.fromEntries(BRAND_KIT_TEXT_STYLE_FIELDS.map(field => [field, normalized[field]]));
}

function normalizeTextStyleEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = safeName(entry.name);
  if (!name) return null;
  const source = entry.style && typeof entry.style === "object" ? entry.style : entry;
  if (source.fontFamily !== undefined && !TEXT_FONT_FAMILIES.includes(source.fontFamily)) return null;
  const style = extractBrandTextStyle(source);
  if (!TEXT_FONT_FAMILIES.includes(style.fontFamily)) return null;
  return { id: safeName(entry.id, 100) || makeId("brand-style"), name, style };
}

function normalizeLogoEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const name = safeName(entry.name, BRAND_KIT_LOGO_NAME_MAX);
  const source = typeof entry.source === "string" ? entry.source : "";
  const width = Number(entry.width), height = Number(entry.height);
  if (!name || source.length < 1 || source.length > BRAND_KIT_MAX_LOGO_SOURCE_CHARS ||
      !BRAND_KIT_LOGO_SOURCE.test(source) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 32_000_000) return null;
  return {
    id: safeName(entry.id, 100) || makeId("brand-logo"),
    name,
    source,
    width,
    height
  };
}

export function createEmptyBrandKit(name = "Mi marca") {
  return {
    version: BRAND_KIT_VERSION,
    name: safeName(name) || "Mi marca",
    colors: [],
    textStyles: [],
    logos: []
  };
}

export function normalizeBrandKit(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return createEmptyBrandKit();
  const colors = Array.isArray(input.colors)
    ? input.colors.map(normalizeColorEntry).filter(Boolean).slice(0, BRAND_KIT_MAX_COLORS)
    : [];
  const textStyles = Array.isArray(input.textStyles)
    ? input.textStyles.map(normalizeTextStyleEntry).filter(Boolean).slice(0, BRAND_KIT_MAX_TEXT_STYLES)
    : [];
  const logos = Array.isArray(input.logos)
    ? input.logos.map(normalizeLogoEntry).filter(Boolean).slice(0, BRAND_KIT_MAX_LOGOS)
    : [];
  return {
    version: BRAND_KIT_VERSION,
    name: safeName(input.name) || "Mi marca",
    colors: deduplicateById(colors),
    textStyles: deduplicateById(textStyles),
    logos: deduplicateById(logos)
  };
}

function deduplicateById(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export function loadBrandKit(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return createEmptyBrandKit();
  try {
    const raw = storage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!raw || raw.length > BRAND_KIT_MAX_SERIALIZED_CHARS) return createEmptyBrandKit();
    return normalizeBrandKit(JSON.parse(raw));
  } catch {
    return createEmptyBrandKit();
  }
}

export function saveBrandKit(kit, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    throw new Error("El kit de marca necesita almacenamiento local disponible en este dispositivo.");
  }
  const normalized = normalizeBrandKit(kit);
  const serialized = JSON.stringify(normalized);
  if (serialized.length > BRAND_KIT_MAX_SERIALIZED_CHARS) {
    throw new RangeError("El kit de marca supera el límite seguro de 1,5 MB. Reduce el tamaño o la cantidad de logos.");
  }
  try {
    storage.setItem(BRAND_KIT_STORAGE_KEY, serialized);
  } catch {
    throw new Error("No se pudo guardar el kit de marca. Libera espacio local o elimina un logo del kit.");
  }
  return normalized;
}

export function addBrandColor(kit, { name, value } = {}) {
  const current = normalizeBrandKit(kit);
  if (current.colors.length >= BRAND_KIT_MAX_COLORS) throw new RangeError("El kit admite hasta 12 colores de marca.");
  const entry = normalizeColorEntry({ id: makeId("brand-color"), name, value });
  if (!entry) throw new TypeError("Escribe un nombre y un color hexadecimal válido.");
  if (current.colors.some(color => color.value === entry.value)) {
    throw new Error("Ese color ya está guardado en el kit.");
  }
  return { ...current, colors: [...current.colors, entry] };
}

export function removeBrandColor(kit, id) {
  const current = normalizeBrandKit(kit);
  return { ...current, colors: current.colors.filter(entry => entry.id !== String(id)) };
}

export function addBrandTextStyle(kit, { name, style } = {}) {
  const current = normalizeBrandKit(kit);
  if (current.textStyles.length >= BRAND_KIT_MAX_TEXT_STYLES) throw new RangeError("El kit admite hasta 20 estilos tipográficos.");
  const entry = normalizeTextStyleEntry({ id: makeId("brand-style"), name, style });
  if (!entry) throw new TypeError("Selecciona una capa de texto y escribe un nombre para el estilo.");
  if (current.textStyles.some(item => item.name.toLocaleLowerCase("es") === entry.name.toLocaleLowerCase("es"))) {
    throw new Error("Ya existe un estilo con ese nombre.");
  }
  return { ...current, textStyles: [...current.textStyles, entry] };
}

export function removeBrandTextStyle(kit, id) {
  const current = normalizeBrandKit(kit);
  return { ...current, textStyles: current.textStyles.filter(entry => entry.id !== String(id)) };
}

export function addBrandLogo(kit, { name, source, width, height } = {}) {
  const current = normalizeBrandKit(kit);
  if (current.logos.length >= BRAND_KIT_MAX_LOGOS) throw new RangeError("El kit admite hasta 4 logos o firmas.");
  const entry = normalizeLogoEntry({ id: makeId("brand-logo"), name, source, width, height });
  if (!entry) throw new TypeError("El logo debe ser PNG, JPEG o WebP válido, de hasta 300 KB y con dimensiones seguras.");
  if (current.logos.some(item => item.name.toLocaleLowerCase("es") === entry.name.toLocaleLowerCase("es"))) {
    throw new Error("Ya existe un logo con ese nombre.");
  }
  return { ...current, logos: [...current.logos, entry] };
}

export function removeBrandLogo(kit, id) {
  const current = normalizeBrandKit(kit);
  return { ...current, logos: current.logos.filter(entry => entry.id !== String(id)) };
}

export function renameBrandKit(kit, name) {
  const current = normalizeBrandKit(kit);
  const normalized = safeName(name);
  if (!normalized) throw new TypeError("Escribe un nombre para la identidad de marca.");
  return { ...current, name: normalized };
}
