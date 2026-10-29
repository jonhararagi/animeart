import test from "node:test";
import assert from "node:assert/strict";
import { createTextLayer } from "../domain/model.mjs";
import {
  BRAND_KIT_MAX_COLORS,
  BRAND_KIT_MAX_LOGOS,
  BRAND_KIT_MAX_SERIALIZED_CHARS,
  BRAND_KIT_MAX_TEXT_STYLES,
  BRAND_KIT_STORAGE_KEY,
  addBrandColor,
  addBrandLogo,
  addBrandTextStyle,
  createEmptyBrandKit,
  extractBrandTextStyle,
  loadBrandKit,
  normalizeBrandKit,
  removeBrandColor,
  removeBrandLogo,
  removeBrandTextStyle,
  renameBrandKit,
  saveBrandKit
} from "../domain/brand-kit.mjs";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("brand kit normalizes a safe local-first profile and discards malformed records", () => {
  const kit = normalizeBrandKit({
    version: 999,
    name: " KapiStudio\u0000 ",
    colors: [{ id: "c1", name: " Rosa ", value: "#F2A2A0" }, { name: "invalid", value: "url(javascript:alert(1))" }],
    textStyles: [{ id: "s1", name: "Título", style: { fontFamily: "Impact", fontSize: 70, color: "#ff44aa", letterSpacing: 1.5 } }],
    logos: [{ id: "bad", name: "SVG remoto", source: "data:image/svg+xml,<svg/>", width: 10, height: 10 }]
  });
  assert.equal(kit.version, 1);
  assert.equal(kit.name, "KapiStudio");
  assert.equal(kit.colors.length, 1);
  assert.equal(kit.colors[0].value, "#f2a2a0");
  assert.equal(kit.textStyles.length, 1);
  assert.equal(kit.textStyles[0].style.fontFamily, "Impact");
  assert.equal(kit.textStyles[0].style.letterSpacing, 1.5);
  assert.equal(kit.logos.length, 0, "brand logos cannot load arbitrary SVG or remote image data");
});

test("brand colors are added, deduplicated, removed and bounded", () => {
  let kit = createEmptyBrandKit();
  kit = addBrandColor(kit, { name: "Coral", value: "#F2A2A0" });
  assert.equal(kit.colors.length, 1);
  assert.throws(() => addBrandColor(kit, { name: "Coral duplicate", value: "#f2a2a0" }), /ya está guardado/i);
  assert.throws(() => addBrandColor(kit, { name: "", value: "#ffffff" }), /nombre y un color hexadecimal válido/i);
  for (let index = 1; index < BRAND_KIT_MAX_COLORS; index += 1) {
    kit = addBrandColor(kit, { name: "Color " + index, value: "#" + index.toString(16).padStart(2, "0") + "34aa" });
  }
  assert.equal(kit.colors.length, BRAND_KIT_MAX_COLORS);
  assert.throws(() => addBrandColor(kit, { name: "Extra", value: "#123456" }), /hasta 12/i);
  kit = removeBrandColor(kit, kit.colors[0].id);
  assert.equal(kit.colors.length, BRAND_KIT_MAX_COLORS - 1);
});

test("brand text styles preserve bounded typography but never replace editable text or position", () => {
  let kit = createEmptyBrandKit();
  const layer = createTextLayer("Título editable", {
    value: "Portada Sakura", fontFamily: "Arial Black", fontSize: 82,
    fontWeight: "bold", color: "#ffffff", outlineColor: "#241a19",
    outlineWidth: 3, shadowColor: "#000000", shadowBlur: 8,
    letterSpacing: 1.2, lineHeight: 0.95
  });
  const style = extractBrandTextStyle(layer.text);
  kit = addBrandTextStyle(kit, { name: "Título principal", style: layer.text });
  assert.equal(kit.textStyles.length, 1);
  assert.equal(kit.textStyles[0].style.fontSize, 82);
  assert.equal(kit.textStyles[0].style.outlineWidth, 3);
  assert.equal(kit.textStyles[0].style.letterSpacing, 1.2);
  assert.equal("value" in kit.textStyles[0].style, false);
  assert.equal("x" in kit.textStyles[0].style, false);
  assert.equal("y" in kit.textStyles[0].style, false);
  assert.deepEqual(style, kit.textStyles[0].style);
  assert.throws(() => addBrandTextStyle(kit, { name: "tÍTULO PRINCIPAL", style }), /ya existe/i);
  assert.throws(() => addBrandTextStyle(kit, { name: "Unsupported font", style: { ...style, fontFamily: "Fake Font" } }), /capa de texto y escribe un nombre/i);
  kit = removeBrandTextStyle(kit, kit.textStyles[0].id);
  assert.equal(kit.textStyles.length, 0);
});

