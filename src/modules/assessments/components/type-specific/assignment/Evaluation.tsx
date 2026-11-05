"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AssignmentShell, Field, Notice, Toggle } from "./AssignmentUI";
import {
  defaultEvaluation, EVALUATION_KEY, readAssignment, saveAssignment,
  validateEvaluation, type AssignmentEvaluation, type Criterion,
} from "./assignment-data";

type SectionProps = { title: string; children: ReactNode; defaultOpen?: boolean };
function EvaluationSection({ title, children, defaultOpen = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <section className="asgn-eval-section">
      <button type="button" className="asgn-eval-section-head" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        <span>{title}</span><span className={`asgn-eval-caret${expanded ? "" : " is-closed"}`} aria-hidden="true" />
      </button>
      {expanded && <div className="asgn-eval-section-body">{children}</div>}
    </section>
  );
}

const gradingLevels: [string, string, string][] = [
  ["Excellent", "90–100%", "Understands the questions and instructions."],
  ["Good", "75–89%", "Gives correct and relevant answers."],
  ["Satisfactory", "60–74%", "Answers all questions and tasks."],
  ["Needs Improvement", "40–59%", "Thinks logically and explains why."],
  ["Poor", "1–39%", "Uses concepts with examples or solutions."],
  ["Not Demonstrated", "0%", "Works independently and credits sources."],
];

const recommendedWeights: [string, number, number, number][] = [
  ["Understanding of Assignment", 10, 10, 10],
  ["Content Accuracy & Relevance", 30, 15, 25],
  ["Completeness of Submission", 15, 10, 10],
  ["Critical Thinking & Analysis", 10, 25, 15],
  ["Practical Application & Examples", 5, 15, 20],
  ["Originality & Academic Integrity", 10, 10, 10],
  ["Structure & Organization", 10, 5, 5],
  ["References & Supporting Evidence", 5, 5, 0],
  ["Clarity & Presentation", 5, 5, 5],
];

const classifications: [string, string, number, number][] = [
  ["90–100%", "Outstanding", 90, 100],
  ["75–89%", "Very Good", 75, 89],
  ["60–74%", "Good", 60, 74],
  ["40–59%", "Satisfactory", 40, 59],
  ["1–39%", "Needs Improvement", 1, 39],
  ["0%", "Unsatisfactory", 0, 0],
];

