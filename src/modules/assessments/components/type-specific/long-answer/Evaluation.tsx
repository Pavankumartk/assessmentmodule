"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "@/modules/assessments/components/common/steps/EvaluationStep/evaluation.css";
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
// Add your provided icon asset paths here. Empty paths show no icons.
const EVALUATION_ICON_PATHS = {
  scorings: "/assets/assessmenticons/target.svg",
  attempts: "/assets/assessmenticons/refresh.svg",
  results: "/assets/assessmenticons/chart-up2.svg",
  answerFeedback: "/assets/assessmenticons/message-circle-more.svg",
  manualGrading: "/assets/assessmenticons/checkmark-circle-02.svg",
  cognitiveInsights: "/assets/assessmenticons/view2.svg",
  assessmentAccess: "/assets/assessmenticons/lock.svg",
  proctoring: "/assets/assessmenticons/video.svg",
  monitoring: "/assets/assessmenticons/view2.svg",
  restriction: "/assets/assessmenticons/alert.svg",
  dropdown: "/assets/assessmenticons/arrow-down-01-2.svg",
  check: "/assets/assessmenticons/checkmark-circle-02.svg",
} as const;

type EvaluationIconKey = keyof typeof EVALUATION_ICON_PATHS;
function EvaluationIcon({ name, className = "" }: { name: EvaluationIconKey; className?: string }) {
  const src = EVALUATION_ICON_PATHS[name];
  return src ? <img src={src} alt="" aria-hidden="true" className={className} onError={event => { event.currentTarget.style.visibility = "hidden"; }} /> : null;
}

type DropdownSettings = {
  maximumAttempts: string;
  scoreForResult: string;
  attemptCooldown: string;
  feedbackTiming: string;
  resultAvailable: string;
  resultReleaseDate: string;
  releaseMarks: string;
  accessControl: string;
  violationThreshold: string;
  violationAction: string;
  showResult: boolean;
  showScore: boolean;
  showPassFail: boolean;
  showCorrectAnswers: boolean;
  showAnswerFeedback: boolean;
  showExplanation: boolean;
  showRubric: boolean;
  showGraderComments: boolean;
  doubleMarking: boolean;
  moderation: boolean;
  answerSwitching: boolean;
  reviewWrongAnswers: boolean;
  weaknessMap: boolean;
  secureBrowser: boolean;
  preventCopyPaste: boolean;
  preventPrinting: boolean;
  webcamMonitoring: boolean;
  screenMonitoring: boolean;
  fullScreenMode: boolean;
  identityVerification: boolean;
  detectTabSwitching: boolean;
  detectMultipleScreens: boolean;
  detectBrowserExit: boolean;
  recordViolations: boolean;
};

const initialDropdownSettings: DropdownSettings = {
  maximumAttempts: "2", scoreForResult: "Highest", attemptCooldown: "None", feedbackTiming: "After",
  resultAvailable: "Immediately", resultReleaseDate: "", releaseMarks: "After Grading", accessControl: "Open",
  violationThreshold: "3", violationAction: "Warn",
  showResult: true, showScore: true, showPassFail: true, showCorrectAnswers: true,
  showAnswerFeedback: true, showExplanation: true,
  showRubric: true, showGraderComments: false, doubleMarking: true, moderation: true,
  answerSwitching: true, reviewWrongAnswers: true, weaknessMap: true,
  secureBrowser: true, preventCopyPaste: true, preventPrinting: true,
  webcamMonitoring: true, screenMonitoring: true, fullScreenMode: true, identityVerification: true,
  detectTabSwitching: true, detectMultipleScreens: true, detectBrowserExit: true, recordViolations: true,
};

type DropdownSettingKey = keyof DropdownSettings;
type SwitchKey = { [K in DropdownSettingKey]: DropdownSettings[K] extends boolean ? K : never }[DropdownSettingKey];
type SelectKey = { [K in DropdownSettingKey]: DropdownSettings[K] extends string ? K : never }[DropdownSettingKey];

function SettingSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button className={`evaluationToggle ${checked ? "is-on" : ""}`} type="button"
      role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}>
      <span className="evaluationToggleText">{checked ? "ON" : "OFF"}</span><span className="evaluationToggleKnob" />
    </button>
  );
}

