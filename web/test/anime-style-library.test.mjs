import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIME_STYLE_COMPONENTS, getAnimeStyleComponent,
  searchAnimeStyleComponents, createAnimeStyleComponentSvg, createAnimeCharacterParts
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

test("character composition creates four independently editable SVG parts with safe custom colors", () => {
  const parts = createAnimeCharacterParts({
    eyesId: "eyes-round-glossy",
    hairId: "hair-twin-tails",
    faceId: "face-angular-defined",
    hairColor: "#bb5533",
    eyeColor: "#0099cc",
    skinColor: "#f0c2b0",
    lineColor: "#332211"
  });
  assert.deepEqual(Object.keys(parts).sort(), ["colors", "componentIds", "eyes", "face", "hairBack", "hairFront"].sort());
  assert.deepEqual(parts.componentIds, {
    eyes: "eyes-round-glossy",
    hair: "hair-twin-tails",
    face: "face-angular-defined"
  });
  for (const part of ["hairBack", "face", "hairFront", "eyes"]) {
    assert.match(parts[part], /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(parts[part], /<path/);
    assert.doesNotMatch(parts[part], /KAPIART_FACE_DETAILS/);
  }
  assert.match(parts.hairBack, /#bb5533/i);
  assert.match(parts.hairFront, /#bb5533/i);
  assert.match(parts.face, /#f0c2b0/i);
  assert.match(parts.eyes, /#0099cc/i);
  assert.deepEqual(parts.colors, {
    hair: "#bb5533", eyes: "#0099cc", skin: "#f0c2b0", line: "#332211"
  });
});

test("character composition rejects missing or mismatched feature categories", () => {
  assert.throws(() => createAnimeCharacterParts({
    eyesId: "hair-spiky-short", hairId: "hair-twin-tails", faceId: "face-round-soft"
  }), /one valid eyes, hair and face component/);
  assert.throws(() => createAnimeCharacterParts({
    eyesId: "eyes-round-glossy", hairId: "hair-twin-tails", faceId: "not-a-face"
  }), /one valid eyes, hair and face component/);
});

test("different hair selections produce structurally different character hair layers", () => {
  const bob = createAnimeCharacterParts({
    eyesId: "eyes-almond-elegant", hairId: "hair-straight-bob", faceId: "face-oval-balanced"
  });
  const twinTails = createAnimeCharacterParts({
    eyesId: "eyes-almond-elegant", hairId: "hair-twin-tails", faceId: "face-oval-balanced"
  });
  assert.notEqual(bob.hairBack, twinTails.hairBack);
  assert.notEqual(bob.hairFront, twinTails.hairFront);
  assert.equal(bob.face, twinTails.face);
  assert.equal(bob.eyes, twinTails.eyes);
});
