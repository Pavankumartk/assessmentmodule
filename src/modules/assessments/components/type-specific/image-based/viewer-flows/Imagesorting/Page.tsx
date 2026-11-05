"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./imagesorting.css";
import { getImageViewerBridge, imageViewerToolPath } from "../../image-viewer-bridge";
import ImageViewerSubmitPopups from "../../ImageViewerSubmitPopups";
import { applyImageViewerRetry, imageViewerRelease, isImageViewerRetry, saveImageViewerSubmission } from "../../image-viewer-submission";
import { resultPath } from "@/modules/assessments/storage/assessment-storage";


const VIEWER_ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "imageSortingContentDraft", "imagesortingContentDraft", "imageSortContentDraft",
  "imageClassificationContentDraft", "classificationContentDraft", "categorizationContentDraft",
  "sortingContentDraft", "sortContentDraft", "hardwareSoftwareContentDraft",
  "dragDropContentDraft", "dragdropContentDraft", "assessment-viewer-questions",
];
const DETAILS_KEYS = [
  "imageSortingAssessmentDraft", "imageSortAssessmentDraft", "classificationAssessmentDraft",
  "assessmentDetailsDraft", "dragDropAssessmentDraft",
];
const SESSION_PREFIX = "imageSortingViewerState";

type Data = Record<string, unknown>;
type SortItem = { id: string; text: string; image?: string; alt: string; correctCategory?: string };
type SortCategory = { id: string; label: string };
type SortQuestion = {
  id: string; text: string; items: SortItem[]; categories: SortCategory[];
  marks: number; hint: string; allowHint: boolean; bloom: string;
};
type ViewerDraft = { title: string; durationSeconds: number; questions: SortQuestion[]; isSample: boolean };
type Attempt = {
  signature: string; current: number; choices: Record<string, Record<string, string>>;
  visited: string[]; flagged: string[];
  expiresAt: number; submitted: boolean;
};
const asData = (value: unknown): Data | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Data : null;
const str = (value: unknown) => typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
function pick(data: Data, names: string[], fallback = "") {
  for (const name of names) { const value = str(data[name]); if (value) return value; }
  return fallback;
}
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${VIEWER_ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}

