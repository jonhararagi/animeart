import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CREATIVE_TEMPLATES, STICKER_CATALOG, WORD_ART_PRESETS, STYLE_PACKS,
  createPosterSvg, createStickerSvg, svgDataUrl, getCreativeTemplate,
  getSticker, getWordArtPreset
} from "../domain/creative-catalog.mjs";

test("original cover catalog provides anime, galaxy, manga, romance and cyberpunk themes",()=>{
  assert.ok(CREATIVE_TEMPLATES.length>=10);
  for(const category of ["Anime","Galaxia","Manga","Romance","Cyberpunk"])assert.ok(CREATIVE_TEMPLATES.some(item=>item.category===category),"catalog includes "+category);
  for(const template of CREATIVE_TEMPLATES){
    assert.match(template.background,/^#[0-9a-f]{6}$/i);
    assert.match(template.accent,/^#[0-9a-f]{6}$/i);
    assert.ok(template.defaultTitle&&template.defaultSubtitle);
    assert.ok(template.titleStyle.outlineWidth>0);
    assert.ok(template.subtitleStyle.fontFamily);
    assert.ok(createPosterSvg(360,460,template.background,template.accent,template.id).startsWith("<svg"));
  }
});

test("sticker catalog generates local standalone vector assets with unique IDs",()=>{
  assert.ok(STICKER_CATALOG.length>=18);
  assert.equal(new Set(STICKER_CATALOG.map(item=>item.id)).size,STICKER_CATALOG.length);
  for(const sticker of STICKER_CATALOG){
    const svg=createStickerSvg(sticker.id);
    assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="256" height="256"/);
    assert.match(svg,/<defs>/);
    assert.ok(svgDataUrl(svg).startsWith("data:image/svg+xml;charset=utf-8,"));
    assert.equal(svg.includes("<image "),false,"sticker art is vector-only and doesn't need remote bitmap data");
  }
  assert.throws(()=>createStickerSvg("not-a-sticker"),/Unknown sticker preset/);
});

test("six original anime character stickers are transparent local SVGs",()=>{
 for(const id of ["neon-prodigy","chrome-ronin","holo-oracle","mecha-idol","kitsune-protocol","spirit-fox"]){
  const asset=getSticker(id);assert.ok(asset,"missing sticker "+id);assert.equal(asset.category,"Personajes originales");
  const svg=createStickerSvg(id);assert.match(svg,/<svg[^>]+viewBox="0 0 256 256"/);assert.match(svg,/<path/);
  assert.equal(svg.includes("<image "),false);assert.ok(svgDataUrl(svg).startsWith("data:image/svg+xml;charset=utf-8,"));
 }
});

test("original sticker catalog carries a premium anime-ink detail pass while remaining offline vector art", () => {
  for (const sticker of STICKER_CATALOG) {
    const svg = createStickerSvg(sticker.id);
    assert.match(svg, /data-sticker-detail="anime-ink-02"/, sticker.id + " has layered finishing details");
    assert.ok((svg.match(/stroke-width=/g) || []).length >= 3, sticker.id + " keeps editable vector linework");
    assert.equal(svg.includes("<image "), false, sticker.id + " does not fetch or embed remote artwork");
  }
});

test("word-art presets have real typography settings and style packs reference existing components",()=>{
  assert.ok(WORD_ART_PRESETS.length>=8);
  for(const preset of WORD_ART_PRESETS){
    assert.ok(preset.sample.length>0);
    assert.match(preset.style.color,/^#[0-9a-f]{6}$/i);
    assert.match(preset.style.outlineColor,/^#[0-9a-f]{6}$/i);
    assert.ok(preset.style.outlineWidth>0);
  }
  for(const pack of STYLE_PACKS){
    assert.ok(getWordArtPreset(pack.titlePreset),pack.id+" has title preset");
    assert.ok(getWordArtPreset(pack.subtitlePreset),pack.id+" has subtitle preset");
    assert.ok(getSticker(pack.stickerId),pack.id+" has sticker");
    assert.equal(pack.colors.length,3);
  }
  assert.equal(getCreativeTemplate("galactic-dream").label,"Sueño galáctico");
});

test("creative studio UI is discoverable, searchable, offline-ready and packaged in Android",async()=>{
  const [html,app,css,worker,android]=await Promise.all([
    readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("styles.css","utf8"),
    readFile("service-worker.js","utf8"),readFile("../.github/workflows/android.yml","utf8")
  ]);
  for(const tab of ["covers","stickers","words","packs"])assert.match(html,new RegExp('data-creative-tab="'+tab+'"'));
  for(const id of ["creative-studio-dialog","creative-catalog-grid","creative-catalog-search","creative-cover-title","creative-cover-subtitle","creative-create-cover","quick-open-creative-studio"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/function addCreativeStickerLayer\(/);
  assert.match(app,/function addCreativeWordArt\(/);
  assert.match(app,/function applyCreativeStylePack\(/);
  assert.match(app,/createPosterSvg\(/);
  assert.match(css,/AA-CREATIVE-STUDIO-001/);
  assert.match(worker,/animeart-web-shell-v61/);
  assert.match(worker,/\.\/domain\/creative-catalog\.mjs/);
  assert.match(android, /test -s "\$WEB\/domain\/creative-catalog\.mjs"/);
  assert.match(android, /test -s "\$WEB\/domain\/canvas-rendering\.mjs"/);
  assert.match(android, /AA-CYBERPUNK-UI-003/);
});
