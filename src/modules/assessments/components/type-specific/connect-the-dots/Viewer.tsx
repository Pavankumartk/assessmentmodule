"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./viewconnect.css";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";
import { assessmentStorage, getActiveAssessmentId, getAssessment, resultPath, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import TextSubmitSuccess from "@/modules/assessments/components/viewer/TextSubmitSuccess";
import { releaseForAssessment } from "@/modules/assessments/components/viewer/assessment-result-bridge";
// Keep the user's existing viewer icon folder. Add missing SVG files here.
const ICONS = "/assets/viewericons/";
const CONTENT_KEYS = ["connectDotsContentDraft"];
const DETAILS_KEYS = ["mcqAssessmentDraft", "connectDotsAssessmentDraft"];
const SESSION_KEY = "connectDotsViewerState";
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
  questionMode?: string;
  // Expected option index for each term. -1 means no correct answer was supplied.
  correct: number[];
  bloom: string;
  hint: string;
  allowHint: boolean;
  points: number;
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
// Fallback content only. Saved questions from the existing Assessment creator take priority.
const DEMO: ViewerDraft = {
  title: "Introduction to Artificial Intelligence",
  durationSeconds: 30 * 60 + 42,
  questions: [{
    id: "reference-connect-1",
    text: "Connect each data structure (left) to its best description and typical use (right). Some items on the right do not match anything.",
    terms: [
      { id: "stack", label: "Stack" },
      { id: "queue", label: "Queue" },
      { id: "bst", label: "Binary Search Tree" },
      { id: "hash", label: "Hash Table" },
      { id: "graph", label: "Graph" },
    ],
    options: [
      { id: "lifo", text: "Last-in-first-out, used for undo operations" },
      { id: "fifo", text: "First-in-First-out, used for task scheduling" },
      { id: "bst", text: "Ordered keys; O(log n) average search" },
      { id: "hash", text: "Key-value lookup; O(1) average access" },
      { id: "graph", text: "Nodes and edges; models networks and routes" },
      { id: "distractor", text: "Contiguous memory; O(1) index access" },
    ],
    correct: [0, 1, 2, 3, 4],
    columnA: "Data Structure",
    columnB: "Description",
    bloom: "Analyse",
    hint: "ReLU and sigmoid are examples.",
    allowHint: true,
    points: 4,
  }],
};
// Picture reference preview is shown only when requested, or when a saved
// Picture question is present. It does not modify Text Based or Numeric Value.
const PICTURE_DEMO: ViewerDraft = {
  ...DEMO,
  questions: [{
    ...DEMO.questions[0],
    id: "reference-picture-1",
    questionMode: "Picture",
    text: "Connect each diagram (left) to the correct data structure (right). One option has no match.",
    columnA: "Diagram",
    columnB: "Data Structure",
    terms: [
      { id: "p-stack", label: "Stack" },
      { id: "p-queue", label: "Queue" },
      { id: "p-tree", label: "Binary Search Tree" },
      { id: "p-hash", label: "Hash Table" },
      { id: "p-graph", label: "Graph" },
    ],
    options: [
      { id: "po-stack", text: "Stack" },
      { id: "po-queue", text: "Queue" },
      { id: "po-tree", text: "Binary Search Tree" },
      { id: "po-hash", text: "Hash Table" },
      { id: "po-graph", text: "Graph" },
      { id: "po-distractor", text: "Linked List" },
    ],
    correct: [0, 1, 2, 3, 4],
  }],
};

function picturePreviewRequested(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") ?? params.get("questionMode") ?? "";
  return /^(?:picture|image|picture[ -]?based|image[ -]?based)$/i.test(mode.trim());
}
function isPictureQuestion(question: MatchQuestion): boolean {
  return /^(?:picture|image|picture[ -]?based|image[ -]?based)$/i.test((question.questionMode ?? "").trim());
}
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
  if (q.type === "Connect the Dots" && pairs) {
    const filled = pairs.filter(pair => {
      const p = asData(pair) ?? {};
      return toText(p.term ?? p.left ?? p.question ?? p.source) &&
        toText(p.description ?? p.right ?? p.answer ?? p.target);
    });
    if (!pickText(q, ["text", "question", "questionText", "instruction", "prompt"]) ||
        filled.length < 2 || filled.length !== pairs.length) return null;
  }
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
    columnA: pickText(q, ["columnA", "leftHeading", "termHeading"], "Data Structure"),
    columnB: pickText(q, ["columnB", "rightHeading", "descriptionHeading"], "Description"),
    questionMode: pickText(q, ["questionMode"], "Text Based"),
    correct: terms.map((_, i) => correct[i] ?? -1),
    bloom: pickText(q, ["bloom", "bloomTaxonomy", "bloomLevel", "taxonomy"], ""),
    hint: pickText(q, ["hint", "hintText"], ""),
    allowHint: q.allowHint !== false && q.showHint !== false,
    points: Math.max(0, numberValue(q.points ?? q.marks, 1)),
  };
}
function durationSeconds(detail: Data): number {
  const raw = detail.duration ?? detail.timeLimit ?? detail.totalTime ?? detail.time;
  const minutes = Number.parseFloat(String(raw ?? "60"));
  return Math.round((Number.isFinite(minutes) && minutes > 0 ? minutes : 60) *
    (/hour/i.test(String(raw)) ? 3600 : 60));
}
function loadViewerDraft(): ViewerDraft {
  const wantsPicture = picturePreviewRequested();
  let data = readStorage(CONTENT_KEYS);

  const storedDetails = readStorage(DETAILS_KEYS) ?? {};
  const details = data?.type === "Connect the Dots"
    ? { ...storedDetails, ...(asData(data.details) ?? {}) }
    : storedDetails;
  const records = Array.isArray(data?.questions) ? data.questions
    : Array.isArray(data?.items) && data?.items.some(item => asData(item)?.terms) ? data.items : [];
  const questions = records.map(parseQuestion).filter((item): item is MatchQuestion => item !== null);

  // ?mode=picture is a direct preview of the creator's Picture questions.
  // Without saved Picture questions, show the actual diagram reference page
  // instead of silently returning to the original Text Based demo.
  const visible = wantsPicture ? questions.filter(isPictureQuestion) : questions;
  if (!visible.length) return {title:getAssessment(getActiveAssessmentId() || "")?.title || "Connect the Dots",durationSeconds:durationSeconds(details),questions:[]};
  return {
    title: pickText(details, ["assessmentTitle", "assessmentName", "title", "name"], getAssessment(getActiveAssessmentId() || "")?.title || DEMO.title),
    durationSeconds: durationSeconds(details),
    questions: visible,
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
    (selections?.[index] ?? -1) < q.options.length) &&
    new Set(selections?.slice(0, q.terms.length)).size === q.terms.length;
}
function partial(q: MatchQuestion | undefined, selections: number[] | undefined): boolean {
  return !!q && q.terms.some((_, index) => (selections?.[index] ?? -1) >= 0) && !complete(q, selections);
}
// The matching area is the only newly designed part of the existing viewer.
// Coordinates are measured from the actual dots, so lines stay aligned at any width.
type ConnectSide = "left" | "right";
type Endpoint = { side: ConnectSide; index: number };
type Dot = { x: number; y: number };
type Geometry = { width: number; height: number; left: Dot[]; right: Dot[] };
function numbered(label: string, index: number): string {
  return /^\s*(?:\d+[.)]|[A-Z][.)])\s+/.test(label) ? label : `${index + 1}. ${label}`;
}
function lettered(label: string, index: number): string {
  return /^\s*[A-Z][.)]\s+/.test(label) ? label
    : `${String.fromCharCode(65 + index)}. ${label}`;
}
// Picture mode only: use the image path saved in the creator.
// Files placed in public/assets/assessmenticons are available as /assets/assessmenticons/filename.svg.
function pictureImageSource(raw: string): string | null {
  let value = raw.trim().replace(/\\/g, "/");
  if (!value) return null;
  if (/^(?:https?:\/\/|blob:|data:image\/)/i.test(value)) return value;
  if (/^(?:file:|[a-z]:\/)/i.test(value)) return null;
  value = value.replace(/^\.\//, "").replace(/^\/?public\//i, "");
  if (/^\/?(?:assets|images)\//i.test(value)) return `/${value.replace(/^\//, "")}`;
  if (/^[\w .()%-]+\.(?:svg|png|jpe?g|webp|gif|avif)$/i.test(value))
    return `/assets/assessmenticons/${value}`;
  return value.startsWith("/") ? value : null;
}

type PictureDiagramType = "stack" | "queue" | "tree" | "hash" | "graph";

function pictureDiagramType(label: string): PictureDiagramType | null {
  const name = label.toLowerCase().replace(/^\d+[.)]\s*/, "").replace(/[-_]+/g, " ");
  if (/\bstack\b/.test(name)) return "stack";
  if (/\bqueue\b/.test(name)) return "queue";
  if (/\b(binary search tree|bst|tree)\b/.test(name)) return "tree";
  if (/\b(hash table|hash map|hashmap)\b/.test(name)) return "hash";
  if (/\bgraph\b/.test(name)) return "graph";
  return null;
}

function PictureDiagram({ type, alt }: { type: PictureDiagramType; alt: string }) {
  // Reference fallback only; a creator-saved image path always takes precedence.
  const stroke = "#4946F5";
  return <svg className="viewerConnectPictureImage" viewBox="0 0 230 98"
    role="img" aria-label={alt} preserveAspectRatio="xMidYMid meet"
    fill="none" stroke={stroke} strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round">
    {type === "stack" && <g>
      <rect x="88" y="13" width="60" height="23" />
      <rect x="88" y="36" width="60" height="23" />
      <rect x="88" y="59" width="60" height="23" />
    </g>}
    {type === "queue" && <g>
      <rect x="24" y="34" width="36" height="36" />
      <rect x="65" y="34" width="36" height="36" />
      <rect x="106" y="34" width="36" height="36" />
      <path d="M156 52 H208 M193 38 L208 52 L193 66" />
    </g>}
    {type === "tree" && <g>
      <path d="M115 22 L77 49 M115 22 L153 49 M77 49 L53 77 M77 49 L98 77 M153 49 L134 77 M153 49 L179 77" />
      {[[115,20],[77,50],[153,50],[53,78],[98,78],[134,78],[179,78]].map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="8" fill="#DFE6E9" />)}
    </g>}
    {type === "hash" && <g>
      <rect x="29" y="18" width="33" height="22" />
      <rect x="29" y="40" width="33" height="22" />
      <rect x="29" y="62" width="33" height="22" />
      <path d="M65 51 H143 M129 38 L143 51 L129 64" />
      <rect x="150" y="29" width="57" height="44" />
    </g>}
    {type === "graph" && <g>
      <path d="M65 27 L172 27 L118 57 Z M65 27 L66 81 L118 57 L174 81 L172 27 M66 81 L174 81" />
      {[[65,27],[172,27],[118,57],[66,81],[174,81]].map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="9" fill="#DFE6E9" />)}
    </g>}
  </svg>;
}

