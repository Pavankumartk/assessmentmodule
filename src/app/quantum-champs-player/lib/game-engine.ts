
import {
  getQuestionByIndex,
  getQuestionCount,
  getQuestionRoute,
  getQuestionsByTeam,
  isCorrectAnswer,
} from "../data/questions";

import type {
  GameMode,
  QuantumQuestion,
  Team,
} from "../data/questions";

/* --------------------------------------------------
   TYPES
-------------------------------------------------- */

export type LifelineType = "blitz" | "boost" | "split";

export type TeamProgress = {
  index: number;
  xp: number;
  answers: Record<string, string>;
};

export type GameResult = {
  novaXP: number;
  blazeXP: number;
  winner: Team | "tie";
};

export type GameState = {
  mode: GameMode;
  currentTeam: Team;
  firstTeam: Team;
  currentRound: 1 | 2;
  currentQuestion: QuantumQuestion | null;
  nova: TeamProgress;
  blaze: TeamProgress;
  isRoundComplete: boolean;
  isGameComplete: boolean;
};

export type SubmitResult = {
  correct: boolean;
  earnedXP: number;
  totalXP: number;
  alreadyAnswered: boolean;
};

/* --------------------------------------------------
   STORAGE KEYS
-------------------------------------------------- */

const STORAGE = {
  mode: "qcGameMode",
  currentTeam: "qcCurrentTeam",
  currentIndex: "qcCurrentQuestionIndex",
  firstTeam: "qcFirstRegisteredTeam",
  round2Started: "qcRound2Started",
  novaProgress: "qcNovaProgress",
  blazeProgress: "qcBlazeProgress",
  novaXP: "qcNovaXP",
  blazeXP: "qcBlazeXP",
};

/* --------------------------------------------------
   STORAGE HELPERS
-------------------------------------------------- */

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function getStored(key: string): string | null {
  if (!canUseStorage()) return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStored(key: string, value: string): void {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable.
  }
}

function removeStored(key: string): void {
  if (!canUseStorage()) return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable.
  }
}

function isTeam(value: string | null): value is Team {
  return value === "nova" || value === "blaze";
}

function createProgress(index = 0): TeamProgress {
  return {
    index,
    xp: 0,
    answers: {},
  };
}

/* --------------------------------------------------
   SAME-BROWSER MULTIPLAYER
   Shared match data: localStorage.
   Per-tab player identity: sessionStorage.
-------------------------------------------------- */

export type PlayerIdentity = {
  assessmentId: string;
  userId: string;
  team: Team;
};

const PLAYER_KEY = "qcPlayerIdentity";
const SESSION_KEY = "qcMatchAssessmentId";
const CHANGE_KEY = "qcMatchChange";

export function setPlayerIdentity(identity: PlayerIdentity): void {
  if (!canUseStorage()) return;
  const assessmentId = identity.assessmentId.trim();
  const userId = identity.userId.trim();
  if (!assessmentId || !userId || !isTeam(identity.team)) return;
  try {
    sessionStorage.setItem(PLAYER_KEY, JSON.stringify({ assessmentId, userId, team: identity.team }));
  } catch {
    // Storage may be unavailable.
  }
}

export function getPlayerIdentity(): PlayerIdentity | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.assessmentId !== "string" || !value.assessmentId.trim() ||
        typeof value.userId !== "string" || !value.userId.trim() || !isTeam(value.team)) return null;
    return { assessmentId: value.assessmentId, userId: value.userId, team: value.team };
  } catch {
    return null;
  }
}

export function setMatchAssessmentId(assessmentId: string): void {
  if (!assessmentId.trim()) return;
  setStored(SESSION_KEY, assessmentId.trim());
  notifyGameChange();
}

export function getMatchAssessmentId(): string | null {
  return getStored(SESSION_KEY);
}

export function canPlayerAnswer(team: Team = getCurrentTeam()): boolean {
  const player = getPlayerIdentity();
  const matchAssessmentId = getMatchAssessmentId();
  return !!player && !!matchAssessmentId && player.assessmentId === matchAssessmentId &&
    player.team === team && getCurrentTeam() === team && !isGameComplete();
}

// Subscribe from React useEffect. Also updates the tab that made the change.
export function subscribeToGameChanges(onChange: () => void): () => void {
  if (!canUseStorage()) return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && event.key?.startsWith("qc")) onChange();
  };
  const onLocal = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener("qc-game-change", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("qc-game-change", onLocal);
  };
}

