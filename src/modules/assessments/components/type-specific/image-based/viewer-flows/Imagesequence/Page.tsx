"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./imagesequence.css";
import { getImageViewerBridge, imageViewerToolPath } from "../../image-viewer-bridge";
import ImageViewerSubmitPopups from "../../ImageViewerSubmitPopups";
import { applyImageViewerRetry, imageViewerRelease, isImageViewerRetry, saveImageViewerSubmission } from "../../image-viewer-submission";
import { resultPath, getActiveAssessmentId, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import { learnerAssessmentData } from "@/modules/assessments/components/learner/learner-assessment-data";


// Keep the exact shared viewer icon directory. The two new files are
// arrow-up-big.svg and arrow-down-big.svg (place them in public/assets/viewericons).
const VIEWER_ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "imageSequenceContentDraft", "imageSequencingContentDraft", "imagesequenceContentDraft",
  "sequenceContentDraft", "sequencingContentDraft", "arrangeSequenceContentDraft",
  "orderSequenceContentDraft", "dragDropContentDraft", "dragdropContentDraft",
  "assessment-viewer-questions",
];
const DETAILS_KEYS = [
  "imageSequenceAssessmentDraft", "sequenceAssessmentDraft", "sequencingAssessmentDraft",
  "assessmentDetailsDraft", "dragDropAssessmentDraft", "dragdropAssessmentDraft",
];
const SESSION_KEY = "imageSequenceViewerState";

type Data = Record<string, unknown>;
type SequenceItem = { id: string; text: string; image?: string; alt: string };
type SequenceQuestion = {
  id: string;
  text: string;
  items: SequenceItem[];
  correctOrder: string[];
  shuffleSteps: boolean;
  marks: number;
  hint: string;
  allowHint: boolean;
  bloom: string;
};
type ViewerDraft = { title: string; durationSeconds: number; questions: SequenceQuestion[]; isSample: boolean };
type Attempt = {
  signature: string;
  current: number;
  orders: Record<string, string[]>;
  touched: string[];
  visited: string[];
  flagged: string[];
  expiresAt: number;
  submitted: boolean;
};

const asData = (value: unknown): Data | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Data : null;
const stringOf = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
function textOf(data: Data, names: string[], fallback = "") {
  for (const name of names) { const value = stringOf(data[name]); if (value) return value; }
  return fallback;
}

