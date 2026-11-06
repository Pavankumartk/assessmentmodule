"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import "./ai-essentials.css";

const embers = Array.from({ length: 12 }, (_, i) => i);

const POINTS = ["Learn ML, Gen AI, and prompt design in a fun team format.", "One session builds practical AI skills for everyday use.", "Build confidence using AI safely and effectively."];

export default function AIEssentials() {
  const router = useRouter();

  return (
    <main className="qc-ai-root">
      <svg className="qc-ai-defs" aria-hidden="true">
        <defs>
          <linearGradient id="qcAiBadge" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#67096e" />
            <stop offset="1" stopColor="#e01e5a" />
          </linearGradient>
        </defs>
      </svg>

      <div className="qc-ai-container">
        <div className="qc-ai-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-ai-logo" aria-label="Quantum Champ">
          <svg className="qc-ai-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcAiGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcAiDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcAiGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcAiDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcAiDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcAiDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-ai-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        <div className="qc-ai-column">
          <div className="qc-ai-title-wrap">
            <h1 className="qc-ai-title">AI Essentials at a Glance</h1>
          </div>

          <section className="qc-ai-card">
            <div className="qc-ai-card-content">
              <h2 className="qc-ai-card-heading">What makes this course different?</h2>

              <div className="qc-ai-points">
                {POINTS.map((point) => (
                  <div key={point} className="qc-ai-point">
                    <span className="qc-ai-check" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" stroke="url(#qcAiBadge)" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="m16 9-5.5 5.5L8 12" stroke="url(#qcAiBadge)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <h3 className="qc-ai-highlight">AI Learning! Made Fun &amp; Social</h3>

              <p className="qc-ai-description">Covers ML, GenAI, prompting &amp; responsible AI. Updated every 8 months.</p>
            </div>
          </section>

          <button type="button" className="qc-ai-next" onClick={() => router.push("/quantum-champs-player/lets-play")}>
            <span>Next</span>
          </button>
        </div>
      </div>
    </main>
  );
}
