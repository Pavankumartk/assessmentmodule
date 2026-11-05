"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./image.css";
import { getImageViewerBridge, imageViewerToolPath } from "../../image-viewer-bridge";
import ImageViewerSubmitPopups from "../../ImageViewerSubmitPopups";
import { applyImageViewerRetry, imageViewerRelease, isImageViewerRetry, saveImageViewerSubmission } from "../../image-viewer-submission";
import { resultPath } from "@/modules/assessments/storage/assessment-storage";


const ICONS = "/assets/viewericons/";
const QUESTIONS_STORAGE = "assessment-viewer-questions";
const PROGRESS_STORAGE = "assessment-viewer-progress";

export type ViewerQuestion = {
  id: string;
  text: string;
  options: string[];
  correctIndex?: number;
  imageUrl?: string;
  imageAlt?: string;
  marks?: number;
  hint?: string;
  explanation?: string;
  bloom?: string;
};

type ViewerProps = {
  /** Pass questions directly from your existing assessment storage/registry when integrating. */
  questions?: ViewerQuestion[];
  assessmentId?: string;
  title?: string;
  durationSeconds?: number;
};

type Progress = {
  current: number;
  answers: Record<string, number>;
  visited: string[];
  flagged: string[];
  deadlineAt: number;
  submitted: boolean;
  signature?: string;
};

type RecordObject = Record<string, unknown>;
const asRecord = (value: unknown): RecordObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordObject : null;
const textOf = (value: unknown): string => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : typeof value === "number" ? String(value) : "";
// A question image is display data, not an icon: use the creator's own upload/path.
const safeImage = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const src = value.trim();
  if (!src || /\.(mp4|mov|webm|avi)(?:[?#]|$)/i.test(src)) return undefined;
  if (/^(https?:\/\/|blob:|\/|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,)/i.test(src)) return src;
  // Creator may save a public-relative image path rather than /path/to/image.png.
  if (/^(?:\.\/)?(?:assets|uploads|images|media)\/[\w%+@./-]+(?:[?#][^\s]*)?$/i.test(src)) return `/${src.replace(/^\.\//, "")}`;
  return undefined;
};
const imageFromHtml = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return safeImage(value.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]);
};
// Accept image paths, uploaded data URLs, editor HTML, and stored image objects/arrays.
function imageOf(value: unknown): string | undefined {
  const direct = safeImage(value) ?? imageFromHtml(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) { const image = imageOf(item); if (image) return image; }
    return undefined;
  }
  const object = asRecord(value);
  if (!object) return undefined;
  // Ignore an attachment explicitly identified as video.
  const mime = object.type ?? object.mimeType ?? object.mimetype;
  if (typeof mime === "string" && /^(video|audio)\//i.test(mime)) return undefined;
  for (const key of ["dataUrl", "dataURL", "url", "src", "path", "imageUrl", "imageSrc", "imageURL", "imageData", "questionImage", "questionImageUrl", "uploadedImage", "base64", "preview", "file", "files", "blocks", "items", "media", "image", "html", "content"]) {
    const next = imageOf(object[key]);
    if (next) return next;
  }
  return undefined;
}

/** Supports simple saved questions and common creator field names; no invented questions. */
function normalizeQuestions(raw: unknown): ViewerQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index): ViewerQuestion[] => {
    const q = asRecord(item);
    if (!q) return [];
    const optionItems = Array.isArray(q.options) ? q.options : Array.isArray(q.answers) ? q.answers : [];
    const options = optionItems.map((option) => {
      const detail = asRecord(option);
      return textOf(detail ? (detail.text ?? detail.label ?? detail.value ?? detail.content) : option);
    });
    const candidate = q.correctIndex ?? q.correct ?? q.correctOption ?? q.answerIndex ?? q.correctAnswer;
    let correctIndex: number | undefined;
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0 && candidate < options.length) correctIndex = candidate;
    else if (typeof candidate === "string") {
      const optionIndex = options.findIndex(option => option.trim().toLowerCase() === candidate.trim().toLowerCase());
      if (optionIndex >= 0) correctIndex = optionIndex;
      else if (/^[A-Z]$/i.test(candidate)) {
        const idx = candidate.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx < options.length) correctIndex = idx;
      }
    }
    const html = q.questionHtml ?? q.html ?? q.textHtml ?? q.contentHtml ?? q.richHtml
      ?? (typeof q.text === "string" && q.text.includes("<img") ? q.text : undefined);
    const questionObject = asRecord(q.question) ?? asRecord(q.questionContent);
    const plain = textOf(q.text ?? q.questionText ?? questionObject?.text ?? q.question ?? q.title ?? q.prompt ?? html);
    // Resolve the image from THIS question only. No static question number or global image.
    const image = imageOf(q.imageUrl) ?? imageOf(q.imageURL) ?? imageOf(q.imageSrc) ?? imageOf(q.src) ?? imageOf(q.questionImageUrl)
      ?? imageOf(q.questionImage) ?? imageOf(q.image) ?? imageOf(q.images)
      ?? imageOf(q.uploadedImage) ?? imageOf(q.imageData) ?? imageOf(q.attachments)
      ?? imageOf(q.media) ?? imageOf(q.questionImages) ?? imageOf(questionObject?.image)
      ?? imageOf(questionObject?.html) ?? imageOf(q.questionContent) ?? imageOf(q.questionMedia)
      ?? imageOf(q.mediaUrl) ?? imageOf(q.mediaUrls) ?? imageOf(q.questionPicture)
      ?? imageOf(q.mediaFiles) ?? imageOf(q.attachments)
      ?? imageOf(q.questionMediaFiles) ?? imageOf(q.uploads) ?? imageOf(q.editorImages)
      ?? imageOf(q.questionContent) ?? imageOf(q.questionBody)
      ?? imageFromHtml(html) ?? imageFromHtml(q.text) ?? imageFromHtml(q.questionText);
    return [{
      id: String(q.id ?? q.questionId ?? `question-${index + 1}`),
      text: plain || `Question ${index + 1}`,
      options,
      correctIndex,
      imageUrl: image,
      imageAlt: textOf(q.imageAlt ?? q.altText) || undefined,
      marks: Number(q.marks ?? q.points ?? 1) || 1,
      hint: textOf(q.hint ?? q.hintBefore),
      explanation: textOf(q.explanation ?? q.feedback),
      bloom: textOf(q.bloom ?? q.bloomsTaxonomy ?? q.bloomTaxonomy) || "Analyse",
    }];
  });
}

