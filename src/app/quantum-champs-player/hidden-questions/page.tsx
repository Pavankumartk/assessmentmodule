"use client";

import { Flag, Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { getCurrentQuestion, getCurrentQuestionRoute, getCurrentTeam, getGameMode, getTeamProgress, isLifelineUsed, submitAnswer, advanceToNextQuestion, useLifeline as markLifelineUsed } from "../lib/game-engine";
import type { HiddenQuestion, Team } from "../data/questions";
import "../nova-questions/nova-questions.css";
import "../blaze-questions/blaze-questions.css";
import "./hidden-questions.css";

const ROOT = "/quantum-champs-player";
const ASSETS = "/assessmenticons/";
const WAIT_MS = 10000;
type LifelineType = "blitz" | "boost" | "split";


const embers = Array.from({ length: 12 }, (_, i) => i);

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

function HiddenQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTeam = searchParams.get("team");
  const [team, setTeam] = useState<Team>("nova");
  const [question, setQuestion] = useState<HiddenQuestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [xp, setXp] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(2);
  const [lifelines, setLifelines] = useState({ blitz: false, boost: false, split: false });
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [earned, setEarned] = useState(0);
  const [correct, setCorrect] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    const actualTeam: Team = requestedTeam === "blaze" || requestedTeam === "nova" ? requestedTeam : getCurrentTeam();
    if (getCurrentTeam() !== actualTeam) {
      router.replace(getCurrentQuestionRoute(getCurrentTeam()));
      return;
    }
    const current = getCurrentQuestion(actualTeam);
    if (!current || current.type !== "hidden") {
      router.replace(getCurrentQuestionRoute(actualTeam));
      return;
    }
    const progress = getTeamProgress(actualTeam);
    const mode = getGameMode();
    setTeam(actualTeam);
    setQuestion(current);
    setXp(progress.xp);
    setQuestionNumber(mode === "quick" ? progress.index + 1 : (progress.index % 3) + 1);
    setLifelines({
      blitz: isLifelineUsed(actualTeam, "blitz"),
      boost: isLifelineUsed(actualTeam, "boost"),
      split: isLifelineUsed(actualTeam, "split"),
    });
    try {
      const saved = JSON.parse(localStorage.getItem(`qcSplitOptions:${actualTeam}:${current.id}`) || "[]");
      setEliminated(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setEliminated([]);
    }
    setSelected([]);
    setRevealed(false);
    setHint(false);
    setEarned(0);
    setCorrect(false);
    setFailedImages([]);
    locked.current = false;
    setReady(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [requestedTeam, router]);

  const choose = (id: string) => {
    if (!ready || !question || locked.current || revealed || selected.includes(id) || eliminated.includes(id)) return;
    if (getCurrentTeam() !== team || selected.length >= question.selectionLimit) return;
    const choices = [...selected, id];
    setSelected(choices);
    if (choices.length !== question.selectionLimit) return;

    locked.current = true;
    const result = submitAnswer(team, question.id, choices);
    if (result.alreadyAnswered) {
      router.replace(advanceToNextQuestion(team));
      return;
    }
    const valid = result.correct;
    setCorrect(valid);
    setEarned(result.earnedXP);
    setXp(result.totalXP);
    setRevealed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (getCurrentTeam() !== team) return;
      router.replace(advanceToNextQuestion(team));
    }, WAIT_MS);
  };

  const activateLifeline = (type: LifelineType) => {
    if (!question || !ready || revealed || locked.current || getCurrentTeam() !== team) return;
    if (lifelines[type] || isLifelineUsed(team, type)) {
      setLifelines((prev) => ({ ...prev, [type]: true }));
      return;
    }
    if (type === "split") {
      const wrong = question.tiles
        .filter((tile) => !tile.isCorrect && !selected.includes(tile.id))
        .slice(0, 2)
        .map((tile) => tile.id);
      if (!wrong.length || !markLifelineUsed(team, "split")) return;
      localStorage.setItem(`qcSplitOptions:${team}:${question.id}`, JSON.stringify(wrong));
      setEliminated(wrong);
      setLifelines((prev) => ({ ...prev, split: true }));
      return;
    }
    if (!markLifelineUsed(team, type)) return;
    setLifelines((prev) => ({ ...prev, [type]: true }));
    router.push(`${ROOT}/lifeline?team=${team}&type=${type}`);
  };

  const p = `qc-${team}`;
  const teamName = team === "nova" ? "Nova" : "Blaze";
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

  if (!question) return <main className={`${p}-root hq-root ${fredoka.variable}`} />;

  return (
    <main className={`${p}-root hq-root ${fredoka.variable}`}>
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
              <linearGradient id="hqGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="hqDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#hqGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#hqDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#hqDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#hqDot)" />
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
            {xp}XP
          </span>
        </div>

        <div className={`${p}-question`}>
          <span>
            {questionNumber}. {question.question}
          </span>
        </div>

        <div className={`${p}-board hq-board ${revealed ? `${p}-board-result hq-reveal` : ""}`}>
          {revealed && (
            <>
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
                  <span>{xp} XP</span>
                </span>
              </div>
              <div className={`${p}-total hq-total-right`}>
                <span className={`${p}-total-inner`}>
                  <strong>Total</strong>
                  <span>{getTeamProgress(team === "nova" ? "blaze" : "nova").xp} XP</span>
                </span>
              </div>
            </>
          )}

          <div className="hq-tiles">
            {question.tiles.map((tile, i) => {
              const imagePath = tile.image || `${ASSETS}hidden-answer-${i + 1}.png`;
              const showImage = !revealed && !failedImages.includes(tile.id);
              return (
                <button key={tile.id} type="button" disabled={!ready || getCurrentTeam() !== team || revealed || selected.includes(tile.id) || eliminated.includes(tile.id)} className={`hq-tile ${revealed ? "is-revealed" : ""} ${selected.includes(tile.id) ? "is-selected" : ""} ${eliminated.includes(tile.id) ? "is-eliminated" : ""}`} onClick={() => choose(tile.id)} aria-label={revealed ? `${tile.id}: ${tile.text}` : `Select hidden answer ${i + 1}`} aria-pressed={selected.includes(tile.id)}>
                  {revealed ? (
                    <>
                      <span className={`${p}-option-letter`}>{String.fromCharCode(97 + i)}</span>
                      <span className="hq-answer">{tile.text}</span>
                    </>
                  ) : showImage ? (
                    <img src={imagePath} alt={`Hidden choice ${i + 1}`} className="hq-tile-image" onError={() => setFailedImages((prev) => [...prev, tile.id])} />
                  ) : (
                    <span className="hq-tile-symbol">
                      <span>✦</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hq-row">
            {!revealed && (
              <button type="button" className="hq-hint" onClick={() => setHint((v) => !v)}>
                <span className="hq-hint-dot" aria-hidden="true" />
                {hint ? "Hide Hint" : "Reveal Hint"}
              </button>
            )}
            {hint && !revealed && <p className="hq-hint-text">{question.hint || "Choose three correct answers."}</p>}
            {revealed && (
              <p className={`${p}-result-label ${correct ? `${p}-success` : `${p}-failure`} hq-result`} role="status">
                <ResultMark correct={correct} />
                {correct ? `Great Work Team ${teamName} Earns ${earned} XP` : `No XP this time for Team ${teamName}`}
              </p>
            )}
          </div>

          <div className={`${p}-lifelines hq-lifelines`}>
            <button type="button" className={lifelines.blitz ? "is-used" : ""} disabled={!ready || revealed || locked.current || getCurrentTeam() !== team || lifelines.blitz} onClick={() => activateLifeline("blitz")}>
              <span className={`${p}-life ${p}-life-blitz`}>
                <span>30s</span>
              </span>
              <b>Blitz</b>
            </button>
            <button type="button" className={lifelines.boost ? "is-used" : ""} disabled={!ready || revealed || locked.current || getCurrentTeam() !== team || lifelines.boost} onClick={() => activateLifeline("boost")}>
              <span className={`${p}-life ${p}-life-boost`}>
                <span>60s</span>
              </span>
              <b>Boost</b>
            </button>
            <button type="button" className={lifelines.split ? "is-used" : ""} disabled={!ready || revealed || locked.current || getCurrentTeam() !== team || lifelines.split} onClick={() => activateLifeline("split")}>
              <span className={`${p}-life ${p}-life-split`}>
                <span>50:50</span>
              </span>
              <b>Split</b>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HiddenQuestionsPage() {
  return (
    <Suspense fallback={null}>
      <HiddenQuestionsContent />
    </Suspense>
  );
}