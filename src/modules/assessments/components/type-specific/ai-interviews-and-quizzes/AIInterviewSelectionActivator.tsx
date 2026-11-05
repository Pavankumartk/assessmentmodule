"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { beginAssessment } from "@/modules/assessments/storage/assessment-storage";

/**
 * AI Interview ONLY: finish the existing assessment-type selection action.
 * No additional buttons, shadows, headings or changes to other types.
 * The normal selector click handler still runs, so it can save its selected type.
 */
const AI_TYPE_CODE = "ai-interview";
const SELECTION_PATH = "/assessments/create";

function isAIInterviewOption(event: MouseEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    const attr = ["data-assessment-type", "data-type", "value", "aria-label"]
      .map((key) => node.getAttribute(key) || "");
    if (attr.includes(AI_TYPE_CODE) || attr.includes("ai-interview")) return true;
    if (node instanceof HTMLInputElement && node.type === "radio") {
      const text = node.closest("label")?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (/^AI Interview$/i.test(text)) return true;
    }
    // Exact label match: never intercept AI Viva or any other assessment.
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (/^AI Interview$/i.test(text)) return true;
  }
  return false;
}

export default function AIInterviewSelectionActivator() {
  const router = useRouter();
  useEffect(() => {
    let pending: number | undefined;
    const onClick = (event: MouseEvent) => {
      if (window.location.pathname.replace(/\/$/, "") !== SELECTION_PATH) return;
      if (!isAIInterviewOption(event)) return;
      if (pending) window.clearTimeout(pending);
      // Let the existing menu select/save the type before navigating.
      // If the existing handler already navigates, this does nothing.
      pending = window.setTimeout(() => {
        if (window.location.pathname.replace(/\/$/, "") !== SELECTION_PATH) return;
        try {
          beginAssessment(AI_TYPE_CODE, "AI Interview");
          sessionStorage.removeItem("assessment-editing-id");
        } catch {
          // Keep the selector open if a draft cannot be created.
          return;
        }
        router.push(`/assessments/create/details?type=${encodeURIComponent(AI_TYPE_CODE)}`);
      }, 250);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (pending) window.clearTimeout(pending);
    };
  }, [router]);
  return null;
}
