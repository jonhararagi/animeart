import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opening index.html with file:// displays an actionable warning instead of silently inert controls", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /location\.protocol === "file:"/);
  assert.match(html, /local-file-protocol-warning/);
  assert.match(html, /START_ANIMEART\.bat/);
  assert.match(html, /http:\/\/127\.0\.0\.1:4173\//);
  assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
});

test("the Web folder includes a Windows launcher that serves ES modules over localhost", async () => {
  const launcher = await readFile("START_ANIMEART.bat", "utf8");
  assert.match(launcher, /where node/);
  assert.match(launcher, /node scripts\\serve\.mjs/);
  assert.match(launcher, /http:\/\/127\.0\.0\.1:4173\//);
});
