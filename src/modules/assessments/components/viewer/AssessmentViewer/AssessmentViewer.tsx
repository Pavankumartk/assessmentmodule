"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";

import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";

import { assessmentStorage, viewerPath, resultPath, updateAssessment } from "@/modules/assessments/storage/assessment-storage";







import Link from "next/link";
import { useRouter } from "next/navigation";



import { useEffect, useMemo, useState } from "react";



import Sidebar from "../../common/sidebar/page";



import Header from "../../common/header/Header";



import "./viewer.css";







const ICONS = "/assets/viewericons/";



const defaultInstructions = ["Select one answer for each question", "Each question carries its configured marks", "The timer starts when you begin", "You can flag questions for later review", "You can change your answer before Final Submission", "The test will auto-submit when time is up."];







type ViewerDetails = { title: string; type: string; totalQuestions: string; totalMarks: string; totalTime: string; passingScore: string; negativeMarking: string; instructions: string[] };



type AssessmentQuestion = { type: string; text: string; options: string[]; correct: number; bloom: string; hint: string; allowHint: boolean; points: number };



const initialDetails: ViewerDetails = { title: "Introduction to Artificial Intelligence", type: "MCQ", totalQuestions: "20", totalMarks: "20", totalTime: "60 Minutes", passingScore: "60%", negativeMarking: "-0.25 Per Wrong Answers", instructions: defaultInstructions };



const demoQuestion: AssessmentQuestion = { type: "MCQ", text: "Which data structure follows the LIFO Principle?", options: ["Queue", "Stack", "Linked list", "Array"], correct: 1, bloom: "Analyse", hint: "Think of a stack of plates: the last plate you place on top is the first one you remove.", allowHint: true, points: 1 };



function Icon({ name, size = 22 }: { name: string; size?: number }) { return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />; }




