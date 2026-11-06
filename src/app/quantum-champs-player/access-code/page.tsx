"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { readLobbies, publish, setCurrent, type Team } from "../lib/lobby";
import "./access-code.css";

const DEMO = {
  accessCode: "QC7-XXXX",
  assessmentId: "QC-ASM-001",
  batchId: "QC-BATCH-001",
  title: "Quantum Champ",
  teams: [
    {
      id: "QC-TEAM-001",
      userId: "QC-USER-001",
      name: "Nova",
      members: 12,
    },
    {
      id: "QC-TEAM-002",
      userId: "QC-USER-002",
      name: "Blaze",
      members: 1,
    },
  ],
} as const;

type FieldName = "code" | "userId";
type FieldErrors = Partial<Record<FieldName, string>>;

const embers = Array.from({ length: 12 }, (_, i) => i);

export default function AccessCode() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [userId, setUserId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(field: FieldName) {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));
  }

  function saveFirstRegisteredTeam(teamName: string, firstTeamName: string) {
    const team = teamName.trim().toLowerCase();
    const firstTeam = firstTeamName.trim().toLowerCase();

    if ((team !== "nova" && team !== "blaze") || (firstTeam !== "nova" && firstTeam !== "blaze")) {
      return;
    }

    try { localStorage.setItem("qcFirstRegisteredTeam", firstTeam); } catch { /* IndexedDB is authoritative. */ }
    sessionStorage.setItem("qcFirstRegisteredTeam", firstTeam);
    sessionStorage.setItem("qcJoinedTeam", team);
    try { localStorage.setItem(`qcTeamRegistered_${team}`, "true"); } catch { /* Optional compatibility flag. */ }
  }

  async function join() {
    try {
    const nextErrors: FieldErrors = {};

    const enteredCode = code.trim().toUpperCase();
    const enteredUserId = userId.trim().toUpperCase();

    if (!enteredCode) {
      nextErrors.code = "Please enter your assessment access code.";
    } else if (enteredCode !== DEMO.accessCode) {
      nextErrors.code = "Enter the assessment access code QC7-XXXX.";
    }

    if (!enteredUserId) {
      nextErrors.userId = "Please enter your User ID.";
    } else if (!DEMO.teams.some((team) => team.userId === enteredUserId)) {
      nextErrors.userId = "Enter QC-USER-001 or QC-USER-002.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const identity = DEMO.teams.find((team) => team.userId === enteredUserId);

    if (!identity) return;

    const lobbies = await readLobbies();

    const existing = lobbies.find((lobby) => lobby.assessmentId === DEMO.assessmentId && lobby.batchId === DEMO.batchId && lobby.status !== "ready");

    const team: Team = {
      id: identity.id,
      name: identity.name,
      members: identity.members,
      code: DEMO.accessCode,
      userIds: [identity.userId],
    };

    let lobbyId = "";
    let firstTeamName = "";

    if (!existing) {
      lobbyId = `QC-GAME-${crypto.randomUUID()}`;
      firstTeamName = identity.name;

      const otherTeam = DEMO.teams.find((item) => item.id !== identity.id);

      await publish({
        id: lobbyId,
        assessmentId: DEMO.assessmentId,
        batchId: DEMO.batchId,
        assessmentTitle: DEMO.title,
        hostTeam: team,
        guestTeam: {
          id: "",
          name: otherTeam?.name || "",
          members: 0,
          code: "",
          userIds: [],
        },
        status: "waiting",
        firstRegisteredTeam: identity.name.toLowerCase() as "nova" | "blaze",
        firstRegisteredTeamId: identity.id,
        firstRegisteredAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      lobbyId = existing.id;
      firstTeamName = existing.hostTeam.name;

      if (existing.hostTeam.id !== identity.id) {
        if (existing.guestTeam.id && existing.guestTeam.id !== identity.id) {
          setErrors({
            userId: "The second team slot is already occupied.",
          });
          return;
        }

        if (existing.status === "request") {
          if (existing.guestTeam.id !== identity.id) {
            setErrors({
              userId: "Another team request is already pending.",
            });
            return;
          }
        } else {
          await publish({
            ...existing,
            guestTeam: team,
            status: "request",
            requestedAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    setCurrent({
      lobbyId,
      teamId: identity.id,
      userId: identity.userId,
      assessmentId: DEMO.assessmentId,
      batchId: DEMO.batchId,
    });

    saveFirstRegisteredTeam(identity.name, firstTeamName);

    setErrors({});
    router.push("/quantum-champs-player/waiting");
    } catch (error) {
      console.error("Quantum Champs lobby could not be saved", error);
      setErrors({ code: "Unable to save the team lobby. Enable browser storage and try again." });
    }
  }

  return (
    <main className="qc-access-root">
      <section className="qc-access-panel">
        <div className="qc-access-embers" aria-hidden="true">
          {embers.map((i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              ✦
            </span>
          ))}
        </div>
        <form
          className="qc-access-content"
          onSubmit={(event) => {
            event.preventDefault();
            join();
          }}
          noValidate>
          <div className="qc-access-header">
            <div className="qc-access-logo-frame">
              <div className="qc-access-logo" aria-label="Quantum Champ">
                <svg className="qc-access-logo-crown" viewBox="0 0 124 91" aria-hidden="true">
                  <defs>
                    <linearGradient id="qcAccessGold" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0" stopColor="#c05512" />
                      <stop offset=".29" stopColor="#e3cb48" />
                      <stop offset=".5" stopColor="#ca8b30" />
                      <stop offset=".94" stopColor="#e3cb48" />
                    </linearGradient>
                    <linearGradient id="qcAccessDot" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#2d4cc8" />
                      <stop offset="1" stopColor="#e01e5a" />
                    </linearGradient>
                  </defs>
                  <path d="M9 23 31 42 62 7 88 42 115 23 102 88H24Z" fill="url(#qcAccessGold)" />
                  <circle cx="9" cy="23" r="5" fill="url(#qcAccessDot)" />
                  <circle cx="62" cy="7" r="5" fill="url(#qcAccessDot)" />
                  <circle cx="115" cy="23" r="5" fill="url(#qcAccessDot)" />
                  <circle cx="62" cy="52" r="2" fill="#67096e" />
                </svg>
                <div className="qc-access-logo-shield">
                  Quantum
                  <br />
                  Champ
                </div>
              </div>
            </div>
            <h1 className="qc-access-heading">Enter your Team’s access Code</h1>
          </div>

          <div className="qc-access-fields">
            <div className="qc-access-field">
              <label htmlFor="qc-access-code">Team Access Code</label>
              <div className={`qc-access-input-box${errors.code ? " is-invalid" : ""}`}>
                <input
                  id="qc-access-code"
                  className="qc-access-input"
                  placeholder="QC7-XXXX"
                  value={code}
                  aria-invalid={!!errors.code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    clearError("code");
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <span className="qc-access-field-error" role={errors.code ? "alert" : undefined}>
                {errors.code}
              </span>
            </div>

            <div className="qc-access-field">
              <label htmlFor="qc-user-id">User ID</label>
              <div className={`qc-access-input-box${errors.userId ? " is-invalid" : ""}`}>
                <input
                  id="qc-user-id"
                  className="qc-access-input"
                  placeholder="QC-USER-001"
                  value={userId}
                  aria-invalid={!!errors.userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    clearError("userId");
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <span className="qc-access-field-error" role={errors.userId ? "alert" : undefined}>
                {errors.userId}
              </span>
            </div>
          </div>

          <p className="qc-access-hint">Your teacher shared this code. Each team has its own.</p>

          <button className="qc-access-button" type="submit">
            <span>Join Game</span>
          </button>
        </form>
      </section>
    </main>
  );
}
