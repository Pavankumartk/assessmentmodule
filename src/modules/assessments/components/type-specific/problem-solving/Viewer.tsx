"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import "./viewproblem.css";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import TextSubmitSuccess from "@/modules/assessments/components/viewer/TextSubmitSuccess";
import { releaseForAssessment } from "@/modules/assessments/components/viewer/assessment-result-bridge";
import { assessmentStorage, getActiveAssessmentId, resultPath, viewerPath, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
import { getDemoSession } from "@/modules/assessments/auth/demo-auth";

// Keep the icon folder and asset filenames used by the supplied viewer.
const ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "problemSolvingContentDraft",
  "problemSolvingQuestionsDraft",
  "problemSolvingQuestions",
  "problemSolvingDraft",
  "problemSolvingContent",
  "problemSolvingAssessmentContentDraft",
  "problemSolvingContentState",
  "problemContentDraft",
  "mcqContentDraft", // Compatibility fallback for older Problem Solving creator drafts.
];
const DETAILS_KEYS = [
  "mcqAssessmentDraft",
  "problemSolvingAssessmentDraft",
  "problemSolvingDetailsDraft",
  "problemSolvingDetails",
  "problemSolvingAssessmentDetails",
  "assessmentDetailsDraft",
];
const VIEWER_SESSION_KEY = "problemSolvingViewerState";
const VIEWER_RESULT_KEY = "problemSolvingViewerResult";

type SavedObject = Record<string, unknown>;

type AnswerKind = "number" | "word" | "sentence" | "text";

type ProblemStep = {
  id: string;
  label: string;
  marks: number;
  answerKind: AnswerKind;
  expectedAnswer?: string;
  placeholder?: string;
};

type ProblemQuestion = {
  id: string;
  heading: string;
  text: string;
  steps: ProblemStep[];
  points: number;
  bloom: string;
  hint: string;
  allowHint: boolean;
};

type ViewerDraft = {
  title: string;
  questions: ProblemQuestion[];
  durationSeconds: number;
  instructions: string[];
  maxAttempts: number;
  releaseMode: "immediate" | "scheduled" | "manual" | "never";
  releaseAt: string;
  passingScore: string;
};

type ViewerState = {
  signature: string;
  current: number;
  answers: Record<number, string[]>;
  flagged: number[];
  expiresAt: number;
  submitted: boolean;
  attemptNumber?: number;
};

type SubmissionResult = {
  score: number | null; maxMarks: number; answered: number; inProgress: number;
  remaining: number; total: number; flagged: number[]; submittedAt: string;
  timedOut: boolean; attemptNumber: number;
};

function flowScope() {
  return `${getActiveAssessmentId() || "active"}.${getDemoSession()?.userId || "learner"}`;
}
function stateKey() { return `${VIEWER_SESSION_KEY}.${flowScope()}`; }
function resultKey() { return `${VIEWER_RESULT_KEY}.${flowScope()}`; }
function historyKey() { return `problemSolvingViewerHistory.${flowScope()}`; }

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <img
      src={`${ICONS}${name}`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

// Load the original SVGs from public/assets/viewericons/. If one is missing,
// a local inline fallback prevents a broken-image symbol in the Hint card.
function HintAsset({ kind }: { kind: "idea" | "view" | "eye-off" }) {
  const [assetIndex, setAssetIndex] = useState(0);
  const candidates = kind === "idea" ? ["idea.svg", "idea-01.svg"]
    : kind === "view" ? ["view.svg", "eye.svg"]
    : ["eye-off.svg", "eyeoff.svg"];
  if (assetIndex < candidates.length) {
    return <img src={`${ICONS}${candidates[assetIndex]}`} width={kind === "idea" ? 28 : 20}
      height={kind === "idea" ? 28 : 20} alt="" aria-hidden="true"
      onError={() => setAssetIndex(index => index + 1)} />;
  }
  if (kind === "idea") return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4M9 15.7c0-2-3-3.5-3-7a6 6 0 0 1 12 0c0 3.5-3 5-3 7" />
      <path d="M12 1v1.5M4.2 4.2l1.1 1.1M1 11h2M20.5 11H23M18.7 5.3l1.1-1.1" />
    </svg>
  );
  if (kind === "view") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18M10.5 5.1A12 12 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.1 3.7" />
      <path d="M6.3 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.3 10.3 0 0 0 4-.8" />
      <path d="M10 10a3 3 0 0 0 4 4" />
    </svg>
  );
}

// Creator metadata takes precedence. Without metadata, only infer a type when
// the expected answer makes it unambiguous; otherwise keep unrestricted text.
function parseAnswerKind(value: unknown): AnswerKind | undefined {
  const token = textOf(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (["number", "numbers", "numeric", "numericbased", "numberbased", "decimal", "integer", "float", "digits", "numerical"].includes(token)) return "number";
  if (["word", "oneword", "singleword", "keyword", "onewordanswer"].includes(token)) return "word";
  if (["sentence", "sentences", "sentencebased", "paragraph", "essay", "explanation", "longanswer", "longtext", "textarea", "multiline"].includes(token)) return "sentence";
  if (["text", "shortanswer", "shorttext", "string", "words", "phrase", "freeform", "alphanumeric", "textbased"].includes(token)) return "text";
  return undefined;
}

function answerKindFor(step: SavedObject, question: SavedObject, expected: string | undefined): AnswerKind {
  const metadata = [
    step.answerType, step.answerKind, step.responseType, step.inputType,
    step.fieldType, step.format, step.valueType, step.type,
    question.answerType, question.answerKind, question.responseType,
    question.inputType, question.expectedType, question.answerFormat,
  ];
  for (const value of metadata) {
    const kind = parseAnswerKind(value);
    if (kind) return kind;
  }
  if (expected) {
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expected.trim())) return "number";
    if (/^[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*$/u.test(expected.trim())) return "word";
    if (/[.!?]$/.test(expected.trim()) && expected.trim().split(/\s+/).length > 2) return "sentence";
  }
  return "text";
}

