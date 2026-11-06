import type { ReactNode } from "react";
import "./qc-scale.css";
import "./quantum-player-scope.css";
import MobileLandscape from "./MobileLandscape";

export default function QuantumChampsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="quantum-player-scope" style={{ display: "contents" }}>
      <MobileLandscape>
        <div className="qc-stage">
          <div className="qc-stage-inner">{children}</div>
        </div>
      </MobileLandscape>
    </div>
  );
}
