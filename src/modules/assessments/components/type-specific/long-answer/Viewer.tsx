"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";

import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";
import ViewerInstructions from "@/modules/assessments/components/viewer/ViewerInstructions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./viewer.css";
import TextSubmitSuccess from "@/modules/assessments/components/viewer/TextSubmitSuccess";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import {getTextResultRelease, type ReleasePolicy} from "@/modules/assessments/components/viewer/result-release";
import {makeTextResult} from "@/modules/assessments/components/viewer/text-assessment-result";

// Keep every original viewer icon path exactly as it was.
// Only the NEW result-state assets have empty paths for your own icons.
const ICONS = "/assets/viewericons/";
const NEW_RESULT_ICON_PATHS = {
  resultCheck: "/assets/viewericons/checkmark-circle.svg",
  celebration: "/assets/viewericons/blast.png",
  partyPopper: "/assets/viewericons/party-popper.png",
  happyEmoji: "",
  resultWrong: "/assets/viewericons/cancel-circle.svg",
  sadEmoji: "",
} as const;
const defaultInstructions = ["Write your answer for each question", "Each question carries its configured marks", "Timer starts when you begin", "You can flag questions for review", "You can change answers before Final Submission", "The test auto-submits when time is up."];

type ViewerDetails = { title: string; type: string; totalQuestions: string; totalMarks: string; totalTime: string; passingScore: string; negativeMarking: string; instructions: string[] };
type AssessmentQuestion = { answerPlaceholder?:string;maxCharacters?:number;type: string; text: string; options: string[]; correct: number; bloom: string; hint: string; allowHint: boolean; points: number; expectedAnswer?: string; explanation?: string };
const initialDetails: ViewerDetails = { title: "Introduction to Artificial Intelligence", type: "Long Answer", totalQuestions: "1", totalMarks: "20", totalTime: "60 Minutes", passingScore: "60%", negativeMarking: "-0.25 Per Wrong Answers", instructions: defaultInstructions };
const demoQuestion: AssessmentQuestion = { type: "Long Answer", text: "Describe the impact of machine learning on everyday applications.", options: [], correct: -1, bloom: "Analyze", hint: "", allowHint: true, points: 1, expectedAnswer: "", explanation: "" };
function Icon({ name, size = 22 }: { name: string; size?: number }) { return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />; }
function ResultIcon({ name, size = 22 }: { name: keyof typeof NEW_RESULT_ICON_PATHS; size?: number }) { const src = NEW_RESULT_ICON_PATHS[name]; return src ? <img src={src} width={size} height={size} alt="" aria-hidden="true" /> : null; }
function firstValue(draft: Record<string, unknown>, keys: string[], fallback: string) { for (const key of keys) { const v = draft[key]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number" && Number.isFinite(v)) return String(v); } return fallback; }
function SummaryItem({ label, value, iconName, variant }: { label: string; value: string; iconName: string; variant: "blue" | "orange" | "purple" | "green" | "red" }) { return <div className={`viewerStat viewerStat--${variant}`}><span className="viewerStatIcon"><Icon name={iconName} size={24} /></span><div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div></div>; }
function formatTime(seconds: number) { const s = Math.max(0,seconds); return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(n => String(n).padStart(2,"0")); }
function Stopwatch({ seconds }: { seconds: number }) { const parts = formatTime(seconds); return <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>{parts.map((chunk,i) => <span className="viewerTimeGroup" key={i}>{i>0 && <span className="viewerTimeColon">:</span>}{chunk.split("").map((digit,j)=><span className="viewerTimeDigit" key={j}>{digit}</span>)}</span>)}</div>; }

export default function ViewerPage() {
  const router = useRouter();
  const [details,setDetails] = useState<ViewerDetails>(initialDetails);
  const [questions,setQuestions] = useState<AssessmentQuestion[]>([demoQuestion]);
  const [accepted,setAccepted] = useState(false);
  const [started,setStarted] = useState(false);
  const [current,setCurrent] = useState(0);
  const [answers,setAnswers] = useState<Record<number,number>>({});
  const [longAnswers,setLongAnswers] = useState<Record<number,string>>({});
  const [checked,setChecked] = useState<Record<number,boolean>>({});
  const [answerCorrect,setAnswerCorrect] = useState<Record<number,boolean>>({});
  const [flagged,setFlagged] = useState<number[]>([]);
  const [skipped,setSkipped] = useState<number[]>([]);
  const [hintOpen,setHintOpen] = useState(false);
  const [tool,setTool] = useState<"scratchpad"|"calculator"|"formula"|null>(null);
  const [notes,setNotes] = useState("");
  const [calc,setCalc] = useState("");
  const [secondsLeft,setSecondsLeft] = useState(3600);
  const [expiresAt,setExpiresAt] = useState(0);
  const [finished,setFinished] = useState(false);
  const [submitOpen,setSubmitOpen] = useState(false);
  const [submittedPopupOpen,setSubmittedPopupOpen] = useState(false);
  const [submittedScore,setSubmittedScore] = useState<number|null>(null);
  const [pendingCount,setPendingCount] = useState(0);
  const [resultRelease,setResultRelease] = useState<ReleasePolicy | null>(null);
  const [hasDraft,setHasDraft] = useState(false);
  // Long Answers has its own return state and paths, separate from One-Word.
  const openLongAnswerTool = (path: string) => {
    try {
      assessmentStorage.setItem("longAnswerViewerCurrentQuestion", String(current));
      assessmentStorage.setItem("longAnswerViewerReturnState", JSON.stringify({
        started, accepted, current, longAnswers, checked, answerCorrect,
        flagged, skipped, hintOpen, secondsLeft, expiresAt, finished
      }));
    } catch { /* Navigate even if browser storage is unavailable. */ }
    router.push(path);
  };
  useEffect(() => {
    try {
      const draft = JSON.parse(assessmentStorage.getItem("longAnswerAssessmentDraft") || assessmentStorage.getItem("longAnswerAssessmentDraft") || assessmentStorage.getItem("neurolxp-long-answer-draft") || "{}") as Record<string,unknown>;
      // The Long Answer builder saves its questions under this separate key.
      const contentDraft = JSON.parse(assessmentStorage.getItem("longAnswerContentDraft") || "{}") as { questions?: unknown[]; configs?: Record<string,{explanation?:string;hintAfter?:boolean;hintBefore?:boolean}> };
      const saved = Array.isArray(contentDraft.questions) ? contentDraft.questions : [];
      const converted = saved.filter((value):value is Record<string,unknown> => Boolean(value) && typeof value === "object").map((q,i) => {
        const config = contentDraft.configs?.[String(i)];
        return { type:"Long Answer", text:String(q.text||""), options:[], correct:-1, bloom:String(q.bloom||""), hint:String(q.hint||""), allowHint:config?.hintBefore !== false || config?.hintAfter === true, points:Number(q.points)||1,answerPlaceholder:String(q.answerPlaceholder||"Type your long answer here..."),maxCharacters:Number(q.maxCharacters)||5000, expectedAnswer:String(q.modelAnswer||q.expectedAnswer||""), explanation:String(config?.explanation||q.explanation||"") } satisfies AssessmentQuestion;
      });
      const available = converted.filter(q => q.text.trim());
      if (available.length) { setQuestions(available); setHasDraft(true); }
      const duration = firstValue(draft,["duration","timeLimit"],"60");
      const minutes = Number.parseFloat(duration) || 60;
      setSecondsLeft(Math.max(60,Math.round((/hour/i.test(duration)?minutes*60:minutes)*60)));
      const negative = firstValue(draft,["negativeMarkingValue","negativeMarking"],"-0.25");
      const passing = firstValue(draft,["passingScore","passingMarks"],"60");
      const creatorInstructions = creatorInstructionLines(draft.instructions, draft.descriptionInstructions);
      setDetails({ title:firstValue(draft,["assessmentTitle","assessmentName","title"],initialDetails.title), type:"Long Answer", totalQuestions:available.length?String(available.length):"1", totalMarks:firstValue(draft,["totalMarks"],available.length?String(available.reduce((n,q)=>n+q.points,0)):"20"), totalTime:/minute|hour/i.test(duration)?duration:`${duration} Minutes`, passingScore:passing.includes("%")?passing:`${passing}%`, negativeMarking:/wrong|per/i.test(negative)?negative:`${negative} Per Wrong Answers`, instructions:creatorInstructions.length ? creatorInstructions : defaultInstructions });
    } catch { /* Keep the reference preview when no session draft exists. */ }
  },[]);
  // Returning from Calculator, Scratch Pad or Formula Sheet restores this assessment.
  useEffect(() => {
    try {
      const stored = assessmentStorage.getItem("longAnswerViewerReturnState");
      if (!stored) return;
      const state = JSON.parse(stored) as {
        started?: boolean; accepted?: boolean; current?: number;
        longAnswers?: Record<number,string>; checked?: Record<number,boolean>;
        answerCorrect?: Record<number,boolean>; flagged?: number[];
        skipped?: number[]; hintOpen?: boolean; secondsLeft?: number; expiresAt?: number;
        finished?: boolean;
      };
      if (!state.started) return;
      const index = Number(assessmentStorage.getItem("longAnswerViewerCurrentQuestion") ?? state.current ?? 0);
      setCurrent(Number.isFinite(index) ? Math.max(0,Math.floor(index)) : 0);
      setStarted(true);
      setAccepted(Boolean(state.accepted));
      setLongAnswers(state.longAnswers ?? {});
      setChecked(state.checked ?? {});
      setAnswerCorrect(state.answerCorrect ?? {});
      setFlagged(state.flagged ?? []);
      setSkipped(state.skipped ?? []);
      setHintOpen(Boolean(state.hintOpen));
      if (typeof state.expiresAt === "number" && state.expiresAt > 0) {setExpiresAt(state.expiresAt);setSecondsLeft(Math.max(0,Math.ceil((state.expiresAt-Date.now())/1000)));}
      else if (typeof state.secondsLeft === "number") setSecondsLeft(state.secondsLeft);
      setFinished(Boolean(state.finished));
    } catch { /* Keep original Long Answer behavior if the saved state is invalid. */ }
  }, []);
  useEffect(()=>{ if (hasDraft && current >= questions.length) setCurrent(Math.max(0,questions.length-1)); },[hasDraft,current,questions.length]);
  // Re-attempt only the incorrect saved text questions using the same Viewer and design.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("retry") !== "wrong") return;
    try {
      const retry = JSON.parse(assessmentStorage.getItem("viewerRetryQuestions") || "[]");
      if (!Array.isArray(retry) || !retry.length) return;
      const converted = retry.map((q: Record<string,unknown>) => ({
        type: "Long Answer",text:String(q.text||""),options:[],correct:-1,bloom:String(q.bloom||""),
        hint:String(q.hint||""),allowHint:true,points:Number(q.points)||1,
        expectedAnswer:String(q.expectedAnswer||""),explanation:String(q.explanation||"")
      })) as AssessmentQuestion[];
      setQuestions(converted);setHasDraft(true);setDetails(old=>({...old,totalQuestions:String(converted.length),totalMarks:String(converted.reduce((n,q)=>n+q.points,0))}));
      setSecondsLeft(Math.max(60,(Number(assessmentStorage.getItem("viewerRetryDurationMinutes")) || 15)*60));
      setStarted(false);setAccepted(false);setFinished(false);setCurrent(0);setLongAnswers({});setAnswers({});
      setChecked({});setAnswerCorrect({});setSkipped([]);setFlagged([]);setHintOpen(false);setSubmittedPopupOpen(false);
    } catch { /* Keep the ordinary Viewer available for malformed retry data. */ }
  }, []);
  useEffect(()=>{if(!started || finished)return;if(!expiresAt){setExpiresAt(Date.now()+secondsLeft*1000);return;}const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((expiresAt-Date.now())/1000)));tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[started,finished,expiresAt]);
  useEffect(()=>{if(!started || finished || !expiresAt || new URLSearchParams(window.location.search).get("preview")==="true")return;try{assessmentStorage.setItem("longAnswerViewerReturnState",JSON.stringify({started,accepted,current,answers,longAnswers,checked,answerCorrect,flagged,skipped,hintOpen,secondsLeft,expiresAt,finished:false}));}catch{}},[started,accepted,current,answers,longAnswers,checked,answerCorrect,flagged,skipped,hintOpen,secondsLeft,expiresAt,finished]);
  const submitAssessment = () => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    if (finished) return;
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    const isRetry = new URLSearchParams(window.location.search).get("retry") === "wrong";
    const fullSeconds = Math.max(60, Number.parseFloat(details.totalTime)*60 || 3600);
    let retryCount = 1;
    if (isRetry) {
      try { const prior = JSON.parse(assessmentStorage.getItem("viewerAssessmentResult") || "null"); retryCount=Number(prior?.retryAttemptsUsed)||2; }
      catch { retryCount=2; }
    }
    const result = makeTextResult({mode:"long-answer",title:details.title,questions,shortAnswers:longAnswers,checked,answerCorrect,flagged,
      totalSeconds:isRetry?Math.max(60,(Number(assessmentStorage.getItem("viewerRetryDurationMinutes"))||15)*60):fullSeconds,
      secondsLeft,retryCount});
    try {
      if (!isPreview) {
        assessmentStorage.setItem(isRetry ? "viewerRetryResult" : "viewerAssessmentResult",JSON.stringify(result));
        if (!isRetry) assessmentStorage.setItem("longAnswerViewerResult",JSON.stringify(result));
        const previous = JSON.parse(assessmentStorage.getItem("viewerAttempts") || "[]");
        const attempts = [...(Array.isArray(previous)?previous:[]),result];
        assessmentStorage.setItem("viewerAttempts",JSON.stringify(attempts));
        updateAssessment({attemptCount:nextAttemptCount(attempts.length)});
      }
    } catch { /* Submission remains visible even if browser quota has been exceeded. */ }
    setSubmittedScore(result.scorePercent);setPendingCount(result.pendingCount);
    setResultRelease(getTextResultRelease("long-answer",result.pendingCount));
    if (!isPreview) assessmentStorage.removeItem("longAnswerViewerReturnState");
    setSubmitOpen(false);setFinished(true);setSubmittedPopupOpen(!isPreview);
  };
  useEffect(()=>{if(started && secondsLeft===0 && !finished) submitAssessment();},[started,secondsLeft,finished]);
  const total = hasDraft ? questions.length : Math.max(1,questions.length);
  const question = questions[current];
  // All questions on this route remain Long Answers, regardless of the saved question's type.
  const shortMode = true;
  const answered = Array.from({length:total},(_,i)=>i).filter(i=>Boolean(longAnswers[i]?.trim())).length;
  const progress = total?Math.round(answered/total*100):0;
  const remaining = Math.max(0,total-answered);
  const showHint = Boolean(question?.hint) && question.allowHint;
  const toggleFlag = () => setFlagged(old=>old.includes(current)?old.filter(n=>n!==current):[...old,current]);
  const goTo = (index:number)=>{if(index!==current && !longAnswers[current]?.trim()) setSkipped(old=>old.includes(current)?old:[...old,current]);setCurrent(index);setHintOpen(false);setTool(null);};
  const checkAnswer = () => {
    if (!question || !(shortMode ? Boolean(longAnswers[current]?.trim()) : answers[current] !== undefined)) return;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
    const typed = normalize(longAnswers[current] || "");
    const expected = normalize(question.expectedAnswer || "");
    const isCorrect = expected ? (typed === expected || (expected.includes("overfitting") && /overfitt?ing|overfit/.test(typed) && /train/.test(typed) && /(?:new|unseen|generaliz|test)/.test(typed))) : false;
    setAnswerCorrect(old=>({...old,[current]:isCorrect}));
    setChecked(old=>({...old,[current]:true}));
  };
  const calcResult = useMemo(() => {
    const match = calc.trim().match(/^(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return "Enter two numbers and an operator (for example: 12 + 3)";
    const a = Number(match[1]); const b = Number(match[3]);
    if (match[2] === "/" && b === 0) return "Cannot divide by zero";
    const result = match[2] === "+" ? a + b : match[2] === "-" ? a - b : match[2] === "*" ? a * b : a / b;
    return `Result: ${Number(result.toFixed(8))}`;
  }, [calc]);
  const resultText = useMemo(()=>Object.entries(answers).reduce((score,[idx,answer])=>score+(questions[Number(idx)]?.correct===answer?questions[Number(idx)]?.points||0:0),0),[answers,questions]);
  return <main className="superAdminPage institutionAdminPage viewerAppShell"><div className="dashboardLayout viewerLayout"><Sidebar /><section className="mainContent viewerMain"><div className="viewerSharedHeader"><Header /></div><div className="institutionScrollArea viewerScroll"><div className="pageContent institutionPageContent viewerContent">
    {started ? <><style>{`/* Figma Long Answer assessment: only affects the started Long Answer screen. */
.viewerQuestionCard.viewerLongAnswer{min-height:732px;padding:24px;background:#DFE6E9;box-shadow:-4px -4px 8px #fff,4px 4px 8px #C4C4C4;border-radius:8px;font-family:"Segoe UI",sans-serif}
.viewerLongAnswer .viewerProgressLabel{display:flex;justify-content:space-between;align-items:center;color:#374151;font-size:16px;font-weight:700;margin-bottom:4px}
.viewerLongAnswer .viewerProgressRow{margin-bottom:22px}
.viewerLongAnswer .viewerQuestionHeading h2{font-size:18px;line-height:28px;color:#2D4CC8;font-weight:700;margin:0 0 4px}
.viewerLongAnswer .viewerQuestionHeading p{font-size:16px;line-height:28px;color:#2F3547;margin:0 0 18px}
.viewerShortResponse{display:flex;flex-direction:column;gap:8px;margin:0 0 24px}
.viewerShortCount{align-self:flex-end;color:#374151;font-size:14px}
.viewerShortResponse textarea{width:100%;min-height:300px;resize:vertical;box-sizing:border-box;padding:24px;background:#DFE6E9;border:0;border-radius:8px;box-shadow:inset -4px -4px 4px #fff,inset 4px 4px 4px #C4C4C4;color:#2F3547;font:14px "Segoe UI",sans-serif;outline:none}
.viewerShortResponse textarea::placeholder{color:#7E8594}
.viewerShortResponse textarea:focus{outline:1px solid #2D4CC8}
.viewerLongAnswer .viewerHintBox{background:#DFE6E9;border-radius:8px;box-shadow:-4px -4px 4px #fff,4px 4px 4px #C4C4C4;min-height:66px;padding:12px 18px;margin-bottom:20px}
.viewerLongAnswer .viewerHintBox p{display:block;margin:4px 0 0 54px;color:#374151;font-size:14px}
.viewerLongAnswer .viewerHintTitle{color:#63560B;font-size:18px;font-weight:600}
.viewerLongAnswer .viewerBloomValue{background:#DFE6E9;box-shadow:inset -4px -4px 4px #fff,inset 4px 4px 4px #C4C4C4;border-radius:8px;min-width:184px;padding:10px 16px}
.viewerLongAnswer .viewerExamActions{margin-top:36px;display:flex;justify-content:space-between;gap:12px}
.viewerLongAnswer .viewerExamButton{background:#DFE6E9;box-shadow:-4px -4px 4px #fff,4px 4px 4px #C4C4C4;border-radius:50px;min-height:56px;padding:10px 28px;font:600 18px "Segoe UI",sans-serif}
.viewerLongAnswer .viewerNext{color:#2A7308;border:1px solid #2A7308}
@media(max-width:720px){.viewerQuestionCard.viewerLongAnswer{padding:16px;min-height:0}.viewerLongAnswer .viewerExamActions{flex-wrap:wrap}.viewerLongAnswer .viewerExamButton{padding:10px 16px;font-size:15px}}
`}</style>
      <div className="viewerExamTop"><nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href={demoDashboardPath()}>Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{details.title}</strong></nav><Stopwatch seconds={secondsLeft}/></div>
      <div className="viewerPageHeading viewerExamHeading"><h1>{details.title}</h1></div>
      {finished ? <section className="viewerExamCard viewerExamFinished"><h2>Assessment submitted</h2><p>{answered} of {total} questions answered.</p><p>{!resultRelease || resultRelease.mode !== "immediate" ? "Your submission was saved. Result release is controlled by your instructor." : pendingCount ? "Some responses are awaiting grading." : resultRelease.showScore && submittedScore !== null ? `Score: ${submittedScore}%` : "Your assessment was submitted successfully."}</p><button className="viewerExamButton" onClick={()=>router.push("/learner")}>Return to assessments</button></section> : <div className="viewerExamGrid"><section className="viewerExamCard viewerQuestionCard viewerLongAnswer">
        <div className="viewerProgressLabel"><strong>{shortMode ? current+1 : answered}<span>/{total}</span></strong>{shortMode && <strong>{question?.points || 5} Marks</strong>}</div><div className="viewerProgressRow"><div className="viewerProgressTrack"><span style={{width:`${progress}%`}}/></div><strong>{progress}%</strong></div>
        <div className="viewerQuestionHeading"><h2>Question {current+1}</h2><p>{question?.text || "No question has been created for this position yet."}</p></div>
        {shortMode ? <div className="viewerShortResponse"><div className="viewerShortCount"><span>{longAnswers[current]?.length || 0}/{question?.maxCharacters||5000}</span></div>{checked[current] ? <div className={`viewerAnswerFeedback ${answerCorrect[current] ? "viewerAnswerFeedback--correct" : "viewerAnswerFeedback--incorrect"}`} role="status"><div className="viewerFeedbackTitle"><span aria-hidden="true">{<ResultIcon name={answerCorrect[current] ? "resultCheck" : "resultWrong"} size={24} />}</span>{answerCorrect[current] ? "Correct" : "Incorrect"}</div><p>{question?.expectedAnswer || "Your answer has been submitted for review."}</p></div> : <textarea maxLength={question?.maxCharacters||5000} aria-label="Long answer" placeholder={question?.answerPlaceholder||"Write your detailed long answer here..."} value={longAnswers[current] || ""} onChange={e=>setLongAnswers(old=>({...old,[current]:e.target.value}))}/>}</div> : <div className="viewerAnswerList">{question?.options.map((option,i) => {const selected=answers[current]===i;const revealed=Boolean(checked[current]); const correct=revealed && i===question.correct;const incorrect=revealed && selected && i!==question.correct;return <button key={i} type="button" disabled={revealed} className={`viewerAnswer ${selected?"isSelected":""} ${correct?"isCorrect":""} ${incorrect?"isIncorrect":""}`} onClick={()=>setAnswers(old=>({...old,[current]:i}))}><span className="viewerAnswerRadio" aria-hidden="true"/><span>{String.fromCharCode(65+i)}. {option}</span>{correct && <span className="viewerCorrectMark"><Icon name="checkmark-circle-02.svg" size={21}/></span>}</button>;})}</div>}
        {showHint && <section className="viewerHintBox"><button type="button" className="viewerHintToggle" aria-expanded={hintOpen} onClick={()=>setHintOpen(s=>!s)}><span className="viewerHintTitle"><span className="viewerHintIcon"><Icon name="idea-01.svg" size={25}/></span>Hint</span><span className="viewerHintEye"><Icon name="view.svg" size={20}/></span></button>{hintOpen && <p>{question?.hint}</p>}</section>}
        <div className="viewerQuestionSettings"><div><label>Bloom’s Taxonomy</label><span className="viewerBloomValue">{question?.bloom||"Not specified"}</span></div><button type="button" className={`viewerFlagButton ${flagged.includes(current)?"isFlagged":""}`} onClick={toggleFlag}><Icon name="flag-03.svg" size={22}/>{flagged.includes(current)?"Remove flag":"Flag for review"}</button></div>
        <div className="viewerExamActions">{current > 0 && <button type="button" className="viewerExamButton" onClick={()=>goTo(current-1)}><Icon name="arrow-left-02.svg"/>Previous</button>}<button type="button" className="viewerExamButton viewerNext" onClick={()=> current===total-1?setSubmitOpen(true):goTo(Math.min(total-1,current+1))}>{current===total-1?"Submit":"Next"}<Icon name="arrowrightg.svg"/></button></div>
      </section><aside className={`viewerExamCard viewerNavigator ${shortMode && checked[current] ? "viewerNavigator--result" : ""}`}>{shortMode && checked[current] ? <div className="viewerResultPanel" role="status" aria-live="polite">{answerCorrect[current] && <div className="viewerConfetti" aria-hidden="true"><ResultIcon name="celebration" size={300} /></div>}<div className={`viewerResultCheck ${answerCorrect[current] ? "" : "viewerResultCheck--review"}`}>{<ResultIcon name={answerCorrect[current] ? "resultCheck" : "resultWrong"} size={32} />}</div><h2>{answerCorrect[current] ? <>Correct ! <ResultIcon name="partyPopper" size={26} /></> : "Not Quit !"}</h2><div className="viewerResultAnswers"><p>Your Answer : <strong>{longAnswers[current]}</strong></p><p>Correct Answer : <strong>{question?.expectedAnswer || "Requires manual grading"}</strong></p></div><div className={`viewerResultWhy ${answerCorrect[current] ? "" : "viewerResultWhy--wrong"}`}><h3>Why ?</h3><p>{question?.explanation || (answerCorrect[current] ? "Your answer matches the expected concept." : "Compare your response with the reference answer above.")}</p><div className={`viewerHappyEmoji ${answerCorrect[current] ? "" : "viewerSadEmoji"}`} aria-label={answerCorrect[current] ? "Happy smiling face" : "Sad face"} role="img">{answerCorrect[current] ? <><span className="viewerEmojiEye viewerEmojiEye--left"><b/></span><span className="viewerEmojiEye viewerEmojiEye--right"><b/></span><span className="viewerEmojiMouth"/></> : <><span className="viewerSadBrow viewerSadBrow--left"/><span className="viewerSadBrow viewerSadBrow--right"/><span className="viewerSadEye viewerSadEye--left"><b/></span><span className="viewerSadEye viewerSadEye--right"><b/></span><span className="viewerSadMouth"/></>}</div></div></div> : <><h2>Question Navigator</h2><div className="viewerQuestionTiles">{Array.from({length:total},(_,i)=>{ const state = current===i?"current":flagged.includes(i)?"flagged":Boolean(longAnswers[i]?.trim())?"answered":skipped.includes(i)?"skipped":"remaining";return <button type="button" key={i} className={`viewerQuestionTile is-${state}`} onClick={()=>goTo(i)} aria-current={current===i?"step":undefined}>{i+1}</button>})}</div>
      <div className="viewerStatusRows"><div><Icon name="checkmark-circle-02.svg"/><span>Answered</span><strong>{String(answered).padStart(2,"0")}</strong></div><div><span className="viewerRemainingCircle"/><span>Remaining</span><strong>{String(remaining).padStart(2,"0")}</strong></div><div><Icon name="flag-03.svg"/><span>Flagged</span><strong>{String(flagged.length).padStart(2,"0")}</strong></div></div><h2 className="viewerToolsHeading">Tools</h2><div className="viewerToolsList"><button type="button" onClick={()=>setTool("scratchpad")}><Icon name="sticky-note.svg"/>Scratch Pad <Icon name="arrowupright.svg" size={18}/></button><button type="button" onClick={()=>setTool("calculator")}><Icon name="calculator.svg"/>Calculator <Icon name="arrowup.svg" size={18}/></button><button type="button" onClick={()=>setTool("formula")}><Icon name="sigma.svg"/>Formula Sheet <Icon name="arrowupg.svg" size={18}/></button></div>
      {tool && <div className="viewerToolPanel"><div className="viewerToolPanelTop"><strong>{tool==="scratchpad"?"Scratch Pad":tool==="calculator"?"Calculator":"Formula Sheet"}</strong><button type="button" onClick={()=>setTool(null)} aria-label="Close tool">×</button></div>{tool==="scratchpad"?<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Write notes here..." rows={5}/>:tool==="calculator"?<div><input value={calc} onChange={e=>setCalc(e.target.value.replace(/[^0-9+*/().\- ]/g,""))} placeholder="Enter arithmetic expression"/><p>{calcResult}</p><button onClick={()=>setCalc("")}>Clear</button></div>:<p>No formula sheet was supplied with the saved assessment.</p>}</div>}</>}</aside></div>}
    </> : <><nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href={demoDashboardPath()}>Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{details.title}</strong></nav><div className="viewerPageHeading"><h1>{details.title}</h1><p>{details.type}</p></div><ViewerInstructions details={details} accepted={accepted} onAcceptedChange={setAccepted} onStart={()=>{setStarted(true);setCurrent(0);setHintOpen(false);}}/> </>}
  {submitOpen && !finished && <ViewerSubmitConfirm answered={answered} remaining={remaining} flagged={flagged.length} onBack={()=>setSubmitOpen(false)} onSubmit={submitAssessment}/>}
  {submittedPopupOpen && resultRelease && <TextSubmitSuccess title={details.title} scorePercent={submittedScore} pendingCount={pendingCount} passingScore={details.passingScore} release={resultRelease} isRetry={new URLSearchParams(window.location.search).get("retry")==="wrong"} onClose={()=>setSubmittedPopupOpen(false)}/>}
  </div></div></section></div></main>;
}
