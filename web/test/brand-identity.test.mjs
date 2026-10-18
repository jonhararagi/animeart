import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("AnimeArt's identity and quick actions are discoverable and available offline", async () => {
  const [html, css, manifest, icon, catalog, app, worker] = await Promise.all([
    readFile("index.html", "utf8"), readFile("styles.css", "utf8"),
    readFile("manifest.webmanifest", "utf8"), readFile("icons/animeart-mark.svg", "utf8"),
    readFile("domain/creative-catalog.mjs", "utf8"), readFile("app.js", "utf8"),
    readFile("service-worker.js", "utf8")
  ]);
  for (const id of ["home-create-cover", "home-add-title", "home-open-stickers", "home-import-image"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /class="brand-mark"/);
  assert.match(html, /STUDIO CREATIVO · ANIME &amp; NEÓN/);
  assert.match(css, /AA-BRAND-001/);
  assert.match(css, /\.brand-launchpad/);
  assert.match(manifest, /"name": "AnimeArt Studio/);
  assert.match(manifest, /animeart-mark\.svg/);
  assert.match(icon, /<svg/);
  assert.match(icon, /#ff4fd8/i);
  assert.match(icon, /#00eaff/i);
  assert.match(catalog, /id:"neon-vanguard"/);
  assert.match(catalog, /id:"neon-valkyrie"/);
  assert.match(app, /function initializeBrandLaunchpad\(/);
  assert.match(worker, /animeart-web-shell-v45/);
  assert.match(worker, /\.\/icons\/animeart-mark\.svg/);
});
