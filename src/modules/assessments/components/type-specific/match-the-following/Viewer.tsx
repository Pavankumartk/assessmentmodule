"use client";
import {maySubmitCurrentAttempt} from "@/modules/assessments/components/learner/learner-assessment-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import "./matchthefollowing.css";
import { assessmentStorage, getActiveAssessmentId, getAssessment, updateAssessment, resultPath, viewerPath } from "@/modules/assessments/storage/assessment-storage";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import TextSubmitSuccess from "@/modules/assessments/components/viewer/TextSubmitSuccess";
import { releaseForAssessment } from "@/modules/assessments/components/viewer/assessment-result-bridge";
// Keep the user's existing viewer icon folder. Add missing SVG files here.
const ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "matchFollowingContentDraft", "matchfollowingContentDraft",
  "matchTheFollowingContentDraft", "matchingContentDraft",
  "dragDropContentDraft", "dragdropContentDraft",
];
const DETAILS_KEYS = [
  "mcqAssessmentDraft", "matchFollowingAssessmentDraft", "matchfollowingAssessmentDraft",
  "matchTheFollowingAssessmentDraft", "dragDropAssessmentDraft",
  "dragdropAssessmentDraft",
];
const SESSION_KEY = "matchFollowingViewerState";
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}
type MatchTerm = { id: string; label: string };
type MatchOption = { id: string; text: string };
type MatchQuestion = {
  id: string;
  text: string;
  terms: MatchTerm[];
  options: MatchOption[];
  columnA?: string;
  columnB?: string;
  // Expected option index for each term. -1 means no correct answer was supplied.
  correct: number[];
  bloom: string;
  hint: string;
  allowHint: boolean;
  points: number;
  grading: string;
  pairMarks: number[];
  negative: number;
  partialCredit: boolean;
  minZero: boolean;
  scoreOverrides: Record<string, string>;
};
type ViewerDraft = { title: string; questions: MatchQuestion[]; durationSeconds: number };
type ViewerState = {
  signature: string;
  current: number;
  answers: Record<number, number[]>;
  flagged: number[];
  skipped: number[];
  expiresAt: number;
  submitted: boolean;
};
type Data = Record<string, unknown>;
const DEMO: ViewerDraft = {
  title: "Introduction to Artificial Intelligence",
  durationSeconds: 30 * 60 + 42,
  questions: [{
    id: "reference-question-1",
    text: "Match each AI term with its correct description.",
    terms: [
      { id: "a", label: "Overfitting" },
      { id: "b", label: "Backpropagation" },
      { id: "c", label: "Activation function" },
      { id: "d", label: "Dropout" },
    ],
    options: [
      { id: "method", text: "Method that updates weights using the error" },
      { id: "groups", text: "Groups unlabeled data into clusters" },
      { id: "memorises", text: "Model memorises training data and fails on new data" },
      { id: "dropout", text: "Randomly ignores neurons to reduce overfitting" },
      { id: "nonlinearity", text: "Adds non-linearity to a neuron" },
    ],
    correct: [2, 0, 4, 3],
    bloom: "Analyse",
    hint: "ReLU and sigmoid are examples of activation functions.",
    allowHint: true,
    points: 4,
    grading: "Equal Marks", pairMarks: [1, 1, 1, 1], negative: 0,
    partialCredit: true, minZero: true, scoreOverrides: {},
  }],
};
function asData(value: unknown): Data | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Data : null;
}
function pickText(data: Data, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}
function numberValue(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw !== null && raw !== "" && Number.isFinite(n) ? n : fallback;
}
function readStorage(keys: string[]): Data | null {
  for (const key of keys) {
    try {
      const raw = assessmentStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const record = asData(parsed);
      if (record) return record;
      if (Array.isArray(parsed)) return { questions: parsed };
    } catch { /* Another compatible key may exist. */ }
  }
  return null;
}
function toText(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") return String(raw).trim();
  const d = asData(raw);
  return d ? pickText(d, ["text", "label", "name", "term", "description", "title", "value"]) : "";
}
function toOption(raw: unknown, index: number): MatchOption {
  const d = asData(raw);
  return { id: String(d?.id ?? d?.key ?? `option-${index}`), text: toText(raw) };
}
function toTerm(raw: unknown, index: number): MatchTerm {
  const d = asData(raw);
  return { id: String(d?.id ?? d?.key ?? `term-${index}`), label: toText(raw) };
}
function resolveIndex(value: unknown, options: MatchOption[]): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value < options.length ? value : -1;
  }
  if (value === undefined || value === null) return -1;
  const v = String(value).trim();
  if (!v) return -1;
  const byIdOrText = options.findIndex(option =>
    option.id === v || option.text.toLowerCase() === v.toLowerCase());
  if (byIdOrText !== -1) return byIdOrText;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n >= 0 && n < options.length ? n : -1;
  }
  const letter = /^([a-z])\.?$/i.exec(v);
  if (letter) {
    const n = letter[1].toUpperCase().charCodeAt(0) - 65;
    return n < options.length ? n : -1;
  }
  return -1;
}
function parseQuestion(raw: unknown, index: number): MatchQuestion | null {
  const q = asData(raw);
  if (!q) return null;
  const text = pickText(q, ["text", "question", "questionText", "instruction", "prompt"], "Match the following.");
  let terms: MatchTerm[] = [];
  let options: MatchOption[] = [];
  let correct: number[] = [];
  // Pair-based authoring: [{ term, description }, ...].
  const pairs = Array.isArray(q.pairs) ? q.pairs : Array.isArray(q.matches) ? q.matches : null;
  if (pairs?.length) {
    terms = pairs.map((pair, i) => {
      const p = asData(pair) ?? {};
      return toTerm({ id: p.id ?? `term-${i}`, text: p.term ?? p.left ?? p.question ?? p.source }, i);
    });
    options = pairs.map((pair, i) => {
      const p = asData(pair) ?? {};
      return toOption({ id: p.optionId ?? `pair-option-${i}`, text: p.description ?? p.right ?? p.answer ?? p.target }, i);
    });
    correct = pairs.map((_, i) => i);
    // Optional distractors: added without changing correct indices.
    const extraChoices = Array.isArray(q.distractors) ? q.distractors
      : Array.isArray(q.extras) && q.extraEnabled !== false ? q.extras
      : [];
    options.push(...extraChoices.map((value, i) => toOption(value, options.length + i)).filter(option => option.text));
  }
  // Terms / descriptions with an explicit mapping.
  if (!terms.length) {
    const left = Array.isArray(q.terms) ? q.terms
      : Array.isArray(q.leftItems) ? q.leftItems
      : Array.isArray(q.questions) ? q.questions : [];
    const right = Array.isArray(q.descriptions) ? q.descriptions
      : Array.isArray(q.rightItems) ? q.rightItems
      : Array.isArray(q.options) ? q.options : [];
    terms = left.map(toTerm).filter(term => term.label);
    options = right.map(toOption).filter(option => option.text);
    const mapping = asData(q.mapping) ?? asData(q.correctMapping) ?? asData(q.answerMapping) ?? {};
    const correctArray = Array.isArray(q.correctAnswers) ? q.correctAnswers
      : Array.isArray(q.correctMapping) ? q.correctMapping : [];
    correct = terms.map((term, i) => resolveIndex(
      correctArray[i] ?? mapping[term.id] ?? mapping[String(i + 1)] ?? mapping[String(i)] ??
      asData(left[i])?.correct ?? asData(left[i])?.answer,
      options,
    ));
  }
  // Compatible with the existing Drag & Drop creator's [[1]] zones, items and mapping.
  if (!terms.length && Array.isArray(q.items) && q.items.length) {
    const found = [...text.matchAll(/\[\[(\d+)\]\]/g)].map(match => match[1]);
    const ids = [...new Set(found)];
    const zoneNames = asData(q.zoneLabels) ?? {};
    terms = ids.map(id => ({ id, label: String(zoneNames[id] ?? `Zone [[${id}]]`) }));
    options = q.items.map(toOption).filter(option => option.text);
    const mapping = asData(q.mapping) ?? {};
    correct = terms.map(term => resolveIndex(mapping[term.id], options));
  }
  if (!terms.length || !options.length) return null;
  // Terms and descriptions are supplied by creator, never altered or hardcoded here.
  return {
    id: String(q.id ?? `question-${index}`), text, terms, options,
    columnA: pickText(q, ["columnA", "leftHeading", "termHeading"], "Term"),
    columnB: pickText(q, ["columnB", "rightHeading", "descriptionHeading"], "Description"),
    correct: terms.map((_, i) => correct[i] ?? -1),
    bloom: pickText(q, ["bloom", "bloomTaxonomy", "bloomLevel", "taxonomy"], ""),
    hint: pickText(q, ["hint", "hintText"], ""),
    allowHint: q.allowHint !== false && q.showHint !== false,
    points: Math.max(0, numberValue(q.points ?? q.marks, 1)),
    grading: pickText(q, ["grading"], "Equal Marks"),
    pairMarks: Array.isArray(q.pairs) ? q.pairs.map(pair => numberValue(asData(pair)?.marks, 0)) : [],
    negative: numberValue(q.negative === "NA" ? 0 : q.negative, 0),
    partialCredit: q.partialCredit !== false,
    minZero: q.minZero !== false,
    scoreOverrides: asData(q.scoreOverrides) as Record<string, string> ?? {},
  };
}
function durationSeconds(detail: Data): number {
  const raw = detail.duration ?? detail.timeLimit ?? detail.totalTime ?? detail.time;
  const minutes = Number.parseFloat(String(raw ?? "60"));
  return Math.round((Number.isFinite(minutes) && minutes > 0 ? minutes : 60) *
    (/hour/i.test(String(raw)) ? 3600 : 60));
}
function loadViewerDraft(): ViewerDraft {
  const data = readStorage(CONTENT_KEYS);
  const details = readStorage(DETAILS_KEYS) ?? {};
  const records = Array.isArray(data?.questions) ? data.questions
    : Array.isArray(data?.items) && data?.items.some(item => asData(item)?.terms) ? data.items : [];
  const questions = records.map(parseQuestion).filter((item): item is MatchQuestion => item !== null);
  if (!questions.length) return { title: pickText(details, ["assessmentTitle", "assessmentName", "title", "name"], "Match the Following"), durationSeconds: durationSeconds(details), questions: [] };
  return {
    title: pickText(details, ["assessmentTitle", "assessmentName", "title", "name"], DEMO.title),
    durationSeconds: durationSeconds(details),
    questions,
  };
}
function formatTime(value: number): [string, string, string] {
  const safe = Math.max(0, Math.floor(value));
  return [Math.floor(safe / 3600), Math.floor(safe % 3600 / 60), safe % 60]
    .map(n => String(n).padStart(2, "0")) as [string, string, string];
}
function Stopwatch({ seconds }: { seconds: number }) {
  const parts = formatTime(seconds);
  return <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, i) => <span className="viewerTimeGroup" key={i}>
      {i > 0 && <span className="viewerTimeColon">:</span>}
      {part.split("").map((digit, j) => <span className="viewerTimeDigit" key={j}>{digit}</span>)}
    </span>)}
  </div>;
}
function complete(q: MatchQuestion | undefined, selections: number[] | undefined): boolean {
  if (!q || q.terms.length === 0) return false;
  return q.terms.every((_, index) =>
    Number.isInteger(selections?.[index]) &&
    (selections?.[index] ?? -1) >= 0 &&
    (selections?.[index] ?? -1) < q.options.length);
}
function partial(q: MatchQuestion | undefined, selections: number[] | undefined): boolean {
  return !!q && q.terms.some((_, index) => (selections?.[index] ?? -1) >= 0) && !complete(q, selections);
}
function MatchSelect({ question, termIndex, selected, answers, disabled, onSelect }: {
  question: MatchQuestion;
  termIndex: number;
  selected: number;
  answers: number[];
  disabled: boolean;
  onSelect: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 250, maxHeight: 265 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.max(80, Math.min(rect.width, viewportWidth - 16));
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
    const wanted = Math.min(265, question.options.length * 44 + 20);
    const below = Math.max(0, viewportHeight - rect.bottom - 8);
    const above = Math.max(0, rect.top - 8);
    const up = below < Math.min(wanted, 160) && above > below;
    const available = up ? above : below;
    const maxHeight = Math.min(wanted, Math.max(65, available));
    const top = up ? Math.max(8, rect.top - maxHeight) : Math.max(8, Math.min(rect.bottom, viewportHeight - maxHeight - 8));
    setPosition({ top, left, width, maxHeight });
  };
  useEffect(() => { setOpen(false); }, [question.id, termIndex]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    const reposition = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      positionMenu();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, question.options.length, selected]);
  const selectedText = selected >= 0 ? question.options[selected]?.text : undefined;
  return <div className={`viewerMatchPicker ${open ? "is-open" : ""} ${selectedText ? "has-value" : ""}`}>
    <button type="button" ref={triggerRef} className="viewerMatchTrigger" aria-label={`Description for ${question.terms[termIndex].label}`}
      aria-haspopup="listbox" aria-expanded={open} disabled={disabled}
      onClick={() => { if (open) { setOpen(false); return; } positionMenu(); setOpen(true); }}>
      <span>{selectedText || "Choose..."}</span>
      {selectedText
        ? <Icon name="tick.svg" size={20} />
        : <Icon name="arrow-down.svg" size={20} />}
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div ref={menuRef} className="viewerMatchPortal" role="listbox"
        aria-label={`Descriptions for ${question.terms[termIndex].label}`}
        style={{ position: "fixed", top: position.top, left: position.left, width: position.width,
          maxHeight: position.maxHeight, zIndex: 2147483000, display: "block", visibility: "visible",
          background: "#DFE6E9", boxShadow: "-4px -4px 4px #FFFFFF,4px 4px 4px #C4C4C4",
          overflowY: "auto", pointerEvents: "auto" }}>
        {question.options.map((option, optionIndex) => {
          const usedInAnother = answers.some((value, row) => row !== termIndex && value === optionIndex);
          const isSelected = optionIndex === selected;
          return <button key={`${option.id}-${optionIndex}`} type="button" role="option" aria-selected={isSelected}
            aria-disabled={usedInAnother && !isSelected} disabled={usedInAnother && !isSelected}
            className={`viewerMatchOption ${isSelected ? "is-chosen" : ""}`}
            onClick={() => { onSelect(isSelected ? -1 : optionIndex); setOpen(false); }}>
            <span className={`viewerAnswerRadio ${isSelected ? "is-selected" : ""}`} aria-hidden="true" />
            <span>{option.text}</span>
            {usedInAnother && !isSelected && <small>Used</small>}
          </button>;
        })}
      </div>, document.body)}
  </div>;
}
export default function MatchFollowingViewerPage() {
  const router = useRouter();
  const isRetry = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("retry") === "wrong";
  const sessionKey = isRetry ? `${SESSION_KEY}Retry` : SESSION_KEY;
  const [draft, setDraft] = useState<ViewerDraft>(DEMO);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hintOpen, setHintOpen] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const recordedAttempt = useRef(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const signature = `${draft.title}|${draft.questions.length}|${draft.questions.map(q => q.id + q.text).join("|")}`;
  useEffect(() => {
    let loaded = loadViewerDraft();
    if (isRetry) {
      let indexes: number[] = [];
      try { const values: unknown = JSON.parse(assessmentStorage.getItem("matchFollowingRetryIndexes") || "[]"); if (Array.isArray(values)) indexes = values.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0); } catch { /* No retry data */ }
      loaded = { ...loaded, questions: loaded.questions.filter((_, index) => indexes.includes(index)) };
    }
    const stamp = `${loaded.title}|${loaded.questions.length}|${loaded.questions.map(q => q.id + q.text).join("|")}`;
    const time = Date.now();
    setDraft(loaded);
    setNow(time);
    let state: Partial<ViewerState> = {};
    try { state = JSON.parse(assessmentStorage.getItem(sessionKey) || "{}"); }
    catch { /* Start a fresh attempt. */ }
    if (state.signature === stamp && !state.submitted && Number(state.expiresAt) > time) {
      setCurrent(Math.min(Math.max(Number(state.current) || 0, 0), loaded.questions.length - 1));
      setAnswers(state.answers ?? {});
      setFlagged(Array.isArray(state.flagged) ? state.flagged : []);
      setSkipped(Array.isArray(state.skipped) ? state.skipped : []);
      setExpiresAt(state.expiresAt || time + loaded.durationSeconds * 1000);
      setSubmitted(Boolean(state.submitted));
    } else {
      setCurrent(0);
      setAnswers({});
      setFlagged([]);
      setSkipped([]);
      setSubmitted(false);
      setExpiresAt(time + loaded.durationSeconds * 1000);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted]);
  const questions = draft.questions;
  const question = questions[current];
  const total = questions.length;
  const answered = questions.filter((q, i) => complete(q, answers[i])).length;
  const remaining = Math.max(0, total - answered);
  const progress = total ? Math.round(answered / total * 100) : 0;
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;
  const score = useMemo(() => questions.reduce((sum, q, i) => {
    const matchedRows = q.terms.map((_, row) => answers[i]?.[row] === q.correct[row] && q.correct[row] !== -1);
    const correctCount = matchedRows.filter(Boolean).length;
    const override = q.scoreOverrides[String(correctCount)];
    const custom = q.grading === "Custom" && q.pairMarks.length === q.terms.length;
    const base = q.partialCredit || correctCount === q.terms.length
      ? (custom ? matchedRows.reduce((points, correct, row) => points + (correct ? q.pairMarks[row] : 0), 0)
        : q.points * correctCount / Math.max(1, q.terms.length)) : 0;
    const calculated = override !== undefined && override !== "" && Number.isFinite(Number(override))
      ? Number(override) : base - (q.terms.length - correctCount) * q.negative;
    return sum + (q.minZero ? Math.max(0, calculated) : calculated);
  }, 0), [questions, answers]);
  useEffect(() => {
    if (!ready) return;
    const state: ViewerState = { signature, current, answers, flagged, skipped, expiresAt, submitted };
    try { assessmentStorage.setItem(sessionKey, JSON.stringify(state)); }
    catch { /* Continue when browser storage is unavailable. */ }
  }, [ready, signature, current, answers, flagged, skipped, expiresAt, submitted]);
  const recordAttempt = () => {
    if (recordedAttempt.current || new URLSearchParams(window.location.search).get("preview") === "true") return;
    const totalMarks = draft.questions.reduce((sum, q) => sum + q.points, 0);
    const prior = JSON.parse(assessmentStorage.getItem("viewerAttempts") || "[]");
    const attempts = Array.isArray(prior) ? prior : [];
    const record = getAssessment(getActiveAssessmentId() || "");
    const count = Math.max(attempts.length, Number(record?.attemptCount) || 0) + 1;
    assessmentStorage.setItem("viewerAttempts", JSON.stringify([...attempts, {attemptId:crypto.randomUUID(), submittedAt:new Date().toISOString(), scorePercent:totalMarks ? Math.round(score / totalMarks * 100) : 0, earnedMarks:score, totalMarks, pendingCount:0}]));
    updateAssessment({attemptCount:count});
    recordedAttempt.current = true;
  };
  useEffect(() => {
    if (!ready || submitted || !expiresAt || secondsLeft > 0) return;
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    setSubmitted(true);
    setNotice("Time is up. Your assessment has been submitted.");
    try {
      assessmentStorage.setItem(isRetry ? "matchFollowingRetryResult" : "matchFollowingViewerResult", JSON.stringify({
        title: draft.title, answers, score, answered, total, flagged,
        totalMarks: draft.questions.reduce((sum, q) => sum + q.points, 0),
        questions: draft.questions.map((q, i) => ({ text: q.text, terms: q.terms, options: q.options, correct: q.correct, selected: answers[i] ?? [], points: q.points })),
        submittedAt: new Date().toISOString(),
      }));
      recordAttempt();
    } catch { /* Submission remains finished. */ }
    if (new URLSearchParams(window.location.search).get("preview") !== "true") setSuccessOpen(true);
  }, [ready, submitted, expiresAt, secondsLeft, draft, answers, score, answered, total, flagged, router]);
  const selectMatch = (row: number, option: number) => {
    if (submitted || !question) return;
    setAnswers(previous => {
      const next = Array.from({ length: question.terms.length }, (_, i) => previous[current]?.[i] ?? -1);
      // One description can be matched to one term; changing a match frees the old row.
      if (option >= 0) next.forEach((value, i) => { if (i !== row && value === option) next[i] = -1; });
      next[row] = option;
      return { ...previous, [current]: next };
    });
    setSkipped(previous => previous.filter(i => i !== current));
    setNotice("");
  };
  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (!complete(question, answers[current])) {
      setSkipped(previous => previous.includes(current) ? previous : [...previous, current]);
    }
    setCurrent(index);
    setHintOpen(true);
    setNotice("");
  };
  const toggleFlag = () => {
    if (submitted) return;
    setFlagged(previous => previous.includes(current)
      ? previous.filter(i => i !== current) : [...previous, current]);
  };
  const submit = () => { setSubmitOpen(true); };
  const confirmSubmission = () => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    try {
      assessmentStorage.setItem(isRetry ? "matchFollowingRetryResult" : "matchFollowingViewerResult", JSON.stringify({
        title: draft.title, answers, score, answered, total, flagged,
        totalMarks: draft.questions.reduce((sum, q) => sum + q.points, 0),
        questions: draft.questions.map((q, i) => ({ text: q.text, terms: q.terms, options: q.options, correct: q.correct, selected: answers[i] ?? [], points: q.points })),
        submittedAt: new Date().toISOString(),
      }));
      recordAttempt();
    } catch { /* Submission remains complete even when storage is unavailable. */ }
    setSubmitted(true);
    setSubmitOpen(false);
    setNotice("Assessment submitted.");
    if (new URLSearchParams(window.location.search).get("preview") !== "true") setSuccessOpen(true);
  };
  return <main className="superAdminPage institutionAdminPage viewerAppShell viewMatchFollowingApp">
    <div className="dashboardLayout viewerLayout">
      <Sidebar />
      <section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <div className="institutionScrollArea viewerScroll">
          <div className="pageContent institutionPageContent viewerContent">
            <div className="viewerExamTop">
              <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
                <Link href="/super_admin">Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
                <Link href="/assessments">Assessment</Link><Icon name="arrow-right-double.svg" size={20} />
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
                    <div className="viewerProgressTrack"><span style={{ width: `${progress}%` }} /></div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
                {question ? <>
                  <div className="viewerQuestionHeading">
                    <h2>Question {current + 1}</h2>
                    <p>{question.text}</p>
                  </div>
                  <div className="viewerMatching" aria-label="Match the following">
                    <div className="viewerMatchingHeading"><strong>{question.columnA || "Term"}</strong><strong>{question.columnB || "Description"}</strong></div>
                    {question.terms.map((term, index) => <div className="viewerMatchRow" key={`${current}-${term.id}-${index}`}>
                      <div className="viewerMatchTerm">
                        {String.fromCharCode(65 + index)}. {term.label}
                      </div>
                      <MatchSelect question={question} termIndex={index}
                        selected={answers[current]?.[index] ?? -1}
                        answers={answers[current] ?? []} disabled={submitted}
                        onSelect={option => selectMatch(index, option)} />
                    </div>)}
                  </div>
                  {question.hint && question.allowHint && <section className="viewerHintBox">
                    <button type="button" className="viewerHintToggle" aria-expanded={hintOpen}
                      onClick={() => setHintOpen(value => !value)}>
                      <span className="viewerHintTitle">
                        <span className="viewerHintIcon"><Icon name="idea.svg" size={25} /></span>
                        <span>Hint{hintOpen && <small>{question.hint}</small>}</span>
                      </span>
                      <span className="viewerHintEye"><Icon name={hintOpen ? "view.svg" : "eye-off.svg"} size={20} /></span>
                    </button>
                  </section>}
                  <div className="viewerQuestionSettings">
                    <div><label>Bloom’s Taxonomy</label><span className="viewerBloomValue">{question.bloom || "Not specified"}</span></div>
                    <button type="button" className={`viewerFlagButton ${flagged.includes(current) ? "isFlagged" : ""}`}
                      disabled={submitted} onClick={toggleFlag}>
                      <Icon name="flag.svg" size={22} />{flagged.includes(current) ? "Remove flag" : "Flag for review"}
                    </button>
                  </div>
                  {notice && <p className="viewerInlineNotice" role="status">{notice}</p>}
                  <div className="viewerExamActions">
                    {current > 0 && <button type="button" className="viewerExamButton" disabled={current === 0}
                      onClick={() => goTo(current - 1)}><Icon name="arrowleft.svg" />Previous</button>}
                    <button type="button" className="viewerExamButton viewerNext"
                      disabled={submitted && current === total - 1}
                      onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                      {current === total - 1 ? (submitted ? "Submitted" : "Submit") : "Next"}<Icon name="arrowrightg.svg" />
                    </button>
                  </div>
                </> : <p className="viewerInlineNotice">No matching questions were found in this assessment.</p>}
              </section>
              <aside className="viewerExamCard viewerNavigator">
                <h2>Question Navigator</h2>
                <div className="viewerQuestionTiles" aria-label="Choose question">
                  {questions.map((q, index) => {
                    const state = index === current ? "current"
                      : flagged.includes(index) ? "flagged"
                      : complete(q, answers[index]) ? "answered"
                      : partial(q, answers[index]) || skipped.includes(index) ? "skipped" : "remaining";
                    return <button type="button" key={q.id + index}
                      className={`viewerQuestionTile is-${state}`}
                      aria-label={`Question ${index + 1}${flagged.includes(index) ? ", flagged" : ""}`}
                      aria-current={index === current ? "step" : undefined}
                      onClick={() => goTo(index)}>{index + 1}</button>;
                  })}
                </div>
                <div className="viewerStatusRows">
                  <div><Icon name="checkmark-circle.svg" /><span>Answered</span><strong>{String(answered).padStart(2, "0")}</strong></div>
                  <div><span className="viewerRemainingCircle" /><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                  <div><Icon name="flag.svg" /><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                </div>
                <h2 className="viewerToolsHeading">Tools</h2>
                <div className="viewerToolsList">
                  <button type="button" onClick={() => router.push(`${viewerPath()}/scratch`)}><Icon name="sticky-note.svg" />Scratch Pad<Icon name="arrowupright.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/calculator`)}><Icon name="calculator.svg" />Calculator<Icon name="arrowup.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/formulasheet`)}><Icon name="sigma.svg" />Formula Sheet<Icon name="arrowupg.svg" size={18} /></button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
    {submitOpen && !submitted && <ViewerSubmitConfirm answered={answered} remaining={remaining} flagged={flagged.length} onBack={() => setSubmitOpen(false)} onSubmit={confirmSubmission} />}
    {successOpen && <TextSubmitSuccess title={draft.title} scorePercent={Math.round(score / Math.max(1, questions.reduce((sum,q) => sum + q.points, 0)) * 100)} pendingCount={0} passingScore="60%" release={releaseForAssessment("match-the-following")} isRetry={isRetry} onClose={() => setSuccessOpen(false)} />}
  </main>;
}
