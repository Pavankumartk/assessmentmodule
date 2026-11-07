"use client";
import { quantumPlayerStorage as localStorage } from "../lib/player-storage";


import { useEffect, useState, type CSSProperties } from "react";
import { Flame, SunMedium } from "lucide-react";
import { fredoka } from "../fredoka";
import { useRouter } from "next/navigation";
import { current, findLobby, publish, subscribe, type Lobby } from "../lib/lobby";
import "./waiting.css";


const embers = Array.from({ length: 12 }, (_, i) => i);
const waves = [0, 1, 2];

export default function Waiting() {
  const router = useRouter();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [teamId, setTeamId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const session = current();

    if (!session) {
      router.replace("/quantum-champs-player/access-code");
      return;
    }

    setTeamId(session.teamId);

    const refresh = async () => {
      try {
      const next = await findLobby(session.lobbyId);

      setLobby(next || null);
      setLoaded(true);

      if (!next) return;

      const firstTeam = next.hostTeam.name.trim().toLowerCase();

      if (firstTeam === "nova" || firstTeam === "blaze") {
        try { localStorage.setItem("qcFirstRegisteredTeam", firstTeam); } catch { /* Optional flag. */ }
        try { sessionStorage.setItem("qcFirstRegisteredTeam", firstTeam); } catch { /* Optional flag. */ }
      }

      if (next.status === "ready") {
        const isHost = session.teamId === next.hostTeam.id;
        const isGuest = session.teamId === next.guestTeam.id;

        if (isHost || isGuest) {
          router.replace("/quantum-champs-player/game-mode");
        }
      }
      } catch (error) {
        console.error("Could not load Quantum Champs lobby", error);
        setMessage("Unable to load the team lobby. Please check browser storage permissions.");
        setLoaded(true);
      }
    };

    refresh();

    const unsubscribe = subscribe(refresh);

    const interval = window.setInterval(refresh, 1000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [router]);

  const host = !!lobby && teamId === lobby.hostTeam.id;

  const guest = !!lobby && teamId === lobby.guestTeam.id;

  const requestPending = lobby?.status === "request" && !!lobby.guestTeam.id;

  const novaTeam = lobby?.hostTeam.name.toLowerCase() === "nova" ? lobby.hostTeam : lobby?.guestTeam.name.toLowerCase() === "nova" ? lobby.guestTeam : null;

  const blazeTeam = lobby?.hostTeam.name.toLowerCase() === "blaze" ? lobby.hostTeam : lobby?.guestTeam.name.toLowerCase() === "blaze" ? lobby.guestTeam : null;

  const novaJoined = !!novaTeam?.id;
  const blazeJoined = !!blazeTeam?.id;

  async function accept() {
    try {
    if (!lobby || !host || !requestPending) return;

    const latest = await findLobby(lobby.id);

    if (!latest || latest.status !== "request" || !latest.guestTeam.id || latest.hostTeam.id !== teamId) {
      setMessage("The join request is no longer available.");
      return;
    }

    await publish({
      ...latest,
      status: "ready",
      updatedAt: Date.now(),
    });

    setMessage("");
    } catch (error) {
      console.error("Could not accept team", error);
      setMessage("Could not save the team approval. Please try again.");
    }
  }

  async function reject() {
    try {
    if (!lobby || !host || !requestPending) return;

    const latest = await findLobby(lobby.id);

    if (!latest || latest.status !== "request" || latest.hostTeam.id !== teamId) {
      setMessage("The join request is no longer available.");
      return;
    }

    const rejectedTeamName = latest.guestTeam.name;

    const otherTeamName = latest.hostTeam.name.trim().toLowerCase() === "nova" ? "Blaze" : "Nova";

    await publish({
      ...latest,
      guestTeam: {
        id: "",
        name: otherTeamName,
        members: 0,
        code: "",
        userIds: [],
      },
      status: "waiting",
      requestedAt: undefined,
      updatedAt: Date.now(),
    });

    setMessage(`${rejectedTeamName}'s join request was declined.`);
    } catch (error) {
      console.error("Could not reject team", error);
      setMessage("Could not save the team decision. Please try again.");
    }
  }

  const hostName = lobby?.hostTeam.name || "Nova";

  const guestName = lobby?.guestTeam.name || (hostName.toLowerCase() === "nova" ? "Blaze" : "Nova");

  const heading = requestPending && host ? `${guestName} requests to join .....` : requestPending && guest ? "Waiting for team approval ....." : guest && !lobby?.guestTeam.id ? "Your join request was declined ....." : `Waiting for team ${guestName} to join .....`;

  const novaStatus = lobby?.status === "ready" && novaJoined ? "Joined" : novaJoined && novaTeam?.id === lobby?.guestTeam.id ? "Approval pending" : novaJoined ? `Joined - ${novaTeam?.members ?? 0} Members` : "Waiting...";

  const blazeStatus = lobby?.status === "ready" && blazeJoined ? "Joined" : blazeJoined && blazeTeam?.id === lobby?.guestTeam.id ? "Approval pending" : blazeJoined ? `Joined - ${blazeTeam?.members ?? 0} Members` : "Waiting...";

  const headingText = heading.replace(/\s*\.+$/, "");
  const headingHasDots = headingText !== heading;

  return (
    <main className={`qc-wait-root ${fredoka.variable}`}>
      <section className="qc-wait-panel">
        <div className="qc-wait-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>
        <div className="qc-wait-content">
          <div className="qc-wait-orbit" aria-label="Quantum Champ">
            {waves.map((d) => (
              <span key={d} className="qc-wait-hexwave" style={{ "--d": d } as CSSProperties} aria-hidden="true" />
            ))}
            <div className="qc-wait-logo">
              <svg className="qc-wait-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
                <defs>
                  <linearGradient id="qcWaitGold" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#c05512" />
                    <stop offset=".29" stopColor="#e3cb48" />
                    <stop offset=".5" stopColor="#ca8b30" />
                    <stop offset=".94" stopColor="#e3cb48" />
                  </linearGradient>
                  <linearGradient id="qcWaitDot" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#2d4cc8" />
                    <stop offset="1" stopColor="#e01e5a" />
                  </linearGradient>
                </defs>
                <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcWaitGold)" />
                <circle cx="9" cy="23" r="5" fill="url(#qcWaitDot)" />
                <circle cx="62" cy="7" r="5" fill="url(#qcWaitDot)" />
                <circle cx="115" cy="23" r="5" fill="url(#qcWaitDot)" />
                <circle cx="62" cy="52" r="2" fill="#67096e" />
              </svg>
              <div className="qc-wait-logo-shield">
                Quantum
                <br />
                Champ
              </div>
            </div>
          </div>

          <h1 className="qc-wait-heading">
            <span className="qc-wait-heading-text">{headingText}</span>
            {headingHasDots && (
              <span className="qc-wait-dots" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
          </h1>

          <div className="qc-wait-teams">
            <div className={`qc-wait-team qc-wait-team-nova${novaJoined ? "" : " is-waiting"}`}>
              <div className="qc-wait-emblem qc-wait-emblem-nova">Nova</div>
              <p className="qc-wait-motto">
                <SunMedium className="qc-wait-motto-icon" aria-hidden="true" />
                Rising Fast
              </p>
              <span className="qc-wait-pill qc-wait-pill-nova">{novaStatus}</span>
            </div>

            <div className="qc-wait-vs" aria-hidden="true">
              <span>VS</span>
            </div>

            <div className={`qc-wait-team qc-wait-team-blaze${blazeJoined ? "" : " is-waiting"}`}>
              <div className="qc-wait-emblem qc-wait-emblem-blaze">Blaze</div>
              <p className="qc-wait-motto">
                <Flame className="qc-wait-motto-icon" aria-hidden="true" />
                Bring the Heat
              </p>
              <span className="qc-wait-pill qc-wait-pill-blaze">{blazeStatus}</span>
            </div>
          </div>

          {requestPending && host ? (
            <div className="qc-wait-actions">
              <button className="qc-wait-button" type="button" onClick={accept}>
                <span>Accept Request</span>
              </button>
              <button className="qc-wait-button" type="button" onClick={reject}>
                <span>Decline</span>
              </button>
            </div>
          ) : (
            <p className="qc-wait-status">{guest && requestPending ? "The first team must accept your request." : guest && !lobby?.guestTeam.id ? "Your request was declined. Return to the access-code page to try again." : "The game opens as soon as both teams are in. Stay on this screen."}</p>
          )}

          {message && (
            <p className="qc-wait-error" role="status">
              {message}
            </p>
          )}

          {loaded && !lobby && (
            <p className="qc-wait-error" role="alert">
              Lobby not found. Return to the access-code page.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
