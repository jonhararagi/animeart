function isBlobLike(value) {
  return Boolean(
    value &&
    Number.isFinite(value.size) &&
    value.size >= 0 &&
    typeof value.arrayBuffer === "function"
  );
}

/**
 * Hashes older stored images only when their byte size matches an image in the
 * current import batch. Hashing and persistence are injected so this module
 * stays independent of IndexedDB and the browser UI.
 */
export async function backfillAssetHashesForMatchingSizes({
  existingAssets = [],
  incomingBlobs = [],
  hashBlob,
  persistAsset = async () => {}
} = {}) {
  if (!Array.isArray(existingAssets)) throw new TypeError("existingAssets must be an array");
  if (!Array.isArray(incomingBlobs)) throw new TypeError("incomingBlobs must be an array");
  if (typeof hashBlob !== "function") throw new TypeError("hashBlob must be a function");
  if (typeof persistAsset !== "function") throw new TypeError("persistAsset must be a function");

  const targetSizes = new Set(incomingBlobs.filter(isBlobLike).map(blob => blob.size));
  if (!targetSizes.size) return { checked: 0, backfilled: 0 };

  let checked = 0;
  let backfilled = 0;
  for (const asset of existingAssets) {
    if (!asset || asset.contentHash || !isBlobLike(asset.imageBlob)) continue;
    if (!targetSizes.has(asset.imageBlob.size)) continue;

    checked += 1;
    let contentHash = "";
    try {
      contentHash = String(await hashBlob(asset.imageBlob) || "").trim().toLowerCase();
    } catch {
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(contentHash)) continue;

    const updated = { ...asset, contentHash };
    await persistAsset(updated);
    Object.assign(asset, updated);
    backfilled += 1;
  }

  return { checked, backfilled };
}

/**
 * Accepts only a syntactically valid digest produced by the local hashing
 * operation. Imported package metadata must never be used as a digest fallback.
 */
export function normalizeComputedAssetHash(value) {
  const digest = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(digest) ? digest : "";
}
