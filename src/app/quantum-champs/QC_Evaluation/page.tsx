"use client";
import { quantumStorage as localStorage, quantumSessionStorage as sessionStorage } from "../quantum-storage";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronRight, BarChart3, ShieldCheck, Target,
  RefreshCw, Star, MessageSquareText, Eye, TrendingUp, LockKeyhole,
  Video, AlertTriangle, Check,
} from "lucide-react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./evaluation.css";

type SwitchKey =
  | "awardXp" | "partialXp" | "speedBonus" | "deductXp"
  | "answerFeedback" | "explanation" | "afterQuestion" | "xpBanner"
  | "didYouKnow" | "correctAnswers" | "winnerAnimation"
  | "switching" | "reviewWrong" | "weakness" | "lifelineReport" | "timeline"
  | "secureBrowser" | "copyPaste" | "printing" | "hostControls"
  | "webcam" | "screen" | "fullscreen" | "identity"
  | "tabSwitch" | "multipleScreens" | "browserExit" | "violations";

type SelectKey = "winningRule" | "attempts" | "lifelines" | "revealPenalty" | "tieBreaker" | "feedbackTiming" | "resultAvailable" | "access" | "threshold" | "action";
type NumericKey = "totalXp" | "xpToWin" | "wrongPenalty";
type Settings = Record<SwitchKey, boolean> & Record<SelectKey, string> & Record<NumericKey, string>;

const defaults: Settings = {
  totalXp: "", xpToWin: "", wrongPenalty: "",
  winningRule: "", attempts: "", lifelines: "",
  revealPenalty: "", tieBreaker: "",
  feedbackTiming: "", resultAvailable: "", access: "",
  threshold: "", action: "",
  awardXp: false, partialXp: false, speedBonus: false, deductXp: false,
  answerFeedback: false, explanation: false, afterQuestion: false, xpBanner: false,
  didYouKnow: false, correctAnswers: false, winnerAnimation: false,
  switching: false, reviewWrong: false, weakness: false, lifelineReport: false, timeline: false,
  secureBrowser: false, copyPaste: false, printing: false, hostControls: false,
  webcam: false, screen: false, fullscreen: false, identity: false,
  tabSwitch: false, multipleScreens: false, browserExit: false, violations: false,
};

const selectKeys: SelectKey[] = ["winningRule", "attempts", "lifelines", "revealPenalty", "tieBreaker", "feedbackTiming", "resultAvailable", "access", "threshold", "action"];
const numberKeys: NumericKey[] = ["totalXp", "xpToWin", "wrongPenalty"];
const numericLabels: Record<NumericKey, string> = { totalXp: "Total XP Available", xpToWin: "XP To Win", wrongPenalty: "Wrong Answer Penalty" };
const selectLabels: Record<SelectKey, string> = { winningRule: "Winning Rule", attempts: "Attempts Per Question", lifelines: "Lifeline Per Team", revealPenalty: "Reveal hint with no lifeline", tieBreaker: "Tie-Breaker", feedbackTiming: "Feedback Timing", resultAvailable: "Result Available", access: "Access Control", threshold: "Violation Threshold", action: "Action" };


const feedbackTabs = ["Score", "Winning", "Attempts", "Feedback", "Results"];
const securityTabs = ["Proctoring", "Access", "Monitoring", "Restrictions"];

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button className={`qev-switch ${checked ? "is-on" : ""}`} type="button" role="switch" aria-checked={checked} onClick={onChange}>
      <span>{checked ? "ON" : "OFF"}</span><i />
    </button>
  );
}

function IconBubble({ children, tone = "purple" }: { children: ReactNode; tone?: string }) {
  return <span className={`qev-icon-bubble qev-tone-${tone}`}>{children}</span>;
}

function Panel({ title, icon, tone, children }: { title: string; icon: ReactNode; tone: string; children: ReactNode }) {
  return (
    <section className="qev-panel">
      <div className="qev-panel-title"><IconBubble tone={tone}>{icon}</IconBubble><h3>{title}</h3></div>
      <div className="qev-panel-rows">{children}</div>
    </section>
  );
}

