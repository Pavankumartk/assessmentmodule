"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./imagematch.css";
import { getImageViewerBridge, imageViewerToolPath } from "../../image-viewer-bridge";
import ImageViewerSubmitPopups from "../../ImageViewerSubmitPopups";
import { applyImageViewerRetry, imageViewerRelease, isImageViewerRetry, saveImageViewerSubmission } from "../../image-viewer-submission";
import { getActiveAssessmentId, resultPath } from "@/modules/assessments/storage/assessment-storage";


// UI icons come from the SAME viewericons directory as the supplied reference.
const VIEWER_ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "connectDotsContentDraft", "connectdotsContentDraft", "matchFollowingContentDraft", "matchfollowingContentDraft",
  "matchTheFollowingContentDraft", "matchingContentDraft", "imageMatchingContentDraft",
  "imageMatchContentDraft", "pictureMatchingContentDraft", "pictureMatchContentDraft", "imagematchContentDraft",
];
const DETAILS_KEYS = [
  "connectDotsAssessmentDraft", "assessmentDetailsDraft", "matchFollowingAssessmentDraft",
  "matchfollowingAssessmentDraft", "matchTheFollowingAssessmentDraft", "imageMatchingAssessmentDraft", "pictureMatchingAssessmentDraft",
];
const SESSION_PREFIX = "imageMatchingViewerState";

type Data = Record<string, unknown>;
type ImageItem = { id: string; image: string; alt: string };
type Word = { id: string; text: string };
type MatchQuestion = {
  id: string; text: string; images: ImageItem[]; options: Word[];
  correct: number[]; hint: string; allowHint: boolean; bloom: string; points: number;
};
type ViewerDraft = { title: string; durationSeconds: number; questions: MatchQuestion[]; isSample: boolean };
type Attempt = {
  signature: string; current: number; answers: Record<number, number[]>;
  flagged: number[]; visited: number[]; expiresAt: number; submitted: boolean;
};

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${VIEWER_ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}
const asData = (value: unknown): Data | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Data : null;
const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
function first(obj: Data, keys: string[], fallback = ""): string {
  for (const key of keys) { const value = str(obj[key]); if (value) return value; }
  return fallback;
}

