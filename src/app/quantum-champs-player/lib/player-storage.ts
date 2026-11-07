"use client";

/** Quantum player state only. Existing assessment and creator storage is untouched. */
type Entry = { key: string; value: string | null };
type Pending = { value: string | null; version: number };
const DB_NAME = "neurolxp-quantum-player-state";
const STORE = "values";
const CHANNEL = "neurolxp-quantum-player-state";
export const PLAYER_STORAGE_ERROR = "quantum-player-storage-error";
export const PLAYER_STORAGE_RECOVERED = "quantum-player-storage-recovered";
const cache = new Map<string, string>();
const pending = new Map<string, Pending>();
let database: IDBDatabase | null = null;
let opening: Promise<void> | null = null;
let flushing: Promise<void> | null = null;
let ready = false;
let version = 0;
let channel: BroadcastChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshNumber = 0;

function managed(key: string): boolean { return key.startsWith("qc"); }
function reportFailure(error: unknown): void {
  if (typeof window === "undefined") return;
  const message = error instanceof Error ? error.message : "Game data could not be saved.";
  window.dispatchEvent(new CustomEvent(PLAYER_STORAGE_ERROR, { detail: message }));
}
function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("qc-game-change"));
}
function notifyRemote(key: string, previous: string | undefined, next: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, oldValue: previous ?? null, newValue: next ?? null, storageArea: window.localStorage, url: window.location.href }));
  } catch {
    if (key === "qc-player-lobbies-v1" || key === "qc-player-signal-v1") window.dispatchEvent(new Event("qc-lobby-update"));
  }
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("Browser storage is unavailable.")); return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open game storage."));
    request.onblocked = () => reject(new Error("Game storage is blocked by another tab."));
  });
}
function getLegacyEntries(): Entry[] {
  const entries: Entry[] = [];
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !managed(key)) continue;
      const value = storage.getItem(key);
      if (value !== null) entries.push({ key, value });
    }
  } catch { /* Other origin storage may be unavailable; IndexedDB remains authoritative. */ }
  return entries;
}
function migrateAndLoad(db: IDBDatabase, legacy: Entry[]): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.getAll();
    let result: Entry[] = [];
    request.onsuccess = () => {
      result = (request.result as Entry[]).filter(item => item && typeof item.key === "string" && managed(item.key) && (typeof item.value === "string" || item.value === null));
      const present = new Set(result.map(item => item.key));
      for (const entry of legacy) {
        if (!present.has(entry.key)) { store.put(entry); result.push(entry); present.add(entry.key); }
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("Could not load game storage."));
    tx.onabort = () => reject(tx.error || new Error("Game storage migration was cancelled."));
  });
}
function readAll(db: IDBDatabase): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as Entry[]);
    request.onerror = () => reject(request.error || new Error("Could not refresh game storage."));
  });
}
async function refreshFromDatabase(): Promise<void> {
  if (!ready || !database) return;
  const number = ++refreshNumber;
  const entries = await readAll(database);
  if (number !== refreshNumber) return;
  const incoming = new Map<string, string>();
  for (const entry of entries) if (entry && managed(entry.key) && typeof entry.value === "string") incoming.set(entry.key, entry.value);
  let changed = false;
  for (const key of new Set([...cache.keys(), ...incoming.keys()])) {
    if (pending.has(key)) continue;
    const next = incoming.get(key), previous = cache.get(key);
    if (next === previous) continue;
    if (next === undefined) cache.delete(key); else cache.set(key, next);
    notifyRemote(key, previous, next);
    changed = true;
  }
  if (changed) notify();
}
function installSync(): void {
  if (channel || pollTimer || typeof window === "undefined") return;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => { void refreshFromDatabase().catch(reportFailure); };
      return;
    }
  } catch { channel = null; }
  // Fallback for browsers without BroadcastChannel: only read the Quantum state DB.
  pollTimer = setInterval(() => { void refreshFromDatabase().catch(reportFailure); }, 1500);
}
export function preparePlayerStorage(): Promise<void> {
  if (ready) return Promise.resolve();
  if (opening) return opening;
  opening = (async () => {
    const db = await openDatabase();
    try {
      const entries = await migrateAndLoad(db, getLegacyEntries());
      database = db;
      db.onversionchange = () => { db.close(); database = null; ready = false; opening = null; reportFailure(new Error("Game storage needs to be reopened.")); };
      cache.clear();
      for (const entry of entries) if (typeof entry.value === "string") cache.set(entry.key, entry.value);
      for (const [key, item] of pending) {
        if (item.value === null) cache.delete(key); else cache.set(key, item.value);
      }
      ready = true;
      installSync();
      // Catch writes from another tab that committed while this tab was loading.
      await refreshFromDatabase();
    } catch (error) { db.close(); database = null; ready = false; throw error; }
  })().catch(error => { opening = null; throw error; });
  return opening;
}
function writeBatch(db: IDBDatabase, entries: Array<[string, Pending]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const [key, item] of entries) store.put({ key, value: item.value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not save game progress."));
    tx.onabort = () => reject(tx.error || new Error("Saving game progress was cancelled."));
  });
}
export function flushPlayerStorage(): Promise<void> {
  if (flushing) return flushing;
  if (!ready || !database) return Promise.reject(new Error("Game storage has not finished loading."));
  const db = database;
  let succeeded = false;
  flushing = (async () => {
    while (pending.size) {
      const batch = [...pending.entries()];
      await writeBatch(db, batch);
      for (const [key, item] of batch) {
        if (pending.get(key)?.version === item.version) pending.delete(key);
      }
      try { channel?.postMessage({ changed: true }); } catch { /* Polling/next update can refresh another tab. */ }
    }
    succeeded = true;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_STORAGE_RECOVERED));
  })().catch(error => { reportFailure(error); throw error; }).finally(() => {
    flushing = null;
    if (succeeded && pending.size) queueMicrotask(() => { void flushPlayerStorage().catch(() => {}); });
  });
  return flushing;
}
function queue(key: string, value: string | null): void {
  if (!ready) throw new Error("Game storage has not finished loading.");
  if (value === null) cache.delete(key); else cache.set(key, value);
  pending.set(key, { value, version: ++version });
  queueMicrotask(() => { void flushPlayerStorage().catch(() => {}); });
}
function keys(): string[] {
  const all = new Set(cache.keys());
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && !managed(key)) all.add(key);
    }
  } catch { /* Managed keys are still available through IndexedDB. */ }
  return [...all];
}
/** Storage-compatible facade; only keys beginning qc use the Quantum DB. */
export const quantumPlayerStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return managed(key) ? cache.get(key) ?? null : window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    if (managed(key)) queue(key, String(value)); else window.localStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    if (managed(key)) queue(key, null); else window.localStorage.removeItem(key);
  },
  key(index: number): string | null { return typeof window === "undefined" ? null : keys()[index] ?? null; },
  get length(): number { return typeof window === "undefined" ? 0 : keys().length; },
  clear(): void { throw new Error("Clearing browser storage is disabled for Quantum player data."); },
};
