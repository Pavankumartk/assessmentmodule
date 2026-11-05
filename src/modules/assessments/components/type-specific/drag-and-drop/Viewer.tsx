"use client";
import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./dragdropviewer.css";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";
import {assessmentStorage, updateAssessment, resultPath} from "@/modules/assessments/storage/assessment-storage";
import ViewerInstructions from "@/modules/assessments/components/viewer/ViewerInstructions";
import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";


// Reuses the same icon sources as the viewer files supplied by the user.
const ICONS = "/assets/viewericons/";
const CONTENT_KEYS = [
  "dragDropContentDraft", "dragdropContentDraft", "drag_dropContentDraft",
  "dragDropQuestionsDraft", "dragdropQuestionsDraft",
];
const DETAILS_KEYS = [
  "dragDropAssessmentDraft", "dragdropAssessmentDraft", "drag_dropAssessmentDraft",
  "dragDropDetailsDraft", "dragdropDetailsDraft",
];
const VIEWER_SESSION_KEY = "dragDropViewerState";

type SavedRecord = Record<string, unknown>;
type DragChoice = {
  id: string;
  text: string;
  kind: "Text" | "Image";
  role: "Correct" | "Distractor";
};
type DragQuestion = {
  text: string;
  items: DragChoice[];
  mapping: Record<string, string>;
  bloom: string;
  hint: string;
  allowHint: boolean;
  showHint: boolean;
  points: number;
  shuffle: boolean;
  allowMove: boolean;
  grading?: "Equal Marks"|"Custom"; zoneMarks?:Record<string,string>; partialCredit?:boolean; negative?:string; minZero?:boolean;
  difficulty?:string; category?:string; explanation?:string;
};
type ViewerDraft = {
  title: string;
  questions: DragQuestion[];
  durationSeconds: number;
  passingScore: string;
  negativeMarking: string;
  instructions: string[];
};
type ZoneAnswers = Record<string, string>;
type ViewerState = {
  signature: string;
  current: number;
  answers: Record<number, ZoneAnswers>;
  flagged: number[];
  skipped: number[];
  expiresAt: number;
  submitted: boolean;
  started?: boolean;
};

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />;
}
function asRecord(value: unknown): SavedRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SavedRecord : null;
}
function readJson(keys: string[]): SavedRecord {
  for (const key of keys) {
    for (const store of [assessmentStorage]) {
      try {
        const value = JSON.parse(store.getItem(key) || "null") as unknown;
        const result = asRecord(value);
        if (result) return result;
      } catch { /* Try another saved draft. */ }
    }
  }
  return {};
}
function firstText(data: SavedRecord, keys: string[], fallback: string): string {
  for (const key of keys) {
    if (typeof data[key] === "string" && (data[key] as string).trim()) {
      return (data[key] as string).trim();
    }
  }
  return fallback;
}
function zoneIds(text: string): string[] {
  return [...new Set([...text.matchAll(/\[\[(\d+)\]\]/g)].map(match => match[1]))];
}
function normalizeChoices(raw: unknown): DragChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value, index): DragChoice[] => {
    const item = asRecord(value);
    if (!item) return [];
    return [{
      id: String(item.id ?? `choice-${index}`),
      text: String(item.text ?? item.label ?? ""),
      kind: item.kind === "Image" ? "Image" : "Text",
      role: item.role === "Wrong" || item.role === "Distractor" ? "Distractor" : "Correct",
    }];
  });
}
function normalizeQuestion(value: unknown): DragQuestion | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const text = firstText(raw, ["text", "question", "questionText"], "");
  if (!text.trim()) return null;
  const items = normalizeChoices(raw.items ?? raw.dragItems ?? raw.choices);
  const originalMapping = asRecord(raw.mapping) ?? {};
  const mapping: Record<string, string> = {};
  for (const zone of zoneIds(text)) {
    const saved = originalMapping[zone] ?? originalMapping[`[[${zone}]]`];
    const str = saved == null ? "" : String(saved);
    const match = items.find(item => item.id === str || item.text === str);
    if (match) mapping[zone] = match.id;
  }
  const points = Number(raw.points ?? raw.marks ?? 1);
  return {
    text,
    items,
    mapping,
    bloom: firstText(raw, ["bloom", "bloomTaxonomy", "bloomLevel"], ""),
    hint: firstText(raw, ["hint", "hintText"], ""),
    allowHint: raw.allowHint !== false,
    showHint: raw.showHint === true,
    points: Number.isFinite(points) && points > 0 ? points : 1,
    shuffle: raw.shuffle === true,
    allowMove: raw.allowMove !== false,
    grading: raw.grading==="Custom"?"Custom":"Equal Marks",
    zoneMarks: asRecord(raw.zoneMarks) as Record<string,string> || {},
    partialCredit:raw.partialCredit !== false,
    negative:String(raw.negative??"NA"),minZero:raw.minZero !== false,
    difficulty:firstText(raw,["difficulty"],""),category:firstText(raw,["category"],""),
    explanation:firstText(raw,["explanation"],""),
  };
}

