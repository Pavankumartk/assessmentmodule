"use client";

/**
 * Small Published-list records for Quantum Champs only.
 * The full game remains in the original Quantum Champs IndexedDB store.
 * This registry avoids writing to the quota-limited neurolxp.assessments.v1 key.
 * Browser-local only; it does not sync assessments across devices.
 */
import type { StoredAssessment } from "./assessment-storage";

const DB_NAME = "neurolxp-quantum-published-list";
const STORE_NAME = "published";
const CHANGED = "neurolxp-assessments-changed";
let loaded = false;
let loading: Promise<void> | null = null;
const records = new Map<string, StoredAssessment>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is unavailable. Enable browser site storage to publish Quantum Champs."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Quantum Champs published list."));
    request.onblocked = () => reject(new Error("Close other assessment tabs and reload to finish publication."));
  });
}

function load(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const db = await openDatabase();
    try {
      const all = await new Promise<StoredAssessment[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as StoredAssessment[]);
        request.onerror = () => reject(request.error || new Error("Could not read published Quantum Champs assessments."));
      });
      records.clear();
      for (const record of all) {
        if (record?.id && record.typeCode === "quantum-champs" && record.status === "Published") {
          records.set(record.id, record);
        }
      }
      loaded = true;
      window.dispatchEvent(new Event(CHANGED));
    } finally {
      db.close();
    }
  })().catch(error => {
    loading = null; // Permit retries after temporary browser failures.
    throw error;
  });
  return loading;
}

/** Synchronous cached read for the existing Published and Learner list APIs. */
export function getPublishedQuantumListings(): StoredAssessment[] {
  if (typeof window === "undefined") return [];
  if (!loaded) void load().catch(error => console.error("Quantum Champs published list:", error));
  return [...records.values()];
}

/** Save durable metadata; never rewrite neurolxp.assessments.v1. */
export async function savePublishedQuantumListing(record: StoredAssessment): Promise<void> {
  if (record.typeCode !== "quantum-champs" || record.status !== "Published") {
    throw new Error("Only published Quantum Champs assessments can use this registry.");
  }
  await load();
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not publish Quantum Champs."));
      tx.onabort = () => reject(tx.error || new Error("Quantum Champs publication was cancelled."));
    });
  } finally {
    db.close();
  }
  records.set(record.id, record);
  window.dispatchEvent(new Event(CHANGED));
}
