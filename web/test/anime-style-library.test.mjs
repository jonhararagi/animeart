import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIME_STYLE_COMPONENTS, getAnimeStyleComponent,
  searchAnimeStyleComponents, createAnimeStyleComponentSvg
} from "../domain/anime-style-library.mjs";

test("anime style library contains 12 original SVG components across eyes hair and face", () => {
  assert.equal(ANIME_STYLE_COMPONENTS.length, 12);
  assert.equal(new Set(ANIME_STYLE_COMPONENTS.map(item => item.id)).size, 12);
  for (const part of ["eyes", "hair", "face"]) {
    const items = ANIME_STYLE_COMPONENTS.filter(item => item.part === part);
    assert.equal(items.length, 4);
    assert.ok(items.every(item => item.originType === "generated"));
    assert.ok(items.every(item => item.provenance.includes("KapiArt")));
    assert.ok(items.every(item => item.tags.length >= 3 && item.visualTraits.length >= 2));
  }
});

test("search filters independently by feature and ignores Spanish accents", () => {
  assert.deepEqual(searchAnimeStyleComponents("", "eyes").map(item => item.part), ["eyes", "eyes", "eyes", "eyes"]);
  assert.equal(searchAnimeStyleComponents("coletas", "hair").length, 1);
  assert.ok(searchAnimeStyleComponents("mandíbula", "face").some(item => item.id === "face-angular-defined"));
  assert.equal(searchAnimeStyleComponents("peinado", "eyes").length, 0);
  assert.equal(searchAnimeStyleComponents("reflejos dobles", "all")[0].id, "eyes-round-glossy");
  assert.equal(getAnimeStyleComponent("not-a-component"), null);
  assert.throws(() => createAnimeStyleComponentSvg("not-a-component"), /Unknown anime style component/);
});

test("components generate real, distinct local vector art with configurable safe colors", () => {
  const svgs = ANIME_STYLE_COMPONENTS.map(item => createAnimeStyleComponentSvg(item.id));
  assert.equal(new Set(svgs).size, ANIME_STYLE_COMPONENTS.length);
  for (const svg of svgs) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<image\b|<script\b|https?:\/\/[^"]+(?:png|jpe?g|webp)/i);
  }
  const original = createAnimeStyleComponentSvg("hair-spiky-short");
  const recolored = createAnimeStyleComponentSvg("hair-spiky-short", { primaryColor: "#ff5577" });
  assert.notEqual(original, recolored);
  assert.match(recolored, /#ff5577/i);
  assert.doesNotMatch(createAnimeStyleComponentSvg("hair-spiky-short", { primaryColor: "url(https://bad)" }), /url\(https:\/\/bad\)/);
});
