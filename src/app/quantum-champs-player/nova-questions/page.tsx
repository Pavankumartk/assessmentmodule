"use client";
import { quantumPlayerStorage as localStorage } from "../lib/player-storage";


import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Flag, Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter } from "next/navigation";
import { getStartingTeam } from "../lib/lobby";
import { getQuestionsByTeam } from "../data/questions";
import type { MCQQuestion, GameMode } from "../data/questions";
import { advanceToNextQuestion, getCurrentQuestionRoute, getCurrentTeam, getGameMode, getTeamProgress, getTeamXP, isLifelineUsed, submitAnswer, useLifeline as recordLifeline } from "../lib/game-engine";
import "./nova-questions.css";


const embers = Array.from({ length: 12 }, (_, i) => i);
const TURN_KEY = "qcCurrentTeam";
const FEEDBACK_MS = 5000;
const ROUND_ONE_COUNT = 3;
const getRound = (index: number, mode: GameMode) => (mode === "quick" || index >= ROUND_ONE_COUNT ? 2 : 1);
const getRoundQuestionNumber = (index: number, mode: GameMode) => (mode === "quick" ? index + 1 : (index % ROUND_ONE_COUNT) + 1);
const getRoundQuestionTotal = (_mode: GameMode) => ROUND_ONE_COUNT;

type View = "question" | "result";

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