function notifyGameChange(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(CHANGE_KEY, String(Date.now()) + ":" + Math.random());
    window.dispatchEvent(new Event("qc-game-change"));
  } catch {
    // Storage may be unavailable.
  }
}

/* --------------------------------------------------
   GAME MODE
-------------------------------------------------- */

export function getGameMode(): GameMode {
  return getStored(STORAGE.mode) === "quick"
    ? "quick"
    : "full";
}

export function setGameMode(mode: GameMode): void {
  setStored(STORAGE.mode, mode);
}

/* --------------------------------------------------
   TEAM HELPERS
-------------------------------------------------- */

export function getOppositeTeam(team: Team): Team {
  return team === "nova" ? "blaze" : "nova";
}

export function getFirstTeam(): Team {
  const first = getStored(STORAGE.firstTeam);

  return isTeam(first) ? first : "nova";
}

export function getCurrentTeam(): Team {
  const current = getStored(STORAGE.currentTeam);

  return isTeam(current) ? current : getFirstTeam();
}

export function setCurrentTeam(team: Team): void {
  setStored(STORAGE.currentTeam, team);
  notifyGameChange();
}

export function getTeamName(team: Team): string {
  return team === "nova" ? "Nova" : "Blaze";
}

/* --------------------------------------------------
   PROGRESS
-------------------------------------------------- */

function progressKey(team: Team): string {
  return team === "nova"
    ? STORAGE.novaProgress
    : STORAGE.blazeProgress;
}

function xpKey(team: Team): string {
  return team === "nova"
    ? STORAGE.novaXP
    : STORAGE.blazeXP;
}

export function getTeamProgress(team: Team): TeamProgress {
  const raw = getStored(progressKey(team));

  if (!raw) {
    return createProgress();
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      index:
        Number.isInteger(parsed?.index) &&
        parsed.index >= 0
          ? parsed.index
          : 0,
      xp:
        Number.isFinite(parsed?.xp) &&
        parsed.xp >= 0
          ? parsed.xp
          : 0,
      answers:
        parsed?.answers &&
        typeof parsed.answers === "object" &&
        !Array.isArray(parsed.answers)
          ? parsed.answers
          : {},
    };
  } catch {
    return createProgress();
  }
}

export function saveTeamProgress(
  team: Team,
  progress: TeamProgress
): void {
  setStored(progressKey(team), JSON.stringify(progress));
  setStored(xpKey(team), String(progress.xp));
  notifyGameChange();
}

export function getTeamXP(team: Team): number {
  return getTeamProgress(team).xp;
}

/* --------------------------------------------------
   QUESTION HELPERS
-------------------------------------------------- */

export function getCurrentQuestion(
  team: Team = getCurrentTeam()
): QuantumQuestion | null {
  const mode = getGameMode();
  const progress = getTeamProgress(team);

  return getQuestionByIndex(team, progress.index, mode);
}

export function getQuestionForTeam(
  team: Team,
  index: number
): QuantumQuestion | null {
  return getQuestionByIndex(team, index, getGameMode());
}

export function getTeamQuestions(
  team: Team
): QuantumQuestion[] {
  return getQuestionsByTeam(team, getGameMode());
}

export function getTotalQuestions(team: Team): number {
  return getQuestionCount(team, getGameMode());
}

export function getCurrentQuestionRoute(
  team: Team = getCurrentTeam()
): string {
  const question = getCurrentQuestion(team);

  if (!question) {
    return "/quantum-champs-player/winner-slide";
  }

  return getQuestionRoute(question);
}

/* --------------------------------------------------
   LIFELINES
-------------------------------------------------- */

export function getLifelineKey(
  team: Team,
  type: LifelineType
): string {
  return `qcLifelineUsed:${team}:${type}`;
}

export function isLifelineUsed(
  team: Team,
  type: LifelineType
): boolean {
  const value = getStored(getLifelineKey(team, type));
  return value === "true" || value === "1";
}

export function useLifeline(
  team: Team,
  type: LifelineType
): boolean {
  if (getPlayerIdentity() && !canPlayerAnswer(team)) return false;
  if (isLifelineUsed(team, type)) {
    return false;
  }

  setStored(getLifelineKey(team, type), "true");
  notifyGameChange();
  return true;
}

