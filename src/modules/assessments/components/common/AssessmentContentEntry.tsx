"use client";

/**
 * Uses the EXISTING MCQ empty Content screen styling. No type-specific editor,
 * evaluation or review is changed: Create Questions simply opens that editor.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "./sidebar/page";
import Header from "./header/Header";
import WizardStepLink from "./WizardStepLink";
import { assessmentStorage, getActiveAssessmentId, getAssessment } from "../../storage/assessment-storage";
import { getAssessmentAdapter } from "../../config/component-registry";
import "./steps/ContentStep/content.css";
import "./assessment-content-entry.css";

const ICONS = "/assets/assessmenticons/";
const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"] as const;
const SETTINGS = [
  { key: "randomize", label: "Randomize", icon: "shuffle.svg", enabled: false },
  { key: "shuffleAnswers", label: "Shuffle Answers", icon: "adjust-position.svg", enabled: false },
  { key: "flagQuestions", label: "Flag Questions", icon: "flag.svg", enabled: true },
  { key: "calculator", label: "Calculator", icon: "calculator.svg", enabled: true },
  { key: "formulaSheet", label: "Formula sheet", icon: "sigma.svg", enabled: true },
  { key: "scratchpad", label: "Scratchpad", icon: "sticky-note.svg", enabled: true },
] as const;
const CONTENT_KEYS: Record<string, string[]> = {
  "ai-assessment": ["aiContentDraft"],
  "ai-interviews-and-quizes": ["aiContentDraft"],
  "ai-interviews-quizzes": ["aiContentDraft"],
  "ai-interviews": ["aiContentDraft"],
  "ai-interview": ["aiContentDraft"],
  "ai-interviews-and-quizzes": ["aiContentDraft"],
  "assignment": ["assignmentContentDraft"],
  "short-answer": ["shortAnswerContentDraft"],
  "one-word": ["oneWordContentDraft"],
  "true-false": ["trueFalseContentDraft"],
  "fill-in-the-blanks": ["fillBlanksContentDraft"],
  "long-answer": ["longAnswerContentDraft"],
  "drag-and-drop": ["dragDropContentDraft"],
  "memory-game": ["memoryGameContentDraft"],
  "match-the-following": ["matchFollowingContentDraft"],
  "image-based": ["imageBasedContentDraft"],
};
const DETAIL_KEYS: Record<string, string[]> = {
  "ai-assessment": ["mcqAssessmentDraft"],
  "ai-interviews-and-quizes": ["mcqAssessmentDraft"],
  "ai-interviews-quizzes": ["mcqAssessmentDraft"],
  "ai-interviews": ["mcqAssessmentDraft"],
  "ai-interview": ["mcqAssessmentDraft"],
  "ai-interviews-and-quizzes": ["mcqAssessmentDraft"],
  "assignment": ["mcqAssessmentDraft"],
  "short-answer": ["shortAnswerAssessmentDraft"],
  "one-word": ["oneWordAssessmentDraft"],
  "true-false": ["trueFalseAssessmentDraft"],
  "fill-in-the-blanks": ["fillBlanksAssessmentDraft"],
  "long-answer": ["longAnswerAssessmentDraft"],
  "drag-and-drop": ["dragDropAssessmentDraft"],
  "memory-game": ["memoryGameAssessmentDraft"],
  "match-the-following": ["mcqAssessmentDraft"],
  "image-based": ["mcqAssessmentDraft"],
};
type Data = Record<string, unknown>;
const asData = (v: unknown): Data | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Data : null;
function read(key: string): Data {
  try { return asData(JSON.parse(assessmentStorage.getItem(key) || "{}")) || {}; } catch { return {}; }
}
function hasQuestionContent(value: unknown): boolean {
  if (typeof value === "string") return !!value.trim();
  const question = asData(value);
  if (!question) return false;
  for (const key of ["text", "question", "questionText", "title", "prompt", "questionHtml", "html"]) {
    if (typeof question[key] === "string" && String(question[key]).replace(/<[^>]*>/g, "").trim()) return true;
  }
  for (const key of ["pairs", "steps", "sequenceSteps", "matchPairs", "sortItems", "sortingItems", "imageItems", "cards", "options", "labels", "labelPins"]) {
    const values = question[key];
    if (!Array.isArray(values)) continue;
    if (values.some(v => {
      if (typeof v === "string") return !!v.trim();
      const item = asData(v);
      if (!item) return false;
      // An empty image slot or blank default option is not a saved question.
      return ["text", "label", "left", "right", "title", "question", "image", "leftImage", "rightImage", "src"].some(field => typeof item[field] === "string" && !!String(item[field]).trim());
    })) return true;
  }
  return false;
}
function savedQuestions(type: string): number {
  for (const key of CONTENT_KEYS[type] || [getAssessmentAdapter(type)?.draftKeys.content].filter((key): key is string => Boolean(key))) {
    const draft = read(key);
    const qs = Array.isArray(draft.questions) ? draft.questions : Array.isArray(draft.items) ? draft.items : [];
    const count = qs.filter(hasQuestionContent).length;
    if (count) return count;
  }
  return 0;
}
function value(data: Data, names: string[], defaultValue: number): number {
  for (const key of names) {
    const v = Number(data[key]);
    if (data[key] !== "" && data[key] != null && Number.isFinite(v) && v >= 0) return v;
  }
  return defaultValue;
}
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`mcqcIcon ${className}`} />;
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw new Error("Invalid quotation mark in the CSV file.");
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = ""; if (c === "\r" && source[i + 1] === "\n") i++;
    } else cell += c;
  }
  if (quoted) throw new Error("A quoted CSV value is not closed.");
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}
export default function AssessmentContentEntry({ typeCode, Editor }: { typeCode: string; Editor: ComponentType }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const csvInput = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<Record<string, boolean>>(() => Object.fromEntries(SETTINGS.map(item => [item.key, item.enabled])));
  useEffect(() => {
    const count = savedQuestions(typeCode);
    setCount(count);
    setEditing(new URLSearchParams(window.location.search).has("reviewEdit") || new URLSearchParams(window.location.search).has("edit"));
    setReady(true);
  }, [typeCode]);
  if (!ready) return null;
  if (editing) {
    if (typeCode === "short-answer" || typeCode === "one-word" || typeCode === "mcq") {
      const Builder = Editor as ComponentType<{startInBuilder?: boolean; onExitBuilder?: () => void}>;
      return <Builder startInBuilder onExitBuilder={() => { setCount(savedQuestions(typeCode)); setEditing(false); }} />;
    }
    return <Editor />;
  }
  const details = (DETAIL_KEYS[typeCode] || [getAssessmentAdapter(typeCode)?.draftKeys.details].filter((key): key is string => Boolean(key))).reduce<Data>((current, key) => ({ ...current, ...read(key) }), {});
  const assessmentId = getActiveAssessmentId();
  const record = assessmentId ? getAssessment(assessmentId) : undefined;
  const isAiAssessment = getAssessmentAdapter(typeCode)?.questionMode === "ai-interview";
  const plannedCount = value(details, ["questionCount", "totalQuestions", "questions"], record?.questions || (isAiAssessment ? 0 : 30));
  const plannedMarks = value(details, ["totalMarks", "marks"], record?.marks || (isAiAssessment ? 0 : plannedCount));
  const aiToggles = asData(details.toggles) || {};
  const aiDuration = aiToggles.timeLimit === true ? Number(String(details.timeLimit || "").match(/\d+/)?.[0]) || 0 : 0;
  const duration = isAiAssessment ? aiDuration : value(details, ["duration", "durationMinutes", "timeLimit", "totalTime"], 60);
  const passing = isAiAssessment ? value(read("aiEvaluationDraft"), ["passingScore"], -1) : value(details, ["passingScore", "passingPercentage"], 60);
  const openEditor = () => { setMessage(""); setEditing(true); };
  const importFillBlanks = async (file?: File) => {
    if (!file) return;
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error("Choose a CSV file.");
      const rows = parseCsv(await file.text());
      const headers = (rows.shift() || []).map(value => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
      const column = (name: string) => headers.indexOf(name);
      if (column("question") < 0 || column("option_a") < 0 || column("option_b") < 0) throw new Error("CSV needs question, option_a and option_b columns.");
      if (!rows.length) throw new Error("The CSV has no questions.");
      if (rows.length > plannedCount) throw new Error(`The CSV has ${rows.length} questions; the assessment is configured for ${plannedCount}.`);
      const existing = read("fillBlanksContentDraft");
      if (Array.isArray(existing.questions) && existing.questions.some(hasQuestionContent)) throw new Error("Existing questions were not replaced. Open them before importing.");
      const questions = rows.map((row, index) => {
        const get = (name: string) => column(name) < 0 ? "" : (row[column(name)] || "").trim();
        const text = get("question");
        if (!text) throw new Error(`Row ${index + 2}: enter a question.`);
        const options = ["option_a", "option_b", "option_c", "option_d"].map(get);
        while (options.length > 2 && !options[options.length - 1]) options.pop();
        const answers = get("correct_answer").split("|").map(answer => answer.trim()).filter(Boolean);
        const chosen = answers.map(answer => /^[a-d]$/i.test(answer) ? answer.toUpperCase().charCodeAt(0) - 65 : options.findIndex(option => option.toLowerCase() === answer.toLowerCase()));
        if (chosen.some(value => value < 0 || value >= options.length || !options[value])) throw new Error(`Row ${index + 2}: correct_answer must match an option or use A, B, C or D.`);
        return { type: "Fill in the Blanks", typeSelected: true, text, options, correct: chosen[0] ?? -1, blankCorrect: chosen, points: get("points") || String(value(details, ["marksPerQuestion"], 1)), difficulty: get("difficulty"), category: get("category"), bloom: get("bloom"), mandatory: true };
      });
      assessmentStorage.setItem("fillBlanksContentDraft", JSON.stringify({ ...existing, questions }));
      setMessage(""); setEditing(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import the CSV file."); }
    finally { if (csvInput.current) csvInput.current.value = ""; }
  };
  return <main className="mcqcAppShell">
    <div className="mcqcLayout"><Sidebar /><section className="mcqcMainContent">
      <div className="mcqcHeader"><Header /></div><div className="mcqcScrollArea"><div className="mcqcPageContent">
        <div className="mcqcBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" /><Link href="/assessments/create/details" className="mcqcBreadcrumbCurrent">Create Assessment</Link></div>
        <ol className="mcqcWizard" aria-label="Assessment creation progress">{STEPS.map((step, index) => <li key={step} className={`mcqcWizardStep ${index < 2 ? "mcqcWizardDone" : index === 2 ? "mcqcWizardActive" : ""}`}><WizardStepLink index={index} current={2}/><span className="mcqcWizardNumber"><span>{index + 1}</span></span><span className="mcqcWizardText">{step}</span></li>)}</ol>
        <header className="mcqcPageTitle"><p>Provide The Essential Details And Settings For Your Assessment.</p></header>
        <div className="mcqcColumns"><div className="mcqcLeftColumn"><section className="mcqcQuestionsPanel" aria-label="Questions"><h2>Questions ({count})</h2>
          <div className="mcqcEmptyState"><Icon name="package-open.svg" size={129} className="mcqcEmptyIcon"/><h3>{count ? "Questions Added" : "No Questions Added Yet"}</h3><p>{count ? "Open your saved questions to continue." : "Start by Adding Questions."}</p>
            <div className="mcqcActions">
              <button type="button" onClick={() => { if (typeCode !== "fill-in-the-blanks") { setMessage("Bulk Upload is not configured for this question type. Use Create Questions."); return; } setMessage("CSV columns: question, option_a, option_b, option_c, option_d, correct_answer, points, difficulty, category, bloom."); csvInput.current?.click(); }}><Icon name="upload.svg" />Bulk Upload</button>
              {typeCode === "fill-in-the-blanks" && <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={event => { void importFillBlanks(event.target.files?.[0]); }} />}
              <button type="button" onClick={() => router.push(`/assessments/create/ai?type=${encodeURIComponent(typeCode)}`) }><Icon name="ai-chip.svg" />Generate With AI</button>
              <button className="mcqcCreateButton" type="button" onClick={openEditor}><Icon name="plus.svg" size={24}/>{count ? "Edit Questions" : "Create Questions"}</button>
            </div>
          </div>
        </section></div><aside className="mcqcSummaryPanel" aria-label="Assessment summary and settings">
          <section className="mcqcSummarySection"><h2>Assessment Summary</h2>
            <div className="mcqcSummaryRow"><Icon name="quiz.svg" /><span>Questions</span><strong>{isAiAssessment && !plannedCount ? "—" : plannedCount}</strong></div>
            <div className="mcqcSummaryRow"><Icon name="checkmark-circle.svg" /><span>Total Marks</span><strong>{isAiAssessment && !plannedMarks ? "—" : plannedMarks}</strong></div>
            <div className="mcqcSummaryRow"><Icon name="alarm-clock.svg" /><span>Time</span><strong>{isAiAssessment ? (duration ? `${duration} Min` : "—") : <>{duration} Min</>}</strong></div>
            <div className="mcqcSummaryRow"><Icon name="locate-fixed.svg" /><span>Passing Score</span><strong>{isAiAssessment ? (passing < 0 ? "—" : `${passing}%`) : <>{passing}%</>}</strong></div>
          </section><section className="mcqcSettingsSection"><h2>Assessment Summary</h2>
            {SETTINGS.map(item => <div className="mcqcSettingRow" key={item.key}><Icon name={item.icon} size={19}/><span>{item.label}</span><button type="button" role="switch" aria-label={item.label} aria-checked={settings[item.key]} className={`mcqcSwitch ${settings[item.key] ? "mcqcSwitchOn" : ""}`} onClick={() => setSettings(old => ({ ...old, [item.key]: !old[item.key] }))}><span className="mcqcSwitchText">{settings[item.key] ? "ON" : "OFF"}</span><span className="mcqcSwitchKnob" /></button></div>)}
          </section>
        </aside></div>
        {message && <p className="mcqcMessage mcqcValidationError" role="alert">{message}</p>}
        <div className="mcqcContentEntryFooter"><button className="mcqcBack" type="button" onClick={() => router.push("/assessments/create/details")}>Back</button></div>
      </div></div>
    </section></div>
  </main>;
}
