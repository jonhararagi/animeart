import { isValidDocument, restoreDocument } from "./model.mjs";

export const PROJECT_RECOVERY_DATABASE = "kapiart-project-recovery";
export const PROJECT_RECOVERY_DATABASE_VERSION = 1;
export const PROJECT_RECOVERY_SNAPSHOT_LIMIT = 3;
export const MAX_RECOVERY_SNAPSHOT_CHARS = 2_500_000;
export const MAX_RECOVERY_MULTIPAGE_PAGES = 10;
export const MAX_RECOVERY_MULTIPAGE_CHARS = 25_000_000;

const SNAPSHOTS_STORE = "snapshots";
const RECOVERY_PROJECT_ID = "active-canvas";
const MAX_DOCUMENT_DIMENSION = 8192;
const MAX_DOCUMENT_PIXELS = 40_000_000;
const MAX_DOCUMENT_LAYERS = 200;
const RECOVERY_REASONS = new Set(["automatic", "manual", "before-restore"]);

function makeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "recovery-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

function validateRecoveryDocument(document) {
  if (!isValidDocument(document)) throw new TypeError("El respaldo no contiene un documento editable válido.");
  if (!Number.isInteger(document.width) || !Number.isInteger(document.height) ||
      document.width < 0 || document.height < 0 ||
      document.width > MAX_DOCUMENT_DIMENSION || document.height > MAX_DOCUMENT_DIMENSION ||
      document.width * document.height > MAX_DOCUMENT_PIXELS) {
    throw new RangeError("El documento supera los límites seguros de recuperación.");
  }
  if (!Array.isArray(document.layers) || document.layers.length > MAX_DOCUMENT_LAYERS) {
    throw new RangeError("El documento supera el máximo de 200 capas.");
  }
  const serialized = JSON.stringify(document);
  if (serialized.length > MAX_RECOVERY_SNAPSHOT_CHARS) {
    throw new RangeError("El respaldo supera el límite local de 2,5 MB. Exporta una copia del proyecto.");
  }
  return { document: restoreDocument(document), serialized };
}

export function createRecoverySnapshot({ document, id = makeId(), now = Date.now(), reason = "automatic" } = {}) {
  const validated = validateRecoveryDocument(document);
  const timestamp = Number(now);
  const createdAt = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
  const safeReason = RECOVERY_REASONS.has(reason) ? reason : "automatic";
  return {
    id: String(id),
    projectId: RECOVERY_PROJECT_ID,
    reason: safeReason,
    createdAt,
    width: document.width,
    height: document.height,
    layerCount: document.layers.length,
    serializedChars: validated.serialized.length,
    document: validated.document
  };
}

function openDatabase(indexedDBApi = globalThis.indexedDB) {
  if (!indexedDBApi || typeof indexedDBApi.open !== "function") {
    return Promise.reject(new Error("La recuperación automática necesita IndexedDB. Exporta también un archivo de proyecto como copia externa."));
  }
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDBApi.open(PROJECT_RECOVERY_DATABASE, PROJECT_RECOVERY_DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(SNAPSHOTS_STORE, { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la bóveda de recuperación."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de KapiArt para actualizar la bóveda de recuperación."));
  });
}

function attachTransactionErrors(transaction, reject) {
  transaction.onabort = () => reject(transaction.error || new Error("La operación de recuperación se canceló."));
  transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el respaldo local."));
}

function publicSnapshot(record) {
  const { document, pages, ...metadata } = record;
  return metadata;
}

export function selectRecoverySnapshotIdsToRetain(records, preserveSnapshotId = null) {
  const ordered = (Array.isArray(records) ? [...records] : [])
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0) ||
      String(b.id || "").localeCompare(String(a.id || "")));
  const preserved = preserveSnapshotId == null
    ? null
    : ordered.find(record => String(record.id) === String(preserveSnapshotId));
  const keep = [];
  if (preserved) keep.push(preserved);
  for (const record of ordered) {
    if (preserved && String(record.id) === String(preserved.id)) continue;
    if (keep.length >= PROJECT_RECOVERY_SNAPSHOT_LIMIT - 1) break;
    keep.push(record);
  }
  return new Set(keep.map(record => String(record.id)));
}