function readStoredAssessment(assessmentId: string): { questions: ViewerQuestion[]; title?: string; durationSeconds?: number } | null {
  // Support the common shared viewer key plus MCQ creator drafts in either storage.
  // Other assessment types are never imported into the MCQ viewer.
  const keys = [
    `${QUESTIONS_STORAGE}:${assessmentId}`, QUESTIONS_STORAGE,
    `mcqContentDraft:${assessmentId}`, "mcqContentDraft", "MCQContentDraft",
    "mcqQuestionDraft", "mcqAssessmentContentDraft", "mcqDraft",
  ];
  for (const key of keys) {
    for (const store of [window.localStorage, window.sessionStorage]) {
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed: unknown = JSON.parse(raw);
        const obj = asRecord(parsed);
        const nested = asRecord(obj?.assessment) ?? asRecord(obj?.content) ?? asRecord(obj?.draft);
        const list = Array.isArray(parsed) ? parsed : obj?.questions ?? nested?.questions;
        const questions = normalizeQuestions(list);
        if (!questions.length) continue;
        const richHtml = asRecord(obj?.richHtml ?? nested?.richHtml);
        questions.forEach((q, index) => {
          if (!q.imageUrl) q.imageUrl = imageOf(richHtml?.[`mcqc-question-${index}`])
            ?? imageOf(richHtml?.[`question-${index}`]);
        });
        const duration = Number(obj?.durationSeconds ?? nested?.durationSeconds);
        return {
          questions,
          title: textOf(obj?.title ?? obj?.assessmentTitle ?? nested?.title) || undefined,
          durationSeconds: duration > 0 ? duration : undefined,
        };
      } catch { /* Try the next compatible creator key. */ }
    }
  }
  return null;
}

