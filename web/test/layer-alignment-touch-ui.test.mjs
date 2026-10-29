import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("layer alignment controls keep comfortable touch targets on phones", () => {
  assert.ok(styles.includes(".layer-alignment-grid button { min-height: 44px; }"));
  assert.ok(styles.includes(".layer-alignment-grid button { min-height: 46px; padding-inline: 0.65rem; }"));
  assert.ok(styles.includes("@media (max-width: 720px) {"));
});
