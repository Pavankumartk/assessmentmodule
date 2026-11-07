"use client";
import { quantumPlayerStorage as localStorage } from "../lib/player-storage";


import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getStartingTeam } from "../lib/lobby";
import { startNewGame } from "../lib/game-engine";
import type { Team } from "../data/questions";
import "./choose-game-mode.css";

type GameMode = "full" | "quick";

const embers = Array.from({ length: 12 }, (_, i) => i);

export default function ChooseGameMode() {
  const router = useRouter();

  const handleSelectMode = (mode: GameMode) => {
    const registeredTeam = getStartingTeam();

    const storedTeam = localStorage.getItem("qcFirstRegisteredTeam");

    const firstTeam: Team = registeredTeam === "nova" || registeredTeam === "blaze" ? registeredTeam : storedTeam === "blaze" ? "blaze" : "nova";

    const nextRoute = startNewGame(mode, firstTeam);

    localStorage.setItem("qcInstructionsCompleted", "false");

    if (mode === "quick") {
      router.push(nextRoute);
      return;
    }

    router.push("/quantum-champs-player/game-instructions");
  };

  return (
    <main className="qc-mode-root">
      <svg className="qc-mode-defs" aria-hidden="true">
        <defs>
          <linearGradient id="qcModeFull" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#67096e" />
            <stop offset="1" stopColor="#248181" />
          </linearGradient>
          <linearGradient id="qcModeQuick" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#e01e5a" />
            <stop offset="1" stopColor="#5a2808" />
          </linearGradient>
        </defs>
      </svg>

      <div className="qc-mode-container">
        <div className="qc-mode-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-mode-logo" aria-label="Quantum Champ">
          <svg className="qc-mode-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcModeGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcModeDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcModeGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcModeDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcModeDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcModeDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-mode-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        <div className="qc-mode-column">
          <div className="qc-mode-heading">
            <h1 className="qc-mode-heading-text">CHOOSE YOUR GAME MODE</h1>
          </div>

          <div className="qc-mode-cards">
            <button type="button" className="qc-mode-card qc-mode-full" onClick={() => handleSelectMode("full")}>
              <span className="qc-mode-card-ring" aria-hidden="true" />
              <span className="qc-mode-card-inner">
                <span className="qc-mode-icon-circle">
                  <svg className="qc-mode-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2.2 13.59 6.02 17.71 6.35 14.57 9.03 15.53 13.05 12 10.9 8.47 13.05 9.43 9.03 6.29 6.35 10.41 6.02Z" stroke="url(#qcModeFull)" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M12 13.2V18M8 22v-2.5a1.5 1.5 0 0 1 1.5-1.5h5a1.5 1.5 0 0 1 1.5 1.5V22M6 22h12" stroke="url(#qcModeFull)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>

                <span className="qc-mode-title">FULL QUEST</span>

                <span className="qc-mode-description">Complete the AI challenge</span>

                <span className="qc-mode-badges">
                  <span className="qc-mode-badge">ROUND 1 + 2</span>

                  <span className="qc-mode-badge">9 QUESTIONS</span>
                </span>
              </span>
            </button>

            <button type="button" className="qc-mode-card qc-mode-quick" onClick={() => handleSelectMode("quick")}>
              <span className="qc-mode-card-ring" aria-hidden="true" />
              <span className="qc-mode-card-inner">
                <span className="qc-mode-icon-circle">
                  <svg className="qc-mode-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" stroke="url(#qcModeQuick)" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </span>

                <span className="qc-mode-title">QUICK QUEST</span>

                <span className="qc-mode-description">Jump straight into the action</span>

                <span className="qc-mode-badges">
                  <span className="qc-mode-badge">ROUND 2</span>

                  <span className="qc-mode-badge">9 QUESTIONS</span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
