import {
  ASSET_CATEGORIES,
  ASSET_LIBRARY_SCHEMA_VERSION,
  MAX_ASSET_BYTES,
  MAX_LIBRARY_ASSETS,
  createAssetLibraryPackage,
  filterAssets,
  normalizeAssetMetadata
} from "./domain/asset-library.mjs";

const DB_NAME = "animeart-local-asset-library";
const DB_VERSION = 1;
const STORE = "assets";
const ALLOWED_TYPES = new Set(["image/png","image/jpeg","image/webp","image/gif","image/avif","image/bmp"]);
let dbPromise;
const previewUrls = new Set();
const CATEGORY_LABELS = Object.freeze({character:"Personajes",sticker:"Stickers",background:"Fondos",texture:"Texturas",reference:"Referencias"});

function database() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("Local image storage is not available in this browser"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open image library"));
  });
  return dbPromise;
}
async function allAssets() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Could not read image library"));
  });
}
async function saveAsset(asset) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(asset);
    tx.oncomplete = () => resolve(asset);
    tx.onerror = () => reject(tx.error || new Error("Could not save image"));
  });
}
async function deleteAsset(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("No se pudo eliminar la imagen"));
  });
}
function makeId() {
  return "asset_" + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not package image"));
    reader.readAsDataURL(blob);
  });
}
function dataUrlToBlob(value) {
  const match = typeof value === "string" && value.match(/^data:(image\/(?:png|jpeg|webp|gif|avif|bmp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new TypeError("El paquete de biblioteca contiene una imagen no compatible");
  const binary = atob(match[2]);
  if (binary.length > MAX_ASSET_BYTES) throw new RangeError("La imagen supera el límite de 25 MiB");
  const bytes = new Uint8Array(binary.length);
  for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type:match[1].toLowerCase()});
}
function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function initializeAssetLibrary({ onImportImage, onStatus = () => {} } = {}) {
  const $ = selector => document.querySelector(selector);
  const dialog=$("#asset-library-dialog"), open=$("#open-asset-library"), close=$("#close-asset-library");
  const fileInput=$("#asset-library-files"), add=$("#asset-library-add"), search=$("#asset-library-search");
  const filter=$("#asset-library-filter"), grid=$("#asset-library-grid"), empty=$("#asset-library-empty");
  const status=$("#asset-library-status"), exportButton=$("#asset-library-export");
  const importButton=$("#asset-library-import"), packageInput=$("#asset-library-package");
  if ([dialog,open,close,fileInput,add,search,filter,grid,empty,status,exportButton,importButton,packageInput].some(x=>!x)) return;
  let assets=[];
  function report(message, error=false) { status.textContent=message; status.dataset.error=String(error); }
  function releaseUrls() { for (const url of previewUrls) URL.revokeObjectURL(url); previewUrls.clear(); }
  function updateCard(asset, patch) {
    const updated={...asset,...patch,updatedAt:new Date().toISOString()};
    try {
      const normalized=normalizeAssetMetadata({...updated,tags:updated.tags},updated.updatedAt);
      const next={...normalized,imageBlob:updated.imageBlob};
      return saveAsset(next).then(()=>{ assets=assets.map(item=>item.id===asset.id?next:item); render(); report("Guardado: "+next.name); });
    } catch (error) { report(error.message||"Recurso no válido",true); return Promise.resolve(); }
  }
  function render() {
    releaseUrls();
    grid.replaceChildren();
    const visible=filterAssets(assets,search.value,filter.value);
    empty.hidden=visible.length>0;
    empty.textContent=assets.length ? "No hay imágenes que coincidan con esa búsqueda." : "Tu biblioteca está vacía. Importa imágenes para crear tu colección reutilizable.";
    exportButton.disabled=assets.length===0;
    for(const asset of visible) {
      const card=document.createElement("article"); card.className="asset-card";
      const preview=document.createElement("div"); preview.className="asset-card-preview";
      const image=document.createElement("img"); image.alt=asset.name;
      if(asset.imageBlob instanceof Blob) { const url=URL.createObjectURL(asset.imageBlob); previewUrls.add(url); image.src=url; }
      preview.append(image);
      const fields=document.createElement("div"); fields.className="asset-card-fields";
      const nameLabel=document.createElement("label"); nameLabel.textContent="Nombre";
      const name=document.createElement("input"); name.value=asset.name; name.maxLength=160; name.setAttribute("aria-label","Nombre "+asset.name);
      name.addEventListener("change",()=>updateCard(asset,{name:name.value}));
      nameLabel.append(name);
      const categoryLabel=document.createElement("label"); categoryLabel.textContent="Categoría";
      const category=document.createElement("select"); category.setAttribute("aria-label","Categoría de "+asset.name);
      for(const value of ASSET_CATEGORIES){const option=document.createElement("option");option.value=value;option.textContent=CATEGORY_LABELS[value]||value;category.append(option);}
      category.value=asset.category; category.addEventListener("change",()=>updateCard(asset,{category:category.value})); categoryLabel.append(category);
      const tagsLabel=document.createElement("label"); tagsLabel.textContent="Etiquetas (separadas por coma)";
      const tags=document.createElement("input"); tags.value=(asset.tags||[]).join(", "); tags.maxLength=800; tags.placeholder="anime, cabello, cielo"; tags.setAttribute("aria-label","Etiquetas de "+asset.name);
      tags.addEventListener("change",()=>updateCard(asset,{tags:tags.value.split(",").map(v=>v.trim()).filter(Boolean)})); tagsLabel.append(tags);
      fields.append(nameLabel,categoryLabel,tagsLabel);
      const meta=document.createElement("div"); meta.className="asset-card-meta";
      const size=document.createElement("span"); size.textContent=(asset.imageBlob?.size/1024/1024||0).toFixed(2)+" MiB";
      const favoriteLabel=document.createElement("label"); favoriteLabel.className="asset-favorite";
      const favorite=document.createElement("input"); favorite.type="checkbox"; favorite.checked=asset.favorite; favorite.setAttribute("aria-label","Marcar favorita: "+asset.name);
      favorite.addEventListener("change",()=>updateCard(asset,{favorite:favorite.checked})); favoriteLabel.append(favorite,document.createTextNode(" Favorite"));
      meta.append(size,favoriteLabel);
      const actions=document.createElement("div"); actions.className="asset-card-actions";
      const use=document.createElement("button"); use.type="button"; use.textContent="＋ Insertar al lienzo"; use.disabled=!(asset.imageBlob instanceof Blob);
      use.addEventListener("click",async()=>{try{const file=new File([asset.imageBlob],asset.name,{type:asset.imageBlob.type||asset.mimeType||"image/png"});const ok=await onImportImage(file,"Imagen insertada: "+asset.name);if(ok){dialog.close();onStatus("Imagen insertada como capa editable. Ya puedes moverla en el lienzo.");}}catch(error){report(error.message||"No se pudo insertar la imagen en el lienzo",true);}});
      const remove=document.createElement("button"); remove.type="button"; remove.textContent="Eliminar";
      remove.addEventListener("click",async()=>{if(!confirm("¿Eliminar "+asset.name+" de tu biblioteca local?"))return;try{await deleteAsset(asset.id);assets=assets.filter(item=>item.id!==asset.id);render();report("Imagen eliminada de la biblioteca");}catch(error){report(error.message||"Could not delete image",true);}});
      actions.append(use,remove); card.append(preview,fields,meta,actions); grid.append(card);
    }
  }
  async function reload() { assets=await allAssets(); render(); report(assets.length+" imagen(es) guardada(s)"); }
  async function addFiles(files) {
    const chosen=Array.from(files||[]);
    if(!chosen.length)return;
    try {
      const current=await allAssets();
      if(current.length+chosen.length>MAX_LIBRARY_ASSETS)throw new RangeError("La biblioteca admite hasta 500 imágenes");
      for(const file of chosen) {
        if(!ALLOWED_TYPES.has(file.type))throw new TypeError(file.name+": formato de imagen no compatible");
        if(file.size>MAX_ASSET_BYTES)throw new RangeError(file.name+": supera el límite de 25 MiB");
        if(!file.size)continue;
        const now=new Date().toISOString();
        const metadata=normalizeAssetMetadata({id:makeId(),name:file.name.replace(/\.[^.]+$/,"").slice(0,160)||"Untitled image",category:"sticker",tags:[],favorite:false,mimeType:file.type,size:file.size,createdAt:now},now);
        await saveAsset({...metadata,imageBlob:file});
      }
      await reload(); report("Se importaron "+chosen.length+" imagen(es) a la biblioteca local");
    } catch(error) { report(error.message||"No se pudieron importar las imágenes",true); }
    finally { fileInput.value=""; }
  }
  async function exportLibrary() {
    try {
      const current=await allAssets();
      const pkg=createAssetLibraryPackage(current);
      pkg.assets=await Promise.all(current.map(async asset=>({...normalizeAssetMetadata(asset),imageDataUrl:asset.imageBlob instanceof Blob?await blobToDataUrl(asset.imageBlob):null})));
      downloadJson("animeart-asset-library.json",pkg);
      report("Biblioteca exportada con "+current.length+" imagen(es), etiquetas y categorías");
    } catch(error) { report(error.message||"No se pudo exportar la biblioteca",true); }
  }
  async function importLibrary(file) {
    if(!file)return;
    if(file.size>150*1024*1024){report("El paquete de biblioteca supera 150 MiB",true);return;}
    try {
      const pkg=JSON.parse(await file.text());
      if(pkg.schemaVersion!==ASSET_LIBRARY_SCHEMA_VERSION||!Array.isArray(pkg.assets))throw new TypeError("Paquete de biblioteca no compatible");
      if(pkg.assets.length>MAX_LIBRARY_ASSETS)throw new RangeError("El paquete contiene demasiadas imágenes");
      const existing=await allAssets();
      if(existing.length+pkg.assets.length>MAX_LIBRARY_ASSETS)throw new RangeError("La importación superaría el límite de 500 imágenes");
      for(const raw of pkg.assets) {
        const metadata=normalizeAssetMetadata(raw);
        const imageBlob=raw.imageDataUrl?dataUrlToBlob(raw.imageDataUrl):null;
        if(!imageBlob)throw new TypeError("Faltan los datos de imagen para "+metadata.name);
        const record={...metadata,mimeType:imageBlob.type,size:imageBlob.size,imageBlob};
        await saveAsset(record);
      }
      await reload(); report("Se importaron "+pkg.assets.length+" imagen(es)");
    } catch(error) { report(error.message||"No se pudo importar la biblioteca",true); }
    finally { packageInput.value=""; }
  }
  open.addEventListener("click",async()=>{if(!dialog.open)dialog.showModal();try{await reload();}catch(error){report(error.message||"El almacenamiento local no está disponible",true);}});
  close.addEventListener("click",()=>dialog.close());
  add.addEventListener("click",()=>fileInput.click());
  fileInput.addEventListener("change",()=>addFiles(fileInput.files));
  search.addEventListener("input",render);
  filter.addEventListener("change",render);
  exportButton.addEventListener("click",exportLibrary);
  importButton.addEventListener("click",()=>packageInput.click());
  packageInput.addEventListener("change",()=>importLibrary(packageInput.files?.[0]||null));
}