test("brand kit stores only bounded raster logos and limits the count and payload size", () => {
  let kit = createEmptyBrandKit();
  const logo = { name: "Logo Kapi", source: "data:image/png;base64,AA==", width: 128, height: 128 };
  kit = addBrandLogo(kit, logo);
  assert.equal(kit.logos.length, 1);
  assert.equal(kit.logos[0].source, logo.source);
  assert.throws(() => addBrandLogo(kit, { ...logo, name: "External SVG", source: "data:image/svg+xml,<svg/>" }), /PNG, JPEG o WebP/i);
  assert.throws(() => addBrandLogo(kit, { ...logo, name: "Big", source: "data:image/png;base64," + "A".repeat(300_001) }), /300 KB/i);
  assert.throws(() => addBrandLogo(kit, { ...logo, width: 9000, height: 10 }), /PNG, JPEG o WebP/i);
  for (let index = 2; index <= BRAND_KIT_MAX_LOGOS; index += 1) {
    kit = addBrandLogo(kit, { ...logo, name: "Logo " + index });
  }
  assert.equal(kit.logos.length, BRAND_KIT_MAX_LOGOS);
  assert.throws(() => addBrandLogo(kit, { ...logo, name: "Logo extra" }), /hasta 4/i);
  kit = removeBrandLogo(kit, kit.logos[0].id);
  assert.equal(kit.logos.length, BRAND_KIT_MAX_LOGOS - 1);
});

test("brand kit persists locally, reloads deterministically and fails safely on corrupt storage", () => {
  const storage = memoryStorage();
  let kit = createEmptyBrandKit("Identidad Sakura");
  kit = addBrandColor(kit, { name: "Coral", value: "#f2a2a0" });
  kit = addBrandTextStyle(kit, { name: "Título", style: createTextLayer("Título").text });
  const saved = saveBrandKit(kit, storage);
  assert.ok(storage.values.has(BRAND_KIT_STORAGE_KEY));
  assert.equal(loadBrandKit(storage).name, "Identidad Sakura");
  assert.deepEqual(loadBrandKit(storage), saved);
  assert.equal(BRAND_KIT_MAX_SERIALIZED_CHARS, 1_500_000);
  assert.equal(loadBrandKit(memoryStorage({ [BRAND_KIT_STORAGE_KEY]: "{bad json" })).colors.length, 0);
  assert.throws(() => renameBrandKit(saved, "   "), /nombre/i);
  const brokenStorage = { getItem() { return null; }, setItem() { throw new Error("quota"); } };
  assert.throws(() => saveBrandKit(saved, brokenStorage), /could not be saved|No se pudo guardar/i);
});

test("brand kit normalization enforces style and color collection ceilings", () => {
  const colors = Array.from({ length: 20 }, (_, index) => ({ id: "color-" + index, name: "C" + index, value: "#" + index.toString(16).padStart(2, "0") + "2233" }));
  const textStyles = Array.from({ length: 25 }, (_, index) => ({ id: "style-" + index, name: "Style " + index, style: createTextLayer("t").text }));
  const kit = normalizeBrandKit({ colors, textStyles });
  assert.equal(kit.colors.length, BRAND_KIT_MAX_COLORS);
  assert.equal(kit.textStyles.length, BRAND_KIT_MAX_TEXT_STYLES);
});
