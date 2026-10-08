import { normalizeDocument } from "./model.mjs";

function cloneDocument(document) {
  const normalized = normalizeDocument(JSON.parse(JSON.stringify(document)));
  if (!normalized) throw new TypeError("History requires a valid Document");
  return normalized;
}

export class DocumentHistory {
  constructor(initialDocument) {
    this.past = [];
    this.future = [];
    this.reset(initialDocument);
  }

  reset(document) {
    cloneDocument(document);
    this.past = [];
    this.future = [];
    this.lastRecordFuture = null;
  }

  record(before, after) {
    const beforeSnapshot = cloneDocument(before);
    const afterSnapshot = cloneDocument(after);
    if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) return false;
    this.past.push({ before: beforeSnapshot, after: afterSnapshot });
    this.lastRecordFuture = this.future.map(entry => ({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    }));
    this.future = [];
    return true;
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  undo(currentDocument) {
    if (!this.canUndo()) return cloneDocument(currentDocument);
    const entry = this.past.pop();
    this.future.push({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    });
    return cloneDocument(entry.before);
  }

  redo(currentDocument) {
    if (!this.canRedo()) return cloneDocument(currentDocument);
    const entry = this.future.pop();
    this.past.push({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    });
    return cloneDocument(entry.after);
  }

  discardLastRecord() {
    if (this.past.length === 0) return false;
    this.past.pop();
    this.future = (this.lastRecordFuture || []).map(entry => ({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    }));
    this.lastRecordFuture = null;
    return true;
  }

  size() {
    return this.past.length;
  }
}

export { cloneDocument };
