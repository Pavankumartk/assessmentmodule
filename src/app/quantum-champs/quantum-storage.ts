"use client";

/**
 * Quantum Champs only. IndexedDB holds full assessments; localStorage holds a
 * compact, backwards-compatible listing record. No other assessment is changed.
 * Browser storage stays local to the current browser/profile (no server sync).
 */
const DB_NAME = "neurolxp-quantum-champs";
const STORE_NAME = "entries";
const DB_VERSION = 1;
const CURRENT_ID = "quantumChampsCurrentId";
const RECORD_PREFIX = "quantumChamps:";
const LARGE_SESSION_KEYS = new Set([
  "quantumChampsDraft",
  "quantumChampsQuestions",
  "mcqContentDraft",
  "shortAnswerContentDraft",
]);
// Shared MCQ/Short Answer session names also exist in unrelated assessments.
// Never migrate, remove or modify their original sessionStorage values.
const QC_LEGACY_SESSION_KEYS = new Set(["quantumChampsDraft", "quantumChampsQuestions"]);

type Entry = { key: string; value: string };
type JsonObject = Record<string, unknown>;
const values = new Map<string, string>();
const unwritten = new Map<string, string | null>();
let database: IDBDatabase | null = null;
let starting: Promise<void> | null = null;
let ready = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writing: Promise<void> = Promise.resolve();
let lastError: Error | null = null;

const isRecord = (key: string) => key.startsWith(RECORD_PREFIX) && key.length > RECORD_PREFIX.length;
const isManaged = (key: string) => isRecord(key) || LARGE_SESSION_KEYS.has(key);
const asObject = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (v: unknown): string => typeof v === "string" ? v : "";
const num = (v: unknown): number => Number.isFinite(Number(v)) ? Number(v) : 0;

function compactRecord(key: string, raw: string): string | null {
  try {
    const whole = asObject(JSON.parse(raw));
    if (!Object.keys(whole).length) return null;
    const details = asObject(whole.details);
    const form = asObject(whole.form);
    const content = asObject(whole.content);
    const questions = asObject(whole.createQuestions ?? whole.questionBuilder);
    const evaluation = asObject(whole.evaluation);
    const evalSettings = asObject(evaluation.settings);
    const review = asObject(whole.review);
    const id = text(whole.assessmentId) || key.slice(RECORD_PREFIX.length);
    // Enough for the existing Assessment list, view/edit routes and player code lookup.
    // No images, rich editor HTML, question arrays, or duplicated full drafts.
    const summary = {
      assessmentId: id,
      assessmentCode: text(whole.assessmentCode) || text(details.assessmentCode) || id,
      accessCode: text(whole.accessCode) || text(details.accessCode),
      title: text(whole.title) || text(whole.assessmentName) || text(details.title) || text(form.title) || text(form.assessmentName),
      assessmentName: text(whole.assessmentName) || text(details.assessmentName) || text(form.assessmentName),
      course: text(whole.course) || text(details.course) || text(form.course),
      rounds: num(whole.rounds || details.rounds || form.rounds),
      questionsPerRound: num(whole.questionsPerRound || details.questionsPerRound || form.questionsPerRound),
      totalQuestions: num(whole.totalQuestions || details.totalQuestions || form.totalQuestions),
      status: text(whole.status) || "details_saved",
      isPublished: whole.isPublished === true,
      published: whole.published === true,
      updatedAt: text(whole.updatedAt) || text(details.updatedAt),
      details: {
        assessmentName: text(details.assessmentName) || text(whole.assessmentName),
        title: text(details.title), course: text(details.course),
        rounds: num(details.rounds), questionsPerRound: num(details.questionsPerRound),
        totalQuestions: num(details.totalQuestions),
        startDate: text(details.startDate),
      },
      form: {
        assessmentName: text(form.assessmentName), title: text(form.title),
        course: text(form.course), rounds: num(form.rounds),
        questionsPerRound: num(form.questionsPerRound),
        totalQuestions: num(form.totalQuestions),
      },
      content: Object.keys(content).length ? { saved: content.saved === true, updatedAt: text(content.updatedAt) } : undefined,
      createQuestions: Object.keys(questions).length ? { saved: questions.saved === true, updatedAt: text(questions.updatedAt) } : undefined,
      evaluation: Object.keys(evaluation).length ? { saved: evaluation.saved === true, totalXp: num(evaluation.totalXp || evalSettings.totalXp), settings: { totalXp: num(evalSettings.totalXp), attempts: text(evalSettings.attempts) } } : undefined,
      review: Object.keys(review).length ? { saved: review.saved === true } : undefined,
    };
    return JSON.stringify(summary);
  } catch {
    return null;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Cannot open Quantum Champs storage."));
    request.onblocked = () => reject(new Error("Close other tabs using Quantum Champs and reload."));
  });
}