export default function NovaQuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [xp, setXp] = useState(0);
  const [view, setView] = useState<View>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [lifelines, setLifelines] = useState({ blitz: false, boost: false, split: false });
  const [hidden, setHidden] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);
  const [mode, setMode] = useState<GameMode>("full");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerLocked = useRef(false);

  useEffect(() => {
    const selectedMode = getGameMode();
    const allQuestions = getQuestionsByTeam("nova", selectedMode);
    const progress = getTeamProgress("nova");
    const current = allQuestions[progress.index];
    const mcqQuestions = allQuestions.filter((q): q is MCQQuestion => q.type === "mcq");

    setMode(selectedMode);
    setQuestions(mcqQuestions);
    setIndex(progress.index);
    setXp(getTeamXP("nova"));
    setFinished(progress.index >= allQuestions.length);

    const savedTurn = localStorage.getItem(TURN_KEY);
    if (savedTurn !== "nova" && savedTurn !== "blaze") {
      const first = getStartingTeam() || "nova";
      localStorage.setItem(TURN_KEY, first);
      localStorage.setItem("qcFirstRegisteredTeam", first);
    }

    if (getCurrentTeam() !== "nova") {
      router.replace(getCurrentQuestionRoute());
      return;
    }

    if (current && current.type !== "mcq") {
      router.replace(getCurrentQuestionRoute("nova"));
      return;
    }

    if (selectedMode === "full" && progress.index >= ROUND_ONE_COUNT && localStorage.getItem("qcRound2Started") !== "true") {
      router.replace("/quantum-champs-player/round-2-start");
      return;
    }

    setLifelines({
      blitz: isLifelineUsed("nova", "blitz") || localStorage.getItem("qcLifelineUsed:nova:blitz") === "1",
      boost: isLifelineUsed("nova", "boost") || localStorage.getItem("qcLifelineUsed:nova:boost") === "1",
      split: isLifelineUsed("nova", "split") || localStorage.getItem("qcLifelineUsed:nova:split") === "1",
    });

    try {
      const savedHidden = JSON.parse(sessionStorage.getItem(`qcLifelineHidden:nova:${current?.id}`) || "[]");
      setHidden(Array.isArray(savedHidden) ? savedHidden.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setHidden([]);
    }

    setSelected(null);
    setNotice("");
    setView("question");
    setReady(true);
    answerLocked.current = false;

    if (current && Object.prototype.hasOwnProperty.call(progress.answers, current.id)) {
      let savedAnswer: string | null = null;
      try {
        const record = JSON.parse(progress.answers[current.id]);
        savedAnswer = typeof record?.answer === "string" ? record.answer : null;
      } catch {
        savedAnswer = progress.answers[current.id];
      }
      if (savedAnswer !== null) {
        setSelected(savedAnswer);
        setView("result");
        setReady(false);
        answerLocked.current = true;
        timer.current = setTimeout(() => {
          if (getCurrentTeam() === "nova") {
            router.replace(advanceToNextQuestion("nova"));
          }
        }, FEEDBACK_MS);
      }
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  const question = questions.find((q) => q.id === getQuestionsByTeam("nova", mode)[index]?.id);
  const total = getRoundQuestionTotal(mode);
  const round = getRound(index, mode);
  const roundQuestion = getRoundQuestionNumber(index, mode);
  const isCorrect = Boolean(question && selected === question.correctAnswer);
  const earned = isCorrect ? (question?.xp ?? 1000) : 0;

  const choose = (id: string) => {
    if (!question || view !== "question" || !ready || finished || answerLocked.current || hidden.includes(id) || getCurrentTeam() !== "nova") return;

    answerLocked.current = true;
    const result = submitAnswer("nova", question.id, id);
    if (result.alreadyAnswered) return;

    setSelected(id);
    setXp(result.totalXP);
    setView("result");
    setNotice("");
    setReady(false);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (getCurrentTeam() !== "nova") return;
      router.replace(advanceToNextQuestion("nova"));
    }, FEEDBACK_MS);
  };

  const useLifeline = (type: "blitz" | "boost" | "split") => {
    if (!question || view !== "question" || !ready || finished || answerLocked.current || lifelines[type] || localStorage.getItem(TURN_KEY) !== "nova") return;

    const usedKey = `qcLifelineUsed:nova:${type}`;
    if (isLifelineUsed("nova", type) || localStorage.getItem(usedKey) === "1") return;
    if (!recordLifeline("nova", type)) return;

    setLifelines((prev) => ({ ...prev, [type]: true }));

    if (type === "split") {
      const incorrect = question.options.filter((o) => o.id !== question.correctAnswer);
      const shuffled = [...incorrect];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const removed = shuffled.slice(0, 2).map((o) => o.id);
      sessionStorage.setItem(`qcLifelineHidden:nova:${question.id}`, JSON.stringify(removed));
      setHidden(removed);
      setNotice("50:50 activated — two incorrect options removed.");
    } else {
      router.push(`/quantum-champs-player/lifeline?team=nova&type=${type}`);
    }
  };

  return (
    <main className={`qc-nova-root ${fredoka.variable}`}>
      <div className="qc-nova-shell">
        <div className="qc-nova-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-nova-logo" aria-label="Quantum Champ">
          <svg className="qc-nova-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcNovaGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcNovaDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcNovaGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcNovaDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcNovaDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcNovaDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-nova-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        {view === "question" && (
          <div className="qc-nova-status">
            <span className="qc-nova-turn">
              <svg className="qc-nova-turn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9.5 6.5 11 11l4.5 1.5L11 14l-1.5 4.5L8 14l-4.5-1.5L8 11Z" stroke="#67096e" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M17 3l.7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#e01e5a" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M17 16l.7 1.8 1.8.7-1.8.7L17 21l-.7-1.8-1.8-.7 1.8-.7Z" stroke="#c05512" strokeWidth="1.1" strokeLinejoin="round" />
              </svg>
              <span className="qc-nova-turn-text">Team Nova Turn- Round {round}</span>
            </span>
            <span className="qc-nova-count">
              Question{" "}
              <strong>
                {Math.min(roundQuestion, total)}/{total}
              </strong>
            </span>
          </div>
        )}

        {view === "question" && (
          <div className="qc-nova-xp-pill">
            <span className="qc-nova-xp-inner">
              <svg className="qc-nova-xp-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 4l1.6 4.9L16.5 10.5l-4.9 1.6L10 17l-1.6-4.9L3.5 10.5l4.9-1.6Z" fill="#ffffff" />
                <path d="M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6Z" fill="none" stroke="#e3cb48" strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="3.5" cy="20.5" r="1.3" fill="none" stroke="#a0f977" strokeWidth="1.2" />
              </svg>
              {xp}XP
            </span>
          </div>
        )}

        {finished && (
          <div className="qc-nova-question">
            <span>Team Nova has completed its questions.</span>
          </div>
        )}

        {question && (
          <>
            <div className="qc-nova-question">
              <span>
                {roundQuestion}. {question.question}
              </span>
            </div>

            <div className={`qc-nova-board ${view === "result" ? "qc-nova-board-result" : ""}`}>
              {view === "question" ? (
                <>
                  <div className="qc-nova-options">
                    {question.options.map((option) => (
                      <button key={option.id} className={`qc-nova-option ${hidden.includes(option.id) ? "qc-nova-option-eliminated" : ""}`} type="button" disabled={!ready || finished || hidden.includes(option.id)} onClick={() => choose(option.id)}>
                        <span className="qc-nova-option-letter">{option.id}</span>
                        <span>{option.text}</span>
                        {hidden.includes(option.id) && (
                          <span className="qc-nova-option-cross" aria-label="Eliminated">
                            ✕
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="qc-nova-lifelines">
                    <button disabled={lifelines.blitz || !ready || finished} onClick={() => useLifeline("blitz")} type="button">
                      <span className="qc-nova-life qc-nova-life-blitz">
                        <span>30s</span>
                      </span>
                      <b>Blitz</b>
                    </button>
                    <button disabled={lifelines.boost || !ready || finished} onClick={() => useLifeline("boost")} type="button">
                      <span className="qc-nova-life qc-nova-life-boost">
                        <span>60s</span>
                      </span>
                      <b>Boost</b>
                    </button>
                    <button disabled={lifelines.split || !ready || finished} onClick={() => useLifeline("split")} type="button">
                      <span className="qc-nova-life qc-nova-life-split">
                        <span>50:50</span>
                      </span>
                      <b>Split</b>
                    </button>
                  </div>

                  {notice && (
                    <p className="qc-nova-notice" role="status">
                      {notice}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="qc-nova-rail qc-nova-rail-left">
                    <span className="qc-nova-rail-track">
                      <i />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-nova">
                      <SunMedium aria-hidden="true" />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-blue">
                      <LockMark />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-orange">
                      <LockMark />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-gold">
                      <span className="qc-nova-shield-spark">
                        <Flag aria-hidden="true" />
                        <small>Spark</small>
                      </span>
                    </span>
                  </div>

                  <div className="qc-nova-rail qc-nova-rail-right">
                    <span className="qc-nova-rail-track">
                      <i />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-blaze">
                      <Flame aria-hidden="true" />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-blue">
                      <LockMark />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-orange">
                      <LockMark />
                    </span>
                    <span className="qc-nova-shield qc-nova-shield-gold">
                      <LockMark />
                    </span>
                  </div>

                  <div className="qc-nova-total">
                    <span className="qc-nova-total-inner">
                      <strong>Total</strong>
                      <span>{xp} XP</span>
                    </span>
                  </div>

                  <div className="qc-nova-result-center">
                    <div className="qc-nova-selected">
                      <span className="qc-nova-option-letter">{selected}</span>
                      {question.options.find((o) => o.id === selected)?.text}
                    </div>
                    <div className="qc-nova-fact">
                      <div>DID YOU KNOW ?</div>
                      <p>{question.explanation}</p>
                    </div>

                    <div className={`qc-nova-result-label ${isCorrect ? "qc-nova-success" : "qc-nova-failure"}`}>
                      <ResultMark correct={isCorrect} />
                      {isCorrect ? `Great Work Team Nova Earns ${earned} XP` : "No XP this time for Team Nova"}
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
