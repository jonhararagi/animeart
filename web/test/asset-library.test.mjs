import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ASSET_CATEGORIES, ASSET_LIBRARY_SCHEMA_VERSION, MAX_ASSET_BYTES,
  createAssetLibraryPackage, filterAssets, normalizeAssetMetadata
} from "../domain/asset-library.mjs";

const now = "2026-10-12T12:00:00.000Z";
const asset = { id:"asset_test_0001", name:"Blue sky", category:"background", tags:["sky","blue"], favorite:true, mimeType:"image/png", size:1024, createdAt:now };

test("asset library metadata validates categories, names, ids and tags", () => {
  assert.deepEqual(ASSET_CATEGORIES, ["character","sticker","background","texture","reference"]);
  assert.equal(ASSET_LIBRARY_SCHEMA_VERSION, 1);
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
  assert.equal(pkg.schemaVersion,1);
  assert.equal(pkg.assets[0].category,"background");
  assert.deepEqual(pkg.assets[0].tags,["sky","blue"]);
});

test("Asset Library UI is wired to local storage, reusable canvas layers and package import/export", async () => {
  const [html,app,panel,worker]=await Promise.all([
    readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("asset-library.js","utf8"),readFile("service-worker.js","utf8")
  ]);
  assert.match(html,/id="open-asset-library"/);
  assert.match(html,/id="asset-library-files" type="file"/);
  assert.match(panel,/indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(panel,/Add to canvas/);
  assert.match(panel,/createAssetLibraryPackage/);
  assert.match(panel,/imageDataUrl/);
  assert.match(app,/initializeAssetLibrary\(\{ onImportImage: importImageIntoEditor/);
  assert.match(worker,/animeart-web-shell-v39/);
  assert.match(worker,/\.\/asset-library\.js/);
});
