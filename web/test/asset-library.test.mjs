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
  assert.match(worker,/animeart-web-shell-v59/);
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
  assert.match(panel,/"Licencia"/);
  assert.match(panel,/"Atribución requerida"/);
  assert.match(panel,/sha256Hex/);
  assert.match(panel,/LEGACY_ASSET_LIBRARY_SCHEMA_VERSIONS/);
  assert.match(panel,/Duplicados exactos omitidos/);
  assert.match(worker,/animeart-web-shell-v59/);
});
