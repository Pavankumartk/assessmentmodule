"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isQuantumStorageReady, prepareQuantumStorage } from "./quantum-storage";

/** Only wraps /quantum-champs/* — it does not affect any other assessment. */
export default function QuantumChampsTemplate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => isQuantumStorageReady());
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void prepareQuantumStorage()
      .then(() => { if (active) setReady(true); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    const onError = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (active) setError(custom.detail || "Quantum Champs could not save. Please retry.");
    };
    window.addEventListener("quantum-champs-storage-error", onError);
    return () => { active = false; window.removeEventListener("quantum-champs-storage-error", onError); };
  }, []);

  if (!ready) {
    if (error) return <div role="alert" style={{ padding: 24 }}>
      Quantum Champs cannot open local storage: {error}. Your existing assessments were not deleted.
    </div>;
    return null;
  }
  return <>{error ? <div role="alert" style={{ padding: "10px 16px", color: "#a11818" }}>
    Your latest Quantum Champs changes could not be persisted: {error}
  </div> : null}{children}</>;
}
