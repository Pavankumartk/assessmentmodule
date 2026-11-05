"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import TextSubmitSuccess from "@/modules/assessments/components/viewer/TextSubmitSuccess";
import type { ReleasePolicy } from "@/modules/assessments/components/viewer/result-release";
import { demoDashboardPath } from "@/modules/assessments/auth/demo-auth";
import { assessmentStorage, getActiveAssessmentId, getAssessment, resultPath, updateAssessment, viewerPath } from "@/modules/assessments/storage/assessment-storage";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";
import "./viewer.css";

/** Source fields follow Memory Game Creator's existing pair structure (Preview.tsx). */
export type MemoryPair = { left: string; right: string; leftImage?: string; rightImage?: string };
export type MemoryQuestion = {
  id?: string; text: string; pairs: MemoryPair[]; points?: number; bloom?: string;
  hint?: string; explanation?: string; feedbackFull?: string; feedbackZero?: string;
  columns?: string | number; shuffle?: boolean; showCardsSeconds?: number | string;
  flipBackDelay?: number | string; timeLimit?: number | string;
  showMoveCounter?: boolean; showTimer?: boolean; maximumMoves?: number | string;
  grading?: string;
};
export type MemoryViewerProps = {
  /** Optional: pass Creator questions directly if its draft uses a different key. */
  questions?: MemoryQuestion[];
  assessmentTitle?: string;
  /** Keep this identical to the key in your installed Memory Game Content.tsx. */
  contentDraftKey?: string;
};

type Card = { id: string; pair: number; side: "left" | "right"; text: string; image: string };
type Status = "correct" | "incorrect";
type Attempt = { cards: Card[]; started: boolean; opened: number[]; matched: number[]; moves: number; locked: boolean; result: Status | null; selectedPairs: Array<[Card, Card]> };
const A = "/assets/assessmenticons/";
const V = "/assets/viewericons/";
const EMPTY_ATTEMPT: Attempt = { cards: [], started: false, opened: [], matched: [], moves: 0, locked: false, result: null, selectedPairs: [] };
const DEFAULT_TITLE = "Introduction to Artificial Intelligence";
const DEFAULT_INSTRUCTIONS = [
  "Find the matching pairs by flipping two cards at a time.",
  "Each correctly matched pair contributes to your score according to the grading method.",
  "The timer starts when you begin the assessment.",
  "Use Restart to replay the current Memory Game question.",
  "You can flag questions for later review.",
  "Submit the assessment when you have finished all questions.",
];

