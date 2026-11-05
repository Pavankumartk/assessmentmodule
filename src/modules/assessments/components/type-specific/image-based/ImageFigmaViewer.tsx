"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import {
  assessmentStorage, getActiveAssessmentId, getAssessment, resultPath,
  updateAssessment, viewerPath,
} from "@/modules/assessments/storage/assessment-storage";
import { getDemoSession } from "@/modules/assessments/auth/demo-auth";
import {
  IMAGE_ANSWERS_KEY, IMAGE_RESULT_KEY, imageCorrectIndices, imageGrade,
  imageQuestionValid, readImageDraft, type ImageQuestion, type ImageResult,
} from "./image-based-data";
import "./image-figma-viewer.css";
import "./image-dropdown-viewer.css";
import "./image-viewer-scroll-fix.css";
import ImageViewerSubmitPopups from "./ImageViewerSubmitPopups";
import { applyImageViewerRetry, isImageViewerRetry, saveImageViewerSubmission } from "./image-viewer-submission";

const ASSETS = "/assets/assessmenticons/";
type SavedAnswers = Record<string, number[]>;
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const icon = (name: string, size = 20) => (
  // Figma assets live in the project's pre-existing assessmenticons directory.
  <img src={`${ASSETS}${name}.svg`} alt="" aria-hidden="true" width={size} height={size} />
);
const stripped = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
const hasResponse = (q: ImageQuestion, values?: number[]) => {
  if (!values) return false;
  if (q.subtype === "image-dropdown") return (q.dropdownSpots || []).every((_, i) => values[i] !== undefined && values[i] >= 0);
  if (q.subtype === "image-matching") return (q.matchPairs || []).every((_, i) => values[i] !== undefined && values[i] >= 0);
  if (q.subtype === "image-labeling") return (q.labelPins || []).every((_, i) => values[i] !== undefined && values[i] >= 0);
  return values.length > 0;
};
const itemsFor = (q: ImageQuestion): string[] => {
  if (q.subtype === "image-matching") return [...(q.matchPairs || []).map(p => p.text), ...(q.matchExtras || [])].filter(Boolean);
  if (q.subtype === "image-labeling") return [...(q.labelPins || []).map(p => p.label), ...(q.labelExtras || [])].filter(Boolean);
  return [];
};
function shuffledItems(q: ImageQuestion): string[] {
  const labels = itemsFor(q);
  const shouldShuffle = q.subtype === "image-matching" ? q.shuffleTexts !== false : q.shuffleLabels !== false;
  if (!shouldShuffle) return labels;
  // Deterministic order: re-rendering never changes the learner's dropdown choices.
  let hash = 0;
  for (const c of q.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return labels.map((label, i) => ({ label, index: i, rank: (hash ^ ((i + 1) * 2654435761)) >>> 0 }))
    .sort((a, b) => a.rank - b.rank).map(item => item.label);
}
function gradeQuestion(q: ImageQuestion, response: number[], labels: string[]): number {
  if (q.subtype === "image-dropdown") {
    const spots = q.dropdownSpots || [];
    if (!spots.length) return 0;
    const correct = spots.filter((spot, i) => Number.isInteger(response[i]) && spot.choices[response[i]]?.correct).length;
    if (correct === spots.length) return q.points;
    if (q.gradingMethod?.startsWith("Partial credit")) return q.points * correct / spots.length;
    return 0;
  }
  if (q.subtype === "image-matching" || q.subtype === "image-labeling") {
    const correctLabels = q.subtype === "image-matching"
      ? (q.matchPairs || []).map(p => p.text)
      : (q.labelPins || []).map(p => p.label);
    if (!correctLabels.length) return 0;
    const correct = correctLabels.reduce((count, label, i) => count + (labels[response[i]] === label ? 1 : 0), 0);
    if (correct === correctLabels.length) return q.points;
    if (q.gradingMethod?.startsWith("Partial credit")) return Math.max(0, q.points * correct / correctLabels.length);
    return 0;
  }
  return imageGrade(q, response);
}

function AnswerMenu({ id, placeholder, choices, selected, open, setOpen, onSelect }: {
  id: string; placeholder: string; choices: string[]; selected: number | undefined;
  open: boolean; setOpen: (id: string | null) => void; onSelect: (index: number) => void;
}) {
  return (
    <div className={`ifv-answer-menu ${open ? "is-open" : ""}`}>
      <button type="button" className="ifv-answer-trigger" aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen(open ? null : id)}>
        <span className={selected === undefined ? "ifv-placeholder" : ""}>{selected === undefined ? placeholder : choices[selected] || placeholder}</span>
        {icon("arrow-down-01", 24)}
      </button>
      {open && <div className="ifv-answer-popover" role="listbox" aria-label={placeholder}>
        {choices.map((choice, i) => <button role="option" aria-selected={selected === i} type="button"
          className={selected === i ? "is-selected" : ""} key={`${choice}-${i}`}
          onClick={() => { onSelect(i); setOpen(null); }}>{choice}</button>)}
      </div>}
    </div>
  );
}

