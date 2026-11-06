import type { ReactNode } from "react";
import RoleGate from "@/modules/assessments/auth/RoleGate";
import "./quantum-scope.css";

// The existing creator role gate renders after the browser session is checked.
export const instant = false;

export default function QuantumCreatorLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="admin"><div className="quantum-creator-scope" style={{ display: "contents" }}>{children}</div></RoleGate>;
}
