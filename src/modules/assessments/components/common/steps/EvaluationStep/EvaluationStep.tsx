"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Sidebar from "../../sidebar/page";
import Header from "../../header/Header";
import "./evaluation.css";

type PanelId = "feedback" | "security";
type SettingKey = "scoringMethod" | "passingScore" | "maxAttempts" | "feedbackMode" | "showResults" | "showCorrectAnswers" | "proctoring" | "accessCode" | "monitoring" | "browserRestrictions" | "shuffleQuestions" | "shuffleAnswers" | "reviewAvailability";
type EvaluationSettings = Record<SettingKey, string>;
const initialSettings: EvaluationSettings = {
  scoringMethod: "Automatic scoring", passingScore: "60", maxAttempts: "2", feedbackMode: "After submission",
  showResults: "Yes", showCorrectAnswers: "After assessment closes", proctoring: "Disabled", accessCode: "Not required",
  monitoring: "Basic monitoring", browserRestrictions: "Standard browser", shuffleQuestions: "Yes", shuffleAnswers: "Yes",
  reviewAvailability: "After submission",
};
const steps = ["Type", "Details", "Content", "Evaluation", "Review"] as const;
const categories = [
  { id: "feedback" as const, heading: "Feedback And Results", subtitle: "Configure Scoring, Passing Criteria, Attempts, And What Learners See After Completing The Assessment.", iconSrc: "/assets/assessmenticons/chartpurple.svg", tabs: ["Score", "Passing", "Attempts", "Feedback", "Results"] },
  { id: "security" as const, heading: "Security & Integrity", subtitle: "Configure Proctoring, Browser Restrictions, Question Security, And Assessment Integrity Controls.", iconSrc: "/assets/assessmenticons/security-lock.svg", tabs: ["Proctoring", "Access", "Monitoring", "Restrictions"] },
];
function SettingSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="evaluationField"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}
function EvaluationNeumoDropdown({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="evaluationMiniSelectWrap" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="evaluationMiniSelectTrigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>
      <span title={value}>{value}</span><img src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={17} height={17} />
    </button>
    {open && !disabled && <div className="evaluationMiniSelectMenu" role="listbox" aria-label={label}>
      {options.map(option => <button type="button" key={option} role="option" aria-selected={value === option} className={`evaluationMiniSelectOption ${value === option ? "is-selected" : ""}`} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>)}
    </div>}
  </div>;
}


const shortAnswerControlKeys: Record<string, string> = {
  maxAttempts: "maximumAttempts", scoreUsed: "scoreForResult", cooldown: "attemptCooldown",
  resultAfter: "showResult", showScore: "showScore", passFail: "showPassFail", correctAnswers: "showCorrectAnswers",
  answerFeedback: "showAnswerFeedback", explanation: "showExplanation", feedbackTiming: "feedbackTiming",
  reviewAvailability: "resultAvailable", answerSwitching: "answerSwitching", reviewWrong: "reviewWrongAnswers",
  weaknessMap: "weaknessMap", accessControl: "accessControl", secureBrowser: "secureBrowser",
  copyPaste: "preventCopyPaste", printing: "preventPrinting", webcam: "webcamMonitoring",
  screenMonitoring: "screenMonitoring", fullScreen: "fullScreenMode", identity: "identityVerification",
  tabSwitching: "detectTabSwitching", multipleScreens: "detectMultipleScreens", browserExit: "detectBrowserExit",
  recordViolations: "recordViolations", violationThreshold: "violationThreshold", violationAction: "violationAction",
};
const shortAnswerSwitches = new Set(["resultAfter", "showScore", "passFail", "correctAnswers", "answerFeedback", "explanation", "answerSwitching", "reviewWrong", "weaknessMap", "secureBrowser", "copyPaste", "printing", "webcam", "screenMonitoring", "fullScreen", "identity", "tabSwitching", "multipleScreens", "browserExit", "recordViolations"]);

export default function EvaluationPage({ shortAnswer = false, typeLabel, detailsKey: detailsKeyOverride, evaluationKey: evaluationKeyOverride }: { shortAnswer?: boolean; typeLabel?: string; detailsKey?: string; evaluationKey?: string } = {}) {
  const router = useRouter();
  const detailsKey = detailsKeyOverride ?? (shortAnswer ? "shortAnswerAssessmentDraft" : "mcqAssessmentDraft");
  const evaluationKey = evaluationKeyOverride ?? (shortAnswer ? "shortAnswerEvaluationDraft" : "mcqAssessmentEvaluationDraft");
  const savedDraftRef = useRef<Record<string, unknown>>({});
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openPanels, setOpenPanels] = useState<PanelId[]>([]);
  const [activeTabs, setActiveTabs] = useState<Record<PanelId, string>>({ feedback: "Score", security: "Proctoring" });
  const [settings, setSettings] = useState<EvaluationSettings>(initialSettings);
  const [message, setMessage] = useState("");
  const [configuredTotalMarks,setConfiguredTotalMarks]=useState(30);
  useEffect(()=>{
    try {const draft=JSON.parse(assessmentStorage.getItem(detailsKey)||"{}");const saved=shortAnswer ? JSON.parse(assessmentStorage.getItem(evaluationKey)||"{}") : {};const n=Number(draft.totalMarks ?? saved.totalMarks);if(Number.isFinite(n)&&n>0)setConfiguredTotalMarks(n);}catch{}
  },[detailsKey,evaluationKey,shortAnswer]);

  const [saving, setSaving] = useState(false);
  useEffect(() => {
    try {
      const saved = assessmentStorage.getItem(evaluationKey);
      const parsed = saved ? JSON.parse(saved) : {};
      savedDraftRef.current = parsed;
      const details = shortAnswer ? JSON.parse(assessmentStorage.getItem(detailsKey) || "{}") : {};
      setSettings({ ...initialSettings, ...(shortAnswer && !parsed.passingScore && details.passingScore ? { passingScore: String(details.passingScore).replace("%", "") } : {}), ...parsed });
    }
    catch { /* Keep defaults when browser storage is unavailable. */ }
    return () => { if (redirectRef.current) clearTimeout(redirectRef.current); };
  }, [detailsKey, evaluationKey, shortAnswer]);
  const update = (key: SettingKey, value: string) => { setSettings(previous => ({ ...previous, [key]: value })); setMessage(""); };
  const togglePanel = (panel: PanelId) => setOpenPanels(previous => previous.includes(panel) ? [] : [panel]);
  // From Review > Edit, expand and scroll to the requested settings panel.
  useEffect(() => {
    const requestedPanel = new URLSearchParams(window.location.search).get("reviewPanel");
    if (requestedPanel !== "feedback" && requestedPanel !== "security") return;

    setOpenPanels([requestedPanel]);
    const scrollTimer = window.setTimeout(() => {
      const panel = document.getElementById(`evaluation-content-${requestedPanel}`);
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
    return () => window.clearTimeout(scrollTimer);
  }, []);

  const saveAndContinue = () => {
    if (saving) return;
    try {
      assessmentStorage.setItem(evaluationKey, JSON.stringify(evaluationDraft()));
      setMessage("Successfully saved");
      setSaving(true);
      redirectRef.current = setTimeout(() => { setMessage(""); setSaving(false); router.push("/assessments/create/review"); }, 3000);
    } catch { setMessage("Unable to save settings"); setSaving(false); }
  };
  const [controls, setControls] = useState<Record<string, string>>({
    scoreUsed: "Highest", cooldown: "None", resultAfter: "on", showScore: "on", passFail: "on", correctAnswers: "on",
    answerFeedback: "on", explanation: "on", feedbackTiming: "After", answerSwitching: "on", reviewWrong: "on", weaknessMap: "on",
    accessControl: "Open", secureBrowser: "on", copyPaste: "on", printing: "on", webcam: "on", screenMonitoring: "on",
    fullScreen: "on", identity: "on", tabSwitching: "on", multipleScreens: "on", browserExit: "on", recordViolations: "on",
    violationThreshold: "3", violationAction: "Warn",
  });
  useEffect(() => {
    try {
      const draft = assessmentStorage.getItem(evaluationKey);
      if (draft) {
        const saved = JSON.parse(draft) as Record<string, unknown>;
        const nested = saved.dropdownSettings && typeof saved.dropdownSettings === "object" ? saved.dropdownSettings as Record<string, unknown> : {};
        setControls(previous => {
          const restored = Object.fromEntries(Object.keys(previous).filter(key => typeof saved[key] === "string").map(key => [key, saved[key] as string]));
          if (shortAnswer) for (const [key, legacyKey] of Object.entries(shortAnswerControlKeys)) {
            const value = nested[legacyKey];
            if (value !== undefined && value !== null) restored[key] = shortAnswerSwitches.has(key) ? (value === true || value === "on" || value === "true" ? "on" : "off") : String(value);
            else if (typeof saved[key] === "string") restored[key] = saved[key] as string;
          }
          if (shortAnswer && !restored.maxAttempts && saved.maxAttempts) restored.maxAttempts = String(saved.maxAttempts);
          if (shortAnswer && nested.showResult === undefined && saved.showResults !== undefined) restored.resultAfter = ["no", "false", "off", "never"].includes(String(saved.showResults).toLowerCase()) ? "off" : "on";
          if (shortAnswer && nested.showCorrectAnswers === undefined && saved.showCorrectAnswers !== undefined) restored.correctAnswers = ["no", "false", "off", "never"].includes(String(saved.showCorrectAnswers).toLowerCase()) ? "off" : "on";
          return { ...previous, ...restored };
        });
      } else if (shortAnswer) {
        const details = JSON.parse(assessmentStorage.getItem(detailsKey) || "{}");
        setControls(previous => ({ ...previous, maxAttempts: String(details.attempts || "2"), ...(details.cooldown ? { cooldown: String(details.cooldown) } : {}), ...(details.gradingMethod ? { scoreUsed: String(details.gradingMethod).toLowerCase().includes("highest") ? "Highest" : "Latest" } : {}) }));
      }
    } catch { /* Keep default controls if storage is unavailable. */ }
  }, [detailsKey, evaluationKey, shortAnswer]);
  const evaluationDraft = () => {
    if (!shortAnswer) return { ...settings, ...controls };
    const existing = savedDraftRef.current;
    const nested = existing.dropdownSettings && typeof existing.dropdownSettings === "object" ? existing.dropdownSettings as Record<string, unknown> : {};
    const mapped = Object.fromEntries(Object.entries(shortAnswerControlKeys).filter(([key]) => controls[key] !== undefined).map(([key, legacyKey]) => [legacyKey, shortAnswerSwitches.has(key) ? controls[key] === "on" : controls[key]]));
    const showCorrectAnswers = controls.correctAnswers === "on";
    return { ...existing, ...settings, ...controls, maxAttempts: controls.maxAttempts || settings.maxAttempts,
      showResults: controls.resultAfter === "on" ? "Yes" : "No",
      showCorrectAnswers: showCorrectAnswers ? (settings.showCorrectAnswers === "Never" ? "After assessment closes" : settings.showCorrectAnswers) : "Never",
      dropdownSettings: { ...nested, ...mapped }, totalMarks: configuredTotalMarks };
  };
  const [readyToAutosave,setReadyToAutosave]=useState(false);
  useEffect(()=>{const frame=window.requestAnimationFrame(()=>setReadyToAutosave(true));return()=>window.cancelAnimationFrame(frame);},[]);
  useEffect(()=>{ if(!readyToAutosave) return; try {assessmentStorage.setItem(evaluationKey,JSON.stringify(evaluationDraft()));}catch{} },[settings,controls,readyToAutosave,configuredTotalMarks,evaluationKey,shortAnswer]);
  const control = (name: string, fallback = "") => controls[name] ?? fallback;
  const changeControl = (name: string, value: string) => { setControls(old => ({ ...old, [name]: value })); setMessage(""); };
  const switchRow = (label: string, key: string, dependent = false) => {
    const on = control(key) === "on";
    return <div className={`evaluationSettingRow ${dependent ? "evaluationRowDisabled" : ""}`} key={key}>
      <span>{label}</span><button type="button" role="switch" aria-checked={on} aria-label={label} disabled={dependent} className={`evaluationToggle ${on ? "is-on" : ""}`} onClick={() => changeControl(key, on ? "off" : "on")}><span className="evaluationToggleText">{on ? "ON" : "OFF"}</span><span className="evaluationToggleKnob" /></button>
    </div>;
  };
  const selectRow = (label: string, key: string, options: string[], dependent = false) => <div key={key} className={`evaluationSettingRow ${dependent ? "evaluationRowDisabled" : ""}`}><span>{label}</span><EvaluationNeumoDropdown label={label} value={control(key, options[0])} options={options} onChange={value => changeControl(key, value)} disabled={dependent} /></div>;
  const displayRow = (label: string, value: string) => <div className="evaluationSettingRow" key={label}><span>{label}</span><strong className="evaluationDisplayValue">{value}</strong></div>;
  const settingCard = (title: string, iconName: string, children: ReactNode, wide = false) => <section key={title} className={`evaluationSettingCard ${wide ? "evaluationSettingCardWide" : ""}`}><h3><span className="evaluationSmallIcon"><img src={`/assets/assessmenticons/${iconName}`} alt="" width={20} height={20}/></span>{title}</h3><div className="evaluationSettingRows">{children}</div></section>;
  const panelContent = (panel: PanelId) => panel === "feedback" ? <div className="evaluationSettingGrid">
    {settingCard("SCORINGS", "target.svg", <>{displayRow("Total Marks", String(configuredTotalMarks))}{displayRow("Passing Score", `${settings.passingScore}%`)}{displayRow("Passing Marks", `${Math.round((Number(settings.passingScore) || 0) * configuredTotalMarks / 100)}/${configuredTotalMarks}`)}</>)}
    {settingCard("ATTEMPTS", "refresh.svg", <>{selectRow("Maximum Attempts", "maxAttempts", ["1", "2", "3", "4", "5", "Unlimited"])}{selectRow("Score used for Result", "scoreUsed", ["Highest", "Latest", "Average", "First"])}{selectRow("Attempt Cooldown", "cooldown", ["None", "5 minutes", "15 minutes", "30 minutes", "1 hour", "24 hours"])}</>)}
    {settingCard("RESULTS", "chart-up2.svg", <>{switchRow("Show Result After Submission", "resultAfter")}{switchRow("Show Score", "showScore", control("resultAfter") !== "on")}{switchRow("Show Pass/ Fail", "passFail", control("resultAfter") !== "on")}{switchRow("Show Correct Answers", "correctAnswers", control("resultAfter") !== "on")}{selectRow("Result Available", "reviewAvailability", [ "After submission", "Scheduled","Manual Release", "Never"], control("resultAfter") !== "on")}</>)}
    {settingCard("ANSWER FEEDBACK", "message-circle-more.svg", <>{switchRow("Show Answer Feedback", "answerFeedback")}{switchRow("Show Explanation", "explanation", control("answerFeedback") !== "on")}{selectRow("Feedback Timing", "feedbackTiming", ["After", "Immediately", "After assessment closes", "Never"], control("answerFeedback") !== "on")}{<div className={`evaluationFeedbackChecks ${control("answerFeedback") !== "on" ? "evaluationRowDisabled" : ""}`}>{["Correct Answer Feedback", "Wrong Answer Feedback", ...(control("explanation") === "on" ? ["Question Explanation"] : [])].map(label => <div key={label}><span className="evaluationFeedbackCheckIcon" aria-hidden="true" />{label}</div>)}</div>}</>)}
    {settingCard("COGNITIVE & BEHAVIORAL INSIGHTS", "view2.svg", <>{switchRow("Answer Switching Behavioral", "answerSwitching")}{switchRow("Review Wrong Answers", "reviewWrong")}{switchRow("View Weakness Map", "weaknessMap")}</>)}
  </div> : <div className="evaluationSettingGrid">
    {settingCard("ASSESSMENT ACCESS", "lock.svg", <>{selectRow("Access Control", "accessControl", ["Open", "Enrolled learners", "Invited learners", "Restricted"])}{switchRow("Require Secure Browser", "secureBrowser")}{switchRow("Prevent Copy / Paste", "copyPaste")}{switchRow("Prevent Printing", "printing")}</>)}
    {settingCard("PROCTORING", "video.svg", <>{switchRow("Webcam Monitoring", "webcam")}{switchRow("Screen Monitoring", "screenMonitoring")}{switchRow("Full-Screen Mode", "fullScreen")}{switchRow("Identity Verification", "identity")}</>)}
    {settingCard("MONITORING", "view2.svg", <>{switchRow("Detect Tab Switching", "tabSwitching")}{switchRow("Detect Multiple Screens", "multipleScreens")}{switchRow("Detect Browser Exit", "browserExit")}{switchRow("Record Violations", "recordViolations")}</>)}
    {settingCard("VIOLATION SETTINGS", "alert.svg", <>{selectRow("Violation Threshold", "violationThreshold", ["1", "2", "3", "4", "5"])}{selectRow("Action", "violationAction", ["Warn", "Pause", "End assessment", "Flag for review"])}</>)}
  </div>;
  return <main className="superAdminPage institutionAdminPage evaluationAppShell"><div className="dashboardLayout evaluationDashboardLayout">
    <Sidebar /><section className="mainContent evaluationMainContent"><div className="evaluationHeaderSlot"><Header /></div><div className="institutionScrollArea evaluationScrollArea"><div className="pageContent institutionPageContent evaluationPageContent">
      <nav className="evaluationBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><span className="evaluationBreadcrumbChevrons" aria-hidden="true">»</span><span>Create Assessment</span></nav>
      <ol className="evaluationWizard" aria-label="Assessment creation progress">{steps.map((step, index) => <li key={step} className={`evaluationWizardStep ${index < 3 ? "is-complete" : index === 3 ? "is-current" : "is-upcoming"}`} aria-current={index === 3 ? "step" : undefined}><WizardStepLink index={index} current={3}/><span className="evaluationWizardNumber"><span className="evaluationWizardDigit">{index + 1}</span></span><span className="evaluationWizardLabel">{step}</span></li>)}</ol>
      <div className="evaluationTitleGroup"><h1>Assessment Evaluation ({typeLabel || (shortAnswer ? "Short Answers" : "MCQ")})</h1><p>Set Evaluation, Feedback, Results, And Security.</p></div>
      <div className="evaluationQuestionLayout"><div className="evaluationQuestionMain">
      <div className="evaluationPanels">{categories.map(category => { const isOpen = openPanels.includes(category.id); return <section key={category.id} className={`evaluationPanel evaluationPanel--${category.id} ${isOpen ? "is-open" : ""}`}>
        <div className="evaluationPanelHeader"><div className="evaluationPanelIcon" aria-hidden="true"><img src={category.iconSrc} alt="" width={37} height={37} onError={event => { event.currentTarget.style.visibility = "hidden"; }} /></div><div className="evaluationPanelText"><h2>{category.heading}</h2><p>{category.subtitle}</p></div><button type="button" className="evaluationExpandButton" aria-label={`${isOpen ? "Collapse" : "Expand"} ${category.heading}`} aria-expanded={isOpen} aria-controls={`evaluation-content-${category.id}`} onClick={() => togglePanel(category.id)}><img className="evaluationChevronAsset" src="/assets/assessmenticons/arrow-down-01.svg" width={20} height={20} alt="" /></button></div>
        <div className="evaluationPills" aria-label={`${category.heading} sections`}>{category.tabs.map(tab => <span key={tab} className={`evaluationPill ${isOpen && activeTabs[category.id] === tab ? "is-selected" : ""}`}>{tab}</span>)}</div>
        {isOpen && <div className="evaluationPanelBody evaluationDetailedBody" id={`evaluation-content-${category.id}`}>{panelContent(category.id)}</div>}
      </section>; })}</div>
      <div className="evaluationFooter"><button type="button" className="evaluationFooterButton" onClick={() => { if (redirectRef.current) { clearTimeout(redirectRef.current); redirectRef.current=null; } setSaving(false); router.push(shortAnswer ? "/assessments/create/content?edit=1" : "/assessments/create/content"); }}>Back</button><div className="evaluationFooterRight">{message && <span role="status" className={`evaluationSaveMessage ${message === "Successfully saved" ? "" : "evaluationSaveError"}`}>{message}</span>}<button type="button" className="evaluationFooterButton evaluationContinue" disabled={saving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
      </div></div>
    </div></div></section></div></main>;
}
