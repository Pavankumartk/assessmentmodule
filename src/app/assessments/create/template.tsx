"use client";

import type { ReactNode } from "react";
import AIInterviewSelectionActivator from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/AIInterviewSelectionActivator";

/** The original Type/Details/Content/Evaluation/Review screens remain unchanged. */
export default function AssessmentCreateTemplate({ children }: { children: ReactNode }) {
  return <>{children}<AIInterviewSelectionActivator /></>;
}