function isAnswerValid(step: ProblemStep, value: string | undefined): boolean {
  const answer = (value ?? "").trim();
  if (!answer) return false;
  if (step.answerKind === "number") return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(answer) && Number.isFinite(Number(answer));
  if (step.answerKind === "word") return !/\s/.test(answer);
  return true;
}

function answerError(step: ProblemStep, value: string): string {
  if (!value.trim() || isAnswerValid(step, value)) return "";
  if (step.answerKind === "number") return "Enter a valid number (decimals and negatives are allowed).";
  if (step.answerKind === "word") return "Enter a single word without spaces.";
  return "";
}

function recordOf(value: unknown): SavedObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as SavedObject)
    : {};
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function firstText(data: SavedObject, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = textOf(data[key]);
    if (value) return value;
  }
  return fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readJson(keys: string[]): SavedObject {
  for (const key of keys) {
    try {
      const raw = assessmentStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return { questions: parsed };
      const data = recordOf(parsed);
      if (Object.keys(data).length) return data;
    } catch {
      // A malformed or unavailable key must not break the viewer.
    }
  }
  return {};
}

function durationToSeconds(data: SavedObject): number {
  const seconds = Number(data.durationSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);
  const raw = data.durationMinutes ?? data.duration ?? data.timeLimit ?? data.totalTime ?? data.time;
  if (typeof raw === "string" && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw.trim())) {
    const parts = raw.trim().split(":").map(Number);
    return parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  }
  const number = Number.parseFloat(String(raw ?? "60"));
  const multiplier = /hour|\bhr\b/i.test(String(raw)) ? 3600 : 60;
  return Number.isFinite(number) && number > 0 ? Math.round(number * multiplier) : 3600;
}

function questionEntries(data: SavedObject): unknown[] {
  const nestedData = recordOf(data.data);
  const assessment = recordOf(data.assessment);
  const formData = recordOf(data.formData);
  const problemData = recordOf(data.problemSolvingData);
  const candidates = [
    data.questions,
    data.problemSolvingQuestions,
    data.problemQuestions,
    data.items,
    data.questionList,
    formData.questions,
    problemData.questions,
    nestedData.questions,
    assessment.questions,
  ];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

function expectedFor(question: SavedObject, index: number): string | undefined {
  const candidates = [question.correctAnswers, question.expectedAnswers, question.stepAnswers, question.answerKey];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const answer = textOf(candidate[index]);
      if (answer) return answer;
    }
    const object = recordOf(candidate);
    const answer = textOf(object[String(index)] ?? object[String(index + 1)]);
    if (answer) return answer;
  }
  const numbered = index === 2
    ? ["finalCorrectAnswer", "correctFinalAnswer", "finalAnswer", "answer3", "step3Answer"]
    : [`step${index + 1}Answer`, `correctStep${index + 1}`, `answer${index + 1}`];
  const answer = firstText(question, numbered);
  return answer || undefined;
}

function normalizeQuestion(entry: unknown, index: number): ProblemQuestion | null {
  const raw = recordOf(entry);
  const text = firstText(raw, ["questionText", "problemText", "problem", "question", "text", "prompt", "description"],
    firstText(recordOf(raw.problem), ["text", "description", "questionText"]));
  if (!text) return null;

  const heading = firstText(raw, ["heading", "questionHeading", "category", "title"], "Problem Solving");
  const rawSteps = [raw.steps, raw.solutionSteps, raw.subQuestions, raw.parts, raw.fields]
    .find(Array.isArray) as unknown[] | undefined;
  const defaultLabels = [
    firstText(raw, ["step1Label", "step1Title", "step1Instruction"], "Step 1"),
    firstText(raw, ["step2Label", "step2Title", "step2Instruction"], "Step 2"),
    firstText(raw, ["finalAnswerLabel", "finalStepTitle"], "Final Answer"),
  ];
  const suppliedMarks = positiveNumber(raw.totalMarks ?? raw.points ?? raw.marks, 4);
  const defaults = [suppliedMarks / 4, suppliedMarks / 4, suppliedMarks / 2];
  const steps: ProblemStep[] = (rawSteps?.length ? rawSteps : defaultLabels).map((entryStep, i) => {
    const item = recordOf(entryStep);
    const defaultLabel = defaultLabels[i] ?? `Step ${i + 1}`;
    const name = typeof entryStep === "string"
      ? entryStep.trim()
      : firstText(item, ["label", "title", "stepTitle", "name", "prompt", "question"], defaultLabel);
    const answer = firstText(item, ["expectedAnswer", "correctAnswer", "expectedValue", "correctValue"])
      || expectedFor(raw, i);
    return {
      id: textOf(item.id) || `${index}-${i}`,
      label: name || defaultLabel,
      marks: positiveNumber(item.marks ?? item.points ?? item.weight ?? raw[`step${i + 1}Marks`], defaults[i] ?? 1),
      answerKind: answerKindFor(item, raw, answer),
      ...(firstText(item, ["placeholder", "inputPlaceholder"]) ? { placeholder: firstText(item, ["placeholder", "inputPlaceholder"]) } : {}),
      ...(answer ? { expectedAnswer: answer } : {}),
    };
  });

  const hintRecord = recordOf(raw.hintDetails);
  const hint = firstText(raw, ["hint", "hintText", "hintBefore", "hintBeforeQuestion", "questionHint"],
    firstText(hintRecord, ["text", "hint", "description"]));
  return {
    id: textOf(raw.id) || `problem-${index}`,
    heading,
    text,
    steps,
    points: positiveNumber(raw.totalMarks ?? raw.points ?? raw.marks, steps.reduce((sum, step) => sum + step.marks, 0)),
    bloom: firstText(raw, ["bloom", "bloomTaxonomy", "bloomsTaxonomy", "taxonomy"], "Analyse"),
    hint,
    allowHint: !!hint && raw.allowHint !== false && raw.showHint !== false,
  };
}

