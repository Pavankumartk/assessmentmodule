"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties } from "react";
import "./lifeline.css";

type Team = "nova" | "blaze";
type Lifeline = "blitz" | "boost";

const embers = Array.from({ length: 12 }, (_, i) => i);

function Countdown() {
  const router = useRouter();
  const params = useSearchParams();
  const team: Team = params.get("team") === "blaze" ? "blaze" : "nova";
  const type: Lifeline = params.get("type") === "boost" ? "boost" : "blitz";
  const duration = type === "boost" ? 60 : 30;
  const [remaining, setRemaining] = useState(duration);
  const destination = `/quantum-champs-player/${team}-questions`;

  useEffect(() => {
    const usedKey = `qcLifelineUsed:${team}:${type}`;
    const deadlineKey = `qcLifelineDeadline:${team}:${type}`;
    const activeTeam = localStorage.getItem("qcCurrentTeam");

    if (activeTeam !== team) {
      router.replace(`/quantum-champs-player/${activeTeam === "blaze" ? "blaze" : "nova"}-questions`);
      return;
    }

    const existingDeadline = Number(sessionStorage.getItem(deadlineKey));

    if (localStorage.getItem(usedKey) === "1" && !existingDeadline) {
      router.replace(destination);
      return;
    }

    const deadline = existingDeadline > 0 ? existingDeadline : Date.now() + duration * 1000;

    sessionStorage.setItem(deadlineKey, String(deadline));
    localStorage.setItem(usedKey, "1");

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

      setRemaining(seconds);

      if (seconds === 0) {
        sessionStorage.removeItem(deadlineKey);
        router.replace(destination);
      }
    };

    tick();

    const interval = window.setInterval(tick, 200);

    return () => window.clearInterval(interval);
  }, [destination, duration, router, team, type]);

  return (
    <main className={`qc-timer-page qc-timer-${team} qc-timer-${type}`}>
      <div className="qc-timer-shell">
        <div className="qc-timer-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <div className="qc-timer-logo" aria-label="Quantum Champ">
          <svg className="qc-timer-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
            <defs>
              <linearGradient id="qcTimerGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#c05512" />
                <stop offset=".29" stopColor="#e3cb48" />
                <stop offset=".5" stopColor="#ca8b30" />
                <stop offset=".94" stopColor="#e3cb48" />
              </linearGradient>
              <linearGradient id="qcTimerDot" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#2d4cc8" />
                <stop offset="1" stopColor="#e01e5a" />
              </linearGradient>
            </defs>
            <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcTimerGold)" />
            <circle cx="9" cy="23" r="5" fill="url(#qcTimerDot)" />
            <circle cx="62" cy="7" r="5" fill="url(#qcTimerDot)" />
            <circle cx="115" cy="23" r="5" fill="url(#qcTimerDot)" />
            <circle cx="62" cy="52" r="2" fill="#67096e" />
          </svg>
          <div className="qc-timer-logo-shield">
            Quantum
            <br />
            Champ
          </div>
        </div>

        <section className="qc-timer-panel" aria-label={`${duration} second ${type} countdown`}>
          <div className="qc-timer-ring" role="timer" aria-live="off" aria-label={`${remaining} seconds remaining`}>
            <span>{remaining} Sec</span>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LifelinePage() {
  return (
    <Suspense fallback={<main className="qc-timer-page" />}>
      <Countdown />
    </Suspense>
  );
}