// Creator's uploaded image. This does not generate artwork or a second frame.
function imageSource(value: unknown, depth = 0): string | undefined {
  if (depth > 4) return;
  if (typeof value === "string") {
    const raw = value.trim().replace(/\\/g, "/");
    const htmlImage = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(raw);
    if (htmlImage) return imageSource(htmlImage[1], depth + 1);
    if (/^(https?:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,|blob:)/i.test(raw)) return raw;
    if (/^(?:file:|[a-z]:\/)/i.test(raw)) return;
    const pathname = raw.replace(/^\.?\/?public\//i, "/").replace(/^\.\//, "");
    if (/^\/(?:assets|uploads|images|media)\//i.test(pathname)) return pathname;
    if (/^(?:assets|uploads|images|media)\//i.test(pathname)) return `/${pathname}`;
    if (/^[\w\s().-]+\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(pathname))
      return `/assets/assessmenticons/${pathname}`;
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) { const img = imageSource(item, depth + 1); if (img) return img; }
    return;
  }
  const obj = asData(value);
  if (!obj) return;
  if (/^(?:video|audio)\//i.test(str(obj.mimeType ?? obj.type))) return;
  for (const name of ["imageUrl", "imageURL", "imageSrc", "src", "url", "dataUrl", "dataURL",
    "image", "picture", "pictureUrl", "uploadedImage", "imageData", "imageFile", "imagePath", "thumbnail", "file", "files", "path", "content", "html"]) {
    const img = imageSource(obj[name], depth + 1); if (img) return img;
  }
}
function labelOf(value: unknown): string {
  const d = asData(value);
  return d ? first(d, ["text", "label", "word", "topic", "name", "title", "value", "description", "answer"]) : str(value);
}
function choiceIndex(value: unknown, options: Word[]): number {
  if (typeof value === "number" && Number.isInteger(value)) return value >= 0 && value < options.length ? value : -1;
  const string = labelOf(value);
  if (!string) return -1;
  const matching = options.findIndex(opt => opt.id === string || opt.text.toLowerCase() === string.toLowerCase());
  if (matching >= 0) return matching;
  if (/^[A-Z]$/i.test(string)) { const x = string.toUpperCase().charCodeAt(0) - 65; return x < options.length ? x : -1; }
  return -1;
}

function parseQuestion(raw: unknown, index: number): MatchQuestion | null {
  const q = asData(raw); if (!q) return null;
  const mode = first(q, ["questionMode", "subtype", "mode", "matchType", "type"]).toLowerCase();
  const imageMode = /picture|image/.test(mode);
  const pairs = Array.isArray(q.pairs) ? q.pairs : Array.isArray(q.matches) ? q.matches :
    Array.isArray(q.imagePairs) ? q.imagePairs : Array.isArray(q.picturePairs) ? q.picturePairs : null;
  const sources = pairs ?? (Array.isArray(q.images) ? q.images : Array.isArray(q.terms) ? q.terms :
    Array.isArray(q.leftItems) ? q.leftItems : Array.isArray(q.pictureItems) ? q.pictureItems :
    Array.isArray(q.imageItems) ? q.imageItems : Array.isArray(q.items) ? q.items : []);
  const images: ImageItem[] = sources.flatMap((entry, i): ImageItem[] => {
    const item = asData(entry);
    const src = imageSource(item ? (item.leftImage ?? item.questionImage ?? item.imageUrl ?? item.image ??
      item.picture ?? item.imagePath ?? item.imageFile ?? item.uploadedImage ?? item.left ?? item.term ?? item.source ?? item) : entry);
    if (!src) return [];
    return [{ id: String(item?.id ?? `image-${i}`), image: src,
      alt: first(item ?? {}, ["alt", "altText", "label", "name", "title"], `Picture ${i + 1}`) }];
  });
  // Do not display ordinary text / numeric questions in the image-matching viewer.
  if (!images.length || (!imageMode && !pairs && !Array.isArray(q.images))) return null;

  const givenOptions = Array.isArray(q.options) ? q.options : Array.isArray(q.matchingWords) ? q.matchingWords :
    Array.isArray(q.words) ? q.words : Array.isArray(q.topics) ? q.topics :
    Array.isArray(q.dropdownOptions) ? q.dropdownOptions : Array.isArray(q.choices) ? q.choices :
    Array.isArray(q.wordOptions) ? q.wordOptions : Array.isArray(q.rightItems) ? q.rightItems :
    Array.isArray(q.matchOptions) ? q.matchOptions : Array.isArray(q.answerOptions) ? q.answerOptions : null;
  const options: Word[] = (givenOptions ?? pairs?.map(p => {
    const pair = asData(p) ?? {};
    return pair.right ?? pair.description ?? pair.answer ?? pair.match ?? pair.target ?? pair.topic ?? pair.word ?? pair.matchingWord;
  }) ?? []).map((value, i) => {
    const obj = asData(value);
    return { id: String(obj?.id ?? obj?.key ?? `word-${i}`), text: labelOf(value) };
  }).filter(option => !!option.text);
  const extras = Array.isArray(q.distractors) ? q.distractors : Array.isArray(q.extras) ? q.extras : [];
  for (const extra of extras) {
    const text = labelOf(extra);
    if (text && !options.some(o => o.text === text)) options.push({ id: `extra-${options.length}`, text });
  }
  if (!options.length) return null;
  const mapping = asData(q.mapping) ?? asData(q.correctMapping) ?? {};
  const correctArr = Array.isArray(q.correctAnswers) ? q.correctAnswers :
    Array.isArray(q.correctMapping) ? q.correctMapping : [];
  const correct = images.map((image, i) => {
    const pair = asData(sources[i]) ?? {};
    return choiceIndex(correctArr[i] ?? mapping[image.id] ?? mapping[String(i)] ??
      pair.correctOption ?? pair.correct ?? pair.right ?? pair.description ?? pair.answer ??
      pair.target ?? pair.word ?? pair.matchingWord ?? pair.topic,
      options);
  });
  return {
    id: String(q.id ?? q.questionId ?? `picture-question-${index + 1}`),
    text: first(q, ["text", "questionText", "question", "prompt", "instruction"], "Match each picture with its topic."),
    images, options, correct,
    points: Math.max(0, Number(q.points ?? q.marks ?? 1) || 1),
    hint: first(q, ["hint", "hintText", "hintBefore"]),
    allowHint: q.allowHint !== false && q.showHint !== false,
    bloom: first(q, ["bloom", "bloomsTaxonomy", "bloomTaxonomy", "bloomLevel"], "Analyse"),
  };
}
// Look through ALL saved draft candidates, instead of letting a newer text/numeric
// draft hide a legitimate image-matching draft in a different storage key.
function readDrafts(keys: string[]): Data[] {
  const found: Array<{ data: Data; stamp: number; priority: number }> = [];
  for (const [priority, key] of keys.entries()) {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed: unknown = JSON.parse(raw);
        const obj = asData(parsed) ?? (Array.isArray(parsed) ? { questions: parsed } : null);
        if (!obj) continue;
        const stampValue = obj.savedAt ?? obj.updatedAt ?? obj.lastModified;
        const parsedStamp = typeof stampValue === "number" ? stampValue : Date.parse(str(stampValue));
        found.push({ data: obj, stamp: Number.isFinite(parsedStamp) ? parsedStamp : 0, priority });
      } catch { /* Continue looking for a compatible creator draft. */ }
    }
  }
  // When both copies have timestamps, favor the latest. Otherwise preserve key priority.
  found.sort((a, b) => b.stamp - a.stamp || a.priority - b.priority);
  return found.map(record => record.data);
}
function savedQuestionRows(obj: Data): unknown[] {
  const containers: Data[] = [obj, ...[obj.content, obj.draft, obj.assessment, obj.assessmentContent]
    .map(asData).filter((value): value is Data => value !== null)];
  for (const container of containers) {
    for (const key of ["questions", "items", "matchingQuestions", "imageQuestions"]) {
      if (Array.isArray(container[key]) && (container[key] as unknown[]).length) {
        return container[key] as unknown[];
      }
    }
  }
  // A creator can also save the current image-matching question as an object.
  if (Array.isArray(obj.images) || Array.isArray(obj.imagePairs) || Array.isArray(obj.picturePairs)) {
    return [obj];
  }
  return [];
}

function samplePictureQuestion(): MatchQuestion {
  return {
    id: "demo-picture-matching",
    text: "Match each picture with its topic.",
    points: 1,
    images: [
      { id: "brain", image: `${VIEWER_ICONS}demo-imagematch-brain.png`, alt: "Brain" },
      { id: "database", image: `${VIEWER_ICONS}demo-imagematch-database.png`, alt: "Database" },
      { id: "cloud", image: `${VIEWER_ICONS}demo-imagematch-cloud.png`, alt: "Cloud" },
      { id: "security", image: `${VIEWER_ICONS}demo-imagematch-security.png`, alt: "Security shield" },
    ],
    options: ["Neural Network", "Data Analysis", "Security", "Randomly ignores neurons to reduce overfitting", "Printer", "Cloud"]
      .map((text, i) => ({ id: `demo-word-${i}`, text })),
    correct: [0, 1, 5, 2],
    hint: "Match each symbol to the topic it represents.",
    allowHint: true,
    bloom: "Analyse",
  };
}

function loadDraft(): ViewerDraft {
  const savedImageBased = getImageViewerBridge("image-matching");
  const savedQuestions = savedImageBased.questions.map(parseQuestion).filter((q): q is MatchQuestion => q !== null);
  if (savedQuestions.length) return { title: savedImageBased.title, durationSeconds: savedImageBased.durationSeconds, questions: savedQuestions, isSample: false };
  const candidates = readDrafts(CONTENT_KEYS);
  const details = readDrafts(DETAILS_KEYS)[0] ?? {};
  const rawDuration = details.duration ?? details.timeLimit ?? details.totalTime ?? 30;
  const numeric = Number.parseFloat(String(rawDuration));
  const durationSeconds = Math.max(60, Math.round((numeric > 0 ? numeric : 30) *
    (/hour/i.test(String(rawDuration)) ? 3600 : 60)));

  // Extract image questions from all compatible drafts; text/numeric drafts never
  // overwrite picture data or cause a false empty matching screen.
  for (const content of candidates) {
    const rows = savedQuestionRows(content);
    const questions = rows.map(parseQuestion).filter((q): q is MatchQuestion => q !== null);
    if (questions.length) {
      return {
        title: first(details, ["assessmentTitle", "assessmentName", "title", "name"],
          first(content, ["title", "assessmentTitle"], "Introduction to Artificial Intelligence")),
        durationSeconds, questions, isSample: false,
      };
    }
  }

  // ONLY the standalone testing page displays a sample. Real assessments without
  // saved creator questions remain empty, instead of secretly adding demo items.
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const realAssessmentViewer = /\/assessments\/[^/]+\/viewer\/?$/i.test(pathname)
    || Boolean(params?.get("assessmentId"));
  const standalonePreview = params?.get("demo") === "1" || !realAssessmentViewer;
  if (standalonePreview) {
    return {
      title: "Introduction to Artificial Intelligence",
      durationSeconds: 30 * 60 + 42,
      questions: [samplePictureQuestion()],
      isSample: true,
    };
  }
  return {
    title: first(details, ["assessmentTitle", "assessmentName", "title", "name"], "Assessment"),
    durationSeconds, questions: [], isSample: false,
  };
}

function complete(question: MatchQuestion | undefined, choices: number[] | undefined): boolean {
  return !!question && question.images.length > 0 && question.images.every((_, i) =>
    Number.isInteger(choices?.[i]) && (choices?.[i] ?? -1) >= 0 &&
    (choices?.[i] ?? -1) < question.options.length) &&
    new Set(choices?.slice(0, question.images.length)).size === question.images.length;
}
function partial(question: MatchQuestion | undefined, choices: number[] | undefined): boolean {
  return !!question && question.images.some((_, i) => (choices?.[i] ?? -1) >= 0) && !complete(question, choices);
}
function fingerprint(draft: ViewerDraft): string {
  const data = draft.questions.map(q => `${q.id}|${q.text}|${q.images.map(i => i.image).join(";")}|${q.options.map(o => o.text).join(";")}`).join("||");
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
  return `${draft.questions.length}-${(hash >>> 0).toString(16)}`;
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

function PictureThumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? <span className="im-image-unavailable" title={alt}>Image not available</span> :
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}/>;
}