// Image belongs to each creator item; never force every question to use a static picture.
function savedImage(value: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof value === "string") {
    const src = value.trim().replace(/\\/g, "/");
    if (!src) return undefined;
    const fromHtml = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(src);
    if (fromHtml) return savedImage(fromHtml[1], depth + 1);
    if (/^(?:https?:\/\/|blob:|data:image\/(?:png|jpe?g|svg\+xml|webp|gif|avif);base64,)/i.test(src)) return src;
    if (/^(?:file:|[a-z]:\/)/i.test(src)) return undefined;
    const cleaned = src.replace(/^\.?\/?public\//i, "/").replace(/^\.\//, "");
    if (/^\/(?:assets|uploads|images|media)\//i.test(cleaned)) return cleaned;
    if (/^(?:assets|uploads|images|media)\//i.test(cleaned)) return `/${cleaned}`;
    if (/^[\w ().-]+\.(?:svg|png|jpe?g|webp|gif|avif)$/i.test(cleaned)) {
      return `${VIEWER_ICONS}${cleaned}`;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) { const result = savedImage(item, depth + 1); if (result) return result; }
    return undefined;
  }
  const data = asData(value);
  if (!data || /^(?:video|audio)\//i.test(stringOf(data.mimeType ?? data.type))) return undefined;
  for (const key of ["imageUrl", "imageURL", "imageSrc", "src", "image", "icon", "iconSrc", "iconUrl", "iconName", "picture", "pictureUrl", "questionImage", "imagePath", "dataUrl", "dataURL", "url", "uploadedImage", "imageData", "imageFile", "file", "fileUrl", "path", "media", "content", "html"]) {
    const result = savedImage(data[key], depth + 1);
    if (result) return result;
  }
  return undefined;
}

function parseQuestion(value: unknown, index: number): SequenceQuestion | null {
  const q = asData(value);
  if (!q) return null;
  const type = textOf(q, ["type", "questionType", "questionMode", "subtype", "mode"]).toLowerCase();
  const rawItems = (Array.isArray(q.sequenceItems) ? q.sequenceItems :
    Array.isArray(q.steps) ? q.steps : Array.isArray(q.items) ? q.items :
    Array.isArray(q.options) ? q.options : Array.isArray(q.sequence) ? q.sequence :
    Array.isArray(q.orderItems) ? q.orderItems : []) as unknown[];
  // Don't accidentally load MCQ/matching questions stored under shared keys.
  const explicitSequence = /sequenc|arrang|order|sort/.test(type);
  const hasOrderFields = rawItems.some(entry => {
    const item = asData(entry);
    return item && ("correctOrder" in item || "correctPosition" in item || "sequenceOrder" in item);
  });
  const hasQuestionOrder = [q.correctOrder, q.correctSequence, q.answerSequence, q.sequenceOrder].some(Array.isArray);
  if (!rawItems.length || (!explicitSequence && !hasOrderFields && !hasQuestionOrder)) return null;
  const mapped = rawItems.map((entry, i) => {
    const item = asData(entry);
    return {
      id: String(item?.id ?? item?.itemId ?? item?.stepId ?? `item-${i + 1}`),
      text: item ? textOf(item, ["text", "label", "title", "step", "name", "content", "value"], `Item ${i + 1}`) : stringOf(entry),
      image: savedImage(item ?? undefined),
      alt: item ? textOf(item, ["alt", "altText", "imageAlt"], `Step ${i + 1}`) : `Step ${i + 1}`,
      position: Number(item?.correctOrder ?? item?.correctPosition ?? item?.sequenceOrder ?? item?.order ?? i),
    };
  }).filter(item => item.text);
  if (!mapped.length) return null;
  // Correct sequence can be supplied by ids/texts, or individual item order values.
  const rawAnswer = [q.correctOrder, q.correctSequence, q.answerSequence, q.sequenceOrder]
    .find(Array.isArray) as unknown[] | undefined;
  let correctOrder: string[];
  if (rawAnswer?.length === mapped.length) {
    correctOrder = rawAnswer.map(entry => {
      const name = stringOf(asData(entry)?.id ?? asData(entry)?.text ?? entry);
      const asIndex = Number(name);
      const match = mapped.find(item => item.id === name || item.text.toLowerCase() === name.toLowerCase());
      return match?.id ?? (Number.isInteger(asIndex) && mapped[asIndex] ? mapped[asIndex].id : name);
    });
    if (new Set(correctOrder).size !== mapped.length || correctOrder.some(id => !mapped.some(item => item.id === id))) {
      correctOrder = [...mapped].sort((a, b) => a.position - b.position).map(item => item.id);
    }
  } else {
    correctOrder = [...mapped].sort((a, b) => a.position - b.position).map(item => item.id);
  }
  return {
    id: String(q.id ?? q.questionId ?? `sequence-question-${index + 1}`),
    text: textOf(q, ["text", "questionText", "question", "prompt", "instruction"], "Put the steps in the correct order."),
    items: mapped.map(({ id, text, image, alt }) => ({ id, text, image, alt })),
    correctOrder,
    shuffleSteps: q.shuffleSteps !== false,
    marks: Math.max(0, Number(q.points ?? q.marks ?? 1) || 1),
    hint: textOf(q, ["hint", "hintText", "hintBefore"]),
    allowHint: q.allowHint !== false && q.showHint !== false,
    bloom: textOf(q, ["bloom", "bloomTaxonomy", "bloomsTaxonomy", "bloomLevel"], "Analyse"),
  };
}

function readDrafts(keys: string[]): Data[] {
  const all: Array<{ content: Data; time: number; priority: number }> = [];
  keys.forEach((key, priority) => {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const json: unknown = JSON.parse(raw);
        const content = asData(json) ?? (Array.isArray(json) ? { questions: json } : null);
        if (!content) continue;
        const stamp = content.savedAt ?? content.updatedAt ?? content.lastModified;
        const time = typeof stamp === "number" ? stamp : Date.parse(stringOf(stamp));
        all.push({ content, time: Number.isFinite(time) ? time : 0, priority });
      } catch { /* Another compatible creator key may contain the assessment. */ }
    }
  });
  all.sort((a, b) => b.time - a.time || a.priority - b.priority);
  return all.map(item => item.content);
}

function getQuestions(draft: Data): unknown[] {
  const containers = [draft, draft.content, draft.draft, draft.assessment, draft.assessmentContent]
    .map(asData).filter((d): d is Data => d !== null);
  for (const container of containers) {
    for (const key of ["questions", "sequenceQuestions", "items", "questionList"]) {
      if (Array.isArray(container[key]) && (container[key] as unknown[]).length) return container[key] as unknown[];
    }
  }
  return Array.isArray(draft.steps) || Array.isArray(draft.sequenceItems) ? [draft] : [];
}

// Sample only when visiting the standalone route without a saved creator sequence.
// These image names are placeholders: put your own SVG/PNG in public/assets/viewericons.
const SAMPLE: SequenceQuestion = {
  id: "sample-image-sequence", text: "Put the machine-learning Steps in the correct order",
  shuffleSteps: true, marks: 4, bloom: "Analyse", hint: "Begin with the dataset, then prepare, train, evaluate and deploy the model.", allowHint: true,
  items: [
    { id: "collect", text: "Collect Data", image: `${VIEWER_ICONS}sequence-collect-data.svg`, alt: "Collect data" },
    { id: "evaluate", text: "Evaluate", image: `${VIEWER_ICONS}sequence-evaluate.svg`, alt: "Evaluate" },
    { id: "clean", text: "Clean Data", image: `${VIEWER_ICONS}sequence-clean-data.svg`, alt: "Clean data" },
    { id: "deploy", text: "Deploy", image: `${VIEWER_ICONS}sequence-deploy.svg`, alt: "Deploy" },
    { id: "train", text: "Train The Model", image: `${VIEWER_ICONS}sequence-train-model.svg`, alt: "Train the model" },
  ],
  correctOrder: ["collect", "clean", "train", "evaluate", "deploy"],
};

function loadDraft(): ViewerDraft {
  const savedImageBased = getImageViewerBridge("image-sequencing");
  const savedQuestions = savedImageBased.questions.map(parseQuestion).filter((q): q is SequenceQuestion => q !== null);
  if (savedQuestions.length) return { title: savedImageBased.title, durationSeconds: savedImageBased.durationSeconds, questions: savedQuestions, isSample: false };
  const drafts = readDrafts(CONTENT_KEYS);
  const details = readDrafts(DETAILS_KEYS)[0] ?? {};
  const rawDuration = details.duration ?? details.timeLimit ?? details.totalTime ?? 30;
  const durationNumber = Number.parseFloat(String(rawDuration));
  const durationSeconds = Math.max(60, Math.round((durationNumber > 0 ? durationNumber : 30) * (/hour/i.test(String(rawDuration)) ? 3600 : 60)));
  for (const entry of drafts) {
    const questions = getQuestions(entry).map(parseQuestion).filter((q): q is SequenceQuestion => q !== null);
    if (questions.length) {
      return {
        title: textOf(details, ["assessmentTitle", "assessmentName", "title", "name"],
          textOf(entry, ["title", "assessmentTitle"], "Introduction to Artificial Intelligence")),
        durationSeconds, questions, isSample: false,
      };
    }
  }
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const actualAssessment = /\/assessments\/[^/]+\/viewer\/?$/i.test(path) || !!params.get("assessmentId");
  if (!actualAssessment || params.get("demo") === "1") {
    return { title: "Introduction to Artificial Intelligence", durationSeconds: 30 * 60 + 42, questions: [SAMPLE], isSample: true };
  }
  return { title: textOf(details, ["assessmentTitle", "title"], "Assessment"), durationSeconds, questions: [], isSample: false };
}

function fingerprint(draft: ViewerDraft): string {
  const data = JSON.stringify(draft.questions.map(q => [q.id, q.text, q.items, q.correctOrder]));
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
  return `${draft.questions.length}-${(hash >>> 0).toString(16)}`;
}

function initialSequenceOrder(question: SequenceQuestion): string[] {
  const ids = question.items.map(item => item.id);
  if (!question.shuffleSteps || ids.length < 2) return ids;
  // A stable, deterministic shuffle: the order is not changed on React re-renders.
  let hash = 2166136261;
  for (const c of question.id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const shuffled = ids.map((id, index) => ({
    id, rank: (Math.imul(index + 1, 2654435761) ^ hash) >>> 0,
  })).sort((a, b) => a.rank - b.rank).map(item => item.id);
  // Ensure shuffle is visually meaningful even if the pseudo-random order happens to match.
  return shuffled.every((id, i) => id === ids[i]) ? [...ids.slice(1), ids[0]] : shuffled;
}
function getOrder(question: SequenceQuestion, stored: string[] | undefined): string[] {
  const original = question.items.map(item => item.id);
  return stored && stored.length === original.length && new Set(stored).size === original.length &&
    stored.every(id => original.includes(id)) ? stored : initialSequenceOrder(question);
}
function isComplete(q: SequenceQuestion, order: string[] | undefined, interacted: boolean) {
  // Navigator 'Answered' means the learner interacted, not that the answer is correct.
  return interacted && getOrder(q, order).length === q.items.length;
}
function isCorrect(q: SequenceQuestion, order: string[] | undefined, interacted: boolean) {
  return isComplete(q, order, interacted) &&
    getOrder(q, order).every((id, index) => id === q.correctOrder[index]);
}
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${VIEWER_ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}
function Clock({ seconds }: { seconds: number }) {
  const value = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60]
    .map(n => String(n).padStart(2, "0"));
  return <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, i) => <span className="viewerTimeGroup" key={i}>
      {i > 0 && <span className="viewerTimeColon">:</span>}
      {part.split("").map((digit, j) => <span className="viewerTimeDigit" key={j}>{digit}</span>)}
    </span>)}
  </div>;
}
function StepPicture({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [src]);
  return <span className="seq-image-frame">
    {src && !error ? <img src={src} alt={alt} onError={() => setError(true)} /> :
      <span className="seq-image-placeholder" aria-label="Creator image placeholder">Image</span>}
  </span>;
}