const icon = (name: string, size = 20) => <img src={`${A}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
const formatSeconds = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(Math.max(0, n)).padStart(2, "0"));
const toNumber = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) >= 0 && value !== "" && value != null ? Number(value) : fallback;
function readJson(key: string): Record<string, unknown> {
  try { const raw = assessmentStorage.getItem(key); const data: unknown = JSON.parse(raw || "{}"); return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {}; }
  catch { return {}; }
}
/** Evaluation policy scoped to Memory Game, never One-Word/Short Answer settings. */
function memoryRelease(): ReleasePolicy {
  const data = readJson("memoryGameEvaluationDraft");
  const nested = data.dropdownSettings && typeof data.dropdownSettings === "object" ? data.dropdownSettings as Record<string, unknown> : {};
  const pick = (...keys: string[]): unknown => { for (const key of keys) { const v = nested[key] ?? data[key]; if (v !== undefined && v !== null && v !== "") return v; } return undefined; };
  const choice = String(pick("resultAvailable", "reviewAvailability", "resultAvailability") || "Immediately").toLowerCase();
  const mode = /never|not available/.test(choice) ? "never" : /schedul|after clos|later/.test(choice) ? "scheduled" : /manual|after grad|instructor/.test(choice) ? "manual" : "immediate";
  const rawDate = String(pick("resultReleaseDate", "scheduledReleaseDate", "releaseDate", "scheduledReleaseAt") || "");
  const parsed = new Date(rawDate);
  const releaseDateLabel = rawDate && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : rawDate || "Release date to be announced";
  const showScore = mode === "immediate" && pick("showScore") !== false;
  const showPassFail = mode === "immediate" && pick("showPassFail") !== false;
  const showCorrectAnswers = mode === "immediate" && pick("showCorrectAnswers") !== false;
  const showExplanation = showCorrectAnswers && pick("showExplanation") !== false;
  return { mode, releaseDateLabel, showScore, showPassFail, showCorrectAnswers, showExplanation,
    message: mode === "scheduled" ? "Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time." : mode === "manual" ? "Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result." : mode === "never" ? "Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing." : "Your assessment has been submitted. Your result is available now." };
}
function isPair(value: unknown): value is MemoryPair {
  return Boolean(value && typeof value === "object" && ("left" in value || "leftImage" in value) && ("right" in value || "rightImage" in value));
}
function normalizeQuestion(value: unknown): MemoryQuestion | null {
  if (!value || typeof value !== "object") return null;
  const q = value as Record<string, unknown>;
  const pairs = Array.isArray(q.pairs) ? q.pairs.filter(isPair).map(p => ({ left: String(p.left || ""), right: String(p.right || ""), leftImage: typeof p.leftImage === "string" ? p.leftImage : "", rightImage: typeof p.rightImage === "string" ? p.rightImage : "" })) : [];
  if (!pairs.length) return null;
  return { ...q, id: String(q.id || ""), text: String(q.text || ""), pairs, points: toNumber(q.points, 1), bloom: String(q.bloom || ""), hint: String(q.hint || ""), explanation: String(q.explanation || ""), feedbackFull: String(q.feedbackFull || ""), feedbackZero: String(q.feedbackZero || ""), columns: typeof q.columns === "string" || typeof q.columns === "number" ? q.columns : "Auto", shuffle: q.shuffle !== false, showCardsSeconds: toNumber(q.showCardsSeconds, 0), flipBackDelay: toNumber(q.flipBackDelay, 1000), timeLimit: toNumber(q.timeLimit, 0), showMoveCounter: q.showMoveCounter !== false, showTimer: q.showTimer !== false, maximumMoves: toNumber(q.maximumMoves, 0), grading: String(q.grading || "Equal Marks") } as MemoryQuestion;
}
function makeCards(q: MemoryQuestion): Card[] {
  const cards = q.pairs.flatMap((pair, i): Card[] => [
    { id: `${i}-left`, pair: i, side: "left", text: pair.left, image: pair.leftImage || "" },
    { id: `${i}-right`, pair: i, side: "right", text: pair.right, image: pair.rightImage || "" }
  ]);
  if (!q.shuffle) return cards;
  // A fixed shuffled order per game start; React does not reshuffle on every render.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
function Clock({ seconds }: { seconds: number }) {
  const parts = formatSeconds(seconds);
  return <div className="mgvClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, i) => <span key={i} className="mgvClockGroup">{i > 0 && <b className="mgvColon">:</b>}{part.split("").map((digit, j) => <span className="mgvDigit" key={j}>{digit}</span>)}</span>)}
  </div>;
}
function Face({ card }: { card: Card }) {
  return card.image ? <img className="mgvFacePicture" src={card.image} alt={card.text || "Memory card"} /> : <span className="mgvFaceText">{card.text || "Image not added"}</span>;
}
function AnswerRow({ left, right, index }: { left: Card; right: Card; index: number }) {
  return <div className="mgvAnswerRow"><span>{index + 1}. {left.text || "Picture"}</span><span className="mgvAnswerImage">{right.image ? <img src={right.image} alt={right.text || "Pair image"} /> : <span>{right.text || "—"}</span>}</span></div>;
}

function InstructionSummaryItem({ label, value, iconName, variant }: {
  label: string;
  value: string;
  iconName: string;
  variant: "blue" | "orange" | "purple" | "green" | "red";
}) {
  return <div className={`viewerStat viewerStat--${variant}`}>
    <span className="viewerStatIcon"><img src={`${V}${iconName}`} width={24} height={24} alt="" aria-hidden="true" /></span>
    <div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div>
  </div>;
}

function draftText(draft: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = draft[key];
    if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) return String(value).trim();
  }
  return fallback;
}

function readInstructions(draft: Record<string, unknown>): string[] {
  const lines = creatorInstructionLines(draft.instructions, draft.descriptionInstructions);
  return lines.length ? lines : DEFAULT_INSTRUCTIONS;
}

export default function MemoryGameViewer({ questions: incoming, assessmentTitle, contentDraftKey = "memoryGameContentDraft" }: MemoryViewerProps) {
  const router = useRouter();
  const isRetry = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("retry") === "wrong";
  const progressKey = isRetry ? "memoryGameViewerAttemptDraftRetry" : "memoryGameViewerAttemptDraft";
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<MemoryQuestion[]>([]);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [detailsDraft, setDetailsDraft] = useState<Record<string, unknown>>({});
  const [instructionLines, setInstructionLines] = useState<string[]>(DEFAULT_INSTRUCTIONS);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [acceptedInstructions, setAcceptedInstructions] = useState(false);
  const [current, setCurrent] = useState(0);
  const [games, setGames] = useState<Record<number, Attempt>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [release, setRelease] = useState<ReleasePolicy | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [duration, setDuration] = useState(3600);
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [expiresAt, setExpiresAt] = useState(0);
  const [peek, setPeek] = useState(false);
  const timeouts = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [scratchNote, setScratchNote] = useState("");

  const question = questions[current];
  const game = games[current] || EMPTY_ATTEMPT;
  const total = questions.length;
  const checkedCount = Object.values(games).filter(g => g.result !== null).length;
  const correctCount = Object.values(games).filter(g => g.result === "correct").length;
  const totalPoints = questions.reduce((sum, q) => sum + toNumber(q.points, 1), 0);
  const earnedPoints = questions.reduce((sum, q, i) => {
    const g = games[i];
    if (!g?.result) return sum;
    const points = toNumber(q.points, 1);
    if (g.result === "correct") return sum + points;
    const method = String(q.grading || "").toLowerCase();
    const partial = /equal|partial|per pair/.test(method);
    const matchedPairs = g.matched.length / 2;
    const negative = toNumber((q as MemoryQuestion & { negativeMarking?: string | number }).negativeMarking, 0);
    return sum + (partial ? points * matchedPairs / Math.max(q.pairs.length, 1) : 0) - negative;
  }, 0);
  const isPreview = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "true";
  const updateGame = useCallback((index: number, update: (previous: Attempt) => Attempt) => {
    setGames(before => ({ ...before, [index]: update(before[index] || EMPTY_ATTEMPT) }));
  }, []);
  const clearTimers = useCallback(() => { timeouts.current.forEach(clearTimeout); timeouts.current = []; }, []);

  useEffect(() => {
    const draft = readJson(contentDraftKey);
    const saved = Array.isArray(draft.questions) ? draft.questions.map(normalizeQuestion).filter((q): q is MemoryQuestion => q !== null) : [];
    let chosen = incoming ? incoming.map(normalizeQuestion).filter((q): q is MemoryQuestion => q !== null) : saved;
    if (isRetry) {
      let indexes: number[] = [];
      try { const raw: unknown = JSON.parse(assessmentStorage.getItem("memoryGameRetryIndexes") || "[]"); if (Array.isArray(raw)) indexes = raw.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0); } catch { /* No retry selection */ }
      chosen = chosen.filter((_, index) => indexes.includes(index));
    }
    const details = readJson("memoryGameAssessmentDraft");
    setDetailsDraft(details);
    setInstructionLines(readInstructions(details));
    const assessment = getAssessment(getActiveAssessmentId() || "");
    const name = assessmentTitle || String(details.assessmentTitle || details.title || assessment?.title || DEFAULT_TITLE);
    const rawDuration = String(details.duration ?? details.timeLimit ?? (chosen[0]?.timeLimit && Number(chosen[0].timeLimit) > 0 ? chosen[0].timeLimit : "60"));
    const minutes = Math.max(1, toNumber(Number.parseFloat(rawDuration), 60) * (/hour/i.test(rawDuration) ? 60 : 1));
    const retryMinutes = Number(assessmentStorage.getItem("viewerRetryDurationMinutes"));
    const actualSeconds = isRetry && Number.isFinite(retryMinutes) && retryMinutes > 0 ? Math.floor(retryMinutes * 60) : Math.floor(minutes * 60);
    setDuration(actualSeconds);
    setSecondsLeft(actualSeconds);
    setTitle(name);
    setQuestions(chosen);
    try {
      const savedProgress = assessmentStorage.getItem(progressKey);
      if (savedProgress && !isPreview) {
        const data = JSON.parse(savedProgress) as { games?: Record<number, Attempt>; current?: number; flagged?: number[]; secondsLeft?: number; expiresAt?: number; scratchNote?: string; assessmentStarted?: boolean };
        if (data.games && typeof data.games === "object") setGames(data.games);
        const gameWasStarted = Object.values(data.games || {}).some(attempt => Boolean(attempt?.started));
        setAssessmentStarted(Boolean(data.assessmentStarted || gameWasStarted));
        if (typeof data.current === "number") setCurrent(Math.min(Math.max(0, data.current), Math.max(0, chosen.length - 1)));
        if (Array.isArray(data.flagged)) setFlagged(data.flagged);
        if (typeof data.expiresAt === "number" && data.expiresAt > 0) { setExpiresAt(data.expiresAt); setSecondsLeft(Math.max(0,Math.ceil((data.expiresAt-Date.now())/1000))); }
        else if (typeof data.secondsLeft === "number") setSecondsLeft(Math.max(0, data.secondsLeft));
        if (typeof data.scratchNote === "string") setScratchNote(data.scratchNote);
      }
    } catch { /* A malformed draft must not prevent a new attempt. */ }
    setReady(true);
  }, [assessmentTitle, contentDraftKey, incoming, isPreview]);

  useEffect(() => { return () => clearTimers(); }, [clearTimers]);
  useEffect(() => {
    if (!ready || submitted || isPreview) return;
    try {
      assessmentStorage.setItem(progressKey, JSON.stringify({
        current, games, flagged, secondsLeft, expiresAt, scratchNote, assessmentStarted,
      }));
    } catch { /* Storage may be disabled. */ }
  }, [ready, submitted, isPreview, current, games, flagged, secondsLeft, expiresAt, scratchNote, assessmentStarted]);

  // The Figma timer starts from Start Assessment, not from the separate card-game Start button.
  useEffect(() => {
    if (!ready || submitted || !assessmentStarted) return;
    if (!expiresAt) {setExpiresAt(Date.now()+secondsLeft*1000);return;}
    const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((expiresAt-Date.now())/1000)));tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ready, submitted, assessmentStarted, expiresAt]);
  useEffect(() => {
    if (ready && secondsLeft === 0 && assessmentStarted && !submitted) setSubmitOpen(true);
  }, [ready, secondsLeft, assessmentStarted, submitted]);

  const start = () => {
    if (!question) return;
    clearTimers();
    const index = current;
    const cards = makeCards(question);
    updateGame(index, () => ({ ...EMPTY_ATTEMPT, cards, started: true }));
    setPeek(toNumber(question.showCardsSeconds, 0) > 0);
    const ms = Math.min(toNumber(question.showCardsSeconds, 0) * 1000, 30000);
    if (ms > 0) timeouts.current.push(setTimeout(() => setPeek(false), ms));
  };
  const restart = () => { clearTimers(); setPeek(false); start(); setHintVisible(false); };
  const flip = (index: number) => {
    const currentGame = games[current];
    if (!currentGame?.started || currentGame.result || currentGame.locked || peek || currentGame.opened.includes(index) || currentGame.matched.includes(index)) return;
    if (currentGame.opened.length === 0) {
      updateGame(current, prev => ({ ...prev, opened: [index] }));
      return;
    }
    if (currentGame.opened.length !== 1) return;
    const first = currentGame.opened[0];
    const a = currentGame.cards[first], b = currentGame.cards[index];
    if (!a || !b) return;
    const matching = a.pair === b.pair && a.side !== b.side;
    const roundQuestion = current;
    updateGame(roundQuestion, prev => ({ ...prev, opened: [first, index], moves: prev.moves + 1, locked: true, selectedPairs: [...prev.selectedPairs, [a, b]], matched: matching ? [...prev.matched, first, index] : prev.matched }));
    const delay = matching ? 420 : Math.max(300, Math.min(toNumber(question?.flipBackDelay, 1000), 10000));
    timeouts.current.push(setTimeout(() => updateGame(roundQuestion, prev => ({ ...prev, opened: [], locked: false })), delay));
  };
  const checkAnswer = () => {
    if (!question || !game.started || game.locked) return;
    const complete = game.cards.length > 0 && game.matched.length === game.cards.length;
    const limit = toNumber(question.maximumMoves, 0);
    const success = complete && (limit === 0 || game.moves <= limit);
    updateGame(current, prev => ({ ...prev, result: success ? "correct" : "incorrect", opened: [], locked: false }));
    setHintVisible(false);
  };
  const navigate = (to: number) => { if (to < 0 || to >= total) return; clearTimers(); updateGame(current, prev => ({ ...prev, locked: false, opened: [] })); setPeek(false); setCurrent(to); setHintVisible(false); };
  const saveToolReturn = (url: string) => {
    try { assessmentStorage.setItem(progressKey, JSON.stringify({ current, games, flagged, secondsLeft, expiresAt, scratchNote, assessmentStarted })); } catch {}
    router.push(url);
  };
  const submit = () => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    const entries = questions.map((q, i) => {
      const attempt = games[i];
      const status = attempt?.result || null;
      return { text: q.text.replace(/<[^>]+>/g, ""), options: [], correct: -1, selected: status === null ? null : 0,
        questionType: "short-answer", gradingStatus: status || "unanswered", points: toNumber(q.points, 1),
        hint: q.hint || "", explanation: q.explanation || "", bloom: q.bloom || "", flagged: flagged.includes(i),
        answerText: attempt?.selectedPairs.map(([a, b]) => `${a.text} — ${b.text}`).join("; ") || "",
        expectedAnswer: q.pairs.map(p => `${p.left} — ${p.right}`).join("; ") };
    });
    const data = { attemptId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), assessmentType: "memory-game", title, questions: entries, totalQuestions: total,
      correctAnswers: correctCount, incorrectAnswers: checkedCount - correctCount, unanswered: total - checkedCount,
      totalMarks: totalPoints, earnedMarks: earnedPoints, scorePercent: Math.round(earnedPoints / Math.max(1, totalPoints) * 100),
      totalSeconds: duration, usedSeconds: Math.max(0, duration - secondsLeft), flaggedQuestionIndexes: flagged,
      submittedAt: new Date().toISOString() };
    if (!isPreview) {
      try {
        if (isRetry) {
          // Preserve the learner's original score and question-review history.
          assessmentStorage.setItem("viewerRetryResult", JSON.stringify(data));
        } else {
          assessmentStorage.setItem("memoryGameViewerResult", JSON.stringify(data));
          assessmentStorage.setItem("viewerAssessmentResult", JSON.stringify(data));
        }
        const prior = JSON.parse(assessmentStorage.getItem("viewerAttempts") || "[]") as unknown;
        const attempts = [...(Array.isArray(prior) ? prior : []), data];
        assessmentStorage.setItem("viewerAttempts", JSON.stringify(attempts));
        updateAssessment({ attemptCount:nextAttemptCount(attempts.length) });
        assessmentStorage.removeItem(progressKey);
      } catch { /* The UI remains usable when localStorage is restricted. */ }
    }
    setRelease(memoryRelease()); setSubmitOpen(false); setSubmitted(true); setSuccessOpen(true);
  };
  const showResult = game.result !== null;
  const success = game.result === "correct";
  const visible = useMemo(() => new Set([...game.opened, ...game.matched]), [game.opened, game.matched]);
  const pairRows = question?.pairs.map((pair, i) => ({
    left: { id: `${i}-left`, side: "left" as const, pair: i, text: pair.left, image: pair.leftImage || "" },
    right: { id: `${i}-right`, side: "right" as const, pair: i, text: pair.right, image: pair.rightImage || "" }
  })) || [];
  const selectedRights = new Map<number, Card>();
  game.selectedPairs.forEach(([a, b]) => {
    if (a.side === "left" && b.side === "right") selectedRights.set(a.pair, b);
    if (b.side === "left" && a.side === "right") selectedRights.set(b.pair, a);
  });
  const fallbackRights = game.cards.filter(card => card.side === "right");
  const answerOrder = pairRows.map((row, i) => ({ left: row.left, right: selectedRights.get(row.left.pair) || fallbackRights[i] || row.right }));
  const gridColumns = Math.max(2, Math.min(6, toNumber(question?.columns === "Auto" ? 4 : question?.columns, 4)));
  const progress = total ? Math.round((current + 1) / total * 100) : 0;
  const isLast = current === total - 1;

  const detailsMarks = draftText(detailsDraft, ["totalMarks", "totalPoints"], String(totalPoints));
  const rawTime = draftText(detailsDraft, ["duration", "timeLimit", "totalTime"], `${Math.round(duration / 60)} Minutes`);
  const totalTimeLabel = /minute|hour/i.test(rawTime) ? rawTime : `${rawTime} Minutes`;
  const rawPassing = draftText(detailsDraft, ["passingScore", "passingMarks"], "60%");
  const passingLabel = rawPassing.includes("%") ? rawPassing : `${rawPassing}%`;
  const negativeLabel = draftText(detailsDraft, ["negativeMarkingValue", "negativeMarking"], "None");
  const beginAssessment = () => {
    if (!acceptedInstructions || total === 0) return;
    setAssessmentStarted(true);
    setAcceptedInstructions(false);
    setHintVisible(false);
    try {
      if (!isPreview) assessmentStorage.setItem(progressKey, JSON.stringify({
        current, games, flagged, secondsLeft, expiresAt, scratchNote, assessmentStarted: true,
      }));
    } catch { /* Keep the Start Assessment action usable when storage is restricted. */ }
  };

  return <main className="superAdminPage institutionAdminPage viewerAppShell mgvApp">
    <div className="dashboardLayout viewerLayout">
      <Sidebar />
      <section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <div className="institutionScrollArea viewerScroll">
          <div className="pageContent institutionPageContent viewerContent mgvContent">
            {!ready ? <p className="mgvNoQuestions">Loading assessment…</p> : total === 0 ? (
              <>
                <nav className="viewerBreadcrumb mgvBreadcrumb" aria-label="Breadcrumb">
                  <Link href={demoDashboardPath()}>Dashboard</Link>{icon("arrow-right-double.svg", 18)}
                  <Link href="/learner">Assessment</Link>{icon("arrow-right-double.svg", 18)}<strong>{title}</strong>
                </nav>
                <h1 className="mgvEmptyTitle">{title}</h1>
                <section className="mgvNoQuestions">No Memory Game questions were found in this assessment. Save questions on the Memory Game Content page before opening the viewer.</section>
              </>
            ) : !assessmentStarted ? (
              <>
                <nav className="viewerBreadcrumb mgvBreadcrumb" aria-label="Breadcrumb">
                  <Link href={demoDashboardPath()}>Dashboard</Link>{icon("arrow-right-double.svg", 18)}
                  <Link href="/learner">Assessment</Link>{icon("arrow-right-double.svg", 18)}<strong>{title}</strong>
                </nav>
                <div className="viewerPageHeading mgvInstructionHeading">
                  <h1>{title}</h1>
                  <p>Memory Game</p>
                </div>
                <div className="viewerColumns mgvInstructionColumns">
                  <aside className="viewerSummary mgvInstructionSummary" aria-label="Assessment summary">
                    <InstructionSummaryItem label="Total Questions" value={String(total)} iconName="list.svg" variant="blue" />
                    <InstructionSummaryItem label="Total Marks" value={detailsMarks} iconName="star-award.svg" variant="orange" />
                    <InstructionSummaryItem label="Total Time" value={totalTimeLabel} iconName="alarm-clock.svg" variant="purple" />
                    <InstructionSummaryItem label="Passing Score" value={passingLabel} iconName="checkmark-circle.svg" variant="green" />
                    <InstructionSummaryItem label="Negative Marking" value={negativeLabel} iconName="remove-circle.svg" variant="red" />
                  </aside>
                  <div className="viewerRightColumn">
                    <section className="viewerInstructions">
                      <h2>Instructions</h2>
                      <ol>{instructionLines.map((line, index) => <li key={`${index}-${line}`}>{index + 1}. {line}</li>)}</ol>
                    </section>
                    <section className="viewerConfirmation" aria-label="Confirm instructions">
                      <label className="viewerAgreement">
                        <input type="checkbox" checked={acceptedInstructions} onChange={event => setAcceptedInstructions(event.target.checked)} />
                        <span className="viewerCheckboxIcon" aria-hidden="true">{acceptedInstructions ? "✓" : ""}</span>
                        <span>I have read and understood the instructions</span>
                      </label>
                      <button type="button" className="viewerStart" disabled={!acceptedInstructions} onClick={beginAssessment}>Start Assessment</button>
                      <p className="viewerStartNote">The timer starts when you begin the assessment.</p>
                    </section>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mgvPageHead">
                  <div>
                    <nav className="viewerBreadcrumb mgvBreadcrumb" aria-label="Breadcrumb">
                      <Link href={demoDashboardPath()}>Dashboard</Link>{icon("arrow-right-double.svg", 18)}
                      <Link href="/learner">Assessment</Link>{icon("arrow-right-double.svg", 18)}<strong>{title}</strong>
                    </nav>
                    <h1>{title}</h1>
                  </div>
                  {question?.showTimer !== false && <Clock seconds={secondsLeft} />}
                </div>
                <div className="mgvColumns">
                  <section className="mgvMainCard">
                    <div className="mgvProgressTop"><strong>{current + 1}/{total}</strong><b>{toNumber(question?.points, 1)} Marks</b></div>
                    <div className="mgvProgress"><span><i style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
                    <div className="mgvQuestionHead">
                      <h2>Question {current + 1}</h2>
                      <h3>{question.text?.replace(/<[^>]+>/g, "") || "Find the matching pairs"}</h3>
                      <p>Flip two cards at a time to find the matching pairs.</p>
                    </div>
                    <div className="mgvBoardOuter">
                      <div className="mgvBoardInner">
                        <div className="mgvCardGrid" style={{ "--mgv-cols": gridColumns } as CSSProperties}>
                          {(game.cards.length ? game.cards : makeUnshuffledCards(question)).map((card, index) => {
                            const faceUp = showResult || peek || visible.has(index);
                            return <button
                              key={card.id}
                              type="button"
                              className={`mgvCard ${faceUp ? "mgvCardFace" : "mgvCardBack"} ${showResult ? success ? "mgvCardCorrect" : "mgvCardWrong" : ""}`}
                              aria-label={`${faceUp ? "Card" : "Flip card"} ${index + 1}${faceUp ? `: ${card.text}` : ""}`}
                              aria-pressed={faceUp}
                              disabled={!game.started || Boolean(game.result) || game.locked || peek || game.matched.includes(index)}
                              onClick={() => flip(index)}
                            >
                              {faceUp ? <Face card={card} /> : icon("circle-question-mark.svg", 46)}
                            </button>;
                          })}
                        </div>
                        <div className="mgvGameFooter">
                          <div className="mgvGameButtons">
                            {!game.started && <button className="mgvStart" type="button" onClick={start}>{icon("circle-check.svg", 14)} Start</button>}
                            <button className="mgvRestart" type="button" disabled={!game.started} onClick={restart}>{icon("refresh.svg", 14)} Restart</button>
                          </div>
                          {question.showMoveCounter !== false && <span className="mgvMoveCount">{icon("adjust-position.svg", 15)} Moves: {game.moves}</span>}
                        </div>
                      </div>
                    </div>
                    <section className="mgvHint">
                      <button type="button" className="mgvHintButton" onClick={() => setHintVisible(value => !value)} aria-expanded={hintVisible}>
                        <span><span className="mgvHintCircle">{icon("idea.svg", 24)}</span>Hint</span>
                        <span className="mgvShow">{hintVisible ? "Hide" : "Show"}</span>
                      </button>
                      {hintVisible && <p>{question.hint || "No hint was supplied for this question."}</p>}
                    </section>
                    <div className="mgvQuestionMeta">
                      <div><label>Bloom’s Taxonomy</label><span>{question.bloom || "—"}</span></div>
                      <button className={`mgvFlag ${flagged.includes(current) ? "mgvFlagActive" : ""}`} type="button" onClick={() => setFlagged(previous => previous.includes(current) ? previous.filter(index => index !== current) : [...previous, current])}>
                        {icon("flag.svg", 20)} {flagged.includes(current) ? "Remove flag" : "Flag for review"}
                      </button>
                    </div>
                    <div className="mgvActions">
                      {current > 0 && <button type="button" onClick={() => navigate(current - 1)} disabled={current === 0}>{icon("arrowleft.svg", 20)} Previous</button>}
                      <button type="button" onClick={checkAnswer} disabled={!game.started || game.locked || Boolean(game.result)}>Check Answer</button>
                      <button type="button" className="mgvNext" onClick={() => isLast ? setSubmitOpen(true) : navigate(current + 1)}>
                        {isLast ? "Submit" : "Next"}{icon("arrowright.svg", 20)}
                      </button>
                    </div>
                  </section>
                  <aside className={`mgvSideCard ${showResult ? "mgvSideResult" : ""}`}>
                    {showResult ? (
                      <div className={`mgvResult ${success ? "mgvSuccess" : "mgvFailure"}`} role="status" aria-live="polite">
                        <div className="mgvResultHero">
                          {success && <img className="mgvConfetti" src={`${V}blast.png`} alt="" aria-hidden="true" />}
                          <span className="mgvResultRound">{icon(success ? "checkmark-circle.svg" : "cancel-circle.svg", 40)}</span>
                          <h2>{success ? "Correct ! 🎉" : "Not Quit !"}</h2>
                        </div>
                        <h3>Your Answer</h3>
                        <div className="mgvAnswerList">{answerOrder.map(({ left, right }, index) => <AnswerRow key={index} left={left} right={right} index={index} />)}</div>
                        <h3>Correct Answer</h3>
                        <div className="mgvAnswerList">{pairRows.map(({ left, right }, index) => <AnswerRow key={index} left={left} right={right} index={index} />)}</div>
                        <div className="mgvWhy">
                          <h3>Why ?</h3>
                          <p>{question.explanation || (success ? question.feedbackFull : question.feedbackZero) || "Review the correct matching pairs above."}</p>
                          <img src={`${V}${success ? "happy.gif" : "sad.gif"}`} alt={success ? "Happy face" : "Sad face"} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2>Question Navigator</h2>
                        <div className="mgvNavigatorGrid">{questions.map((_, index) => <button
                          key={index}
                          type="button"
                          className={`${index === current ? "mgvNavCurrent" : ""} ${flagged.includes(index) ? "mgvNavFlagged" : ""} ${games[index]?.result ? "mgvNavAnswered" : ""}`}
                          aria-current={index === current ? "step" : undefined}
                          onClick={() => navigate(index)}
                        >{index + 1}</button>)}</div>
                        <div className="mgvStats">
                          <div><span>{icon("checkmark-circle.svg", 22)} Answered</span><strong>{String(checkedCount).padStart(2, "0")}</strong></div>
                          <div><span><i className="mgvEmptyCircle" /> Remaining</span><strong>{String(total - checkedCount).padStart(2, "0")}</strong></div>
                          <div><span>{icon("flag.svg", 22)} Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                        </div>
                        <h2 className="mgvToolsTitle">Tools</h2>
                        <div className="mgvTools">
                          <button type="button" onClick={() => saveToolReturn(`${viewerPath()}/scratch`)}>{icon("sticky-note.svg", 20)}Scratch Pad{icon("arrowupright.svg", 16)}</button>
                          <button type="button" onClick={() => saveToolReturn(`${viewerPath()}/calculator`)}>{icon("calculator.svg", 20)}Calculator{icon("arrowupright.svg", 16)}</button>
                          <button type="button" onClick={() => saveToolReturn(`${viewerPath()}/formulasheet`)}>{icon("sigma.svg", 20)}Formula Sheet{icon("arrowupright.svg", 16)}</button>
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      {submitOpen && <ViewerSubmitConfirm answered={checkedCount} remaining={total - checkedCount} flagged={flagged.length} onBack={() => setSubmitOpen(false)} onSubmit={submit} />}
      {successOpen && release && <TextSubmitSuccess title={title} scorePercent={Math.round(earnedPoints / Math.max(1, totalPoints) * 100)} pendingCount={0} passingScore={passingLabel} release={release} isRetry={isRetry} onClose={() => { setSuccessOpen(false); router.push(!isPreview && release.mode === "immediate" ? resultPath() : demoDashboardPath()); }} />}
    </div>
  </main>;
}

function makeUnshuffledCards(q: MemoryQuestion): Card[] {
  return q.pairs.flatMap((p, i): Card[] => [
    { id: `${i}-left`, pair: i, side: "left", text: p.left, image: p.leftImage || "" },
    { id: `${i}-right`, pair: i, side: "right", text: p.right, image: p.rightImage || "" }
  ]);
}