export default function AssignmentEvaluationStep() {
  const router = useRouter();
  const [data, setData] = useState<AssignmentEvaluation>(defaultEvaluation);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); }, []);
  useEffect(() => { if (message !== "Evaluation settings saved.") return; const timer = window.setTimeout(() => setMessage(""), 3000); return () => window.clearTimeout(timer); }, [message]);

  useEffect(() => { setData(readAssignment(EVALUATION_KEY, defaultEvaluation)); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { saveAssignment(EVALUATION_KEY, data); }
    catch { setMessage("Could not autosave evaluation settings."); }
  }, [data, ready]);

  const set = <K extends keyof AssignmentEvaluation>(key: K, value: AssignmentEvaluation[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
    setErrors([]);
    setMessage("");
  };
  const rubricTotal = useMemo(() => data.criteria.reduce((sum, item) => sum + Number(item.marks || 0), 0), [data.criteria]);
  const rubricBalanced = Math.abs(rubricTotal - data.maxGrade) < 0.0001;
  const setCriterion = (id: string, changes: Partial<Criterion>) =>
    set("criteria", data.criteria.map(item => item.id === id ? { ...item, ...changes } : item));
  const addCriterion = () => set("criteria", [
    ...data.criteria,
    { id: `criterion-${Date.now()}-${data.criteria.length}`, title: "", description: "", marks: 0 },
  ]);

  const persist = () => {
    try {
      saveAssignment(EVALUATION_KEY, data);
      // Preserve the existing shared Review page's evaluation summary key.
      saveAssignment("mcqAssessmentEvaluationDraft", {
        ...data, assessmentType: "Assignment", typeCode: "assignment",
        totalMarks: data.maxGrade, maximumMarks: data.maxGrade,
        passingScore: data.passGrade, gradingMethod: data.method,
        releaseResults: data.resultsVisibility,
      });
      setMessage("Evaluation settings saved.");
      return true;
    } catch {
      setErrors(["Unable to save evaluation settings."]);
      return false;
    }
  };

  const continueToReview = () => {
    if (saving) return;
    const validationErrors = validateEvaluation(data);
    setErrors(validationErrors);
    if (validationErrors.length) {
      document.querySelector<HTMLElement>(".asgn-evaluation-shell .asgn-main")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (persist()) { setMessage(""); setSaving(true); router.push("/assessments/create/review"); }
  };
  const passPercentage = data.maxGrade > 0 ? (data.passGrade / data.maxGrade) * 100 : 0;

  return (
    <AssignmentShell step="evaluation" subtitle="Provide the essential details and settings for your assessment.">
      <div className="asgn-evaluation-page">
        <Notice errors={errors} message={message} />

        <EvaluationSection title="Grade">
          <div className="asgn-eval-field-grid">
            <Field label="Grade type"><select value={data.gradeType} onChange={e => set("gradeType", e.target.value)}><option>Point</option><option>Percentage</option></select></Field>
            <Field label="Maximum Grade"><input type="number" min="1" value={data.maxGrade} onChange={e => set("maxGrade", Number(e.target.value))} /></Field>
            <Field label="Grade Category"><input value={data.category} onChange={e => set("category", e.target.value)} /></Field>
            <Field label="Grade to pass"><input type="number" min="0" max={data.maxGrade} value={data.passGrade} onChange={e => set("passGrade", Number(e.target.value))} /></Field>
            <Field label="Grading Method"><select value={data.method} onChange={e => set("method", e.target.value)}><option>Rubric</option><option>Direct grading</option></select></Field>
          </div>
          <div className="asgn-eval-switch-list">
            <Toggle label="Anonymous submissions (blind marking)" value={data.anonymous} onChange={v => set("anonymous", v)} />
            <Toggle label="Hide grader identity from students" value={data.hideGrader} onChange={v => set("hideGrader", v)} />
            <Toggle label="Use marking workflow" value={data.markingWorkflow} onChange={v => set("markingWorkflow", v)} />
            <Toggle label="Use marking allocation" value={data.markingAllocation} onChange={v => set("markingAllocation", v)} />
          </div>
        </EvaluationSection>

        {data.method === "Rubric" && (
          <EvaluationSection title="Rubric">
            <p className="asgn-eval-subheading">Assignment evaluation rubric – {data.maxGrade} marks</p>
            <div className="asgn-eval-field-grid">
              <Field label="Rubric Template"><select value={data.rubricTemplate} onChange={e => set("rubricTemplate", e.target.value)}><option>Default (marks)</option><option>Custom</option></select></Field>
              <Field label="Rubric name"><input value={data.rubricName} onChange={e => set("rubricName", e.target.value)} /></Field>
              <Field label="Rubric version"><input value={data.rubricVersion} onChange={e => set("rubricVersion", e.target.value)} /></Field>
            </div>
            <div className="asgn-eval-table-scroller" tabIndex={0} role="region" aria-label="Editable assignment rubric table">
              <table className="asgn-eval-table asgn-eval-rubric-table">
                <thead><tr><th>No.</th><th>Evaluation Parameter</th><th>What the evaluator should assess</th><th>Max Marks</th><th>Action</th></tr></thead>
                <tbody>{data.criteria.map((item, index) => (
                  <tr key={item.id}>
                    <td>{String(index + 1).padStart(2, "0")}</td>
                    <td><input aria-label={`Criterion ${index + 1} parameter`} value={item.title} onChange={e => setCriterion(item.id, { title: e.target.value })} /></td>
                    <td><input aria-label={`Criterion ${index + 1} description`} value={item.description} onChange={e => setCriterion(item.id, { description: e.target.value })} /></td>
                    <td><input aria-label={`Criterion ${index + 1} maximum marks`} type="number" min="0" step="1" value={item.marks} onChange={e => setCriterion(item.id, { marks: Number(e.target.value) })} /></td>
                    <td><button type="button" className="asgn-eval-remove" onClick={() => set("criteria", data.criteria.filter(c => c.id !== item.id))}>Remove</button></td>
                  </tr>
                ))}</tbody>
                <tfoot><tr><th colSpan={3}>Total</th><th>{rubricTotal}</th><th><span className={`asgn-eval-status ${rubricBalanced ? "is-balanced" : "is-warning"}`}>{rubricBalanced ? "Balanced" : "Adjust marks"}</span></th></tr></tfoot>
              </table>
            </div>
            <div className="asgn-eval-table-actions">
              <button type="button" className="asgn-eval-action-pill" onClick={addCriterion}>Add Parameters</button>
              <button type="button" className="asgn-eval-action-pill asgn-eval-save-pill" onClick={persist}>Save</button>
            </div>
          </EvaluationSection>
        )}

        <EvaluationSection title="Rules">
          <div className="asgn-eval-field-grid">
            <Field label="Mark entry mode"><select value={data.entryMode} onChange={e => set("entryMode", e.target.value)}><option>Direct marks per criterion</option><option>Grade levels</option></select></Field>
            <Field label="Final Grade uses"><select value={data.finalGradeUsers} onChange={e => set("finalGradeUsers", e.target.value)}><option>Latest attempt</option><option>Highest grade</option><option>Average grade</option></select></Field>
            <Field label="Results visibility"><select value={data.resultsVisibility} onChange={e => set("resultsVisibility", e.target.value)}><option>On publication</option><option>Immediately</option><option>Manual</option><option>Never</option></select></Field>
            <Field label="Late Submission"><select value={data.lateSubmission} onChange={e => set("lateSubmission", e.target.value)}><option>Apply configured penalty</option><option>No penalty</option><option>Not allowed</option></select></Field>
            {data.lateSubmission === "Apply configured penalty" && <Field label="Late Penalty (%)"><input type="number" min="0" max="100" value={data.latePenalty} onChange={e => set("latePenalty", Number(e.target.value))} /></Field>}
          </div>
          <div className="asgn-eval-switch-list">
            <Toggle label="Evaluator can enter marks directly (not restricted to fixed grade levels)" value={data.directMarks} onChange={v => set("directMarks", v)} />
            <Toggle label="Partial marks for every criterion" value={data.partialMarks} onChange={v => set("partialMarks", v)} />
            <Toggle label="Criterion-level comments" value={data.criterionComments} onChange={v => set("criterionComments", v)} />
            <Toggle label="Question-level comments" value={data.questionComments} onChange={v => set("questionComments", v)} />
            <Toggle label="Annotated feedback (upload reviewed document)" value={data.annotatedFeedback} onChange={v => set("annotatedFeedback", v)} />
            <Toggle label="Allow resubmission after evaluator feedback" value={data.resubmission} onChange={v => set("resubmission", v)} />
            <Toggle label="Lock rubric version once students begin" value={data.lockRubric} onChange={v => set("lockRubric", v)} />
            <Toggle label="Evaluation audit trail (evaluator, score changes, timestamps and reasons)" value={data.auditTrail} onChange={v => set("auditTrail", v)} />
            <Toggle label="Prevent changes after grade publication (authorized modifications are recorded)" value={data.preventChanges} onChange={v => set("preventChanges", v)} />
            <Toggle label="Allow students to preview rubric" value={data.previewRubric} onChange={v => set("previewRubric", v)} />
            <Toggle label="Hide scores from students" value={data.hideScores} onChange={v => set("hideScores", v)} />
          </div>
          <p className="asgn-eval-note">Originality is judged on evidence. An AI-detection percentage is not conclusive proof of misconduct.</p>
        </EvaluationSection>

        <EvaluationSection title="Weights">
          <p className="asgn-eval-subheading">Recommended weights by assignment type</p>
          <div className="asgn-eval-table-scroller" tabIndex={0} role="region" aria-label="Recommended assessment weights table">
            <table className="asgn-eval-table asgn-eval-weight-table">
              <thead><tr><th>No.</th><th>Evaluation criterion</th><th>Theory assignment</th><th>Case study</th><th>Technical Assignment</th></tr></thead>
              <tbody>{recommendedWeights.map((row, index) => <tr key={row[0]}><td>{String(index + 1).padStart(2, "0")}</td><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody>
              <tfoot><tr><th colSpan={2}>Total marks awarded</th><th>{recommendedWeights.reduce((n, r) => n + r[1], 0)}</th><th>{recommendedWeights.reduce((n, r) => n + r[2], 0)}</th><th>{recommendedWeights.reduce((n, r) => n + r[3], 0)}</th></tr></tfoot>
            </table>
          </div>
          <p className="asgn-eval-note">For technical assignments, use Practical Application to evaluate implementation, working outputs, calculations, or other subject-specific deliverables.</p>
        </EvaluationSection>

        <EvaluationSection title="Levels">
          <p className="asgn-eval-subheading">Performance grading levels</p>
          <div className="asgn-eval-table-scroller" tabIndex={0} role="region" aria-label="Performance grading levels table">
            <table className="asgn-eval-table asgn-eval-levels-table">
              <thead><tr><th>No.</th><th>Performance Level</th><th>Achievement</th><th>Evaluation description</th></tr></thead>
              <tbody>{gradingLevels.map((row, index) => <tr key={row[0]}><td>{String(index + 1).padStart(2, "0")}</td><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="asgn-eval-note">Guidance only – the evaluator enters marks directly and is not restricted to fixed grade choices.</p>
        </EvaluationSection>

        <EvaluationSection title="Final classification">
          <p className="asgn-eval-subheading">Final performance classification</p>
          <div className="asgn-eval-table-scroller" tabIndex={0} role="region" aria-label="Final performance classification table">
            <table className="asgn-eval-table asgn-eval-classification-table">
              <thead><tr><th>Total marks</th><th>Performance</th><th>Result</th></tr></thead>
              <tbody>{classifications.map(([range, label, minimum, maximum]) => {
                const result = minimum >= passPercentage ? "Pass" : maximum < passPercentage ? "Fail" : "Depends on mark";
                return <tr key={range}><td>{range}</td><td>{label}</td><td><span className={`asgn-eval-status ${result === "Pass" ? "is-balanced" : result === "Fail" ? "is-warning" : "is-neutral"}`}>{result}</span></td></tr>;
              })}</tbody>
            </table>
          </div>
          <p className="asgn-eval-note">These result bands use the configured passing mark of {data.passGrade}/{data.maxGrade}.</p>
        </EvaluationSection>

        <div className="asgn-eval-footer">
          <button type="button" className="asgn-eval-footer-button" onClick={() => router.push("/assessments/create/content")}>Back</button>
          <div className="asgn-eval-footer-actions">
            
            <button type="button" className="asgn-eval-footer-button is-continue" disabled={saving} onClick={continueToReview}>{saving ? "Saving..." : "Save & Continue"}</button>
          </div>
        </div>
      </div>
    </AssignmentShell>
  );
}