// Use each creator-uploaded image URL/data URL as saved. Never reuse a sample image for real questions.
function savedImage(raw: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof raw === "string") {
    const value = raw.trim().replace(/\\/g, "/");
    if (!value) return undefined;
    const html = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(value);
    if (html) return savedImage(html[1], depth + 1);
    if (/^(https?:\/\/|blob:|data:image\/(?:png|jpe?g|webp|gif|avif|svg\+xml);base64,)/i.test(value)) return value;
    if (/^(?:file:|[a-z]:\/)/i.test(value)) return undefined;
    const path = value.replace(/^\.?\/?public\//i, "/").replace(/^\.\//, "");
    if (/^\/(?:assets|uploads|images|media)\//i.test(path)) return path;
    if (/^(?:assets|uploads|images|media)\//i.test(path)) return `/${path}`;
    if (/^[\w\s().-]+\.(?:svg|png|jpe?g|webp|gif|avif)$/i.test(path)) return `${VIEWER_ICONS}${path}`;
    return undefined;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) { const source = savedImage(item, depth + 1); if (source) return source; }
    return undefined;
  }
  const value = asData(raw);
  if (!value || /^(?:audio|video)\//i.test(str(value.mimeType ?? value.type))) return undefined;
  for (const key of ["imageUrl", "imageSrc", "src", "url", "image", "picture", "imageData", "dataUrl", "dataURL", "uploadedImage", "icon", "iconSrc", "file", "path", "media", "html", "content"]) {
    const source = savedImage(value[key], depth + 1);
    if (source) return source;
  }
  return undefined;
}
function normalizeCategories(raw: unknown): SortCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const data = asData(entry);
    const label = data ? pick(data, ["label", "name", "text", "title", "value"]) : str(entry);
    const id = data ? str(data.id ?? data.key ?? data.value) || label : label;
    return { id: id || `category-${index}`, label };
  }).filter(category => category.label);
}
function resolveCategory(raw: unknown, categories: SortCategory[]): string | undefined {
  const data = asData(raw);
  const value = str(data ? data.id ?? data.key ?? data.value ?? data.label ?? data.text : raw);
  if (!value) return undefined;
  const match = categories.find(cat => cat.id.toLowerCase() === value.toLowerCase() || cat.label.toLowerCase() === value.toLowerCase());
  if (match) return match.id;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < categories.length ? categories[index].id : undefined;
}
function parseQuestion(raw: unknown, index: number): SortQuestion | null {
  const q = asData(raw);
  if (!q) return null;
  const type = pick(q, ["type", "questionType", "subtype", "questionMode", "mode", "activityType"]).toLowerCase();
  const entries = (Array.isArray(q.sortItems) ? q.sortItems : Array.isArray(q.sortingItems) ? q.sortingItems :
    Array.isArray(q.classificationItems) ? q.classificationItems : Array.isArray(q.imageItems) ? q.imageItems :
    Array.isArray(q.items) ? q.items : Array.isArray(q.options) ? q.options : []) as unknown[];
  const hasClassification = entries.some(entry => {
    const item = asData(entry);
    return !!item && ["category", "correctCategory", "answerCategory", "group", "correctGroup", "classification"].some(key => key in item);
  });
  const explicitlySorting = /sort|classif|categori[sz]|hardware|software/.test(type);
  if (!entries.length || (!explicitlySorting && !hasClassification && !Array.isArray(q.categories))) return null;
  const categories = normalizeCategories(q.categories ?? q.categoryOptions ?? q.groups ?? q.sortingCategories);
  const finalCategories = categories.length ? categories : [
    { id: "hardware", label: "Hardware" }, { id: "software", label: "Software" },
  ];
  const correctMapping = asData(q.correctMapping) ?? asData(q.mapping) ?? {};
  const correctAnswers = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
  const items: SortItem[] = entries.map((entry, itemIndex) => {
    const data = asData(entry);
    const id = str(data?.id ?? data?.itemId ?? data?.optionId) || `sort-item-${itemIndex + 1}`;
    const text = data ? pick(data, ["text", "label", "title", "name", "item", "content", "value"]) : str(entry);
    const rawCategory = data?.correctCategory ?? data?.answerCategory ?? data?.correctGroup ?? data?.category ?? data?.group ?? data?.classification ?? correctMapping[id] ?? correctMapping[String(itemIndex)] ?? correctAnswers[itemIndex];
    return { id, text, image: savedImage(data ?? undefined), alt: data ? pick(data, ["alt", "imageAlt", "altText"], text) : text,
      correctCategory: resolveCategory(rawCategory, finalCategories) };
  }).filter(item => item.text);
  if (!items.length) return null;
  return {
    id: str(q.id ?? q.questionId) || `sorting-question-${index + 1}`,
    text: pick(q, ["text", "questionText", "question", "prompt", "instruction"], "Sort each item into the correct category."),
    items, categories: finalCategories,
    marks: Math.max(0, Number(q.marks ?? q.points ?? 1) || 1),
    hint: pick(q, ["hint", "hintText", "hintBefore"]),
    allowHint: q.allowHint !== false && q.showHint !== false,
    bloom: pick(q, ["bloom", "bloomTaxonomy", "bloomsTaxonomy", "bloomLevel"], "Analyse"),
  };
}
function readDrafts(keys: string[], assessmentId: string): Data[] {
  const found: Array<{ value: Data; priority: number; timestamp: number }> = [];
  const allKeys = [...(assessmentId !== "demo" ? keys.map(key => `${key}:${assessmentId}`) : []), ...keys];
  allKeys.forEach((key, priority) => {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed: unknown = JSON.parse(raw);
        const value = asData(parsed) ?? (Array.isArray(parsed) ? { questions: parsed } : null);
        if (!value) continue;
        const stamp = value.savedAt ?? value.updatedAt ?? value.lastModified;
        const timestamp = typeof stamp === "number" ? stamp : Date.parse(str(stamp));
        found.push({ value, priority, timestamp: Number.isFinite(timestamp) ? timestamp : 0 });
      } catch { /* Try the next compatible key. */ }
    }
  });
  found.sort((a, b) => a.priority - b.priority || b.timestamp - a.timestamp);
  return found.map(item => item.value);
}
function storedQuestions(content: Data): unknown[] {
  const nested = [content, content.content, content.draft, content.assessment, content.assessmentContent]
    .map(asData).filter((value): value is Data => !!value);
  for (const value of nested) {
    for (const key of ["questions", "sortingQuestions", "classificationQuestions", "items", "questionList"]) {
      if (Array.isArray(value[key]) && (value[key] as unknown[]).length) return value[key] as unknown[];
    }
  }
  return Array.isArray(content.sortItems) || Array.isArray(content.sortingItems) ? [content] : [];
}

