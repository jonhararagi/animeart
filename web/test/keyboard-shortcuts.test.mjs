import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("T046 standard image-editor keyboard shortcuts call existing editing actions", async () => {
  const [html, app] = await Promise.all([readFile("index.html", "utf8"), readFile("app.js", "utf8")]);
  assert.ok(app.includes("handleEditorKeyboardShortcuts"));
  assert.ok(app.includes("document.addEventListener(\"keydown\", handleEditorKeyboardShortcuts)"));
  assert.ok(app.includes("exportPngButton.click()"));
  assert.ok(app.includes("projectFileInput.click()"));
  assert.ok(app.includes("state.history.record(before, next)"));
  assert.ok(html.includes("title=\"Undo (Ctrl/Cmd+Z)\""));
  assert.ok(html.includes("title=\"Save locally (Ctrl/Cmd+S)\""));
  assert.ok(html.includes("title=\"Export image (Ctrl/Cmd+E)\""));
});