/**
 * The image belongs to the current question. `key` on the component below ensures
 * the previous question's image/error cannot carry into another question.
 * In the creator, persist either a public URL or data:image/... base64 URL.
 */
function QuestionMedia({ src, alt }: { src: string; alt: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <figure className="mqv-diagram-box" aria-label="Question illustration">
    {imageFailed
      ? <p className="mqv-image-error" role="status">Question image could not be loaded. Check the saved image URL or uploaded image data.</p>
      : <img
          src={src}
          className="mqv-question-image"
          alt={alt}
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
        />}
  </figure>;
}

// One optional standalone preview; NEVER append it to a creator's questions.
// It only displays at /mcq-viewer without a saved creator assessment.
// The diagram is question CONTENT, not a UI icon.
const IMAGE_EXAMPLE: ViewerQuestion[] = [{
  id: "image-example-firewall",
  text: "What is the Firewall in this network used for?",
  options: ["Print Document", "Filter Unwanted Traffic", "Connected WI-FI Devices", "Store Company Files"],
  correctIndex: 1,
  imageUrl: "/assets/assessmenticons/network-firewall-diagram.png",
  imageAlt: "Office network: Internet, firewall, router, switch, server, laptop, PC and printer",
  marks: 1,
  hint: "Think about the component that controls incoming and outgoing traffic.",
  explanation: "A firewall filters traffic according to network security rules.",
  bloom: "Analyse",
}];

// UI icons are exclusively read from public/assets/viewericons/.
// Keep the original image filenames already used by your other learner viewers.
function AssetIcon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img className={`mqv-asset ${className}`} src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}

function Clock({ seconds }: { seconds: number }) {
  const safe = Math.max(0, seconds);
  const hh = String(Math.floor(safe / 3600)).padStart(2, "0");
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return <div className="mqv-clock" role="timer" aria-label={`Time remaining: ${hh} hours, ${mm} minutes, ${ss} seconds`}>
    {[hh, mm, ss].map((part, index) => <span className="mqv-clock-part" key={index}>{index > 0 && <b className="mqv-clock-sep">:</b>}{part.split("").map((digit, idx) => <span className="mqv-clock-digit" key={idx}>{digit}</span>)}</span>)}
  </div>;
}