export default function ImageSequenceViewerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ViewerDraft>({ title: "", durationSeconds: 1800, questions: [], isSample: false });
  const [current, setCurrent] = useState(0);
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const signature = useMemo(() => fingerprint(draft), [draft]);
  const [attemptScope] = useState(() => { const id=getActiveAssessmentId()||"standalone"; const record=getAssessment(id); return `${id}:${record ? learnerAssessmentData(record).attemptsUsed : 0}`; });
  const stateKey = `${SESSION_KEY}:${attemptScope}:${draft.isSample ? "preview" : signature}${isImageViewerRetry() ? ":retry" : ""}`;

  useEffect(() => {
    const initial = loadDraft();
    const retry = applyImageViewerRetry(initial.questions,"image-sequencing",initial.durationSeconds);
    const loaded = { ...initial, ...retry, durationSeconds: Math.max(60, Number(retry.durationSeconds ?? initial.durationSeconds) || 0) };
    const stamp = fingerprint(loaded);
    const key = `${SESSION_KEY}:${attemptScope}:${loaded.isSample ? "preview" : stamp}${isImageViewerRetry() ? ":retry" : ""}`;
    const legacyKey = `${SESSION_KEY}:${loaded.isSample ? "preview" : stamp}${isImageViewerRetry() ? ":retry" : ""}`;
    const time = Date.now();
    let state: Partial<Attempt> = {};
    try {
      const current=sessionStorage.getItem(key);
      const legacy=current ? null : JSON.parse(sessionStorage.getItem(legacyKey)||"null");
      state=current ? JSON.parse(current) : legacy && !legacy.submitted ? legacy : {};
    } catch { /* Fresh attempt */ }
    if (state.signature === stamp && state.expiresAt) {
      setCurrent(Math.max(0, Math.min(state.current ?? 0, loaded.questions.length - 1)));
      setOrders(state.orders ?? {});
      // Preserve any completed checks from older saved attempts.
      const previousChecked = (state as Partial<Attempt> & { checked?: string[] }).checked ?? [];
      setTouched([...new Set([...(state.touched ?? []), ...previousChecked])]);
      setVisited(state.visited ?? []);
      setFlagged(state.flagged ?? []); setExpiresAt(state.expiresAt);
      setSubmitted(!!state.submitted);
    } else {
      setCurrent(0); setOrders({}); setTouched([]);
      setVisited([]); setFlagged([]); setSubmitted(false);
      setExpiresAt(time + Math.max(60, Number(loaded.durationSeconds) || 0) * 1000);
    }
    setDraft(loaded); setHintOpen(false); setNow(time); setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted]);
  useEffect(() => {
    if (!ready) return;
    const state: Attempt = { signature, current, orders, touched, visited, flagged, expiresAt, submitted };
    try { sessionStorage.setItem(stateKey, JSON.stringify(state)); } catch { /* In-memory still works */ }
  }, [ready, stateKey, signature, current, orders, touched, visited, flagged, expiresAt, submitted]);

  const questions = draft.questions;
  const question = questions[current];
  const total = questions.length;
  const completed = questions.filter(q => isComplete(q, orders[q.id], touched.includes(q.id))).length;
  const remaining = total - completed;
  const progressPercent = total ? Math.round(completed / total * 100) : 0;
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;
  const isLocked = submitted || (ready && expiresAt > 0 && secondsLeft <= 0);
  const displayedOrder = question ? getOrder(question, orders[question.id]) : [];
  const displayedItems = question ? displayedOrder.map(id => question.items.find(item => item.id === id)).filter((item): item is SequenceItem => !!item) : [];
  const score = useMemo(() => questions.reduce((sum, q) => {
    const correct = isCorrect(q, orders[q.id], touched.includes(q.id));
    return sum + (correct ? q.marks : 0);
  }, 0), [questions, orders, touched]);

  useEffect(() => {
    if (!ready || submitted || !expiresAt || secondsLeft > 0) return;
    submit(true);
  }, [ready, submitted, expiresAt, secondsLeft]);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    if (!question || isLocked || question.items.length < 2) return;
    const target = index + direction;
    if (target < 0 || target >= question.items.length) return;
    setOrders(old => {
      const next = [...getOrder(question, old[question.id])];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...old, [question.id]: next };
    });
    setTouched(old => old.includes(question.id) ? old : [...old, question.id]);
    setNotice("");
  }, [question, isLocked]);

  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (question) setVisited(old => old.includes(question.id) ? old : [...old, question.id]);
    setCurrent(index); setHintOpen(false); setNotice("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };
  const toggleFlag = () => {
    if (!question || isLocked) return;
    setFlagged(old => old.includes(question.id) ? old.filter(id => id !== question.id) : [...old, question.id]);
  };
  const submit = (auto = false) => {
    if (submitted || (!auto && isLocked)) return;
    if (!auto) {setConfirmOpen(true);return;}
    const saved = saveImageViewerSubmission({title:draft.title,subtype:"image-sequencing",retry:isImageViewerRetry(),
      durationSeconds:draft.durationSeconds,secondsRemaining:secondsLeft,
      questions:questions.map(q=>{
        const chosen=getOrder(q,orders[q.id]);
        const answered=touched.includes(q.id);
        const correct=answered && isCorrect(q,orders[q.id],true);
        const describe=(ids:string[])=>ids.map(id=>q.items.find(item=>item.id===id)?.text||id).join(" → ");
        return {id:q.id,text:q.text,options:[describe(q.correctOrder),describe(chosen)],correct:0,
          selected:answered?(correct?0:1):null,points:q.marks,earnedMarks:correct?q.marks:0,
          flagged:flagged.includes(q.id),hint:q.hint,bloom:q.bloom};
      })});
    if (!saved && !draft.isSample) {setNotice("Unable to save your result. Please try again.");setConfirmOpen(false);return;}
    setSubmitted(true);setConfirmOpen(false);setSuccessOpen(true);setNotice("Assessment submitted.");
  };

  return <main className="superAdminPage institutionAdminPage viewerAppShell viewImageSequenceApp">
    <div className="dashboardLayout viewerLayout">
      <Sidebar />
      <section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <div ref={scrollRef} className="institutionScrollArea viewerScroll">
          <div className="pageContent institutionPageContent viewerContent">
            <div className="viewerExamTop">
              <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
                <Link href="/super_admin">Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/>
                <Link href="/Assessment">Assessment</Link><Icon name="arrow-right-double.svg" size={20}/>
                <strong>{draft.title || "Assessment"}</strong>
              </nav>
              <Clock seconds={secondsLeft}/>
            </div>
            <div className="viewerPageHeading viewerExamHeading"><h1>{draft.title || "Assessment"}</h1></div>
            <div className="viewerExamGrid">
              <section className="viewerExamCard viewerQuestionCard" aria-label="Assessment question">
                <div className="viewerProgressArea">
                  <div className="viewerProgressLabel"><strong>{ready && total ? `${current + 1}/${total}` : `0/${total}`}</strong><strong className="viewerMarks">{question?.marks ?? 0} {question?.marks === 1 ? "Mark" : "Marks"}</strong></div>
                  <div className="viewerProgressRow"><div className="viewerProgressTrack"><span style={{ width: `${progressPercent}%` }} /></div><strong>{progressPercent}%</strong></div>
                </div>
                {!ready ? <p className="viewerInlineNotice">Loading sequence questions...</p> : question ? <>
                  <div className="viewerQuestionHeading"><h2>Question {current + 1}</h2><p>{question.text}</p></div>
                  <div className="seq-list" aria-label="Reorder the steps">
                    {displayedItems.map((item, index) => <div className="seq-row" key={item.id}>
                      <div className="seq-image-tile">
                        <span className="seq-letter">{String.fromCharCode(65 + index)}.</span>
                        <StepPicture src={item.image} alt={item.alt}/>
                      </div>
                      <div className="seq-text-tile">{item.text}</div>
                      <button type="button" className="seq-arrow-btn" disabled={isLocked || index === displayedItems.length - 1}
                        aria-label={`Move ${item.text} down`} onClick={() => moveItem(index, 1)}>
                        <Icon name="arrow-down-big.svg" size={27}/>
                      </button>
                      <button type="button" className="seq-arrow-btn" disabled={isLocked || index === 0}
                        aria-label={`Move ${item.text} up`} onClick={() => moveItem(index, -1)}>
                        <Icon name="arrow-up-big.svg" size={27}/>
                      </button>
                    </div>)}
                  </div>
                  {question.allowHint && <section className="viewerHintBox">
                    <button type="button" className="viewerHintToggle" aria-expanded={hintOpen} onClick={() => setHintOpen(open => !open)}>
                      <span className="viewerHintTitle"><span className="viewerHintIcon"><Icon name="idea.svg" size={25}/></span><span>Hint{hintOpen && <small>{question.hint || "No hint has been added."}</small>}</span></span>
                      <span className="seq-hint-eye"><Icon name={hintOpen ? "eye-off.svg" : "view.svg"} size={20}/></span>
                    </button>
                  </section>}
                  <div className="viewerQuestionSettings">
                    <div><label>Bloom’s Taxonomy</label><span className="viewerBloomValue">{question.bloom || "Not specified"}</span></div>
                    <button type="button" className={`viewerFlagButton ${flagged.includes(question.id) ? "isFlagged" : ""}`}
                      disabled={isLocked} onClick={toggleFlag} aria-pressed={flagged.includes(question.id)}>
                      <Icon name="flag.svg" size={22}/>{flagged.includes(question.id) ? "Remove flag" : "Flag for review"}
                    </button>
                  </div>
                  {notice && <p className="viewerInlineNotice" role="status">{notice}</p>}
                  <div className="viewerExamActions">
                    {current > 0 && <button type="button" className="viewerExamButton" disabled={current === 0} onClick={() => goTo(current - 1)}><Icon name="arrowleft.svg"/>Previous</button>}
                    <button type="button" className="viewerExamButton viewerNext" disabled={isLocked}
                      onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                      {current === total - 1 ? "Submit" : "Next"}<Icon name="arrowrightg.svg"/>
                    </button>
                  </div>
                </> : <p className="viewerInlineNotice">No saved image-sequence questions were found for this assessment.</p>}
              </section>
              <aside className="viewerExamCard viewerNavigator" aria-label="Question navigator">
                <h2>Question Navigator</h2>
                <div className="viewerQuestionTiles">
                  {questions.map((q, index) => {
                    const done = isComplete(q, orders[q.id], touched.includes(q.id));
                    const active = index === current;
                    const partial = touched.includes(q.id) || visited.includes(q.id);
                    const status = active ? "current" : done ? "answered" : partial ? "progress" : "pending";
                    return <button type="button" key={q.id} className={`viewerQuestionTile is-${status}`}
                      aria-current={active ? "step" : undefined} aria-label={`Question ${index + 1}, ${active ? "current" : done ? "completed" : partial ? "in progress" : "pending"}`}
                      onClick={() => goTo(index)}>{index + 1}</button>;
                  })}
                </div>
                <div className="viewerStatusRows">
                  <div><Icon name="checkmark-circle.svg"/><span>Answered</span><strong>{String(completed).padStart(2, "0")}</strong></div>
                  <div><span className="viewerRemainingCircle"/><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                  <div><Icon name="flag.svg"/><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                </div>
                <h2 className="viewerToolsHeading">Tools</h2>
                <div className="viewerToolsList">
                  <button type="button" onClick={() => router.push(imageViewerToolPath("scratch"))}><Icon name="sticky-note.svg"/>Scratch Pad<Icon name="arrowupright.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(imageViewerToolPath("calculator"))}><Icon name="calculator.svg"/>Calculator<Icon name="arrowup.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(imageViewerToolPath("formulasheet"))}><Icon name="sigma.svg"/>Formula Sheet<Icon name="arrowupg.svg" size={18}/></button>
                </div>
                {isLocked && <p className="viewerInlineNotice" role="status">{submitted ? "Assessment submitted." : "Time expired."}</p>}
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
    <ImageViewerSubmitPopups title={draft.title} answered={completed} total={total} flagged={flagged.length}
      earnedMarks={score} totalMarks={questions.reduce((n,q)=>n+q.marks,0)}
      confirmOpen={confirmOpen} submittedOpen={successOpen} isRetry={isImageViewerRetry()}
      onBack={()=>setConfirmOpen(false)} onSubmit={()=>submit(true)} onClose={()=>setSuccessOpen(false)}/>

  </main>;
}
