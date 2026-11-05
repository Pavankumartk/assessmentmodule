"use client";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";


// Reuse the exact existing MCQ instruction-card classes and shared styling.
// This is shown by the viewer route before it mounts the Connect the Dots viewer.
import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import { assessmentStorage, getAssessment } from "@/modules/assessments/storage/assessment-storage";

import "../../viewer/AssessmentViewer/viewer.css";

const defaults = [
  "Connect each item on the left to its matching item on the right.",
  "Use the matching controls to complete every question.",
  "Each question carries the marks shown on the screen.",
  "The timer starts only after you press Start Assessment.",
  "You can flag questions for later review and change answers before submitting.",
  "The assessment will submit automatically when time runs out.",
];

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|li)>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim() || fallback;
  if (typeof value === "number") return String(value);
  return fallback;
}
function Icon({ name }: { name: string }) {
  return <img src={`/assets/viewericons/${name}`} width={24} height={24} alt="" aria-hidden="true" />;
}
function SummaryItem({ label, value, icon, variant }: { label: string; value: string; icon: string; variant: string }) {
  return <div className={`viewerStat viewerStat--${variant}`}>
    <span className="viewerStatIcon"><Icon name={icon} /></span>
    <div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div>
  </div>;
}

export default function ConnectDotsAssessmentInstructions({ assessmentId, onStart }: { assessmentId: string; onStart: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const info = useMemo(() => {
    const record = getAssessment(assessmentId);
    const parse = (key: string): Record<string, unknown> => {
      try {
        const value: unknown = JSON.parse(assessmentStorage.getItem(key) || "{}");
        return value && typeof value === "object" && !Array.isArray(value)
          ? value as Record<string, unknown> : {};
      } catch { return {}; }
    };
    const content = parse("connectDotsContentDraft");
    const detailsDraft = parse("connectDotsAssessmentDraft");
    const sharedDetails = parse("mcqAssessmentDraft");
    const contentDetails = content.details && typeof content.details === "object" && !Array.isArray(content.details)
      ? content.details as Record<string, unknown> : {};
    const details = { ...sharedDetails, ...detailsDraft, ...contentDetails };
    const questions = Array.isArray(content.questions) ? content.questions : [];
    const filled = questions.filter(raw => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
      const q = raw as Record<string, unknown>;
      return Boolean(text(q.text ?? q.question)) && Array.isArray(q.pairs) &&
        q.pairs.length >= 2 && q.pairs.every(pair => {
          if (!pair || typeof pair !== "object" || Array.isArray(pair)) return false;
          const p = pair as Record<string, unknown>;
          return Boolean(text(p.left ?? p.term)) && Boolean(text(p.right ?? p.description));
        });
    });
    const list = creatorInstructionLines(details.instructions, details.descriptionInstructions, content.instructions);
    const duration = text(details.duration ?? details.durationMinutes ?? details.timeLimit ?? details.totalTime, "60");
    const passing = text(details.passingScore ?? details.passingMarks, "60");
    const negative = text(details.negativeMarkingValue ?? details.negativeMarking, "NA");
    const totalMarks = filled.length
      ? filled.reduce((sum, raw) => sum + (Number((raw as Record<string, unknown>).points) || 0), 0)
      : Number(details.totalMarks ?? record?.marks ?? 0);
    return {
      title: record?.title || text(details.assessmentTitle ?? details.title, "Connect the Dots"),
      count: String(filled.length || record?.questions || Number(details.questionCount) || 0),
      marks: String(totalMarks),
      duration: /minute|hour/i.test(duration) ? duration : `${duration} Minutes`,
      passing: passing.includes("%") ? passing : `${passing}%`,
      negative,
      instructions: list.length ? list : defaults,
    };
  }, [assessmentId]);

  return <div className="viewerAppShell superAdminPage institutionAdminPage">
    <div className="viewerLayout">
      <Sidebar />
      <div className="viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <main className="viewerScroll institutionScrollArea">
          <div className="viewerContent">
            <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
              <Link href="/learner">Dashboard</Link><Icon name="arrow-right-double.svg" />
              <Link href="/learner">Assessment</Link><Icon name="arrow-right-double.svg" />
              <strong>{info.title}</strong>
            </nav>
            <div className="viewerPageHeading"><h1>{info.title}</h1><p>Connect the Dots</p></div>
            <div className="viewerColumns">
              <aside className="viewerSummary" aria-label="Assessment summary">
                <SummaryItem label="Total Questions" value={info.count} icon="list.svg" variant="blue" />
                <SummaryItem label="Total Marks" value={info.marks} icon="star-award.svg" variant="orange" />
                <SummaryItem label="Total Time" value={info.duration} icon="alarm-clock.svg" variant="purple" />
                <SummaryItem label="Passing Score" value={info.passing} icon="checkmark-circle.svg" variant="green" />
                <SummaryItem label="Negative Marking" value={info.negative} icon="remove-circle.svg" variant="red" />
              </aside>
              <div className="viewerRightColumn">
                <section className="viewerInstructions">
                  <h2>Instructions</h2>
                  <ol>{info.instructions.map((item, index) => <li key={`${index}-${item}`}>{index + 1}. {item}</li>)}</ol>
                </section>
                <section className="viewerConfirmation" aria-label="Confirm instructions">
                  <label className="viewerAgreement">
                    <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
                    <span className="viewerCheckboxIcon" aria-hidden="true" />
                    <span>I have read and understood the instructions</span>
                  </label>
                  <button type="button" className="viewerStart" disabled={!accepted} onClick={onStart}>Start Assessment</button>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>;
}
