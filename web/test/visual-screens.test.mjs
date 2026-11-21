import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KapiArt home, design library and creative catalog share one visual identity", async () => {
  const [html, css, app] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("styles.css", "utf8"),
    readFile("app.js", "utf8")
  ]);

  for (const marker of [
    "home-panel-eyebrow",
    "brand-launchpad",
    "brand-share-action",
    'id="design-library-dialog"',
    'id="design-library-list"',
    'id="project-recovery-list"',
    'id="creative-studio-dialog"',
    'id="creative-catalog-grid"'
  ]) {
    assert.ok(html.includes(marker), "missing product surface: " + marker);
  }

  for (const marker of [
    "KAPIART-VISUAL-REFINEMENT-002",
    "#design-library-dialog",
    ".design-library-card",
    ".project-recovery-panel",
    "#creative-studio-dialog",
    ".creative-studio-tabs button[aria-selected=\"true\"]",
    ".creative-card-preview-covers",
    ".mobile-touch-dock"
  ]) {
    assert.ok(css.includes(marker), "missing shared visual style: " + marker);
  }

  assert.ok(app.includes("function renderDesignLibrary()"));
  assert.ok(app.includes("function renderCreativeCatalog()"));
  assert.ok(app.includes("button.dataset.designAction=action"));
  assert.ok(app.includes("card.dataset.creativeAction=actionName"));
  assert.ok(css.includes("#design-library-dialog[open]"));
});
