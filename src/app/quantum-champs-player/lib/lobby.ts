export type Team = {
  id: string;
  name: string;
  members: number;
  code: string;
  userIds?: string[];
};

export type TeamName = "nova" | "blaze";

export type Lobby = {
  id: string;
  assessmentId: string;
  batchId?: string;
  assessmentTitle: string;
  hostTeam: Team;
  guestTeam: Team;
  status: "waiting" | "request" | "ready";
  requestedAt?: number;
  updatedAt: number;
  firstRegisteredTeam?: TeamName;
  firstRegisteredTeamId?: string;
  firstRegisteredAt?: number;
};

export type Current = {
  lobbyId: string;
  teamId: string;
  userId?: string;
  assessmentId?: string;
  batchId?: string;
};

// Public keys are retained so existing player pages keep their current format.
export const KEY = "qc-player-lobbies-v1";
export const CURRENT = "qc-player-current-v1";
export const SIGNAL = "qc-player-signal-v1";
export const FIRST_TEAM = "qcFirstRegisteredTeam";
export const CURRENT_TEAM = "qcCurrentTeam";

const CHANNEL = "qc-player-lobby";
const EVENT = "qc-lobby-update";
const DB_NAME = "qc-player-lobbies-db";
const DB_STORE = "lobbies";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const firstTeamCache = new Map<string, TeamName>();

function canUseStorage() {
  return typeof window !== "undefined";
}

export function normalizeTeam(value: string | null | undefined): TeamName | null {
  const name = value?.trim().toLowerCase();
  if (name === "nova" || name === "team nova" || name === "qc-team-001") return "nova";
  if (name === "blaze" || name === "team blaze" || name === "qc-team-002") return "blaze";
  return null;
}

function isLobby(item: unknown): item is Lobby {
  if (!item || typeof item !== "object") return false;
  const lobby = item as Partial<Lobby>;
  return (
    typeof lobby.id === "string" &&
    typeof lobby.assessmentId === "string" &&
    !!lobby.hostTeam &&
    typeof lobby.hostTeam.id === "string" &&
    typeof lobby.hostTeam.name === "string" &&
    !!lobby.guestTeam &&
    typeof lobby.guestTeam.id === "string" &&
    typeof lobby.guestTeam.name === "string" &&
    (lobby.status === "waiting" || lobby.status === "request" || lobby.status === "ready")
  );
}

function rememberFirstTeam(lobby: Lobby) {
  const first = normalizeTeam(lobby.firstRegisteredTeam) ?? normalizeTeam(lobby.hostTeam.name);
  if (first) firstTeamCache.set(lobby.id, first);
}

// Legacy migration is non-destructive: remove the old localStorage array only
// AFTER every valid legacy record has been successfully written to IndexedDB.
async function migrateLegacyLobbies(db: IDBDatabase): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;
  const oldLobbies = parsed.filter(isLobby);
  if (oldLobbies.length === 0) {
    if (parsed.length === 0) {
      try { localStorage.removeItem(KEY); } catch { /* Keep existing data. */ }
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not migrate existing game lobbies."));
    transaction.onabort = () => reject(transaction.error || new Error("Could not migrate existing game lobbies."));
    for (const lobby of oldLobbies) {
      const request = store.get(lobby.id);
      request.onsuccess = () => {
        // An existing IndexedDB record is authoritative; never overwrite it
        // with an older legacy localStorage record.
        if (!request.result) store.put(lobby);
      };
    }
  });
  // This also frees space for the small flags used by other game screens.
  try { localStorage.removeItem(KEY); } catch { /* Migration has completed. */ }
}

function openLobbyDatabase(): Promise<IDBDatabase> {
  if (!canUseStorage() || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Browser IndexedDB storage is unavailable."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error || new Error("Could not open game lobby storage."));
    request.onblocked = () => reject(new Error("Game lobby storage is blocked by another browser tab."));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      migrateLegacyLobbies(db).then(() => resolve(db), reject);
    };
  }).catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export async function readLobbies(): Promise<Lobby[]> {
  const db = await openLobbyDatabase();
  return new Promise<Lobby[]>((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).getAll();
    request.onsuccess = () => {
      const lobbies: Lobby[] = (request.result as unknown[]).filter(isLobby);
      lobbies.forEach(rememberFirstTeam);
      resolve(lobbies);
    };
    request.onerror = () => reject(request.error || new Error("Could not load game lobbies."));
  });
}

export async function findLobby(id: string): Promise<Lobby | undefined> {
  if (!id) return undefined;
  const db = await openLobbyDatabase();
  return new Promise<Lobby | undefined>((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(id);
    request.onsuccess = () => {
      const lobby: Lobby | undefined = isLobby(request.result) ? request.result : undefined;
      if (lobby) rememberFirstTeam(lobby);
      resolve(lobby);
    };
    request.onerror = () => reject(request.error || new Error("Could not load the game lobby."));
  });
}

function safeWriteLocal(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* IndexedDB is authoritative. */ }
}

