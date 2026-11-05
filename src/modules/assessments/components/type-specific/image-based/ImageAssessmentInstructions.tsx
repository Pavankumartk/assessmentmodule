"use client";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";


// Reuse the exact existing MCQ instruction-card classes and shared styling.
// This is shown by the viewer route before it mounts an Image-Based question viewer.
import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import { assessmentStorage, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import { imageQuestionValid, readImageDraft } from "./image-based-data";
import "../../viewer/AssessmentViewer/viewer.css";

const defaults = [
  "Select the correct answer for each image question.",
  "Each question carries the marks shown on the screen.",
  "The timer starts only after you press Start Assessment.",
  "You can flag questions for later review.",
  "You can change your answers before final submission.",
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

export default function ImageAssessmentInstructions({ assessmentId, onStart }: { assessmentId: string; onStart: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const info = useMemo(() => {
    const record = getAssessment(assessmentId);
    let draft: Record<string, unknown> = {};
    try { draft = JSON.parse((assessmentStorage.getItem("imageBasedAssessmentDraft") || assessmentStorage.getItem("imageBasedDetailsDraft") || assessmentStorage.getItem("mcqAssessmentDraft") || "{}")); }
    catch { /* use record/defaults */ }
    const questions = readImageDraft().questions.filter(imageQuestionValid);
    const list = creatorInstructionLines(draft.instructions, draft.descriptionInstructions);
    const duration = text(draft.duration ?? draft.timeLimit ?? draft.totalTime, "60");
    const passing = text(draft.passingScore ?? draft.passingMarks, "60");
    const negative = text(draft.negativeMarkingValue ?? draft.negativeMarking, "NA");
    return {
      title: record?.title || text(draft.assessmentTitle, "Image-Based Assessment"),
      count: String(questions.length || record?.questions || 0),
      marks: String(questions.length ? questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0) : record?.marks || 0),
      duration: /minute|hour/i.test(duration) ? duration : `${duration} Minutes`,
      passing: passing.includes("%") ? passing : `${passing}%`,
      negative: negative === "NA" ? "NA" : negative,
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
              <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" />
              <strong>{info.title}</strong>
            </nav>
            <div className="viewerPageHeading"><h1>{info.title}</h1><p>Image-Based Assessment</p></div>
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
