import { createId, isValidDocument, restoreDocument } from "./model.mjs";

export const MULTIPAGE_DATABASE_NAME = "kapiart-multipage-projects";
export const MULTIPAGE_DATABASE_VERSION = 1;
export const MULTIPAGE_PROJECT_LIMIT = 10;
export const MULTIPAGE_PAGE_LIMIT = 10;
export const MULTIPAGE_PAGE_CHARS_LIMIT = 2_500_000;
const PROJECTS_STORE = "projects";
const PAGES_STORE = "pages";
const MAX_NAME_LENGTH = 90;

export function normalizeMultiPageName(value, fallback = "") {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH) || fallback;
}

function safeThumbnail(value) {
  return typeof value === "string" && value.startsWith("data:image/") ? value.slice(0, 300_000) : "";
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function validatePageDocument(document) {
  if (!isValidDocument(document)) throw new TypeError("La página no contiene un documento editable válido.");
  const serialized = JSON.stringify(document);
  if (serialized.length > MULTIPAGE_PAGE_CHARS_LIMIT) {
    throw new RangeError("Esta página supera el límite actual de 2,5 MB. Reduce el tamaño de las imágenes o exporta una copia antes de continuar.");
  }
  if (!Number.isInteger(document.width) || !Number.isInteger(document.height) ||
      document.width < 0 || document.height < 0 || document.width > 8192 || document.height > 8192 ||
      document.width * document.height > 40_000_000) {
    throw new RangeError("El tamaño de la página supera los límites seguros de KapiArt.");
  }
  if (!Array.isArray(document.layers) || document.layers.length > 200) {
    throw new RangeError("Cada página admite un máximo de 200 capas.");
  }
  return restoreDocument(document);
}

function pageMetadata({ id, name, document, thumbnail = "", createdAt = Date.now(), updatedAt = Date.now() }) {
  const safeName = normalizeMultiPageName(name);
  if (!safeName) throw new TypeError("Escribe un nombre para la página.");
  return {
    id: String(id || createId()),
    name: safeName,
    width: Math.max(1, Math.floor(Number(document.width) || 1)),
    height: Math.max(1, Math.floor(Number(document.height) || 1)),
    layerCount: document.layers.length,
    thumbnail: safeThumbnail(thumbnail),
    createdAt: normalizeTimestamp(createdAt),
    updatedAt: normalizeTimestamp(updatedAt)
  };
}

function validateProjectName(name) {
  const normalized = normalizeMultiPageName(name);
  if (!normalized) throw new TypeError("Escribe un nombre para el proyecto.");
  return normalized;
}

function openDatabase(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi || typeof indexedDBApi.open !== "function") {
    return Promise.reject(new Error("Los proyectos multipágina necesitan almacenamiento local IndexedDB en este navegador."));
  }
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDBApi.open(MULTIPAGE_DATABASE_NAME, MULTIPAGE_DATABASE_VERSION);
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
      if (!db.objectStoreNames.contains(PAGES_STORE)) {
        const pages = db.createObjectStore(PAGES_STORE, { keyPath: "id" });
        pages.createIndex("projectId", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento multipágina."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de KapiArt para actualizar el almacenamiento de páginas."));
  });
}

function attachTransactionErrors(transaction, reject) {
  transaction.onabort = () => reject(transaction.error || new Error("La operación multipágina se canceló."));
  transaction.onerror = () => reject(transaction.error || new Error("Falló el almacenamiento del proyecto."));
}

function summarizeProject(project) {
  return { ...project, pages: project.pages.map(page => ({ ...page })), pageCount: project.pages.length };
}

export async function listMultiPageProjects({ indexedDBApi = globalThis.indexedDB } = {}) {
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(PROJECTS_STORE).getAll();
      request.onerror = () => reject(request.error || new Error("No se pudieron listar los proyectos multipágina."));
      request.onsuccess = () => resolve((request.result || [])
        .map(summarizeProject)
        .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, "es")));
    });
  } finally { db.close(); }
}