function ImageInside({ source, alt, className = "" }: { source?: string; alt: string; className?: string }) {
  return source ? <img className={className} src={source} alt={alt} />
    : <span className="ifv-empty-image">{icon("image", 28)}</span>;
}

export default function ImageFigmaViewer({ mode = "image-labeling" }: { mode?: "image-labeling" | "image-dropdown" }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<ImageQuestion[]>([]);
  const [answers, setAnswers] = useState<SavedAnswers>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedScore, setSubmittedScore] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const [hintOpen, setHintOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(3600);
  const [expiresAt, setExpiresAt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = readImageDraft().questions.filter(q => q.subtype === mode && imageQuestionValid(q));
    const filtered = applyImageViewerRetry(qs, mode, 3600);
    setQuestions(filtered.questions);
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    setPreview(isPreview);
    if (!isPreview) {
      try {
        const stored = JSON.parse(assessmentStorage.getItem(isImageViewerRetry() ? "imageBasedViewerAnswersRetry" : IMAGE_ANSWERS_KEY) || "{}") as {
          answers?: Record<string, number | number[]>; flagged?: string[]; current?: number; visited?: string[]; expiresAt?: number;
        };
        const normalized: SavedAnswers = {};
        for (const [key, raw] of Object.entries(stored.answers || {})) {
          normalized[key] = Array.isArray(raw) ? raw.filter(n => typeof n === "number") : typeof raw === "number" ? [raw] : [];
        }
        if (typeof stored.expiresAt === "number" && stored.expiresAt > 0) setExpiresAt(stored.expiresAt);
        setAnswers(normalized);
        setFlagged(Array.isArray(stored.flagged) ? stored.flagged : []);
        setVisited(Array.isArray(stored.visited) ? stored.visited : []);
        setCurrent(Math.min(Math.max(0, Number(stored.current) || 0), Math.max(0, qs.length - 1)));
      } catch { /* no previous attempt */ }
    }
    try {
      const details = JSON.parse(assessmentStorage.getItem("mcqAssessmentDraft") || "{}");
      const d = String(details.duration || details.timeLimit || "60");
      const number = parseFloat(d) || 60;
      const baseSeconds = Math.max(60, Math.round((/hour/i.test(d) ? number * 60 : number) * 60));
      setSeconds(applyImageViewerRetry(qs, mode, baseSeconds).durationSeconds);
    } catch { /* default 60 minutes */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || preview || submitted || !expiresAt) return;
    try { assessmentStorage.setItem(isImageViewerRetry() ? "imageBasedViewerAnswersRetry" : IMAGE_ANSWERS_KEY, JSON.stringify({ answers, flagged, current, visited, expiresAt })); }
    catch { /* ignore when storage unavailable */ }
  }, [ready, preview, submitted, answers, flagged, current, visited, expiresAt]);

  useEffect(() => {
    if (!ready || preview || !questions.length) return;
    if (!expiresAt) {setExpiresAt(Date.now()+seconds*1000);return;}
    const tick=()=>setSeconds(Math.max(0,Math.ceil((expiresAt-Date.now())/1000)));tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [ready, preview, questions.length, expiresAt]);

  const question = questions[current];
  const choicesByQuestion = useMemo(() => Object.fromEntries(questions.map(q => [q.id, shuffledItems(q)])), [questions]);
  const choiceLabels = question ? choicesByQuestion[question.id] || [] : [];
  const currentAnswer = question ? answers[question.id] || [] : [];
  const answered = questions.filter(q => hasResponse(q, answers[q.id])).length;
  const remaining = questions.length - answered;
  const progress = questions.length ? Math.round(100 * answered / questions.length) : 0;
  const isChecked = !!question && checked.includes(question.id);
  const correctOnCheck = !!question && hasResponse(question, currentAnswer) && gradeQuestion(question, currentAnswer, choiceLabels) === question.points;
  const timer = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const moveTo = (next: number) => {
    if (question) setVisited(prev => prev.includes(question.id) ? prev : [...prev, question.id]);
    setCurrent(Math.max(0, Math.min(questions.length - 1, next)));
    setHintOpen(false); setMenuOpen(null); setError("");
  };
  const setAnswer = (index: number, choice: number) => {
    if (!question) return;
    setAnswers(prev => {
      const now = [...(prev[question.id] || [])];
      now[index] = choice;
      return { ...prev, [question.id]: now };
    });
    setChecked(prev => prev.filter(id => id !== question.id));
  };
  const submit = () => {
    const id = getActiveAssessmentId();
    const record = id ? getAssessment(id) : null;
    const session = getDemoSession();
    if (!id || !record || session?.role !== "learner") {
      setError("Please sign in as a learner to submit."); return;
    }
    const totalMarks = questions.reduce((total, q) => total + q.points, 0);
    const score = questions.reduce((total, q) => total + gradeQuestion(q, answers[q.id] || [], choicesByQuestion[q.id] || []), 0);
    const resultSaved = saveImageViewerSubmission({
      title: record.title || "Image-Based Assessment", subtype: mode, durationSeconds: 3600,
      secondsRemaining: seconds, retry: isImageViewerRetry(),
      questions: questions.map(q => {
        const complete = hasResponse(q, answers[q.id]);
        const earned = gradeQuestion(q, answers[q.id] || [], choicesByQuestion[q.id] || []);
        const correct = complete && earned === q.points;
        const rightLabels = q.subtype === "image-dropdown"
          ? (q.dropdownSpots || []).map(spot => spot.choices.find(choice => choice.correct)?.text || "").join("; ")
          : (q.labelPins || []).map(pin => pin.label).join("; ");
        const candidateLabels = choicesByQuestion[q.id] || [];
        const chosenLabels = q.subtype === "image-dropdown"
          ? (q.dropdownSpots || []).map((spot, index) => spot.choices[(answers[q.id] || [])[index]]?.text || "Unanswered").join("; ")
          : (answers[q.id] || []).map(index => candidateLabels[index] || "Unanswered").join("; ");
        return { id: q.id, text: stripped(q.text), options: [rightLabels || "Correct labels", chosenLabels || "Unanswered"],
          correct: 0, selected: !complete ? null : correct ? 0 : 1,
          points: q.points, earnedMarks: earned, hint: q.hint, explanation: q.explanation,
          bloom: q.bloom, flagged: flagged.includes(q.id),
        };
      }),
    });
    if (!resultSaved) { setError("Unable to save your result. Please allow browser storage and try again."); return; }
    // Keep the original image-specific summary for existing consumers, without
    // modifying the canonical Result / Retry score or adding another attempt.
    if (!isImageViewerRetry()) {
      const legacy: ImageResult = { assessmentId: id, answers,
        score: Number(score.toFixed(2)), maxScore: totalMarks,
        correctCount: questions.filter(q => hasResponse(q, answers[q.id]) && gradeQuestion(q, answers[q.id], choicesByQuestion[q.id] || []) === q.points).length,
        questionCount: questions.length, submittedAt: new Date().toISOString() };
      try { assessmentStorage.setItem(IMAGE_RESULT_KEY, JSON.stringify(legacy)); } catch { /* canonical saved */ }
    }
    assessmentStorage.removeItem(isImageViewerRetry() ? "imageBasedViewerAnswersRetry" : IMAGE_ANSWERS_KEY);
    setSubmittedScore(score);
    setSubmitted(true);
    setConfirm(false);
    setSuccessOpen(true);
  };

  // Use the same submitted popup when the learner runs out of time.
  useEffect(() => {
    if (ready && !preview && !submitted && seconds === 0 && questions.length) submit();
  }, [ready, preview, submitted, seconds, questions.length]);

  if (!ready) return null;
  if (!question) return <main className="ifv-empty"><h1>No saved image-based questions</h1><p>Please complete the questions in the creator first.</p><button onClick={() => router.back()}>Back</button></main>;

  return <div className={`ifv-app viewerAppShell ${mode === "image-dropdown" ? "ifv-dropdown-viewer" : ""}`}>
    <Sidebar />
    <div className="ifv-workspace">
      <Header />
      <main className="ifv-main">
        <div className="ifv-breadcrumb"><span>Assessment</span>{icon("arrow-right-double", 18)}<span>{preview ? "Learner Preview" : "Start Assessment"}</span>{icon("arrow-right-double", 18)}<b>Questions</b></div>
        <div className="ifv-heading"><h1>{getAssessment(getActiveAssessmentId() || "")?.title || "Image-Based Assessment"}</h1><div className="ifv-timer" aria-label={`Time remaining ${timer}`}>{timer.split(":").map((group, i) => <span key={i} className="ifv-clock-group">{[...group].map((digit, k) => <span className="ifv-clock-digit" key={k}>{digit}</span>)}{i < 2 && <b>:</b>}</span>)}</div></div>
        <div className="ifv-progress-row"><strong>{current + 1}/{questions.length}</strong><div className="ifv-progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
        <div className="ifv-layout">
          <section className="ifv-question-panel" aria-label={`Question ${current + 1}`}>
            <div className="ifv-question-top"><div><h2>Question {current + 1}</h2><p>{stripped(question.text)}</p></div><b>{question.points} {question.points === 1 ? "Mark" : "Marks"}</b></div>

            {question.subtype === "image-dropdown" ? <div className="ifv-dropdown-content">
              <div className="ifv-main-image">
                <div className="ifv-image-canvas ifv-dropdown-stage">
                  <ImageInside source={question.image} alt="Diagram to complete with dropdown choices" className="ifv-diagram" />
                  {(question.dropdownSpots || []).map((spot, i) => (
                    <div className={`ifv-dropdown-spot ${spot.y > 65 ? "opens-up" : ""}`}
                      style={{ "--ifv-spot-x": `${Math.max(0, Math.min(100, spot.x))}%`, "--ifv-spot-y": `${Math.max(0, Math.min(100, spot.y))}%` } as React.CSSProperties}
                      key={spot.id}>
                      <AnswerMenu
                        id={`${question.id}-spot-${spot.id}`}
                        placeholder="Choose..."
                        choices={spot.choices.map(choice => choice.text)}
                        selected={currentAnswer[i]}
                        open={menuOpen === `${question.id}-spot-${spot.id}`}
                        setOpen={setMenuOpen}
                        onSelect={choice => setAnswer(i, choice)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="ifv-dropdown-shuffle">Shuffle the choices <span>{question.shuffleDropdowns === false ? "OFF" : "ON"}</span></div>
            </div> : question.subtype === "image-matching" ? <div className="ifv-matching-content">
              <div className="ifv-matching-titles"><span>Image</span><span>Matching Word</span></div>
              {(question.matchPairs || []).map((pair, i) => <div className="ifv-matching-row" key={`${question.id}-match-${i}`}>
                <div className="ifv-matching-image"><span>{letters[i]}.</span><div><ImageInside source={pair.image} alt={`Image ${letters[i]}`} /></div></div>
                <AnswerMenu id={`${question.id}-match-${i}`} placeholder="Choose...." choices={choiceLabels} selected={currentAnswer[i]} open={menuOpen === `${question.id}-match-${i}`} setOpen={setMenuOpen} onSelect={choice => setAnswer(i, choice)} />
              </div>)}
            </div> : question.subtype === "image-labeling" ? <div className="ifv-labeling-content">
              <div className="ifv-main-image"><div className="ifv-image-canvas"><ImageInside source={question.image} alt="Image to label" className="ifv-diagram" />{(question.labelPins || []).map((pin, i) => <span key={pin.id} className="ifv-image-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}><span>{i + 1}</span></span>)}</div></div>
              <div className="ifv-labeling-answers">{(question.labelPins || []).map((pin, i) => <div className="ifv-labeling-row" key={pin.id}><span className="ifv-label-no">{i + 1}</span><AnswerMenu id={`${question.id}-label-${i}`} placeholder="Choose Label" choices={choiceLabels} selected={currentAnswer[i]} open={menuOpen === `${question.id}-label-${i}`} setOpen={setMenuOpen} onSelect={choice => setAnswer(i, choice)} /></div>)}</div>
            </div> : <div className="ifv-mcq-content">
              <div className="ifv-main-image"><div className="ifv-image-canvas"><ImageInside source={question.image || question.galleryImages?.[0]} alt="Image for this question" className="ifv-diagram" /></div></div>
              <div className="ifv-mcq-options">{question.options.map((option, i) => {
                if (!option.text?.trim() && !option.image) return null;
                const selected = currentAnswer.includes(i);
                return <button type="button" className={`ifv-mcq-option ${selected ? "is-selected" : ""}`} key={i} aria-pressed={selected}
                  onClick={() => {
                    if (question.allowMultiple) {
                      const next = selected ? currentAnswer.filter(n => n !== i) : [...currentAnswer, i];
                      setAnswers(prev => ({ ...prev, [question.id]: next }));
                      setChecked(prev => prev.filter(id => id !== question.id));
                    } else setAnswer(0, i);
                  }}>
                  <span className="ifv-radio">{selected && icon("checkmark-circle-02", 17)}</span>
                  <span>{letters[i]}. {option.text}</span>{option.image && <ImageInside source={option.image} alt={`Answer choice ${letters[i]}`} className="ifv-option-image" />}
                </button>;
              })}</div>
            </div>}

            <div className="ifv-question-meta"><div className="ifv-hint"><div className="ifv-meta-title"><span className="ifv-meta-bubble">{icon("idea-01", 16)}</span><strong>Hint</strong></div>{question.hint ? <button type="button" className="ifv-hint-button" onClick={() => setHintOpen(v => !v)}>{hintOpen ? "Hide" : "Show"}</button> : <span>Not available</span>}{hintOpen && question.hint && <p className="ifv-hint-text">{stripped(question.hint)}</p>}</div><div className="ifv-bloom"><span>Bloom’s Taxonomy</span><b>{question.bloom || "Analyse"}</b></div></div>
            <button className="ifv-flag-button" type="button" onClick={() => setFlagged(prev => prev.includes(question.id) ? prev.filter(id => id !== question.id) : [...prev, question.id])}>{icon("flag", 20)} {flagged.includes(question.id) ? "Remove Flag" : "Flag for review"}</button>
            {isChecked && <div className={`ifv-check-feedback ${correctOnCheck ? "is-correct" : "is-incorrect"}`} role="status">{correctOnCheck ? "Correct answer" : !hasResponse(question, currentAnswer) ? "Please answer the question first." : "Answer checked. You can change your selection."}</div>}
            <div className="ifv-actions">{current > 0 && <button type="button" disabled={current === 0} onClick={() => moveTo(current - 1)}>{icon("arrowleft", 22)}Previous</button>}<button type="button" onClick={() => setChecked(prev => prev.includes(question.id) ? prev : [...prev, question.id])}>Check Answer</button><button type="button" onClick={() => current < questions.length - 1 ? moveTo(current + 1) : setConfirm(true)}>{current === questions.length - 1 ? "Submit" : "Next"}{icon("arrowright", 22)}</button></div>
          </section>
          <aside className="ifv-side-panel" aria-label="Question navigator and tools">
            <h2>Question Navigator</h2>
            <div className="ifv-number-grid">{questions.map((q, i) => {
              const complete = hasResponse(q, answers[q.id]);
              const active = i === current;
              const inProgress = !complete && visited.includes(q.id);
              return <button type="button" key={q.id} onClick={() => moveTo(i)} aria-label={`Go to question ${i + 1}`} aria-current={active ? "step" : undefined} className={`${active ? "is-current " : ""}${complete ? "is-completed " : ""}${inProgress ? "is-in-progress " : ""}${flagged.includes(q.id) ? "is-flagged" : ""}`}>{i + 1}{flagged.includes(q.id) && <span className="ifv-number-flag"/>}</button>;
            })}</div>
            <div className="ifv-nav-status"><div>{icon("checkmark-circle-02", 20)}<span>Answered</span><b>{answered}</b></div><div><span className="ifv-remaining-dot"/><span>Remaining</span><b>{remaining}</b></div><div>{icon("flag", 19)}<span>Flagged</span><b>{flagged.length}</b></div></div>
            <div className="ifv-tools"><h3>Tools</h3>{[{ label: "Scratch pad", icon: "sticky-note", route: "scratch" }, { label: "Calculator", icon: "calculator", route: "calculator" }, { label: "Formula sheet", icon: "sigma", route: "formulasheet" }].map(tool => <button type="button" key={tool.route} onClick={() => router.push(`${viewerPath()}/${tool.route}`)}><span className="ifv-tool-icon">{icon(tool.icon, 24)}</span>{tool.label}{icon("arrowupright", 20)}</button>)}</div>
            <button type="button" className="ifv-submit" onClick={() => setConfirm(true)}>{preview ? "Finish Preview" : "Submit Assessment"}</button>
          </aside>
        </div>
        {error && <p role="alert" className="ifv-error">{error}</p>}
      </main>
    </div>
    {preview && confirm && <div className="ifv-dialog-overlay"><section role="dialog" aria-modal="true" aria-label="Finish preview" className="ifv-dialog"><h2>Finish Preview?</h2><div><button type="button" onClick={() => setConfirm(false)}>Go Back</button><button type="button" onClick={() => router.push("/assessments")}>Finish Preview</button></div></section></div>}
    {!preview && <ImageViewerSubmitPopups title={getAssessment(getActiveAssessmentId() || "")?.title || "Image-Based Assessment"}
      answered={answered} total={questions.length} flagged={flagged.length}
      totalMarks={questions.reduce((sum, q) => sum + q.points, 0)} earnedMarks={submittedScore}
      confirmOpen={confirm && !submitted} submittedOpen={successOpen} isRetry={isImageViewerRetry()}
      onBack={() => setConfirm(false)} onSubmit={submit} onClose={() => setSuccessOpen(false)} />}

  </div>;
}
