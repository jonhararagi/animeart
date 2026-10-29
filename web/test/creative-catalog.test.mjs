import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CREATIVE_TEMPLATES, STICKER_CATALOG, WORD_ART_PRESETS, STYLE_PACKS,
  createPosterSvg, createStickerSvg, svgDataUrl, getCreativeTemplate,
  getSticker, getWordArtPreset
} from "../domain/creative-catalog.mjs";
import { ANIME_STYLE_COMPONENTS, searchAnimeStyleComponents, createAnimeStyleComponentSvg, createAnimeCharacterParts } from "../domain/anime-style-library.mjs";

test("original cover catalog provides anime, galaxy, manga, romance and cyberpunk themes",()=>{
  assert.ok(CREATIVE_TEMPLATES.length>=25,"template library has grown beyond the starter cover set");
  assert.equal(new Set(CREATIVE_TEMPLATES.map(item=>item.id)).size,CREATIVE_TEMPLATES.length,"template IDs remain unique");
  for(const template of CREATIVE_TEMPLATES)if(template.defaultFormat)assert.ok(["portrait","square","story","banner"].includes(template.defaultFormat),template.id+" has a supported default format");
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
  for(const [id,format] of [["social-square-kawaii","square"],["story-heroine","story"],["youtube-anime-thumb","banner"],["manga-page","portrait"],["phone-wallpaper","story"]]){
    assert.equal(getCreativeTemplate(id)?.defaultFormat,format,id+" chooses its intended canvas format");
  }
  for(const category of ["Redes sociales","Historias","Miniaturas","Fondos","Personajes","Libros","Eventos","Invitaciones","Frases","Música","Educación","Comunidad"]){
    assert.ok(CREATIVE_TEMPLATES.some(item=>item.category===category),"template library includes "+category);
  }
});

