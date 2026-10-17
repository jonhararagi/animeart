import { normalizeDocument } from "./model.mjs";

export const MAX_HISTORY_ENTRIES = 30;

function cloneDocument(document) {
  const normalized = normalizeDocument(JSON.parse(JSON.stringify(document)));
  if (!normalized) throw new TypeError("History requires a valid Document");
  return normalized;
}

export class DocumentHistory {
  constructor(initialDocument, { maxEntries = MAX_HISTORY_ENTRIES } = {}) {
    this.maxEntries = Number.isInteger(maxEntries) && maxEntries > 0
      ? maxEntries
      : MAX_HISTORY_ENTRIES;
    this.past = [];
    this.future = [];
    this.lastRecordFuture = null;
    this.lastTrimmedRecord = null;
    this.reset(initialDocument);
  }

  reset(document) {
    cloneDocument(document);
    this.past = [];
    this.future = [];
    this.lastRecordFuture = null;
    this.lastTrimmedRecord = null;
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
    // Keep the most recent operations only. Every entry contains full document
    // snapshots (including embedded image sources), so unbounded history grows
    // quickly on phones. Preserve the evicted entry until persistence succeeds
    // so discardLastRecord() can roll the transaction back without losing Undo.
    this.lastTrimmedRecord = this.past.length > this.maxEntries ? this.past.shift() : null;
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
    this.lastRecordFuture = null;
    this.lastTrimmedRecord = null;
    return cloneDocument(entry.before);
  }

  redo(currentDocument) {
    if (!this.canRedo()) return cloneDocument(currentDocument);
    const entry = this.future.pop();
    this.past.push({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    });
    this.lastRecordFuture = null;
    this.lastTrimmedRecord = null;
    return cloneDocument(entry.after);
  }

  discardLastRecord() {
    if (this.past.length === 0) return false;
    this.past.pop();
    if (this.lastTrimmedRecord) this.past.unshift(this.lastTrimmedRecord);
    this.future = (this.lastRecordFuture || []).map(entry => ({
      before: cloneDocument(entry.before),
      after: cloneDocument(entry.after)
    }));
    this.lastRecordFuture = null;
    this.lastTrimmedRecord = null;
    return true;
  }

  size() {
    return this.past.length;
  }
}

export { cloneDocument };