function PictureImage({ src, alt, reference }: {
  src: string; alt: string; reference: PictureDiagramType | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (failed) return reference
    ? <PictureDiagram type={reference} alt={alt}/>
    : <span className="viewerConnectPictureFallback" role="status">Image unavailable. Check the image path.</span>;
  return <img className="viewerConnectPictureImage" src={src} alt={alt}
    draggable={false} onError={() => setFailed(true)}/>;
}

function PictureValue({ value, alt, useReference = false }: {
  value: string; alt: string; useReference?: boolean;
}) {
  const src = pictureImageSource(value);
  const reference = useReference ? pictureDiagramType(value) : null;
  if (src) return <PictureImage src={src} alt={alt} reference={reference}/>;
  if (reference) return <PictureDiagram type={reference} alt={alt}/>;
  return <span className="viewerConnectPictureFallback">{value || "Image not provided"}</span>;
}

function ConnectBoard({ question, selected, disabled, onConnect }: {
  question: MatchQuestion;
  selected: number[];
  disabled: boolean;
  onConnect: (term: number, option: number) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ start: Endpoint; id: number; x: number; y: number } | null>(null);
  const [pending, setPending] = useState<Endpoint | null>(null);
  const [dragTip, setDragTip] = useState<Dot | null>(null);
  const [geometry, setGeometry] = useState<Geometry>({ width: 0, height: 0, left: [], right: [] });
  const measure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const bounds = board.getBoundingClientRect();
    const positions = (side: ConnectSide, count: number): Dot[] =>
      Array.from({ length: count }, (_, index) => {
        const dot = board.querySelector<HTMLElement>(`[data-dot="${side}-${index}"]`);
        if (!dot) return { x: 0, y: 0 };
        const box = dot.getBoundingClientRect();
        return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top };
      });
    setGeometry({ width: bounds.width, height: bounds.height,
      left: positions("left", question.terms.length),
      right: positions("right", question.options.length) });
  }, [question.id, question.terms.length, question.options.length]);
  useEffect(() => {
    setPending(null);
    setDragTip(null);
  }, [question.id]);
  useEffect(() => {
    measure();
    const board = boardRef.current;
    if (!board) return;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(board);
    board.querySelectorAll<HTMLElement>("[data-dot]").forEach(dot => observer?.observe(dot));
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);
  const connect = (term: number, option: number) => {
    onConnect(term, option);
    setPending(null);
    setDragTip(null);
  };
  const choose = (endpoint: Endpoint) => {
    if (disabled) return;
    if (pending) {
      if (pending.side !== endpoint.side) {
        const left = pending.side === "left" ? pending.index : endpoint.index;
        const right = pending.side === "right" ? pending.index : endpoint.index;
        connect(left, right);
        return;
      }
      if (pending.index === endpoint.index) { setPending(null); return; }
    }
    // Clicking an already-connected end disconnects it, letting the learner rematch.
    if (endpoint.side === "left" && (selected[endpoint.index] ?? -1) >= 0) {
      onConnect(endpoint.index, -1);
    } else if (endpoint.side === "right") {
      const term = selected.findIndex(value => value === endpoint.index);
      if (term !== -1) onConnect(term, -1);
    }
    setPending(endpoint);
  };
  const onPointerStart = (event: ReactPointerEvent<HTMLButtonElement>, endpoint: Endpoint) => {
    if (disabled || event.button !== 0) return;
    pointerRef.current = { start: endpoint, id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || event.pointerId !== pointer.id) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5 && !dragTip) return;
    const board = boardRef.current?.getBoundingClientRect();
    if (board) setDragTip({ x: event.clientX - board.left, y: event.clientY - board.top });
  };
  const onPointerFinish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || event.pointerId !== pointer.id) return;
    pointerRef.current = null;
    const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 6;
    const target = document.elementsFromPoint(event.clientX, event.clientY)
      .map(element => element.closest<HTMLElement>("[data-connect-side]"))
      .find(element => element && boardRef.current?.contains(element));
    const targetSide = target?.dataset.connectSide as ConnectSide | undefined;
    const targetIndex = Number(target?.dataset.connectIndex);
    if (moved && target && targetSide && targetSide !== pointer.start.side && Number.isInteger(targetIndex)) {
      connect(pointer.start.side === "left" ? pointer.start.index : targetIndex,
        pointer.start.side === "right" ? pointer.start.index : targetIndex);
    } else if (!moved) {
      choose(pointer.start);
    }
    setDragTip(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onPointerCancel = () => { pointerRef.current = null; setDragTip(null); };
  const selectedCount = question.terms.filter((_, index) => (selected[index] ?? -1) >= 0).length;
  const pictureMode = isPictureQuestion(question);
  const leftHeading = pictureMode && (!question.columnA || question.columnA === "Data Structure")
    ? "Diagram" : question.columnA || "Data Structure";
  const rightHeading = pictureMode && (!question.columnB || question.columnB === "Description")
    ? "Data Structure" : question.columnB || "Description";
  const path = (a: Dot, b: Dot) => {
    const bend = Math.max(20, Math.abs(b.x - a.x) * .45);
    return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
  };
  return <div className={`viewerConnectSection ${question.questionMode === "Numeric Value" ? "viewerConnectNumeric" : ""} ${pictureMode ? "viewerConnectPicture" : ""}`}
    aria-label="Match the left questions to their answers">
    <div className="viewerConnectedMeta">
      <strong>Connected {selectedCount} of {question.terms.length}</strong>
      <span>Connect dots by clicking or dragging. Click a line to remove it.</span>
    </div>
    <div className="viewerConnectHead">
      <strong>{leftHeading}</strong>
      <strong>{rightHeading}</strong>
    </div>
    <div className="viewerConnectBoard" ref={boardRef}>
      <div className="viewerConnectColumn viewerConnectLeft">
        {question.terms.map((term, index) => {
          const linked = (selected[index] ?? -1) >= 0;
          return <button key={`${term.id}-${index}`} type="button"
            className={`viewerConnectCell viewerConnectTerm ${linked ? "isConnected" : ""} ${pending?.side === "left" && pending.index === index ? "isPending" : ""}`}
            data-connect-side="left" data-connect-index={index}
            aria-label={`${pictureMode ? `Diagram ${index + 1}` : numbered(term.label, index)}. ${linked ? "Connected; click to change" : "Choose connection"}`}
            aria-pressed={linked} disabled={disabled}
            onPointerDown={event => onPointerStart(event, { side: "left", index })}
            onPointerMove={onPointerMove} onPointerUp={onPointerFinish} onPointerCancel={onPointerCancel}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose({ side: "left", index }); } }}>
            {pictureMode ? <>
              <span className="viewerConnectPictureNumber">{index + 1}.</span>
              <span className="viewerConnectPictureFrame">
                <PictureValue value={term.label} alt={`Diagram ${index + 1}`} useReference/>
              </span>
            </> : <span className="viewerConnectText">{numbered(term.label, index)}</span>}
            <span className="viewerConnectDot" data-dot={`left-${index}`} aria-hidden="true" />
          </button>;
        })}
      </div>
      {geometry.width > 0 && <svg className="viewerConnectLines" width={geometry.width} height={geometry.height}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true">
        {question.terms.map((_, index) => {
          const targetIndex = selected[index] ?? -1;
          const a = geometry.left[index];
          const b = geometry.right[targetIndex];
          if (!a || !b || targetIndex < 0) return null;
          return <g key={`${index}-${targetIndex}`}>
            <path className="viewerConnectLine" d={path(a, b)} />
            {!disabled && <path className="viewerConnectLineHit" d={path(a, b)}
              onClick={() => connect(index, -1)} />}
          </g>;
        })}
        {dragTip && pointerRef.current && (() => {
          const origin = pointerRef.current.start;
          const start = (origin.side === "left" ? geometry.left : geometry.right)[origin.index];
          return start ? <path className="viewerConnectPreview" d={path(start, dragTip)} /> : null;
        })()}
      </svg>}
      <div className="viewerConnectColumn viewerConnectRight">
        {question.options.map((option, index) => {
          const linked = selected.includes(index);
          return <button key={`${option.id}-${index}`} type="button"
            className={`viewerConnectCell viewerConnectDescription ${linked ? "isConnected" : ""} ${pending?.side === "right" && pending.index === index ? "isPending" : ""}`}
            data-connect-side="right" data-connect-index={index}
            aria-label={`${question.questionMode === "Numeric Value" ? lettered(option.text, index) : numbered(option.text, index)}. ${linked ? "Connected; click to change" : "Choose connection"}`}
            aria-pressed={linked} disabled={disabled}
            onPointerDown={event => onPointerStart(event, { side: "right", index })}
            onPointerMove={onPointerMove} onPointerUp={onPointerFinish} onPointerCancel={onPointerCancel}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose({ side: "right", index }); } }}>
            {pictureMode ? <span className="viewerConnectPictureAnswer">
              <span className="viewerConnectDot" data-dot={`right-${index}`} aria-hidden="true" />
              <span className="viewerConnectText">
                {pictureImageSource(option.text)
                  ? <PictureValue value={option.text} alt={`Choice ${index + 1}`}/>
                  : numbered(option.text, index)}
              </span>
            </span> : <>
              <span className="viewerConnectDot" data-dot={`right-${index}`} aria-hidden="true" />
              <span className="viewerConnectText">{question.questionMode === "Numeric Value" ? lettered(option.text, index) : numbered(option.text, index)}</span>
            </>}
          </button>;
        })}
      </div>
    </div>
  </div>;
}

