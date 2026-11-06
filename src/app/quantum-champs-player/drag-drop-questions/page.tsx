"use client";

import { Flag, Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { advanceToNextQuestion, getCurrentQuestion, getCurrentQuestionRoute, getCurrentTeam, getGameMode, getTeamProgress, getTeamXP, isLifelineUsed, submitAnswer } from "../lib/game-engine";
import type { DragDropQuestion, Team } from "../data/questions";
import "../nova-questions/nova-questions.css";
import "../blaze-questions/blaze-questions.css";
import "../hidden-questions/hidden-questions.css";
import "./drag-drop-questions.css";

type Step = { id: string; label: string; icon: string };
type DragQuestion = {
  id: string;
  question: string;
  xp: number;
  steps: Step[];
  correctOrder: string[];
  hint?: string;
};
type Progress = { index: number; xp: number; answers: Record<string, string> };
type Ghost = { id: string; number: number; x: number; y: number; w: number; h: number; ox: number; oy: number };


const WAIT_MS = 10000;
const embers = Array.from({ length: 12 }, (_, i) => i);

const defaultQuestion: DragQuestion = {
  id: "drag-round2-4",
  question: "Provide an overview of how an AI model learns and gives an answer.",
  xp: 1600,
  steps: [
    { id: "train", label: "Train the Model", icon: "🪐" },
    { id: "test", label: "Test and Improve", icon: "📋" },
    { id: "answer", label: "Give an Answer", icon: "🤖" },
    { id: "collect", label: "Collect Data", icon: "🛢️" },
  ],
  correctOrder: ["collect", "train", "test", "answer"],
};

const storageTeam = (team: Team) => (team === "nova" ? "Nova" : "Blaze");
const stepIcons: Record<string, string> = {
  train: "🪐",
  test: "📋",
  answer: "🤖",
  collect: "🛢️",
  predict: "🔮",
  prepare: "🧹",
  evaluate: "✅",
  model: "⚙️",
};

function toDisplayQuestion(question: DragDropQuestion): DragQuestion {
  return {
    id: question.id,
    question: question.question,
    xp: question.xp,
    hint: question.hint,
    steps: question.steps.map((step) => ({
      id: step.id,
      label: step.text,
      icon: stepIcons[step.id] || "✧",
    })),
    correctOrder: question.correctOrder,
  };
}

function LockMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="9" width="16" height="13" rx="3" />
      <path d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9M12 13.5V17" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <linearGradient id="ddLockGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2d4cc8" />
          <stop offset="1" stopColor="#e01e5a" />
        </linearGradient>
      </defs>
      <g stroke="url(#ddLockGrad)">
        <rect x="4" y="9" width="16" height="13" rx="3" />
        <path d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9M12 13.5V17" />
      </g>
    </svg>
  );
}

function ResultMark({ correct }: { correct: boolean }) {
  return correct ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="currentColor" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m9 9 6 6M15 9l-6 6" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TileBody({ number, step }: { number: number; step: Step }) {
  return (
    <>
      <span className="dd-number">{number}</span>
      <span className="dd-slot">
        <span className="dd-icon" aria-hidden="true">
          {step.icon}
        </span>
        <span className="dd-label">{step.label}</span>
      </span>
    </>
  );
}

