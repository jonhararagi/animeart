export const ASSET_LIBRARY_SCHEMA_VERSION = 2;
export const LEGACY_ASSET_LIBRARY_SCHEMA_VERSIONS = Object.freeze([1]);
export const ASSET_CATEGORIES = Object.freeze(["character", "sticker", "background", "texture", "reference"]);
export const ASSET_ORIGIN_TYPES = Object.freeze(["original", "derivative", "unknown", "generated", "experimental"]);
export const ASSET_VERIFICATION_STATUSES = Object.freeze(["user-confirmed", "unverified", "unknown"]);
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_LIBRARY_ASSETS = 500;

function limitedText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}
function normalizeTags(value, maxItems = 20) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(source.map(tag => limitedText(tag, 60).toLocaleLowerCase("es")).filter(Boolean))].slice(0, maxItems);
}
function normalizeHttpUrl(value) {
  const raw = limitedText(value, 500);
  if (!raw) return "";
  let parsed;
  try { parsed = new URL(raw); } catch { throw new TypeError("Source URL must be a valid http:// or https:// address"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TypeError("Source URL must use http:// or https://");
  }
  return parsed.href.slice(0, 500);
}
function normalizeHash(value) {
  const hash = limitedText(value, 64).toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

export function normalizeAssetMetadata(input, now = new Date().toISOString()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid asset record");
  const id = limitedText(input.id, 100);
  const name = limitedText(input.name, 160);
  const category = limitedText(input.category || "sticker", 40).toLowerCase();
  const originType = limitedText(input.originType || "unknown", 40).toLowerCase();
  const verificationStatus = limitedText(input.verificationStatus || "unknown", 40).toLowerCase();
  const tags = normalizeTags(input.tags, 20);
  const visualTraits = normalizeTags(input.visualTraits, 20);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new TypeError("Invalid asset ID");
  if (!name) throw new TypeError("Asset name is required");
  if (!ASSET_CATEGORIES.includes(category)) throw new TypeError("Invalid asset category");
  if (!ASSET_ORIGIN_TYPES.includes(originType)) throw new TypeError("Invalid origin type");
  if (!ASSET_VERIFICATION_STATUSES.includes(verificationStatus)) throw new TypeError("Invalid provenance verification status");
  const createdAt = Number.isFinite(Date.parse(input.createdAt || "")) ? new Date(input.createdAt).toISOString() : now;
  return {
    id, name, category, tags, visualTraits, originType, verificationStatus,
    creator: limitedText(input.creator, 160),
    sourceUrl: normalizeHttpUrl(input.sourceUrl),
    license: limitedText(input.license, 120),
    attribution: limitedText(input.attribution, 500),
    provenanceNotes: limitedText(input.provenanceNotes, 1200),
    contentHash: normalizeHash(input.contentHash),
    favorite: Boolean(input.favorite),
    mimeType: limitedText(input.mimeType, 100),
    size: Number.isFinite(Number(input.size)) && Number(input.size) >= 0 ? Math.floor(Number(input.size)) : 0,
    createdAt,
    updatedAt: Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString()
  };
}

function normalizeSearchText(value) {
  return String(value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
export function filterAssets(assets, query = "", filter = "all") {
  const term = normalizeSearchText(String(query || "").trim());
  return (Array.isArray(assets) ? assets : []).filter(asset => {
    if (filter === "favorites" && !asset.favorite) return false;
    if (filter !== "all" && filter !== "favorites") {
      const [kind, value] = String(filter).split(":");
      if (kind === "category" && asset.category !== value) return false;
      if (kind === "origin" && asset.originType !== value) return false;
      if (kind === "verification" && asset.verificationStatus !== value) return false;
      if (!["category", "origin", "verification"].includes(kind) && asset.category !== filter) return false;
    }
    if (!term) return true;
    const searchable = [
      asset.name, asset.category, asset.originType, asset.verificationStatus, asset.creator,
      asset.sourceUrl, asset.license, asset.attribution, asset.provenanceNotes,
      ...(asset.tags || []), ...(asset.visualTraits || [])
    ];
    return searchable.some(value => normalizeSearchText(value).includes(term));
  }).slice().sort((a, b) =>
    Number(b.favorite) - Number(a.favorite) ||
    String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
    a.name.localeCompare(b.name)
  );
}

export function createAssetLibraryPackage(assets, exportedAt = new Date().toISOString()) {
  if (!Array.isArray(assets) || assets.length > MAX_LIBRARY_ASSETS) throw new RangeError("Invalid asset count");
  return {
    schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
    exportedAt: Number.isFinite(Date.parse(exportedAt)) ? new Date(exportedAt).toISOString() : new Date().toISOString(),
    assets: assets.map(asset => normalizeAssetMetadata(asset))
  };
}
