import AssessmentTextToolbarEnhancer from "./AssessmentTextToolbarEnhancer";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./assessment-unified-toggles.css";
import "./assessment-mobile-fixes.css";

export const metadata: Metadata = {
  title: "Assessment Management",
  description: "Assessment Management System",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AssessmentTextToolbarEnhancer />{children}</body>
    </html>
  );
}
