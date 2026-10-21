import test from "node:test";
import assert from "node:assert/strict";
import { backfillAssetHashesForMatchingSizes } from "../domain/asset-deduplication.mjs";

test("legacy hash backfill inspects only same-sized image blobs and persists SHA-256 metadata", async () => {
  const legacyMatch = { id: "legacy-match", contentHash: "", imageBlob: new Blob(["same"]) };
  const legacyOtherSize = { id: "legacy-other-size", contentHash: "", imageBlob: new Blob(["larger content"]) };
  const alreadyHashed = { id: "already-hashed", contentHash: "f".repeat(64), imageBlob: new Blob(["same"]) };
  const persisted = [];
  const hashCalls = [];

  const result = await backfillAssetHashesForMatchingSizes({
    existingAssets: [legacyMatch, legacyOtherSize, alreadyHashed],
    incomingBlobs: [new Blob(["new!"])],
    hashBlob: async blob => {
      hashCalls.push(blob.size);
      return blob.size === 4 ? "a".repeat(64) : "b".repeat(64);
    },
    persistAsset: async asset => persisted.push(asset.id)
  });

  assert.deepEqual(result, { checked: 1, backfilled: 1 });
  assert.deepEqual(hashCalls, [4]);
  assert.equal(legacyMatch.contentHash, "a".repeat(64));
  assert.equal(legacyOtherSize.contentHash, "");
  assert.equal(alreadyHashed.contentHash, "f".repeat(64));
  assert.deepEqual(persisted, ["legacy-match"]);
});

test("legacy hash backfill is a safe no-op without same-sized imports or a valid digest", async () => {
  const legacy = { id: "legacy", contentHash: "", imageBlob: new Blob(["old"]) };
  let calls = 0;
  const noCandidates = await backfillAssetHashesForMatchingSizes({
    existingAssets: [legacy],
    incomingBlobs: [new Blob(["a different size"])],
    hashBlob: async () => { calls++; return "a".repeat(64); }
  });
  assert.deepEqual(noCandidates, { checked: 0, backfilled: 0 });
  assert.equal(calls, 0);

  const invalidDigest = await backfillAssetHashesForMatchingSizes({
    existingAssets: [legacy],
    incomingBlobs: [new Blob(["new"])],
    hashBlob: async () => "not-a-sha256"
  });
  assert.deepEqual(invalidDigest, { checked: 1, backfilled: 0 });
  assert.equal(legacy.contentHash, "");
});
