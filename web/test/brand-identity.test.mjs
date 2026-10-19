import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KapiArt's identity, mascot and quick actions are discoverable and available offline", async () => {
  const [html, css, manifest, icon, mascot, catalog, app, worker] = await Promise.all([
    readFile("index.html", "utf8"), readFile("styles.css", "utf8"),
    readFile("manifest.webmanifest", "utf8"), readFile("icons/animeart-mark.svg", "utf8"), readFile("assets/kapiart-mascot.png"),
    readFile("domain/creative-catalog.mjs", "utf8"), readFile("app.js", "utf8"),
    readFile("service-worker.js", "utf8")
  ]);
  for (const id of ["home-create-cover", "home-add-title", "home-open-stickers", "home-import-image"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /class="brand-mascot"/);
  assert.match(html, /ARTE ANIME · CUTE STUDIO/);
  assert.match(css, /AA-BRAND-001/);
  assert.match(css, /KAPIART-CUTE-BRAND-001/);
  assert.match(css, /--brand-cocoa:\s*#4c352f/i);
  assert.match(css, /\.brand-launchpad/);
  assert.match(manifest, /"name": "KapiArt Studio/);
  assert.match(manifest, /animeart-mark\.svg/);
  assert.match(icon, /<svg/);
  assert.match(icon, /#f2a2a0/i);
  assert.doesNotMatch(icon, /#00eaff/i);
  assert.ok(mascot.length > 100_000, "the supplied mascot should be bundled for offline use");
  assert.match(catalog, /id:"neon-vanguard"/);
  assert.match(catalog, /id:"neon-valkyrie"/);
  assert.match(app, /function initializeBrandLaunchpad\(/);
  assert.match(worker, /animeart-web-shell-v50/);
  assert.match(worker, /\.\/icons\/animeart-mark\.svg/);
});


test("external sharing is optional, hands off a flat image and keeps the editor local", async () => {
  const [html, app, activity, manifest, paths, workflow] = await Promise.all([
    readFile("index.html", "utf8"), readFile("app.js", "utf8"),
    readFile("../app/src/main/java/com/jonhararagi/animeart/MainActivity.kt", "utf8"),
    readFile("../app/src/main/AndroidManifest.xml", "utf8"),
    readFile("../app/src/main/res/xml/file_paths.xml", "utf8"),
    readFile("../.github/workflows/android.yml", "utf8")
  ]);
  assert.match(html, /id="share-current-design"/);
  assert.match(html, /Canva u otra app, solo si tú la eliges/);
  assert.match(app, /async function shareBlobToDevice\(/);
  assert.match(app, /async function shareCurrentDesign\(/);
  assert.match(app, /querySelector\("#share-current-design"\)\?\.addEventListener\("click", shareCurrentDesign\)/);
  assert.match(app, /nativeBridge\.shareFile\(/);
  assert.match(app, /navigator\.share\(/);
  assert.match(activity, /fun shareFile\(/);
  assert.match(activity, /Intent\.createChooser\(sendIntent, "Compartir diseño de KapiArt"\)/);
  assert.match(activity, /FileProvider\.getUriForFile/);
  assert.match(manifest, /android\.support\.FILE_PROVIDER_PATHS/);
  assert.match(paths, /animeart-share\//);
  assert.match(workflow, /res\/xml\/file_paths\.xml/);
});

 
test("AA-A11Y-CONTRAST-001 keeps interface text readable and adapts accent-button text", async () => {
  const [html, css, appearance] = await Promise.all([
    readFile("index.html", "utf8"), readFile("styles.css", "utf8"), readFile("appearance-settings.js", "utf8")
  ]);
  assert.match(html, /id="text-color" type="color" value="#f7f5fc"/);
  assert.match(css, /AA-A11Y-CONTRAST-001/);
  assert.match(css, /--text:\s*#f5f7ff/i);
  assert.match(css, /--muted:\s*#bdcbe0/i);
  assert.match(css, /\.tool-group-label,[\s\S]*?color:\s*#bdcbe0/i);
  assert.match(css, /#text-edit-dialog #text-content::placeholder\s*\{\s*color:\s*#b7c5d9;\s*opacity:\s*1;/i);
  assert.match(css, /color:\s*var\(--accent-contrast, #000000\)/i);
  assert.match(appearance, /export function getAccentTextColor\(/);
  assert.match(appearance, /setProperty\("--accent-contrast", getAccentTextColor\(settings\.accent\)\)/);
});
