"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Header from "@/modules/assessments/components/common/header/Header";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage, getActiveAssessmentId, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import "./ai.css";

const KEY = "aiEvaluationDraft";
const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"] as const;
const CRITERIA = [
  { id: "accuracy", label: "Content Accuracy", color: "#67096E" },
  { id: "understanding", label: "Depth of Understanding", color: "#2D4CC8" },
  { id: "communication", label: "Communication Clarity", color: "#E01E5A" },
  { id: "confidence", label: "Confidence and Fluency", color: "#2A7308" },
  { id: "relevance", label: "Relevance to Question", color: "#63560B" },
] as const;
type CriterionId = typeof CRITERIA[number]["id"];
type Weights = Record<CriterionId, number>;
type Draft = { method: string; passingScore: number | null; weights: Weights; showFeedback: boolean; showRubric: boolean; savedAt?: string };
const emptyWeights = (): Weights => ({ accuracy: 0, understanding: 0, communication: 0, confidence: 0, relevance: 0 });

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const toggle = () => {
    if (!open && trigger.current) {
      const rect = trigger.current.getBoundingClientRect();
      setAbove(window.innerHeight - rect.bottom < 240 && rect.top > 240);
    }
    setOpen(previous => !previous);
  };
  return <div className="aieDropdown" ref={root}>
    <button ref={trigger} type="button" className="aieDropdownTrigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={toggle}>
      <span>{value || `Select ${label.toLowerCase()}`}</span><img className="aieAsset" src="/assets/assessmenticons/arrow-down-01.svg" width={20} height={20} alt="" />
    </button>
    {open && <div className={`aieDropdownOptions${above ? " aieDropdownAbove" : ""}`} role="listbox" aria-label={`${label} options`}>
      {options.map(option => <button type="button" key={option} className="aieDropdownOption" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); trigger.current?.focus(); }}>{option}</button>)}
    </div>}
  </div>;
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (next: boolean) => void }) {
  return <div className="aieSwitchRow"><span>{label}</span><button type="button" role="switch" aria-label={label} aria-checked={on} className={`aieSwitch${on ? " aieSwitchOn" : ""}`} onClick={() => onChange(!on)}><span className="aieSwitchInside"><span className="aieSwitchText">{on ? "ON" : "OFF"}</span></span><span className="aieSwitchKnob" /></button></div>;
}