export async function saveRecoverySnapshot(document, {
  indexedDBApi = globalThis.indexedDB,
  now = Date.now(),
  reason = "automatic",
  preserveSnapshotId = null
} = {}) {
  const snapshot = createRecoverySnapshot({ document, now, reason });
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(SNAPSHOTS_STORE);
      const request = store.getAll();
      let result = null;
      request.onerror = () => {
        try { transaction.abort(); } catch {}
        reject(request.error || new Error("No se pudieron consultar los respaldos anteriores."));
      };
      request.onsuccess = () => {
        const existing = (request.result || [])
          .filter(item => item.projectId === RECOVERY_PROJECT_ID)
          .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
        const latest = existing[0];
        if (latest && JSON.stringify(latest.document) === JSON.stringify(snapshot.document)) {
          result = publicSnapshot(latest);
          return;
        }
        store.add(snapshot);
        const retainedIds = selectRecoverySnapshotIdsToRetain(existing, preserveSnapshotId);
        for (const stale of existing) {
          if (!retainedIds.has(String(stale.id))) store.delete(stale.id);
        }
        result = publicSnapshot(snapshot);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function listRecoverySnapshots({ indexedDBApi = globalThis.indexedDB } = {}) {
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(SNAPSHOTS_STORE).getAll();
      let result = [];
      request.onerror = () => reject(request.error || new Error("No se pudieron leer los respaldos."));
      request.onsuccess = () => {
        result = (request.result || [])
          .filter(item => item.projectId === RECOVERY_PROJECT_ID)
          .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
          .map(publicSnapshot);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function loadRecoverySnapshot(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = String(id || "");
  if (!key) throw new TypeError("Falta el identificador del respaldo.");
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(SNAPSHOTS_STORE).get(key);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el respaldo."));
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.projectId !== RECOVERY_PROJECT_ID) {
          resolve(null);
          return;
        }
        try {
          validateRecoveryDocument(record.document);
          resolve({ ...publicSnapshot(record), document: restoreDocument(record.document) });
        } catch (error) {
          reject(error);
        }
      };
    });
  } finally {
    db.close();
  }
}


function multipageRecoveryProjectKey(projectId) {
  const key = String(projectId || "").trim();
  if (!key) throw new TypeError("Falta el identificador del proyecto multipágina.");
  return "multipage:" + key;
}

export function describeRecoveryStorageError(error) {
  if (error?.name === "QuotaExceededError") {
    return "El almacenamiento local está lleno. KapiArt conservó los respaldos anteriores; exporta una copia y libera espacio antes de volver a guardar.";
  }
  if (error?.name === "InvalidStateError" || error?.name === "UnknownError") {
    return "El almacenamiento local no está disponible en este momento. KapiArt no eliminará tus proyectos; intenta exportar una copia cuando el almacenamiento vuelva a funcionar.";
  }
  if (error?.name === "AbortError") {
    return "El respaldo se interrumpió antes de completarse. Los puntos anteriores se conservaron.";
  }
  return error?.message || "No se pudo completar la operación de recuperación.";
}

export function createMultiPageRecoverySnapshot({ project, pages, id = makeId(), now = Date.now(), reason = "automatic" } = {}) {
  if (!project || typeof project !== "object") throw new TypeError("Falta el proyecto multipágina que se quiere respaldar.");
  const sourceProjectId = String(project.id || "").trim();
  const projectName = String(project.name || "").trim().slice(0, 90);
  if (!sourceProjectId || !projectName) throw new TypeError("El proyecto multipágina no tiene un identificador y nombre válidos.");
  if (!Array.isArray(project.pages) || project.pages.length < 1 || project.pages.length > MAX_RECOVERY_MULTIPAGE_PAGES) {
    throw new RangeError("Un respaldo multipágina debe contener entre 1 y 10 páginas.");
  }
  if (!Array.isArray(pages)) throw new TypeError("Faltan los documentos editables de las páginas.");
  const byId = new Map();
  for (const item of pages) {
    const key = String(item?.id || "").trim();
    if (!key || byId.has(key)) throw new TypeError("El respaldo contiene identificadores de página vacíos o duplicados.");
    byId.set(key, item);
  }
  const seen = new Set();
  let serializedChars = 0;
  const normalizedPages = project.pages.map((metadata, order) => {
    const pageId = String(metadata?.id || "").trim();
    if (!pageId || seen.has(pageId)) throw new TypeError("El proyecto contiene páginas duplicadas o sin identificador.");
    seen.add(pageId);
    const source = byId.get(pageId);
    if (!source?.document) throw new TypeError("No se pudo leer el contenido de la página «" + String(metadata?.name || pageId) + "».");
    const validated = validateRecoveryDocument(source.document);
    serializedChars += validated.serialized.length;
    return {
      id: pageId,
      name: String(metadata?.name || "Página " + (order + 1)).slice(0, 90),
      order,
      width: validated.document.width,
      height: validated.document.height,
      layerCount: validated.document.layers.length,
      thumbnail: typeof metadata?.thumbnail === "string" && metadata.thumbnail.startsWith("data:image/")
        ? metadata.thumbnail.slice(0, 280_000) : "",
      createdAt: Number(metadata?.createdAt) || Number(now) || Date.now(),
      updatedAt: Number(metadata?.updatedAt) || Number(now) || Date.now(),
      document: validated.document
    };
  });
  if (byId.size !== normalizedPages.length) throw new TypeError("El respaldo contiene páginas que no pertenecen al proyecto.");
  if (serializedChars > MAX_RECOVERY_MULTIPAGE_CHARS) {
    throw new RangeError("El proyecto supera el límite seguro de 25 MB por respaldo multipágina. Exporta el proyecto por separado.");
  }
  const activePageId = normalizedPages.some(page => page.id === String(project.activePageId))
    ? String(project.activePageId) : normalizedPages[0].id;
  const activePage = normalizedPages.find(page => page.id === activePageId) || normalizedPages[0];
  const timestamp = Number(now);
  const createdAt = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
  const safeReason = RECOVERY_REASONS.has(reason) ? reason : "automatic";
  return {
    id: String(id),
    kind: "multipage",
    projectId: multipageRecoveryProjectKey(sourceProjectId),
    sourceProjectId,
    projectName,
    version: Number(project.version) || 1,
    projectCreatedAt: Number(project.createdAt) || createdAt,
    projectUpdatedAt: Number(project.updatedAt) || createdAt,
    activePageId,
    pageCount: normalizedPages.length,
    totalLayerCount: normalizedPages.reduce((total, page) => total + page.layerCount, 0),
    serializedChars,
    reason: safeReason,
    createdAt,
    width: activePage.width,
    height: activePage.height,
    layerCount: activePage.layerCount,
    pages: normalizedPages
  };
}

