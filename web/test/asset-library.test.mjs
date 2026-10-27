import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ASSET_CATEGORIES, ASSET_LIBRARY_SCHEMA_VERSION, MAX_ASSET_BYTES, ASSET_ORIGIN_TYPES, ASSET_VERIFICATION_STATUSES,
  createAssetLibraryPackage, filterAssets, normalizeAssetMetadata
} from "../domain/asset-library.mjs";

const now = "2026-10-12T12:00:00.000Z";
const asset = { id:"asset_test_0001", name:"Blue sky", category:"background", tags:["sky","blue"], favorite:true, mimeType:"image/png", size:1024, createdAt:now };

test("asset library metadata validates categories, names, ids and tags", () => {
  assert.deepEqual(ASSET_CATEGORIES, ["character","sticker","background","texture","reference"]);
  assert.equal(ASSET_LIBRARY_SCHEMA_VERSION, 2);
  assert.deepEqual(ASSET_ORIGIN_TYPES,["original","derivative","unknown","generated","experimental"]);
  assert.deepEqual(ASSET_VERIFICATION_STATUSES,["user-confirmed","unverified","unknown"]);
  assert.equal(MAX_ASSET_BYTES, 25*1024*1024);
  const normalized=normalizeAssetMetadata(asset,now);
  assert.equal(normalized.name,"Blue sky");
  assert.deepEqual(normalized.tags,["sky","blue"]);
  assert.throws(()=>normalizeAssetMetadata({...asset,category:"prompt"},now),/category/i);
  assert.throws(()=>normalizeAssetMetadata({...asset,name:"   "},now),/name/i);
  assert.throws(()=>normalizeAssetMetadata({...asset,id:"x"},now),/id/i);
});

test("asset library search and category/favorite filters compose correctly", () => {
  const a=normalizeAssetMetadata(asset,now);
  const b=normalizeAssetMetadata({...asset,id:"asset_test_0002",name:"Aria sticker",category:"sticker",tags:["aria"],favorite:false},now);
  assert.deepEqual(filterAssets([a,b],"blue","all").map(x=>x.id),["asset_test_0001"]);
  assert.deepEqual(filterAssets([a,b],"","favorites").map(x=>x.id),["asset_test_0001"]);
  assert.deepEqual(filterAssets([a,b],"aria","sticker").map(x=>x.id),["asset_test_0002"]);
});

test("portable asset package keeps image metadata, category and tags", () => {
  const pkg=createAssetLibraryPackage([asset],now);
  assert.equal(pkg.schemaVersion,2);
  assert.equal(pkg.assets[0].category,"background");
  assert.deepEqual(pkg.assets[0].tags,["sky","blue"]);
  assert.equal(pkg.assets[0].originType,"unknown");
  assert.equal(pkg.assets[0].verificationStatus,"unknown");
});