export async function createMultiPageProject({ name, document, thumbnail = "", now = Date.now() } = {}, { indexedDBApi = globalThis.indexedDB } = {}) {
  const normalizedName = validateProjectName(name);
  const pageDocument = validatePageDocument(document);
  const timestamp = normalizeTimestamp(now);
  const projectId = createId();
  const page = pageMetadata({ id: createId(), name: "Página 1", document: pageDocument, thumbnail, createdAt: timestamp, updatedAt: timestamp });
  const project = { id: projectId, name: normalizedName, version: 1, createdAt: timestamp, updatedAt: timestamp, activePageId: page.id, pages: [page] };
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, PAGES_STORE], "readwrite");
      attachTransactionErrors(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE);
      const allRequest = projects.getAll();
      let result = null;
      allRequest.onerror = () => { try { transaction.abort(); } catch {} reject(allRequest.error || new Error("No se pudo comprobar el espacio de proyectos.")); };
      allRequest.onsuccess = () => {
        if ((allRequest.result || []).length >= MULTIPAGE_PROJECT_LIMIT) {
          try { transaction.abort(); } catch {}
          reject(new Error("La biblioteca llegó a 10 proyectos multipágina. Elimina o exporta uno antes de crear otro."));
          return;
        }
        projects.add(project);
        transaction.objectStore(PAGES_STORE).add({ id: page.id, projectId, document: pageDocument });
        result = summarizeProject(project);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function loadMultiPagePage(projectId, pageId, { indexedDBApi = globalThis.indexedDB } = {}) {
  if (!String(projectId || "") || !String(pageId || "")) throw new TypeError("Falta el proyecto o la página que quieres abrir.");
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PAGES_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(PAGES_STORE).get(String(pageId));
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la página."));
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.projectId !== String(projectId) || !isValidDocument(record.document)) { resolve(null); return; }
        try { resolve(restoreDocument(validatePageDocument(record.document))); } catch (error) { reject(error); }
      };
    });
  } finally { db.close(); }
}

export async function openMultiPageProject(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = String(id || "");
  if (!key) throw new TypeError("Falta el identificador del proyecto.");
  const projects = await listMultiPageProjects({ indexedDBApi });
  const project = projects.find(item => item.id === key);
  if (!project) return null;
  const page = project.pages.find(item => item.id === project.activePageId) || project.pages[0];
  if (!page) return null;
  const document = await loadMultiPagePage(project.id, page.id, { indexedDBApi });
  if (!document) return null;
  return { project, activePage: page, document };
}

