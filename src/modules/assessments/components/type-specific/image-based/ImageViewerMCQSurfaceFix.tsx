"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./image-viewer-mcq-surface.css";

type Props = { children: ReactNode; isImageSorting?: boolean };

/**
 * Scoped enhancement for the EXISTING image-based learner viewer.
 * No image content, answers, ordering, scoring, flags, timing, navigation,
 * controls, or assessment storage are replaced.
 */
export default function ImageViewerMCQSurfaceFix({ children, isImageSorting = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const changed = new Set<HTMLElement>();

    const mark = (element: HTMLElement, attribute: string) => {
      if (!element.hasAttribute(attribute)) {
        element.setAttribute(attribute, "true");
        changed.add(element);
      }
    };

    const onlyLabel = (element: Element, label: RegExp) =>
      label.test((element.textContent || "").trim().replace(/\s+/g, " "));

    const locatePanel = (heading: HTMLElement): HTMLElement | null => {
      // Prefer a semantic panel; otherwise use the smallest card enclosing
      // the section. Never touch the application's LEFT navigation sidebar.
      const semanticPanel = heading.closest<HTMLElement>("aside, section, article");
      if (semanticPanel && root.contains(semanticPanel)) return semanticPanel;
      let node: HTMLElement | null = heading.parentElement;
      while (node && node !== root) {
        const className = typeof node.className === "string" ? node.className : "";
        if (/(?:viewer|question|tools|sidebar|panel|card|navigator)/i.test(className) &&
          node.querySelectorAll("button, a").length > 0) return node;
        node = node.parentElement;
      }
      return null;
    };

    const refresh = () => {
      // Image viewer Check Answer is a UI action; preserve answer state and
      // the submit/review logic by NOT triggering it or deleting its handlers.
      for (const button of root.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"]')) {
        const text = (button.textContent || "").trim().replace(/\s+/g, " ");
        const title = (button.getAttribute("aria-label") || button.getAttribute("title") || "").trim();
        const value = button instanceof HTMLInputElement ? button.value.trim() : "";
        if ([text, title, value].some(s => /^check\s+(?:my\s+)?answers?$/i.test(s))) {
          mark(button, "data-image-mcq-hide-check-answer");
        }
      }

      // Restore/preserve the existing MCQ-style question navigator and tools;
      // no duplicated replacement sidebar is ever created.
      for (const heading of root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong")) {
        if (onlyLabel(heading, /^question\s+(?:navigator|navigation|palette)$/i)) {
          const panel = locatePanel(heading);
          if (panel) mark(panel, "data-image-mcq-question-panel");
        }
        if (onlyLabel(heading, /^tools$/i)) {
          const panel = locatePanel(heading);
          if (panel && /scratch\s*pad/i.test(panel.textContent || "") &&
            /calculator/i.test(panel.textContent || "")) {
            mark(panel, "data-image-mcq-tools-panel");
            // Locate a shared two-column layout containing a question and tools.
            let parent: HTMLElement | null = panel.parentElement;
            while (parent && parent !== root) {
              const children = Array.from(parent.children);
              if (children.length >= 2 && children.some(el => !el.contains(panel) &&
                (/question|hint|flag|previous|next|submit/i).test(el.textContent || ""))) {
                mark(parent, "data-image-mcq-main-grid");
                break;
              }
              parent = parent.parentElement;
            }
          }
        }
      }
    };

    refresh();
    // React may replace the button or right-hand panel when a question changes.
    // Attribute changes are not observed, preventing recursive updates.
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const element of changed) {
        element.removeAttribute("data-image-mcq-hide-check-answer");
        element.removeAttribute("data-image-mcq-question-panel");
        element.removeAttribute("data-image-mcq-tools-panel");
        element.removeAttribute("data-image-mcq-main-grid");
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={isImageSorting
      ? "image-viewer-mcq-surface image-viewer-mcq-surface--sorting"
      : "image-viewer-mcq-surface"}>
      {children}
    </div>
  );
}