export function AssessmentMCQViewer({ questions: suppliedQuestions, assessmentId: propId, title: propTitle, durationSeconds: propDuration }: ViewerProps) {
  const router = useRouter();
  const params = useParams<{ assessmentId: string }>();
  const assessmentId = propId ?? params?.assessmentId ?? "demo";
  const [questions, setQuestions] = useState<ViewerQuestion[]>([]);
  const [title, setTitle] = useState("Introduction to Artificial Intelligence");
  const [progress, setProgress] = useState<Progress>({ current: 0, answers: {}, visited: [], flagged: [], deadlineAt: 0, submitted: false });
  const [ready, setReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60 + 42);
  const [hintOpen, setHintOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const examDurationRef = useRef(1800);

  // Props or creator drafts win. A single reference image appears only on the standalone demo route.
  useEffect(() => {
    const savedImageBased = suppliedQuestions === undefined ? getImageViewerBridge("multiple-choice") : null;
    const stored = suppliedQuestions === undefined && !savedImageBased?.questions.length ? readStoredAssessment(assessmentId) : null;
    const normalized = suppliedQuestions !== undefined
      ? normalizeQuestions(suppliedQuestions)
      : savedImageBased?.questions.length ? normalizeQuestions(savedImageBased.questions) : stored?.questions ?? [];
    const previewOnly = assessmentId === "demo" && suppliedQuestions === undefined && !stored;
    const unfilteredQuestions = previewOnly ? IMAGE_EXAMPLE : normalized;
    const retry = applyImageViewerRetry(unfilteredQuestions, "multiple-choice", propDuration ?? 1800);
    const nextQuestions = retry.questions;
    const originalDuration = propDuration ?? (savedImageBased?.questions.length ? savedImageBased.durationSeconds : stored?.durationSeconds) ?? (30 * 60 + 42);
    const duration = isImageViewerRetry() ? retry.durationSeconds : originalDuration;
    examDurationRef.current = duration;
    const storageKey = `${PROGRESS_STORAGE}:${assessmentId}${isImageViewerRetry() ? ":retry" : ""}`;
    let previous: Partial<Progress> | null = null;
    try { previous = JSON.parse(window.localStorage.getItem(storageKey) || "null") as Partial<Progress> | null; }
    catch { /* Start without corrupted local progress. */ }

    // Old 20-question demos and previous assessments cannot leak their answer state.
    const signature = JSON.stringify(nextQuestions.map(q => [q.id, q.text, q.options, q.imageUrl]));
    if (previous?.signature !== signature) previous = null;
    // Do not automatically restart, select, or move questions on reload.
    // The Restart demo control below is explicit; real submissions stay locked.

    setIsDemoMode(previewOnly);
    const ids = new Set(nextQuestions.map(q => q.id));
    const answers = Object.fromEntries(
      Object.entries(previous?.answers ?? {}).filter(([id, value]) => ids.has(id) &&
        typeof value === "number" && Number.isInteger(value) &&
        value >= 0 && value < (nextQuestions.find(q => q.id === id)?.options.length ?? 0)),
    );
    const next: Progress = {
      current: nextQuestions.length
        ? Math.min(Math.max(0, previous?.current ?? 0), nextQuestions.length - 1) : 0,
      answers,
      visited: (previous?.visited ?? []).filter(id => ids.has(id)),
      flagged: (previous?.flagged ?? []).filter(id => ids.has(id)),
      deadlineAt: previous?.deadlineAt && previous.deadlineAt > 0
        ? previous.deadlineAt : Date.now() + duration * 1000,
      submitted: !!previous?.submitted,
      signature,
    };
    setQuestions(nextQuestions);
    setTitle(propTitle || (savedImageBased?.questions.length ? savedImageBased.title : stored?.title) || "Introduction to Artificial Intelligence");
    setProgress(next);
    setRemainingSeconds(Math.max(0, Math.ceil((next.deadlineAt - Date.now()) / 1000)));
    setHintOpen(false);
    setReady(true);
  }, [assessmentId, suppliedQuestions, propTitle, propDuration]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(`${PROGRESS_STORAGE}:${assessmentId}${isImageViewerRetry() ? ":retry" : ""}`, JSON.stringify(progress)); }
    catch { /* Storage may be unavailable (private browsing or quota). */ }
  }, [assessmentId, progress, ready]);

  useEffect(() => {
    if (!ready || progress.submitted) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((progress.deadlineAt - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, progress.deadlineAt, progress.submitted]);

  useEffect(() => {
    if (ready && questions.length > 0 && remainingSeconds === 0 && !progress.submitted) {
      submit();
    }
  }, [ready, remainingSeconds, progress.submitted, questions.length]);

  const current = questions[progress.current];
  const answered = useMemo(() => questions.filter(q => progress.answers[q.id] !== undefined).length, [questions, progress.answers]);
  const unanswered = questions.length - answered;
  const percent = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const currentAnswer = current ? progress.answers[current.id] : undefined;
  const isLocked = progress.submitted || remainingSeconds === 0;

  const navigate = useCallback((index: number) => {
    if (index < 0 || index >= questions.length) return;
    setProgress(prev => {
      if (prev.current === index) return prev;
      const oldId = questions[prev.current]?.id;
      return { ...prev, current: index, visited: oldId && !prev.visited.includes(oldId) ? [...prev.visited, oldId] : prev.visited };
    });
    setHintOpen(false);
    setMessage("");
    // Keep the newly selected question/image in view on small screens.
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [questions]);

  function choose(index: number) {
    if (!current || isLocked) return;
    setProgress(prev => {
      const nextAnswers = { ...prev.answers };
      if (nextAnswers[current.id] === index) delete nextAnswers[current.id];
      else nextAnswers[current.id] = index;
      return { ...prev, answers: nextAnswers, visited: prev.visited.includes(current.id) ? prev.visited : [...prev.visited, current.id] };
    });
    setMessage("");
  }

  function toggleFlag() {
    if (!current || isLocked) return;
    setProgress(prev => ({ ...prev, flagged: prev.flagged.includes(current.id) ? prev.flagged.filter(id => id !== current.id) : [...prev.flagged, current.id] }));
  }

  function submit() {
    if (progress.submitted) return;
    const saved = saveImageViewerSubmission({
      title, subtype: "multiple-choice", durationSeconds: examDurationRef.current,
      secondsRemaining: remainingSeconds, retry: isImageViewerRetry(),
      questions: questions.map(q => {
        const selected = progress.answers[q.id] ?? null;
        const points = Number(q.marks ?? 1);
        return { id:q.id, text:q.text, options:q.options, correct:q.correctIndex ?? -1,
          selected, points, earnedMarks:selected !== null && selected === q.correctIndex ? points : 0,
          flagged:progress.flagged.includes(q.id), hint:q.hint, bloom:q.bloom, explanation:q.explanation };
      }),
    });
    if (!saved && !isDemoMode) { setMessage("Unable to save your result. Please try again."); setConfirmSubmit(false); return; }
    setProgress(prev => ({ ...prev, submitted: true }));
    setConfirmSubmit(false); setSuccessOpen(true);
    setMessage("Assessment submitted.");
  }

  function restartDemo() {
    if (!isDemoMode) return;
    const deadlineAt = Date.now() + (propDuration && propDuration > 0 ? propDuration : 30 * 60 + 42) * 1000;
    const signature = JSON.stringify(questions.map(q => [q.id, q.text, q.options, q.imageUrl]));
    setProgress({ current: 0, answers: {}, visited: [], flagged: [], deadlineAt, submitted: false, signature });
    setRemainingSeconds(Math.max(1, Math.ceil((deadlineAt - Date.now()) / 1000)));
    setHintOpen(false);
    setConfirmSubmit(false);
    setMessage("");
  }

  if (!current) return <main className="superAdminPage institutionAdminPage viewerAppShell mqv-shell">
    <div className="dashboardLayout viewerLayout mqv-layout"><Sidebar />
      <section className="mainContent viewerMain mqv-page">
        <div className="viewerSharedHeader mqv-header"><Header /></div>
        <div className="institutionScrollArea viewerScroll mqv-scroll"><p className="mqv-empty">No image-based MCQ questions were saved for this assessment.</p></div>
      </section></div>
  </main>;

  return <main className="superAdminPage institutionAdminPage viewerAppShell mqv-shell">
    <div className="dashboardLayout viewerLayout mqv-layout">
      <Sidebar />
      <section className="mainContent viewerMain mqv-page">
        <div className="viewerSharedHeader mqv-header"><Header /></div>
        <div ref={scrollRef} className="institutionScrollArea viewerScroll mqv-scroll">
          <div className="pageContent institutionPageContent mqv-inner">
        <div className="mqv-heading-row">
          <div className="mqv-heading-left">
            <nav className="mqv-breadcrumb" aria-label="Breadcrumb">
              <Link href="/super_admin">Dashboard</Link><AssetIcon name="arrow-right-double.svg" size={18}/>
              <Link href="/Assessment">Assessment</Link><AssetIcon name="arrow-right-double.svg" size={18}/>
              <strong>{title}</strong>
            </nav>
            <h1>{title}</h1>
          </div>
          <Clock seconds={remainingSeconds}/>
        </div>

        <div className="mqv-content-grid">
          <article className="mqv-question-card" aria-label={`Question ${progress.current + 1}`}>
            <div className="mqv-question-meta"><strong>{progress.current + 1}/{questions.length}</strong><strong>{current.marks ?? 1} {Number(current.marks ?? 1) === 1 ? "Mark" : "Marks"}</strong></div>
            <div className="mqv-progress-row"><div className="mqv-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Questions answered"><div className="mqv-progress-fill" style={{ width: `${percent}%` }}/></div><strong>{percent}%</strong></div>
            <h2>Question {progress.current + 1}</h2>
            <p className="mqv-question-text">{current.text}</p>
            {current.imageUrl && <QuestionMedia
              key={`${current.id}:${current.imageUrl}`}
              src={current.imageUrl}
              alt={current.imageAlt || `Question ${progress.current + 1} image`}
            />}
            <div className="mqv-options" role="radiogroup" aria-label={`Answer choices for question ${progress.current + 1}. Click a selected answer again to clear it.`}>
              {current.options.length ? current.options.map((option, index) => {
                const selected = currentAnswer === index;
                return <button
                  key={`${current.id}-${index}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${String.fromCharCode(65 + index)}. ${option}`}
                  className={`mqv-option ${selected ? "mqv-option-selected" : ""}`}
                  disabled={!ready || isLocked}
                  onClick={() => choose(index)}
                >
                  {/* Selected: raised outer circle, blue centre and white tick, as in Figma. */}
                  <span className="mqv-option-radio" aria-hidden="true">
                    <span className="mqv-option-radio-dot">
                      {selected && <span className="mqv-option-white-check" />}
                    </span>
                  </span>
                  <span className="mqv-option-label">{String.fromCharCode(65 + index)}. {option}</span>
                </button>;
              }) : <p className="mqv-empty-options">No answer options have been configured for this question.</p>}
            </div>
            {/* Figma Hint card: actual SVGs from viewericons. */}
            <section className={`mqv-hint-panel ${hintOpen ? "is-hint-open" : ""}`} aria-label={`Hint for question ${progress.current + 1}`}>
              <div className="mqv-hint-name">
                <span className="mqv-hint-bulb" aria-hidden="true">
                  <img className="mqv-hint-bulb-icon" src="/assets/viewericons/idea.svg" width={26} height={26} alt="" aria-hidden="true" />
                </span>
                <strong>Hint</strong>
              </div>
              <button
                type="button"
                className="mqv-hint-toggle"
                onClick={() => setHintOpen(open => !open)}
                aria-expanded={hintOpen}
                aria-controls="mqv-current-hint"
                aria-label={hintOpen ? "Hide hint" : "Show hint"}
                title={hintOpen ? "Hide hint" : "Show hint"}
              >
                <img
                  className="mqv-hint-eye-icon"
                  src={hintOpen ? "/assets/viewericons/eye-off.svg" : "/assets/viewericons/view.svg"}
                  width={20}
                  height={20}
                  alt=""
                  aria-hidden="true"
                />

              </button>
              {hintOpen && (
                <p id="mqv-current-hint" className="mqv-hint-text">
                  {current.hint || "No hint has been added for this question."}
                </p>
              )}
            </section>
            {message && <p className="mqv-notice" role="status">{message}</p>}
            <div className="mqv-question-footer">
              <div className="mqv-bloom"><strong>Bloom’s Taxonomy</strong><span>{current.bloom || "Analyse"}</span></div>
              <button className={`mqv-flag-button ${progress.flagged.includes(current.id) ? "is-flagged" : ""}`} type="button" disabled={isLocked} aria-pressed={progress.flagged.includes(current.id)} onClick={toggleFlag}><AssetIcon name="flag.svg" size={20}/>{progress.flagged.includes(current.id) ? "Remove flag" : "Flag for review"}</button>
            </div>
            <div className="mqv-bottom-actions">
              {progress.current > 0 && <button type="button" className="mqv-pill mqv-previous" disabled={progress.current === 0} onClick={() => navigate(progress.current - 1)}><AssetIcon name="arrowleft.svg" size={20}/>Previous</button>}
              {progress.current === questions.length - 1 ? <button type="button" className="mqv-pill mqv-next" disabled={isLocked} onClick={() => setConfirmSubmit(true)}>Submit <AssetIcon name="arrowrightg.svg" size={20}/></button> : <button type="button" className="mqv-pill mqv-next" onClick={() => navigate(progress.current + 1)}>Next <AssetIcon name="arrowright.svg" size={20}/></button>}
            </div>
          </article>

          <aside className="mqv-navigator" aria-label="Assessment question navigator">
            <h2>Question Navigator</h2>
            <div className="mqv-number-grid">
              {questions.map((q, index) => {
                const active = progress.current === index;
                const completed = progress.answers[q.id] !== undefined;
                const inProgress = progress.visited.includes(q.id);
                return <button type="button" key={q.id} onClick={() => navigate(index)} aria-current={active ? "step" : undefined} aria-label={`Question ${index + 1}, ${active ? "current" : completed ? "completed" : inProgress ? "in progress" : "pending"}${progress.flagged.includes(q.id) ? ", flagged" : ""}`} className={`mqv-number ${active ? "is-current" : completed ? "is-complete" : inProgress ? "is-progress" : "is-pending"}`}>{index + 1}</button>;
              })}
            </div>
            <div className="mqv-status-list">
              <div className="mqv-status-row"><span className="mqv-status-left"><span className="mqv-status-dot mqv-status-answered"><AssetIcon name="checkmark-circle.svg" size={20}/></span>Answered</span><strong className="mqv-green">{String(answered).padStart(2,"0")}</strong></div>
              <div className="mqv-status-row"><span className="mqv-status-left"><span className="mqv-status-dot mqv-status-remain"/>Remaining</span><strong>{String(unanswered).padStart(2,"0")}</strong></div>
              <div className="mqv-status-row"><span className="mqv-status-left"><span className="mqv-flag-glyph"><AssetIcon name="flag.svg" size={20}/></span>Flagged</span><strong className="mqv-orange">{String(progress.flagged.length).padStart(2,"0")}</strong></div>
            </div>
            <h2 className="mqv-tools-heading">Tools</h2>
            <div className="mqv-tool-list">
              <button type="button" className="mqv-tool mqv-scratch" onClick={() => router.push(imageViewerToolPath("scratch"))}><AssetIcon name="sticky-note.svg" size={20}/>Scratch Pad<AssetIcon name="arrowupright.svg" size={19} className="mqv-external-arrow"/></button>
              <button type="button" className="mqv-tool mqv-calculator" onClick={() => router.push(imageViewerToolPath("calculator"))}><AssetIcon name="calculator.svg" size={20}/>Calculator<AssetIcon name="arrowup.svg" size={19} className="mqv-external-arrow"/></button>
              <button type="button" className="mqv-tool mqv-formula" onClick={() => router.push(imageViewerToolPath("formulasheet"))}><AssetIcon name="sigma.svg" size={20}/>Formula Sheet<AssetIcon name="arrowupg.svg" size={19} className="mqv-external-arrow"/></button>
            </div>
            {isLocked && <div className="mqv-completed-state" role="status">
              <p className="mqv-submit-status">{progress.submitted ? "Assessment submitted." : "Time has expired."}</p>
              {isDemoMode && <button type="button" className="mqv-restart-demo" onClick={restartDemo}>Restart demo to answer again</button>}
            </div>}
          </aside>
        </div>
          </div>
        </div>
      </section>
    </div>
    <ImageViewerSubmitPopups title={title} answered={answered} total={questions.length} flagged={progress.flagged.length}
      totalMarks={questions.reduce((n,q)=>n+Number(q.marks ?? 1),0)}
      earnedMarks={questions.reduce((n,q)=>n+(progress.answers[q.id] === q.correctIndex ? Number(q.marks ?? 1) : 0),0)}
      confirmOpen={confirmSubmit} submittedOpen={successOpen} isRetry={isImageViewerRetry()}
      onBack={()=>setConfirmSubmit(false)} onSubmit={submit} onClose={()=>setSuccessOpen(false)}/>
  </main>;
}

/** Standalone route. The exported component above can also be used inside the existing viewer registry. */
export default function MCQViewerPage() { return <AssessmentMCQViewer/>; }
