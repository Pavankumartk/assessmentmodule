"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  Eye,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Target,
  Video,
  X,
} from "lucide-react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
// Reuse the exact same 5-chevron progress bar, number circles and breadcrumb.

import "./evaluation.css";

type Settings = {
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

const initialSettings: Settings = {
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

type SettingKey = keyof Settings;
type SwitchKey = { [K in SettingKey]: Settings[K] extends boolean ? K : never }[SettingKey];
type SelectKey = { [K in SettingKey]: Settings[K] extends string ? K : never }[SettingKey];

function SettingSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`ev-switch ${checked ? "ev-switch-on" : "ev-switch-off"}`} type="button"
      role="switch" aria-label={label} aria-checked={checked} onClick={onChange}>
      <span className="ev-switch-word">{checked ? "ON" : "OFF"}</span><span className="ev-switch-knob" />
    </button>
  );
}

function MatchingMcqDropdown({label,value,options,onSelect}:{label:string;value:string;options:string[];onSelect?:(next:string)=>void}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  return <div className="evaluationMiniSelectWrap" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="evaluationMiniSelectTrigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span>{value || `Select ${label.toLowerCase()}`}</span>
      <img src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={17} height={17}/>
    </button>
    {open&&<div className="evaluationMiniSelectMenu" role="listbox" aria-label={label}>
      {options.map(option=><button type="button" key={option} role="option" aria-selected={value===option} className={`evaluationMiniSelectOption ${value===option ? "is-selected" : ""}`} onClick={()=>{onSelect?.(option);setOpen(false);}}>{option}</button>)}
    </div>}
  </div>;
}

function SettingRow({ label, value, options, checked, onSelect, onToggle }: {
  label: string;
  value?: string;
  options?: string[];
  checked?: boolean;
  onSelect?: (value: string) => void;
  onToggle?: () => void;
}) {
  return (
    <div className="ev-setting-row">
      <span className="ev-setting-name">{label}</span>
      {onToggle ? <SettingSwitch label={label} checked={Boolean(checked)} onChange={onToggle} /> : options ? (
        <MatchingMcqDropdown label={label} value={value || ""} options={options} onSelect={onSelect}/>
      ) : <span className="ev-setting-value">{value || "—"}</span>}
    </div>
  );
}

function SettingCard({ title, icon, color, children, id }: {
  title: string;
  icon: ReactNode;
  color: string;
  children: ReactNode;
  id?: string;
}) {
  return <section className="ev-setting-card" id={id} aria-label={title}>
    <h3 className="ev-card-heading"><span className="ev-card-icon" style={{ color }}>{icon}</span><span>{title}</span></h3>
    <div className="ev-card-rows">{children}</div>
  </section>;
}

// Saved questions for the existing evaluation summary. No sample questions are inserted.
type EvaluationQuestion = {
  type?: string;
  text?: string;
  question?: string;
  points?: number | string;
  category?: string;
  bloom?: string;
  difficulty?: string;
  options?: string[];
  correct?: number;
};

type SavedQuestionBundle = {
  questions?: EvaluationQuestion[];
  extras?: Record<string, { type?: string; correct?: string }>;
};

type QuestionRailItem = {
  index: number;
  type: string;
  label: string;
  text: string;
  points: number;
  configured: boolean;
  needsAttention: boolean;
};

function shortQuestionType(type: string): string {
  const names: Record<string, string> = {
    "True / False": "T/F", "True/False": "T/F", "MCQ": "MCQ",
    "Multiple Choice Question (MCQ)": "MCQ", "One-Word Answer": "OW",
    "One Word Answer": "OW", "Fill in the Blank": "FB",
    "Fill in the blanks": "FB", "Short Answer": "SA",
    "Long Answer / Essay": "LS", "Long Answer": "LS",
    "Drag & Drop": "DD", "Image-Based Assessment": "IM",
    "Multiple Response": "MR", "Quick Quiz": "QC",
  };
  return names[type] ?? type.split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 3).toUpperCase();
}