// A single reference question is used only when no creator draft exists.
// All saved creator questions replace it automatically.
const REFERENCE_QUESTION: DragQuestion = {
  text: "A neural network uses an [[1]] Function to add non - linearity a [[2]] Function to measure error, a [[3]] term to shift output and [[4]] to reduce overfitting.",
  items: [
    { id: "activation", text: "Activation", kind: "Text", role: "Correct" },
    { id: "bias", text: "Bias", kind: "Text", role: "Correct" },
    { id: "loss", text: "Loss", kind: "Text", role: "Correct" },
    { id: "dropout", text: "Dropout", kind: "Text", role: "Correct" },
    { id: "soft-max", text: "Soft max", kind: "Text", role: "Distractor" },
  ],
  mapping: { "1": "activation", "2": "loss", "3": "bias", "4": "dropout" },
  bloom: "Analyse",
  hint: "ReLU and sigmoid are examples.",
  allowHint: true,
  showHint: true,
  points: 4,
  shuffle: false,
  allowMove: true,
};
const REFERENCE_VIEWER: ViewerDraft = {
  title: "Introduction to Artificial Intelligence",
  questions: [],
  durationSeconds: 60 * 60,
  passingScore: "60%",
  negativeMarking: "As configured",
  instructions: ["Drag each item to the correct drop zone", "On mobile, select an item then tap a zone", "You can flag questions to review later", "Submit answers when finished"],
};
function durationToSeconds(details: SavedRecord): number {
  const raw = details.duration ?? details.timeLimit ?? details.totalTime ?? details.time;
  const number = Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(number) && number > 0
    ? Math.round(number * (/hour/i.test(String(raw)) ? 3600 : 60))
    : 60 * 60;
}
function loadViewerDraft(): ViewerDraft {
  const content = readJson(CONTENT_KEYS);
  const details = readJson(DETAILS_KEYS);
  const stored = Array.isArray(content.questions) ? content.questions
    : Array.isArray(content.items) ? content.items : [];
  const questions = stored.map(normalizeQuestion).filter((q): q is DragQuestion => q !== null);
  if (!questions.length) return {...REFERENCE_VIEWER, title: firstText(details, ["assessmentTitle", "assessmentName", "title", "name"], "Drag & Drop")};
  const creatorInstructions = creatorInstructionLines(details.instructions, details.descriptionInstructions);
  return {
    title: firstText(details, ["assessmentTitle", "assessmentName", "title", "name"], "Drag & Drop"),
    questions,
    durationSeconds: durationToSeconds(details),
    passingScore: firstText(details,["passingScore","gradeToPass"],"60%"),
    negativeMarking: firstText(details,["negativeMarkingValue","negativeMarking"],"As configured"),
    instructions: creatorInstructions.length ? creatorInstructions : REFERENCE_VIEWER.instructions,
  };
}
function formatTime(seconds: number): [string, string, string] {
  const safe = Math.max(0, Math.floor(seconds));
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60]
    .map(value => String(value).padStart(2, "0")) as [string, string, string];
}
function Stopwatch({ seconds }: { seconds: number }) {
  const parts = formatTime(seconds);
  return <div className="dragvExamClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((part, index) => <span className="dragvTimeGroup" key={index}>
      {index > 0 && <span className="dragvTimeColon">:</span>}
      {part.split("").map((digit, i) => <span className="dragvTimeDigit" key={i}>{digit}</span>)}
    </span>)}
  </div>;
}
function questionIsAnswered(question: DragQuestion | undefined, answers: ZoneAnswers): boolean {
  if (!question) return false;
  const zones = zoneIds(question.text);
  return zones.length > 0 && zones.every(zone =>
    question.items.some(item => item.id === answers[zone]));
}
function choiceLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export default function DragDropViewerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ViewerDraft>(REFERENCE_VIEWER);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, ZoneAnswers>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hintOpen, setHintOpen] = useState(true);
  const [focusedZone, setFocusedZone] = useState<string | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submittedPopupOpen, setSubmittedPopupOpen] = useState(false);
  const [resultScore, setResultScore] = useState(0);
  const [releaseMode, setReleaseMode] = useState<"immediate"|"scheduled"|"manual"|"never">("immediate");
  const [releaseDateLabel, setReleaseDateLabel] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const signature = `${draft.title}|${draft.questions.length}|${draft.questions.map(q => q.text).join("|")}`;
  useEffect(() => {
    const loaded = loadViewerDraft();
    const loadedSignature = `${loaded.title}|${loaded.questions.length}|${loaded.questions.map(q => q.text).join("|")}`;
    const time = Date.now();
    setDraft(loaded);
    setNow(time);
    let saved: Partial<ViewerState> = {};
    try { saved = JSON.parse(assessmentStorage.getItem(VIEWER_SESSION_KEY) || "{}") as Partial<ViewerState>; }
    catch { /* Open a new attempt. */ }
    if (saved.signature === loadedSignature && !saved.submitted) {
      setCurrent(Math.min(Math.max(Number(saved.current) || 0, 0), Math.max(0, loaded.questions.length - 1)));
      setAnswers(saved.answers ?? {});
      setFlagged(Array.isArray(saved.flagged) ? saved.flagged : []);
      setSkipped(Array.isArray(saved.skipped) ? saved.skipped : []);
      setExpiresAt(saved.expiresAt || 0);
      setStarted(Boolean(saved.started));
    } else {
      setAnswers({});
      setCurrent(0);
      setFlagged([]);
      setSkipped([]);
      setExpiresAt(0);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || submitted || !started) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready, submitted, started]);

  useEffect(()=>{
    try {
      const evalData = JSON.parse(assessmentStorage.getItem("dragDropEvaluationDraft")||"{}");
      const settings = evalData.dropdownSettings || evalData;
      const choice=String(settings.reviewAvailability||settings.resultAvailable||settings.resultAvailability||"Immediately").toLowerCase();
      const mode = choice.includes("never")?"never":choice.includes("schedul")?"scheduled":choice.includes("manual")||choice.includes("grad")?"manual":"immediate";
      setReleaseMode(mode);
      setReleaseDateLabel(String(settings.resultReleaseDate||settings.scheduledReleaseDate||"Release date to be announced"));
    }catch{}
  },[]);

  const questions = draft.questions;
  const question = questions[current];
  const total = questions.length;
  const zones = useMemo(() => zoneIds(question?.text || ""), [question?.text]);
  const placements = answers[current] ?? {};
  const displayedChoices = useMemo(() => {
    if (!question) return [];
    const original = question.items.map((item, index) => ({ item, index }));
    if (!question.shuffle) return original;
    // Stable shuffle avoids changing the order whenever a learner clicks a choice.
    return original.sort((a, b) =>
      ((a.item.id.length * 11 + a.index * 17 + current * 13) % 97) -
      ((b.item.id.length * 11 + b.index * 17 + current * 13) % 97));
  }, [question, current]);
  const answered = questions.filter((q, index) => questionIsAnswered(q, answers[index] ?? {})).length;
  const remaining = Math.max(0, total - answered);
  const progress = total ? Math.round(answered / total * 100) : 0;
  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : draft.durationSeconds;

  useEffect(() => {
    if (!ready) return;
    const saved: ViewerState & {started:boolean} = { signature, current, answers, flagged, skipped, expiresAt, submitted, started };
    try { assessmentStorage.setItem(VIEWER_SESSION_KEY, JSON.stringify(saved)); }
    catch { /* Keep working if browser storage is unavailable. */ }
  }, [ready, signature, current, answers, flagged, skipped, expiresAt, submitted, started]);

  useEffect(() => {
    if (ready && started && expiresAt && secondsLeft <= 0 && !submitted) {
      submitAssessment();
    }
  }, [ready, expiresAt, secondsLeft, submitted]);

  const setQuestionPlacements = (change: (old: ZoneAnswers) => ZoneAnswers) => {
    setAnswers(old => ({ ...old, [current]: change(old[current] || {}) }));
    setSkipped(old => old.filter(index => index !== current));
    setNotice("");
  };
  const placeChoice = (id: string, requestedZone?: string) => {
    if (submitted || !question || !question.items.some(item => item.id === id)) return;
    const matchingZone = zones.find(zone => placements[zone] === id);
    if (matchingZone && !requestedZone) {
      if (!question.allowMove) return;
      setQuestionPlacements(old => {
        const next = { ...old };
        delete next[matchingZone];
        return next;
      });
      setPendingChoice(null);
      return;
    }
    const targetZone = requestedZone || focusedZone || zones.find(zone => !placements[zone]);
    if (!targetZone) {
      setPendingChoice(id);
      setNotice("Select a filled blank to change its answer.");
      return;
    }
    if (placements[targetZone] && !question.allowMove) {
      setNotice("This question does not allow changing a filled blank.");
      return;
    }
    setQuestionPlacements(old => {
      const next = { ...old };
      for (const zone of zones) if (next[zone] === id) delete next[zone];
      next[targetZone] = id;
      return next;
    });
    setFocusedZone(null);
    setPendingChoice(null);
  };
  const clickZone = (zone: string) => {
    if (submitted) return;
    if (pendingChoice) {
      placeChoice(pendingChoice, zone);
      return;
    }
    if (placements[zone] && question?.allowMove) {
      setQuestionPlacements(old => {
        const next = { ...old };
        delete next[zone];
        return next;
      });
    }
    setFocusedZone(zone);
  };
  const goTo = (index: number) => {
    if (index < 0 || index >= total || index === current) return;
    if (!questionIsAnswered(question, placements)) {
      setSkipped(old => old.includes(current) ? old : [...old, current]);
    }
    setCurrent(index);
    setHintOpen(true);
    setFocusedZone(null);
    setPendingChoice(null);
    setNotice("");
  };
  const toggleFlag = () => {
    if (submitted) return;
    setFlagged(old => old.includes(current) ? old.filter(index => index !== current) : [...old, current]);
  };
  const submitAssessment = () => {
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    if(submitted) return;
    const scored = questions.map((q, index) => {
      const zones = zoneIds(q.text);
      const chosen = answers[index] || {};
      const matched = zones.filter(z => Boolean(chosen[z]) && chosen[z] === q.mapping[z]);
      const earnedRaw = matched.reduce((sum,z)=>sum + (q.zoneMarks?.[z] !== undefined && q.grading === "Custom" ? Number(q.zoneMarks[z])||0 : q.points/Math.max(1,zones.length)),0);
      const baseEarned = q.partialCredit === false && matched.length!==zones.length ? 0 : earnedRaw;
      const penalties = Number(q.negative) || 0;
      const earned = Math.min(q.points,q.minZero === false ? baseEarned-(zones.length-matched.length)*penalties : Math.max(0,baseEarned-(zones.length-matched.length)*penalties));
      return {q, zones, chosen, matched, earned:Math.max(0,earned)};
    });
    const totalMarks=questions.reduce((sum,q)=>sum+q.points,0);
    const earnedMarks=scored.reduce((sum,entry)=>sum+entry.earned,0);
    const result = {
      attemptId:crypto.randomUUID(), submittedAt:new Date().toISOString(), title:draft.title, assessmentType:"drag-and-drop" as const,
      totalQuestions:questions.length,totalMarks,earnedMarks,
      scorePercent:totalMarks>0?Math.round(earnedMarks/totalMarks*100):0,
      correctAnswers:scored.filter(s=>s.zones.length>0&&s.matched.length===s.zones.length).length,
      unanswered:scored.filter(s=>s.zones.every(z=>!s.chosen[z])).length,
      incorrectAnswers:scored.filter(s=>s.zones.some(z=>s.chosen[z])&&s.matched.length!==s.zones.length).length,
      usedSeconds:Math.max(0,draft.durationSeconds-secondsLeft),totalSeconds:draft.durationSeconds,
      flaggedQuestionIndexes:flagged,flagged,
      questions:scored.map(({q,zones,chosen,matched,earned})=>({
        text:q.text.replace(/\[\[(\d+)\]\]/g, "[Drop zone $1]"),
        options:[],correct:-1,selected:null,points:q.points,
        answerText:zones.map(z=>`Zone ${z}: ${q.items.find(item=>item.id===chosen[z])?.text||"Not answered"}`).join(" · "),
        expectedAnswer:zones.map(z=>`Zone ${z}: ${q.items.find(item=>item.id===q.mapping[z])?.text||"Not mapped"}`).join(" · "),
        gradingStatus: zones.every(z=>!chosen[z])?"unanswered":matched.length===zones.length?"correct":"incorrect",
        questionType:"drag-and-drop" as const, bloom:q.bloom,hint:q.hint,
        explanation:q.explanation, optionExplanations:[], difficulty:q.difficulty,topic:q.category,
        skill:`${matched.length}/${zones.length} drop zones correct · ${earned.toFixed(2)} / ${q.points} points`,
        flagged:flagged.includes(scored.findIndex(s=>s.q===q))
      }))
    };
    const preview = new URLSearchParams(window.location.search).get("preview")==="true";
    if(!preview){
      try {
        assessmentStorage.setItem("dragDropViewerResult",JSON.stringify(result));
        assessmentStorage.setItem("viewerAssessmentResult",JSON.stringify(result));
        const previous=JSON.parse(assessmentStorage.getItem("viewerAttempts")||"[]");
        const attempts=[...(Array.isArray(previous)?previous:[]),result];
        assessmentStorage.setItem("viewerAttempts",JSON.stringify(attempts));
        updateAssessment({attemptCount:nextAttemptCount(attempts.length)});
      } catch { /* Saved draft remains available even when storage quota is full. */ }
    }
    setResultScore(result.scorePercent);setSubmitOpen(false);setSubmitted(true);
    setSubmittedPopupOpen(!preview);
  };
  const submit = () => { if(!submitted) setSubmitOpen(true); };
  const renderQuestion = () => (question?.text || "").split(/(\[\[\d+\]\])/g).map((part, index) => {
    const match = part.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={`text-${index}`}>{part}</span>;
    const zone = match[1];
    const chosen = question?.items.find(item => item.id === placements[zone]);
    return <button type="button" key={`zone-${zone}-${index}`}
      className={`dragvDDZone ${chosen ? "is-filled" : ""} ${focusedZone === zone ? "is-focused" : ""}`}
      aria-label={`Blank ${zone}${chosen ? `: ${chosen.text}` : ": empty"}`}
      disabled={submitted} onClick={() => clickZone(zone)}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) placeChoice(id, zone); }}>
      {chosen ? (chosen.kind === "Image" && chosen.text.startsWith("/") ? <img className="dragvDDImageChoice" src={chosen.text} alt={`Choice ${zone}`} /> : chosen.text) : "Drop here"}
    </button>;
  });

  return <main className="superAdminPage institutionAdminPage dragvAppShell viewDragDropApp viewerAppShell">
    <div className="dashboardLayout dragvLayout">
      <Sidebar />
      <section className="mainContent dragvMain">
        <div className="dragvSharedHeader"><Header /></div>
        <div className="institutionScrollArea dragvScroll">
          <div className="pageContent institutionPageContent dragvContent">
            {!started ? <>
              <nav className="dragvBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{draft.title}</strong></nav>
              <div className="dragvPageHeading"><h1>{draft.title}</h1><p>Drag &amp; Drop</p></div>
              <ViewerInstructions details={{totalQuestions:String(total),totalMarks:String(questions.reduce((sum,q)=>sum+q.points,0)),totalTime:`${Math.round(draft.durationSeconds/60)} Minutes`,passingScore:draft.passingScore,negativeMarking:draft.negativeMarking,instructions:draft.instructions}} accepted={accepted} onAcceptedChange={setAccepted} onStart={()=>{setStarted(true);setCurrent(0);setExpiresAt(previous=>previous || Date.now()+draft.durationSeconds*1000);setNow(Date.now());}} canStart={questions.length>0} unavailableMessage="No saved Drag & Drop questions are available for this assessment."/>
            </> : <>
            <div className="dragvExamTop">
              <nav className="dragvBreadcrumb" aria-label="Breadcrumb">
                <Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20} />
                <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" size={20} />
                <strong>{draft.title}</strong>
              </nav>
              <Stopwatch seconds={secondsLeft} />
            </div>
            <div className="dragvPageHeading dragvExamHeading"><h1>{draft.title}</h1></div>
            <div className="dragvExamGrid">
              <section className="dragvExamCard dragvQuestionCard" aria-label="Assessment question">
                <div className="dragvProgressArea">
                  <div className="dragvProgressLabel">
                    <strong>{total ? current + 1 : 0}<span>/{total}</span></strong>
                    <strong className="dragvMarks">{question?.points ?? 0} Marks</strong>
                  </div>
                  <div className="dragvProgressRow">
                    <div className="dragvProgressTrack"><span style={{ width: `${progress}%` }} /></div>
                    <strong>{progress}%</strong>
                  </div>
                </div>

                {question ? <>
                  <div className="dragvQuestionHeading">
                    <h2>Question {current + 1}</h2>
                    <p className="dragvDDInstruction">Drag Each item in to correct Blank</p>
                  </div>
                  <div className="dragvDDQuestionText">{renderQuestion()}</div>
                  <section className="dragvDDItemsSection" aria-label="Drag Items">
                    <h3 className="dragvDDItemsTitle">Drag Items</h3>
                    <div className="dragvDDItemsList">
                      {displayedChoices.map(({ item, index }) => {
                        const selected = Object.values(placements).includes(item.id);
                        return <button type="button" key={item.id}
                          className={`dragvAnswer dragvDDOption ${selected ? "isSelected" : ""} ${pendingChoice === item.id ? "isPending" : ""}`}
                          aria-pressed={selected} disabled={submitted}
                          draggable={!submitted}
                          onDragStart={event => event.dataTransfer.setData("text/plain", item.id)}
                          onClick={() => placeChoice(item.id)}>
                          <span className="dragvAnswerRadio" aria-hidden="true">
                            {selected && <img
                              src={`${ICONS}checkmark-circle-02.svg`}
                              width={16}
                              height={16}
                              alt=""
                              className="dragvDDSelectedCheckIcon"
                              onError={event => { event.currentTarget.style.display = "none"; }}
                            />}
                          </span>
                          <span className="dragvDDOptionText">{choiceLabel(index)}. {item.kind === "Image" && item.text.startsWith("/") ? <img src={item.text} className="dragvDDImageChoice" alt={`Option ${choiceLabel(index)}`} /> : item.text}</span>
                        </button>;
                      })}
                    </div>
                  </section>
                  {question.hint && (question.allowHint || question.showHint) && <section className="dragvHintBox">
                    <button type="button" className="dragvHintToggle" aria-expanded={hintOpen}
                      aria-label={hintOpen ? "Hide hint" : "Show hint"} onClick={() => setHintOpen(value => !value)}>
                      <span className="dragvHintTitle">
                        <span className="dragvHintIcon"><Icon name="idea.svg" size={25} /></span>
                        <span>Hint{hintOpen && <small>{question.hint}</small>}</span>
                      </span>
                      <span className="dragvHintEye"><Icon name={hintOpen ? "view.svg" : "eye-off.svg"} size={20} /></span>
                    </button>
                  </section>}
                  <div className="dragvQuestionSettings">
                    <div><label>Bloom’s Taxonomy</label><span className="dragvBloomValue">{question.bloom || "Not specified"}</span></div>
                    <button type="button" className={`dragvFlagButton ${flagged.includes(current) ? "isFlagged" : ""}`}
                      disabled={submitted} onClick={toggleFlag}>
                      <Icon name="flag.svg" size={22} />{flagged.includes(current) ? "Remove flag" : "Flag for review"}
                    </button>
                  </div>
                  {notice && <p className="dragvInlineNotice" role="status">{notice}</p>}
                  <div className="dragvExamActions">
                    {current > 0 && <button type="button" className="dragvExamButton" disabled={current === 0}
                      onClick={() => goTo(current - 1)}><Icon name="arrowleft.svg" />Previous</button>}
                    <button type="button" className="dragvExamButton dragvNext" disabled={submitted}
                      onClick={() => current === total - 1 ? submit() : goTo(current + 1)}>
                      {current === total - 1 ? "Submit" : "Next"}<Icon name="arrowrightg.svg" />
                    </button>
                  </div>
                </> : <p className="dragvInlineNotice">No saved questions were found in this assessment.</p>}
              </section>

              <aside className="dragvExamCard dragvNavigator">
                <h2>Question Navigator</h2>
                <div className="dragvQuestionTiles" aria-label="Choose question">
                  {questions.map((q, index) => {
                    const status = index === current ? "current" : flagged.includes(index) ? "flagged"
                      : questionIsAnswered(q, answers[index] || {}) ? "answered" : skipped.includes(index) ? "skipped" : "remaining";
                    return <button key={index} type="button" className={`dragvQuestionTile is-${status}`}
                      aria-label={`Question ${index + 1}${flagged.includes(index) ? ", flagged" : ""}`}
                      aria-current={index === current ? "step" : undefined}
                      onClick={() => goTo(index)}>{index + 1}</button>;
                  })}
                </div>
                <div className="dragvStatusRows">
                  <div><Icon name="checkmark-circle.svg" /><span>Answered</span><strong>{String(answered).padStart(2, "0")}</strong></div>
                  <div><span className="dragvRemainingCircle" /><span>Remaining</span><strong>{String(remaining).padStart(2, "0")}</strong></div>
                  <div><Icon name="flag.svg" /><span>Flagged</span><strong>{String(flagged.length).padStart(2, "0")}</strong></div>
                </div>
                <h2 className="dragvToolsHeading">Tools</h2>
                <div className="dragvToolsList">
                  <button type="button" onClick={() => router.push("/scratch")}><Icon name="sticky-note.svg" />Scratch Pad<Icon name="arrowupright.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push("/calculator")}><Icon name="calculator.svg" />Calculator<Icon name="arrowup.svg" size={18} /></button>
                  <button type="button" onClick={() => router.push("/formulasheet")}><Icon name="sigma.svg" />Formula Sheet<Icon name="arrowupg.svg" size={18} /></button>
                </div>
              </aside>
            </div>
            </>}
          </div>
        </div>
      </section>
    </div>

      {submitOpen && !submitted && <div className="viewerSubmitOverlay" role="presentation"><section className="viewerSubmitDialog" role="dialog" aria-modal="true" aria-labelledby="ddSubmitTitle" aria-describedby="ddSubmitDescription"><div className="viewerSubmitNotice"><span className="viewerSubmitIcon"><img src="/assets/viewericons/alert.svg" alt="" width={24} height={24}/></span><div className="viewerSubmitNoticeText"><h2 id="ddSubmitTitle">Confirm Submission</h2><p className="viewerSubmitQuestion">Are You Sure You Want to Submit the Assessment ?</p><p id="ddSubmitDescription" className="viewerSubmitDescription">You have {answered} answered, {remaining} unanswered and {flagged.length} marked for review. Once submitted, You cannot change your answers.</p></div></div><div className="viewerSubmitActions"><button type="button" className="viewerSubmitBack" onClick={()=>setSubmitOpen(false)}><img src="/assets/viewericons/arrowleft.svg" alt="" width={20} height={20}/>Go Back</button><button type="button" className="viewerSubmitConfirm" onClick={submitAssessment}>Submit Answers<img src="/assets/viewericons/arrowrightg.svg" alt="" width={20} height={20}/></button></div></section></div>}
      {submittedPopupOpen && <div className="viewerSuccessOverlay" role="presentation"><section className={`viewerSuccessDialog viewerSuccessDialog--${releaseMode}`} role="dialog" aria-modal="true" aria-labelledby="ddSuccessTitle"><button type="button" className="viewerSuccessClose" aria-label="Close" onClick={()=>setSubmittedPopupOpen(false)}><img src={`${ICONS}multiplication-sign-square.svg`} width={16} height={16} alt=""/></button><div className="viewerSuccessArt"><img src={`${ICONS}blast.png`} alt="" aria-hidden="true"/><img className="viewerSuccessCheck" src={`${ICONS}checkmark-circle.svg`} alt=""/></div><h2 id="ddSuccessTitle">Assessment Submitted</h2><h3>{draft.title}</h3>{releaseMode==="immediate"?<><p>Your assessment has been submitted. Your result is available now.</p><div className="viewerSuccessStats"><div><img className="viewerSuccessStatIcon" src={`${ICONS}award.svg`} alt=""/><span>Score<strong>{resultScore}%</strong></span></div><div><img className="viewerSuccessStatIcon" src={`${ICONS}checkmark-badge.svg`} alt=""/><span>Result<strong>{resultScore >= (Number.parseFloat(draft.passingScore)||60)?"Passed":"Failed"}</strong></span></div></div></>:<><p>{releaseMode==="scheduled"?"Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time.":releaseMode==="manual"?"Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result.":"Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing."}</p><div className={`viewerSuccessReleaseCard viewerSuccessReleaseCard--${releaseMode}`}><img src={`${ICONS}${releaseMode==="scheduled"?"calendarb.svg":releaseMode==="manual"?"userblue.svg":"eye-off.svg"}`} width={40} height={40} alt=""/><span className="viewerSuccessReleaseInfo"><strong>{releaseMode==="scheduled"?"Result Available":"Status"}</strong><small>{releaseMode==="scheduled"?releaseDateLabel:releaseMode==="manual"?"Awaiting result release":"Submitted"}</small></span></div></>}<div className="viewerSuccessActions"><button type="button" onClick={()=>router.push(demoDashboardPath())}>Back to Dashboard</button>{releaseMode!=="never"&&<button type="button" disabled={releaseMode!=="immediate"} onClick={()=>router.push(resultPath())}>View Result</button>}</div></section></div>}
  </main>;
}