function DragDropQuestionsContent() {
  const router = useRouter();
  const params = useSearchParams();

  const team: Team = params.get("team") === "blaze" ? "blaze" : "nova";
  const teamName = storageTeam(team);

  const [question, setQuestion] = useState(defaultQuestion);
  const [order, setOrder] = useState<string[]>(defaultQuestion.steps.map((s) => s.id));
  const [progress, setProgress] = useState<Progress>({ index: 3, xp: 0, answers: {} });
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [earned, setEarned] = useState(0);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(false);
  const [used, setUsed] = useState({ blitz: false, boost: false, split: false });
  const [mode, setMode] = useState<"full" | "quick">("full");
  const [novaXP, setNovaXP] = useState(0);
  const [blazeXP, setBlazeXP] = useState(0);
  const [ghost, setGhost] = useState<Ghost | null>(null);

  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusId = useRef<string | null>(null);
  const dragId = ghost ? ghost.id : null;

  useEffect(() => {
    setMode(getGameMode());
    const activeTeam = getCurrentTeam();
    const activeQuestion = getCurrentQuestion(activeTeam);
    if (activeTeam !== team || !activeQuestion || activeQuestion.type !== "drag-drop") {
      router.replace(getCurrentQuestionRoute(activeTeam));
      return;
    }

    const data = toDisplayQuestion(activeQuestion);
    const savedProgress = getTeamProgress(team);
    setQuestion(data);
    setOrder(data.steps.map((step) => step.id));
    setProgress(savedProgress);
    setNovaXP(getTeamXP("nova"));
    setBlazeXP(getTeamXP("blaze"));
    setUsed({
      blitz: isLifelineUsed(team, "blitz"),
      boost: isLifelineUsed(team, "boost"),
      split: isLifelineUsed(team, "split"),
    });
    setRevealed(false);
    setCorrect(false);
    setEarned(0);
    setHint(false);
    setReady(true);
    locked.current = false;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router, team]);

  useEffect(() => {
    if (!dragId) return;
    const onMove = (event: PointerEvent) => {
      setGhost((current) => (current ? { ...current, x: event.clientX - current.ox, y: event.clientY - current.oy } : current));
      const hit = Object.entries(tileRefs.current).find(([id, node]) => {
        if (id === dragId || !node) return false;
        const rect = node.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (!hit) return;
      setOrder((previous) => {
        const from = previous.indexOf(dragId);
        const to = previous.indexOf(hit[0]);
        if (from < 0 || to < 0 || from === to) return previous;
        const copy = [...previous];
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        return copy;
      });
    };
    const onEnd = () => setGhost(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [dragId]);

  useEffect(() => {
    if (!focusId.current) return;
    tileRefs.current[focusId.current]?.focus();
    focusId.current = null;
  }, [order]);

  const move = (from: number, to: number) => {
    if (!ready || getCurrentTeam() !== team || revealed || from === to || from < 0 || to < 0 || to >= order.length) {
      return;
    }
    setOrder((previous) => {
      const copy = [...previous];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string, index: number) => {
    if (event.button !== 0 || !ready || revealed || getCurrentTeam() !== team) return;
    const node = tileRefs.current[id];
    if (!node) return;
    const rect = node.getBoundingClientRect();
    event.preventDefault();
    setGhost({
      id,
      number: index + 1,
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      ox: event.clientX - rect.left,
      oy: event.clientY - rect.top,
    });
  };

  const keyMove = (event: KeyboardEvent<HTMLDivElement>, index: number, id: string) => {
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    focusId.current = id;
    move(index, index + step);
  };

  const submit = () => {
    if (!ready || revealed || locked.current || getCurrentTeam() !== team) return;
    const active = getCurrentQuestion(team);
    if (!active || active.type !== "drag-drop" || active.id !== question.id) return;

    locked.current = true;
    const result = submitAnswer(team, question.id, order);
    if (result.alreadyAnswered) {
      locked.current = false;
      return;
    }

    setCorrect(result.correct);
    setEarned(result.earnedXP);
    setRevealed(true);
    setProgress(getTeamProgress(team));
    setNovaXP(getTeamXP("nova"));
    setBlazeXP(getTeamXP("blaze"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (getCurrentTeam() !== team) return;
      router.replace(advanceToNextQuestion(team));
    }, WAIT_MS);
  };

  const activate = (type: "blitz" | "boost" | "split") => {
    if (!ready || revealed || used[type] || getCurrentTeam() !== team) return;

    if (type === "split") {
      setHint(true);
      return;
    }

    router.push(`/quantum-champs-player/lifeline?team=${team}&type=${type}`);
  };

  const p = `qc-${team}`;
  const questionNumber = mode === "quick" ? progress.index + 1 : (progress.index % 3) + 1;
  const ownXP = team === "nova" ? novaXP : blazeXP;
  const otherXP = team === "nova" ? blazeXP : novaXP;
  const lifelinesLocked = !ready || revealed || getCurrentTeam() !== team;

  const teamShield =
    team === "nova" ? (
      <span className={`${p}-shield ${p}-shield-nova`}>
        <SunMedium aria-hidden="true" />
      </span>
    ) : (
      <span className={`${p}-shield ${p}-shield-fire`}>
        <Flame aria-hidden="true" />
      </span>
    );
  const otherShield =
    team === "nova" ? (
      <span className={`${p}-shield ${p}-shield-blaze`}>
        <Flame aria-hidden="true" />
      </span>
    ) : (
      <span className={`${p}-shield ${p}-shield-nova`}>
        <SunMedium aria-hidden="true" />
      </span>
    );

  const ghostStep = ghost ? question.steps.find((s) => s.id === ghost.id) : undefined;

  return (
    <main className={`${p}-root hq-root dd-root ${fredoka.variable}`}>
      <div className={`${p}-shell`}>
        <div className={`${p}-embers`} aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className={`${p}-logo`} aria-label="Quantum Champ">
          <svg className={`${p}-logo-crown`} viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="ddGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="ddDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#ddGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#ddDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#ddDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#ddDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className={`${p}-logo-shield`}>
            Quantum
            <br />
            Champ
          </div>
        </div>

        <div className={`${p}-status`}>
          <span className={`${p}-turn`}>
            <svg className={`${p}-turn-icon`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9.5 6.5 11 11l4.5 1.5L11 14l-1.5 4.5L8 14l-4.5-1.5L8 11Z" stroke="#67096e" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M17 3l.7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#e01e5a" strokeWidth="1.1" strokeLinejoin="round" />
              <path d="M17 16l.7 1.8 1.8.7-1.8.7L17 21l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#c05512" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
            <span className={`${p}-turn-text`}>Team {teamName} Turn- Round 2</span>
          </span>
          <span className={`${p}-count`}>
            Question <strong>{questionNumber}/3</strong>
          </span>
        </div>

        <div className={`${p}-xp-pill`}>
          <span className={`${p}-xp-inner`}>
            <svg className={`${p}-xp-icon`} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4l1.6 4.9L16.5 10.5l-4.9 1.6L10 17l-1.6-4.9L3.5 10.5l4.9-1.6Z" fill="#ffffff" />
              <path d="M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6Z" fill="none" stroke="#e3cb48" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="3.5" cy="20.5" r="1.3" fill="none" stroke="#a0f977" strokeWidth="1.2" />
            </svg>
            {progress.xp}XP
          </span>
        </div>

        <div className={`${p}-question`}>
          <span>
            {questionNumber}. {question.question}
          </span>
        </div>

        <div className={`${p}-board ${p}-board-result hq-board hq-reveal`}>
          <div className={`${p}-rail ${p}-rail-left`}>
            <span className={`${p}-rail-track`}>
              <i />
            </span>
            {teamShield}
            <span className={`${p}-shield ${p}-shield-blue`}>
              <LockMark />
            </span>
            <span className={`${p}-shield ${p}-shield-orange`}>
              <LockMark />
            </span>
            <span className={`${p}-shield ${p}-shield-gold`}>
              <span className={`${p}-shield-spark`}>
                <Flag aria-hidden="true" />
                <small>Spark</small>
              </span>
            </span>
          </div>
          <div className={`${p}-rail ${p}-rail-right`}>
            <span className={`${p}-rail-track`}>
              <i />
            </span>
            {otherShield}
            <span className={`${p}-shield ${p}-shield-blue`}>
              <span className={`${p}-shield-spark`}>
                <Flag aria-hidden="true" />
                <small>Elite</small>
              </span>
            </span>
            <span className={`${p}-shield ${p}-shield-orange`}>
              <span className={`${p}-shield-spark`}>
                <Flag aria-hidden="true" />
                <small>Boost</small>
              </span>
            </span>
            <span className={`${p}-shield ${p}-shield-gold`}>
              <span className={`${p}-shield-spark`}>
                <Flag aria-hidden="true" />
                <small>Spark</small>
              </span>
            </span>
          </div>
          <div className={`${p}-total`}>
            <span className={`${p}-total-inner`}>
              <strong>Total</strong>
              <span>{ownXP} XP</span>
            </span>
          </div>
          <div className={`${p}-total hq-total-right`}>
            <span className={`${p}-total-inner`}>
              <strong>Total</strong>
              <span>{otherXP} XP</span>
            </span>
          </div>

          <div className="dd-tiles">
            {order.map((id, index) => {
              const step = question.steps.find((s) => s.id === id)!;
              const placed = revealed ? (question.correctOrder[index] === id ? "is-correct" : "is-wrong") : "";
              return (
                <div
                  key={id}
                  ref={(node) => {
                    tileRefs.current[id] = node;
                  }}
                  role="button"
                  tabIndex={revealed ? -1 : 0}
                  aria-label={`Position ${index + 1}: ${step.label}. Drag, or use the arrow keys, to reorder.`}
                  className={`dd-tile ${placed} ${dragId === id ? "is-dragging" : ""}`}
                  onPointerDown={(event) => startDrag(event, id, index)}
                  onKeyDown={(event) => keyMove(event, index, id)}>
                  <TileBody number={index + 1} step={step} />
                </div>
              );
            })}
          </div>

          <div className="hq-row dd-row">
            {revealed ? (
              <p className={`${p}-result-label ${correct ? `${p}-success` : `${p}-failure`} hq-result`} role="status">
                <ResultMark correct={correct} />
                {correct ? `Great Work Team ${teamName} Earns ${earned} XP` : `No XP this time for Team ${teamName}`}
              </p>
            ) : (
              <>
                <button type="button" className="dd-lock" onClick={submit} disabled={!ready || getCurrentTeam() !== team}>
                  <LockGlyph />
                  <span>Lock Answer</span>
                </button>
                <button type="button" className="hq-hint" onClick={() => setHint((value) => !value)}>
                  <span className="hq-hint-dot" aria-hidden="true" />
                  {hint ? "Hide Hint" : "Reveal Hint"}
                </button>
                {hint && <p className="hq-hint-text dd-hint-text">Arrange the steps in the order an AI system learns and responds.</p>}
              </>
            )}
          </div>

          <div className={`${p}-lifelines hq-lifelines`}>
            <button type="button" className={used.blitz ? "is-used" : ""} disabled={lifelinesLocked || used.blitz} onClick={() => activate("blitz")}>
              <span className={`${p}-life ${p}-life-blitz`}>
                <span>30s</span>
              </span>
              <b>Blitz</b>
            </button>
            <button type="button" className={used.boost ? "is-used" : ""} disabled={lifelinesLocked || used.boost} onClick={() => activate("boost")}>
              <span className={`${p}-life ${p}-life-boost`}>
                <span>60s</span>
              </span>
              <b>Boost</b>
            </button>
            <button type="button" className={used.split ? "is-used" : ""} disabled={lifelinesLocked || used.split} onClick={() => activate("split")}>
              <span className={`${p}-life ${p}-life-split`}>
                <span>50:50</span>
              </span>
              <b>Split</b>
            </button>
          </div>
        </div>
      </div>

      {ghost && ghostStep && (
        <div className="dd-tile dd-ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }} aria-hidden="true">
          <TileBody number={ghost.number} step={ghostStep} />
        </div>
      )}
    </main>
  );
}

export default function DragDropQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <DragDropQuestionsContent />
    </Suspense>
  );
}
