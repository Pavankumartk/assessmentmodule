"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Award, Brain, Flame, Sparkles, SunMedium, Trophy } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter } from "next/navigation";
import { current, findLobby, subscribe, type Lobby } from "../lib/lobby";
import "./game-mode.css";



type Topic = "Prompting" | "Machine Learning" | "Responsible AI";

const TOPICS: Topic[] = ["Prompting", "Machine Learning", "Responsible AI"];

const LEVELS = [
  { number: "1", title: "AI Spark", xp: "0 XP" },
  { number: "2", title: "AI Boost", xp: "4,000 XP" },
  { number: "3", title: "AI Elite", xp: "7,000 XP" },
  { number: "4", title: "AI Titan", xp: "10,000 XP" },
];

const fireworks = ["a", "b", "c", "d"];
const embers = Array.from({ length: 12 }, (_, i) => i);

export default function GameMode() {
  const router = useRouter();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [activeTopic, setActiveTopic] = useState<Topic>("Machine Learning");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = current();

    if (!session) {
      router.replace("/quantum-champs-player/access-code");
      return;
    }

    const refresh = () => {
      const next = findLobby(session.lobbyId);

      if (!next) {
        router.replace("/quantum-champs-player/access-code");
        return;
      }

      const allowed = session.teamId === next.hostTeam.id || session.teamId === next.guestTeam.id;

      if (!allowed) {
        router.replace("/quantum-champs-player/access-code");
        return;
      }

      if (next.status !== "ready") {
        router.replace("/quantum-champs-player/waiting");
        return;
      }

      setLobby(next);
      setLoaded(true);
    };

    refresh();

    return subscribe(refresh);
  }, [router]);

  const novaName = lobby?.hostTeam.name || "Nova";
  const blazeName = lobby?.guestTeam.name || "Blaze";

  function getStarted() {
    router.push("/quantum-champs-player/ai-essentials");
  }

  if (!loaded) {
    return <main className={`qc-gm-root ${fredoka.variable}`} />;
  }

  return (
    <main className={`qc-gm-root ${fredoka.variable}`}>
      <div className="qc-gm-container">
        <div className="qc-gm-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>

        <header className="qc-gm-header">
          <div className="qc-gm-logo" aria-label="Quantum Champ">
            <svg className="qc-gm-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
              <defs>
                <linearGradient id="qcGmGold" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#c05512" />
                  <stop offset=".29" stopColor="#e3cb48" />
                  <stop offset=".5" stopColor="#ca8b30" />
                  <stop offset=".94" stopColor="#e3cb48" />
                </linearGradient>
                <linearGradient id="qcGmDot" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#2d4cc8" />
                  <stop offset="1" stopColor="#e01e5a" />
                </linearGradient>
              </defs>
              <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcGmGold)" />
              <circle cx="9" cy="23" r="5" fill="url(#qcGmDot)" />
              <circle cx="62" cy="7" r="5" fill="url(#qcGmDot)" />
              <circle cx="115" cy="23" r="5" fill="url(#qcGmDot)" />
              <circle cx="62" cy="52" r="2" fill="#67096e" />
            </svg>
            <div className="qc-gm-logo-shield">
              Quantum
              <br />
              Champ
            </div>
          </div>

          <nav className="qc-gm-topics" aria-label="Game topics">
            {TOPICS.map((topic) => (
              <button key={topic} type="button" className={`qc-gm-topic ${activeTopic === topic ? "qc-gm-topic-active" : ""}`} onClick={() => setActiveTopic(topic)} aria-pressed={activeTopic === topic}>
                <span>{topic}</span>
              </button>
            ))}
          </nav>
        </header>

        <section className="qc-gm-hero">
          <div className="qc-gm-intro">
            <h1 className="qc-gm-heading">
              <span>Neural</span>
              <span className="qc-gm-gradient-text">Knockout</span>
            </h1>

            <div className="qc-gm-tagline">
              <span>
                <Brain className="qc-gm-tag-icon qc-gm-pink" aria-hidden="true" /> Outsmart
              </span>
              <span>
                <Award className="qc-gm-tag-icon qc-gm-purple" aria-hidden="true" /> Outscore
              </span>
              <span>
                <Sparkles className="qc-gm-tag-icon qc-gm-orange" aria-hidden="true" /> Out Level
              </span>
            </div>

            <button type="button" className="qc-gm-start" onClick={getStarted}>
              <svg className="qc-gm-play" viewBox="0 0 28 28" aria-hidden="true">
                <defs>
                  <linearGradient id="qcGmPlay" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#2d4cc8" />
                    <stop offset="1" stopColor="#e01e5a" />
                  </linearGradient>
                </defs>
                <circle cx="14" cy="14" r="11.5" fill="none" stroke="url(#qcGmPlay)" strokeWidth="1.8" />
                <path d="M11 9.9v8.2c0 .8.9 1.3 1.6.9l6.6-4.1c.6-.4.6-1.3 0-1.7l-6.6-4.1c-.7-.5-1.6 0-1.6.8Z" fill="url(#qcGmPlay)" />
              </svg>
              <span className="qc-gm-start-text">Get Started</span>
            </button>
          </div>

          <div className="qc-gm-board">
            <div className="qc-gm-match">
              <div className="qc-gm-team qc-gm-team-nova">
                <div className="qc-gm-hex qc-gm-hex-nova">{novaName}</div>
                <div className="qc-gm-motto">
                  <SunMedium className="qc-gm-motto-icon qc-gm-motto-nova" aria-hidden="true" />
                  Rising Fast
                </div>
                <span className="qc-gm-ready qc-gm-ready-nova">READY</span>
              </div>

              <div className="qc-gm-vs" aria-hidden="true">
                <span>VS</span>
              </div>

              <div className="qc-gm-team qc-gm-team-blaze">
                <div className="qc-gm-hex qc-gm-hex-blaze">{blazeName}</div>
                <div className="qc-gm-motto">
                  <Flame className="qc-gm-motto-icon qc-gm-motto-blaze" aria-hidden="true" />
                  Bring the Heat
                </div>
                <span className="qc-gm-ready qc-gm-ready-blaze">READY</span>
              </div>
            </div>

            <div className="qc-gm-stats">
              <div className="qc-gm-stat">
                <div className="qc-gm-stat-inner">
                  <strong className="qc-gm-stat-blue">9</strong>
                  <span>Questions</span>
                </div>
              </div>

              <div className="qc-gm-stat">
                <div className="qc-gm-stat-inner">
                  <strong className="qc-gm-stat-purple">2</strong>
                  <span>Teams</span>
                </div>
              </div>

              <div className="qc-gm-stat">
                <div className="qc-gm-stat-inner">
                  <strong className="qc-gm-stat-pink">10k+</strong>
                  <span>XP to Win</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="qc-gm-champion">
          <h2>Your Climb To Champion</h2>
          <p>Every Correct Answer pushes the meter forward</p>

          <div className="qc-gm-progress">
            <div className="qc-gm-track">
              <div className="qc-gm-track-fill" />
            </div>

            {LEVELS.map((level, index) => (
              <div key={level.number} className={`qc-gm-level qc-gm-level-${index + 1}`}>
                {index === 0 ? (
                  <div className="qc-gm-level-hex qc-gm-level-hex-spark">
                    <svg className="qc-gm-level-icon" viewBox="0 0 32 32" aria-hidden="true">
                      <circle cx="16" cy="16" r="13.3" fill="none" stroke="#ffffff" strokeWidth="1.5" />
                      <path d="m11.3 9 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z" fill="none" stroke="#d5c14f" strokeWidth="1" strokeLinejoin="round" />
                      <path d="m20.7 9 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z" fill="none" stroke="#d5c14f" strokeWidth="1" strokeLinejoin="round" />
                      <path d="M10.7 20c1.2 1.8 3.1 2.7 5.3 2.7s4.1-.9 5.3-2.7" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : index === 3 ? (
                  <div className="qc-gm-level-titan">
                    <div className="qc-gm-level-hex qc-gm-level-hex-titan">
                      <Trophy className="qc-gm-level-icon qc-gm-level-trophy" aria-hidden="true" />
                    </div>
                    {fireworks.map((f) => (
                      <svg key={f} className={`qc-gm-firework qc-gm-firework-${f}`} viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    ))}
                  </div>
                ) : (
                  <div className="qc-gm-level-circle">
                    <span>{level.number}</span>
                  </div>
                )}
                <div className="qc-gm-level-text">
                  <strong>{level.title}</strong>
                  <small>{level.xp}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
