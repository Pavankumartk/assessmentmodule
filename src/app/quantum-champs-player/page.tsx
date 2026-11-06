"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import "./player.css";

const embers = Array.from({ length: 12 }, (_, i) => i);
const waves = [0, 1, 2];

export default function QuantumChampsWelcome() {
  const router = useRouter();

  return (
    <main className="qp-welcome-root">
      <section className="qp-welcome-panel" aria-label="Quantum Champs welcome">
        <div className="qp-welcome-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>
        <div className="qp-welcome-content">
          <div className="qp-welcome-orbit" aria-label="Quantum Champ">
            {waves.map((d) => (
              <span key={d} className="qp-welcome-hexwave" style={{ "--d": d } as CSSProperties} aria-hidden="true" />
            ))}
            <div className="qp-welcome-logo">
              <svg className="qp-welcome-crown" viewBox="0 0 124 91" aria-hidden="true">
                <defs>
                  <linearGradient id="qpCrownGold" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#c05512" />
                    <stop offset=".29" stopColor="#e3cb48" />
                    <stop offset=".5" stopColor="#ca8b30" />
                    <stop offset=".94" stopColor="#e3cb48" />
                  </linearGradient>
                  <linearGradient id="qpCrownDot" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#2d4cc8" />
                    <stop offset="1" stopColor="#e01e5a" />
                  </linearGradient>
                </defs>
                <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qpCrownGold)" />
                <circle cx="9" cy="23" r="5" fill="url(#qpCrownDot)" />
                <circle cx="62" cy="7" r="5" fill="url(#qpCrownDot)" />
                <circle cx="115" cy="23" r="5" fill="url(#qpCrownDot)" />
                <circle cx="62" cy="52" r="2" fill="#67096e" />
              </svg>
              <div className="qp-welcome-shield">
                Quantum
                <br />
                Champ
              </div>
            </div>
          </div>
          <h1 className="qp-welcome-title">Play Smart! Rise to Glory</h1>
          <button className="qp-welcome-button" type="button" onClick={() => router.push("/quantum-champs-player/access-code")}>
            <span>Are you Ready?</span>
          </button>
        </div>
      </section>
    </main>
  );
}
