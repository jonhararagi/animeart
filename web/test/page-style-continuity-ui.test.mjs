import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument, createTextLayer } from "../domain/model.mjs";
import { applyTextStyleToPage } from "../domain/page-style-continuity.mjs";

test("page style continuity is wired into the mobile-friendly multipage manager and offline shell", async () => {
  const [html, app, worker, android] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/android.yml", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="multi-page-copy-text-style"/);
  assert.match(html, /Reutilizar estilo de texto/);
  assert.match(app, /applySelectedTextStyleToAnotherPage/);
  assert.match(app, /applyTextStyleToPage/);
  assert.match(worker, /animeart-web-shell-v79/);
  assert.match(worker, /page-style-continuity\.mjs/);
  assert.match(android, /page-style-continuity\.mjs/);
});

test("shared style helper rejects a source layer that does not exist", () => {
  const source = createDocument(64, 64);
  const target = createDocument(64, 64);
  source.layers = [createTextLayer("Título", { value: "Anime" })];
  assert.equal(applyTextStyleToPage(source, target, "missing").ok, false);
});
