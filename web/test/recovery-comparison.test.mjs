import test from "node:test";
import assert from "node:assert/strict";
import { compareRecoverySnapshots } from "../domain/recovery-comparison.mjs";
function doc(layers,width=320,height=480){return {version:2,width,height,layers:layers.map(([id,name])=>({id,name,visible:true,opacity:1}))};}
function canvas(id,layers,width=320){return {id,projectId:"active-canvas",createdAt:1,document:doc(layers,width)};}
test("canvas comparison reports added, removed, changed layers and dimensions",()=>{
 const result=compareRecoverySnapshots(canvas("older",[["a","A"],["b","B"]]),canvas("newer",[["a","A edit"],["c","C"]],640));
 assert.equal(result.kind,"canvas");assert.deepEqual(result.document.addedLayerIds,["c"]);assert.deepEqual(result.document.removedLayerIds,["b"]);assert.deepEqual(result.document.changedLayerIds,["a"]);assert.equal(result.document.dimensionsChanged,true);
});
test("multipage comparison matches stable IDs and reports inserted, removed and edited pages",()=>{
 const left={id:"left",kind:"multipage",sourceProjectId:"project-1",projectName:"Manga",pages:[{id:"p1",name:"Portada",order:0,width:320,height:480,layerCount:1,document:doc([["a","A"]])},{id:"p2",name:"Capítulo",order:1,width:320,height:480,layerCount:1,document:doc([["b","B"]])}]};
 const right={id:"right",kind:"multipage",sourceProjectId:"project-1",projectName:"Manga",pages:[{id:"p2",name:"Capítulo 1",order:0,width:320,height:480,layerCount:2,document:doc([["b","B"],["c","C"]])},{id:"p3",name:"Contraportada",order:1,width:320,height:480,layerCount:1,document:doc([["d","D"]])}]};
 const result=compareRecoverySnapshots(left,right);assert.equal(result.kind,"multipage");assert.deepEqual(result.addedPageIds,["p3"]);assert.deepEqual(result.removedPageIds,["p1"]);assert.deepEqual(result.changedPageIds,["p2"]);assert.deepEqual(result.addedLayerIds,["c","d"]);assert.deepEqual(result.removedLayerIds,["a"]);
});
test("multipage comparison rejects snapshots from different projects",()=>{
 const snapshot=id=>({id,kind:"multipage",sourceProjectId:id,projectName:"Project",pages:[{id:"p1",name:"Page",order:0,document:doc([["a","A"]])}]});
 assert.throws(()=>compareRecoverySnapshots(snapshot("one"),snapshot("two")),/mismo proyecto/);
});
test("comparison rejects same, missing and mixed-kind snapshots",()=>{
 const one=canvas("one",[["a","A"]]);assert.throws(()=>compareRecoverySnapshots(one,one),/dos versiones diferentes/);assert.throws(()=>compareRecoverySnapshots(one,null),/Selecciona dos versiones/);
 const multi={id:"multi",kind:"multipage",sourceProjectId:"p",pages:[{id:"page",document:doc([["a","A"]])}]};
 assert.throws(()=>compareRecoverySnapshots(one,multi),/no se pueden comparar/);
});
