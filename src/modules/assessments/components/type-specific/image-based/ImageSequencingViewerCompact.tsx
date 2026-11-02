"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./image-sequencing-compact.css";

/**
 * View-only enhancement for the existing Image Sequencing assessment.
 * No edits to image order, question state, scoring, submit, retry, or navigation.
 * This wrapper is instantiated only for the Image Sequencing subtype by PageClient.
 */
export default function ImageSequencingViewerCompact({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Track DOM elements for complete cleanup if this subtype is unmounted.
    const hidden = new Set<HTMLElement>();
    const wide = new Set<HTMLElement>();

    function update() {
      if (!host) return;
      // Only visible buttons with the exact "Check Answer(s)" action are removed.
      // It is important not to hide Review, Next, Submit, or Retry buttons.
      for (const node of host.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"]')) {
        const title = node.getAttribute("aria-label") || node.getAttribute("title") || "";
        const label = [node.textContent || "", title, node instanceof HTMLInputElement ? node.value : ""]
          .join(" ").replace(/\s+/g, " ").trim();
        if (/\bcheck\s+(?:my\s+)?answers?\b/i.test(label) && !node.hasAttribute("data-image-sequence-hide")) {
          node.setAttribute("data-image-sequence-hide", "true");
          hidden.add(node);
        }
      }

      // The question navigator / right-hand summary is distinct from the
      // app's left-side Sidebar component, which must remain unchanged.
      const candidates = host.querySelectorAll<HTMLElement>(
        'aside, [class*="Navigator"], [class*="navigator"], [class*="QuestionPanel"], [class*="question-panel"], [class*="rightPanel"], [class*="RightPanel"], [class*="questionSidebar"], [class*="QuestionSidebar"], [class*="questionSummary"], [class*="QuestionSummary"]'
      );
      for (const node of candidates) {
        if (node.hasAttribute("data-image-sequence-hide") || node.closest('[data-image-sequence-hide="true"]')) continue;
        const classes = typeof node.className === "string" ? node.className : "";
        const text = (node.textContent || "").slice(0, 1200);
        const isQuestionPanel = /\bquestion\s+(?:navigator|navigation|palette|summary|overview|panel)\b/i.test(text)
          || /(?:question.?navigator|viewer.?navigator|question.?palette|question.?summary|question.?sidebar)/i.test(classes)
          || (/\b(?:right.?panel|right.?sidebar)\b/i.test(classes) && /\b(?:answered|unanswered|flagged|remaining|question)\b/i.test(text));
        if (!isQuestionPanel) continue;
        node.setAttribute("data-image-sequence-hide", "true");
        hidden.add(node);
        const parent = node.parentElement;
        if (parent && host.contains(parent) && !parent.hasAttribute("data-image-sequence-wide")) {
          parent.setAttribute("data-image-sequence-wide", "true");
          wide.add(parent);
        }
      }
    }

    update();
    // React may replace the navigator on question changes. Preserve the same
    // compact view without touching assessment state or event handlers.
    const observer = new MutationObserver(() => update());
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const node of hidden) node.removeAttribute("data-image-sequence-hide");
      for (const node of wide) node.removeAttribute("data-image-sequence-wide");
    };
  }, []);

  return <div ref={hostRef} className="image-sequencing-compact-view">{children}</div>;
}