function PictureDropdowns({ question, selections, disabled, onChange }: {
  question: MatchQuestion; selections: number[]; disabled: boolean;
  onChange: (imageIndex: number, optionIndex: number) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openUp, setOpenUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpenIndex(null); setOpenUp(false); }, [question.id]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenIndex(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenIndex(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  // Floating menu: stay anchored to this field and never shift other rows.
  // Flip upward when it would otherwise extend beyond the viewport.
  const toggleRow = (rowIndex: number, button: HTMLButtonElement) => {
    if (openIndex === rowIndex) { setOpenIndex(null); return; }
    const bounds = button.getBoundingClientRect();
    const visibleOptions = question.options.filter(option => !/^choose[\s.…]*$/i.test(option.text.trim())).length;
    const approximateHeight = visibleOptions * (window.innerWidth <= 600 ? 40 : 40) + 18;
    const below = window.innerHeight - bounds.bottom - 12;
    const above = bounds.top - 12;
    setOpenUp(below < approximateHeight && above > below);
    setOpenIndex(rowIndex);
  };
  return <div className="im-match-section" ref={rootRef}>
    <div className="im-match-head"><strong>Image</strong><strong>Matching Word</strong></div>
    <div className="im-match-rows">
      {question.images.map((image, rowIndex) => {
        const selectedIndex = selections[rowIndex] ?? -1;
        const open = openIndex === rowIndex;
        return <div className={`im-match-row ${open ? "im-row-open" : ""}`} key={image.id + rowIndex}>
          <div className="im-image-tile">
            <span className="im-image-letter">{String.fromCharCode(65 + rowIndex)}.</span>
            <span className="im-image-thumbnail">
              <PictureThumbnail src={image.image} alt={image.alt}/>
            </span>
          </div>
          <div className="im-word-field">
            <button type="button" className={`im-select-trigger ${selectedIndex >= 0 ? "im-has-choice" : ""}`}
              disabled={disabled} aria-expanded={open} aria-haspopup="listbox"
              aria-controls={`im-options-${rowIndex}`} aria-label={`Matching word for image ${String.fromCharCode(65 + rowIndex)}`}
              onClick={event => toggleRow(rowIndex, event.currentTarget)}>
              <span>{selectedIndex >= 0 ? question.options[selectedIndex]?.text : "Choose...."}</span>
              <Icon name="arrow-down.svg" size={24}/>
            </button>
            {open && <div id={`im-options-${rowIndex}`} className={`im-dropdown ${openUp ? "im-open-up" : ""}`} role="listbox"
              aria-label={`Choose matching word for image ${String.fromCharCode(65 + rowIndex)}`}>
              <div className="im-dropdown-choices">
                {question.options.map((option, optionIndex) => {
                  // "Choose" is a placeholder, not a selectable answer.
                  if (/^choose[\s.…]*$/i.test(option.text.trim())) return null;
                  const selected = selectedIndex === optionIndex;
                  return <button key={option.id + optionIndex} type="button" role="option"
                    aria-selected={selected} className={`im-dropdown-option ${selected ? "is-selected" : ""}`}
                    onClick={() => { onChange(rowIndex, selected ? -1 : optionIndex); setOpenIndex(null); }}>
                    <span className="im-choice-radio" aria-hidden="true"><span className="im-choice-core">{selected && <span className="im-choice-tick"/>}</span></span>
                    <span>{option.text}</span>
                  </button>;
                })}
              </div>
            </div>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

export default function ImageMatchingViewerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ViewerDraft>({ title: "", durationSeconds: 1800, questions: [], isSample: false });
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [visited, setVisited] = useState<number[]>([]);
  const [flagged, setFlagged] = useState<number[]>([]);
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
  // Keep active attempts separate for every assessment AND every explicit Start.
  // Reusing only a question fingerprint previously caused unrelated matching
  // assessments to inherit a submitted/locked state.
  const assessmentId = getActiveAssessmentId() ?? "standalone";
  const runKey = `neurolxp.imageViewer.matching.run.${assessmentId}`;
  const runId = (() => { try { return sessionStorage.getItem(runKey) || "initial"; } catch { return "initial"; } })();
  const stateKey = `${SESSION_PREFIX}:${assessmentId}:${runId}:${draft.isSample ? "preview" : signature}${isImageViewerRetry() ? ":retry" : ""}`;

  useEffect(() => {
    const initial = loadDraft();
    const retry = applyImageViewerRetry(initial.questions,"image-matching",initial.durationSeconds);
    const loaded = { ...initial,...retry };
    const stamp = fingerprint(loaded);
    const id = getActiveAssessmentId() ?? "standalone";
    let run = "initial";
    try { run = sessionStorage.getItem(`neurolxp.imageViewer.matching.run.${id}`) || "initial"; } catch { /* Session storage optional. */ }
    const key = `${SESSION_PREFIX}:${id}:${run}:${loaded.isSample ? "preview" : stamp}${isImageViewerRetry() ? ":retry" : ""}`;
    const time = Date.now();
    let state: Partial<Attempt> = {};
    try { state = JSON.parse(sessionStorage.getItem(key) || "{}"); } catch { /* corrupted state */ }
    if (state.signature === stamp && state.expiresAt) {
      setCurrent(Math.min(Math.max(0, state.current ?? 0), Math.max(loaded.questions.length - 1, 0)));
      setAnswers(state.answers ?? {});
      setVisited(state.visited ?? []);
      setFlagged(state.flagged ?? []);
      setExpiresAt(state.expiresAt);
      setSubmitted(!!state.submitted);
    } else {
      setCurrent(0); setAnswers({}); setVisited([]); setFlagged([]);
      setExpiresAt(time + loaded.durationSeconds * 1000);
      setSubmitted(false);
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
    const state: Attempt = { signature, current, answers, visited, flagged, expiresAt, submitted };
    try { sessionStorage.setItem(stateKey, JSON.stringify(state)); } catch { /* storage optional */ }
  }, [ready, stateKey, signature, current, answers, visited, flagged, expiresAt, submitted]);

  const questions = draft.questions;
  const question = questions[current];
  const total = questions.length;
  const answered = questions.filter((q, i) => complete(q, answers[i])).length;
  const remaining = total - answered;
  const progress = total ? Math.round(answered / total * 100) : 0;
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;
  const score = useMemo(() => questions.reduce((sum, q, i) => {
    if (!complete(q, answers[i])) return sum;
    const correct = q.images.filter((_, j) => q.correct[j] >= 0 && answers[i]?.[j] === q.correct[j]).length;
    return sum + (q.points * correct / Math.max(1, q.images.length));
  }, 0), [questions, answers]);

  useEffect(() => {
    if (!ready || submitted || !expiresAt || secondsLeft > 0) return;
    submit(true);
  }, [ready, submitted, expiresAt, secondsLeft]);
  const updateMatch = useCallback((row: number, choice: number) => {
    if (submitted || secondsLeft <= 0 || !question) return;
    setAnswers(previous => {
      const next = question.images.map((_, i) => previous[current]?.[i] ?? -1);
      if (choice >= 0) next.forEach((value, i) => { if (i !== row && value === choice) next[i] = -1; });
      next[row] = choice;
      return { ...previous, [current]: next };
    });
    setNotice("");
  }, [submitted, secondsLeft, question, current]);
  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    // Same validation behavior as the supplied matching viewer: complete earlier questions before advancing.
    if (!submitted && index > current && questions.slice(0, index).some((q, i) => !complete(q, answers[i]))) {
      setNotice("Match all images to a different topic before moving to the next question.");
      return;
    }
    setVisited(old => old.includes(current) ? old : [...old, current]);
    setCurrent(index); setHintOpen(false); setNotice("");
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };
  const toggleFlag = () => {
    if (submitted) return;
    setFlagged(old => old.includes(current) ? old.filter(i => i !== current) : [...old, current]);
  };
  const submit = (auto = false) => {
    if (submitted) return;
    if (!auto) { setConfirmOpen(true); return; }
    const saved = saveImageViewerSubmission({title:draft.title,subtype:"image-matching",retry:isImageViewerRetry(),
      durationSeconds:draft.durationSeconds,secondsRemaining:secondsLeft,
      questions:questions.map((q,i)=>{
        const chosen = answers[i] ?? [];
        const fullyAnswered = complete(q,chosen);
        const hasAnswer = chosen.some(index=>index>=0);
        const count = q.images.filter((_,j)=>chosen[j] === q.correct[j]).length;
        const accurate = count === q.images.length && fullyAnswered;
        const expected = q.images.map((im,j)=>`${im.alt}: ${q.options[q.correct[j]]?.text ?? "—"}`).join("; ");
        const actual = q.images.map((im,j)=>`${im.alt}: ${q.options[chosen[j]]?.text ?? "—"}`).join("; ");
        return {id:q.id,text:q.text,options:[expected,actual],correct:0,selected:hasAnswer?(accurate?0:1):null,
          points:q.points,earnedMarks:q.points*count/Math.max(1,q.images.length),flagged:flagged.includes(i),hint:q.hint,bloom:q.bloom};
      })});
    if (!saved && !draft.isSample) { setNotice("Unable to save your result. Please try again."); setConfirmOpen(false); return; }
    // A later visit to this assessment is a fresh start, not a locked copy
    // of this completed attempt. Its saved Results record is not removed.
    if (!draft.isSample) {
      const id = getActiveAssessmentId();
      if (id) try { sessionStorage.setItem(`neurolxp.imageViewer.matching.finished.${id}`, "1"); }
      catch { /* Submission still succeeds if session storage is disabled. */ }
    }
    setSubmitted(true); setConfirmOpen(false); setSuccessOpen(true);setNotice("Assessment submitted.");
  };

  return <main className="superAdminPage institutionAdminPage viewerAppShell viewImageMatchApp">
    <div className="dashboardLayout viewerLayout">
      <Sidebar />
      <section className="mainContent viewerMain">
        <div className="viewerSharedHeader"><Header /></div>
        <div ref={scrollRef} className="institutionScrollArea viewerScroll">
          <div className="pageContent institutionPageContent viewerContent">
            <div className="viewerExamTop">
              <nav className="viewerBreadcrumb" aria-label="Breadcrumb">
                <Link href="/super_admin">Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
                <Link href="/Assessment">Assessment</Link><Icon name="arrow-right-double.svg" size={20} />
                <strong>{draft.title || "Assessment"}</strong>
              </nav>
              <Clock seconds={secondsLeft}/>
            </div>
            <div className="viewerPageHeading viewerExamHeading"><h1>{draft.title || "Assessment"}</h1></div>
            <div className="viewerExamGrid">
              <section className="viewerExamCard viewerQuestionCard" aria-label="Assessment question">
                <div className="viewerProgressArea">
                  <div className="viewerProgressLabel">
                    <strong>{ready && total ? current + 1 : "—"}<span>/{ready ? total : "—"}</span></strong>
                    <strong className="viewerMarks">{ready ? (question?.points ?? 0) : "—"} {question?.points === 1 ? "Mark" : "Marks"}</strong>
                  </div>
                  <div className="viewerProgressRow">
                    <div className="viewerProgressTrack"><span style={{ width: `${progress}%` }}/></div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
                {!ready ? <p className="viewerInlineNotice">Loading matching questions...</p> : question ? <>
                  <div className="viewerQuestionHeading"><h2>Question {current + 1}</h2><p>{question.text}</p></div>
                  <PictureDropdowns key={question.id} question={question}
                    selections={answers[current] ?? []} disabled={submitted || secondsLeft <= 0}
                    onChange={updateMatch}/>
                  {question.hint && question.allowHint && <section className="viewerHintBox">
                    <button type="button" className="viewerHintToggle" aria-expanded={hintOpen}
                      onClick={() => setHintOpen(value => !value)}>
                      <span className="viewerHintTitle">
                        <span className="viewerHintIcon"><Icon name="idea.svg" size={25}/></span>
                        <span>Hint{hintOpen && <small>{question.hint}</small>}</span>
                      </span>
                      <span className="viewerHintEye"><Icon name={hintOpen ? "eye-off.svg" : "view.svg"} size={20}/></span>
                    </button>
                  </section>}
                  <div className="viewerQuestionSettings">
                    <div><label>Bloom’s Taxonomy</label><span className="viewerBloomValue">{question.bloom || "Not specified"}</span></div>
                    <button type="button" className={`viewerFlagButton ${flagged.includes(current) ? "isFlagged" : ""}`}
                      disabled={submitted} onClick={toggleFlag}>
                      <Icon name="flag.svg" size={22}/>{flagged.includes(current) ? "Remove flag" : "Flag for review"}
                    </button>
                  </div>
                  {notice && <p className="viewerInlineNotice" role="status">{notice}</p>}
                  <div className="viewerExamActions">
                    {current > 0 && <button type="button" className="viewerExamButton" disabled={current === 0}
                      onClick={() => goTo(current - 1)}><Icon name="arrowleft.svg"/>Previous</button>}
                    <button type="button" className="viewerExamButton viewerNext"
                      disabled={submitted && current === total - 1}
                      onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                      {current === total - 1 ? (submitted ? "Submitted" : "Submit") : "Next"}
                      <Icon name="arrowrightg.svg"/>
                    </button>
                  </div>
                </> : <p className="viewerInlineNotice">No image-matching questions are saved for this assessment. Save the picture-matching questions in the creator first.</p>}
              </section>
              <aside className="viewerExamCard viewerNavigator">
                <h2>Question Navigator</h2>
                <div className="viewerQuestionTiles" aria-label="Choose question">
                  {questions.map((q, index) => {
                    const status = index === current ? "current" : complete(q, answers[index]) ? "answered"
                      : partial(q, answers[index]) || visited.includes(index) ? "progress" : "pending";
                    return <button type="button" key={q.id + index} className={`viewerQuestionTile is-${status}`}
                      aria-current={index === current ? "step" : undefined}
                      aria-label={`Question ${index + 1}${flagged.includes(index) ? ", flagged" : ""}`}
                      onClick={() => goTo(index)}>{index + 1}</button>;
                  })}
                </div>
                <div className="viewerStatusRows">
                  <div><Icon name="checkmark-circle.svg"/><span>Answered</span><strong>{String(answered).padStart(2, "0")}</strong></div>
                  <div><span className="viewerRemainingCircle"/><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                  <div><Icon name="flag.svg"/><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                </div>
                <h2 className="viewerToolsHeading">Tools</h2>
                <div className="viewerToolsList">
                  <button type="button" onClick={() => router.push(imageViewerToolPath("scratch"))}><Icon name="sticky-note.svg"/>Scratch Pad<Icon name="arrowupright.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(imageViewerToolPath("calculator"))}><Icon name="calculator.svg"/>Calculator<Icon name="arrowup.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(imageViewerToolPath("formulasheet"))}><Icon name="sigma.svg"/>Formula Sheet<Icon name="arrowupg.svg" size={18}/></button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
    <ImageViewerSubmitPopups title={draft.title} answered={answered} total={total} flagged={flagged.length}
      earnedMarks={score} totalMarks={questions.reduce((n,q)=>n+q.points,0)}
      confirmOpen={confirmOpen} submittedOpen={successOpen} isRetry={isImageViewerRetry()}
      onBack={()=>setConfirmOpen(false)} onSubmit={()=>submit(true)} onClose={()=>setSuccessOpen(false)}/>

  </main>;
}
