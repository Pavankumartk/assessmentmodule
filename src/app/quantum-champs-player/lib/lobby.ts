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

export const KEY = "qc-player-lobbies-v1";
export const CURRENT = "qc-player-current-v1";
export const SIGNAL = "qc-player-signal-v1";
export const FIRST_TEAM = "qcFirstRegisteredTeam";
export const CURRENT_TEAM = "qcCurrentTeam";

const CHANNEL = "qc-player-lobby";
const EVENT = "qc-lobby-update";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function normalizeTeam(value: string | null | undefined): TeamName | null {
  const name = value?.trim().toLowerCase();
  if (name === "nova" || name === "team nova" || name === "qc-team-001") return "nova";
  if (name === "blaze" || name === "team blaze" || name === "qc-team-002") return "blaze";
  return null;
}

export function readLobbies(): Lobby[] {
  if (!canUseStorage()) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Lobby => {
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
    });
  } catch {
    return [];
  }
}

export function findLobby(id: string): Lobby | undefined {
  if (!id) return undefined;
  return readLobbies().find(lobby => lobby.id === id);
}

export function writeLobby(lobby: Lobby) {
  if (!canUseStorage()) return;

  const existing = findLobby(lobby.id);
  // Registration order belongs to the original host and cannot be replaced
  // by an update from the second team.
  const firstRegisteredTeam =
    normalizeTeam(existing?.firstRegisteredTeam) ??
    normalizeTeam(existing?.hostTeam.name) ??
    normalizeTeam(lobby.firstRegisteredTeam) ??
    normalizeTeam(lobby.hostTeam.name);

  const firstRegisteredTeamId =
    existing?.firstRegisteredTeamId || existing?.hostTeam.id ||
    lobby.firstRegisteredTeamId || lobby.hostTeam.id;

  const firstRegisteredAt =
    existing?.firstRegisteredAt ?? lobby.firstRegisteredAt ?? Date.now();

  const updatedLobby: Lobby = {
    ...lobby,
    // Do not allow a guest update to replace the original host.
    hostTeam: existing?.hostTeam ?? lobby.hostTeam,
    firstRegisteredTeam: firstRegisteredTeam ?? undefined,
    firstRegisteredTeamId,
    firstRegisteredAt,
    updatedAt: Date.now(),
  };

  const all = readLobbies().filter(item => item.id !== lobby.id);
  localStorage.setItem(KEY, JSON.stringify([...all, updatedLobby]));

  // Keep this shared key for existing game-instructions/question pages.
  if (firstRegisteredTeam) {
    localStorage.setItem(FIRST_TEAM, firstRegisteredTeam);
  }

  localStorage.setItem(SIGNAL, String(Date.now()));
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

  // Team identity is per tab, never a shared localStorage value.
  const team = normalizeTeam(value.teamId);
  if (team) {
    sessionStorage.setItem(CURRENT_TEAM, team);
    sessionStorage.setItem("qcJoinedTeam", team);
  }

  const lobby = findLobby(value.lobbyId);
  const firstTeam = lobby
    ? normalizeTeam(lobby.firstRegisteredTeam) ?? normalizeTeam(lobby.hostTeam.name)
    : null;
  if (firstTeam) localStorage.setItem(FIRST_TEAM, firstTeam);
}

export function clearCurrent() {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(CURRENT);
  sessionStorage.removeItem(CURRENT_TEAM);
  sessionStorage.removeItem("qcJoinedTeam");
}

export function getFirstRegisteredTeam(lobbyId?: string): TeamName | null {
  if (!canUseStorage()) return null;
  const id = lobbyId ?? current()?.lobbyId;
  if (id) {
    const lobby = findLobby(id);
    if (lobby) {
      return normalizeTeam(lobby.firstRegisteredTeam) ??
        normalizeTeam(lobby.firstRegisteredTeamId) ??
        normalizeTeam(lobby.hostTeam.name);
    }
  }
  return normalizeTeam(localStorage.getItem(FIRST_TEAM));
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

export function publish(lobby: Lobby) {
  if (!canUseStorage()) return;
  writeLobby(lobby);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: "lobby-updated", lobbyId: lobby.id, status: lobby.status });
    channel.close();
  }
}
