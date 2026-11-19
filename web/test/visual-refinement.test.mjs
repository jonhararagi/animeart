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

  assert.match(css, /KAPIART-VISUAL-REFINEMENT-001/);
  assert.match(css, /--kapi-ink:\\s*#241a19/i);
  assert.match(css, /--kapi-surface:\\s*#2b211f/i);
  assert.match(css, /--kapi-cream:\\s*#fff4eb/i);
  assert.match(css, /--kapi-muted:\\s*#dfcbc1/i);
  assert.match(css, /--editor-wallpaper-overlay/);
  assert.match(css, /\.canvas-wrap \\{[\\s\\S]*?background-image:\\s*var\\(--editor-wallpaper-overlay\\)/);
  assert.match(css, /\.mobile-touch-dock button\\[aria-pressed="true"\\]/);
  assert.match(css, /\.layers li\\[data-selected="true"\\]/);
  assert.match(css, /\.brand-launch-action/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /class="mobile-touch-dock"/);
  assert.match(html, /class="brand-mascot"/);
  assert.match(worker, /animeart-web-shell-v82/);
  assert.match(app, /animeart-web-shell-v82/);
  assert.match(brandTest, /animeart-web-shell-v82/);
});
