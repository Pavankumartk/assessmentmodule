"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Flag, Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter } from "next/navigation";
import { getStartingTeam } from "../lib/lobby";
import { getQuestionRoute } from "../data/questions";
import type { GameMode, MCQQuestion } from "../data/questions";
import { advanceToNextQuestion, getCurrentQuestion, getCurrentQuestionRoute, getCurrentTeam, getGameMode, getTeamProgress, getTeamXP, isLifelineUsed, setCurrentTeam, submitAnswer, useLifeline as recordLifeline } from "../lib/game-engine";
import "./blaze-questions.css";

const FEEDBACK_MS = 5000;
const ROUND_SIZE = 3;

const embers = Array.from({ length: 12 }, (_, i) => i);
const roundNumber = (mode: GameMode, index: number) => (mode === "quick" || index >= ROUND_SIZE ? 2 : 1);
const roundQuestionNumber = (_mode: GameMode, index: number) => (index % ROUND_SIZE) + 1;

type View = "question" | "result";
type Lifeline = "blitz" | "boost" | "split";

function LockMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="9" width="16" height="13" rx="3" />
      <path d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9M12 13.5V17" />
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

export default function BlazeQuestionsPage() {
  const router = useRouter();

  const [question, setQuestion] = useState<MCQQuestion | null>(null);
  const [index, setIndex] = useState(0);
  const [xp, setXp] = useState(0);
  const [view, setView] = useState<View>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [earned, setEarned] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [lifelines, setLifelines] = useState({
    blitz: false,
    boost: false,
    split: false,
  });
  const [hidden, setHidden] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [mode, setMode] = useState<GameMode>("full");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerLocked = useRef(false);

  useEffect(() => {
    const selectedMode = getGameMode();
    const firstTeam = getStartingTeam() || "nova";
    const savedTurn = localStorage.getItem("qcCurrentTeam");

    if (savedTurn !== "nova" && savedTurn !== "blaze") {
      setCurrentTeam(firstTeam);
    }

    if (getCurrentTeam() !== "blaze") {
      const other = getCurrentQuestion("nova");
      router.replace(other ? getQuestionRoute(other) : "/quantum-champs-player/nova-questions");
      return;
    }

    const progress = getTeamProgress("blaze");
    const current = getCurrentQuestion("blaze");

    if (selectedMode === "full" && progress.index >= ROUND_SIZE && localStorage.getItem("qcRound2Started") !== "true") {
      router.replace(getCurrentQuestionRoute(getCurrentTeam()));
      return;
    }

    if (!current) {
      setFinished(true);
      router.replace(advanceToNextQuestion("blaze"));
      return;
    }

    if (current.type !== "mcq") {
      router.replace(getQuestionRoute(current));
      return;
    }

    if (Object.prototype.hasOwnProperty.call(progress.answers, current.id)) {
      router.replace(advanceToNextQuestion("blaze"));
      return;
    }

    setMode(selectedMode);
    setIndex(progress.index);
    setXp(getTeamXP("blaze"));
    setQuestion(current);
    setFinished(false);
    setSelected(null);
    setEarned(0);
    setIsCorrect(false);
    setView("question");
    setNotice("");
    setLifelines({
      blitz: isLifelineUsed("blaze", "blitz"),
      boost: isLifelineUsed("blaze", "boost"),
      split: isLifelineUsed("blaze", "split"),
    });

    try {
      const savedHidden = JSON.parse(localStorage.getItem(`qcSplitOptions:blaze:${current.id}`) || "[]");
      setHidden(Array.isArray(savedHidden) ? savedHidden.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setHidden([]);
    }

    answerLocked.current = false;
    setReady(true);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [router]);

  const optionOrder = question
    ? [...question.options].sort((a, b) => {
        const order: Record<string, number> = {
          a: 0,
          c: 1,
          b: 2,
          d: 3,
        };

        return (order[a.id.toLowerCase()] ?? 10) - (order[b.id.toLowerCase()] ?? 10);
      })
    : [];

  const choose = (id: string) => {
    if (!ready || !question || view !== "question" || finished || answerLocked.current || hidden.includes(id) || getCurrentTeam() !== "blaze") {
      return;
    }

    answerLocked.current = true;
    const result = submitAnswer("blaze", question.id, id);

    if (result.alreadyAnswered) {
      router.replace(advanceToNextQuestion("blaze"));
      return;
    }

    if (!getTeamProgress("blaze").answers[question.id]) {
      answerLocked.current = false;
      return;
    }

    setSelected(id);
    setIsCorrect(result.correct);
    setEarned(result.earnedXP);
    setXp(result.totalXP);
    setNotice("");
    setView("result");
    setReady(false);

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      if (getCurrentTeam() !== "blaze") return;
      router.replace(advanceToNextQuestion("blaze"));
    }, FEEDBACK_MS);
  };

  const useLifeline = (type: Lifeline) => {
    if (!question || view !== "question" || !ready || finished || answerLocked.current || lifelines[type] || getCurrentTeam() !== "blaze") {
      return;
    }

    if (isLifelineUsed("blaze", type)) {
      setLifelines((prev) => ({ ...prev, [type]: true }));
      return;
    }

    if (!recordLifeline("blaze", type)) return;
    setLifelines((prev) => ({ ...prev, [type]: true }));

    if (type === "split") {
      const incorrect = question.options.filter((o) => o.id !== question.correctAnswer);
      const shuffled = [...incorrect];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const removed = shuffled.slice(0, Math.min(2, shuffled.length)).map((o) => o.id);
      setHidden(removed);
      localStorage.setItem(`qcSplitOptions:blaze:${question.id}`, JSON.stringify(removed));
      setNotice("50:50 activated — two incorrect options removed.");
    } else {
      router.push(`/quantum-champs-player/lifeline?team=blaze&type=${type}`);
    }
  };

  return (
    <main className={`qc-blaze-root ${fredoka.variable}`}>
      <div className="qc-blaze-shell">
        <div className="qc-blaze-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-blaze-logo" aria-label="Quantum Champ">
          <svg className="qc-blaze-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcBlazeGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcBlazeDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcBlazeGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcBlazeDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcBlazeDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcBlazeDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-blaze-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        {view === "question" && (
          <>
            <div className="qc-blaze-status">
              <span className="qc-blaze-turn">
                <svg className="qc-blaze-turn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9.5 6.5 11 11l4.5 1.5L11 14l-1.5 4.5L8 14l-4.5-1.5L8 11Z" stroke="#e01e5a" strokeWidth="1.3" strokeLinejoin="round" />
                  <path d="M17 3l.7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#67096e" strokeWidth="1.1" strokeLinejoin="round" />
                  <path d="M17 16l.7 1.8 1.8.7-1.8.7L17 21l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#c05512" strokeWidth="1.1" strokeLinejoin="round" />
                </svg>
                <span className="qc-blaze-turn-text">Team Blaze Turn- Round {roundNumber(mode, index)}</span>
              </span>
              <span className="qc-blaze-count">
                Question{" "}
                <strong>
                  {Math.min(roundQuestionNumber(mode, index), ROUND_SIZE)}/{ROUND_SIZE}
                </strong>
              </span>
            </div>

            <div className="qc-blaze-xp-pill">
              <span className="qc-blaze-xp-inner">
                <svg className="qc-blaze-xp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10 4l1.6 4.9L16.5 10.5l-4.9 1.6L10 17l-1.6-4.9L3.5 10.5l4.9-1.6Z" fill="#ffffff" />
                  <path d="M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6Z" fill="none" stroke="#e3cb48" strokeWidth="1.2" strokeLinejoin="round" />
                  <circle cx="3.5" cy="20.5" r="1.3" fill="none" stroke="#a0f977" strokeWidth="1.2" />
                </svg>
                {xp}XP
              </span>
            </div>
          </>
        )}

        {finished && (
          <div className="qc-blaze-question">
            <span>Team Blaze has completed its Round {roundNumber(mode, index)} questions.</span>
          </div>
        )}

        {question && !finished && (
          <>
            <div className="qc-blaze-question">
              <span>
                {roundQuestionNumber(mode, index)}. {question.question}
              </span>
            </div>

            <div className={`qc-blaze-board ${view === "result" ? "qc-blaze-board-result" : ""}`}>
              {view === "question" ? (
                <>
                  <div className="qc-blaze-options">
                    {question.options.map((option) => (
                      <button
                        key={option.id}
                        style={{
                          gridColumn: ["a", "b"].includes(option.id.toLowerCase()) ? 1 : 2,
                          gridRow: ["a", "c"].includes(option.id.toLowerCase()) ? 1 : 2,
                        }}
                        className={`qc-blaze-option ${hidden.includes(option.id) ? "qc-blaze-option-eliminated" : ""}`}
                        type="button"
                        disabled={!ready || finished || hidden.includes(option.id)}
                        onClick={() => choose(option.id)}>
                        <span className="qc-blaze-option-letter">{option.id}</span>
                        <span>{option.text}</span>
                        {hidden.includes(option.id) && (
                          <span className="qc-blaze-option-cross" aria-label="Incorrect option eliminated">
                            ✕
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="qc-blaze-lifelines">
                    <button type="button" disabled={lifelines.blitz || !ready || finished} onClick={() => useLifeline("blitz")}>
                      <span className="qc-blaze-life qc-blaze-life-blitz">
                        <span>30s</span>
                      </span>
                      <b>Blitz</b>
                    </button>

                    <button type="button" disabled={lifelines.boost || !ready || finished} onClick={() => useLifeline("boost")}>
                      <span className="qc-blaze-life qc-blaze-life-boost">
                        <span>60s</span>
                      </span>
                      <b>Boost</b>
                    </button>

                    <button type="button" disabled={lifelines.split || !ready || finished} onClick={() => useLifeline("split")}>
                      <span className="qc-blaze-life qc-blaze-life-split">
                        <span>50:50</span>
                      </span>
                      <b>Split</b>
                    </button>
                  </div>

                  {notice && (
                    <p className="qc-blaze-notice" role="status">
                      {notice}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="qc-blaze-rail qc-blaze-rail-left">
                    <span className="qc-blaze-rail-track">
                      <i />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-fire">
                      <Flame aria-hidden="true" />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-blue">
                      <LockMark />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-orange">
                      <LockMark />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-gold">
                      <span className="qc-blaze-shield-spark">
                        <Flag aria-hidden="true" />
                        <small>Spark</small>
                      </span>
                    </span>
                  </div>

                  <div className="qc-blaze-rail qc-blaze-rail-right">
                    <span className="qc-blaze-rail-track">
                      <i />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-nova">
                      <SunMedium aria-hidden="true" />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-blue">
                      <LockMark />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-orange">
                      <LockMark />
                    </span>
                    <span className="qc-blaze-shield qc-blaze-shield-gold">
                      <LockMark />
                    </span>
                  </div>

                  <div className="qc-blaze-total">
                    <span className="qc-blaze-total-inner">
                      <strong>Total</strong>
                      <span>{xp} XP</span>
                    </span>
                  </div>

                  <div className="qc-blaze-result-center">
                    <div className="qc-blaze-selected">
                      <span className="qc-blaze-option-letter">{selected}</span>
                      <span>{question.options.find((o) => o.id === selected)?.text}</span>
                    </div>

                    <div className="qc-blaze-fact">
                      <div>DID YOU KNOW ?</div>
                      <p>{question.explanation}</p>
                    </div>

                    <div className={`qc-blaze-result-label ${isCorrect ? "qc-blaze-success" : "qc-blaze-failure"}`}>
                      <ResultMark correct={isCorrect} />
                      {isCorrect ? `Great Work Team Blaze Earns ${earned} XP` : "No XP this time for Team Blaze"}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