export async function setActiveMultiPagePage(projectId, pageId, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const key = String(projectId || ""), pageKey = String(pageId || ""), timestamp = normalizeTimestamp(now);
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(PROJECTS_STORE), request = store.get(key);
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo cambiar la página activa."));
      request.onsuccess = () => {
        const project = request.result;
        if (!project || !project.pages.some(page => page.id === pageKey)) {
          try { transaction.abort(); } catch {}
          reject(new Error("La página no pertenece a este proyecto."));
          return;
        }
        result = summarizeProject({ ...project, activePageId: pageKey, updatedAt: timestamp });
        store.put(result);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function saveMultiPagePage(projectId, pageId, document, { thumbnail, now = Date.now(), indexedDBApi = globalThis.indexedDB } = {}) {
  const pageDocument = validatePageDocument(document);
  const timestamp = normalizeTimestamp(now);
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, PAGES_STORE], "readwrite");
      attachTransactionErrors(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE);
      const pages = transaction.objectStore(PAGES_STORE);
      const projectRequest = projects.get(String(projectId));
      const pageRequest = pages.get(String(pageId));
      let project = null, storedPage = null, pending = 2, result = null, failed = false;
      const ready = () => {
        pending -= 1;
        if (pending !== 0 || failed) return;
        if (!project || !storedPage || storedPage.projectId !== String(projectId)) {
          failed = true;
          try { transaction.abort(); } catch {}
          reject(new Error("La página ya no existe en este proyecto."));
          return;
        }
        const previous = project.pages.find(item => item.id === String(pageId));
        if (!previous) {
          failed = true;
          try { transaction.abort(); } catch {}
          reject(new Error("El índice del proyecto no contiene esa página."));
          return;
        }
        const updatedPage = pageMetadata({
          ...previous, id: pageId, name: previous.name, document: pageDocument,
          thumbnail: thumbnail === undefined ? previous.thumbnail : thumbnail,
          createdAt: previous.createdAt, updatedAt: timestamp
        });
        const updatedProject = {
          ...project, updatedAt: timestamp,
          pages: project.pages.map(item => item.id === updatedPage.id ? updatedPage : item)
        };
        projects.put(updatedProject);
        pages.put({ ...storedPage, document: pageDocument });
        result = { project: summarizeProject(updatedProject), page: { ...updatedPage } };
      };
      projectRequest.onerror = () => { failed = true; reject(projectRequest.error || new Error("No se pudo leer el proyecto.")); };
      pageRequest.onerror = () => { failed = true; reject(pageRequest.error || new Error("No se pudo leer la página.")); };
      projectRequest.onsuccess = () => { project = projectRequest.result || null; ready(); };
      pageRequest.onsuccess = () => { storedPage = pageRequest.result || null; ready(); };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function addMultiPagePage(projectId, { name, document, thumbnail = "", now = Date.now() } = {}, { indexedDBApi = globalThis.indexedDB } = {}) {
  const pageDocument = validatePageDocument(document);
  const timestamp = normalizeTimestamp(now);
  const id = createId();
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, PAGES_STORE], "readwrite");
      attachTransactionErrors(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE);
      const request = projects.get(String(projectId));
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo leer el proyecto."));
      request.onsuccess = () => {
        const project = request.result;
        if (!project) { try { transaction.abort(); } catch {} reject(new Error("No se encontró el proyecto multipágina.")); return; }
        if (project.pages.length >= MULTIPAGE_PAGE_LIMIT) { try { transaction.abort(); } catch {} reject(new Error("Este proyecto llegó al máximo de 10 páginas.")); return; }
        const page = pageMetadata({ id, name: name || "Página " + (project.pages.length + 1), document: pageDocument, thumbnail, createdAt: timestamp, updatedAt: timestamp });
        const updatedProject = { ...project, updatedAt: timestamp, activePageId: page.id, pages: [...project.pages, page] };
        projects.put(updatedProject);
        transaction.objectStore(PAGES_STORE).add({ id: page.id, projectId: String(projectId), document: pageDocument });
        result = { project: summarizeProject(updatedProject), page: { ...page } };
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function renameMultiPageProject(id, name, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const normalized = validateProjectName(name), key = String(id || ""), timestamp = normalizeTimestamp(now);
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(PROJECTS_STORE), request = store.get(key);
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo renombrar el proyecto."));
      request.onsuccess = () => {
        if (!request.result) return;
        result = summarizeProject({ ...request.result, name: normalized, updatedAt: timestamp });
        store.put(result);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function renameMultiPagePage(projectId, pageId, name, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const normalized = normalizeMultiPageName(name), timestamp = normalizeTimestamp(now);
  if (!normalized) throw new TypeError("Escribe un nombre válido para la página.");
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(PROJECTS_STORE), request = store.get(String(projectId));
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo renombrar la página."));
      request.onsuccess = () => {
        const project = request.result;
        if (!project) return;
        if (!project.pages.some(page => page.id === String(pageId))) { try { transaction.abort(); } catch {} reject(new Error("No se encontró la página.")); return; }
        const updated = { ...project, updatedAt: timestamp, pages: project.pages.map(page => page.id === String(pageId) ? { ...page, name: normalized, updatedAt: timestamp } : page) };
        store.put(updated);
        result = summarizeProject(updated);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function reorderMultiPagePage(projectId, pageId, targetIndex, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const timestamp = normalizeTimestamp(now), db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(PROJECTS_STORE), request = store.get(String(projectId));
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo reordenar las páginas."));
      request.onsuccess = () => {
        const project = request.result;
        if (!project) return;
        const oldIndex = project.pages.findIndex(page => page.id === String(pageId));
        if (oldIndex < 0) { try { transaction.abort(); } catch {} reject(new Error("No se encontró la página.")); return; }
        const pages = [...project.pages];
        const [page] = pages.splice(oldIndex, 1);
        const nextIndex = Math.max(0, Math.min(pages.length, Math.floor(Number(targetIndex) || 0)));
        pages.splice(nextIndex, 0, page);
        const updated = { ...project, updatedAt: timestamp, pages };
        store.put(updated);
        result = summarizeProject(updated);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function deleteMultiPagePage(projectId, pageId, { indexedDBApi = globalThis.indexedDB, now = Date.now() } = {}) {
  const timestamp = normalizeTimestamp(now), db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, PAGES_STORE], "readwrite");
      attachTransactionErrors(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE), pagesStore = transaction.objectStore(PAGES_STORE);
      const request = projects.get(String(projectId));
      let result = null;
      request.onerror = () => reject(request.error || new Error("No se pudo eliminar la página."));
      request.onsuccess = () => {
        const project = request.result;
        if (!project) return;
        if (project.pages.length <= 1) { try { transaction.abort(); } catch {} reject(new Error("Un proyecto debe conservar al menos una página.")); return; }
        const remaining = project.pages.filter(page => page.id !== String(pageId));
        if (remaining.length === project.pages.length) { try { transaction.abort(); } catch {} reject(new Error("No se encontró la página.")); return; }
        const activeStillExists = remaining.some(page => page.id === project.activePageId);
        const updated = { ...project, updatedAt: timestamp, activePageId: activeStillExists ? project.activePageId : remaining[Math.min(project.pages.findIndex(page => page.id === String(pageId)), remaining.length - 1)].id, pages: remaining };
        projects.put(updated);
        pagesStore.delete(String(pageId));
        result = summarizeProject(updated);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function deleteMultiPageProject(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = String(id || "");
  if (!key) return false;
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, PAGES_STORE], "readwrite");
      attachTransactionErrors(transaction, reject);
      const projects = transaction.objectStore(PROJECTS_STORE), pages = transaction.objectStore(PAGES_STORE);
      const request = pages.index("projectId").getAllKeys(key);
      let pending = 2, failed = false;
      const ready = () => {
        pending -= 1;
        if (pending || failed) return;
        projects.delete(key);
        for (const pageKey of request.result || []) pages.delete(pageKey);
      };
      request.onerror = () => { failed = true; reject(request.error || new Error("No se pudieron eliminar las páginas.")); };
      request.onsuccess = ready;
      const existsRequest = projects.get(key);
      existsRequest.onerror = () => { failed = true; reject(existsRequest.error || new Error("No se pudo comprobar el proyecto.")); };
      existsRequest.onsuccess = ready;
      transaction.oncomplete = () => resolve(true);
    });
  } finally { db.close(); }
}

export function copyLayerToPage(sourceDocument, targetDocument, layerId) {
  if (!isValidDocument(sourceDocument) || !isValidDocument(targetDocument)) return { ok: false, error: "No se pudieron validar las páginas.", document: null };
  if (!Array.isArray(targetDocument.layers) || targetDocument.layers.length >= 200) return { ok: false, error: "La página de destino ya tiene 200 capas.", document: null };
  const sourceLayer = sourceDocument.layers.find(layer => layer.id === String(layerId));
  if (!sourceLayer) return { ok: false, error: "Selecciona una capa válida para copiar.", document: null };
  const copiedLayer = JSON.parse(JSON.stringify(sourceLayer));
  copiedLayer.id = createId();
  copiedLayer.name = normalizeMultiPageName(sourceLayer.name + " (copia)", "Capa copiada");
  const next = restoreDocument({ ...targetDocument, layers: [...targetDocument.layers, copiedLayer] });
  if (!isValidDocument(next)) return { ok: false, error: "No se pudo copiar la capa a la página de destino.", document: null };
  if (JSON.stringify(next).length > MULTIPAGE_PAGE_CHARS_LIMIT) return { ok: false, error: "La página de destino superaría el límite de 2,5 MB al copiar esta capa.", document: null };
  return { ok: true, error: "", document: next, layerId: copiedLayer.id };
}