test("creative studio UI is discoverable, searchable, offline-ready and packaged in Android",async()=>{
  const [html,app,css,worker,android]=await Promise.all([
    readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("styles.css","utf8"),
    readFile("service-worker.js","utf8"),readFile("../.github/workflows/android.yml","utf8")
  ]);
  for(const tab of ["covers","stickers","words","packs","traits"])assert.match(html,new RegExp('data-creative-tab="'+tab+'"'));
  for(const id of ["creative-studio-dialog","creative-catalog-grid","creative-catalog-search","creative-cover-title","creative-cover-subtitle","creative-create-cover","quick-open-creative-studio","creative-traits-controls","creative-trait-part","creative-trait-add-selected","creative-character-composer","creative-trait-create-character","creative-character-status","creative-trait-hair-color","creative-trait-eye-color","creative-trait-skin-color","creative-trait-line-color"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/function addCreativeStickerLayer\(/);
  assert.match(app,/function addCreativeWordArt\(/);
  assert.match(app,/function applyCreativeStylePack\(/);
  assert.match(app,/createPosterSvg\(/);
  assert.match(app,/addSelectedAnimeStyleReferences\(/);
  assert.match(app,/function createAnimeCharacterFromSelectedTraits\(/);
  assert.match(app,/createAnimeCharacterParts\(/);
  assert.match(app,/layer\.isReference=false/);
  assert.match(css,/creative-character-composer/);
  assert.equal(Object.keys(createAnimeCharacterParts({eyesId:"eyes-round-glossy",hairId:"hair-twin-tails",faceId:"face-round-soft"})).filter(key=>["hairBack","face","hairFront","eyes","expression"].includes(key)).length,5);
  assert.match(app,/createAnimeStyleComponentSvg\(/);
  assert.match(app,/searchAnimeStyleComponents\(/);
  assert.match(worker,/anime-style-library\.mjs/);
  assert.ok(android.includes('test -s "$WEB/domain/anime-style-library.mjs"'));
  assert.ok(android.includes('test -s "$WEB/domain/design-alignment.mjs"'));
  assert.ok(android.includes('test -s "$WEB/domain/design-library.mjs"'));
  assert.ok(android.includes('test -s "$WEB/domain/multi-page-project.mjs"'));
  assert.ok(android.includes('test -s "$WEB/domain/element-library.mjs"'));
  assert.match(html,/data-creative-tab="elements"/);
  assert.match(html,/id="creative-element-category"/);
  assert.match(html,/id="creative-element-favorites-only"/);
  assert.match(app,/function addCreativeElementLayer\(/);
  assert.match(app,/toggleCreativeElementFavorite\(/);
  assert.match(css,/KAPIART-ELEMENT-LIBRARY-001/);
  assert.match(html,/id="multi-page-dialog"/);
  assert.match(html,/id="quick-open-page-manager"/);
  assert.match(html,/id="multi-page-copy-layer"/);
  assert.match(html,/id="multi-page-export-pdf"/);
  assert.match(app,/async function exportActiveMultiPagePdf\(/);
  assert.match(app,/buildMultiPagePdf\(pdfPages\)/);
  assert.match(app,/from "\.\/domain\/pdf-export\.mjs"/);
  assert.match(app,/"\.\/domain\/pdf-export\.mjs"/);
  assert.match(worker,/animeart-web-shell-v78/);
  assert.match(worker,/\.\/domain\/pdf-export\.mjs/);
  assert.match(app,/function activateMultiPagePage\(/);
  assert.match(app,/function copySelectedLayerToAnotherPage\(/);
  assert.match(css,/KAPIART-MULTIPAGE-001/);
  assert.match(html,/id="text-letter-spacing"/);
  assert.match(html,/id="text-line-height"/);
  assert.match(html,/id="saved-text-styles"/);
  assert.match(app,/function drawTextWithLetterSpacing\(/);
  assert.match(app,/function saveSelectedTextStyle\(/);
  assert.match(css,/KAPIART-TYPOGRAPHY-001/);
  assert.match(html,/id="design-library-dialog"/);
  assert.match(html,/id="quick-open-design-library"/);
  assert.match(html,/data-layer-align="distribute-horizontal"/);
  assert.match(html,/id="layer-group-selection"/);
  assert.match(html,/id="layer-ungroup-selection"/);
  assert.match(html,/id="layer-grouping-status"/);
  assert.match(app,/function applyGroupSelection\(/);
  assert.match(app,/function applyUngroupSelection\(/);
  assert.match(app,/groupLayers, transformLayers/);
  assert.match(app,/layer\.groupId \? " \[Grupo\]"/);
  assert.match(css,/KAPIART-LAYER-GROUPS-001/);
  assert.ok(android.includes('test -s "web/test/layer-groups.test.mjs"'));
  assert.match(app,/function initializeCanvaWorkflowTools\(/);
  assert.match(app,/animeart-web-shell-v78/);
  assert.match(css,/KAPIART-CANVA-WORKFLOW-001/);
  assert.equal(ANIME_STYLE_COMPONENTS.length,16);
  assert.equal(searchAnimeStyleComponents("coletas","hair").length,1);
  assert.equal(searchAnimeStyleComponents("expresión","expression").length,4);
  assert.match(createAnimeStyleComponentSvg("hair-twin-tails"),/<path/);
  assert.match(css,/AA-CREATIVE-STUDIO-001/);
  assert.match(worker,/animeart-web-shell-v78/);
  assert.match(worker,/\.\/domain\/creative-catalog\.mjs/);
  assert.match(android, /test -s "\$WEB\/domain\/creative-catalog\.mjs"/);
  assert.match(android, /test -s "\$WEB\/domain\/canvas-rendering\.mjs"/);
  assert.match(android, /AA-CYBERPUNK-UI-003/);
});


test("expanded KapiArt template library covers practical creator workflows with supported formats", () => {
  const additions = [
    ["stream-overlay-kawaii", "square"],
    ["character-dossier", "portrait"],
    ["study-notes", "story"],
    ["novel-volume", "portrait"],
    ["manga-chapter-opener", "portrait"],
    ["event-poster-pastel", "portrait"],
    ["creator-banner", "banner"],
    ["character-relationship", "banner"],
    ["phone-wallpaper-neon", "story"],
    ["product-promo-kawaii", "square"]
  ];
  for (const [id, format] of additions) {
    const template = getCreativeTemplate(id);
    assert.ok(template, "missing new template " + id);
    assert.equal(template.defaultFormat, format, id + " uses a supported default format");
    assert.ok(template.label && template.description && template.keywords, id + " is searchable and described");
    assert.ok(template.defaultTitle && template.defaultSubtitle, id + " starts with editable copy");
    assert.match(template.background, /^#[0-9a-f]{6}$/i);
    assert.match(template.accent, /^#[0-9a-f]{6}$/i);
    assert.ok(template.titleStyle && template.subtitleStyle, id + " defines typography");
  }
  assert.equal(new Set(CREATIVE_TEMPLATES.map(item => item.id)).size, CREATIVE_TEMPLATES.length);
  for (const category of ["Creadores", "Personajes", "Educación", "Libros", "Manga", "Eventos", "Fondos de pantalla", "Tiendas"]) {
    assert.ok(CREATIVE_TEMPLATES.some(item => item.category === category), "missing category " + category);
  }
});