function loadViewerDraft(): ViewerDraft {
  const content = readJson(CONTENT_KEYS);
  const details = readJson(DETAILS_KEYS);
  const evaluation = readJson(["problemSolvingEvaluationDraft", "mcqAssessmentEvaluationDraft", "assessmentEvaluationDraft"]);
  const release = firstText({...details,...evaluation}, ["resultAvailability", "resultsAvailability", "resultRelease", "resultsRelease", "resultsVisibility", "resultMode", "showResults"], "immediately").toLowerCase();
  const releaseMode: ViewerDraft["releaseMode"] = release.includes("never") ? "never" : release.includes("manual") || release.includes("teacher") ? "manual" : release.includes("schedule") || release.includes("later") ? "scheduled" : "immediate";
  const releaseAt = firstText({...details,...evaluation}, ["resultsReleaseDate", "resultReleaseDate", "releaseAt", "scheduledResultsAt", "resultsScheduledDate"]);
  const maxAttempts = Math.max(1, Math.min(20, positiveNumber(details.attemptsAllowed ?? details.maxAttempts ?? details.numberOfAttempts ?? evaluation.attemptsAllowed, 2)));
  const passingRaw = firstText({...details,...evaluation}, ["passingScore", "passPercentage", "passingPercentage", "gradeToPass"], "60%");
  const passingScore = passingRaw.includes("%") ? passingRaw : `${passingRaw}%`;
  const instructions = creatorInstructionLines(details.instructions, details.descriptionInstructions, details.instructionsToLearners, details.learnerInstructions, details.description);
  const saved = questionEntries(content);
  if (!saved.length) return {title: firstText(details, ["assessmentTitle", "assessmentName", "title", "name"], "Problem Solving"),questions:[],durationSeconds:durationToSeconds(details),instructions,maxAttempts,releaseMode,releaseAt,passingScore};
  const questions = saved.flatMap((entry, index) => {
    const question = normalizeQuestion(entry, index);
    return question ? [question] : [];
  });
  return {
    title: firstText(details, ["assessmentTitle", "assessmentName", "title", "name"],
      firstText(content, ["assessmentTitle", "assessmentName", "title", "name"], "Problem Solving")),
    questions,
    durationSeconds: durationToSeconds(Object.keys(details).length ? details : content),
    instructions,maxAttempts,releaseMode,releaseAt,passingScore,
  };
}

function formatTime(seconds: number): [string, string, string] {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map(number => String(number).padStart(2, "0")) as [string, string, string];
}

function Stopwatch({ seconds }: { seconds: number }) {
  const parts = formatTime(seconds);
  return (
    <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
      {parts.map((part, i) => (
        <span className="viewerTimeGroup" key={i}>
          {i > 0 && <span className="viewerTimeColon">:</span>}
          {part.split("").map((digit, j) => (
            <span className="viewerTimeDigit" key={j}>{digit}</span>
          ))}
        </span>
      ))}
    </div>
  );
}

function filledCount(question: ProblemQuestion | undefined, values: string[] | undefined): number {
  if (!question) return 0;
  return question.steps.filter((step, index) => isAnswerValid(step, values?.[index])).length;
}
function hasAttempt(values: string[] | undefined): boolean {
  return Boolean(values?.some(value => typeof value === "string" && value.trim().length > 0));
}
function questionCompleted(question: ProblemQuestion | undefined, values: string[] | undefined): boolean {
  return !!question && question.steps.length > 0 && filledCount(question, values) === question.steps.length;
}
function signatureOf(draft: ViewerDraft): string {
  return JSON.stringify([draft.title, draft.questions.map(q => [q.id, q.text, q.steps.map(s => s.label)])]);
}

/** Problem Solving learner-flow screens. Styled only inside .viewProblemApp. */
type PsDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  kind?: "danger" | "success" | "standard";
  children?: import("react").ReactNode;
};
function PsDialog({ title, description, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, kind = "standard", children }: PsDialogProps) {
  return <div className="psModalBackdrop" onMouseDown={(event: import("react").MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget && kind !== "success") onCancel(); }}>
    <section className="psModalCard" role="dialog" aria-modal="true" aria-labelledby="ps-modal-heading" aria-describedby="ps-modal-description">
      <span className={`psModalSymbol psModalSymbol-${kind}`} aria-hidden="true">{kind === "success" ? "✓" : kind === "danger" ? "!" : "?"}</span>
      <h2 id="ps-modal-heading">{title}</h2>
      <p id="ps-modal-description">{description}</p>
      {children}
      <div className="psModalActions">
        <button type="button" className="viewerExamButton" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="viewerExamButton viewerNext" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>;
}

// Uses the same summary cards, icons and visual system as the existing
// learner assessment Instructions pages. No new design system is introduced.
function PsInstructionStat({label,value,icon,tone}:{label:string;value:string;icon:string;tone:string}) {
  return <div className={`viewerStat viewerStat--${tone}`}>
    <span className="viewerStatIcon"><Icon name={icon} size={24}/></span>
    <div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div>
  </div>;
}

