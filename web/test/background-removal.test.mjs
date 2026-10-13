import test from "node:test";
import assert from "node:assert/strict";
import { applyEraseStrokes, removeConnectedBackground } from "../domain/background-removal.mjs";
const make=(w,h,pixels)=>({width:w,height:h,data:new Uint8ClampedArray(pixels.flatMap(p=>[...p,255]))});
test("removes edge-connected background while preserving enclosed same-color pixels",()=>{
 const white=[255,255,255],red=[220,25,30],pixels=[white,white,white,white,white,white,red,red,red,white,white,red,white,red,white,white,red,red,red,white,white,white,white,white,white];
 const result=removeConnectedBackground(make(5,5,pixels),{targetColor:"#ffffff",tolerance:0,feather:0}),alpha=i=>result.data[i*4+3];
 assert.equal(alpha(0),0);assert.equal(alpha(4),0);assert.equal(alpha(6),255);assert.equal(alpha(12),255);
});
test("tolerance removes similar connected pixels and feather retains partial edge alpha",()=>{
 const result=removeConnectedBackground(make(3,3,[[255,255,255],[240,240,240],[230,230,230],[255,255,255],[80,40,20],[80,40,20],[255,255,255],[80,40,20],[80,40,20]]),{targetColor:"#ffffff",tolerance:10,feather:30});
 assert.equal(result.data[3],0);assert.ok(result.data[7]>0&&result.data[7]<=255);
});
test("rejects malformed images and invalid colors",()=>{
 assert.throws(()=>removeConnectedBackground(make(1,1,[[0,0,0]]),{targetColor:"red"}),/six-digit/i);
 assert.throws(()=>removeConnectedBackground({width:2,height:2,data:new Uint8ClampedArray(3)}),/valid image pixels/i);
 assert.throws(()=>removeConnectedBackground({width:8192,height:8192,data:new Uint8ClampedArray(4)}),/valid image pixels/i);
});
test("preserves input pixels and existing transparency",()=>{
 const input={width:2,height:1,data:new Uint8ClampedArray([255,255,255,0,10,20,30,255])},before=[...input.data];
 const result=removeConnectedBackground(input,{targetColor:"#ffffff"});
 assert.deepEqual([...input.data],before);assert.equal(result.data[3],0);assert.equal(result.data[7],255);
});
test("manual cutout strokes erase alpha without painting white pixels",()=>{
 const imageData={width:3,height:3,data:new Uint8ClampedArray(Array.from({length:9},()=>[30,60,90,255]).flat())};
 const result=applyEraseStrokes(imageData,[{size:1,points:[{x:1.5,y:1.5}]}]);
 assert.equal(result.data[(1*3+1)*4+3],0);
 assert.deepEqual([...result.data.slice((1*3+1)*4,(1*3+1)*4+3)],[30,60,90]);
 assert.equal(imageData.data[(1*3+1)*4+3],255);
});

test("edge-aware mode protects strong ink boundaries and decontaminates soft fringe",()=>{const white=[255,255,255],ink=[225,225,225],warm=[220,150,80],input=make(5,3,[white,white,ink,warm,warm,white,white,ink,warm,warm,white,white,ink,warm,warm]),out=removeConnectedBackground(input,{tolerance:0,feather:50,edgeSensitivity:24,protectLineArt:true,decontaminate:true});assert.equal(alpha(out,0),0);assert.equal(alpha(out,2),255);assert.equal(alpha(out,3),255);});