function MatchingMcqDropdown({label,value,options,onSelect,disabled=false}:{label:string;value:string;options:string[];onSelect?:(next:string)=>void;disabled?:boolean}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(disabled)setOpen(false); },[disabled]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  return <div className="evaluationMiniSelectWrap" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="evaluationMiniSelectTrigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span>{value || `Select ${label.toLowerCase()}`}</span>
      <img src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={17} height={17}/>
    </button>
    {open&&<div className="evaluationMiniSelectMenu" role="listbox" aria-label={label}>
      {options.map(option=><button type="button" key={option} role="option" aria-selected={value===option} className={`evaluationMiniSelectOption ${value===option ? "is-selected" : ""}`} onClick={()=>{onSelect?.(option);setOpen(false);}}>{option}</button>)}
    </div>}
  </div>;
}

function SettingRow({ label, value, options, checked, onSelect, onToggle, disabled = false }: {
  label: string;
  value?: string;
  options?: string[];
  checked?: boolean;
  onSelect?: (value: string) => void;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`evaluationSettingRow ${disabled ? "evaluationRowDisabled" : ""}`}>
      <span>{label}</span>
      {onToggle ? <SettingSwitch label={label} checked={Boolean(checked)} disabled={disabled} onChange={onToggle} /> : options ? (
        <MatchingMcqDropdown label={label} value={value || ""} options={options} onSelect={onSelect} disabled={disabled}/>
      ) : <span className="evaluationDisplayValue">{value || "—"}</span>}
    </div>
  );
}

function SettingCard({ title, icon, color, children, id }: {
  title: string;
  icon: EvaluationIconKey;
  color: string;
  children: ReactNode;
  id?: string;
}) {
  return <section className="evaluationSettingCard" id={id} aria-label={title}>
    <h3 ><span className="evaluationSmallIcon" style={{ color }}><EvaluationIcon name={icon} /></span><span>{title}</span></h3>
    <div className="evaluationSettingRows">{children}</div>
  </section>;
}


