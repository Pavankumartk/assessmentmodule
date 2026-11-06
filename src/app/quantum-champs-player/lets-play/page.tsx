"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import "./lets-play.css";

const embers = Array.from({ length: 12 }, (_, i) => i);

export default function LetsPlay() {
  const router = useRouter();

  return (
    <main className="qc-lets-root">
      <div className="qc-lets-container">
        <div className="qc-lets-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-lets-logo" aria-label="Quantum Champ">
          <svg className="qc-lets-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcLetsGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcLetsDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcLetsGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcLetsDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcLetsDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcLetsDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-lets-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        <section className="qc-lets-stage">
          <div className="qc-lets-hexagon">
            <div className="qc-lets-hexagon-inner" />
          </div>

          <button type="button" className="qc-lets-button-shell" onClick={() => router.push("/quantum-champs-player/choose-game-mode")}>
            <span className="qc-lets-button">LETS PLAY</span>
          </button>
        </section>
      </div>
    </main>
  );
}