export async function saveMultiPageRecoverySnapshot(project, pages, {
  indexedDBApi = globalThis.indexedDB,
  now = Date.now(),
  reason = "automatic",
  preserveSnapshotId = null
} = {}) {
  const snapshot = createMultiPageRecoverySnapshot({ project, pages, now, reason });
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readwrite");
      attachTransactionErrors(transaction, reject);
      const store = transaction.objectStore(SNAPSHOTS_STORE);
      const request = store.getAll();
      let result = null;
      request.onerror = () => {
        try { transaction.abort(); } catch {}
        reject(request.error || new Error("No se pudieron consultar los respaldos multipágina anteriores."));
      };
      request.onsuccess = () => {
        const existing = (request.result || [])
          .filter(item => item.projectId === snapshot.projectId)
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0) || String(b.id).localeCompare(String(a.id)));
        const latest = existing[0];
        if (latest && JSON.stringify(latest.pages) === JSON.stringify(snapshot.pages) &&
            latest.activePageId === snapshot.activePageId && latest.projectName === snapshot.projectName) {
          result = publicSnapshot(latest);
          return;
        }
        store.add(snapshot);
        const retainedIds = selectRecoverySnapshotIdsToRetain(existing, preserveSnapshotId);
        for (const stale of existing) {
          if (!retainedIds.has(String(stale.id))) store.delete(stale.id);
        }
        result = publicSnapshot(snapshot);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function listMultiPageRecoverySnapshots(projectId, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = multipageRecoveryProjectKey(projectId);
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(SNAPSHOTS_STORE).getAll();
      let result = [];
      request.onerror = () => reject(request.error || new Error("No se pudieron listar los respaldos del proyecto multipágina."));
      request.onsuccess = () => {
        result = (request.result || [])
          .filter(item => item.projectId === key && item.kind === "multipage")
          .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
          .map(publicSnapshot);
      };
      transaction.oncomplete = () => resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function loadMultiPageRecoverySnapshot(id, { indexedDBApi = globalThis.indexedDB } = {}) {
  const key = String(id || "").trim();
  if (!key) throw new TypeError("Falta el identificador del respaldo multipágina.");
  const db = await openDatabase(indexedDBApi);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SNAPSHOTS_STORE, "readonly");
      attachTransactionErrors(transaction, reject);
      const request = transaction.objectStore(SNAPSHOTS_STORE).get(key);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el respaldo multipágina."));
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.kind !== "multipage" ||
            record.projectId !== multipageRecoveryProjectKey(record.sourceProjectId)) {
          resolve(null);
          return;
        }
        try {
          const project = {
            id: record.sourceProjectId,
            name: record.projectName,
            version: record.version,
            createdAt: record.projectCreatedAt,
            updatedAt: record.projectUpdatedAt,
            activePageId: record.activePageId,
            pages: record.pages
          };
          resolve(createMultiPageRecoverySnapshot({
            project,
            pages: record.pages,
            id: record.id,
            now: record.createdAt,
            reason: record.reason
          }));
        } catch (error) {
          reject(error);
        }
      };
    });
  } finally {
    db.close();
  }
}