export default function ViewProblemPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ViewerDraft>({title:"Problem Solving",questions:[],durationSeconds:3600,instructions:[],maxAttempts:2,releaseMode:"immediate",releaseAt:"",passingScore:"60%"});
  const [stage,setStage] = useState<"instructions"|"test"|"results">("instructions");
  const [accepted,setAccepted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [hintOpen, setHintOpen] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [releasePolicy,setReleasePolicy] = useState<ReturnType<typeof releaseForAssessment> | null>(null);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  const questions = draft.questions;
  const total = questions.length;
  const question = questions[current];
  const signature = useMemo(() => signatureOf(draft), [draft]);
  const answered = questions.filter((q, i) => questionCompleted(q, answers[i])).length;
  const inProgress = questions.filter((q, i) => hasAttempt(answers[i]) && !questionCompleted(q, answers[i])).length;
  const remaining = Math.max(0, total - answered);
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;

  useEffect(() => {
    const loaded = loadViewerDraft();
    const loadedSignature = signatureOf(loaded);
    const time = Date.now();
    let saved: Partial<ViewerState> = {};
    try {
      const scoped = assessmentStorage.getItem(stateKey());
      const legacy = assessmentStorage.getItem(`${VIEWER_SESSION_KEY}.${getDemoSession()?.userId || "learner"}`);
      saved = recordOf(JSON.parse(scoped || legacy || "{}")) as Partial<ViewerState>;
    } catch {
      // Invalid session data starts a fresh attempt.
    }
    setDraft(loaded);
    setNow(time);
    try {
      const scopedResult = assessmentStorage.getItem(resultKey());
      const legacyResult = saved.signature === loadedSignature && saved.submitted
        ? assessmentStorage.getItem(`${VIEWER_RESULT_KEY}.${getDemoSession()?.userId || "learner"}`) : null;
      const fromStorage = recordOf(JSON.parse(scopedResult || legacyResult || "{}"));
      if (typeof fromStorage.submittedAt === "string") setSubmissionResult(fromStorage as SubmissionResult);
    } catch { /* Results can be unavailable until the first submission. */ }
    const retryFlag = new URLSearchParams(window.location.search).get("retry");
    const cameFromRetry = retryFlag !== null && retryFlag !== "0" && retryFlag !== "false";
    const lastAttempt = Math.max(1,Number(saved.attemptNumber)||1);
    if (cameFromRetry && saved.signature === loadedSignature && saved.submitted && lastAttempt < loaded.maxAttempts) {
      setCurrent(0);setAnswers({});setFlagged([]);setExpiresAt(0);
      setSubmitted(false);setStage("instructions");setAccepted(false);
      setAttemptNumber(lastAttempt+1);setSubmissionResult(null);
      // Clear retry query after starting a new draft; refresh must not consume
      // an additional attempt.
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } else if (saved.signature === loadedSignature) {
      setCurrent(Math.min(Math.max(Number(saved.current) || 0, 0), Math.max(loaded.questions.length - 1, 0)));
      setAnswers(recordOf(saved.answers) as Record<number, string[]>);
      setFlagged(Array.isArray(saved.flagged) ? saved.flagged.filter(x => Number.isInteger(x) && x >= 0 && x < loaded.questions.length) : []);
      setExpiresAt(Number(saved.expiresAt) || 0);
      setStage(saved.submitted ? "results" : Number(saved.expiresAt)>0 ? "test" : "instructions");
      setSubmitted(Boolean(saved.submitted));
      setAttemptNumber(Math.max(1, Number(saved.attemptNumber) || 1));
    } else {
      setExpiresAt(0);
      setStage("instructions");
      setAttemptNumber(1);
      setSubmitted(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || submitted) return;
    if(stage!=="test" || !expiresAt)return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted, stage, expiresAt]);

  useEffect(() => {
    if (!ready) return;
    const state: ViewerState = { signature, current, answers, flagged, expiresAt, submitted, attemptNumber };
    try { assessmentStorage.setItem(stateKey(), JSON.stringify(state)); }
    catch { /* The viewer remains usable if browser storage is blocked. */ }
  }, [ready, signature, current, answers, flagged, expiresAt, submitted, attemptNumber]);

  const finish = useCallback((timedOut: boolean) => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    if (submitted) return;
    const allSteps = questions.flatMap((q, qi) => q.steps.map((step, si) => ({
      step,
      expected: step.expectedAnswer,
      actual: answers[qi]?.[si] ?? "",
    })));
    // Free-form explanations require grading by a teacher; never mark them
    // wrong just because their wording differs from a model sentence.
    const fullyGradable = allSteps.length > 0 && allSteps.every(({ step, expected }) =>
      expected !== undefined && step.answerKind !== "sentence");
    const score = fullyGradable ? allSteps.reduce((sum, { step, expected, actual }) => {
      if (!isAnswerValid(step, actual) || expected === undefined) return sum;
      const matches = step.answerKind === "number"
        ? Number(actual.trim()) === Number(expected.trim())
        : actual.trim().toLocaleLowerCase().replace(/\s+/g, " ") === expected.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      return sum + (matches ? step.marks : 0);
    }, 0) : null;
    const result = {
      title: draft.title,
      type: "Problem Solving",
      answers,
      questionIds: questions.map(q => q.id),
      score,
      maxMarks: questions.reduce((sum, q) => sum + q.points, 0),
      answered,
      inProgress,
      remaining,
      total,
      flagged,
      timedOut,
      attemptNumber,
      submittedAt: new Date().toISOString(),
    };
    // The existing Results page reads this standard shape, as it does for
    // Clickable Hotspot and the other assessment viewers. Written answers
    // stay pending unless every required step is objectively gradable.
    const resultQuestions = questions.map((item, index) => {
      const currentAnswers = answers[index] ?? [];
      const wasAnswered = hasAttempt(currentAnswers);
      const isGradable = item.steps.length > 0 && item.steps.every(step => step.expectedAnswer !== undefined && step.answerKind !== "sentence");
      const earned = isGradable ? item.steps.reduce((sum, step, stepIndex) => {
        const actual = currentAnswers[stepIndex] ?? "";
        if (!step.expectedAnswer || !isAnswerValid(step, actual)) return sum;
        const correct = step.answerKind === "number"
          ? Number(actual.trim()) === Number(step.expectedAnswer.trim())
          : actual.trim().toLocaleLowerCase().replace(/\s+/g, " ") === step.expectedAnswer.trim().toLocaleLowerCase().replace(/\s+/g, " ");
        return sum + (correct ? step.marks : 0);
      }, 0) : null;
      return {
        id:item.id, text:item.text, points:item.points, bloom:item.bloom, hint:item.hint,
        options:wasAnswered ? [item.steps.map((step, stepIndex)=>`${step.label}: ${currentAnswers[stepIndex]?.trim() || "Not answered"}`).join("\n")] : [],
        selected:wasAnswered ? 0 : null, correct:isGradable && earned===item.points ? 0 : null,
        gradingStatus:!wasAnswered ? "unanswered" : earned===null ? "pending" : earned>=item.points ? "correct" : "incorrect",
        earnedMarks:earned, flagged:flagged.includes(index),
        problemAnswers:currentAnswers,
      };
    });
    const maxMarks = questions.reduce((sum, q) => sum + q.points, 0);
    const sharedResult = {
      attemptId: String(Date.now()), assessmentId:getActiveAssessmentId(),
      title:draft.title, assessmentType:"problem-solving-challenge", questions:resultQuestions,
      totalQuestions:total,
      correctAnswers:resultQuestions.filter(q=>q.gradingStatus==="correct").length,
      incorrectAnswers:resultQuestions.filter(q=>q.gradingStatus==="incorrect").length,
      unanswered:resultQuestions.filter(q=>q.gradingStatus==="unanswered").length,
      pendingCount:resultQuestions.filter(q=>q.gradingStatus==="pending").length,
      gradingStatus:score===null ? "Pending" : "Calculated",
      totalMarks:maxMarks, earnedMarks:score, scorePercent:score===null ? null : (maxMarks ? Math.round(100*score/maxMarks):0),
      totalSeconds:draft.durationSeconds,
      usedSeconds:Math.max(0,draft.durationSeconds-(timedOut?0:Math.max(0,Math.ceil((expiresAt-Date.now())/1000)))),
      flaggedQuestionIndexes:flagged, submittedAt:result.submittedAt,
      retryAttemptsUsed:attemptNumber, retryAttemptsAllowed:draft.maxAttempts,
      retryDurationMinutes:Math.ceil(draft.durationSeconds/60),
    };
    try { assessmentStorage.setItem(resultKey(), JSON.stringify(result));
      const user = getDemoSession()?.userId || "learner";
      assessmentStorage.setItem("viewerAssessmentResult", JSON.stringify(sharedResult));
      assessmentStorage.setItem(`viewerAssessmentResult.${user}`, JSON.stringify(sharedResult));
      const previousAttempts = JSON.parse(assessmentStorage.getItem("viewerAttempts") || "[]");
      const attemptList: unknown[] = Array.isArray(previousAttempts) ? previousAttempts : [];
      assessmentStorage.setItem("viewerAttempts", JSON.stringify([...attemptList, sharedResult]));
      updateAssessment({attemptCount:nextAttemptCount(attemptList.length+1)});
      assessmentStorage.setItem("viewerAttemptDraft", JSON.stringify({finished:true}));
      const history = JSON.parse(assessmentStorage.getItem(historyKey()) || "[]");
      const list: unknown[] = Array.isArray(history) ? history : [];
      assessmentStorage.setItem(historyKey(), JSON.stringify([...list.filter(row=>recordOf(row).attemptNumber!==attemptNumber),result]));
    }
    catch { /* Still show confirmation if storage is unavailable. */ }
    setSubmissionResult(result);
    setSubmitted(true);
    setStage("results");
    setShowSubmitConfirm(false);
    setReleasePolicy(releaseForAssessment("problem-solving-challenge"));
    setShowSuccess(true);
    setNotice(timedOut
      ? "Time is up. Your assessment has been submitted."
      : "Your assessment has been submitted successfully.");
  }, [submitted, questions, answers, draft.title, draft.durationSeconds, draft.maxAttempts, answered, inProgress, remaining, total, flagged, attemptNumber, expiresAt]);

  useEffect(() => {
    if (ready && stage==="test" && expiresAt > 0 && secondsLeft <= 0 && !submitted) finish(true);
  }, [ready, stage, expiresAt, secondsLeft, submitted, finish]);


  // Like other assessment viewers, reopening a submitted attempt goes to the
  // shared Results route. Do not navigate while the success popup is open.
  useEffect(() => {
    if (!ready || !submitted || showSuccess) return;
    router.replace(resultPath());
  }, [ready, submitted, showSuccess, router]);

  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    setCurrent(index);
    setHintOpen(true);
    if (!submitted) setNotice("");
  };

  const changeAnswer = (stepIndex: number, value: string) => {
    if (submitted || !question) return;
    setAnswers(old => ({
      ...old,
      [current]: question.steps.map((_, i) => i === stepIndex ? value : (old[current]?.[i] ?? "")),
    }));
    setNotice("");
  };

  const submit = () => {
    if (submitted || !total) return;
    setShowSubmitConfirm(true);
  };

  const retryAssessment = () => {
    if (!submitted || attemptNumber >= draft.maxAttempts) return;
    setShowRetryConfirm(false);
    setShowSuccess(false);
    setReleasePolicy(null);
    setSubmitted(false);
    setStage("instructions");
    setAccepted(false);
    setExpiresAt(0);
    setCurrent(0);
    setFlagged([]);
    setAnswers({});
    setHintOpen(true);
    setNotice("");
    setNow(Date.now());
    setAttemptNumber(previous=>previous+1);
  };

  const startAssessment=()=>{
    if(!accepted || !questions.length || submitted)return;
    const expires=Date.now()+draft.durationSeconds*1000;
    setExpiresAt(expires);setNow(Date.now());setStage("test");
  };
  if(!ready)return null;
  if(stage==="instructions" && !submitted){
    const totalMarks=questions.reduce((sum,q)=>sum+q.points,0);
    const lines=draft.instructions.length ? draft.instructions : [
      "Read each problem and its required solution steps carefully.",
      "Enter numbers, words, or written explanations in the requested answer fields.",
      "Use the navigator to move between questions and flag questions for review.",
      "The timer begins only when you select Start Assessment.",
      "Check your answers before submitting. A submitted attempt cannot be edited.",
      "Your assessment is automatically submitted if the time expires."
    ];
    return <main className="superAdminPage institutionAdminPage viewerAppShell viewProblemApp">
      <div className="dashboardLayout viewerLayout"><Sidebar/><section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header/></div>
        <div className="institutionScrollArea viewerScroll"><div className="pageContent institutionPageContent viewerContent">
          <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
            <Link href="/learner">Dashboard</Link><Icon name="arrow-right-double.svg" size={24}/>
            <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={24}/>
            <strong>{draft.title}</strong>
          </nav>
          <div className="viewerPageHeading"><h1>{draft.title}</h1><p>Problem-Solving Challenge</p></div>
          <div className="viewerColumns">
            <aside className="viewerSummary" aria-label="Assessment summary">
              <PsInstructionStat label="Total Questions" value={String(total).padStart(2,"0")} icon="list.svg" tone="blue"/>
              <PsInstructionStat label="Total Marks" value={String(totalMarks)} icon="star-award.svg" tone="orange"/>
              <PsInstructionStat label="Total Time" value={`${Math.ceil(draft.durationSeconds/60)} Minutes`} icon="alarm-clock.svg" tone="purple"/>
              <PsInstructionStat label="Passing Score" value={draft.passingScore} icon="checkmark-circle.svg" tone="green"/>
              <PsInstructionStat label="Attempts" value={`${attemptNumber} of ${draft.maxAttempts}`} icon="remove-circle.svg" tone="red"/>
            </aside>
            <div className="viewerRightColumn">
              <section className="viewerInstructions" aria-labelledby="ps-instructions-heading">
                <h2 id="ps-instructions-heading">Instructions</h2>
                <ol>{lines.map((line,index)=><li key={index}>{index+1}. {line}</li>)}</ol>
                {!questions.length && <p role="alert" className="viewerInlineNotice">No Problem Solving questions were found for this assessment. Contact your instructor.</p>}
              </section>
              <section className="viewerConfirmation" aria-label="Confirm instructions">
                <label className="viewerAgreement">
                  <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
                  <span className="viewerCheckboxIcon" aria-hidden="true"/>
                  <span>I have read and understood the instructions</span>
                </label>
                <button type="button" className="viewerStart" disabled={!accepted || !questions.length} onClick={startAssessment}>Start Assessment</button>
              </section>
            </div>
          </div>
        </div></div></section></div>
    </main>;
  }
  if(submitted && !showSuccess){
    const graded = submissionResult?.score !== null && submissionResult?.score !== undefined;
    const policyAllowsResults = draft.releaseMode === "immediate" || (draft.releaseMode === "scheduled" && Boolean(draft.releaseAt) && new Date(draft.releaseAt).getTime() <= Date.now());
    const canShowGrade = graded && policyAllowsResults;
    const canRetry = attemptNumber < draft.maxAttempts;
    const resultAnswered = submissionResult?.answered ?? answered;
    const resultTotal = submissionResult?.total ?? total;
    const resultMax = submissionResult?.maxMarks ?? questions.reduce((sum, q) => sum + q.points, 0);
    const gradeLabel = draft.releaseMode === "never" ? "Results not released to learners"
      : draft.releaseMode === "manual" ? "Awaiting evaluator release"
      : draft.releaseMode === "scheduled" && !policyAllowsResults ? (draft.releaseAt ? `Results available after ${new Date(draft.releaseAt).toLocaleString()}` : "Results will be released on the configured date")
      : !graded ? "Pending evaluator review" : "Result available";
    return <main className="superAdminPage institutionAdminPage viewerAppShell viewProblemApp">
      <div className="dashboardLayout viewerLayout"><Sidebar/><section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header/></div>
        <div className="institutionScrollArea viewerScroll"><div className="pageContent institutionPageContent viewerContent">
          <nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href="/learner">Dashboard</Link><span>»</span><strong>Assessment Results</strong></nav>
          <div className="psResultPageHeading"><h1>Assessment Results</h1><p>{draft.title}</p></div>
          <section className="psResultSummary" aria-label="Submission summary">
            <div className="psResultCheck" aria-hidden="true">✓</div>
            <div><h2>Assessment Submitted Successfully</h2><p>{notice || "Your answers have been saved. You cannot change this submitted attempt."}</p>
              <p className="psSubmittedTime">Submitted: {submissionResult?.submittedAt ? new Date(submissionResult.submittedAt).toLocaleString() : "Saved"} • Attempt {attemptNumber}</p>
            </div>
          </section>
          <div className="psResultsStats">
            <div><span>Total Questions</span><strong>{resultTotal}</strong></div>
            <div><span>Answered</span><strong>{resultAnswered}</strong></div>
            <div><span>Remaining</span><strong>{submissionResult?.remaining ?? remaining}</strong></div>
            <div><span>Flagged</span><strong>{submissionResult?.flagged?.length ?? flagged.length}</strong></div>
          </div>
          <section className="psResultCard" aria-label="Grade feedback">
            <div className="psResultSectionHead"><h2>Grade Feedback</h2><span className={canShowGrade ? "psResultPill is-green" : "psResultPill"}>{canShowGrade ? "Available" : "Pending"}</span></div>
            {canShowGrade ? <><p className="psResultMarks"><strong>{submissionResult?.score}</strong> / {resultMax} marks</p><p>Automatically checked answers are shown where an answer key was provided.</p></> : <p>{gradeLabel}. {graded && !policyAllowsResults ? "Marks are hidden until the release policy allows them." : "Your work has been recorded."}</p>}
          </section>
          <section className="psResultCard" aria-label="Question review">
            <div className="psResultSectionHead"><h2>Question Review</h2><span>{resultTotal} Questions</span></div>
            <div className="psReviewQuestionList">
              {questions.map((item, index) => {
                const response = answers[index];
                const complete = questionCompleted(item, response);
                const partial = hasAttempt(response) && !complete;
                const status = complete ? "Answered" : partial ? "Partially answered" : "Not answered";
                return <details key={item.id} className="psReviewQuestion">
                  <summary><span className="psReviewQNumber">{String(index+1).padStart(2,"0")}</span><strong>Question {index+1}</strong>
                    <span className={`psReviewStatus ${complete ? "is-green" : partial ? "is-orange" : ""}`}>{status}</span>
                    {flagged.includes(index) && <span className="psReviewFlag">Flagged</span>}</summary>
                  <div className="psReviewAnswers"><p>{item.text}</p>{item.steps.map((step, sIndex) => <div key={step.id+sIndex}><strong>{step.label}</strong><p>{response?.[sIndex]?.trim() || "Not answered"}</p></div>)}</div>
                </details>;
              })}
            </div>
          </section>
          <div className="psResultsActions"><button type="button" className="viewerExamButton" onClick={()=>router.push("/learner")}>Back to Dashboard</button>
            <button type="button" className="viewerExamButton viewerNext" disabled={!canRetry} onClick={()=>setShowRetryConfirm(true)}>{canRetry ? "Retry Test" : "No Attempts Left"}</button></div>
          {!canRetry && <p className="psAttemptsHelp">All {draft.maxAttempts} allowed {draft.maxAttempts === 1 ? "attempt" : "attempts"} have been used.</p>}
        </div></div></section></div>

        {showRetryConfirm && <PsDialog kind="standard" title="Retry Assessment?" description={`You are starting attempt ${attemptNumber+1} of ${draft.maxAttempts}. Your previous submission will remain saved and this attempt will begin with Instructions.`} cancelLabel="Cancel" confirmLabel="Retry Test" onCancel={()=>setShowRetryConfirm(false)} onConfirm={retryAssessment}/>}
    </main>;
  }
  return (
    <main className="superAdminPage institutionAdminPage viewerAppShell viewProblemApp">
      <div className="dashboardLayout viewerLayout">
        <Sidebar />
        <section className="mainContent viewerMain">
          <div className="viewerSharedHeader"><Header /></div>
          <div className="institutionScrollArea viewerScroll">
            <div className="pageContent institutionPageContent viewerContent">
              <div className="viewerExamTop">
                <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
                  <Link href="/super_admin">Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
                  <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20} />
                  <strong>{draft.title}</strong>
                </nav>
                <Stopwatch seconds={secondsLeft} />
              </div>
              <div className="viewerPageHeading viewerExamHeading"><h1>{draft.title}</h1></div>
              <div className="viewerExamGrid">
                <section className="viewerExamCard viewerQuestionCard" aria-label="Assessment question">
                  <div className="viewerProgressArea">
                    <div className="viewerProgressLabel">
                      <strong>{total ? current + 1 : 0}<span>/{total}</span></strong>
                      <strong className="viewerMarks">{question?.points ?? 0} Marks</strong>
                    </div>
                    <div className="viewerProgressRow">
                      <div className="viewerProgressTrack" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Completed questions">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <strong>{progress}%</strong>
                    </div>
                  </div>

                  {question ? <>
                    <div className="viewerQuestionHeading">
                      <h2>Question {current + 1}</h2>
                      <h3>{question.heading}</h3>
                      <p>{question.text}</p>
                    </div>
                    <div className="viewerProblemPanel" aria-label="Problem-solving steps">
                      {question.steps.map((step, index) => (
                        <div className="viewerProblemStep" key={`${question.id}-${step.id}-${index}`}>
                          <div className="viewerProblemStepHeading">
                            <label htmlFor={`problem-answer-${current}-${index}`}>{step.label}</label>
                            <span>{step.marks} {step.marks === 1 ? "Mark" : "Marks"}</span>
                          </div>
                          {step.answerKind === "sentence" ? (
                            <textarea
                              id={`problem-answer-${current}-${index}`}
                              className="viewerProblemInput viewerProblemTextarea"
                              rows={2}
                              value={answers[current]?.[index] ?? ""}
                              placeholder={step.placeholder ?? "Enter your answer for this step"}
                              onChange={event => changeAnswer(index, event.target.value)}
                              disabled={submitted}
                              aria-label={`${step.label} – sentence answer`}
                            />
                          ) : (
                            <input
                              id={`problem-answer-${current}-${index}`}
                              className="viewerProblemInput"
                              type="text"
                              inputMode={step.answerKind === "number" ? "decimal" : "text"}
                              value={answers[current]?.[index] ?? ""}
                              placeholder={step.placeholder ?? "Enter your answer for this step"}
                              onChange={event => changeAnswer(index, event.target.value)}
                              disabled={submitted}
                              autoComplete="off"
                              spellCheck={step.answerKind !== "number"}
                              aria-label={`${step.label} – ${step.answerKind} answer`}
                              aria-invalid={Boolean(answerError(step, answers[current]?.[index] ?? ""))}
                            />
                          )}
                          {answerError(step, answers[current]?.[index] ?? "") && (
                            <p className="viewerProblemError" role="status">
                              {answerError(step, answers[current]?.[index] ?? "")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {question.hint && question.allowHint && (
                      <section className="viewerHintBox">
                        <button type="button" className="viewerHintToggle" aria-expanded={hintOpen}
                          aria-label={hintOpen ? "Hide hint" : "Show hint"}
                          onClick={() => setHintOpen(value => !value)}>
                          <span className="viewerHintTitle">
                            <span className="viewerHintIcon"><HintAsset kind="idea" /></span>
                            <span>Hint{hintOpen && <small>{question.hint}</small>}</span>
                          </span>
                          <span className="viewerHintVisibility" aria-hidden="true">
                            {hintOpen ? <HintAsset key="view" kind="view" /> : <HintAsset key="eye-off" kind="eye-off" />}
                          </span>
                        </button>
                      </section>
                    )}
                    <div className="viewerQuestionSettings">
                      <div><span className="viewerBloomLabel">Bloom’s Taxonomy</span><span className="viewerBloomValue">{question.bloom}</span></div>
                      <button type="button" className={`viewerFlagButton ${flagged.includes(current) ? "isFlagged" : ""}`}
                        disabled={submitted}
                        aria-pressed={flagged.includes(current)}
                        onClick={() => setFlagged(old => old.includes(current) ? old.filter(i => i !== current) : [...old, current])}>
                        <Icon name="flag.svg" size={22} />{flagged.includes(current) ? "Remove flag" : "Flag for review"}
                      </button>
                    </div>
                    {notice && <p className="viewerInlineNotice" role="status">{notice}</p>}
                    <div className="viewerExamActions">
                      {current > 0 && <button type="button" className="viewerExamButton" disabled={current === 0} onClick={() => goTo(current - 1)}>
                        <Icon name="arrowleft.svg" />Previous
                      </button>}
                      <button type="button" className="viewerExamButton viewerNext" disabled={submitted}
                        onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                        {current === total - 1 ? "Submit" : "Next"}<Icon name="arrowrightg.svg" />
                      </button>
                    </div>
                  </> : <p className="viewerInlineNotice">No valid problem-solving questions were found in the saved draft.</p>}
                </section>

                <aside className="viewerExamCard viewerNavigator">
                  <h2>Question Navigator</h2>
                  <div className="viewerQuestionTiles" aria-label="Choose question">
                    {questions.map((item, index) => {
                      const complete = questionCompleted(item, answers[index]);
                      const partial = hasAttempt(answers[index]) && !complete;
                      const state = index === current ? "current" : complete ? "completed" : partial ? "in-progress" : "remaining";
                      return (
                        <button type="button" key={item.id} className={`viewerQuestionTile is-${state}`}
                          aria-label={`Question ${index + 1}, ${index === current ? "present" : complete ? "completed" : partial ? "in progress" : "remaining"}${flagged.includes(index) ? ", flagged" : ""}`}
                          aria-current={index === current ? "step" : undefined}
                          onClick={() => goTo(index)}>
                          {index + 1}
                          {flagged.includes(index) && <span className="viewerTileFlag" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="viewerStatusRows">
                    <div><Icon name="checkmark-circle.svg" /><span>Answered</span><strong>{String(answered).padStart(2, "0")}</strong></div>
                    <div><span className="viewerRemainingCircle" /><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                    <div><Icon name="flag.svg" /><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                  </div>
                  <h2 className="viewerToolsHeading">Tools</h2>
                  <div className="viewerToolsList">
                    <button type="button" onClick={() => router.push(`${viewerPath(getActiveAssessmentId())}/scratch`)}><Icon name="sticky-note.svg" />Scratch Pad<Icon name="arrowupright.svg" size={18} /></button>
                    <button type="button" onClick={() => router.push(`${viewerPath(getActiveAssessmentId())}/calculator`)}><Icon name="calculator.svg" />Calculator<Icon name="arrowup.svg" size={18} /></button>
                    <button type="button" onClick={() => router.push(`${viewerPath(getActiveAssessmentId())}/formulasheet`)}><Icon name="sigma.svg" />Formula Sheet<Icon name="arrowupg.svg" size={18} /></button>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </div>
      {showSubmitConfirm && !submitted && <ViewerSubmitConfirm answered={answered} remaining={remaining} flagged={flagged.length}
        onBack={()=>setShowSubmitConfirm(false)} onSubmit={()=>finish(false)}/>} 
      {showSuccess && releasePolicy && <TextSubmitSuccess
        title={draft.title}
        scorePercent={submissionResult?.score == null || !submissionResult.maxMarks ? 0 : Math.round(100 * submissionResult.score / submissionResult.maxMarks)}
        pendingCount={submissionResult?.score == null ? total : 0}
        passingScore={draft.passingScore}
        release={releasePolicy}
        isRetry={attemptNumber > 1}
        onClose={()=>router.push(resultPath())}
      />}
    </main>
  );
}
