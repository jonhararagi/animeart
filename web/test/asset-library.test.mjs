import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

test("bundled character sample has verified source, CC0 license and an import control", async () => {
  const [html, app, worker, sources, asset] = await Promise.all([
    readFile("index.html", "utf8"),
    readFile("app.js", "utf8"),
    readFile("service-worker.js", "utf8"),
    readFile("assets/ASSET_SOURCES.md", "utf8"),
    readFile("assets/cc0-detailed-anime-character.png.base64", "utf8")
  ]);
  const metadata = await stat("assets/cc0-detailed-anime-character.png.base64");

  assert.match(html, /id="add-sample-character"/);
  assert.match(app, /fetch\("\.\/assets\/cc0-detailed-anime-character\.png\.base64"\)/);
  assert.match(app, /new File\(\[bytes\], "battleworn_knight\.png"/);
  assert.match(app, /importImageIntoEditor\(file, "CC0 character sample added"\)/);
  assert.ok(worker.includes("./assets/cc0-detailed-anime-character.png.base64"));
  assert.ok(worker.includes("./assets/ASSET_SOURCES.md"));
  assert.match(sources, /SpriteCook\/spritecook-free-game-assets/);
  assert.match(sources, /CC0 1\.0 Universal/);
  assert.match(sources, /45a20ccca3921a58f22b06ad9bd0c123d9b82708/);
  assert.match(asset.slice(0, 24), /^iVBORw0KGgo/);
  assert.ok(metadata.size > 900_000 && metadata.size < 1_000_000);
});
