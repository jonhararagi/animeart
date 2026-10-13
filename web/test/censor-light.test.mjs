import test from "node:test";
import assert from "node:assert/strict";
import { createStroke, normalizeStroke } from "../domain/model.mjs";

test("censor stroke stores size, color, opacity and bounded glow", () => {
 const stroke = createStroke("censor-light", 72, [{x:1,y:2},{x:80,y:2}], "#ffffff", 1, {glow:50});
 assert.equal(stroke.size,72);
 assert.equal(stroke.color,"#ffffff");
 assert.equal(stroke.glow,50);
 assert.equal(normalizeStroke({...stroke,glow:999}).glow,100);
 assert.equal(normalizeStroke({...stroke,glow:-1}).glow,0);
});

test("censor glow is painted through the existing renderer with a visible shadow color", async () => {
 const { readFile } = await import("node:fs/promises");
 const app = await readFile("app.js","utf8");
 assert.match(app, /context\.shadowColor = erasing \|\| \(effect === "normal" && !censorLight\) \? "transparent" : stroke\.color/);
 assert.match(app, /stroke\.size \* Math\.max\(Math\.min\(100, Math\.max\(0, Number\(stroke\.glow/);
});
