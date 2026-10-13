export const BACKGROUND_PROFILE_STORAGE_KEY = "animeart.background-removal-profiles.v1";

const DEFAULTS = Object.freeze({
  targetColor: "#ffffff",
  tolerance: 36,
  feather: 18,
  edgeSensitivity: 42,
  protectLineArt: true,
  decontaminate: true,
  connectivity: "connected"
});

export const BUILT_IN_BACKGROUND_PROFILES = Object.freeze([
  Object.freeze({ id: "anime-ink", name: "Anime · dark outlines", ...DEFAULTS, tolerance: 30, feather: 10, edgeSensitivity: 28, protectLineArt: true, decontaminate: true }),
  Object.freeze({ id: "flat-color", name: "Flat-color illustration", ...DEFAULTS, tolerance: 22, feather: 4, edgeSensitivity: 18, protectLineArt: true, decontaminate: false }),
  Object.freeze({ id: "transparent-png", name: "PNG · existing transparency", ...DEFAULTS, tolerance: 18, feather: 0, edgeSensitivity: 22, protectLineArt: true, decontaminate: false }),
  Object.freeze({ id: "photo", name: "Photography", ...DEFAULTS, tolerance: 28, feather: 24, edgeSensitivity: 58, protectLineArt: false, decontaminate: true })
]);

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeBackgroundProfile(profile, fallback = DEFAULTS) {
  const source = profile && typeof profile === "object" ? profile : {};
  const base = fallback && typeof fallback === "object" ? fallback : DEFAULTS;
  const rawColor = String(source.targetColor ?? base.targetColor ?? DEFAULTS.targetColor);
  const targetColor = /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : DEFAULTS.targetColor;
  return {
    targetColor,
    tolerance: clamp(source.tolerance ?? base.tolerance, 0, 160, DEFAULTS.tolerance),
    feather: clamp(source.feather ?? base.feather, 0, 100, DEFAULTS.feather),
    edgeSensitivity: clamp(source.edgeSensitivity ?? base.edgeSensitivity, 0, 120, DEFAULTS.edgeSensitivity),
    protectLineArt: (source.protectLineArt ?? base.protectLineArt) !== false,
    decontaminate: (source.decontaminate ?? base.decontaminate) !== false,
    connectivity: "connected"
  };
}

function readCustomProfiles(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(BACKGROUND_PROFILE_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.id === "string" && item.id.startsWith("custom-") && typeof item.name === "string")
      .map(item => ({ id: item.id, name: item.name.trim().slice(0, 60) || "Custom profile", ...normalizeBackgroundProfile(item) }));
  } catch {
    return [];
  }
}

export function listBackgroundProfiles(storage = globalThis.localStorage) {
  return [...BUILT_IN_BACKGROUND_PROFILES.map(profile => ({ ...profile })), ...readCustomProfiles(storage)];
}

export function saveBackgroundProfile(name, settings, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") throw new Error("Local profile storage is unavailable");
  const cleanName = String(name ?? "").trim().slice(0, 60);
  if (!cleanName) throw new TypeError("Enter a name for this processing profile");
  const slug = cleanName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!slug) throw new TypeError("Choose a profile name containing letters or numbers");
  const id = "custom-" + slug;
  const profiles = readCustomProfiles(storage).filter(profile => profile.id !== id);
  profiles.push({ id, name: cleanName, ...normalizeBackgroundProfile(settings) });
  try {
    storage.setItem(BACKGROUND_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    throw new Error("Could not save profile. Check local storage space and permissions.");
  }
  return profiles.find(profile => profile.id === id);
}

export function deleteBackgroundProfile(id, storage = globalThis.localStorage) {
  if (!String(id || "").startsWith("custom-") || !storage || typeof storage.setItem !== "function") return false;
  const profiles = readCustomProfiles(storage);
  const next = profiles.filter(profile => profile.id !== id);
  if (next.length === profiles.length) return false;
  try {
    storage.setItem(BACKGROUND_PROFILE_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
