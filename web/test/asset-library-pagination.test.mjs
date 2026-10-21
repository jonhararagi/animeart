import test from "node:test";
import assert from "node:assert/strict";
import { ASSET_LIBRARY_PAGE_SIZE, getAssetLibraryPage } from "../domain/asset-library-pagination.mjs";

test("asset library pagination bounds the initial render and reports remaining items", () => {
  const items = Array.from({ length: 500 }, (_, id) => ({ id }));
  const first = getAssetLibraryPage(items);
  assert.equal(ASSET_LIBRARY_PAGE_SIZE, 36);
  assert.equal(first.items.length, 36);
  assert.equal(first.total, 500);
  assert.equal(first.visibleCount, 36);
  assert.equal(first.hasMore, true);
  assert.equal(first.items[0].id, 0);
  assert.equal(first.items[35].id, 35);
});

test("asset library pagination progressively reveals the final partial set without duplicates", () => {
  const items = Array.from({ length: 40 }, (_, id) => ({ id }));
  const first = getAssetLibraryPage(items, 36);
  const expanded = getAssetLibraryPage(items, first.visibleCount + ASSET_LIBRARY_PAGE_SIZE);
  assert.equal(first.items.length, 36);
  assert.equal(first.hasMore, true);
  assert.equal(expanded.items.length, 40);
  assert.equal(expanded.total, 40);
  assert.equal(expanded.visibleCount, 40);
  assert.equal(expanded.hasMore, false);
  assert.deepEqual(expanded.items.map(item => item.id), items.map(item => item.id));
});

test("asset library pagination handles empty, invalid, negative and non-array input safely", () => {
  assert.deepEqual(getAssetLibraryPage([]), { items: [], total: 0, visibleCount: 0, hasMore: false });
  assert.deepEqual(getAssetLibraryPage(null), { items: [], total: 0, visibleCount: 0, hasMore: false });
  assert.equal(getAssetLibraryPage([1, 2, 3], -1).visibleCount, 0);
  assert.equal(getAssetLibraryPage([1, 2, 3], "bad").visibleCount, 3);
});
