import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KapiArt visual refinement keeps a coherent cocoa-and-blush design system", async () => {
  const [css, html, app, worker, brandTest] = await Promise.all([
    readFile("styles.css", "utf8"),
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("test/brand-identity.test.mjs", "utf8")
  ]);

  assert.ok(css.includes("KAPIART-VISUAL-REFINEMENT-001"));
  assert.ok(css.includes("--kapi-ink: #241a19;"));
  assert.ok(css.includes("--kapi-surface: #2b211f;"));
  assert.ok(css.includes("--kapi-cream: #fff4eb;"));
  assert.ok(css.includes("--kapi-muted: #dfcbc1;"));
  assert.ok(css.includes("background-image: var(--editor-wallpaper-overlay) !important;"));
  assert.ok(css.includes('.mobile-touch-dock button[aria-pressed="true"]'));
  assert.ok(css.includes('.layers li[data-selected="true"]'));
  assert.ok(css.includes(".brand-launch-action"));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(html.includes('class="mobile-touch-dock"'));
  assert.ok(html.includes('class="brand-mascot"'));
  assert.ok(worker.includes('animeart-web-shell-v82'));
  assert.ok(app.includes('animeart-web-shell-v82'));
  assert.ok(brandTest.includes('animeart-web-shell-v82'));
});