// Only ONE sample question for the standalone preview. Add your own icons at these exact paths.
const SAMPLE: SortQuestion = {
  id: "imagesorting-preview", text: "Sort each item as Hardware or Software", marks: 4,
  categories: [{ id: "hardware", label: "Hardware" }, { id: "software", label: "Software" }],
  items: [
    { id: "monitor", text: "Monitor", image: `${VIEWER_ICONS}imagesorting-monitor.svg`, alt: "Monitor", correctCategory: "hardware" },
    { id: "keyboard", text: "Keyboard", image: `${VIEWER_ICONS}imagesorting-keyboard.svg`, alt: "Keyboard", correctCategory: "hardware" },
    { id: "browser", text: "Web Browser", image: `${VIEWER_ICONS}imagesorting-browser.svg`, alt: "Web Browser", correctCategory: "software" },
    { id: "editor", text: "Text Editor", image: `${VIEWER_ICONS}imagesorting-editor.svg`, alt: "Text Editor", correctCategory: "software" },
  ],
  hint: "A physical component is hardware; an application is software.", allowHint: true, bloom: "Analyse",
};
function loadDraft(assessmentId: string): ViewerDraft {
  const savedImageBased = getImageViewerBridge("image-sorting");
  const savedQuestions = savedImageBased.questions.map(parseQuestion).filter((q): q is SortQuestion => q !== null);
  if (savedQuestions.length) return { title: savedImageBased.title, durationSeconds: savedImageBased.durationSeconds, questions: savedQuestions, isSample: false };
  const candidates = readDrafts(CONTENT_KEYS, assessmentId);
  const details = readDrafts(DETAILS_KEYS, assessmentId)[0] ?? {};
  const rawDuration = details.duration ?? details.timeLimit ?? details.totalTime ?? 30;
  const numericDuration = Number.parseFloat(String(rawDuration));
  const durationSeconds = Math.max(60, Math.round((numericDuration > 0 ? numericDuration : 30) * (/hour/i.test(String(rawDuration)) ? 3600 : 60)));
  for (const content of candidates) {
    const questions = storedQuestions(content).map(parseQuestion).filter((q): q is SortQuestion => q !== null);
    if (questions.length) return {
      title: pick(details, ["assessmentTitle", "assessmentName", "title", "name"],
        pick(content, ["assessmentTitle", "title"], "Introduction to Artificial Intelligence")),
      questions, durationSeconds, isSample: false,
    };
  }
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const realAssessment = /\/assessments\/[^/]+\/viewer\/?$/i.test(path) || (assessmentId !== "demo" && !!assessmentId);
  if (!realAssessment || params.get("demo") === "1") return {
    title: "Introduction to Artificial Intelligence", durationSeconds: 30 * 60 + 42,
    questions: [SAMPLE], isSample: true,
  };
  return { title: pick(details, ["assessmentTitle", "title"], "Assessment"), durationSeconds, questions: [], isSample: false };
}
function fingerprint(draft: ViewerDraft) {
  const value = JSON.stringify(draft.questions.map(q => [q.id, q.text, q.items, q.categories]));
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${draft.questions.length}-${(hash >>> 0).toString(16)}`;
}
function complete(question: SortQuestion, selections: Record<string, string> | undefined) {
  return question.items.length > 0 && question.items.every(item =>
    question.categories.some(category => category.id === selections?.[item.id]));
}
function correctCount(question: SortQuestion, selections: Record<string, string> | undefined) {
  return question.items.filter(item => item.correctCategory && selections?.[item.id] === item.correctCategory).length;
}
function Clock({ seconds }: { seconds: number }) {
  const safe = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(safe / 3600), Math.floor(safe % 3600 / 60), safe % 60]
    .map(value => String(value).padStart(2, "0"));
  return <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, i) => <span className="viewerTimeGroup" key={i}>
      {i > 0 && <span className="viewerTimeColon">:</span>}
      {part.split("").map((digit, j) => <span className="viewerTimeDigit" key={j}>{digit}</span>)}
    </span>)}
  </div>;
}
function ItemImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className="sort-image-frame">
    {src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} /> :
      <span className="sort-image-placeholder">Image</span>}
  </span>;
}

export default function ImageSortingViewerPage() {
  const router = useRouter();
  const params = useParams<{ assessmentId?: string }>();
  const assessmentId = params?.assessmentId ?? "demo";
  const [draft, setDraft] = useState<ViewerDraft>({ title: "", durationSeconds: 1800, questions: [], isSample: false });
  const [current, setCurrent] = useState(0);
  const [choices, setChoices] = useState<Record<string, Record<string, string>>>({});
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
  const questions = draft.questions;
  const question = questions[current];
  const total = questions.length;
  const signature = useMemo(() => fingerprint(draft), [draft]);
  const stateKey = `${SESSION_PREFIX}:${assessmentId}:${signature}${isImageViewerRetry() ? ":retry" : ""}`;

  useEffect(() => {
    const initial = loadDraft(assessmentId);
    const retry = applyImageViewerRetry(initial.questions,"image-sorting",initial.durationSeconds);
    const loaded = { ...initial, ...retry };
    const stamp = fingerprint(loaded);
    const key = `${SESSION_PREFIX}:${assessmentId}:${stamp}${isImageViewerRetry() ? ":retry" : ""}`;
    let prior: Partial<Attempt> | null = null;
    try { prior = JSON.parse(window.sessionStorage.getItem(key) || "null") as Partial<Attempt> | null; } catch { /* Invalid older data. */ }
    const valid = prior?.signature === stamp;
    const time = Date.now();
    setDraft(loaded);
    setCurrent(valid ? Math.min(Math.max(0, prior?.current ?? 0), Math.max(0, loaded.questions.length - 1)) : 0);
    setChoices(valid ? prior?.choices ?? {} : {});
    setVisited(valid ? prior?.visited ?? [] : []);
    setFlagged(valid ? prior?.flagged ?? [] : []);
    setSubmitted(valid ? !!prior?.submitted : false);
    setExpiresAt(valid && prior?.expiresAt ? prior.expiresAt : time + loaded.durationSeconds * 1000);
    setNow(time);
    setHintOpen(false);
    setReady(true);
  }, [assessmentId]);

  useEffect(() => {
    if (!ready) return;
    const state: Attempt = { signature, current, choices, visited, flagged, expiresAt, submitted };
    try { sessionStorage.setItem(stateKey, JSON.stringify(state)); } catch { /* In-memory still works. */ }
  }, [ready, signature, stateKey, current, choices, visited, flagged, expiresAt, submitted]);

  useEffect(() => {
    if (!ready || submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted]);

  const remainingSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;
  const isLocked = submitted || remainingSeconds === 0;
  const completed = questions.filter(q => complete(q, choices[q.id])).length;
  const remaining = total - completed;
  const progressPercent = total ? Math.round(completed / total * 100) : 0;
  const score = questions.reduce((sum, q) => {
    if (!complete(q, choices[q.id])) return sum;
    if (q.items.some(item => !item.correctCategory)) return sum;
    return sum + q.marks * correctCount(q, choices[q.id]) / Math.max(q.items.length, 1);
  }, 0);
  useEffect(() => {
    if (!ready || submitted || !expiresAt || remainingSeconds > 0) return;
    submit(true);
  }, [ready, submitted, expiresAt, remainingSeconds]);

  const choose = useCallback((itemId: string, categoryId: string) => {
    if (!question || isLocked) return;
    setChoices(old => {
      const selected = { ...(old[question.id] ?? {}) };
      if (selected[itemId] === categoryId) delete selected[itemId];
      else selected[itemId] = categoryId;
      return { ...old, [question.id]: selected };
    });
    setNotice("");
  }, [question, isLocked]);

  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (question) setVisited(old => old.includes(question.id) ? old : [...old, question.id]);
    setCurrent(index);
    setHintOpen(false);
    setNotice("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };
  const toggleFlag = () => {
    if (!question || isLocked) return;
    setFlagged(old => old.includes(question.id) ? old.filter(id => id !== question.id) : [...old, question.id]);
  };
  const submit = (auto = false) => {
    if (submitted || (!auto && isLocked)) return;
    if (!auto) {setConfirmOpen(true);return;}
    const saved=saveImageViewerSubmission({title:draft.title,subtype:"image-sorting",retry:isImageViewerRetry(),
      durationSeconds:draft.durationSeconds,secondsRemaining:remainingSeconds,
      questions:questions.map(q=>{
        const chosen=choices[q.id]??{};
        const hasAnswer=q.items.some(item=>!!chosen[item.id]);
        const numberCorrect=correctCount(q,chosen);
        const correct=complete(q,chosen)&&numberCorrect===q.items.length;
        const describe=(truth:boolean)=>q.items.map(item=>`${item.text}: ${truth?item.correctCategory??"—":chosen[item.id]??"—"}`).join("; ");
        return {id:q.id,text:q.text,options:[describe(true),describe(false)],correct:0,
          selected:hasAnswer?(correct?0:1):null,points:q.marks,
          earnedMarks:complete(q,chosen)?q.marks*numberCorrect/Math.max(1,q.items.length):0,
          flagged:flagged.includes(q.id),hint:q.hint,bloom:q.bloom};
      })});
    if (!saved && !draft.isSample) {setNotice("Unable to save your result. Please try again.");setConfirmOpen(false);return;}
    setSubmitted(true);setConfirmOpen(false);setSuccessOpen(true);setNotice("Assessment submitted.");
  };

  return <main className="superAdminPage institutionAdminPage viewerAppShell viewImageSortingApp">
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
              <Clock seconds={remainingSeconds}/>
            </div>
            <div className="viewerPageHeading viewerExamHeading"><h1>{draft.title || "Assessment"}</h1></div>
            <div className="viewerExamGrid">
              <section className="viewerExamCard viewerQuestionCard" aria-label="Assessment question">
                <div className="viewerProgressArea">
                  <div className="viewerProgressLabel"><strong>{ready && total ? `${current + 1}/${total}` : `0/${total}`}</strong><strong className="viewerMarks">{question?.marks ?? 0} {question?.marks === 1 ? "Mark" : "Marks"}</strong></div>
                  <div className="viewerProgressRow"><div className="viewerProgressTrack" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Questions answered"><span style={{ width: `${progressPercent}%` }}/></div><strong>{progressPercent}%</strong></div>
                </div>
                {!ready ? <p className="viewerInlineNotice">Loading sorting questions...</p> : question ? <>
                  <div className="viewerQuestionHeading"><h2>Question {current + 1}</h2><p>{question.text}</p></div>
                  <div className="sort-list" aria-label="Classify the items">
                    {question.items.map((item, index) => <div className="sort-row" key={item.id}>
                      <div className="sort-item-main">
                        <div className="sort-image-tile">
                          <span className="sort-letter">{String.fromCharCode(65 + index)}.</span>
                          <ItemImage src={item.image} alt={item.alt}/>
                        </div>
                        <div className="sort-text-tile">{item.text}</div>
                      </div>
                      <div className="sort-category-options" role="group" aria-label={`Classify ${item.text}`}>
                        {question.categories.map(category => {
                          const selected = choices[question.id]?.[item.id] === category.id;
                          return <div className="sort-category-cell" key={category.id}>
                            <button type="button" className={`sort-category-pill ${selected ? "is-selected" : ""}`}
                              onClick={() => choose(item.id, category.id)}
                              disabled={isLocked} aria-pressed={selected}
                              aria-label={`${item.text}: ${category.label}${selected ? ", selected" : ""}`}>
                              {category.label}
                            </button>
                          </div>;
                        })}
                      </div>
                    </div>)}
                  </div>
                  {question.allowHint && <section className="viewerHintBox">
                    <button type="button" className="viewerHintToggle" aria-expanded={hintOpen} onClick={() => setHintOpen(open => !open)}>
                      <span className="viewerHintTitle"><span className="viewerHintIcon"><Icon name="idea.svg" size={25}/></span>
                        <span>Hint{hintOpen && <small>{question.hint || "No hint has been added."}</small>}</span></span>
                      <span className="sort-hint-eye"><Icon name={hintOpen ? "eye-off.svg" : "view.svg"} size={20}/></span>
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
                </> : <p className="viewerInlineNotice">No image-sorting questions were saved for this assessment.</p>}
              </section>
              <aside className="viewerExamCard viewerNavigator" aria-label="Question navigator">
                <h2>Question Navigator</h2>
                <div className="viewerQuestionTiles">
                  {questions.map((q, index) => {
                    const done = complete(q, choices[q.id]);
                    const active = current === index;
                    const inProgress = visited.includes(q.id) || !!Object.keys(choices[q.id] ?? {}).length;
                    const status = active ? "current" : done ? "answered" : inProgress ? "progress" : "pending";
                    return <button type="button" key={q.id} onClick={() => goTo(index)}
                      className={`viewerQuestionTile is-${status}`} aria-current={active ? "step" : undefined}
                      aria-label={`Question ${index + 1}, ${active ? "current" : done ? "completed" : inProgress ? "in progress" : "pending"}`}>
                      {index + 1}
                    </button>;
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
