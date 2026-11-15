function snapshotKind(snapshot) { return snapshot?.kind === "multipage" ? "multipage" : "canvas"; }
function validateDocument(document, label) {
  if (!document || typeof document !== "object" || !Array.isArray(document.layers)) throw new TypeError(label + " no contiene un documento editable válido.");
  const ids = new Set();
  for (const layer of document.layers) { const id = String(layer?.id || "").trim(); if (!id || ids.has(id)) throw new TypeError(label + " contiene capas sin ID o IDs duplicados."); ids.add(id); }
  return document;
}
function compareDocuments(leftDocument, rightDocument) {
  const left=validateDocument(leftDocument,"La versión A"), right=validateDocument(rightDocument,"La versión B");
  const leftLayers=new Map(left.layers.map(layer=>[String(layer.id),layer])), rightLayers=new Map(right.layers.map(layer=>[String(layer.id),layer]));
  const addedLayerIds=[],removedLayerIds=[],changedLayerIds=[];
  for(const [id,layer] of rightLayers){if(!leftLayers.has(id))addedLayerIds.push(id);else if(JSON.stringify(leftLayers.get(id))!==JSON.stringify(layer))changedLayerIds.push(id);}
  for(const id of leftLayers.keys())if(!rightLayers.has(id))removedLayerIds.push(id);
  return {leftDimensions:{width:Number(left.width)||0,height:Number(left.height)||0},rightDimensions:{width:Number(right.width)||0,height:Number(right.height)||0},dimensionsChanged:left.width!==right.width||left.height!==right.height,leftLayerCount:left.layers.length,rightLayerCount:right.layers.length,addedLayerIds,removedLayerIds,changedLayerIds};
}
/** Compare two loaded local snapshots without mutating either version. */
export function compareRecoverySnapshots(leftSnapshot,rightSnapshot) {
  if(!leftSnapshot||typeof leftSnapshot!=="object"||!rightSnapshot||typeof rightSnapshot!=="object")throw new TypeError("Selecciona dos versiones recuperables para compararlas.");
  if(!leftSnapshot.id||!rightSnapshot.id||String(leftSnapshot.id)===String(rightSnapshot.id))throw new TypeError("La comparación necesita dos versiones diferentes.");
  const leftKind=snapshotKind(leftSnapshot),rightKind=snapshotKind(rightSnapshot);
  if(leftKind!==rightKind)throw new TypeError("No se pueden comparar un lienzo individual y un proyecto multipágina.");
  if(leftKind==="canvas")return {kind:"canvas",leftId:String(leftSnapshot.id),rightId:String(rightSnapshot.id),document:compareDocuments(leftSnapshot.document,rightSnapshot.document),pageCount:{left:1,right:1,added:0,removed:0}};
  const leftProjectId=String(leftSnapshot.sourceProjectId||""),rightProjectId=String(rightSnapshot.sourceProjectId||"");
  if(!leftProjectId||leftProjectId!==rightProjectId)throw new TypeError("Solo se pueden comparar versiones del mismo proyecto multipágina.");
  if(!Array.isArray(leftSnapshot.pages)||!Array.isArray(rightSnapshot.pages)||leftSnapshot.pages.length<1||rightSnapshot.pages.length<1)throw new TypeError("Una de las versiones no contiene páginas comparables.");
  const leftPages=new Map(leftSnapshot.pages.map(page=>[String(page.id),page])),rightPages=new Map(rightSnapshot.pages.map(page=>[String(page.id),page]));
  const ids=[...leftPages.keys(),...[...rightPages.keys()].filter(id=>!leftPages.has(id))];
  const pages=ids.map(id=>{
    const leftPage=leftPages.get(id)||null,rightPage=rightPages.get(id)||null;
    const document=leftPage&&rightPage?compareDocuments(leftPage.document,rightPage.document):null;
    const status=!leftPage?"added":!rightPage?"removed":leftPage.name!==rightPage.name||leftPage.order!==rightPage.order||leftPage.width!==rightPage.width||leftPage.height!==rightPage.height||document.addedLayerIds.length||document.removedLayerIds.length||document.changedLayerIds.length?"changed":"unchanged";
    const safePage=page=>page?{id:page.id,name:page.name,order:page.order,width:page.width,height:page.height,layerCount:page.layerCount,thumbnail:page.thumbnail||"",document:page.document}:null;
    return {id,status,leftPage:safePage(leftPage),rightPage:safePage(rightPage),document};
  });
  const addedPageIds=pages.filter(p=>p.status==="added").map(p=>p.id),removedPageIds=pages.filter(p=>p.status==="removed").map(p=>p.id),changedPageIds=pages.filter(p=>p.status==="changed").map(p=>p.id);
  const addedLayerIds=pages.flatMap(p=>p.status==="added"?(p.rightPage?.document?.layers||[]).map(l=>String(l.id)):p.document?.addedLayerIds||[]);
  const removedLayerIds=pages.flatMap(p=>p.status==="removed"?(p.leftPage?.document?.layers||[]).map(l=>String(l.id)):p.document?.removedLayerIds||[]);
  const changedLayerIds=pages.flatMap(p=>p.document?.changedLayerIds||[]);
  return {kind:"multipage",leftId:String(leftSnapshot.id),rightId:String(rightSnapshot.id),projectId:leftProjectId,projectName:String(rightSnapshot.projectName||leftSnapshot.projectName||"Proyecto multipágina"),pageCount:{left:leftPages.size,right:rightPages.size,added:addedPageIds.length,removed:removedPageIds.length},addedPageIds,removedPageIds,changedPageIds,addedLayerIds,removedLayerIds,changedLayerIds,pages};
}