// Match the Viewer submission message to the Result Available setting saved by MCQ Evaluation.
type ResultReleaseMode = "immediate" | "scheduled" | "manual" | "never";
type ResultRelease = { mode: ResultReleaseMode; releaseDateLabel: string };
function getResultRelease(viewerMode?: "true-false"): ResultRelease {
  const parseDraft = (raw: string | null): Record<string, unknown> => {
    try { const value: unknown = JSON.parse(raw || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  const data = parseDraft(assessmentStorage.getItem(viewerMode === "true-false" ? "trueFalseEvaluationDraft" : "mcqAssessmentEvaluationDraft"));
  const nested = data.dropdownSettings;
  const settings = nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Record<string, unknown> : {};
  const get = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = settings[key] ?? data[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return undefined;
  };
  const rawMode = String(get("reviewAvailability", "resultAvailable", "resultAvailability", "resultReleaseMode", "releaseMode") ?? "Immediately").trim().toLowerCase();
  const showResult = get("resultAfter", "showResult", "showResults", "showResultAfterSubmission");
  let mode: ResultReleaseMode = "immediate";
  if (rawMode.includes("never") || rawMode.includes("not available") || showResult === false || ["no","off"].includes(String(showResult).toLowerCase())) mode = "never";
  else if (rawMode.includes("schedul") || rawMode.includes("after clos") || rawMode.includes("at a later")) mode = "scheduled";
  else if (rawMode.includes("manual") || rawMode.includes("after grad") || rawMode.includes("after moderat") || rawMode.includes("instructor")) mode = "manual";

  const releaseDate = String(get("resultReleaseDate", "scheduledReleaseDate", "resultAvailableDate", "releaseDate", "scheduledDate", "resultDate", "resultAvailableAt", "scheduledReleaseAt", "releaseAt") ?? "").trim();
  const releaseTime = String(get("resultReleaseTime", "scheduledReleaseTime", "resultAvailableTime", "releaseTime", "scheduledTime", "resultTime") ?? "").trim();
  let dateLabel = "Release date to be announced";
  if (releaseDate) {
    const combined = releaseTime && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? `${releaseDate}T${releaseTime}` : releaseDate;
    const parsed = new Date(combined);
    if (!Number.isNaN(parsed.getTime())) {
      if (mode === "scheduled" && Date.now() >= parsed.getTime()) mode = "immediate";
      const datePart = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
      const timePart = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(parsed).replace(" ", "");
      dateLabel = `${datePart}, ${timePart}`;
    } else dateLabel = [releaseDate, releaseTime].filter(Boolean).join(", ");
  }
  return { mode, releaseDateLabel: dateLabel };
}

function firstValue(draft: Record<string, unknown>, keys: string[], fallback: string) { for (const key of keys) { const v = draft[key]; if (typeof v === "string" && v.trim()) return v.trim(); if (typeof v === "number" && Number.isFinite(v)) return String(v); } return fallback; }



function SummaryItem({ label, value, iconName, variant }: { label: string; value: string; iconName: string; variant: "blue" | "orange" | "purple" | "green" | "red" }) { return <div className={`viewerStat viewerStat--${variant}`}><span className="viewerStatIcon"><Icon name={iconName} size={24} /></span><div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div></div>; }



function formatTime(seconds: number) { const s = Math.max(0,seconds); return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(n => String(n).padStart(2,"0")); }



function Stopwatch({ seconds }: { seconds: number }) { const parts = formatTime(seconds); return <div className="viewerExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>{parts.map((chunk,i) => <span className="viewerTimeGroup" key={i}>{i>0 && <span className="viewerTimeColon">:</span>}{chunk.split("").map((digit,j)=><span className="viewerTimeDigit" key={j}>{digit}</span>)}</span>)}</div>; }







export default function ViewerPage({ mode }: { mode?: "true-false" } = {}) {
  const router=useRouter();
  const [hydrated,setHydrated]=useState(false);



  const [details,setDetails] = useState<ViewerDetails>(initialDetails);



  const [questions,setQuestions] = useState<AssessmentQuestion[]>([demoQuestion]);



  const [accepted,setAccepted] = useState(false);



  const [started,setStarted] = useState(false);



  const [current,setCurrent] = useState(0);



  const [answers,setAnswers] = useState<Record<number,number>>({});







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
  const [resultRelease,setResultRelease] = useState<ResultRelease>({ mode: "immediate", releaseDateLabel: "" });



  const [hasDraft,setHasDraft] = useState(false);



  useEffect(() => {



    try {



      const draft = JSON.parse(assessmentStorage.getItem(mode === "true-false" ? "trueFalseAssessmentDraft" : "mcqAssessmentDraft") || "{}") as Record<string,unknown>;



      const contentDraft = JSON.parse(assessmentStorage.getItem(mode === "true-false" ? "trueFalseContentDraft" : "mcqContentDraft") || "{}") as { questions?: unknown[]; optionDetails?: Record<string,{hint?:string;showHint?:boolean;allowHint?:boolean}> };



      const saved = Array.isArray(contentDraft.questions) ? contentDraft.questions : [];



      const converted = saved.filter((value):value is Record<string,unknown> => Boolean(value) && typeof value === "object").map((q,i) => {



        const options = Array.isArray(q.options) ? q.options.map(o=>String(o ?? "")) : [];



        const correct = typeof q.correct === "number" && q.correct >= 0 ? q.correct : Array.isArray(q.blankCorrect) && typeof q.blankCorrect[0] === "number" ? q.blankCorrect[0] : -1;



        const detail = contentDraft.optionDetails?.[`${i}-${correct}`];



        const otherDetails = Object.entries(contentDraft.optionDetails || {}).filter(([key])=>key.startsWith(`${i}-`)).map(([,val])=>val);



        const hintDetail = detail?.hint ? detail : otherDetails.find(d=>d.hint?.trim());



        return { type:String(q.type || (mode === "true-false" ? "True / False" : "MCQ")), text:String(q.text||""), options, correct, bloom:String(q.bloom||""), hint:hintDetail?.hint || "", allowHint:hintDetail?.allowHint !== false, points:Number(q.points)||1 } satisfies AssessmentQuestion;



      });



      const available = converted.filter(q => q.text.trim() && q.options.some(Boolean));



      if (available.length) { setQuestions(available); setHasDraft(true); }
      else if (mode === "true-false") { setQuestions([]); setHasDraft(false); }



      const duration = firstValue(draft,["duration","timeLimit"],"60");



      const minutes = Number.parseFloat(duration) || 60;



      setSecondsLeft(Math.max(60,Math.round((/hour/i.test(duration)?minutes*60:minutes)*60)));



      const negative = firstValue(draft,["negativeMarkingValue","negativeMarking"],"-0.25");



      const passing = firstValue(draft,["passingScore","passingMarks"],"60");



      const creatorInstructions = creatorInstructionLines(draft.instructions, draft.descriptionInstructions);



      setDetails({ title:firstValue(draft,["assessmentTitle","assessmentName","title"],initialDetails.title), type:firstValue(draft,["assessmentType"],mode === "true-false" ? "True / False" : "MCQ"), totalQuestions:available.length?String(available.length):"20", totalMarks:firstValue(draft,["totalMarks"],available.length?String(available.reduce((n,q)=>n+q.points,0)):"20"), totalTime:/minute|hour/i.test(duration)?duration:`${duration} Minutes`, passingScore:passing.includes("%")?passing:`${passing}%`, negativeMarking:/wrong|per/i.test(negative)?negative:`${negative} Per Wrong Answers`, instructions:creatorInstructions.length ? creatorInstructions : defaultInstructions });



    } catch { /* Keep the original demo only if no saved assessment exists. */ }
    try {
      const state=JSON.parse(assessmentStorage.getItem("viewerAttemptDraft")||"null");
      if(state && typeof state==="object" && !state.finished){
        if(state.answers) setAnswers(state.answers);
        if(Array.isArray(state.flagged))setFlagged(state.flagged);
        if(Array.isArray(state.skipped))setSkipped(state.skipped);
        if(Number.isInteger(state.current))setCurrent(state.current);
        if(typeof state.started==="boolean")setStarted(state.started);
        if(Number.isFinite(state.expiresAt) && state.expiresAt>0) {setExpiresAt(state.expiresAt);setSecondsLeft(Math.max(0,Math.ceil((state.expiresAt-Date.now())/1000)));}
        else if(Number.isFinite(state.secondsLeft))setSecondsLeft(state.secondsLeft);
      }
      if(new URLSearchParams(window.location.search).get("retry")==="wrong") {
        const retry=JSON.parse(assessmentStorage.getItem("viewerRetryQuestions")||"[]");
        if(Array.isArray(retry)&&retry.length){
          setQuestions(retry.map(q=>({type:"MCQ",text:q.text||"",options:q.options||[],correct:q.correct??-1,bloom:q.bloom||"",hint:q.hint||"",allowHint:true,points:q.points||1})));
          setHasDraft(true);
          setAnswers({});setFlagged([]);setSkipped([]);setCurrent(0);setStarted(false);
          const duration=Number(assessmentStorage.getItem("viewerRetryDurationMinutes")||15);
          setSecondsLeft(Math.max(60,duration*60));
        }
      }
    }catch{}
    setHydrated(true);
  },[]);



  useEffect(()=>{if(!started || finished)return;if(!expiresAt){setExpiresAt(Date.now()+secondsLeft*1000);return;}const tick=()=>setSecondsLeft(Math.max(0,Math.ceil((expiresAt-Date.now())/1000)));tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[started,finished,expiresAt]);



  useEffect(()=>{if(started && secondsLeft===0 && !finished && hydrated) submitAssessment();},[started,secondsLeft,finished,hydrated]);



  const total = hasDraft ? questions.length : Math.max(20,questions.length);



  const question = questions[current];



  const answered = Object.keys(answers).filter(key=>answers[Number(key)]!==undefined).length;



  const progress = total?Math.round(answered/total*100):0;



  const remaining = Math.max(0,total-answered);



  const showHint = Boolean(question?.hint) && question.allowHint;



  const toggleFlag = () => setFlagged(old=>old.includes(current)?old.filter(n=>n!==current):[...old,current]);



  const goTo = (index:number)=>{if(index!==current && answers[current]===undefined) setSkipped(old=>old.includes(current)?old:[...old,current]);setCurrent(index);setHintOpen(false);setTool(null);};







  const calcResult = useMemo(() => {



    const match = calc.trim().match(/^(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/);



    if (!match) return "Enter two numbers and an operator (for example: 12 + 3)";



    const a = Number(match[1]); const b = Number(match[3]);



    if (match[2] === "/" && b === 0) return "Cannot divide by zero";



    const result = match[2] === "+" ? a + b : match[2] === "-" ? a - b : match[2] === "*" ? a * b : a / b;



    return `Result: ${Number(result.toFixed(8))}`;



  }, [calc]);



  useEffect(()=>{
    if(!hydrated || finished || new URLSearchParams(window.location.search).get("preview")==="true") return;
    try { assessmentStorage.setItem("viewerAttemptDraft",JSON.stringify({answers,flagged,skipped,current,started,secondsLeft,expiresAt,finished:false}));assessmentStorage.setItem("viewerCurrentQuestion",String(current)); }catch{}
  },[hydrated,answers,flagged,skipped,current,started,secondsLeft,expiresAt,finished]);
  const resultText = useMemo(()=>Object.entries(answers).reduce((score,[idx,answer])=>score+(questions[Number(idx)]?.correct===answer?questions[Number(idx)]?.points||0:0),0),[answers,questions]);
  const submitAssessment=()=>{
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    const isPreview=new URLSearchParams(window.location.search).get("preview")==="true";
    const totalMarks=Number(details.totalMarks)||questions.reduce((n,q)=>n+q.points,0);
    const entries=questions.map((q,i)=>({
      text:q.text,options:q.options,correct:q.correct,selected:answers[i]??null,points:q.points,
      hint:q.hint,bloom:q.bloom,topic:q.bloom||"General",flagged:flagged.includes(i)
    }));
    const correctAnswers=entries.filter(q=>q.selected!==null&&q.selected===q.correct).length;
    const incorrectAnswers=entries.filter(q=>q.selected!==null&&q.selected!==q.correct).length;
    const unanswered=entries.length-correctAnswers-incorrectAnswers;
    const earnedMarks=entries.reduce((sum,q)=>sum+(q.selected!==null&&q.selected===q.correct?q.points:0),0);
    const totalSeconds=Math.max(60,Number.parseFloat(details.totalTime)*60||3600);
    const result={attemptId:crypto.randomUUID(),title:details.title,questions:entries,
      totalQuestions:entries.length,correctAnswers,incorrectAnswers,unanswered,totalMarks,earnedMarks,
      scorePercent:Math.round((earnedMarks/Math.max(1,totalMarks))*100),
      totalSeconds,usedSeconds:Math.max(0,totalSeconds-secondsLeft),flaggedQuestionIndexes:flagged,
      retryAttemptsUsed:1,retryAttemptsAllowed:2,retryDurationMinutes:15,submittedAt:new Date().toISOString()};
    try {
      const retrying = new URLSearchParams(window.location.search).get("retry") === "wrong";
      if (!isPreview) assessmentStorage.setItem(retrying ? "viewerRetryResult" : "viewerAssessmentResult", JSON.stringify(result));
      if (!isPreview) {
        const prior=JSON.parse(assessmentStorage.getItem("viewerAttempts")||"[]");
        const attempts=[...(Array.isArray(prior)?prior:[]),result];
        assessmentStorage.setItem("viewerAttempts",JSON.stringify(attempts));
        assessmentStorage.setItem("viewerAttemptDraft",JSON.stringify({finished:true}));
        updateAssessment({attemptCount:nextAttemptCount(attempts.length)});
      }
    }catch{}
    setResultRelease(getResultRelease(mode));setSubmitOpen(false);setFinished(true);setSubmittedPopupOpen(!isPreview);
  };



  return <main className="superAdminPage institutionAdminPage viewerAppShell"><div className="dashboardLayout viewerLayout"><Sidebar /><section className="mainContent viewerMain"><div className="viewerSharedHeader"><Header /></div><div className="institutionScrollArea viewerScroll"><div className="pageContent institutionPageContent viewerContent">



    {started ? <>



      <div className="viewerExamTop"><nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{details.title}</strong></nav><Stopwatch seconds={secondsLeft}/></div>



      <div className="viewerPageHeading viewerExamHeading"><h1>{details.title}</h1></div>



      {finished ? <section className="viewerExamCard viewerExamFinished"><h2>Assessment submitted</h2><p>{answered} of {total} questions answered.</p><p>{resultRelease.mode === "immediate" ? `Score: ${resultText} marks` : "Your result will be available according to the release settings."}</p><button className="viewerExamButton" onClick={()=>router.push("/learner")}>Return to assessments</button></section> : <div className="viewerExamGrid"><section className="viewerExamCard viewerQuestionCard">



        <div className="viewerProgressLabel"><strong>{answered}<span>/{total}</span></strong></div><div className="viewerProgressRow"><div className="viewerProgressTrack"><span style={{width:`${progress}%`}}/></div><strong>{progress}%</strong></div>



        <div className="viewerQuestionHeading"><h2>Question {current+1}</h2><p>{question?.text || "No question has been created for this position yet."}</p></div>



        <div className="viewerAnswerList">{question?.options.map((option,i) => {const selected=answers[current]===i;return <button key={i} type="button" aria-pressed={selected} className={`viewerAnswer ${selected?"isSelected":""}`} onClick={()=>setAnswers(old=>({...old,[current]:i}))}><span className="viewerAnswerRadio" aria-hidden="true"/><span>{String.fromCharCode(65+i)}. {option}</span></button>;})}</div>



        {showHint && <section className="viewerHintBox"><button type="button" className="viewerHintToggle" aria-expanded={hintOpen} onClick={()=>setHintOpen(s=>!s)}><span className="viewerHintTitle"><span className="viewerHintIcon"><Icon name="idea.svg" size={25}/></span>Hint</span><span className="viewerHintEye"><Icon name={hintOpen ? "eye-off.svg" : "view.svg"} size={20}/></span></button>{hintOpen && <p>{question?.hint}</p>}</section>}



        <div className="viewerQuestionSettings"><div><label>Bloom’s Taxonomy</label><span className="viewerBloomValue">{question?.bloom||"Not specified"}</span></div><button type="button" className={`viewerFlagButton ${flagged.includes(current)?"isFlagged":""}`} onClick={toggleFlag}><Icon name="flag.svg" size={22}/>{flagged.includes(current)?"Remove flag":"Flag for review"}</button></div>



        <div className="viewerExamActions">{current > 0 && <button type="button" className="viewerExamButton" disabled={current===0} onClick={()=>goTo(Math.max(0,current-1))}><Icon name="arrowleft.svg"/>Previous</button>}<button type="button" className="viewerExamButton viewerNext" onClick={()=> current===total-1?setSubmitOpen(true):goTo(Math.min(total-1,current+1))}>{current===total-1?"Submit":"Next"}<Icon name="arrowrightg.svg"/></button></div>



      </section><aside className="viewerExamCard viewerNavigator"><h2>Question Navigator</h2><div className="viewerQuestionTiles">{Array.from({length:total},(_,i)=>{ const state = current===i?"current":flagged.includes(i)?"flagged":answers[i]!==undefined?"answered":skipped.includes(i)?"skipped":"remaining";return <button type="button" key={i} className={`viewerQuestionTile is-${state}`} onClick={()=>goTo(i)} aria-current={current===i?"step":undefined}>{i+1}</button>})}</div>



      <div className="viewerStatusRows"><div><Icon name="checkmark-circle.svg"/><span>Answered</span><strong>{String(answered).padStart(2,"0")}</strong></div><div><span className="viewerRemainingCircle"/><span>Remaining</span><strong>{String(remaining).padStart(2,"0")}</strong></div><div><Icon name="flag.svg"/><span>Flagged</span><strong>{String(flagged.length).padStart(2,"0")}</strong></div></div><h2 className="viewerToolsHeading">Tools</h2><div className="viewerToolsList"><button type="button" onClick={()=>router.push(`${viewerPath()}/scratch`)}><Icon name="sticky-note.svg"/>Scratch Pad <Icon name="arrowupright.svg" size={18}/></button><button type="button" onClick={()=>router.push(`${viewerPath()}/calculator`)}><Icon name="calculator.svg"/>Calculator <Icon name="arrowup.svg" size={18}/></button><button type="button" onClick={()=>router.push(`${viewerPath()}/formulasheet`)}><Icon name="sigma.svg"/>Formula Sheet <Icon name="arrowupg.svg" size={18}/></button></div>



      {tool && <div className="viewerToolPanel"><div className="viewerToolPanelTop"><strong>{tool==="scratchpad"?"Scratch Pad":tool==="calculator"?"Calculator":"Formula Sheet"}</strong><button type="button" onClick={()=>setTool(null)} aria-label="Close tool">×</button></div>{tool==="scratchpad"?<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Write notes here..." rows={5}/>:tool==="calculator"?<div><input value={calc} onChange={e=>setCalc(e.target.value.replace(/[^0-9+*/(). -]/g,""))} placeholder="Enter arithmetic expression"/><p>{calcResult}</p><button onClick={()=>setCalc("")}>Clear</button></div>:<p>No formula sheet was supplied with the saved assessment.</p>}</div>}</aside></div>}



    </> : <><nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{details.title}</strong></nav><div className="viewerPageHeading"><h1>{details.title}</h1><p>{details.type}</p></div><div className="viewerColumns"><aside className="viewerSummary" aria-label="Assessment summary"><SummaryItem label="Total Questions" value={details.totalQuestions} iconName="list.svg" variant="blue"/><SummaryItem label="Total Marks" value={details.totalMarks} iconName="star-award.svg" variant="orange"/><SummaryItem label="Total Time" value={details.totalTime} iconName="alarm-clock.svg" variant="purple"/><SummaryItem label="Passing Score" value={details.passingScore} iconName="checkmark-circle.svg" variant="green"/><SummaryItem label="Negative Marking" value={details.negativeMarking} iconName="remove-circle.svg" variant="red"/></aside><div className="viewerRightColumn"><section className="viewerInstructions"><h2>Instructions</h2><ol>{details.instructions.map((instruction,index)=><li key={`${index}-${instruction}`}>{index+1}. {instruction}</li>)}</ol></section><section className="viewerConfirmation" aria-label="Confirm instructions"><label className="viewerAgreement"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span className="viewerCheckboxIcon">{accepted && <Icon name="checkmark-square-02.svg" size={20}/>}</span><span>I have read and understood the instructions</span></label><button type="button" className="viewerStart" disabled={!accepted} onClick={()=>{setStarted(true);setCurrent(0);setHintOpen(false);}}>Start Assessment</button></section></div></div></>}



  {submitOpen && !finished && <div className="viewerSubmitOverlay" role="presentation">

    <section className="viewerSubmitDialog" role="dialog" aria-modal="true" aria-labelledby="viewerSubmitTitle" aria-describedby="viewerSubmitDescription">

      <div className="viewerSubmitNotice">

        <span className="viewerSubmitIcon"><img src="/assets/viewericons/alert.svg" alt="" width={24} height={24}/></span>

        <div className="viewerSubmitNoticeText">

          <h2 id="viewerSubmitTitle">Confirm Submission</h2>

          <p className="viewerSubmitQuestion">Are You Sure You Want to Submit the Assessment ?</p>

          <p id="viewerSubmitDescription" className="viewerSubmitDescription">You have {answered} answered, {remaining} unanswered and {flagged.length} marked for review.<br/>Once submitted, You cannot change your answers</p>

        </div>

      </div>

      <div className="viewerSubmitActions">

        <button type="button" className="viewerSubmitBack" onClick={()=>setSubmitOpen(false)}><img src="/assets/viewericons/arrowleft.svg" alt="" width={20} height={20}/>Go Back</button>

        <button type="button" className="viewerSubmitConfirm" onClick={submitAssessment}>Submit Answers<img src="/assets/viewericons/arrowrightg.svg" alt="" width={20} height={20}/></button>

      </div>

    </section>

  </div>}

  {submittedPopupOpen && <div className="viewerSuccessOverlay" role="presentation">
    <section className={`viewerSuccessDialog viewerSuccessDialog--${resultRelease.mode}`} role="dialog" aria-modal="true" aria-labelledby="viewerSuccessTitle">
      <button type="button" className="viewerSuccessClose" aria-label="Close" onClick={()=>setSubmittedPopupOpen(false)}><img src={`${ICONS}multiplication-sign-square.svg`} alt="" width={16} height={16}/></button>
      <div className="viewerSuccessArt"><img src={`${ICONS}blast.png`} alt="" aria-hidden="true"/><img className="viewerSuccessCheck" src={`${ICONS}checkmark-circle.svg`} alt=""/></div>
      <h2 id="viewerSuccessTitle">Assessment Submitted</h2>
      <h3>{details.title}</h3>
      {resultRelease.mode === "immediate" ? <>
        <p>Your assessment has been submitted. Your result is available now.</p>
        <div className="viewerSuccessStats">
          <div><img className="viewerSuccessStatIcon" src={`${ICONS}award.svg`} alt=""/><span>Score<strong>{total ? Math.round(resultText / (Number(details.totalMarks) || total) * 100) : 0}%</strong></span></div>
          <div><img className="viewerSuccessStatIcon" src={`${ICONS}checkmark-badge.svg`} alt=""/><span>Result<strong>{resultText >= ((Number(details.totalMarks) || total) * (Number.parseFloat(details.passingScore) || 60) / 100) ? "Passed" : "Failed"}</strong></span></div>
        </div>
      </> : <>
        <p>{resultRelease.mode === "scheduled" ? "Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time." : resultRelease.mode === "manual" ? "Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result." : "Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing."}</p>
        <div className={`viewerSuccessReleaseCard viewerSuccessReleaseCard--${resultRelease.mode}`}>
          <img src={`${ICONS}${resultRelease.mode === "scheduled" ? "calendar.svg" : resultRelease.mode === "manual" ? "user.svg" : "eye-off.svg"}`} width={40} height={40} alt="" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/>
          <span className="viewerSuccessReleaseInfo"><strong>{resultRelease.mode === "scheduled" ? "Result Available" : "Status"}</strong><small>{resultRelease.mode === "scheduled" ? resultRelease.releaseDateLabel : resultRelease.mode === "manual" ? "Awaiting result Release" : "Submitted"}</small></span>
        </div>
      </>}
      <div className="viewerSuccessActions">
        <button type="button" onClick={()=>router.push(demoDashboardPath())}>Back to Dashboard</button>
        {resultRelease.mode !== "never" && <button type="button" disabled={resultRelease.mode !== "immediate"} onClick={()=>router.push(resultPath())}>View Result</button>}
      </div>
    </section>
  </div>}
  </div></div></section></div></main>;



}
