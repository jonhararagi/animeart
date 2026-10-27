import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createLayer, createImageLayer, createTextLayer } from "../domain/model.mjs";
import {
  MULTIPAGE_PAGE_CHARS_LIMIT,
  MULTIPAGE_PAGE_LIMIT,
  MULTIPAGE_PROJECT_LIMIT,
  copyLayerToPage,
  listMultiPageProjects,
  createMultiPageProject,
  normalizeMultiPageName,
  reorderMultiPagePage
} from "../domain/multi-page-project.mjs";

test("multipage library keeps explicit project and page limits", () => {
  assert.equal(MULTIPAGE_PROJECT_LIMIT, 10);
  assert.equal(MULTIPAGE_PAGE_LIMIT, 10);
  assert.equal(MULTIPAGE_PAGE_CHARS_LIMIT, 2_500_000);
});

test("multipage names strip control characters and reject blank names", () => {
  assert.equal(normalizeMultiPageName("  Cómic\u0000 Sakura  "), "Cómic Sakura");
  assert.equal(normalizeMultiPageName("  "), "");
  assert.equal(normalizeMultiPageName(" ", "Página copiada"), "Página copiada");
  assert.equal(normalizeMultiPageName("A".repeat(120)).length, 90);
});

test("copying one layer between pages preserves editable content and assigns a fresh ID", () => {
  const source = createDocument(1080, 1350);
  const art = createImageLayer("Personaje", 320, 480, "data:image/png;base64,AA==");
  const title = createTextLayer("Título", { value: "KapiArt", fontSize: 72, x: 20, y: 100 });
  source.layers = [art, title];
  const target = createDocument(1080, 1350);
  const result = copyLayerToPage(source, target, art.id);
  assert.equal(result.ok, true);
  assert.equal(result.document.layers.length, 2);
  assert.equal(result.document.layers[1].name, "Personaje (copia)");
  assert.notEqual(result.document.layers[1].id, art.id);
  assert.deepEqual(result.document.layers[1].image, art.image);
  assert.equal(source.layers.length, 2);
  assert.equal(target.layers.length, 1);
  assert.equal(copyLayerToPage(source, target, "not-a-layer").ok, false);
});

test("copy refuses to exceed page layer and serialized-size limits", () => {
  const source = createDocument(32, 32);
  source.layers = [createLayer("Copy")];
  const crowded = createDocument(32, 32);
  crowded.layers = Array.from({ length: 200 }, (_, index) => createLayer("Layer " + index));
  const tooMany = copyLayerToPage(source, crowded, source.layers[0].id);
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.error, /200 capas/i);

  const oversizedSource = createDocument(32, 32);
  oversizedSource.layers = [createImageLayer("Big", 32, 32, "data:image/png;base64," + "A".repeat(1_300_000))];
  const oversizedTarget = createDocument(32, 32);
  oversizedTarget.layers = [createImageLayer("Existing", 32, 32, "data:image/png;base64," + "B".repeat(1_300_000))];
  const tooLarge = copyLayerToPage(oversizedSource, oversizedTarget, oversizedSource.layers[0].id);
  assert.equal(tooLarge.ok, false);
  assert.match(tooLarge.error, /2,5 MB/i);
});

test("multipage IndexedDB operations fail clearly when browser storage is unavailable", async () => {
  await assert.rejects(listMultiPageProjects({ indexedDBApi: null }), /IndexedDB/i);
  await assert.rejects(
    createMultiPageProject({ name: "Proyecto", document: createDocument(10, 10) }, { indexedDBApi: null }),
    /IndexedDB/i
  );
  await assert.rejects(
    reorderMultiPagePage("p", "page", 0, { indexedDBApi: null }),
    /IndexedDB/i
  );
});