function loadEntries(db: IDBDatabase): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as Entry[]);
    req.onerror = () => reject(req.error || new Error("Cannot read Quantum Champs records."));
  });
}

function applyBatch(db: IDBDatabase, batch: Map<string, string | null>): Promise<void> {
  if (!batch.size) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    batch.forEach((value, key) => {
      if (value === null) store.delete(key);
      else store.put({ key, value } satisfies Entry);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Quantum Champs database write failed."));
    tx.onabort = () => reject(tx.error || new Error("Quantum Champs database write was cancelled."));
  });
}

function nativeValue(key: string): string | null {
  try {
    const fromLocal = window.localStorage.getItem(key);
    if (fromLocal !== null) return fromLocal;
  } catch { /* browser can deny Web Storage */ }
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

function refreshListing(key: string, raw: string): void {
  const summary = compactRecord(key, raw);
  if (!summary) return;
  try {
    // Existing heavy localStorage entries are overwritten with a small summary.
    window.localStorage.setItem(key, summary);
  } catch {
    // Full assessment is stored in IndexedDB. Never delete unrelated local data.
  }
}

function notifyStorageError(error: unknown): void {
  lastError = error instanceof Error ? error : new Error(String(error));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quantum-champs-storage-error", { detail: lastError.message }));
  }
}

/** Called by the Quantum Champs template before any creator page mounts. */
export function prepareQuantumStorage(): Promise<void> {
  if (ready) return Promise.resolve();
  if (starting) return starting;
  starting = (async () => {
    const db = await openDatabase();
    database = db;
    for (const item of await loadEntries(db)) values.set(item.key, item.value);

    // Migrate legacy browser records before replacing/removing anything.
    const importLegacy = new Map<string, string | null>();
    const localRecordKeys: string[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isRecord(key)) localRecordKeys.push(key);
      }
    } catch { /* ignore inaccessible localStorage */ }
    for (const key of localRecordKeys) {
      const old = nativeValue(key);
      if (!old) continue;
      if (!values.has(key)) { values.set(key, old); importLegacy.set(key, old); }
    }
    for (const key of QC_LEGACY_SESSION_KEYS) {
      const old = nativeValue(key);
      if (old && !values.has(key)) { values.set(key, old); importLegacy.set(key, old); }
    }
    // A durable database transaction must complete BEFORE old copies are shortened.
    await applyBatch(db, importLegacy);
    for (const key of localRecordKeys) {
      const full = values.get(key);
      if (full) refreshListing(key, full);
    }
    // These are redundant legacy copies, not canonical assessment records.
    // They are only removed after being saved into IndexedDB.
    for (const key of QC_LEGACY_SESSION_KEYS) {
      if (!values.has(key)) continue;
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
      try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
    }
    ready = true;
  })().catch(error => {
    starting = null;
    notifyStorageError(error);
    throw error;
  });
  return starting;
}

export function isQuantumStorageReady(): boolean { return ready; }

function scheduleWrite(key: string, value: string | null): void {
  values.delete(key);
  if (value !== null) values.set(key, value);
  unwritten.set(key, value);
  if (writeTimer === null) {
    writeTimer = setTimeout(() => {
      writeTimer = null;
      void flushQuantumStorage().catch(notifyStorageError);
    }, 30);
  }
}