export async function writeLobby(lobby: Lobby): Promise<void> {
  if (!isLobby(lobby)) throw new Error("Invalid game lobby.");
  const db = await openLobbyDatabase();

  // Read and update inside ONE transaction to preserve the first registered
  // team if two tabs make changes at nearly the same time.
  const savedLobby = await new Promise<Lobby>((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);
    const request = store.get(lobby.id);
    let updatedLobby: Lobby | undefined;

    request.onsuccess = () => {
      const existing: Lobby | undefined = isLobby(request.result) ? request.result : undefined;
      const firstRegisteredTeam =
        normalizeTeam(existing?.firstRegisteredTeam) ??
        normalizeTeam(existing?.hostTeam.name) ??
        normalizeTeam(lobby.firstRegisteredTeam) ??
        normalizeTeam(lobby.hostTeam.name);
      const firstRegisteredTeamId =
        existing?.firstRegisteredTeamId || existing?.hostTeam.id ||
        lobby.firstRegisteredTeamId || lobby.hostTeam.id;
      const firstRegisteredAt = existing?.firstRegisteredAt ?? lobby.firstRegisteredAt ?? Date.now();
      updatedLobby = {
        ...lobby,
        hostTeam: existing?.hostTeam ?? lobby.hostTeam,
        firstRegisteredTeam: firstRegisteredTeam ?? undefined,
        firstRegisteredTeamId,
        firstRegisteredAt,
        updatedAt: Date.now(),
      };
      store.put(updatedLobby);
    };
    transaction.oncomplete = () => {
      if (updatedLobby) resolve(updatedLobby);
      else reject(new Error("Game lobby could not be saved."));
    };
    transaction.onerror = () => reject(transaction.error || new Error("Game lobby could not be saved."));
    transaction.onabort = () => reject(transaction.error || new Error("Game lobby could not be saved."));
  });

  rememberFirstTeam(savedLobby);
  const first = normalizeTeam(savedLobby.firstRegisteredTeam);
  if (first) {
    // These are compatibility flags only; they MUST NOT block the save.
    try { sessionStorage.setItem(FIRST_TEAM, first); } catch { /* Optional flag. */ }
    safeWriteLocal(FIRST_TEAM, first);
  }
  safeWriteLocal(SIGNAL, String(Date.now()));
  window.dispatchEvent(new Event(EVENT));
}

export function current(): Current | null {
  if (!canUseStorage()) return null;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(CURRENT) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Partial<Current>;
    if (typeof session.lobbyId !== "string" || !session.lobbyId ||
        typeof session.teamId !== "string" || !session.teamId) return null;
    return session as Current;
  } catch {
    return null;
  }
}

export function setCurrent(value: Current) {
  if (!canUseStorage()) return;
  sessionStorage.setItem(CURRENT, JSON.stringify(value));
  const team = normalizeTeam(value.teamId);
  if (team) {
    sessionStorage.setItem(CURRENT_TEAM, team);
    sessionStorage.setItem("qcJoinedTeam", team);
  }
  const first = firstTeamCache.get(value.lobbyId);
  if (first) {
    sessionStorage.setItem(FIRST_TEAM, first);
    safeWriteLocal(FIRST_TEAM, first);
  }
}

export function clearCurrent() {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(CURRENT);
  sessionStorage.removeItem(CURRENT_TEAM);
  sessionStorage.removeItem("qcJoinedTeam");
  sessionStorage.removeItem(FIRST_TEAM);
}

export function getFirstRegisteredTeam(lobbyId?: string): TeamName | null {
  if (!canUseStorage()) return null;
  const id = lobbyId ?? current()?.lobbyId;
  if (id) {
    const remembered = firstTeamCache.get(id);
    if (remembered) return remembered;
  }
  try {
    return normalizeTeam(sessionStorage.getItem(FIRST_TEAM)) ??
      normalizeTeam(localStorage.getItem(FIRST_TEAM));
  } catch {
    return null;
  }
}

export function getStartingTeam(): TeamName | null {
  return getFirstRegisteredTeam();
}

export function findPublished(code: string): { id: string; title: string } | null {
  if (!canUseStorage()) return null;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("quantumChamps:")) continue;
    try {
      const assessment = JSON.parse(localStorage.getItem(key) || "{}");
      const id = String(assessment.assessmentId || key.slice("quantumChamps:".length));
      const accessCode = String(assessment.assessmentCode || assessment.accessCode || id);
      const published = assessment.status === "published" ||
        assessment.isPublished === true || assessment.published === true;
      if (published && (accessCode.toLowerCase() === normalized || id.toLowerCase() === normalized)) {
        return {
          id,
          title: String(assessment.title || assessment.assessmentName || assessment.name || "Quantum Champs"),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function subscribe(callback: () => void) {
  if (!canUseStorage()) return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === SIGNAL || event.key === null) callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT, callback);
  const channel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL)
    : null;
  if (channel) channel.onmessage = () => callback();
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT, callback);
    channel?.close();
  };
}

export async function publish(lobby: Lobby): Promise<void> {
  await writeLobby(lobby);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: "lobby-updated", lobbyId: lobby.id, status: lobby.status });
    channel.close();
  }
}
