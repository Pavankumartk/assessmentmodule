"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter } from "next/navigation";
import { getStartingTeam } from "../lib/lobby";
import { startNewGame, startRoundTwo } from "../lib/game-engine";
import type { Team } from "../data/questions";
import "./game-instructions.css";


const embers = Array.from({ length: 12 }, (_, i) => i);

const SHIELD_OUTER = "M77.5 2Q115 14 147 16Q153 17 153 23V80Q153 140 77.5 172Q2 140 2 80V23Q2 17 8 16Q40 14 77.5 2Z";
const SHIELD_INNER = "M61.5 0Q91 10 117 12Q123 13 123 19V62Q123 110 61.5 137Q0 110 0 62V19Q0 13 6 12Q32 10 61.5 0Z";
const PANEL = "M24 64H112Q120 64 124 57L150 8Q154 0 164 0H342Q352 0 356 8L382 57Q386 64 394 64H482Q506 64 506 88V156Q506 180 482 180H24Q0 180 0 156V88Q0 64 24 64Z";
const FIREWORK = "M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2";

function ShieldBadge({ team }: { team: "nova" | "blaze" }) {
  return (
    <svg className="qc-ins-mini-shield" viewBox="0 0 123 137" preserveAspectRatio="none" aria-hidden="true">
      <path d={SHIELD_INNER} fill={team === "nova" ? "url(#qcInsNova)" : "url(#qcInsBlaze)"} />
    </svg>
  );
}