function saveConnectDotsResult(draft:ViewerDraft, answers:Record<number,number[]>, flagged:number[], duration:number, remaining:number, retry:boolean) {
  if (!maySubmitCurrentAttempt()) throw new Error("The allowed attempts have been used.");
  const original = (()=>{try{return JSON.parse(assessmentStorage.getItem("viewerAssessmentResult")||"{}");}catch{return {};}})();
  const questions = draft.questions.map((q,i)=>{
    const selected = answers[i] || [];
    const correctCount = q.correct.filter((c,j)=>c>=0 && selected[j]===c).length;
    const answered = selected.some(n=>Number.isInteger(n) && n>=0);
    const allCorrect = correctCount===q.correct.length;
    return {id:q.id, text:q.text,options:q.options.map(o=>o.text), correct:0,
      selected:answered?(allCorrect?0:1):null,points:q.points,
      gradingStatus:answered?(allCorrect?"correct":"incorrect"):"unanswered",
      earnedMarks:q.points*correctCount/Math.max(1,q.terms.length),
      flagged:flagged.includes(i),bloom:q.bloom,hint:q.hint};
  });
  const totalMarks=questions.reduce((n,q)=>n+q.points,0);
  const earnedMarks=questions.reduce((n,q)=>n+q.earnedMarks,0);
  const result={attemptId:typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    title:draft.title, assessmentType:"connect-the-dots",questions,totalQuestions:questions.length,
    correctAnswers:questions.filter(q=>q.gradingStatus==="correct").length,
    incorrectAnswers:questions.filter(q=>q.gradingStatus==="incorrect").length,
    unanswered:questions.filter(q=>q.gradingStatus==="unanswered").length,
    totalMarks,earnedMarks,scorePercent:totalMarks?Math.round(earnedMarks/totalMarks*100):0,
    totalSeconds:duration,usedSeconds:Math.max(0,duration-remaining),
    flaggedQuestionIndexes:flagged,submittedAt:new Date().toISOString(),
    retryAttemptsUsed:retry?Number(original.retryAttemptsUsed||2):1,
    retryAttemptsAllowed:Number(original.retryAttemptsAllowed||2),retryDurationMinutes:Number(original.retryDurationMinutes||15)};
  assessmentStorage.setItem(retry?"viewerRetryResult":"viewerAssessmentResult",JSON.stringify(result));
  {
    const raw=assessmentStorage.getItem("viewerAttempts");let prior:unknown=[];
    try {prior=JSON.parse(raw||"[]");}catch{prior=[];}
    assessmentStorage.setItem("viewerAttempts",JSON.stringify([...(Array.isArray(prior)?prior:[]),result]));
    assessmentStorage.setItem("viewerAttemptDraft",JSON.stringify({finished:true}));
    const id=getActiveAssessmentId();const existing=id?getAssessment(id):undefined;
    if(existing)updateAssessment({attemptCount:nextAttemptCount((Array.isArray(prior)?prior.length:0)+1)});
  }
  return result;
}
export default function MatchFollowingViewerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ViewerDraft>(DEMO);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hintOpen, setHintOpen] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitOpen,setSubmitOpen]=useState(false);
  const [successOpen,setSuccessOpen]=useState(false);
  const retry=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("retry")==="wrong";
  const [releasePolicy,setReleasePolicy]=useState<ReturnType<typeof releaseForAssessment>|null>(null);
  const signature = `${draft.title}|${draft.questions.length}|${draft.questions.map(q => q.id + q.text + (isPictureQuestion(q) ? "|picture" : "")).join("|")}`;
  useEffect(() => {
    const loaded = loadViewerDraft();
    const stamp = `${loaded.title}|${loaded.questions.length}|${loaded.questions.map(q => q.id + q.text + (isPictureQuestion(q) ? "|picture" : "")).join("|")}`;
    const time = Date.now();
    setDraft(loaded);
    setNow(time);
    let state: Partial<ViewerState> = {};
    try { state = JSON.parse(assessmentStorage.getItem(SESSION_KEY) || "{}"); }
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
    if (!complete(q, answers[i])) return sum;
    const correctCount = q.terms.filter((_, row) => answers[i]?.[row] === q.correct[row] && q.correct[row] !== -1).length;
    return sum + (q.points * correctCount / Math.max(1, q.terms.length));
  }, 0), [questions, answers]);
  useEffect(() => {
    if (!ready) return;
    const state: ViewerState = { signature, current, answers, flagged, skipped, expiresAt, submitted };
    try { assessmentStorage.setItem(SESSION_KEY, JSON.stringify(state)); }
    catch { /* Continue when browser storage is unavailable. */ }
  }, [ready, signature, current, answers, flagged, skipped, expiresAt, submitted]);
  useEffect(() => {
    if (!ready || submitted || !expiresAt || secondsLeft > 0) return;
    try {
      saveConnectDotsResult(draft,answers,flagged,draft.durationSeconds,0,retry);
      setSubmitted(true);
      setNotice("Time is up. Your assessment has been submitted.");
      setReleasePolicy(releaseForAssessment("connect-the-dots"));
      setSuccessOpen(true);
    } catch { setNotice("Your result could not be saved. Please contact your instructor."); }
  }, [ready, submitted, expiresAt, secondsLeft, draft.title, answers, score, answered, total, flagged]);
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
    // Back is allowed; moving forward requires all previous questions to be complete.
    if (!submitted && index > current && questions.slice(0, index).some((q, i) => !complete(q, answers[i]))) {
      setNotice(`Connect all ${question?.terms.length ?? 0} data structures to a different description before moving to the next question.`);
      return;
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
  const submit = () => {
    if (submitted) return;
    if (remaining > 0) {
      setNotice("Complete all connections on every question before submitting your assessment.");
      return;
    }
    setSubmitOpen(true);
  };
  const confirmSubmit = () => {
    if (submitted) return;
    try {
      saveConnectDotsResult(draft,answers,flagged,draft.durationSeconds,secondsLeft,retry);
      setSubmitOpen(false);
      setSubmitted(true);
      setReleasePolicy(releaseForAssessment("connect-the-dots"));
      setSuccessOpen(true);
      setNotice("");
    } catch { setSubmitOpen(false); setNotice("Unable to save the assessment result. Please try again."); }
  };
  const viewerBase = `/assessments/${encodeURIComponent(getActiveAssessmentId() || "")}/viewer`;
  return <main className="superAdminPage institutionAdminPage viewerAppShell viewMatchFollowingApp">
    <div className="dashboardLayout viewerLayout">
      <Sidebar />
      <section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <div className="institutionScrollArea viewerScroll">
          <div className="pageContent institutionPageContent viewerContent">
            <div className="viewerExamTop">
              <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
                <Link href="/learner">Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
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
                    <div className="viewerProgressTrack"><span style={{ width: `${progress}%` }} /></div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
                {question ? <>
                  <div className="viewerQuestionHeading">
                    <h2>Question {current + 1}</h2>
                    <p>{question.text}</p>
                  </div>
                  <ConnectBoard key={question.id + current} question={question}
                    selected={answers[current] ?? []} disabled={submitted}
                    onConnect={(term, option) => selectMatch(term, option)} />
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
                  <button type="button" onClick={() => router.push(`${viewerBase}/scratch`)}><Icon name="sticky-note.svg" />Scratch Pad<Icon name="arrowupright.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push(`${viewerBase}/calculator`)}><Icon name="calculator.svg" />Calculator<Icon name="arrowup.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push(`${viewerBase}/formulasheet`)}><Icon name="sigma.svg" />Formula Sheet<Icon name="arrowupg.svg" size={18} /></button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
    {submitOpen && !submitted && <ViewerSubmitConfirm answered={answered} remaining={remaining} flagged={flagged.length} onBack={()=>setSubmitOpen(false)} onSubmit={confirmSubmit}/>}
    {successOpen && releasePolicy && <TextSubmitSuccess title={draft.title} scorePercent={total?Math.round(score/Math.max(1,questions.reduce((sum,q)=>sum+q.points,0))*100):0} pendingCount={0} passingScore="60%" release={releasePolicy} isRetry={retry} onClose={()=>setSuccessOpen(false)}/>}
  </main>;
}