export default function AIEvaluationPage() {
  const router = useRouter();
  const [assessmentLabel, setAssessmentLabel] = useState("AI Assessment");
  const [method, setMethod] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [weights, setWeights] = useState<Weights>(emptyWeights);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      const record = getAssessment(getActiveAssessmentId() || "");
      if (record?.typeCode === "ai-viva") setAssessmentLabel("AI Viva");
      else if (record) setAssessmentLabel("AI Interview");
      const raw = assessmentStorage.getItem(KEY) || assessmentStorage.getItem("mcqAssessmentEvaluationDraft");
      const saved = raw ? JSON.parse(raw) as Partial<Draft> : {};
      if (typeof saved.method === "string") setMethod(saved.method);
      const score = saved.passingScore == null || String(saved.passingScore).trim() === "" ? NaN : Number(String(saved.passingScore).replace("%", ""));
      if (Number.isFinite(score) && score >= 0 && score <= 100) setPassingScore(`${score}%`);
      if (saved.weights && typeof saved.weights === "object") setWeights(Object.fromEntries(CRITERIA.map(item => {
        const value = Number(saved.weights?.[item.id]);
        return [item.id, Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0];
      })) as Weights);
      if (typeof saved.showFeedback === "boolean") setShowFeedback(saved.showFeedback);
      if (typeof saved.showRubric === "boolean") setShowRubric(saved.showRubric);
    } catch { setMessage("Could not read the saved evaluation settings."); }
    setLoaded(true);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  const draft = (): Draft => ({ method, passingScore: passingScore ? Number.parseInt(passingScore, 10) : null, weights, showFeedback, showRubric });
  useEffect(() => { if (loaded) { try { assessmentStorage.setItem(KEY, JSON.stringify(draft())); } catch { /* The save button reports storage errors. */ } } }, [loaded, method, passingScore, weights, showFeedback, showRubric]);
  const total = CRITERIA.reduce((sum, item) => sum + weights[item.id], 0);
  const save = () => {
    if (saving) return;
    if (!method) { setMessage("Select an evaluation method."); return; }
    if (!passingScore) { setMessage("Select a passing score."); return; }
    if (total !== 100) { setMessage("The rubric weights must add up to 100%."); return; }
    try {
      assessmentStorage.setItem(KEY, JSON.stringify({ ...draft(), savedAt: new Date().toISOString() }));
      setMessage("Successfully saved"); setSaving(true);
      timer.current = setTimeout(() => router.push("/assessments/create/review"), 3000);
    } catch { setMessage("Unable to save the evaluation. Please check browser storage."); }
  };
  return <main className="aieAppShell"><div className="aieLayout"><Sidebar/><section className="aieMainContent"><div className="aieHeader"><Header/></div><div className="aieScrollArea"><div className="aiePageContent">
    <nav className="aieBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><img className="aieAsset" src="/assets/assessmenticons/arrowrightdouble.svg" alt="" width={20} height={20}/><Link href="/assessments/create/content">Create Assessment</Link></nav>
    <ol className="aieWizard" aria-label="Assessment creation steps">{STEPS.map((step,index)=><li key={step} className={`aieWizardStep ${index < 3 ? "aieWizardDone" : index === 3 ? "aieWizardActive" : ""}`} aria-current={index === 3 ? "step" : undefined}><WizardStepLink index={index} current={3}/><span className="aieStepNumber"><span>{index+1}</span></span><span>{step}</span></li>)}</ol>
    <header className="aieTitle"><h1>Assessment Evaluation ({assessmentLabel})</h1><p>Configure the evaluation criteria and learner feedback.</p></header>
    <section className="aiePanel" aria-label="AI evaluation settings">
      <div className="aieTopFields">
        <div className="aieField"><label>Evaluation Method</label><Dropdown label="Evaluation Method" value={method} options={["Manual review", "AI-assisted review"]} onChange={value=>{setMethod(value);setMessage("");}}/></div>
        <div className="aieField"><label>Passing Score</label><Dropdown label="Passing Score" value={passingScore} options={Array.from({length:21},(_,index)=>`${index*5}%`)} onChange={value=>{setPassingScore(value);setMessage("");}}/></div>
      </div>
      <div className="aieRubrics" aria-label="Rubric weights">{CRITERIA.map(item=><div className="aieRubric" key={item.id} style={{"--rubric-color":item.color,"--rubric-fill":`${weights[item.id]}%`} as CSSProperties}><strong className="aieRubricTitle">{item.label}</strong><div className="aieRubricBarLine"><span className="aieRubricTrack"><span className="aieRubricFill"/><input className="aieRubricRange" type="range" min={0} max={100} step={1} value={weights[item.id]} aria-label={`${item.label} weight`} onChange={event=>{setWeights(previous=>({...previous,[item.id]:Number(event.target.value)}));setMessage("");}}/></span><span className="aieRubricPercent">{weights[item.id]}%</span></div></div>)}</div>
      <div className={`aieTotalWeight ${total === 100 ? "aieTotalValid" : "aieTotalInvalid"}`}>Total Weight: {total}%</div>
      <div className="aieSwitches"><Switch label="Show rubric to learners" on={showRubric} onChange={setShowRubric}/><Switch label="Show feedback to learners" on={showFeedback} onChange={setShowFeedback}/></div>
      <p className="aieServiceNote">Automated AI scoring is not connected. Responses remain pending evaluator review.</p>
      {message && message !== "Successfully saved" && <p className="aieError" role="alert">{message}</p>}
    </section>
    <footer className="aieFooter"><button type="button" className="aieFooterButton" disabled={saving} onClick={()=>router.push("/assessments/create/content?edit=1")}>Back</button><div className="aieFooterSaveGroup">{saving && <span className="aieSaveToast" role="status">Successfully saved</span>}<button type="button" className="aieFooterButton aieContinue" disabled={saving || !loaded} onClick={save}>{saving ? "Saving…" : "Save & Continue"}</button></div></footer>
  </div></div></section></div></main>;
}