function EvaluationPanelContents({ panel, settings, onChange, totalMarks, passingScore }: {
  panel: PanelId; settings: DropdownSettings;
  onChange: (change: (previous: DropdownSettings) => DropdownSettings) => void;
  totalMarks: number; passingScore: string;
}) {
  const percentage = Number.parseFloat(passingScore);
  const passingMarks = Number.isFinite(percentage) ? `${Number(((percentage / 100) * totalMarks).toFixed(2))}/${totalMarks}` : `—/${totalMarks}`;
  function setSelect(key: SelectKey, value: string) { onChange((prev) => ({ ...prev, [key]: value })); }
  function flip(key: SwitchKey) { onChange((prev) => ({ ...prev, [key]: !prev[key] })); }
  function selectRow(label: string, key: SelectKey, options: string[], disabled = false) {
    return <SettingRow label={label} value={settings[key]} options={options} disabled={disabled} onSelect={(v) => setSelect(key, v)} />;
  }
  function switchRow(label: string, key: SwitchKey, disabled = false) {
    return <SettingRow label={label} checked={settings[key]} disabled={disabled} onToggle={() => flip(key)} />;
  }
  return <div className="evaluationSettingGrid">{panel === "feedback" ? <>

                <SettingCard id="ev-scoring" title="Scorings" icon="scorings" color="#2D4CC8">
                  <SettingRow label="Total Marks" value={String(totalMarks)} />
                  <SettingRow label="Passing Score" value={passingScore.includes("%") ? passingScore : `${passingScore}%`} />
                  <SettingRow label="Passing Marks" value={passingMarks} />
                </SettingCard>
                <SettingCard id="ev-attempts" title="Attempts" icon="attempts" color="#2A7308">
                  {selectRow("Maximum Attempts", "maximumAttempts", ["1", "2", "3", "4", "5", "Unlimited"])}
                  {selectRow("Score used for Result", "scoreForResult", ["Highest", "Latest", "Average", "First Attempt"])}
                  {selectRow("Attempt Cooldown", "attemptCooldown", ["None", "1 Hr", "6 Hrs", "12 Hrs", "24 Hrs", "48 Hrs"])}
                </SettingCard>
                <SettingCard id="ev-results" title="Results" icon="results" color="#CB5F14">
                  {switchRow("Show Result After Submission", "showResult")}
                  {switchRow("Show Score", "showScore", !settings.showResult)}
                  {switchRow("Show Pass/ Fail", "showPassFail", !settings.showResult)}
                  {switchRow("Show Correct Answers", "showCorrectAnswers", !settings.showResult)}
                  {selectRow("Result Available", "resultAvailable", ["Immediately", "Scheduled", "After Grading", "After Closing", "Manually", "Never"], !settings.showResult)}
                  {settings.showResult && settings.resultAvailable === "Scheduled" && <label className="evaluationSettingRow"><span>Result release date and time</span><input aria-label="Result release date and time" type="datetime-local" value={settings.resultReleaseDate} onChange={event=>onChange(old=>({...old,resultReleaseDate:event.target.value}))}/></label>}
                </SettingCard>
                <SettingCard id="ev-feedback" title="Answer Feedback" icon="answerFeedback" color="#91860C">
                  {switchRow("Show Answer Feedback", "showAnswerFeedback")}
                  {switchRow("Show Explanation", "showExplanation", !settings.showAnswerFeedback)}
                  {selectRow("Feedback Timing", "feedbackTiming", ["After", "Immediately", "After Closing", "Never"], !settings.showAnswerFeedback)}
                  <div className="evaluationFeedbackChecks" aria-label="Available feedback types">
                    {['Correct Answer Feedback', 'Wrong Answer Feedback', 'Question Explanation'].map(label =>
                      <div key={label}><span className="evaluationFeedbackCheckIcon" aria-hidden="true" />{label}</div>)}
                  </div>
                </SettingCard>
                <SettingCard id="ev-manual" title="Manual Grading" icon="manualGrading" color="#CB5F14">
                  {switchRow("Show rubric to learners after grading", "showRubric")}
                  {switchRow("Show grader comments to learners", "showGraderComments")}
                  {switchRow("Double marking (two graders)", "doubleMarking")}
                  {switchRow("Moderation before release", "moderation")}
                  {selectRow("Release Marks", "releaseMarks", ["After Grading", "Immediately", "After Moderation", "Manually"])}
                </SettingCard>
                <SettingCard id="ev-cognitive" title="Cognitive & Behavioral Insights" icon="cognitiveInsights" color="#89800C">
                  {switchRow("Answer Switching Behavioral", "answerSwitching")}
                  {switchRow("Review Wrong Answers", "reviewWrongAnswers")}
                  {switchRow("View Weakness Map", "weaknessMap")}
                </SettingCard>
  </> : <>

                <SettingCard id="ev-access" title="Assessment Access" icon="assessmentAccess" color="#C65C15">
                  {selectRow("Access Control", "accessControl", ["Open", "Enrolled Only", "Access Code", "Restricted"])}
                  {switchRow("Require Secure Browser", "secureBrowser")}
                  {switchRow("Prevent Copy / Paste", "preventCopyPaste")}
                  {switchRow("Prevent Printing", "preventPrinting")}
                </SettingCard>
                <SettingCard id="ev-proctoring" title="Proctoring" icon="proctoring" color="#2D4CC8">
                  {switchRow("Webcam Monitoring", "webcamMonitoring")}
                  {switchRow("Screen Monitoring", "screenMonitoring")}
                  {switchRow("Full-Screen Mode", "fullScreenMode")}
                  {switchRow("Identity Verification", "identityVerification")}
                </SettingCard>
                <SettingCard id="ev-monitoring" title="Monitoring" icon="monitoring" color="#89800C">
                  {switchRow("Detect Tab Switching", "detectTabSwitching")}
                  {switchRow("Detect Multiple Screens", "detectMultipleScreens")}
                  {switchRow("Detect Browser Exit", "detectBrowserExit")}
                  {switchRow("Record Violations", "recordViolations")}
                </SettingCard>
                <SettingCard id="ev-restrictions" title="Restriction" icon="restriction" color="#89800C">
                  {selectRow("Violation Threshold", "violationThreshold", ["1", "2", "3", "4", "5", "10"])}
                  {selectRow("Action", "violationAction", ["Warn", "Notify Admin", "Submit Assessment", "Block Access"])}
                </SettingCard>
  </>}</div>;
}


