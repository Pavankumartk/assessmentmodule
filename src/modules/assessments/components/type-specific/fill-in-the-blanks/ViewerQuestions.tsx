"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./viewfilblanks.css";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";
import {getTextResultRelease} from "@/modules/assessments/components/viewer/result-release";
import ViewerDialogs from "./ViewerDialogs";
import { assessmentStorage, updateAssessment, resultPath, viewerPath } from "@/modules/assessments/storage/assessment-storage";

// Use the same icon folder and filenames as the supplied viewer.
const ICONS = "/assets/viewericons/";
const CONTENT_KEYS = ["fillBlanksContentDraft"];
const DETAILS_KEYS = ["fillBlanksAssessmentDraft"];
const VIEWER_SESSION_KEY = "fillBlanksViewerState";
const BLANK_PATTERN = /_{3,}|\[\[blank\]\]|\{\{blank\}\}/gi;

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}

type OptionDetail = {
  hint?: string;
  showHint?: boolean;
  allowHint?: boolean;
};

type FillQuestion = {
  type: string;
  text: string;
  options: string[];
  correct: number;
  blankCorrect: number[];
  bloom: string;
  hint: string;
  allowHint: boolean;
  points: number;
};

type ViewerDraft = {
  title: string;
  questions: FillQuestion[];
  durationSeconds: number;
};

type ViewerState = {
  signature: string;
  current: number;
  answers: Record<number, number[]>;
  flagged: number[];
  skipped: number[];
  expiresAt: number;
  submitted: boolean;
};

const EMPTY_VIEWER: ViewerDraft = {
  title: "Fill in the Blanks",
  durationSeconds: 60 * 60,
  questions: [],
};

function readJson(keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    try {
      const raw = assessmentStorage.getItem(key) || assessmentStorage.getItem(key);
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch { /* Try the next saved-draft key. */ }
  }
  return {};
}

function firstText(data: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function durationToSeconds(draft: Record<string, unknown>): number {
  const raw = draft.duration ?? draft.timeLimit ?? draft.totalTime ?? draft.time;
  const count = Number.parseFloat(String(raw ?? "60"));
  const minutes = Number.isFinite(count) && count > 0 ? count * (/hour/i.test(String(raw)) ? 60 : 1) : 60;
  return Math.round(minutes * 60);
}

function loadViewerDraft(retryIndexes: number[] | null = null): ViewerDraft {
  const content = readJson(CONTENT_KEYS);
  const details = readJson(DETAILS_KEYS);
  if (!Array.isArray(content.questions) || !content.questions.length) return {...EMPTY_VIEWER, questions:[]};

  const savedDetails = content.optionDetails && typeof content.optionDetails === "object" && !Array.isArray(content.optionDetails)
    ? content.optionDetails as Record<string, OptionDetail> : {};
  const questions = content.questions.flatMap((entry, originalIndex): FillQuestion[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const q = entry as Record<string, unknown>;
    const text = String(q.text ?? "").trim();
    const options = Array.isArray(q.options) ? q.options.map(value => String(value ?? "")) : [];
    if (!text || options.filter(value => value.trim()).length < 2) return [];

    const correct = typeof q.correct === "number" && Number.isInteger(q.correct) ? q.correct : -1;
    const blankCount = Math.max(1, (text.match(BLANK_PATTERN) ?? []).length);
    const savedSelections = Array.isArray(q.blankCorrect) ? q.blankCorrect : [];
    const blankCorrect = Array.from({ length: blankCount }, (_, i) => {
      const index = Number(savedSelections[i] ?? (i === 0 ? correct : -1));
      return Number.isInteger(index) && index >= 0 && index < options.length ? index : -1;
    });
    const relevantDetails = Object.entries(savedDetails)
      .filter(([key]) => key.startsWith(`${originalIndex}-`))
      .map(([, value]) => value);
    const hintDetails = blankCorrect.map(i => savedDetails[`${originalIndex}-${i}`]).filter(Boolean);
    const hintSource = [...hintDetails, ...relevantDetails].find(value => typeof value?.hint === "string" && value.hint.trim());
    const points = Number(q.points);
    return [{
      type: String(q.type ?? "Fill in the Blanks"), text, options,
      correct, blankCorrect,
      bloom: String(q.bloom ?? ""),
      hint: String(hintSource?.hint ?? ""),
      allowHint: hintSource ? hintSource.allowHint !== false : false,
      points: Number.isFinite(points) && points > 0 ? points : 1,
    }];
  });
  return {
    title: firstText(details, ["assessmentTitle", "assessmentName", "title", "name"], EMPTY_VIEWER.title),
    questions: retryIndexes ? questions.filter((_,index)=>retryIndexes.includes(index)) : questions,
    durationSeconds: durationToSeconds(details),
  };
}

function formatTime(seconds: number): [string, string, string] {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
    .map(number => String(number).padStart(2, "0")) as [string, string, string];
}

function Stopwatch({ seconds }: { seconds: number }) {
  const parts = formatTime(seconds);
  return <div className="fillViewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, i) => <span className="fillViewerTimeGroup" key={i}>
      {i > 0 && <span className="fillViewerTimeColon">:</span>}
      {part.split("").map((digit, j) => <span className="fillViewerTimeDigit" key={j}>{digit}</span>)}
    </span>)}
  </div>;
}

