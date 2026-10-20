import test from "node:test";
import assert from "node:assert/strict";
import { replaceColorRange } from "../domain/color-replacement.mjs";
const image = rows => ({ width: rows.length, height: 1, data: new Uint8ClampedArray(rows.flat()) });

test("selective recolor changes a sampled range without changing alpha or the input", () => {
  const source = image([[128,64,32,255],[128,64,32,128],[20,40,80,255],[0,0,0,0]]);
  const before = [...source.data];
  const result = replaceColorRange(source,{sourceColor:"#804020",targetColor:"#00aaff",tolerance:0,softness:0});
  assert.deepEqual([...source.data],before);
  assert.notDeepEqual([...result.data.slice(0,3)],[128,64,32]);
  assert.equal(result.data[3],255); assert.equal(result.data[7],128);
  assert.deepEqual([...result.data.slice(8,12)],[...source.data.slice(8,12)]);
  assert.equal(result.data[15],0);
});
test("shading preservation keeps source lightness ordering across hair-like highlights", () => {
  const source=image([[60,30,15,255],[130,65,32,255],[220,160,120,255]]);
  const result=replaceColorRange(source,{sourceColor:"#804020",targetColor:"#00aaff",tolerance:255,softness:0,preserveShading:true});
  const lightness = offset => (Math.max(result.data[offset],result.data[offset+1],result.data[offset+2]) + Math.min(result.data[offset],result.data[offset+1],result.data[offset+2])) / 2;
  assert.ok(lightness(0)<lightness(4)&&lightness(4)<lightness(8));
  assert.notEqual(result.data[2],result.data[6]);
});
test("softness feathers the edge of a color range", () => {
  const source=image([[100,100,100,255],[130,130,130,255],[255,255,255,255]]);
  const result=replaceColorRange(source,{sourceColor:"#646464",targetColor:"#ff0000",tolerance:0,softness:80});
  assert.notDeepEqual([...result.data.slice(0,3)],[100,100,100]);
  assert.notDeepEqual([...result.data.slice(4,7)],[130,130,130]);
  assert.deepEqual([...result.data.slice(8,11)],[255,255,255]);
});
test("worker mode can recolor in place while the default API stays immutable", () => {
  const source = image([[128,64,32,255],[0,0,0,0]]);
  const firstPixel = [...source.data.slice(0,4)];
  const result = replaceColorRange(source,{sourceColor:"#804020",targetColor:"#00aaff",tolerance:0,softness:0,mutate:true});
  assert.equal(result.data,source.data);
  assert.notDeepEqual([...source.data.slice(0,3)],firstPixel.slice(0,3));
  assert.equal(source.data[3],255);
});

test("color replacement rejects malformed rasters and invalid color values", () => {
  assert.throws(()=>replaceColorRange({width:2,height:2,data:new Uint8ClampedArray(3)}),/valid image pixels/i);
  assert.throws(()=>replaceColorRange(image([[0,0,0,255]]),{sourceColor:"blue"}),/six-digit/i);
});

test("color replacement leaves pixels outside the anime selection mask untouched", () => {
  const source = image([[128,64,32,255],[128,64,32,255],[128,64,32,255]]);
  const mask = new Uint8Array([1,0,1]);
  const result = replaceColorRange(source,{sourceColor:"#804020",targetColor:"#00aaff",tolerance:0,softness:0,preserveShading:false,mask});
  assert.deepEqual([...result.data.slice(0,3)],[0,170,255]);
  assert.deepEqual([...result.data.slice(4,7)],[128,64,32]);
  assert.deepEqual([...result.data.slice(8,11)],[0,170,255]);
});


test("line-art protection preserves black outlines against white while recoloring flat black fill", () => {
  const source = { width: 3, height: 3, data: new Uint8ClampedArray([
    255,255,255,255, 255,255,255,255, 255,255,255,255,
    255,255,255,255, 10,10,10,255, 255,255,255,255,
    255,255,255,255, 10,10,10,255, 255,255,255,255
  ]) };
  const protectedResult = replaceColorRange(source,{sourceColor:"#0a0a0a",targetColor:"#ff0000",tolerance:0,softness:0,preserveShading:false,preserveLineArt:true});
  assert.deepEqual([...protectedResult.data.slice(16,19)],[10,10,10]);
  const unprotectedResult = replaceColorRange(source,{sourceColor:"#0a0a0a",targetColor:"#ff0000",tolerance:0,softness:0,preserveShading:false,preserveLineArt:false});
  assert.deepEqual([...unprotectedResult.data.slice(16,19)],[255,0,0]);
});

test("line-art protection preserves white highlights at a contrasting color boundary", () => {
  const source = { width: 3, height: 1, data: new Uint8ClampedArray([30,30,30,255, 250,250,250,255, 30,30,30,255]) };
  const result = replaceColorRange(source,{sourceColor:"#fafafa",targetColor:"#00ff00",tolerance:0,softness:0,preserveShading:false,preserveLineArt:true});
  assert.deepEqual([...result.data.slice(4,7)],[250,250,250]);
});
