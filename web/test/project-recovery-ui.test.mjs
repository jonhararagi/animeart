import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("visibility and pagehide recovery listeners are registered once at app startup", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const recoverButtonStart = app.indexOf('recoverButton.addEventListener("click"');
  assert.ok(recoverButtonStart >= 0, "the local recovery button must remain available");
  const recoverButtonBlock = app.slice(recoverButtonStart, app.indexOf("\n});", recoverButtonStart) + 4);
  assert.match(recoverButtonBlock, /restoreStoredProject\(\)/);
  assert.doesNotMatch(recoverButtonBlock, /visibilitychange|pagehide/);
  assert.equal([...app.matchAll(/document\.addEventListener\("visibilitychange"/g)].length, 1);
  assert.equal([...app.matchAll(/window\.addEventListener\("pagehide"/g)].length, 1);
  assert.match(app, /document\.addEventListener\("visibilitychange",\s*\(\)\s*=>\s*\{/);
  assert.match(app, /window\.addEventListener\("pagehide",\s*\(\)\s*=>\s*\{/);
});

test("multipage checkpoints persist and restore the full page collection", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const recovery = await readFile(new URL("../domain/project-recovery.mjs", import.meta.url), "utf8");
  const multipage = await readFile(new URL("../domain/multi-page-project.mjs", import.meta.url), "utf8");
  assert.match(app, /saveMultiPageRecoveryCheckpoint/);
  assert.match(app, /loadMultiPageRecoverySnapshot/);
  assert.match(app, /restoreMultiPageProjectSnapshot/);
  assert.match(recovery, /createMultiPageRecoverySnapshot/);
  assert.match(recovery, /MAX_RECOVERY_MULTIPAGE_PAGES = 10/);
  assert.match(multipage, /export async function restoreMultiPageProjectSnapshot/);
});
