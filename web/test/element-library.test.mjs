import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_CATALOG,
  createDesignElementSvg,
  getDesignElement,
  searchDesignElements
} from "../domain/element-library.mjs";

test("element library contains unique original local SVG resources", () => {
  assert.ok(ELEMENT_CATALOG.length >= 16);
  assert.equal(new Set(ELEMENT_CATALOG.map(element => element.id)).size, ELEMENT_CATALOG.length);
  for (const element of ELEMENT_CATALOG) {
    assert.ok(element.label && element.description && element.keywords);
    const svg = createDesignElementSvg(element.id);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<g|<path|<rect|<circle|<ellipse/);
    assert.match(svg, /<\/svg>$/);
    assert.doesNotMatch(svg, /<image\b|(?:href|xlink:href)=["']https?:\/\//i);
  }
});

test("element search ignores accents and category filtering is deterministic", () => {
  assert.equal(searchDesignElements("dialogo", "Globos y diálogo").length, 3);
  assert.equal(searchDesignElements("viñeta", "Marcos").length, 1);
  assert.ok(searchDesignElements("sakura").some(element => element.id === "sakura-petals"));
  assert.ok(searchDesignElements("neon", "Marcos").some(element => element.id === "frame-neon"));
  assert.deepEqual(searchDesignElements("no existe"), []);
});

test("lookup and SVG generation reject unknown element identifiers", () => {
  assert.equal(getDesignElement("missing-element"), null);
  assert.throws(() => createDesignElementSvg("missing-element"), /Unknown local design element/);
});
