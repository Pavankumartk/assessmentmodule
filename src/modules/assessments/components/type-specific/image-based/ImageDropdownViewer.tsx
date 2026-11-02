"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import { getAssessment } from "@/modules/assessments/storage/assessment-storage";
import "./image-labeling-viewer.css";
import "./image-dropdown-viewer.css";

type Plain = Record<string, unknown>;
type LabelPoint = { id: string; text: string; x: number; y: number; options: string[] };
type LabelQuestion = { id: string; title: string; image: string; points: LabelPoint[]; options: string[]; hint: string; bloom: string; marks: number };
type Data = { title: string; minutes: number; questions: LabelQuestion[] };
type Step = "test" | "confirm" | "submitted" | "results";
type Saved = { answers: Record<string, string>; flagged: string[]; current: number; endAt: number; step: Step };
const ICON_BASE = "/assets/viewericons/";
const asObj = (v: unknown): Plain => v && typeof v === "object" && !Array.isArray(v) ? v as Plain : {};
const asArray = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const val = (...x: unknown[]) => x.find(v => typeof v === "string" && v.trim()) as string | undefined;
const num = (v: unknown, fallback: number) => typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
const safeList = (v: unknown): string[] => asArray(v).map(x => typeof x === "string" ? x : val(asObj(x).label, asObj(x).text, asObj(x).value, asObj(x).name) || "").filter(Boolean);
function percentage(v: unknown, fallback: number) {
  if (typeof v === "string" && v.includes("%")) return Math.max(0, Math.min(100, num(v.replace("%", ""), fallback)));
  const n = num(v, fallback);
  return Math.max(0, Math.min(100, n >= 0 && n <= 1 ? n * 100 : n));
}
function parseUnknown(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}
function findQuestions(record: Plain, assessmentId: string): unknown[] {
  const source = [record, asObj(parseUnknown(record.content)), asObj(parseUnknown(record.data)), asObj(parseUnknown(record.draft)), asObj(parseUnknown(record.payload)), asObj(parseUnknown(record.config))];
  for (const item of source) {
    const variants = [item.dropdownQuestions, item.imageDropdownQuestions, item.questions, item.items, asObj(item.content).dropdownQuestions, asObj(item.content).questions, asObj(item.data).dropdownQuestions, asObj(item.data).questions];
    for (const candidate of variants) if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  // Retain compatibility with image-labeling creator drafts, but never read drafts of other assessment types.
  const draftKeys = ["imageDropdownContentDraft", "imageDropdownQuestionsDraft", "imageDropdownQuestions", "imageDropdownDraft", "imageDropdownContent", "imageDropdownAssessmentDraft"];
  for (const key of draftKeys) {
    try {
      const d = parseUnknown(localStorage.getItem(key));
      if (!d) continue;
      const object = asObj(d);
      const owner = val(object.assessmentId, object.id);
      if (owner && owner !== assessmentId) continue;
      for (const entry of [d, object.questions, object.items, asObj(object.content).questions]) if (Array.isArray(entry) && entry.length) return entry;
    } catch { /* Local storage may be inaccessible. */ }
  }
  return [];
}
function toData(record: Plain, assessmentId: string): Data {
  const details = asObj(parseUnknown(record.details));
  const fallbackTitle = val(record.title, record.name, details.assessmentName, details.title) || "Image Dropdown Assessment";
  const minutes = Math.max(1, num(details.durationMinutes ?? details.duration ?? record.durationMinutes ?? record.duration, 20));
  const questions = findQuestions(record, assessmentId).map((raw, i): LabelQuestion => {
    const q = asObj(raw);
    const sourceImage = asObj(q.image);
    const image = val(q.imageUrl, q.imageSrc, q.imageDataUrl, q.imageURL, q.mediaUrl, q.backgroundImage, sourceImage.url, sourceImage.src, typeof q.image === "string" ? q.image : null, asObj(q.media).src) || "";
    const sourcePoints = [q.dropdowns, q.dropdownPoints, q.dropdownSlots, q.dropDowns, q.slots, q.blanks, q.selectors, q.choicesOnImage, q.points, q.markers].find(Array.isArray);
    const original = asArray(sourcePoints);
    const globalOptions = safeList(q.dropdownOptions ?? q.options ?? q.availableOptions ?? q.words ?? q.answerOptions ?? q.labels);
    const points = original.map((rawPoint, j): LabelPoint => {
      const p = asObj(rawPoint);
      const optionList = safeList(p.options ?? p.choices ?? p.dropdownOptions ?? p.labelOptions);
      return {
        id: String(p.id ?? p.key ?? j + 1),
        text: val(p.correctOption, p.correctAnswer, p.correctLabel, p.answer, p.label, p.text, p.name, p.value) || "",
        x: percentage(p.x ?? p.left ?? p.positionX ?? asObj(p.position).x ?? asObj(p.position).left, 18 + j * 19),
        y: percentage(p.y ?? p.top ?? p.positionY ?? asObj(p.position).y ?? asObj(p.position).top, 28 + (j % 3) * 25),
        options: optionList,
      };
    });
    const options = [...new Set([...globalOptions, ...points.flatMap(p => [p.text, ...p.options])].filter(Boolean))];
    return {
      id: String(q.id ?? q.questionId ?? i + 1),
      title: val(q.question, q.prompt, q.questionText, q.text, q.title, q.description) || "Choose the correct word from each dropdown on the picture.",
      image, points, options,
      hint: val(q.hint, q.hintText, q.clue) || "",
      bloom: val(q.bloom, q.bloomLevel, q.taxonomy) || "Understand",
      marks: Math.max(1, num(q.marks ?? q.pointsAwarded ?? q.score, points.length || 1)),
    };
  });
  return { title: fallbackTitle, minutes, questions };
}
function Clock({ seconds }: { seconds: number }) {
  const h = Math.floor(Math.max(0, seconds) / 3600);
  const m = Math.floor((Math.max(0, seconds) % 3600) / 60);
  const s = Math.max(0, seconds) % 60;
  return <div className="ilvClock" aria-label="Time remaining"><span>{String(h).padStart(2,"0")}</span><b>:</b><span>{String(m).padStart(2,"0")}</span><b>:</b><span>{String(s).padStart(2,"0")}</span></div>;
}
function Icon({ file, fallback }: { file: string; fallback: string }) {
  const [missing, setMissing] = useState(false);
  return missing ? <span aria-hidden="true">{fallback}</span> : <img alt="" aria-hidden="true" src={`${ICON_BASE}${file}`} width={20} height={20} onError={() => setMissing(true)} />;
}
export default function ImageDropdownViewer() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const id = params?.assessmentId || "";
  const [data, setData] = useState<Data | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [step, setStep] = useState<Step>("test");
  const [endAt, setEndAt] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [hintOpen, setHintOpen] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const storageKey = `neurolxp.imageDropdown.viewer.${id}`;
  useEffect(() => {
    if (!id) return;
    const record = asObj(getAssessment(id));
    const loaded = toData(record, id);
    setData(loaded);
    const preview = new URLSearchParams(window.location.search).get("preview") === "true";
    let restored: Saved | null = null;
    if (!preview) {
      try { restored = JSON.parse(sessionStorage.getItem(storageKey) || "null") as Saved; } catch { /* Fresh attempt. */ }
    }
    setAnswers(restored?.answers || {});
    setFlagged(restored?.flagged || []);
    setCurrent(restored?.current && restored.current < loaded.questions.length ? restored.current : 0);
    setStep(restored?.step || "test");
    setEndAt(restored?.endAt || Date.now() + loaded.minutes * 60_000);
  }, [id, storageKey]);
  useEffect(() => {
    if (!data) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ answers, flagged, current, step, endAt } satisfies Saved)); } catch { /* Storage disabled. */ }
  }, [answers, flagged, current, step, endAt, data, storageKey]);
  useEffect(() => {
    if (step !== "test") return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  useEffect(() => { if (step === "test" && endAt > 0 && tick >= endAt && data) setStep("submitted"); }, [tick, endAt, data, step]);
  const questions = useMemo(() => data?.questions || [], [data]);
  const q = questions[current];
  const questionAnswered = useCallback((item: LabelQuestion) => item.points.length > 0 && item.points.every(p => Boolean(answers[`${item.id}:${p.id}`])), [answers]);
  const answered = questions.filter(questionAnswered).length;
  const flaggedCount = questions.filter(item => flagged.includes(item.id)).length;
  const remaining = Math.max(0, questions.length - answered);
  const seconds = endAt ? Math.max(0, Math.ceil((endAt - tick) / 1000)) : (data?.minutes || 20) * 60;
  const available = q ? q.points : [];
  const score = useMemo(() => questions.reduce((sum, item) => {
    const hit = item.points.filter(p => p.text && answers[`${item.id}:${p.id}`]?.trim().toLowerCase() === p.text.trim().toLowerCase()).length;
    return sum + (item.points.length ? item.marks * hit / item.points.length : 0);
  }, 0), [answers, questions]);
  const maxScore = questions.reduce((sum, item) => sum + item.marks, 0);
  const retry = () => { setAnswers({}); setCurrent(0); setFlagged([]); setHintOpen(false); setStep("test"); setEndAt(Date.now() + (data?.minutes || 20) * 60_000); };
  const choose = (point: LabelPoint, label: string) => { if (step === "test" && q) setAnswers(prev => ({ ...prev, [`${q.id}:${point.id}`]: label })); };
  if (!data) return <div className="ilvLoading" role="status">Loading Image Dropdown assessment…</div>;
  return <div className="ilvApp idvApp">
    <aside className="ilvSidebar"><Sidebar /></aside>
    <div className="ilvRight"><div className="ilvHeader"><Header /></div>
      <main className="ilvScroll"><div className="ilvBreadcrumb"><span>Dashboard</span><span>Assessment</span><strong>Image Dropdown</strong></div>
        <div className="ilvHeading"><h1>{data.title}</h1><Clock seconds={seconds}/></div>
        {questions.length === 0 ? <section className="ilvEmpty"><h2>No Image Dropdown questions found</h2><p>This assessment has no saved image-dropdown questions. Configure the image and dropdown positions in its creator Content step.</p><button onClick={() => router.push("/learner")}>Back to Assessments</button></section> : step === "results" ? <section className="ilvResult"><h2>Assessment Results</h2><p>{answered} of {questions.length} questions answered</p><strong>{Math.round(score * 100) / 100} / {maxScore} marks</strong><div className="ilvResultActions"><button onClick={retry}>Retry Test</button><button onClick={() => router.push("/learner")}>Continue</button></div><div className="ilvReviewRows">{questions.map((item, i) => <div key={item.id}><b>Question {i + 1}</b><span>{item.title}</span><small>{item.points.filter(p => answers[`${item.id}:${p.id}`]?.toLowerCase() === p.text.toLowerCase()).length} / {item.points.length} dropdown answers correct</small></div>)}</div></section> : step === "submitted" ? <section className="ilvResult"><div className="ilvSuccess">✓</div><h2>Assessment Submitted Successfully</h2><p>Your Image Dropdown assessment has been submitted.</p><div className="ilvResultActions"><button onClick={() => setStep("results")}>View Result</button><button onClick={() => router.push("/learner")}>Continue</button></div></section> : <>
          <div className="ilvGrid">
            <section className="ilvQuestionCard" aria-label="Image Dropdown question">
              <div className="ilvProgressTop"><span>{current + 1}/{questions.length}</span><div className="ilvProgressTrack"><div style={{ width: `${Math.round(answered / questions.length * 100)}%` }}/></div><b>{Math.round(answered / questions.length * 100)}%</b></div>
              <div className="ilvQuestionTitle"><div><span>Question {current + 1}</span><h2>{q.title}</h2></div><strong>{q.marks} Marks</strong></div>
              <div className="ilvImageFrame idvImageFrame">
                {q.image ? <img src={q.image} alt="Image containing selectable answer dropdowns" className="ilvMainImage"/> : <div className="ilvImageMissing">Add the question image in Image Dropdown creator</div>}
                {available.map((point, i) => <label className="idvOnImageSelect" key={point.id} style={{ left: `clamp(80px, ${point.x}%, calc(100% - 80px))`, top: `clamp(24px, ${point.y}%, calc(100% - 24px))` }}><span className="ilvVisuallyHidden">Image dropdown {i + 1}</span><select aria-label={`Choose the answer for image dropdown ${i + 1}`} value={answers[`${q.id}:${point.id}`] || ""} onChange={e => choose(point, e.target.value)}><option value="">Choose...</option>{(point.options.length ? point.options : q.options).map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}
              </div>
              {available.length === 0 && <p className="ilvNoLabels">No dropdown positions were saved for this question.</p>}
              <div className="ilvHintSettings"><div className="ilvHintArea"><div className="ilvHintTitle"><Icon file="idea-01.svg" fallback="✧"/><span>Hint</span></div><button type="button" className="ilvSmallButton" onClick={() => setHintOpen(x => !x)} disabled={!q.hint}><Icon file={hintOpen ? "eye-off.svg" : "view.svg"} fallback="◉"/>{hintOpen ? "Hide" : "Show"}</button>{hintOpen && q.hint && <p>{q.hint}</p>}</div><div className="ilvMeta"><span>Bloom’s Taxonomy</span><b>{q.bloom}</b></div></div>
              <div className="ilvBottom"><button className={`ilvFlag ${flagged.includes(q.id) ? "ilvFlagOn" : ""}`} onClick={() => setFlagged(prev => prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev,q.id])}><Icon file="flag-03.svg" fallback="⚑"/>{flagged.includes(q.id) ? "Flagged" : "Flag for review"}</button><div className="ilvNavigation"><button onClick={() => { setCurrent(x => Math.max(0, x - 1)); setHintOpen(false); }} disabled={current === 0}><Icon file="arrowleft.svg" fallback="←"/>Previous</button><button className="ilvNext" onClick={() => { if (current === questions.length - 1) setStep("confirm"); else { setCurrent(x => x + 1); setHintOpen(false); } }}>{current === questions.length - 1 ? "Submit" : "Next"}<Icon file="arrowright.svg" fallback="→"/></button></div></div>
            </section>
            <aside className="ilvNavigator"><h2>Question Navigator</h2><div className="ilvTiles">{questions.map((item, i) => { const isCurrent = i === current; const complete = questionAnswered(item); return <button key={item.id} title={`Question ${i + 1}`} className={isCurrent ? "ilvActive" : complete ? "ilvComplete" : flagged.includes(item.id) ? "ilvFlaggedTile" : ""} onClick={() => { setCurrent(i); setHintOpen(false); }}>{i + 1}</button>; })}</div><div className="ilvStatus"><div><span>✓ Answered</span><strong>{answered}</strong></div><div><span>◷ Remaining</span><strong>{remaining}</strong></div><div><span>⚑ Flagged</span><strong>{flaggedCount}</strong></div></div><h2 className="ilvToolsHeading">Tools</h2><div className="ilvTools">{[["Scratch pad", "sticky-note-01.svg", "scratch"],["Calculator", "calculator-01.svg", "calculator"],["Formula sheet", "sigma.svg", "formulasheet"]].map(([name, file, route]) => <button key={name} onClick={() => { setShowTools(true); router.push(`/assessments/${id}/viewer/${route}`); }}><Icon file={file} fallback="◩"/>{name}<span aria-hidden="true">↗</span></button>)}</div>{showTools && <span className="ilvVisuallyHidden">Opening viewer tools</span>}</aside>
          </div>
        </>}
      </main>
    </div>
    {step === "confirm" && <div className="ilvOverlay" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="ilvConfirmTitle" className="ilvModal"><h2 id="ilvConfirmTitle">Submit Assessment?</h2><p>Answered {answered} out of {questions.length} questions. {remaining > 0 ? `${remaining} question${remaining === 1 ? " is" : "s are"} still unanswered.` : "All questions are answered."}</p><div><button onClick={() => setStep("test")}>Cancel</button><button className="ilvNext" onClick={() => setStep("submitted")}>Submit Assessment</button></div></div></div>}
  </div>;
}
