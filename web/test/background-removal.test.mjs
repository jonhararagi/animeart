import test from "node:test";
import assert from "node:assert/strict";
import { removeConnectedBackground } from "../domain/background-removal.mjs";
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