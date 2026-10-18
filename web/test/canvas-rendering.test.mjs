import test from "node:test";
import assert from "node:assert/strict";
import { clearCanvasBackingStore } from "../domain/canvas-rendering.mjs";
test("clears physical backing bitmap then restores CSS-coordinate scale",()=>{
 const calls=[];const context={setTransform(...a){calls.push(["setTransform",...a]);},clearRect(...a){calls.push(["clearRect",...a]);}};
 assert.deepEqual(clearCanvasBackingStore(context,{width:781,height:563},1.75),{width:781,height:563,devicePixelRatio:1.75});
 assert.deepEqual(calls,[["setTransform",1,0,0,1,0,0],["clearRect",0,0,781,563],["setTransform",1.75,0,0,1.75,0,0]]);
});
test("supports a temporarily collapsed canvas",()=>{
 const calls=[];const context={setTransform(...a){calls.push(["setTransform",...a]);},clearRect(...a){calls.push(["clearRect",...a]);}};
 assert.deepEqual(clearCanvasBackingStore(context,{width:0,height:150},1.5),{width:0,height:150,devicePixelRatio:1.5});
 assert.deepEqual(calls[1],["clearRect",0,0,0,150]);
});
test("rejects invalid backing dimensions and ratios",()=>{
 const context={setTransform(){},clearRect(){}};
 assert.throws(()=>clearCanvasBackingStore(context,{width:-1,height:4},1),/non-negative integers/);
 assert.throws(()=>clearCanvasBackingStore(context,{width:4,height:4},0),/positive finite/);
});