export default function GameInstructions() {
  const router = useRouter();
  const [showInstructions, setShowInstructions] = useState(false);

  const quickStartHandled = useRef(false);

  const normalizeTeam = (value: string | null): Team | null => {
    const team = value?.trim().toLowerCase();
    if (team === "nova" || team === "team nova" || team === "qc-team-001") return "nova";
    if (team === "blaze" || team === "team blaze" || team === "qc-team-002") return "blaze";
    return null;
  };

  const getRegisteredFirstTeam = (): Team | null => normalizeTeam(getStartingTeam()) ?? normalizeTeam(localStorage.getItem("qcFirstRegisteredTeam")) ?? normalizeTeam(localStorage.getItem("qcCurrentTeam"));

  useEffect(() => {
    if (localStorage.getItem("qcGameMode") !== "quick") {
      setShowInstructions(true);
      return;
    }

    if (quickStartHandled.current) return;
    quickStartHandled.current = true;

    const firstTeam = getRegisteredFirstTeam();
    if (!firstTeam) {
      router.replace("/quantum-champs-player/choose-game-mode");
      return;
    }

    resetLifelinesForNewGame();
    startNewGame("quick", firstTeam);
    localStorage.setItem("qcInstructionsCompleted", "true");
    router.replace(startRoundTwo());
  }, [router]);

  const resetLifelinesForNewGame = () => {
    const teams = ["nova", "blaze"];
    const lifelines = ["blitz", "boost", "split"];

    teams.forEach((team) => {
      lifelines.forEach((lifeline) => {
        localStorage.removeItem(`qcLifelineUsed:${team}:${lifeline}`);

        sessionStorage.removeItem(`qcLifelineDeadline:${team}:${lifeline}`);
      });
    });

    const prefixes = ["qcLifelineHidden:", "qcSplitOptions:"];

    [localStorage, sessionStorage].forEach((storage) => {
      const keysToRemove: string[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        storage.removeItem(key);
      });
    });
  };

  const handleStartGame = () => {
    const selectedMode = localStorage.getItem("qcGameMode");

    if (selectedMode !== "full" && selectedMode !== "quick") {
      router.push("/quantum-champs-player/choose-game-mode");
      return;
    }

    const firstTeam = getRegisteredFirstTeam();

    if (!firstTeam) {
      alert("Team registration information was not found. Please complete team registration before starting the game.");
      return;
    }

    resetLifelinesForNewGame();

    startNewGame(selectedMode, firstTeam);
    localStorage.setItem("qcInstructionsCompleted", "true");

    if (selectedMode === "quick") {
      router.push(startRoundTwo());
      return;
    }

    router.push(firstTeam === "nova" ? "/quantum-champs-player/nova-questions" : "/quantum-champs-player/blaze-questions");
  };

  if (!showInstructions) return null;

  return (
    <main className={`qc-ins-root ${fredoka.variable}`}>
      <svg className="qc-ins-defs" aria-hidden="true">
        <defs>
          <linearGradient id="qcInsNova" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#67096e" />
            <stop offset="1" stopColor="#248181" />
          </linearGradient>
          <linearGradient id="qcInsBlaze" x1="0.2" x2="0.8" y1="0" y2="1">
            <stop offset="0.04" stopColor="#5a2808" />
            <stop offset="0.87" stopColor="#e01e5a" />
          </linearGradient>
          <linearGradient id="qcInsPad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#67096e" />
            <stop offset="1" stopColor="#e01e5a" />
          </linearGradient>
          <linearGradient id="qcInsRim" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c4c4c4" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="qcInsBulb" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#2d4cc8" />
            <stop offset="1" stopColor="#67096e" />
          </linearGradient>
          <linearGradient id="qcInsGoldCup" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d5c14f" />
            <stop offset="1" stopColor="#afa04a" />
          </linearGradient>
          <pattern id="qcInsTri" width="32" height="40" patternUnits="userSpaceOnUse">
            <image href="/quantum-champs/instructions-pattern.png" width="32" height="40" opacity="0.2" />
          </pattern>
        </defs>
      </svg>

      <div className="qc-ins-container">
        <div className="qc-ins-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-ins-logo" aria-label="Quantum Champ">
          <svg className="qc-ins-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcInsGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcInsDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcInsGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcInsDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcInsDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcInsDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-ins-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        <div className="qc-ins-column">
          <header className="qc-ins-top">
            <div className="qc-ins-shield qc-ins-shield-nova">
              <svg className="qc-ins-shield-outer" viewBox="0 0 155 176" aria-hidden="true">
                <path d={SHIELD_OUTER} fill="#dfe6e9" stroke="url(#qcInsRim)" strokeWidth="2" />
              </svg>
              <svg className="qc-ins-shield-inner" viewBox="0 0 123 137" aria-hidden="true">
                <path d={SHIELD_INNER} fill="url(#qcInsNova)" />
              </svg>
              <div className="qc-ins-shield-text">
                <SunMedium className="qc-ins-shield-icon qc-ins-icon-sun" aria-hidden="true" />
                <span className="qc-ins-shield-team">Team</span>
                <span className="qc-ins-shield-name">Nova</span>
              </div>
            </div>

            <div className="qc-ins-panel">
              <svg className="qc-ins-panel-bg" viewBox="0 0 506 180" preserveAspectRatio="none" aria-hidden="true">
                <path d={PANEL} fill="#dfe6e9" />
                <path d={PANEL} fill="url(#qcInsTri)" />
                <path d={PANEL} fill="none" stroke="url(#qcInsRim)" strokeWidth="3" />
              </svg>
              <div className="qc-ins-panel-content">
                <svg className="qc-ins-pad" viewBox="0 0 60 42" aria-hidden="true">
                  <path d="M14 2H46Q58 2 59 16L60 32Q60 42 51 40Q46 39 42 32H18Q14 39 9 40Q0 42 0 32L1 16Q2 2 14 2Z" fill="url(#qcInsPad)" />
                  <path d="M18.5 9.5V21M12.75 15.25H24.25" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="46.5" cy="11.5" r="1.75" fill="#dfe6e9" />
                  <circle cx="39" cy="19.5" r="1.75" fill="#ffffff" />
                </svg>
                <h1 className="qc-ins-title">GAME INSTRUCTIONS</h1>
                <div className="qc-ins-subtitle">
                  <span>Team up</span>
                  <span className="qc-ins-dot">•</span>
                  <span>Answer</span>
                  <span className="qc-ins-dot">•</span>
                  <span>Earn XP</span>
                  <span className="qc-ins-dot">•</span>
                  <span>Win!</span>
                </div>
              </div>
            </div>

            <div className="qc-ins-shield qc-ins-shield-blaze">
              <svg className="qc-ins-shield-outer" viewBox="0 0 155 176" aria-hidden="true">
                <path d={SHIELD_OUTER} fill="#dfe6e9" stroke="url(#qcInsRim)" strokeWidth="2" />
              </svg>
              <svg className="qc-ins-shield-inner" viewBox="0 0 123 137" aria-hidden="true">
                <path d={SHIELD_INNER} fill="url(#qcInsBlaze)" />
              </svg>
              <div className="qc-ins-shield-text">
                <Flame className="qc-ins-shield-icon qc-ins-icon-fire" aria-hidden="true" />
                <span className="qc-ins-shield-team">Team</span>
                <span className="qc-ins-shield-name">Blaze</span>
              </div>
            </div>
          </header>

          <div className="qc-ins-cards">
            <section className="qc-ins-card">
              <span className="qc-ins-number">1</span>
              <h2 className="qc-ins-card-title">Pick Your Team</h2>
              <p className="qc-ins-card-text">Split into Team Nova and Team Blaze</p>
              <div className="qc-ins-teams">
                <span className="qc-ins-mini">
                  <ShieldBadge team="nova" />
                  <SunMedium className="qc-ins-mini-icon qc-ins-icon-sun" aria-hidden="true" />
                </span>
                <span className="qc-ins-vs">
                  <span>VS</span>
                </span>
                <span className="qc-ins-mini">
                  <ShieldBadge team="blaze" />
                  <Flame className="qc-ins-mini-icon qc-ins-icon-fire" aria-hidden="true" />
                </span>
              </div>
            </section>

            <section className="qc-ins-card">
              <span className="qc-ins-number">2</span>
              <h2 className="qc-ins-card-title">Earn XP</h2>
              <p className="qc-ins-card-text">Beat the Question! Boost Your XP Power</p>
              <div className="qc-ins-xp">
                <span className="qc-ins-xp-hex">XP</span>
                {["a", "b", "c"].map((f) => (
                  <svg key={f} className={`qc-ins-firework qc-ins-firework-${f}`} viewBox="0 0 16 16" aria-hidden="true">
                    <path d={FIREWORK} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                ))}
              </div>
            </section>

            <section className="qc-ins-card">
              <span className="qc-ins-number">3</span>
              <h2 className="qc-ins-card-title">Lifelines</h2>
              <p className="qc-ins-card-text">Each Team Gets 3 Lifelines Use Them Wisely</p>
              <div className="qc-ins-lifelines">
                <div className="qc-ins-lifeline qc-ins-blitz">
                  <span className="qc-ins-lifeline-pill">30s</span>
                  <span className="qc-ins-lifeline-label">Blitz</span>
                </div>
                <div className="qc-ins-lifeline qc-ins-boost">
                  <span className="qc-ins-lifeline-pill">60s</span>
                  <span className="qc-ins-lifeline-label">Boost</span>
                </div>
                <div className="qc-ins-lifeline qc-ins-split">
                  <span className="qc-ins-lifeline-pill">50:50</span>
                  <span className="qc-ins-lifeline-label">Split</span>
                </div>
              </div>
            </section>
          </div>

          <div className="qc-ins-wide-row">
            <section className="qc-ins-wide">
              <span className="qc-ins-number">4</span>
              <div className="qc-ins-wide-text">
                <h2 className="qc-ins-wide-title">Scenario Questions</h2>
                <p className="qc-ins-wide-desc">Split into Team Nova and Team Blaze</p>
              </div>
              <svg className="qc-ins-wide-icon qc-ins-bulb" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 14.5c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 21.5h4M12 14.5v-4" stroke="url(#qcInsBulb)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 .8v1.2M4 3.6l.9.9M20 3.6l-.9.9M1 9h1.3M21.7 9H23" stroke="#e01e5a" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </section>

            <section className="qc-ins-wide">
              <span className="qc-ins-number">5</span>
              <div className="qc-ins-wide-text">
                <h2 className="qc-ins-wide-title">Your Goal</h2>
                <p className="qc-ins-wide-desc">
                  Reach 10,000 XP! Become <strong>AI Champion!</strong>
                </p>
              </div>
              <svg className="qc-ins-wide-icon qc-ins-trophy" viewBox="0 0 44 59" fill="none" aria-hidden="true">
                <path d="M8 6l2 3M15 2v4M22 4l-1 4M29 2l-1 3M36 5l-2 3M5 13l3 1M39 12l-3 2" stroke="#e01e5a" strokeWidth="1" strokeLinecap="round" />
                <circle cx="11" cy="3" r="1" fill="#2d4cc8" />
                <circle cx="33" cy="9" r="1" fill="#e3cb48" />
                <circle cx="19" cy="10" r="1" fill="#248181" />
                <circle cx="26" cy="11" r="0.9" fill="#67096e" />
                <path d="M13 19H31V30Q31 39 22 39Q13 39 13 30Z" fill="url(#qcInsGoldCup)" stroke="#67096e" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M13 22H9Q8 29 13 31M31 22H35Q36 29 31 31M22 39V46M17 50H27L25.5 46H18.5Z" stroke="#67096e" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M18 29l1.2-3.6 2.8 2 2.8-2L26 29Z" fill="#e01e5a" />
              </svg>
            </section>
          </div>

          <button type="button" className="qc-ins-start" onClick={handleStartGame}>
            <span>Start the Game</span>
          </button>
        </div>
      </div>
    </main>
  );
}
