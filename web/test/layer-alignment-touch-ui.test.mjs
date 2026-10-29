import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("layer alignment controls keep comfortable touch targets on phones", () => {
  assert.match(styles, /\.layer-alignment-grid button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /@media\s*\(max-width:\s*720px\)\s*\{[^}]*\.layer-alignment-grid button\s*\{[^}]*min-height:\s*46px/s);
});
