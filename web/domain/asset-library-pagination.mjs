export const ASSET_LIBRARY_PAGE_SIZE = 36;

/**
 * Return a bounded cumulative window of already-filtered assets.
 * Filtering and sorting stay with the caller, so search results preserve the
 * library order while the DOM creates only one page of cards at a time.
 */
export function getAssetLibraryPage(assets, visibleCount = ASSET_LIBRARY_PAGE_SIZE) {
  const items = Array.isArray(assets) ? assets : [];
  const converted = Number(visibleCount);
  const requested = Number.isFinite(converted)
    ? Math.floor(converted)
    : ASSET_LIBRARY_PAGE_SIZE;
  const limit = Math.max(0, requested);
  const pageItems = items.slice(0, limit);
  return {
    items: pageItems,
    total: items.length,
    visibleCount: pageItems.length,
    hasMore: pageItems.length < items.length
  };
}