function allBlanksAnswered(question: FillQuestion | undefined, selections: number[] | undefined) {
  return !!question && question.blankCorrect.length > 0 &&
    question.blankCorrect.every((_, i) => Number.isInteger(selections?.[i]) && (selections?.[i] ?? -1) >= 0);
}

export default function ViewFillBlanksPage() {
  const router = useRouter();
  const previewMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "true";
  const retryMode=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("retry")==="wrong";
  const fillViewerStateKey = previewMode ? "fillBlanksPreviewViewerState" : retryMode ? "fillBlanksRetryViewerState" : VIEWER_SESSION_KEY;
  const [draft, setDraft] = useState<ViewerDraft>({...EMPTY_VIEWER, questions:[]});
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hintOpen, setHintOpen] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitOpen,setSubmitOpen]=useState(false);
  const [successOpen,setSuccessOpen]=useState(false);
  const [release,setRelease]=useState<ReturnType<typeof getTextResultRelease>>({mode:"immediate",releaseDateLabel:"",showScore:true,showPassFail:true,showCorrectAnswers:true,showExplanation:true,message:"Your assessment has been submitted. Your result is available now."});

  const signature = `${draft.title}|${draft.questions.length}|${draft.questions[0]?.text ?? ""}`;

  useEffect(() => {
    let retryIndexes: number[] | null = null;
    if(retryMode){try{const saved=JSON.parse(assessmentStorage.getItem("fillBlanksRetryIndexes")||"[]");if(Array.isArray(saved))retryIndexes=saved.filter((n:unknown):n is number=>Number.isInteger(n)&&Number(n)>=0);}catch{}}
    const loaded = loadViewerDraft(retryIndexes);
    const savedSignature = `${loaded.title}|${loaded.questions.length}|${loaded.questions[0]?.text ?? ""}`;
    const time = Date.now();
    setDraft(loaded);
    setNow(time);
    let saved: Partial<ViewerState> = {};
    try { saved = JSON.parse(assessmentStorage.getItem(fillViewerStateKey) || "{}") as Partial<ViewerState>; }
    catch { /* Start a fresh attempt. */ }
    if (saved.signature === savedSignature) {
      setCurrent(Math.min(Math.max(Number(saved.current) || 0, 0), Math.max(loaded.questions.length - 1, 0)));
      setAnswers(saved.answers ?? {});
      setFlagged(saved.flagged ?? []);
      setSkipped(saved.skipped ?? []);
      setExpiresAt(saved.expiresAt || time + loaded.durationSeconds * 1000);
      setSubmitted(Boolean(saved.submitted));
    } else {
      setExpiresAt(time + loaded.durationSeconds * 1000);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted]);

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;
  const questions = draft.questions;
  const total = questions.length;
  const question = questions[current];
  const answered = questions.filter((q, i) => allBlanksAnswered(q, answers[i])).length;
  const remaining = Math.max(0, total - answered);
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const score = useMemo(() => questions.reduce((sum, q, i) => {
    const correct = allBlanksAnswered(q, answers[i]) &&
      q.blankCorrect.every((index, blank) => answers[i]?.[blank] === index);
    return sum + (correct ? q.points : 0);
  }, 0), [questions, answers]);

  useEffect(() => {
    if (!ready) return;
    const saved: ViewerState = { signature, current, answers, flagged, skipped, expiresAt, submitted };
    try { assessmentStorage.setItem(fillViewerStateKey, JSON.stringify(saved)); }
    catch { /* Exam still works when storage is unavailable. */ }
  }, [ready, signature, current, answers, flagged, skipped, expiresAt, submitted]);

  useEffect(() => {
    if (ready && expiresAt && secondsLeft <= 0 && !submitted) finishAttempt(true);
  }, [ready, expiresAt, secondsLeft, submitted]);

  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (!allBlanksAnswered(question, answers[current])) {
      setSkipped(old => old.includes(current) ? old : [...old, current]);
    }
    setCurrent(index);
    setHintOpen(true);
    setNotice("");
  };

  const selectAnswer = (blank: number, option: number) => {
    if (submitted) return;
    setAnswers(old => ({ ...old, [current]: Object.assign(
      Array.from({ length: question.blankCorrect.length }, (_, i) => old[current]?.[i] ?? -1),
      { [blank]: option },
    ) }));
    setSkipped(old => old.filter(value => value !== current));
    setNotice("");
  };

  const finishAttempt = (isTimeout = false) => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    if (submitted) return;
    const totalMarks = questions.reduce((sum, q) => sum + q.points, 0);
    const submittedAt = new Date().toISOString();
    const result = {
      title: draft.title, answers, score, answered, total, totalMarks, totalSeconds:draft.durationSeconds,
      scorePercent: totalMarks > 0 ? Math.round(score / totalMarks * 100) : 0,
      flagged, submittedAt, expiresAt, questions,
      usedSeconds: Math.max(0,draft.durationSeconds-Math.max(0,Math.ceil((expiresAt-Date.now())/1000)))
    };
    setSubmitted(true);
    setSubmitOpen(false);
    setRelease(getTextResultRelease("fill-in-the-blanks"));
    setSuccessOpen(!previewMode);
    setNotice(isTimeout ? "Time is up. Your assessment has been submitted." : `Assessment submitted. Score: ${score} / ${totalMarks} marks.`);
    try {
      if(!previewMode){
        assessmentStorage.setItem(retryMode ? "fillBlanksRetryResult" : "fillBlanksViewerResult", JSON.stringify(result));
        const raw = JSON.parse(assessmentStorage.getItem("fillViewerAttempts") || "[]");
        const previous = Array.isArray(raw) ? raw : [];
        const attempts = [...previous, {attemptId: crypto.randomUUID(), submittedAt, scorePercent:result.scorePercent, earnedMarks:score, totalMarks, pendingCount:0}];
        assessmentStorage.setItem("fillViewerAttempts",JSON.stringify(attempts));
        updateAssessment({attemptCount:nextAttemptCount(attempts.length)});
      }
    } catch { setNotice("Submitted. Browser storage is unavailable for saving the result."); }
  };
  const submit = () => setSubmitOpen(true);


  return <main className="superAdminPage institutionAdminPage fillViewerAppShell viewFillBlanksApp viewerAppShell">
    <div className="dashboardLayout fillViewerLayout">
      <Sidebar />
      <section className="mainContent fillViewerMain">
        <div className="fillViewerSharedHeader"><Header /></div>
        <div className="institutionScrollArea fillViewerScroll">
          <div className="pageContent institutionPageContent fillViewerContent">
            <div className="fillViewerExamTop">
              <nav className="fillViewerBreadcrumb" aria-label="Breadcrumb">
                <Link href="/dashboard">Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
                <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20} />
                <strong>{draft.title}</strong>
              </nav>
              <Stopwatch seconds={secondsLeft} />
            </div>
            <div className="fillViewerPageHeading fillViewerExamHeading"><h1>{draft.title}</h1></div>
            <div className="fillViewerExamGrid">
              <section className="fillViewerExamCard fillViewerQuestionCard" aria-label="Assessment question">
                <div className="fillViewerProgressArea">
                  <div className="fillViewerProgressLabel"><strong>{total ? current + 1 : 0}<span>/{total}</span></strong><strong className="fillViewerMarks">{question?.points ?? 0} Marks</strong></div>
                  <div className="fillViewerProgressRow">
                    <div className="fillViewerProgressTrack"><span style={{ width: `${progress}%` }} /></div>
                    <strong>{progress}%</strong>
                  </div>
                </div>
                {question ? <>
                  <div className="fillViewerQuestionHeading">
                    <h2>Question {current + 1}</h2>
                    <p>{question.text}</p>
                  </div>
                  <div className="fillViewerBlankGroups">
                    {question.blankCorrect.map((_, blank) => <div className="fillViewerBlankGroup" key={`${current}-${blank}`}>
                      {question.blankCorrect.length > 1 && <h3>Blank {blank + 1}</h3>}
                      <div className="fillViewerAnswerList" role="radiogroup" aria-label={`Answers for blank ${blank + 1}`}>
                        {question.options.map((option, index) => {
                          const selected = answers[current]?.[blank] === index;
                          return <button key={index} type="button" role="radio" aria-checked={selected}
                            disabled={submitted} onClick={() => selectAnswer(blank, index)}
                            className={`fillViewerAnswer ${selected ? "isSelected" : ""}`}>
                            <span className="fillViewerAnswerRadio" aria-hidden="true" />
                            <span>{String.fromCharCode(65 + index)}. {option}</span>
                          </button>;
                        })}
                      </div>
                    </div>)}
                  </div>
                  {question.hint && question.allowHint && <section className="fillViewerHintBox">
                    <button type="button" className="fillViewerHintToggle" aria-expanded={hintOpen} onClick={() => setHintOpen(value => !value)}>
                      <span className="fillViewerHintTitle"><span className="fillViewerHintIcon"><Icon name="idea.svg" size={25}/></span><span>Hint{hintOpen && <small>{question.hint}</small>}</span></span>
                    </button>
                  </section>}
                  <div className="fillViewerQuestionSettings">
                    <div><label>Bloom’s Taxonomy</label><span className="fillViewerBloomValue">{question.bloom || "Not specified"}</span></div>
                    <button type="button" className={`fillViewerFlagButton ${flagged.includes(current) ? "isFlagged" : ""}`}
                      disabled={submitted}
                      onClick={() => setFlagged(old => old.includes(current) ? old.filter(i => i !== current) : [...old, current])}>
                      <Icon name="flag.svg" size={22}/>{flagged.includes(current) ? "Remove flag" : "Flag for review"}
                    </button>
                  </div>
                  {notice && <p className="fillViewerInlineNotice" role="status">{notice}</p>}
                  {submitted && <button type="button" className="fillViewerExamButton fillViewerNext" onClick={() => router.push(previewMode ? "/assessments/create/review" : resultPath())}>{previewMode ? "Back to Review" : "View Results"}</button>}
                  <div className="fillViewerExamActions">
                    {current > 0 && <button type="button" className="fillViewerExamButton" disabled={current === 0} onClick={() => goTo(current - 1)}>
                      <Icon name="arrowleft.svg" />Previous
                    </button>}
                    <button type="button" className="fillViewerExamButton fillViewerNext" disabled={submitted}
                      onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                      {current === total - 1 ? "Submit" : "Next"}<Icon name="arrowrightg.svg" />
                    </button>
                  </div>
                </> : <p className="fillViewerInlineNotice">No saved questions were found in this assessment.</p>}
              </section>

              <aside className="fillViewerExamCard fillViewerNavigator">
                <h2>Question Navigator</h2>
                <div className="fillViewerQuestionTiles" aria-label="Choose question">
                  {questions.map((q, index) => {
                    const state = index === current ? "current" : flagged.includes(index) ? "flagged" : allBlanksAnswered(q, answers[index]) ? "answered" : skipped.includes(index) ? "skipped" : "remaining";
                    return <button type="button" key={index} className={`fillViewerQuestionTile is-${state}`}
                      aria-label={`Question ${index + 1}${flagged.includes(index) ? ", flagged" : ""}`}
                      aria-current={index === current ? "step" : undefined} onClick={() => goTo(index)}>{index + 1}</button>;
                  })}
                </div>
                <div className="fillViewerStatusRows">
                  <div><Icon name="checkmark-circle.svg" /><span>Answered</span><strong>{String(answered).padStart(2, "0")}</strong></div>
                  <div><span className="fillViewerRemainingCircle"/><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                  <div><Icon name="flag.svg" /><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                </div>
                <h2 className="fillViewerToolsHeading">Tools</h2>
                <div className="fillViewerToolsList">
                  <button type="button" onClick={() => router.push(`${viewerPath()}/scratch`)}><Icon name="sticky-note.svg"/>Scratch Pad<Icon name="arrowupright.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/calculator`)}><Icon name="calculator.svg"/>Calculator<Icon name="arrowup.svg" size={18}/></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/formulasheet`)}><Icon name="sigma.svg"/>Formula Sheet<Icon name="arrowupg.svg" size={18}/></button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
    <ViewerDialogs confirmOpen={submitOpen&&!submitted} successOpen={successOpen}
      onGoBack={()=>setSubmitOpen(false)} onConfirm={()=>finishAttempt(false)} onClose={()=>setSuccessOpen(false)}
      answered={answered} remaining={remaining} flagged={flagged.length} title={draft.title}
      earnedMarks={score} totalMarks={questions.reduce((sum,q)=>sum+q.points,0)}
      passingScore={Number.parseFloat(String(readJson(DETAILS_KEYS).passingScore??"60"))||60}
      release={release}/>
  </main>;
}