export function resetLifelines(): void {
  if (!canUseStorage()) return;

  const teams: Team[] = ["nova", "blaze"];
  const types: LifelineType[] = ["blitz", "boost", "split"];

  // Unlock all three lifelines for both teams only when a new game starts.
  teams.forEach((team) => {
    types.forEach((type) => {
      removeStored(getLifelineKey(team, type));
    });
  });

  // Clear old 50:50 eliminations and temporary lifeline state as well.
  const prefixes = [
    "qcLifelineUsed:",
    "qcLifelineDeadline:",
    "qcLifelineHidden:",
    "qcSplitOptions:",
  ];

  for (const storage of [localStorage, sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          keys.push(key);
        }
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Browser storage may be unavailable.
    }
  }
}

/* --------------------------------------------------
   ANSWER SUBMISSION
-------------------------------------------------- */

export function submitAnswer(
  team: Team,
  questionId: string,
  answer: string | string[],
  xpMultiplier = 1
): SubmitResult {
  const progress = getTeamProgress(team);
  const question = getCurrentQuestion(team);

  if (getPlayerIdentity() && !canPlayerAnswer(team)) {
    return { correct: false, earnedXP: 0, totalXP: progress.xp, alreadyAnswered: true };
  }

  if (getCurrentTeam() !== team || !question || question.id !== questionId) {
    return {
      correct: false,
      earnedXP: 0,
      totalXP: progress.xp,
      alreadyAnswered: false,
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(
      progress.answers,
      questionId
    )
  ) {
    return {
      correct: false,
      earnedXP: 0,
      totalXP: progress.xp,
      alreadyAnswered: true,
    };
  }

  const correct = isCorrectAnswer(question, answer);

  const earnedXP = correct
    ? Math.max(0, Math.round(question.xp * xpMultiplier))
    : 0;

  const updated: TeamProgress = {
    ...progress,
    xp: progress.xp + earnedXP,
    answers: {
      ...progress.answers,
      [questionId]: JSON.stringify({
        answer,
        correct,
        earnedXP,
      }),
    },
  };

  saveTeamProgress(team, updated);

  return {
    correct,
    earnedXP,
    totalXP: updated.xp,
    alreadyAnswered: false,
  };
}

/* --------------------------------------------------
   ROUND HELPERS
-------------------------------------------------- */

export function getCurrentRound(): 1 | 2 {
  if (getGameMode() === "quick") {
    return 2;
  }

  return getStored(STORAGE.round2Started) === "true"
    ? 2
    : 1;
}

export function isRoundOneComplete(): boolean {
  if (getGameMode() === "quick") {
    return false;
  }

  return (
    getTeamProgress("nova").index >= 3 &&
    getTeamProgress("blaze").index >= 3
  );
}

export function isRoundTwoComplete(): boolean {
  const mode = getGameMode();
  const target = mode === "full" ? 6 : 3;

  return (
    getTeamProgress("nova").index >= target &&
    getTeamProgress("blaze").index >= target
  );
}

export function isGameComplete(): boolean {
  return isRoundTwoComplete();
}

/* --------------------------------------------------
   NEXT QUESTION / TEAM SWITCHING
-------------------------------------------------- */

export function advanceToNextQuestion(team: Team): string {
  if (getPlayerIdentity() && !canPlayerAnswer(team)) return getCurrentQuestionRoute(getCurrentTeam());
  const mode = getGameMode();
  if (getCurrentTeam() !== team) {
    return getCurrentQuestionRoute(getCurrentTeam());
  }
  const progress = getTeamProgress(team);
  const question = getQuestionByIndex(team, progress.index, mode);

  // Do not skip or award a question that has not been submitted.
  if (question && !Object.prototype.hasOwnProperty.call(progress.answers, question.id)) {
    return getQuestionRoute(question);
  }

  // Submission records the answer and XP; advancement changes only the index.
  if (question) {
    saveTeamProgress(team, { ...progress, index: progress.index + 1 });
  }

  if (isGameComplete()) {
    return "/quantum-champs-player/winner-slide";
  }

  // Full Quest: wait until BOTH teams complete Round 1 before Round 2.
  // Never clear either team's XP or answer history at this boundary.
  if (mode === "full" && getStored(STORAGE.round2Started) !== "true") {
    if (isRoundOneComplete()) {
      // Continue straight into Round 2 without an intermediate start screen.
      return startRoundTwo();
    }

    const other = getOppositeTeam(team);
    const otherProgress = getTeamProgress(other);
    if (otherProgress.index < 3) {
      setCurrentTeam(other);
      setStored(STORAGE.currentIndex, String(otherProgress.index));
      return getCurrentQuestionRoute(other);
    }
    // This team still has Round 1 questions, even if the other has finished.
    const ownProgress = getTeamProgress(team);
    if (ownProgress.index < 3) {
      setCurrentTeam(team);
      setStored(STORAGE.currentIndex, String(ownProgress.index));
      return getCurrentQuestionRoute(team);
    }
  }

  const other = getOppositeTeam(team);
  const nextTeam = getCurrentQuestion(other) ? other : team;
  setCurrentTeam(nextTeam);
  setStored(STORAGE.currentIndex, String(getTeamProgress(nextTeam).index));
  return getCurrentQuestionRoute(nextTeam);
}

/* --------------------------------------------------
   START ROUND 2
-------------------------------------------------- */

export function startRoundTwo(): string {
  const mode = getGameMode();
  const firstTeam = getFirstTeam();

  // Opening an existing round must never reset XP or question indexes.
  if (getStored(STORAGE.round2Started) === "true") {
    return getCurrentQuestionRoute(getCurrentTeam());
  }

  if (mode === "full") {
    // Round 1 must be complete for BOTH teams. Keep all XP and answers.
    if (!isRoundOneComplete()) {
      return "/quantum-champs-player/game-instructions";
    }
    for (const team of ["nova", "blaze"] as Team[]) {
      const progress = getTeamProgress(team);
      saveTeamProgress(team, { ...progress, index: Math.max(3, progress.index) });
    }
  } else {
    // A fresh Quick Quest is reset by startNewGame("quick").
    // Do not reset here: returning to this screen must preserve progress.
  }

  setStored(STORAGE.round2Started, "true");
  setCurrentTeam(firstTeam);
  setStored(STORAGE.currentIndex, String(getTeamProgress(firstTeam).index));
  return getCurrentQuestionRoute(firstTeam);
}

/* --------------------------------------------------
   START NEW GAME
-------------------------------------------------- */

export function startNewGame(
  mode: GameMode,
  firstTeam: Team = getFirstTeam()
): string {
  setGameMode(mode);

  setStored(STORAGE.firstTeam, firstTeam);
  setCurrentTeam(firstTeam);

  saveTeamProgress("nova", createProgress());
  saveTeamProgress("blaze", createProgress());

  resetLifelines();

  setStored(STORAGE.currentIndex, "0");
  setStored(STORAGE.round2Started, "false");
  const player = getPlayerIdentity();
  if (player) setStored(SESSION_KEY, player.assessmentId);
  notifyGameChange();

  // IMPORTANT: The Quick Quest selection button must call startNewGame("quick")
  // for every NEW match. Navigating directly to round-2-start will resume
  // the previously completed game instead.
  if (mode === "quick") {
    return "/quantum-champs-player/round-2-start";
  }

  return "/quantum-champs-player/game-instructions";
}

/* --------------------------------------------------
   GAME RESULT
-------------------------------------------------- */

export function getGameResult(): GameResult {
  const novaXP = getTeamXP("nova");
  const blazeXP = getTeamXP("blaze");

  let winner: Team | "tie" = "tie";

  if (novaXP > blazeXP) {
    winner = "nova";
  } else if (blazeXP > novaXP) {
    winner = "blaze";
  }

  return {
    novaXP,
    blazeXP,
    winner,
  };
}

/* --------------------------------------------------
   COMPLETE GAME STATE
-------------------------------------------------- */

export function getGameState(): GameState {
  const mode = getGameMode();
  const currentTeam = getCurrentTeam();

  return {
    mode,
    currentTeam,
    firstTeam: getFirstTeam(),
    currentRound: getCurrentRound(),
    currentQuestion: getCurrentQuestion(currentTeam),
    nova: getTeamProgress("nova"),
    blaze: getTeamProgress("blaze"),
    isRoundComplete:
      getCurrentRound() === 1
        ? isRoundOneComplete()
        : isRoundTwoComplete(),
    isGameComplete: isGameComplete(),
  };
}