function buildQuestionRail(questions: EvaluationQuestion[], extras: SavedQuestionBundle["extras"], total: number): QuestionRailItem[] {
  return Array.from({ length: total }, (_, index) => {
    const q = questions[index];
    const text = typeof q?.text === "string" ? q.text : typeof q?.question === "string" ? q.question : "";
    const rawType = extras?.[String(index)]?.type || q?.type || "One-Word Answer";
    const type = typeof rawType === "string" ? rawType : "One-Word Answer";
    const points = Number(q?.points ?? 0);
    const configured = Boolean(text.trim() && Number.isFinite(points) && points > 0);
    const validOptions = Array.isArray(q?.options) && q.options.length > 0
      ? q.options.filter(value => typeof value === "string" && value.trim()).length >= 2 && typeof q.correct === "number" && q.correct >= 0
      : true;
    const needsAttention = !configured || !validOptions || !q?.category || !q?.bloom;
    return { index, type, label: shortQuestionType(type), text, points: Number.isFinite(points) ? points : 0, configured, needsAttention };
  });
}

const progress = ["Type", "Details", "Content", "Evaluation", "Review"];

export default function EvaluationPage() {
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); }, []);
  const [totalMarks, setTotalMarks] = useState(30);
  const [passingScore, setPassingScore] = useState("60%");
  const [activeFeedbackTab, setActiveFeedbackTab] = useState("");
  const [activeSecurityTab, setActiveSecurityTab] = useState("");
  const pageRef = useRef<HTMLElement>(null);
  const [questionCount, setQuestionCount] = useState(20);
  const [savedQuestions, setSavedQuestions] = useState<EvaluationQuestion[]>([]);
  const [savedExtras, setSavedExtras] = useState<SavedQuestionBundle["extras"]>({});
  const [railFilter, setRailFilter] = useState<"all" | "attention">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);

  useEffect(() => {
    try {
      const previous = assessmentStorage.getItem("neurolxp-one-word-evaluation");
      if (previous) {
        const parsed = JSON.parse(previous) as Partial<Settings>;
        setSettings({ ...initialSettings, ...parsed });
      }
      const draft = assessmentStorage.getItem("oneWordAssessmentDraft");
      if (draft) {
        const details = JSON.parse(draft) as { totalMarks?: string; passingScore?: string; attempts?: string; cooldown?: string; gradingMethod?: string };
        const marks = Number(details.totalMarks);
        if (Number.isFinite(marks) && marks > 0) setTotalMarks(marks);
        if (details.passingScore) setPassingScore(details.passingScore);
        setSettings((old) => ({ ...old,
          ...(details.attempts ? { maximumAttempts: details.attempts } : {}),
          ...(details.cooldown ? { attemptCooldown: details.cooldown } : {}),
          ...(details.gradingMethod ? { scoreForResult: details.gradingMethod.toLowerCase().includes("highest") ? "Highest" : "Latest" } : {}),
        }));
      }
    } catch { /* Keep all screenshot defaults if no prior draft exists. */ }
  }, []);

  useEffect(() => {
    // Content and assessment details are saved by the existing One-Word flow.
    // Read-only: do not alter the question builder or its storage format.
    try {
      const details = JSON.parse(assessmentStorage.getItem("oneWordAssessmentDraft") || "{}") as { questionCount?: number | string };
      const count = Number(details.questionCount);
      const content = JSON.parse(assessmentStorage.getItem("oneWordContentDraft") || "{}") as SavedQuestionBundle;
      const preview = JSON.parse(assessmentStorage.getItem("oneWordPreviewDraft") || "{}") as SavedQuestionBundle;
      const chosen = Array.isArray(content.questions) && content.questions.length ? content : preview;
      const questions = Array.isArray(chosen.questions) ? chosen.questions : [];
      setSavedQuestions(questions);
      setSavedExtras(chosen.extras || {});
      setQuestionCount(Number.isFinite(count) && count > 0 ? Math.max(Math.floor(count), questions.length) : Math.max(20, questions.length));
    } catch {
      // Keep an empty question summary if the saved draft is unavailable.
    }
  }, []);

  const questionItems = useMemo(() => buildQuestionRail(savedQuestions, savedExtras, questionCount), [savedQuestions, savedExtras, questionCount]);
  const configuredCount = questionItems.filter(q => q.configured).length;
  const needsAttentionCount = questionItems.filter(q => q.needsAttention).length;
  const questionTypes = Array.from(new Set(questionItems.filter(q => q.configured).map(q => q.type)));
  const shownQuestions = questionItems.filter(q => (railFilter === "all" || q.needsAttention) && (typeFilter === "all" || q.type === typeFilter));

  const passingMarks = useMemo(() => {
    const percentage = Number.parseFloat(passingScore);
    return Number.isFinite(percentage) ? `${Number(((percentage / 100) * totalMarks).toFixed(2))}/${totalMarks}` : `—/${totalMarks}`;
  }, [passingScore, totalMarks]);

  function setSelect(key: SelectKey, value: string) { setSettings((prev) => ({ ...prev, [key]: value })); }
  function flip(key: SwitchKey) { setSettings((prev) => ({ ...prev, [key]: !prev[key] })); }
  function selectRow(label: string, key: SelectKey, options: string[]) {
    return <SettingRow label={label} value={settings[key]} options={options} onSelect={(v) => setSelect(key, v)} />;
  }
  function switchRow(label: string, key: SwitchKey) {
    return <SettingRow label={label} checked={settings[key]} onToggle={() => flip(key)} />;
  }
  function saveDraft(): boolean {
    try {
      assessmentStorage.setItem("neurolxp-one-word-evaluation", JSON.stringify(settings));
      setNotice("");
      return true;
    } catch { setNotice("Browser storage is unavailable. Settings remain on this page."); return false; }
  }
  function continueToReview() {
    if (saving) return;
    const percentage = Number.parseFloat(passingScore);
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
      setNotice("Total marks must be greater than zero.");
      return;
    }
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      setNotice("Passing score must be between 1% and 100%.");
      return;
    }
    if (configuredCount === 0) {
      setNotice("Add at least one question in Content before continuing to Review.");
      return;
    }
    if (!saveDraft()) return;
    setSaving(true);
    saveTimer.current = window.setTimeout(() => { setSaving(false); window.dispatchEvent(new CustomEvent("one-word-step", { detail: "review" })); }, 3000);
  }
  function goToTab(section: "feedback" | "security", tab: string, target: string) {
    if (section === "feedback") { setFeedbackOpen(true); setActiveFeedbackTab(tab); }
    else { setSecurityOpen(true); setActiveSecurityTab(tab); }
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <div className="oneWordEvalShell"><div className="oneWordEvalLayout"><Sidebar/><div className="oneWordEvalMain"><Header/><div className="oneWordEvalScroll">
      <div className="sa-route sa-route-in-shell ev-route">
        <main className="sa-screen ev-screen" ref={pageRef}>
          <div className="sa-content ev-content">
            <nav className="sa-breadcrumb ev-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("one-word-step", { detail: "type" }))}>Assessment</button>
              <ChevronsRight size={20} aria-hidden="true" />
              <strong>Create Assessment</strong>
            </nav>
            <ol className="sa-progress ev-progress" aria-label="Assessment creation steps">
              {progress.map((name, index) => <li key={name}
                className={`sa-step ${index === 3 ? "sa-step-current" : ""} ${index < 3 ? "sa-step-complete" : ""}`}
                aria-current={index === 3 ? "step" : undefined}>
                <WizardStepLink index={index} current={3}/><span className="sa-step-number">{index + 1}</span><span className="sa-step-title">{name}</span>
              </li>)}
            </ol>

            <div className="ev-page-title">
              <h1>Assessment Details (One-Word)</h1>
              <p>Set Evaluation, Feedback, Results, And Security.</p>
            </div>

            <div className="ev-body-layout">
              <div className="ev-body-primary">
            <section className={`ev-major-section ${feedbackOpen ? "ev-major-section-expanded" : ""}`} aria-label="Feedback and results">
              <div className="ev-major-header">
                <div className="ev-major-header-inner">
                  <span className="ev-major-main-icon" style={{ color: "#67096E" }}><img src="/assets/assessmenticons/chartpurple.svg" alt="" width={34} height={34}/></span>
                  <div className="ev-header-copy">
                    <h2 className="ev-purple">Feedback And Results</h2>
                    <p>Configure Scoring, Passing Criteria, Attempts, And What Learners See After Completing The Assessment.</p>
                    <div className="ev-tabs ev-tabs-feedback" aria-label="Feedback and results categories">
                      {[["Score", "ev-scoring"], ["Passing", "ev-scoring"], ["Attempts", "ev-attempts"], ["Feedback", "ev-feedback"], ["Results", "ev-results"]].map(([label, target]) =>
                        <button key={label} type="button" className={`ev-tab ev-tab-purple ${activeFeedbackTab === label ? "ev-tab-selected" : ""}`} onClick={() => goToTab("feedback", label, target)}>{label}</button>)}
                    </div>
                  </div>
                </div>
                <button className="ev-section-toggle ev-purple" type="button" aria-label="Toggle Feedback and Results" aria-expanded={feedbackOpen} onClick={() => setFeedbackOpen((v) => !v)}>
                  {feedbackOpen ? <ChevronUp size={29}/> : <ChevronDown size={29}/>}
                </button>
              </div>
              {feedbackOpen && <div className="ev-card-grid">
                <SettingCard id="ev-scoring" title="Scorings" icon={<img src="/assets/assessmenticons/target.svg" alt="" width={22} height={22}/>}  color="#2D4CC8">
                  <SettingRow label="Total Marks" value={String(totalMarks)} />
                  <SettingRow label="Passing Score" value={passingScore} />
                  <SettingRow label="Passing Marks" value={passingMarks} />
                </SettingCard>
                <SettingCard id="ev-attempts" title="Attempts" icon={<img src="/assets/assessmenticons/refresh.svg" alt="" width={22} height={22}/>}  color="#2A7308">
                  {selectRow("Maximum Attempts", "maximumAttempts", ["1", "2", "3", "4", "5", "Unlimited"])}
                  {selectRow("Score used for Result", "scoreForResult", ["Highest", "Latest", "Average", "First Attempt"])}
                  {selectRow("Attempt Cooldown", "attemptCooldown", ["None", "1 Hr", "6 Hrs", "12 Hrs", "24 Hrs", "48 Hrs"])}
                </SettingCard>
                <SettingCard id="ev-results" title="Results" icon={<img src="/assets/assessmenticons/chart-up2.svg" alt="" width={22} height={22}/>}  color="#CB5F14">
                  {switchRow("Show Result After Submission", "showResult")}
                  {switchRow("Show Score", "showScore")}
                  {switchRow("Show Pass/ Fail", "showPassFail")}
                  {switchRow("Show Correct Answers", "showCorrectAnswers")}
                  {selectRow("Result Available", "resultAvailable", ["Immediately", "Scheduled", "After Grading", "After Closing", "Manually", "Never"])}
                  {settings.showResult && settings.resultAvailable === "Scheduled" && <label className="ev-setting-row"><span>Result release date and time</span><input aria-label="Result release date and time" type="datetime-local" value={settings.resultReleaseDate} onChange={event=>setSettings(old=>({...old,resultReleaseDate:event.target.value}))}/></label>}
                </SettingCard>
                <SettingCard id="ev-feedback" title="Answer Feedback" icon={<img src="/assets/assessmenticons/message-circle-more.svg" alt="" width={22} height={22}/>}  color="#91860C">
                  {switchRow("Show Answer Feedback", "showAnswerFeedback")}
                  {switchRow("Show Explanation", "showExplanation")}
                  {selectRow("Feedback Timing", "feedbackTiming", ["After", "Immediately", "After Closing", "Never"])}
                  <div className="ev-feedback-checks" aria-label="Available feedback types">
                    {['Correct Answer Feedback', 'Wrong Answer Feedback', 'Question Explanation'].map(label =>
                      <span key={label}><span className="ev-tick"><Check size={14} strokeWidth={3}/></span>{label}</span>)}
                  </div>
                </SettingCard>
                <SettingCard id="ev-cognitive" title="Cognitive & Behavioral Insights" icon={<img src="/assets/assessmenticons/view2.svg" alt="" width={22} height={22}/>}  color="#89800C">
                  {switchRow("Answer Switching Behavioral", "answerSwitching")}
                  {switchRow("Review Wrong Answers", "reviewWrongAnswers")}
                  {switchRow("View Weakness Map", "weaknessMap")}
                </SettingCard>
              </div>}
            </section>

            <section className={`ev-major-section ${securityOpen ? "ev-major-section-expanded" : ""}`} aria-label="Security and integrity">
              <div className="ev-major-header">
                <div className="ev-major-header-inner">
                  <span className="ev-major-main-icon" style={{ color: "#2A7308" }}><img src="/assets/assessmenticons/security-lock.svg" alt="" width={34} height={34}/></span>
                  <div className="ev-header-copy">
                    <h2 className="ev-green">Security &amp; Integrity</h2>
                    <p>Configure Proctoring, Browser Restrictions, Question Security, And Assessment Integrity Controls.</p>
                    <div className="ev-tabs ev-tabs-security" aria-label="Security and integrity categories">
                      {[["Proctoring", "ev-proctoring"], ["Access", "ev-access"], ["Monitoring", "ev-monitoring"], ["Restrictions", "ev-restrictions"]].map(([label, target]) =>
                        <button type="button" key={label} className={`ev-tab ev-tab-green ${activeSecurityTab === label ? "ev-tab-selected" : ""}`} onClick={() => goToTab("security", label, target)}>{label}</button>)}
                    </div>
                  </div>
                </div>
                <button className="ev-section-toggle ev-green" type="button" aria-label="Toggle Security and Integrity" aria-expanded={securityOpen} onClick={() => setSecurityOpen(v => !v)}>
                  {securityOpen ? <ChevronUp size={29}/> : <ChevronDown size={29}/>}
                </button>
              </div>
              {securityOpen && <div className="ev-card-grid">
                <SettingCard id="ev-access" title="Assessment Access" icon={<img src="/assets/assessmenticons/lock.svg" alt="" width={22} height={22}/>}  color="#C65C15">
                  {selectRow("Access Control", "accessControl", ["Open", "Enrolled Only", "Access Code", "Restricted"])}
                  {switchRow("Require Secure Browser", "secureBrowser")}
                  {switchRow("Prevent Copy / Paste", "preventCopyPaste")}
                  {switchRow("Prevent Printing", "preventPrinting")}
                </SettingCard>
                <SettingCard id="ev-proctoring" title="Proctoring" icon={<img src="/assets/assessmenticons/video.svg" alt="" width={22} height={22}/>}  color="#2D4CC8">
                  {switchRow("Webcam Monitoring", "webcamMonitoring")}
                  {switchRow("Screen Monitoring", "screenMonitoring")}
                  {switchRow("Full-Screen Mode", "fullScreenMode")}
                  {switchRow("Identity Verification", "identityVerification")}
                </SettingCard>
                <SettingCard id="ev-monitoring" title="Monitoring" icon={<img src="/assets/assessmenticons/view2.svg" alt="" width={22} height={22}/>}  color="#89800C">
                  {switchRow("Detect Tab Switching", "detectTabSwitching")}
                  {switchRow("Detect Multiple Screens", "detectMultipleScreens")}
                  {switchRow("Detect Browser Exit", "detectBrowserExit")}
                  {switchRow("Record Violations", "recordViolations")}
                </SettingCard>
                <SettingCard id="ev-restrictions" title="Restriction" icon={<img src="/assets/assessmenticons/alert.svg" alt="" width={22} height={22}/>}  color="#89800C">
                  {selectRow("Violation Threshold", "violationThreshold", ["1", "2", "3", "4", "5", "10"])}
                  {selectRow("Action", "violationAction", ["Warn", "Notify Admin", "Submit Assessment", "Block Access"])}
                </SettingCard>
              </div>}
            </section>

            <footer className="ev-footer">
              <button className="ev-footer-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent("one-word-step", { detail: "content" }))}>Back</button>
              <div className="ev-footer-right">
                {notice && <span className="ev-validation-message" role="alert">{notice}</span>}
                {saving && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}
                <button className="ev-footer-button ev-footer-continue" type="button" disabled={saving} onClick={continueToReview}>Save &amp; Continue</button>
              </div>
            </footer>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div></div></div></div>
  );
}
