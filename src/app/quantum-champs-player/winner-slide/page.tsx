"use client";
import { quantumPlayerStorage as localStorage } from "../lib/player-storage";


import { Suspense, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, Medal, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import "./winner-slide.css";



type Team = "nova" | "blaze";

type ConfettiPiece = {
  left: string;
  top: string;
  color: string;
  rotation: string;
  delay: string;
  duration: string;
  size: string;
  shape: "piece" | "star" | "ribbon";
};

const confettiColors = ["#ad59e6", "#e4bc4a", "#51ca74", "#55b5e9", "#f26b72", "#7576d6", "#f39a49"];

const SHIELD_PATH = "M50 0 C65 0 85 11 96 17 C99 19 100 21 100 25 L100 53 C100 75 80 90 51 99.5 C50.3 100 49.7 100 49 99.5 C20 90 0 75 0 53 L0 25 C0 21 1 19 4 17 C15 11 35 0 50 0 Z";

const seeded = (seed: number) => {
  const n = Math.sin(seed * 91.7 + 13.37) * 43758.5453;
  return n - Math.floor(n);
};

const cannonPieces = Array.from({ length: 70 }, (_, i) => {
  const fromLeft = i % 2 === 0;

  return {
    fromLeft,
    dx: ((fromLeft ? 1 : -1) * (220 + seeded(i + 1) * 640)).toFixed(1),
    peak: (300 + seeded(i + 101) * 340).toFixed(1),
    fall: (140 + seeded(i + 201) * 180).toFixed(1),
    delay: (seeded(i + 301) * 3).toFixed(2),
    duration: (2.6 + seeded(i + 401) * 1.4).toFixed(2),
    size: (8 + seeded(i + 501) * 9).toFixed(1),
    flip: (0.5 + seeded(i + 601) * 0.9).toFixed(2),
    color: confettiColors[i % confettiColors.length],
    round: i % 3 === 0,
  };
});

const fireworks = [
  { x: "16%", y: "30%", delay: "0s", color: "#f39a49" },
  { x: "84%", y: "26%", delay: "1.1s", color: "#55b5e9" },
  { x: "24%", y: "68%", delay: "2.2s", color: "#f26b72" },
  { x: "78%", y: "64%", delay: "3.3s", color: "#e4bc4a" },
];

function WinnerContent() {
  const params = useSearchParams();

  const [stored, setStored] = useState({
    nova: 0,
    blaze: 0,
  });

  const [celebrating, setCelebrating] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const getXP = (team: Team) => {
      const prefix = team === "nova" ? "qcNova" : "qcBlaze";
      const savedXP = localStorage.getItem(`${prefix}XP`);

      if (savedXP !== null) {
        const direct = Number(savedXP);

        if (Number.isFinite(direct) && direct >= 0) {
          return direct;
        }
      }

      try {
        const progress = JSON.parse(localStorage.getItem(`${prefix}Progress`) || "null");

        return Number.isFinite(progress?.xp) ? progress.xp : 0;
      } catch {
        return 0;
      }
    };

    setStored({
      nova: getXP("nova"),
      blaze: getXP("blaze"),
    });

    const random = (seed: number) => {
      const n = Math.sin(seed * 127.1 + 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const fixed = (value: number) => value.toFixed(3);

    const pieces: ConfettiPiece[] = Array.from({ length: 160 }, (_, i) => ({
      left: `${fixed(random(i + 1) * 100)}%`,
      top: `${fixed(random(i + 151) * 100)}%`,
      color: confettiColors[i % confettiColors.length],
      rotation: `${fixed(random(i + 301) * 360)}deg`,
      delay: `${fixed(-random(i + 451) * 9)}s`,
      duration: `${fixed(5 + random(i + 601) * 7)}s`,
      size: fixed(6 + random(i + 751) * 10),
      shape: i % 11 === 0 ? "star" : i % 7 === 0 ? "ribbon" : "piece",
    }));

    setConfetti(pieces);
    setCelebrating(true);
  }, []);

  const requested = params.get("team");

  const winner: Team = requested === "nova" || requested === "blaze" ? requested : stored.blaze > stored.nova ? "blaze" : "nova";

  const name = winner === "nova" ? "Nova" : "Blaze";

  const overrideXP = params.get("xp");

  const xp = overrideXP !== null && overrideXP.trim() !== "" && Number.isFinite(Number(overrideXP)) ? Math.max(0, Number(overrideXP)) : stored[winner];

  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!celebrating) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(xp);
      return;
    }

    const start = performance.now() + 900;
    const duration = 1800;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      setShown(Math.round(xp * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [celebrating, xp]);

  const burstPieces = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      angle: `${(360 / 48) * i}deg`,
      distance: 150 + (i % 5) * 40,
      delay: `${((i % 6) * 0.035).toFixed(3)}s`,
      color: confettiColors[i % confettiColors.length],
      size: 6 + (i % 4) * 2,
    }));
  }, []);

  const Icon = winner === "nova" ? SunMedium : Flame;

  return (
    <main className={`qc-winner-page qc-winner-${winner} ${fredoka.variable} ${celebrating ? "qc-winner-celebrating" : ""}`}>
      <div className="qc-winner-panel">
        <div className="qc-winner-pattern" aria-hidden="true" />

        <div className="qc-winner-glow" aria-hidden="true" />
        <div className="qc-winner-rays" aria-hidden="true" />
        <span className="qc-winner-ring" aria-hidden="true" />
        <span className="qc-winner-ring qc-winner-ring-2" aria-hidden="true" />
        <span className="qc-winner-ring qc-winner-ring-3" aria-hidden="true" />

        {fireworks.map((f, i) => (
          <div
            key={i}
            className="qc-winner-firework"
            aria-hidden="true"
            style={
              {
                left: f.x,
                top: f.y,
                "--fw-delay": f.delay,
                "--fw-color": f.color,
              } as CSSProperties
            }>
            {Array.from({ length: 18 }, (_, s) => (
              <span
                key={s}
                style={
                  {
                    "--fw-angle": `${s * 20}deg`,
                    "--fw-dist": s % 2 ? 95 : 140,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ))}

        <div className="qc-winner-cannons" aria-hidden="true">
          {cannonPieces.map((p, i) => (
            <span
              key={i}
              className={`qc-winner-shot ${p.round ? "qc-winner-shot-round" : ""}`}
              style={
                {
                  left: p.fromLeft ? "1%" : "99%",
                  "--dx": p.dx,
                  "--peak": p.peak,
                  "--fall": p.fall,
                  "--size": p.size,
                  "--color": p.color,
                  "--dur": `${p.duration}s`,
                  "--delay": `${p.delay}s`,
                  "--flip": `${p.flip}s`,
                } as CSSProperties
              }>
              <i />
            </span>
          ))}
        </div>

        <div className="qc-winner-confetti" aria-hidden="true">
          {confetti.map((piece, i) => (
            <i
              key={i}
              className={`qc-winner-piece qc-winner-${piece.shape}`}
              style={{
                left: piece.left,
                top: piece.top,
                backgroundColor: piece.shape === "ribbon" ? "transparent" : piece.color,
                borderColor: piece.color,
                width: `calc(${piece.size} * var(--u))`,
                height: piece.shape === "ribbon" ? "calc(33 * var(--u))" : `calc(${piece.size} * var(--u))`,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                transform: `rotate(${piece.rotation})`,
              }}
            />
          ))}
        </div>

        <div className="qc-winner-burst" aria-hidden="true">
          {burstPieces.map((piece, i) => (
            <span
              key={i}
              className="qc-winner-burst-piece"
              style={
                {
                  "--burst-angle": piece.angle,
                  "--burst-distance": `calc(${piece.distance} * var(--u))`,
                  "--burst-delay": piece.delay,
                  "--burst-color": piece.color,
                  "--burst-size": `calc(${piece.size} * var(--u))`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="qc-winner-sparkles" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={`qc-winner-sparkle qc-winner-sparkle-${i + 1}`}>
              ✦
            </span>
          ))}
        </div>

        <section className="qc-winner-center" aria-label={`${name} wins with ${xp} XP`}>
          <h1>The Winner is</h1>

          <div className="qc-winner-shield">
            <svg className="qc-winner-shield-outer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={SHIELD_PATH} />
            </svg>

            <svg className="qc-winner-shield-inner" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="qc-winner-shield-grad" x1={winner === "nova" ? 0 : 0.15} y1="0" x2={winner === "nova" ? 0 : 0.85} y2="1">
                  <stop offset="0" style={{ stopColor: "var(--w-shield-a)" }} />
                  <stop offset="1" style={{ stopColor: "var(--w-shield-b)" }} />
                </linearGradient>
                <linearGradient id="qc-winner-shine-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="qc-winner-shield-clip">
                  <path d={SHIELD_PATH} />
                </clipPath>
              </defs>
              <path d={SHIELD_PATH} fill="url(#qc-winner-shield-grad)" />
              <g clipPath="url(#qc-winner-shield-clip)">
                <g className="qc-winner-shine">
                  <rect x="-45" y="-20" width="30" height="140" fill="url(#qc-winner-shine-grad)" transform="skewX(-20)" />
                </g>
              </g>
            </svg>

            <div className="qc-winner-badge">
              <Icon className="qc-winner-icon" strokeWidth={winner === "nova" ? 2 : 1.5} aria-hidden="true" />
              <span>{name}</span>
            </div>
          </div>

          <div className="qc-winner-xp">{shown.toLocaleString("en-US")} XP</div>

          <div className="qc-winner-rank">
            <span className="qc-winner-rank-ellipse" />
            <div className="qc-winner-rank-body">
              <div className="qc-winner-rank-row">
                <Medal className="qc-winner-medal" aria-hidden="true" />
                <span>Rank Unlocked</span>
              </div>
              <strong>AI Titan</strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function WinnerSlidePage() {
  return (
    <Suspense fallback={<main className="qc-winner-page" />}>
      <WinnerContent />
    </Suspense>
  );
}
