import { setLayerAdjustments, setLayerOpacity } from "./document-operations.mjs";

export const QUICK_EDIT_RECIPES = Object.freeze([
 Object.freeze({id:"anime-pop",label:"Anime Pop",shortcut:"Ctrl+Alt+1",adjustments:Object.freeze({brightness:106,contrast:120,saturation:155,hue:0,blur:0})}),
 Object.freeze({id:"cinematic",label:"Cinematic",shortcut:"Ctrl+Alt+2",adjustments:Object.freeze({brightness:94,contrast:132,saturation:108,hue:8,blur:0})}),
 Object.freeze({id:"manga-ink",label:"Manga Ink",shortcut:"Ctrl+Alt+3",adjustments:Object.freeze({brightness:108,contrast:165,saturation:0,hue:0,blur:0})}),
 Object.freeze({id:"soft-dream",label:"Soft Dream",shortcut:"Ctrl+Alt+4",adjustments:Object.freeze({brightness:110,contrast:92,saturation:118,hue:-10,blur:0.4})}),
 Object.freeze({id:"mystic-violet",label:"Mystic Violet",shortcut:"Ctrl+Alt+5",adjustments:Object.freeze({brightness:108,contrast:116,saturation:165,hue:-38,blur:0})}),
 Object.freeze({id:"golden-hour",label:"Golden Hour",shortcut:"Ctrl+Alt+6",adjustments:Object.freeze({brightness:108,contrast:110,saturation:128,hue:-14,blur:0})}),
 Object.freeze({id:"ice-blue",label:"Ice Blue",shortcut:"Ctrl+Alt+7",adjustments:Object.freeze({brightness:110,contrast:122,saturation:138,hue:32,blur:0})}),
 Object.freeze({id:"xray-glasses",label:"X-Ray Glasses · 3 layers",shortcut:"Ctrl+Alt+8",multiLayer:true})
]);
const XRAY = Object.freeze([
 Object.freeze({adjustments:Object.freeze({brightness:104,contrast:116,saturation:88,hue:0,blur:0}),opacity:1}),
 Object.freeze({adjustments:Object.freeze({brightness:128,contrast:158,saturation:190,hue:-18,blur:0}),opacity:0.96}),
 Object.freeze({adjustments:Object.freeze({brightness:112,contrast:132,saturation:132,hue:-8,blur:0}),opacity:1})
]);

export function applyQuickEditRecipe(document, recipeId, selectedLayerIds) {
 if (!document || !Array.isArray(document.layers)) throw new TypeError("A valid editor document is required");
 const recipe=QUICK_EDIT_RECIPES.find(item=>item.id===recipeId);
 if (!recipe) throw new TypeError("Unknown quick-edit recipe: "+String(recipeId));
 const ids=new Set(Array.isArray(selectedLayerIds)?selectedLayerIds:[]);
 const selected=document.layers.filter(layer=>ids.has(layer.id));
 if (recipe.multiLayer) {
  if (selected.length!==3 || selected.some(layer=>layer.contentType!=="image")) throw new Error("X-Ray Glasses needs exactly 3 selected image layers: character below, transparent X-ray lens overlay in the middle, transparent glasses frame on top.");
  if (selected.some(layer=>layer.locked)) throw new Error("Unlock all 3 image layers before applying X-Ray Glasses.");
  let next=document;
  selected.forEach((layer,index)=>{next=setLayerAdjustments(next,layer.id,XRAY[index].adjustments);next=setLayerOpacity(next,layer.id,XRAY[index].opacity);});
  return {document:next,message:"X-Ray Glasses applied. Layer order bottom → top: character, X-ray lens overlay, glasses frame."};
 }
 const images=selected.filter(layer=>layer.contentType==="image");
 if (!images.length) throw new Error("Select at least one image layer to apply "+recipe.label+".");
 if (images.some(layer=>layer.locked)) throw new Error("Unlock the selected image layers before applying "+recipe.label+".");
 let next=document;
 for (const layer of images) next=setLayerAdjustments(next,layer.id,recipe.adjustments);
 return {document:next,message:recipe.label+" applied to "+images.length+" image layer"+(images.length===1?"":"s")+"."};
}
