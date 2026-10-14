import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDocument, createImageLayer, isValidDocument, normalizeDocument } from "../domain/model.mjs";
import { setImageMask } from "../domain/document-operations.mjs";
test("image shape masks persist through normalization and existing layer operations",()=>{
 const doc=createDocument(800,600),image=createImageLayer("Portrait",400,400,"data:image/png;base64,AA==");doc.layers.push(image);
 const masked=setImageMask(doc,image.id,"heart");assert.equal(masked.layers[1].image.mask,"heart");assert.equal(doc.layers[1].image.mask,"none");
 assert.equal(normalizeDocument(JSON.parse(JSON.stringify(masked))).layers[1].image.mask,"heart");assert.equal(isValidDocument(masked),true);assert.equal(setImageMask(masked,image.id,"invalid"),null);
});
test("poster templates, text effects and masks are connected to the existing editor",async()=>{
 const [html,app,worker]=await Promise.all([readFile("index.html","utf8"),readFile("app.js","utf8"),readFile("service-worker.js","utf8")]);
 assert.match(html,/id="poster-templates"/);assert.match(html,/id="poster-template-form"/);assert.match(html,/id="poster-background-color"/);assert.match(html,/data-text-style-preset="comic"/);assert.match(html,/id="text-outline-width"/);assert.match(html,/id="text-shadow-blur"/);assert.match(html,/id="image-mask"/);
 assert.match(app,/context\.strokeText\(line,\s*x,\s*y\)/);assert.match(app,/context\.shadowBlur\s*=\s*previewText\.shadowBlur/);assert.match(app,/setImageMask\(state\.document/);assert.match(app,/function createPosterTemplate/);assert.match(app,/posterSvgSource\(/);assert.match(worker,/animeart-web-shell-v20/);
});
