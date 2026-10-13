import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("beginner panel and censor controls are connected to the canonical editor", async () => {
 const html = await readFile("index.html","utf8");
 const app = await readFile("app.js","utf8");
 for (const goal of ["crop","background","erase","censor","draw","text","color","layers","undo","export"]) assert.ok(html.includes(`data-edit-goal="${goal}"`));
 assert.ok(html.includes("id=\"editing-help-enabled\""));
 assert.ok(html.includes("id=\"censor-light-size\""));
 assert.ok(html.includes("data-censor-preset=\"point\""));
 assert.ok(app.includes("function runEditGoal(goal)"));
 assert.ok(app.includes("const censor = state.tool === \"censor-light\""));
 assert.ok(app.includes("renderDocumentToCanvas(state.document, exportCanvas"));
});

test("painting over an image selects the independent transparent layer before recording strokes", async () => {
 const app = await readFile("app.js","utf8");
 assert.match(app, /setSelection\(\[paintLayer\.id\], paintLayer\.id\);\s*layer = selectedLayer\(\);/);
 assert.match(app, /state\.history\.record\(before, next\)/);
 assert.match(app, /hasCensorStrokes && !document\.querySelector\("#censor-permanent-export"\)\.checked/);
});
