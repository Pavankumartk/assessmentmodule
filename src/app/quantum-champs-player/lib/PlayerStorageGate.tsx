"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PLAYER_STORAGE_ERROR, PLAYER_STORAGE_RECOVERED, flushPlayerStorage, preparePlayerStorage } from "./player-storage";

export default function PlayerStorageGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    const failed = () => { if (active) setError("Unable to save game data. Check browser storage permissions and available device space, then retry."); };
    const recovered = () => { if (active) setError(""); };
    window.addEventListener(PLAYER_STORAGE_ERROR, failed);
    window.addEventListener(PLAYER_STORAGE_RECOVERED, recovered);
    void preparePlayerStorage().then(() => { if (active) { setReady(true); setError(""); } }).catch(failed);
    return () => { active = false; window.removeEventListener(PLAYER_STORAGE_ERROR, failed); window.removeEventListener(PLAYER_STORAGE_RECOVERED, recovered); };
  }, []);

  const retry = async () => {
    setRetrying(true);
    try { await preparePlayerStorage(); await flushPlayerStorage(); setReady(true); setError(""); }
    catch { setError("Unable to save game data. Check browser storage permissions and available device space, then retry."); }
    finally { setRetrying(false); }
  };

  return <>
    {ready ? children : null}
    {error && <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 2147483647, display: "grid", placeItems: "center", padding: 24, background: "rgba(36, 45, 60, .55)" }}>
      <div style={{ maxWidth: 460, padding: 24, borderRadius: 16, background: "#DFE6E9", color: "#374151", boxShadow: "-4px -4px 8px #fff, 4px 4px 8px #c4c4c4", fontFamily: "Segoe UI, Arial, sans-serif", textAlign: "center" }}>
        <p>{error}</p>
        <button type="button" onClick={() => void retry()} disabled={retrying} style={{ padding: "10px 22px", border: 0, borderRadius: 24, color: "#2a7308", background: "#DFE6E9", boxShadow: "-3px -3px 5px #fff, 3px 3px 5px #c4c4c4", cursor: "pointer" }}>{retrying ? "Retrying…" : "Retry"}</button>
      </div>
    </div>}
  </>;
}
