export const ASSET_LIBRARY_SCHEMA_VERSION = 1;
export const ASSET_CATEGORIES = Object.freeze(["character", "sticker", "background", "texture", "reference"]);
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_LIBRARY_ASSETS = 500;

export function normalizeAssetMetadata(input, now = new Date().toISOString()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid asset record");
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim().slice(0, 160);
  const category = String(input.category || "sticker").trim().toLowerCase();
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map(tag => String(tag).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20)
    : String(input.tags || "").split(",").map(tag => tag.trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 20);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new TypeError("Invalid asset ID");
  if (!name) throw new TypeError("Asset name is required");
  if (!ASSET_CATEGORIES.includes(category)) throw new TypeError("Invalid asset category");
  return {
    id, name, category, tags,
    favorite: Boolean(input.favorite),
    mimeType: String(input.mimeType || "").slice(0, 100),
    size: Number.isFinite(Number(input.size)) && Number(input.size) >= 0 ? Math.floor(Number(input.size)) : 0,
    createdAt: Number.isFinite(Date.parse(input.createdAt || "")) ? new Date(input.createdAt).toISOString() : now,
    updatedAt: now
  };
}

export function filterAssets(assets, query = "", filter = "all") {
  const term = String(query || "").trim().toLowerCase();
  return (Array.isArray(assets) ? assets : []).filter(asset => {
    if (filter === "favorites" && !asset.favorite) return false;
    if (filter !== "all" && filter !== "favorites" && asset.category !== filter) return false;
    if (!term) return true;
    return [asset.name, asset.category, ...(asset.tags || [])].some(value => String(value).toLowerCase().includes(term));
  }).slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.name.localeCompare(b.name));
}

export function createAssetLibraryPackage(assets, exportedAt = new Date().toISOString()) {
  if (!Array.isArray(assets) || assets.length > MAX_LIBRARY_ASSETS) throw new RangeError("Invalid asset count");
  return {
    schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
    exportedAt: Number.isFinite(Date.parse(exportedAt)) ? new Date(exportedAt).toISOString() : new Date().toISOString(),
    assets: assets.map(asset => normalizeAssetMetadata(asset))
  };
}