export default function EvaluationPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaults);
  const [expanded, setExpanded] = useState({ feedback: true, security: true });
  const [feedbackTab, setFeedbackTab] = useState("Score");
  const [securityTab, setSecurityTab] = useState("Proctoring");
  const [saved, setSaved] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("assessmentId") || params.get("id") || localStorage.getItem("quantumChampsCurrentId") || "";
      if (!id) { setError("Assessment ID not found. Open this page from the previous Quantum Champs step."); setLoaded(true); return; }
      const raw = localStorage.getItem(`quantumChamps:${id}`);
      if (!raw) { setError("The selected assessment could not be found. Return to the previous step."); setLoaded(true); return; }
      const record = JSON.parse(raw) as Record<string, unknown>;
      const evaluation = record.evaluation as { settings?: Partial<Settings>; saved?: boolean } | undefined;
      if (evaluation?.settings) {
        const restored = { ...defaults, ...evaluation.settings };
        setSettings(restored);
        setSaved(Boolean(evaluation.saved));
      }
      localStorage.setItem("quantumChampsCurrentId", id);
      setAssessmentId(id);
    } catch { setError("Unable to load assessment data. Please return to the previous step."); }
    finally { setLoaded(true); }
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(previous => ({ ...previous, [key]: value }));
    setSaved(false);
    setFieldErrors([]);
    setError("");
  };
  const toggle = (key: SwitchKey) => update(key, !settings[key]);

  const validate = () => {
    const issues: string[] = [];
    for (const key of numberKeys) {
      const value = settings[key].trim();
      if (!value) issues.push(`${numericLabels[key]} is required.`);
      else if (!Number.isFinite(Number(value)) || Number(value) < 0) issues.push(`${numericLabels[key]} must be zero or greater.`);
    }
    if (settings.totalXp && Number(settings.totalXp) <= 0) issues.push("Total XP Available must be greater than zero.");
    if (settings.xpToWin && Number(settings.xpToWin) <= 0) issues.push("XP To Win must be greater than zero.");
    for (const key of selectKeys) if (!settings[key]) issues.push(`Select ${selectLabels[key]}.`);
    return issues;
  };

  const save = () => {
    if (!loaded || !assessmentId) { setError("Assessment ID is missing. Return to the previous step."); return false; }
    const issues = validate();
    setFieldErrors(issues);
    if (issues.length) { setSaved(false); setError("Complete the highlighted required settings before saving."); return false; }
    try {
      const storageKey = `quantumChamps:${assessmentId}`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setError("Assessment record not found. Your settings were not saved."); return false; }
      const record = JSON.parse(raw) as Record<string, unknown>;
      const evaluation = { settings: { ...settings }, saved: true, updatedAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify({ ...record, assessmentId, evaluation, status: "evaluation_saved", updatedAt: evaluation.updatedAt }));
      localStorage.setItem("quantumChampsCurrentId", assessmentId);
      try { sessionStorage.setItem("quantumChampsEvaluation", JSON.stringify(settings)); } catch { /* Review can use the saved assessment record. */ }
      setSaved(true);
      setError("");
      return true;
    } catch { setSaved(false); setError("Unable to save evaluation settings. Please try again."); return false; }
  };

  const continueToReview = () => {
    if (!saved) { setError("Please click Save before continuing to Review."); return; }
    if (!assessmentId) { setError("Assessment ID is missing."); return; }
    router.push(`/quantum-champs/QC_Review?assessmentId=${encodeURIComponent(assessmentId)}`);
  };

  const toggleRow = (label: string, key: SwitchKey) => (
    <div className="qev-setting-row" key={key}><span>{label}</span><Switch checked={settings[key]} onChange={() => toggle(key)} /></div>
  );
  const selectRow = (label: string, key: SelectKey, options: string[]) => (
    <label className="qev-setting-row" key={key}><span>{label}</span>
      <select value={settings[key]} onChange={event => update(key, event.target.value)}>
        <option value="" disabled>Select {label}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
  const numberRow = (label: string, key: NumericKey) => (
    <label className="qev-setting-row" key={key}><span>{label}</span>
      <input type="number" min="0" value={settings[key]} onChange={event => update(key, event.target.value)} />
    </label>
  );

  return (
    <div className="qev-shell">
      <div className="qev-app">
        <Sidebar />
        <div className="qev-main">
          <Header />
          <main className="qev-scroll">
            <div className="qev-page">
              <nav className="qev-breadcrumb" aria-label="Breadcrumb">
                <button className="qev-breadcrumb-back" type="button" onClick={() => router.push("/assessments")}><ArrowLeft size={14} /></button>
                <button type="button" onClick={() => router.push("/assessments")}>Assessment</button>
                <ChevronRight size={14} />
                <strong>Create Assessment</strong>
              </nav>

              <div className="qev-stepper" aria-label="Assessment progress">
                {(["Type", "Details", "Content", "Evaluation", "Review"] as const).map((step, index) => (
                  <div key={step} className={`qev-step ${index < 3 ? "is-done" : index === 3 ? "is-current" : ""}`}>
                    <span className="qev-step-number">{index + 1}</span><span>{step}</span>
                  </div>
                ))}
              </div>

              <header className="qev-intro">
                <h1>Assessment Evaluation (Quantum Champ)</h1>
                <p>Decide How XP Is Awarded, What Teams See, And How The Game Is Kept Fair.</p>
              </header>

              <section className="qev-block">
                <button className="qev-block-heading" type="button" aria-expanded={expanded.feedback} onClick={() => setExpanded(previous => ({ ...previous, feedback: !previous.feedback }))}>
                  <IconBubble><BarChart3 size={22} /></IconBubble>
                  <span className="qev-block-heading-copy"><strong>Feedback And Results</strong><small>Configure XP Scoring, Winning Rules, Lifelines, And What Teams See After Each Question And At The End Of The Game.</small>
                    <span className="qev-tab-row" onClick={event => event.stopPropagation()}>{feedbackTabs.map(tab => <span key={tab} role="button" tabIndex={0} className={feedbackTab === tab ? "active" : ""} onClick={() => setFeedbackTab(tab)} onKeyDown={event => { if (event.key === "Enter") setFeedbackTab(tab); }}>{tab}</span>)}</span>
                  </span>
                  <ChevronDown className={`qev-block-chevron ${expanded.feedback ? "" : "is-closed"}`} size={21} />
                </button>
                {expanded.feedback && <div className="qev-grid">
                  <Panel title="SCORINGS" icon={<Target size={18} />} tone="blue">
                    {numberRow("Total XP Available", "totalXp")}
                    {numberRow("XP To Win", "xpToWin")}
                    {selectRow("Winning Rule", "winningRule", ["Highest XP at the end", "First to target XP", "Most correct answers"])}
                    {numberRow("Wrong Answer Penalty", "wrongPenalty")}
                  </Panel>
                  <Panel title="LIFELINE AND ATTEMPTS" icon={<RefreshCw size={18} />} tone="green">
                    {selectRow("Attempts Per Question", "attempts", ["1", "2", "3", "Unlimited"])}
                    {selectRow("Lifeline Per Team", "lifelines", ["0", "1", "2", "3", "4", "5"])}
                    {selectRow("Reveal hint with no lifeline", "revealPenalty", ["Full XP", "75% XP", "50% XP", "25% XP", "0 XP"])}
                    {selectRow("Tie- Breaker", "tieBreaker", ["Final Strike Question", "Highest total XP", "Fastest answer", "Sudden Death"])}
                  </Panel>
                  <Panel title="XP RULES" icon={<Star size={18} />} tone="orange">
                    {toggleRow("Award XP for Correct Answers", "awardXp")}
                    {toggleRow("Partial XP (Ordering/ Talking Points)", "partialXp")}
                    {toggleRow("Speed Bonus", "speedBonus")}
                    {toggleRow("Deduct XP when lifeline Used", "deductXp")}
                  </Panel>
                  <Panel title="ANSWER FEEDBACK" icon={<MessageSquareText size={18} />} tone="yellow">
                    {toggleRow("Show Answer Feedback", "answerFeedback")}
                    {toggleRow("Show Explanation", "explanation")}
                    {selectRow("Feedback Timing", "feedbackTiming", ["After", "Immediately", "End of round", "End of game"])}
                    <div className="qev-check-list"><span><Check size={13} />Correct Answer Feedback</span><span><Check size={13} />Wrong Answer Feedback</span><span><Check size={13} />Question Explanation</span></div>
                  </Panel>
                  <Panel title="RESULTS" icon={<TrendingUp size={18} />} tone="orange">
                    {toggleRow("Show Result After Each Question", "afterQuestion")}
                    {toggleRow("Show Great Work / XP Banner", "xpBanner")}
                    {toggleRow("Show Did You Know Card", "didYouKnow")}
                    {toggleRow("Show Correct Answers / Order", "correctAnswers")}
                    {toggleRow("Winner Screen With Animation", "winnerAnimation")}
                    {selectRow("Result Available", "resultAvailable", ["Immediately", "After round", "End of game", "Host controlled"])}
                  </Panel>
                  <Panel title="COGNITIVE & BEHAVIORAL INSIGHTS" icon={<Eye size={18} />} tone="yellow">
                    {toggleRow("Answer Switching Behavioral", "switching")}
                    {toggleRow("Review Wrong Answers", "reviewWrong")}
                    {toggleRow("View Weakness Map", "weakness")}
                    {toggleRow("Lifeline Usage Report", "lifelineReport")}
                    {toggleRow("Per-Team XP Timeline", "timeline")}
                  </Panel>
                </div>}
              </section>

              <section className="qev-block qev-security">
                <button className="qev-block-heading" type="button" aria-expanded={expanded.security} onClick={() => setExpanded(previous => ({ ...previous, security: !previous.security }))}>
                  <IconBubble tone="green"><ShieldCheck size={22} /></IconBubble>
                  <span className="qev-block-heading-copy"><strong>Security &amp; Integrity</strong><small>Configure Proctoring, Browser Restrictions, Question Security, And Assessment Integrity Controls.</small>
                    <span className="qev-tab-row" onClick={event => event.stopPropagation()}>{securityTabs.map(tab => <span key={tab} role="button" tabIndex={0} className={securityTab === tab ? "active" : ""} onClick={() => setSecurityTab(tab)} onKeyDown={event => { if (event.key === "Enter") setSecurityTab(tab); }}>{tab}</span>)}</span>
                  </span>
                  <ChevronDown className={`qev-block-chevron ${expanded.security ? "" : "is-closed"}`} size={21} />
                </button>
                {expanded.security && <div className="qev-grid">
                  <Panel title="ASSESSMENT ACCESS" icon={<LockKeyhole size={18} />} tone="orange">
                    {selectRow("Access Control", "access", ["Open", "Invite Only", "Restricted", "Private"])}
                    {toggleRow("Require Secure Browser", "secureBrowser")}
                    {toggleRow("Prevent Copy / Paste", "copyPaste")}
                    {toggleRow("Prevent Printing", "printing")}
                    {toggleRow("Host Controls Reveal & Next", "hostControls")}
                  </Panel>
                  <Panel title="PROCTORING" icon={<Video size={18} />} tone="blue">
                    {toggleRow("Webcam Monitoring", "webcam")}
                    {toggleRow("Screen Monitoring", "screen")}
                    {toggleRow("Full-Screen Mode", "fullscreen")}
                    {toggleRow("Identity Verification", "identity")}
                  </Panel>
                  <Panel title="MONITORING" icon={<Eye size={18} />} tone="yellow">
                    {toggleRow("Detect Tab Switching", "tabSwitch")}
                    {toggleRow("Detect Multiple Screens", "multipleScreens")}
                    {toggleRow("Detect Browser Exit", "browserExit")}
                    {toggleRow("Record Violations", "violations")}
                  </Panel>
                  <Panel title="RESTRICTION" icon={<AlertTriangle size={18} />} tone="yellow">
                    {selectRow("Violation Threshold", "threshold", ["1", "2", "3", "4", "5"])}
                    {selectRow("Action", "action", ["Warn", "Pause", "Disqualify", "Notify Host"])}
                  </Panel>
                </div>}
              </section>

              {(error || fieldErrors.length > 0) && <div role="alert" style={{ margin: "14px 0", padding: "12px 16px", borderRadius: 8, color: "#a61c42", background: "#f6e2e7", fontSize: 13 }}>
                {error && <strong>{error}</strong>}
                {fieldErrors.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>{fieldErrors.map(message => <li key={message}>{message}</li>)}</ul>}
              </div>}
              <footer className="qev-footer">
                <button type="button" onClick={() => router.push(`/quantum-champs/QC_Create_Question${assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : ""}`)}>Back</button>
                <div><button type="button" onClick={save}>{saved ? "Saved" : "Save"}</button>
                  <button className="qev-continue" type="button" onClick={continueToReview}>Continue</button>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