/** Await this in code paths that need to confirm a disk write finished. */
export async function flushQuantumStorage(): Promise<void> {
  if (!ready || !database) throw new Error("Quantum Champs storage is not initialized.");
  if (writeTimer !== null) { clearTimeout(writeTimer); writeTimer = null; }
  const pending = new Map(unwritten);
  unwritten.clear();
  if (pending.size) {
    writing = writing.catch(() => undefined).then(async () => {
      await applyBatch(database!, pending);
      pending.forEach((value, key) => { if (value !== null && isRecord(key)) refreshListing(key, value); });
    });
  }
  try {
    await writing;
    if (lastError) { const old = lastError; lastError = null; throw old; }
  } catch (error) {
    // The cache retains the edits, so a later save can retry them.
    pending.forEach((value, key) => { if (!unwritten.has(key)) unwritten.set(key, value); });
    notifyStorageError(error);
    throw error;
  }
}

function setId(value: string): void {
  let didSave = false;
  try { window.localStorage.setItem(CURRENT_ID, value); didSave = true; } catch { /* quota full */ }
  // Keep the tab's active ID in sync even when localStorage still holds an old ID.
  try { window.sessionStorage.setItem(CURRENT_ID, value); didSave = true; } catch { /* denied */ }
  if (!didSave) throw new Error("Cannot store the current Quantum Champs assessment ID.");
}

function getId(): string | null {
  // Prefer the tab's selection if the native localStorage write failed.
  try { const id = window.sessionStorage.getItem(CURRENT_ID); if (id) return id; } catch { /* ignore */ }
  try { const id = window.localStorage.getItem(CURRENT_ID); if (id) return id; } catch { /* ignore */ }
  return null;
}

/** A narrowly scoped synchronous facade, preserving existing page.tsx calls. */
export const quantumStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    if (key === CURRENT_ID) return getId();
    if (isManaged(key)) return values.get(key) ?? nativeValue(key);
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    if (key === CURRENT_ID) { setId(String(value)); return; }
    if (!isManaged(key)) { window.localStorage.setItem(key, String(value)); return; }
    if (!ready) throw new Error("Quantum Champs storage is still loading.");
    scheduleWrite(key, String(value));
    // No full record is ever written to localStorage.
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    if (!isManaged(key)) { window.localStorage.removeItem(key); return; }
    if (!ready) throw new Error("Quantum Champs storage is still loading.");
    scheduleWrite(key, null);
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
  },
  key(index: number): string | null {
    if (typeof window === "undefined") return null;
    const keys = new Set<string>(values.keys());
    try { for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i); if (key) keys.add(key);
    } } catch { /* ignore */ }
    return [...keys][index] ?? null;
  },
  get length(): number {
    if (typeof window === "undefined") return 0;
    const keys = new Set<string>(values.keys());
    try { for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i); if (key) keys.add(key);
    } } catch { /* ignore */ }
    return keys.size;
  },
  // Not used by the Quantum Champs flow; intentionally does NOT erase other assessment data.
  clear(): void { throw new Error("Clearing all browser storage is disabled for Quantum Champs."); },
  flush: flushQuantumStorage,
};

export const quantumSessionStorage = {
  getItem(key: string): string | null {
    if (LARGE_SESSION_KEYS.has(key)) return quantumStorage.getItem(key);
    if (typeof window === "undefined") return null;
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    if (LARGE_SESSION_KEYS.has(key)) { quantumStorage.setItem(key, value); return; }
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (LARGE_SESSION_KEYS.has(key)) { quantumStorage.removeItem(key); return; }
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
  key(index: number): string | null {
    if (typeof window === "undefined") return null;
    try { return window.sessionStorage.key(index); } catch { return null; }
  },
  get length(): number {
    if (typeof window === "undefined") return 0;
    try { return window.sessionStorage.length; } catch { return 0; }
  },
  clear(): void { throw new Error("Clearing browser storage is disabled for Quantum Champs."); },
};
