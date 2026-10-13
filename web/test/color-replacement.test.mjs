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
  assert.ok(result.data[0]<result.data[4]&&result.data[4]<result.data[8]);
  assert.notEqual(result.data[2],result.data[6]);
});
test("softness feathers the edge of a color range", () => {
  const source=image([[100,100,100,255],[130,130,130,255],[255,255,255,255]]);
  const result=replaceColorRange(source,{sourceColor:"#646464",targetColor:"#ff0000",tolerance:0,softness:80});
  assert.notDeepEqual([...result.data.slice(0,3)],[100,100,100]);
  assert.notDeepEqual([...result.data.slice(4,7)],[130,130,130]);
  assert.deepEqual([...result.data.slice(8,11)],[255,255,255]);
});
test("color replacement rejects malformed rasters and invalid color values", () => {
  assert.throws(()=>replaceColorRange({width:2,height:2,data:new Uint8ClampedArray(3)}),/valid image pixels/i);
  assert.throws(()=>replaceColorRange(image([[0,0,0,255]]),{sourceColor:"blue"}),/six-digit/i);
});
