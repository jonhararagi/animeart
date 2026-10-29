import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, createTextLayer } from "../domain/model.mjs";
import { applyTextStyleToPage } from "../domain/page-style-continuity.mjs";

test("shared text style carries typography and effects across pages without replacing copy or placement", () => {
  const source = createDocument(1080, 1350);
  const heading = createTextLayer("Título", {
    value: "Capítulo 1", x: 200, y: 120, fontSize: 76, fontFamily: "Georgia",
    fontWeight: "bold", color: "#e6817b", align: "center", letterSpacing: 2,
    lineHeight: 1.4, outlineColor: "#241a19", outlineWidth: 3,
    shadowColor: "#000000", shadowBlur: 6, shadowOffsetX: 2, shadowOffsetY: 3
  });
  source.layers = [heading];

  const target = createDocument(1080, 1350);
  const first = createTextLayer("Subtítulo", { value: "Otro texto", x: 45, y: 250, fontSize: 22, color: "#172335" });
  const second = createTextLayer("Nota", { value: "No perder posición", x: 300, y: 500, fontSize: 16, color: "#172335" });
  const locked = createTextLayer("Protegido", { value: "Mantener intacto", x: 10, y: 10, fontSize: 18 });
  locked.locked = true;
  target.layers = [first, second, locked];

  const result = applyTextStyleToPage(source, target, heading.id);
  assert.equal(result.ok, true);
  assert.equal(result.updatedCount, 2);
  assert.equal(result.document.layers[0].text.value, "Otro texto");
  assert.equal(result.document.layers[0].text.x, 45);
  assert.equal(result.document.layers[0].text.y, 250);
  assert.equal(result.document.layers[0].text.fontSize, 76);
  assert.equal(result.document.layers[0].text.fontFamily, "Georgia");
  assert.equal(result.document.layers[0].text.color, "#e6817b");
  assert.equal(result.document.layers[0].text.outlineWidth, 3);
  assert.equal(result.document.layers[1].text.value, "No perder posición");
  assert.equal(result.document.layers[1].text.x, 300);
  assert.equal(result.document.layers[1].text.y, 500);
  assert.equal(result.document.layers[1].text.fontSize, 76);
  assert.equal(result.document.layers[2].text.fontSize, 18);
  assert.equal(result.document.layers[2].text.value, "Mantener intacto");
  assert.equal(target.layers[1].text.fontSize, 22);
});

test("shared text style rejects missing, non-text, and incompatible layers clearly", () => {
  const source = createDocument(32, 32);
  source.layers = [createTextLayer("Título", { value: "Estilo" })];
  const target = createDocument(32, 32);
  target.layers = [createTextLayer("Bloqueado", { value: "No editar" })];
  target.layers[0].locked = true;
  assert.equal(applyTextStyleToPage(source, target, "missing").ok, false);
  assert.match(applyTextStyleToPage(source, target, source.layers[0].id).error, /no contiene textos/i);
  assert.equal(applyTextStyleToPage(source, target, "missing",).updatedCount, 0);
});
