import { isValidDocument, restoreDocument } from "./model.mjs";

export const DESIGN_LIBRARY_DATABASE = "kapiart-design-library";
export const DESIGN_LIBRARY_VERSION = 1;
export const DESIGN_LIBRARY_LIMIT = 40;
export const MAX_LIBRARY_DOCUMENT_CHARS = 2_500_000;
const PROJECTS_STORE = "projects";
const DOCUMENTS_STORE = "documents";
const MAX_NAME_LENGTH = 90;

function makeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "design-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

export function normalizeDesignName(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH);
}

export function createDesignMetadata({ id = makeId(), name, document, createdAt = Date.now(), updatedAt = Date.now(), thumbnail = "" } = {}) {
  if (!isValidDocument(document)) throw new TypeError("El proyecto no contiene un documento válido.");
  const normalizedName = normalizeDesignName(name);
  if (!normalizedName) throw new TypeError("Escribe un nombre para el diseño.");
  const created = Number(createdAt);
  const updated = Number(updatedAt);
  return {
    id: String(id),
    name: normalizedName,
    width: Math.max(1, Math.floor(Number(document.width) || 1)),
    height: Math.max(1, Math.floor(Number(document.height) || 1)),
    layerCount: Array.isArray(document.layers) ? document.layers.length : 0,
    thumbnail: typeof thumbnail === "string" && thumbnail.startsWith("data:image/") ? thumbnail.slice(0, 300_000) : "",
    createdAt: Number.isFinite(created) ? created : Date.now(),
    updatedAt: Number.isFinite(updated) ? updated : Date.now()
  };
}

function openDatabase(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi || typeof indexedDBApi.open !== "function") {
    return Promise.reject(new Error("La biblioteca de diseños necesita almacenamiento local IndexedDB. Exporta el proyecto para conservar una copia si este navegador no lo admite."));
  }
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDBApi.open(DESIGN_LIBRARY_DATABASE, DESIGN_LIBRARY_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const projects = db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
        projects.createIndex("updatedAt", "updatedAt", { unique: false });
        projects.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) db.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la biblioteca de diseños."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de KapiArt para actualizar la biblioteca de diseños."));
  });
}

function completeTransaction(transaction, reject) {
  transaction.onabort = () => reject(transaction.error || new Error("La operación de la biblioteca fue cancelada."));
  transaction.onerror = () => reject(transaction.error || new Error("Falló el almacenamiento local de la biblioteca."));
}

export async function listDesigns({ indexedDBApi = globalThis.indexedDB } = {}) {
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readonly");
      completeTransaction(transaction, reject);
      const request = transaction.objectStore(PROJECTS_STORE).getAll();
      request.onerror = () => reject(request.error || new Error("No se pudieron listar los diseños."));
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, "es")));
    });
  } finally {
    db.close();
  }
}

export async function loadDesign(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  if (!String(id || "")) throw new TypeError("Falta el identificador del diseño.");
  const db = await openDatabase(indexedDBApi);
  try {
    const record = await new Promise((resolve, reject) => {
      const transaction = db.transaction(DOCUMENTS_STORE, "readonly");
      completeTransaction(transaction, reject);
      const request = transaction.objectStore(DOCUMENTS_STORE).get(String(id));
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el diseño."));
      request.onsuccess = () => resolve(request.result || null);
    });
    if (!record || !isValidDocument(record.document)) return null;
    return restoreDocument(record.document);
  } finally {
    db.close();
  }
}

export async function saveDesign({ id = null, name, document, thumbnail = "", now = Date.now() } = {}, { indexedDBApi = globalThis.indexedDB } = {}) {
  if (!isValidDocument(document)) throw new TypeError("No se puede guardar un documento inválido.");
  const normalizedName = normalizeDesignName(name);
  if (!normalizedName) throw new TypeError("Escribe un nombre para el diseño.");
  if (JSON.stringify(document).length > MAX_LIBRARY_DOCUMENT_CHARS) {
    throw new RangeError("Este proyecto supera el límite seguro de 2,5 MB para editarse y recuperarse localmente. Reduce el tamaño de las imágenes o exporta una copia del proyecto.");
  }
  const db = await openDatabase(indexedDBApi);
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const nextId = String(id || makeId());
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, DOCUMENTS_STORE], "readwrite");
      completeTransaction(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE);
      const documents = transaction.objectStore(DOCUMENTS_STORE);
      const allRequest = projects.getAll();
      let savedMetadata;
      allRequest.onerror = () => {
        try { transaction.abort(); } catch {}
        reject(allRequest.error || new Error("No se pudo comprobar el espacio disponible."));
      };
      allRequest.onsuccess = () => {
        try {
          const all = allRequest.result || [];
          const previous = all.find(record => record.id === nextId);
          const metadata = createDesignMetadata({
            id: nextId,
            name: normalizedName,
            document,
            createdAt: previous?.createdAt ?? timestamp,
            updatedAt: timestamp,
            thumbnail: thumbnail || previous?.thumbnail || ""
          });
          if (!previous && all.length >= DESIGN_LIBRARY_LIMIT) {
            try { transaction.abort(); } catch {}
            reject(new Error("La biblioteca llegó al máximo de 40 diseños. Elimina o exporta uno antes de guardar otro."));
            return;
          }
          projects.put(metadata);
          documents.put({ id: nextId, document: restoreDocument(document) });
          savedMetadata = metadata;
        } catch (error) {
          try { transaction.abort(); } catch {}
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(savedMetadata);
    });
  } finally {
    db.close();
  }
}

export async function deleteDesign(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = String(id || "");
  if (!key) return false;
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, DOCUMENTS_STORE], "readwrite");
      completeTransaction(transaction, reject);
      transaction.objectStore(PROJECTS_STORE).delete(key);
      transaction.objectStore(DOCUMENTS_STORE).delete(key);
      transaction.oncomplete = () => resolve(true);
    });
  } finally {
    db.close();
  }
}

export async function renameDesign(id, name, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const normalizedName = normalizeDesignName(name);
  if (!normalizedName) throw new TypeError("Escribe un nombre válido para el diseño.");
  const key = String(id || "");
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      completeTransaction(transaction, reject);
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.get(key);
      let updated = null;
      request.onerror = () => reject(request.error || new Error("No se pudo renombrar el diseño."));
      request.onsuccess = () => {
        if (!request.result) return;
        updated = { ...request.result, name: normalizedName, updatedAt: Number(now) || Date.now() };
        store.put(updated);
      };
      transaction.oncomplete = () => resolve(updated);
    });
  } finally {
    db.close();
  }
}

export async function duplicateDesign(id, name, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const document = await loadDesign(id, { indexedDBApi });
  if (!document) throw new Error("No se encontró el diseño que quieres duplicar.");
  return saveDesign({ name, document, now }, { indexedDBApi });
}
