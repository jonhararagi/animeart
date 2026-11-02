import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createTextLayer } from "../domain/model.mjs";
import {
  MAX_RECOVERY_SNAPSHOT_CHARS,
  PROJECT_RECOVERY_DATABASE,
  PROJECT_RECOVERY_SNAPSHOT_LIMIT,
  createRecoverySnapshot,
  listRecoverySnapshots,
  saveRecoverySnapshot
} from "../domain/project-recovery.mjs";

test("recovery snapshots keep an independent editable copy and bounded metadata", () => {
  const document = createDocument(1080, 1350);
  document.layers.push(createTextLayer("Título Sakura", { value: "KapiArt" }));
  const snapshot = createRecoverySnapshot({ document, id: "recovery-one", now: 1234, reason: "manual" });

  assert.equal(snapshot.id, "recovery-one");
  assert.equal(snapshot.projectId, "active-canvas");
  assert.equal(snapshot.reason, "manual");
  assert.equal(snapshot.createdAt, 1234);
  assert.equal(snapshot.width, 1080);
  assert.equal(snapshot.height, 1350);
  assert.equal(snapshot.layerCount, 2);
  assert.ok(snapshot.serializedChars > 0);
  assert.equal(snapshot.document.layers[1].text.value, "KapiArt");

  document.layers[1].text.value = "Changed after snapshot";
  assert.equal(snapshot.document.layers[1].text.value, "KapiArt");
});

test("recovery snapshot rejects invalid documents and documents above safety limits", () => {
  assert.throws(() => createRecoverySnapshot({ document: null }), /documento editable válido/i);
  const oversized = createDocument(9000, 9000);
  assert.throws(() => createRecoverySnapshot({ document: oversized }), /límites seguros/i);
  const tooManyLayers = createDocument(100, 100);
  tooManyLayers.layers = Array.from({ length: 201 }, (_, index) => ({
    ...createDocument(1, 1).layers[0],
    id: "layer-" + index
  }));
  assert.throws(() => createRecoverySnapshot({ document: tooManyLayers }), /200 capas/i);
  assert.throws(() => createRecoverySnapshot({
    document: createDocument(10, 10, { title: "x".repeat(MAX_RECOVERY_SNAPSHOT_CHARS) })
  }), /2,5 MB/i);
});

test("recovery storage is local, bounded and reports unavailable IndexedDB", async () => {
  assert.equal(PROJECT_RECOVERY_DATABASE, "kapiart-project-recovery");
  assert.equal(PROJECT_RECOVERY_SNAPSHOT_LIMIT, 3);
  await assert.rejects(listRecoverySnapshots({ indexedDBApi: null }), /IndexedDB/i);
  await assert.rejects(saveRecoverySnapshot(createDocument(10, 10), { indexedDBApi: null }), /IndexedDB/i);
});