test("Asset Library UI is wired to local storage, reusable canvas layers and package import/export", async () => {
  const [html,app,panel,worker]=await Promise.all([
    readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("asset-library.js","utf8"),readFile("service-worker.js","utf8")
  ]);
  assert.match(html,/id="open-asset-library"/);
  assert.match(html,/id="asset-library-files" type="file"/);
  assert.match(panel,/indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(panel,/Insertar al lienzo/);
  assert.match(panel,/createAssetLibraryPackage/);
  assert.match(panel,/imageDataUrl/);
  assert.match(app,/initializeAssetLibrary\(\{ onImportImage: importImageIntoEditor/);
  assert.match(worker,/animeart-web-shell-v72/);
  assert.match(worker,/\.\/asset-library\.js/);
});

test("provenance metadata persists origin type, author, license, attribution and visual traits", () => {
  const marked=normalizeAssetMetadata({
    ...asset, originType:"derivative", verificationStatus:"user-confirmed",
    creator:"Studio Example", sourceUrl:"https://example.org/source",
    license:"CC BY 4.0", attribution:"Credit Studio Example",
    provenanceNotes:"Adapted from the linked resource", visualTraits:["cabello ondulado","ojos grandes"],
    contentHash:"A".repeat(64)
  },now);
  assert.equal(marked.originType,"derivative");
  assert.equal(marked.verificationStatus,"user-confirmed");
  assert.equal(marked.creator,"Studio Example");
  assert.equal(marked.sourceUrl,"https://example.org/source");
  assert.equal(marked.license,"CC BY 4.0");
  assert.deepEqual(marked.visualTraits,["cabello ondulado","ojos grandes"]);
  assert.equal(marked.contentHash,"a".repeat(64));
  assert.throws(()=>normalizeAssetMetadata({...asset,sourceUrl:"javascript:alert(1)"},now),/http/i);
  assert.throws(()=>normalizeAssetMetadata({...asset,originType:"stolen"},now),/origin/i);
});

test("provenance search is accent-insensitive and supports origin and verification filters", () => {
  const original=normalizeAssetMetadata({...asset,id:"asset_test_1001",name:"Iris violeta",originType:"original",verificationStatus:"user-confirmed",creator:"Yuki",license:"CC0",visualTraits:["párpado fino"]},now);
  const unknown=normalizeAssetMetadata({...asset,id:"asset_test_1002",name:"Hair ref",originType:"unknown",verificationStatus:"unknown",creator:"",sourceUrl:""},now);
  assert.deepEqual(filterAssets([original,unknown],"parpado").map(x=>x.id),["asset_test_1001"]);
  assert.deepEqual(filterAssets([original,unknown],"yuki").map(x=>x.id),["asset_test_1001"]);
  assert.deepEqual(filterAssets([original,unknown],"","origin:unknown").map(x=>x.id),["asset_test_1002"]);
  assert.deepEqual(filterAssets([original,unknown],"","verification:user-confirmed").map(x=>x.id),["asset_test_1001"]);
});

test("legacy metadata without provenance imports conservatively as unknown", () => {
  const legacy=normalizeAssetMetadata(asset,now);
  assert.equal(legacy.originType,"unknown");
  assert.equal(legacy.verificationStatus,"unknown");
  assert.equal(legacy.sourceUrl,"");
  assert.equal(legacy.license,"");
});

test("asset library UI captures source and license data, hashes imports, and accepts legacy packages", async () => {
  const [html,panel,worker]=await Promise.all([
    readFile("index.html","utf8"),readFile("asset-library.js","utf8"),readFile("service-worker.js","utf8")
  ]);
  assert.match(html,/value="origin:derivative"/);
  assert.match(html,/value="verification:user-confirmed"/);
  assert.match(panel,/"Enlace de origen"/);
  assert.match(panel,/asset-origin-chip/);
  assert.match(panel,/VERIFICATION_LABELS/);
  assert.match(panel,/"Licencia"/);
  assert.match(panel,/"Atribución requerida"/);
  assert.match(panel,/sha256Hex/);
  assert.match(panel,/LEGACY_ASSET_LIBRARY_SCHEMA_VERSIONS/);
  assert.match(panel,/Duplicados exactos omitidos/);
  assert.match(worker,/animeart-web-shell-v72/);
});


test("legacy asset hash backfill runs only for matching import sizes before exact duplicate checks", async () => {
  const [panel, worker] = await Promise.all([
    readFile("asset-library.js", "utf8"),
    readFile("service-worker.js", "utf8")
  ]);
  assert.match(panel, /backfillAssetHashesForMatchingSizes/);
  assert.match(panel, /await backfillLegacyHashes\(current, eligible\)/);
  assert.match(panel, /await backfillLegacyHashes\(existing,prepared\.map\(record=>record\.imageBlob\)\)/);
  assert.match(panel, /knownHashes=new Set\(current\.map\(asset=>asset\.contentHash\)\.filter\(Boolean\)\)/);
  assert.match(worker, /\.\/domain\/asset-deduplication\.mjs/);
  assert.match(worker, /animeart-web-shell-v72/);
});

test("package import never trusts a declared SHA-256 if the local browser cannot recompute it", async () => {
  const panel = await readFile("asset-library.js", "utf8");
  assert.match(panel, /normalizeComputedAssetHash\(await sha256Hex\(imageBlob\)\)/);
  assert.doesNotMatch(panel, /sha256Hex\(imageBlob\)\|\|String\(raw\.contentHash\|\|""\)/);
  assert.match(panel, /normalizeComputedAssetHash\(await sha256Hex\(file\)\)/);
});

test("asset library renders thumbnails progressively, resets pagination on search, and lazy-loads previews", async () => {
  const [panel, worker, styles] = await Promise.all([
    readFile("asset-library.js", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("styles.css", "utf8")
  ]);
  assert.match(panel, /getAssetLibraryPage\(matching, visibleCount\)/);
  assert.match(panel, /visibleCount \+= ASSET_LIBRARY_PAGE_SIZE/);
  assert.match(panel, /search\.addEventListener\("input",\(\)=>\{visibleCount=ASSET_LIBRARY_PAGE_SIZE;render\(\);\}\)/);
  assert.match(panel, /image\.loading="lazy"/);
  assert.match(panel, /image\.decoding="async"/);
  assert.match(panel, /asset-library-load-more/);
  assert.match(worker, /\.\/domain\/asset-library-pagination\.mjs/);
  assert.match(worker, /animeart-web-shell-v72/);
  assert.match(styles, /\.asset-library-load-more/);
});

test("asset library upgrades version-one records into separate metadata and binary stores without discarding images", async () => {
  const [panel, browserE2E, worker] = await Promise.all([
    readFile("asset-library.js", "utf8"),
    readFile("scripts/browser-e2e.mjs", "utf8"),
    readFile("service-worker.js", "utf8")
  ]);
  assert.ok(panel.includes("const DB_VERSION = 2"));
  assert.ok(panel.includes('const BLOB_STORE = "asset-blobs"'));
  assert.ok(panel.includes("request.onblocked = () =>"));
  assert.ok(panel.includes("Cierra las pestañas antiguas para continuar sin perder tu biblioteca"));
  assert.ok(panel.includes("event.oldVersion < 2"));
  assert.ok(panel.includes("cursor.update(asset)"));
  assert.ok(panel.includes("async function allAssets()"));
  assert.ok(panel.includes("async function getAssetBlob(id)"));
  assert.ok(panel.includes("new IntersectionObserver"));
  assert.ok(panel.includes("async function createAssetThumbnail(imageBlob)"));
  assert.ok(panel.includes("const maximumEdge = 512"));
  assert.ok(panel.includes("thumbnailBlob instanceof Blob"));
  assert.ok(panel.includes("getAssetPreviewBlob(asset.id)"));
  assert.ok(panel.includes("getAssetBlob(asset.id)"));
  assert.ok(panel.includes("objectStore(BLOB_STORE).delete(id)"));
  assert.ok(browserE2E.includes("schema migration moves image binaries into a separate IndexedDB store"));
  assert.ok(worker.includes("animeart-web-shell-v72"));
});