// Right-side Question summary only. Reads questions already saved by this assessment flow.
type RailSavedQuestion = {
  type?: string; text?: string; question?: string; points?: number | string;
  category?: string; bloom?: string; options?: string[]; correct?: number;
};
type RailQuestion = {
  index: number; type: string; shortType: string; text: string;
  points: number; configured: boolean; needsAttention: boolean;
};
const railTypeLabel = (type: string) => {
  const known: Record<string, string> = {
    "MCQ": "MCQ", "Multiple Choice Question (MCQ)": "MCQ",
    "True / False": "T/F", "True/False": "T/F", "Long Answer": "LA",
    "One-Word Answer": "OW", "One Word Answer": "OW",
    "Fill in the Blank": "FB", "Fill in the blanks": "FB",
    "Long Answer / Essay": "LA",
    "Multiple Response": "MR", "Drag & Drop": "DD", "Quick Quiz": "QC",
    "Image-Based Assessment": "IM",
  };
  return known[type] || type.split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 3).toUpperCase();
};
function AssessmentQuestionRail({ kind }: { kind: "short" | "mcq" }) {
  const [questions, setQuestions] = useState<RailSavedQuestion[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  useEffect(() => {
    try {
      const read = (key: string): Record<string, unknown> => {
        try { const raw = assessmentStorage.getItem(key); return raw ? JSON.parse(raw) : {}; }
        catch { return {}; }
      };
      const details = read("longAnswerAssessmentDraft");
      const content = kind === "short" ? read("longAnswerContentDraft") : read("longAnswerContentDraft");
      const saved = Array.isArray(content.questions) ? content.questions as RailSavedQuestion[] : [];
      const savedCount = Number(details.questionCount);
      setQuestions(saved);
      setQuestionCount(Number.isFinite(savedCount) && savedCount > 0
        ? Math.max(Math.floor(savedCount), saved.length) : Math.max(20, saved.length));
    } catch { /* Keep the empty question placeholders when no draft has been saved. */ }
  }, [kind]);
  const railQuestions: RailQuestion[] = Array.from({ length: questionCount }, (_, index) => {
    const question = questions[index];
    const text = typeof question?.text === "string" ? question.text : typeof question?.question === "string" ? question.question : "";
    const type = question?.type || (kind === "short" ? "Long Answer" : "MCQ");
    const points = Number(question?.points ?? 0);
    const configured = !!text.trim() && Number.isFinite(points) && points > 0;
    const optionsOkay = !Array.isArray(question?.options) || question.options.length === 0
      || (question.options.filter(option => typeof option === "string" && option.trim()).length >= 2
        && typeof question.correct === "number" && question.correct >= 0);
    return {
      index, type, shortType: railTypeLabel(type), text,
      points: Number.isFinite(points) ? points : 0,
      configured,
      needsAttention: !configured || !optionsOkay || !question?.category || !question?.bloom,
    };
  });
  const configuredCount = railQuestions.filter(question => question.configured).length;
  const attentionCount = railQuestions.filter(question => question.needsAttention).length;
  const types = Array.from(new Set(railQuestions.filter(question => question.configured).map(question => question.type)));
  const visible = railQuestions.filter(question =>
    (filter === "all" || question.needsAttention) && (typeFilter === "all" || question.type === typeFilter));
  return <aside className="ev-question-rail" aria-label="Question summary">
    <div className="ev-question-rail-inner">
      <div className="ev-question-overview">
        <h2>Question</h2><p>{configuredCount} of {questionCount} configured</p>
        <div className="ev-question-progress" role="progressbar" aria-label="Questions configured"
          aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={configuredCount}>
          <span style={{width: `${questionCount ? configuredCount / questionCount * 100 : 0}%`}}/>
        </div>
      </div>
      <div className="ev-question-pills" aria-label="Question status filters">
        <button type="button" className={filter === "all" ? "ev-question-pill-active" : ""}
          aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All {questionCount}</button>
        <button type="button" className={filter === "attention" ? "ev-question-pill-active" : ""}
          aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>Need Attention&nbsp; {attentionCount}</button>
      </div>
      <label className="ev-question-type-select">
        <span className="ev-question-visually-hidden">Filter question types</span>
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
          <option value="all">All types</option>
          {types.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <EvaluationIcon name="dropdown" className="ev-dropdown-svg" />
      </label>
      <div className="ev-question-scroll" aria-label="Questions">
        {visible.map(question => <button type="button" key={question.index}
          className={`ev-question-item ${selectedIndex === question.index ? "ev-question-item-selected" : ""}`}
          aria-pressed={selectedIndex === question.index}
          aria-label={`Question ${question.index + 1}: ${question.type}, ${question.text || "Not configured"}, ${question.needsAttention ? "Needs attention" : "Complete"}`}
          onClick={() => setSelectedIndex(question.index)}>
          <span className={`ev-question-status-dot ${question.needsAttention ? "ev-question-status-attention" : ""}`} aria-hidden="true"/>
          <span className="ev-question-number">Q{question.index + 1}</span>
          <span className="ev-question-type">{question.shortType}</span>
          <span className="ev-question-snippet" title={question.text || "Not configured"}>{question.text || "Not configured"}</span>
          <span className="ev-question-points">{question.points || "—"} M</span>
        </button>)}
        {visible.length === 0 && <p className="ev-question-empty">No questions match this filter.</p>}
      </div>
    </div>
  </aside>;
}

export default function EvaluationPage() {
  const router = useRouter();
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openPanels, setOpenPanels] = useState<PanelId[]>([]);
  const [activeTabs, setActiveTabs] = useState<Record<PanelId, string>>({ feedback: "Score", security: "Proctoring" });
  const [settings, setSettings] = useState<EvaluationSettings>(initialSettings);
  const [dropdownSettings, setDropdownSettings] = useState<DropdownSettings>(initialDropdownSettings);
  const [totalMarks, setTotalMarks] = useState(30);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    try { const saved = assessmentStorage.getItem("longAnswerEvaluationDraft"); if (saved) setSettings({ ...initialSettings, ...JSON.parse(saved) }); }
    catch { /* Keep defaults when browser storage is unavailable. */ }
    return () => { if (redirectRef.current) clearTimeout(redirectRef.current); };
  }, []);
  // Restore only data required by the copied expanded panels.
  useEffect(() => {
    const readDraft = (storage: Pick<Storage, "getItem">, key: string) => {
      try { return JSON.parse(storage.getItem(key) || "{}"); } catch { return {}; }
    };
    try {
      const legacy = readDraft(assessmentStorage, "longAnswerEvaluationDraft");
      const details = { ...readDraft(assessmentStorage, "longAnswerAssessmentDraft"), ...readDraft(assessmentStorage, "longAnswerAssessmentDraft") };
      const saved = readDraft(assessmentStorage, "longAnswerEvaluationDraft");
      setDropdownSettings({ ...initialDropdownSettings, ...legacy,
        ...(details.attempts ? { maximumAttempts: String(details.attempts) } : {}),
        ...(details.cooldown ? { attemptCooldown: String(details.cooldown) } : {}),
        ...(details.gradingMethod ? { scoreForResult: String(details.gradingMethod).toLowerCase().includes("highest") ? "Highest" : "Latest" } : {}),
        ...(saved.maxAttempts ? { maximumAttempts: String(saved.maxAttempts) } : {}),
        ...saved.dropdownSettings,
      });
      const marks = Number(details.totalMarks ?? saved.totalMarks);
      if (Number.isFinite(marks) && marks > 0) setTotalMarks(marks);
      if (!saved.passingScore && details.passingScore) setSettings(previous => ({ ...previous, passingScore: String(details.passingScore).replace("%", "") }));
    } catch { /* Use the copied defaults if browser storage is unavailable. */ }
  }, []);
  const updateDropdown = (change: (previous: DropdownSettings) => DropdownSettings) => { setDropdownSettings(change); setMessage(""); };
  const togglePanel = (panel: PanelId) => setOpenPanels(previous => previous.includes(panel) ? [] : [panel]);
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("reviewPanel"); if (requested !== "feedback" && requested !== "security") return; setOpenPanels([requested]); const timer = window.setTimeout(() => document.getElementById(`evaluation-content-${requested}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 180); return () => window.clearTimeout(timer); }, []);
  const saveAndContinue = () => {
    if (saving) return;
    const passingScore=Number(settings.passingScore);
    if(!Number.isFinite(passingScore)||passingScore<=0||passingScore>100){setMessage("Passing score must be between 1% and 100%.");return;}
    if(!Number.isFinite(totalMarks)||totalMarks<=0){setMessage("Total marks must be greater than zero.");return;}
    try {
      assessmentStorage.setItem("longAnswerEvaluationDraft", JSON.stringify({ ...settings, maxAttempts: dropdownSettings.maximumAttempts,
        showResults: dropdownSettings.showResult ? "Yes" : "No",
        showCorrectAnswers: dropdownSettings.showCorrectAnswers ? (settings.showCorrectAnswers === "Never" ? "After assessment closes" : settings.showCorrectAnswers) : "Never",
        dropdownSettings, totalMarks }));
      setMessage("Successfully saved");
      setSaving(true);
      redirectRef.current = setTimeout(() => { setMessage(""); setSaving(false); router.push("/assessments/create/review"); }, 3000);
    } catch { setMessage("Unable to save settings"); setSaving(false); }
  };
  return <main className="superAdminPage institutionAdminPage evaluationAppShell"><div className="dashboardLayout evaluationDashboardLayout">
    <Sidebar /><section className="mainContent evaluationMainContent"><div className="evaluationHeaderSlot"><Header /></div><div className="institutionScrollArea evaluationScrollArea"><div className="pageContent institutionPageContent evaluationPageContent">
      <nav className="evaluationBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><span className="evaluationBreadcrumbChevrons" aria-hidden="true">»</span><span>Create Assessment</span></nav>
      <ol className="evaluationWizard" aria-label="Assessment creation progress">{steps.map((step, index) => <li key={step} className={`evaluationWizardStep ${index < 3 ? "is-complete" : index === 3 ? "is-current" : "is-upcoming"}`} aria-current={index === 3 ? "step" : undefined}><WizardStepLink index={index} current={3}/><span className="evaluationWizardNumber"><span className="evaluationWizardDigit">{index + 1}</span></span><span className="evaluationWizardLabel">{step}</span></li>)}</ol>
      <div className="evaluationTitleGroup"><h1>Assessment Evaluation (Long Answer)</h1><p>Set Evaluation, Feedback, Results, And Security.</p></div>
       <div className="evaluationQuestionLayout"><div className="evaluationQuestionMain">
      <div className="evaluationPanels">{categories.map(category => { const isOpen = openPanels.includes(category.id); return <section key={category.id} className={`evaluationPanel evaluationPanel--${category.id} ${isOpen ? "is-open" : ""}`}>
        <div className="evaluationPanelHeader"><div className="evaluationPanelIcon" aria-hidden="true"><img src={category.iconSrc} alt="" width={37} height={37} onError={event => { event.currentTarget.style.visibility = "hidden"; }} /></div><div className="evaluationPanelText"><h2>{category.heading}</h2><p>{category.subtitle}</p></div><button type="button" className="evaluationExpandButton" aria-label={`${isOpen ? "Collapse" : "Expand"} ${category.heading}`} aria-expanded={isOpen} aria-controls={`evaluation-content-${category.id}`} onClick={() => togglePanel(category.id)}><img className="evaluationChevronAsset" src="/assets/assessmenticons/arrow-down-01.svg" width={20} height={20} alt=""/></button></div>
        <div className="evaluationPills" aria-label={`${category.heading} sections`}>{category.tabs.map(tab => <span key={tab} className={`evaluationPill ${isOpen && activeTabs[category.id] === tab ? "is-selected" : ""}`}>{tab}</span>)}</div>
        {isOpen && <div className="evaluationPanelBody evaluationDetailedBody" id={`evaluation-content-${category.id}`}><EvaluationPanelContents panel={category.id} settings={dropdownSettings} onChange={updateDropdown} totalMarks={totalMarks} passingScore={settings.passingScore}/></div>}
      </section>; })}</div>
      <div className="evaluationFooter"><button type="button" className="evaluationFooterButton" onClick={() => { if (redirectRef.current) { clearTimeout(redirectRef.current); redirectRef.current=null; } setSaving(false); router.push("/assessments/create/content"); }}>Back</button><div className="evaluationFooterRight">{message && <span role={message === "Successfully saved" ? "status" : "alert"} className={`evaluationSaveMessage ${message === "Successfully saved" ? "" : "evaluationSaveError"}`}>{message}</span>}<button type="button" className="evaluationFooterButton evaluationContinue" disabled={saving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
       </div></div>
    </div></div></section></div></main>;
}
