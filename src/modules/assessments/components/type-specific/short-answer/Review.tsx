"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./review.css";

type Dict = Record<string, unknown>;
type ReviewQuestion = { text?: string; answer?: string; points?: string | number; correct?: number; options?: string[]; difficulty?: string; bloom?: string; mandatory?: boolean };
const ROOT = "/assets/assessmenticons/";
const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"];
const get = (data: Dict, keys: string[], fallback = "—"): string => {
  for (const key of keys) { const value = data[key]; if (value !== null && value !== undefined && String(value).trim()) return String(value); }
  return fallback;
};
const boolText = (value: unknown, fallback = true) => value === undefined || value === null ? fallback : value === true || ["true", "on", "yes", "1"].includes(String(value).trim().toLowerCase());
function Asset({ name, size = 18 }: { name: string; size?: number }) { return <img src={`${ROOT}${name}`} alt="" width={size} height={size} className="reviewAsset" />; }
function ReviewTick({ blue = false }: { blue?: boolean }) { return <span className={`reviewTick ${blue ? "reviewTickBlue" : ""}`} aria-hidden="true"><span /></span>; }
function ReviewSwitch({ enabled }: { enabled: boolean }) { return <span className={`reviewSwitch ${enabled ? "isOn" : ""}`} aria-label={enabled ? "On" : "Off"}><span>{enabled ? "ON" : "OFF"}</span><i /></span>; }
function ReadField({ label, value, wide = false, accent = false }: { label: string; value: React.ReactNode; wide?: boolean; accent?: boolean }) { return <div className={`reviewField ${wide ? "reviewWide" : ""}`}><span className="reviewLabel">{label}</span><div className={`reviewValue ${accent ? "reviewAccent" : ""}`}>{value}</div></div>; }
function ReadSetting({ label, value }: { label: string; value: React.ReactNode }) { return <div className="reviewSetting"><span>{label}</span><div className="reviewSettingValue">{value}</div></div>; }
function ReadSwitch({ label, on }: { label: string; on: boolean }) { return <ReadSetting label={label} value={<ReviewSwitch enabled={on} />} />; }
function InnerCard({ heading, icon, children }: { heading: string; icon: string; children: React.ReactNode }) { return <section className="reviewInnerCard"><h3><span className="reviewSmallIcon"><Asset name={icon} size={18}/></span>{heading}</h3><div className="reviewInnerRows">{children}</div></section>; }
function ReviewSection({ number, title, icon, editRoute, children }: { number: number; title: string; icon: string; editRoute: string; children: React.ReactNode }) { return <section className="reviewSection"><div className="reviewSectionHead"><div className="reviewSectionTitle"><span className="reviewNumber"><Asset name={icon} size={20}/></span><strong>{number}. {title}</strong></div><Link className="reviewEdit" href={editRoute}><Asset name="editbig.svg" size={24}/>Edit</Link></div><div className="reviewSectionBody">{children}</div></section>; }

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
    "True / False": "T/F", "True/False": "T/F", "Short Answer": "SA",
    "One-Word Answer": "OW", "One Word Answer": "OW",
    "Fill in the Blank": "FB", "Fill in the blanks": "FB",
    "Long Answer / Essay": "LS", "Long Answer": "LS",
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
      const details = read("shortAnswerAssessmentDraft");
      const content = kind === "short" ? read("shortAnswerContentDraft") : read("shortAnswerContentDraft");
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
    const type = question?.type || (kind === "short" ? "Short Answer" : "MCQ");
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
        <Asset name="arrow-down-01.svg" size={18} />
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

export default function MCQReviewPage() {
  const router = useRouter();
  const [publishError,setPublishError] = useState("");
  const publish = () => { try { publishAssessment("short-answer"); router.push("/assessments/create"); } catch (error) { setPublishError(error instanceof Error ? error.message : "Unable to publish"); } };
  const [details, setDetails] = useState<Dict>({});
  const [evaluation, setEvaluation] = useState<Dict>({});
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [content, setContent] = useState<Dict>({});
  useEffect(() => {
    const read = (key: string): Dict => { try { return JSON.parse(assessmentStorage.getItem(key) || "{}") as Dict; } catch { return {}; } };
    const a = read("shortAnswerAssessmentDraft"); const c = read("shortAnswerContentDraft");
    const savedEvaluation = read("shortAnswerEvaluationDraft");
    const variantOptions = savedEvaluation.dropdownSettings && typeof savedEvaluation.dropdownSettings === "object" ? savedEvaluation.dropdownSettings as Dict : {};
    setDetails(a); setEvaluation({...savedEvaluation, ...variantOptions}); setContent(c);
    if (Array.isArray(c.questions)) setQuestions(c.questions as ReviewQuestion[]);
  }, []);
  const total = get(details, ["totalMarks"], "40");
  const count = get(details, ["questionCount"], "20");
  const mark = get(details, ["marksPerQuestion"], "1");
  const pass = get(details, ["passingScore", "gradeToPass"], get(evaluation, ["passingScore"], "60"));
  const passNumber = Number(pass.replace(/[^0-9.]/g, ""));
  const passingMarks = Number.isFinite(passNumber) ? `${Math.round(Number(total) * passNumber / 100)}/${total}` : "—";
  const duration = get(details, ["duration", "timeLimit"], "30 Minutes");
  const title = get(details, ["assessmentTitle", "title", "assessmentName"], "Introduction to Artificial Intelligence");
  const course = get(details, ["course", "courseName"], "Introduction to AI");
  const learnerRecords = Array.isArray(details.accommodationRows) ? details.accommodationRows as { learner: string; id?: string; extraTime?: string; accommodation?: string }[] : [];
  const totalQuestionMarks = questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
  const allCorrect = questions.length > 0 && questions.every(q => !!q.text?.trim() && !!q.answer?.trim() && Number(q.points || 0) > 0);
  const setting = (key: string, fallback = "on") => get(evaluation, [key], fallback);
  const isOn = (key: string, fallback = "on") => boolText(setting(key, fallback));
  return <main className="superAdminPage institutionAdminPage reviewAppShell"><div className="dashboardLayout reviewDashboardLayout"><Sidebar/><section className="mainContent reviewMainContent"><div className="reviewHeaderSlot"><Header/></div><div className="institutionScrollArea reviewScrollArea"><div className="pageContent institutionPageContent reviewPageContent">
    <nav className="reviewBreadcrumb"><Link href="/assessments">Assessment</Link><Asset name="arrowrightdouble.svg" size={18}/><strong>Create Assessment</strong></nav>
    <ol className="reviewWizard" aria-label="Assessment creation progress">{STEPS.map((label, index) => <li key={label} className={`reviewWizardStep ${index < 4 ? "isDone" : "isCurrent"}`} aria-current={index === 4 ? "step" : undefined}><span className="reviewWizardNumber"><span>{index + 1}</span></span><span>{label}</span><WizardStepLink index={index} current={4}/></li>)}</ol>
    <header className="reviewPageHeading"><h1>Review And Publish</h1><p>Everything Looks Ready ?</p></header>
    <div className="reviewBodyLayout"><div className="reviewBodyPrimary"><div className="reviewSections">
      <ReviewSection number={1} title="Basic Information" icon="google-doc.svg" editRoute="/assessments/create/details?reviewSection=0"><div className="reviewFieldGrid two">
        <ReadField label="Assessment Name" value={title}/><ReadField label="Assessment Type" value={get(details,["assessmentType"],"MCQ")}/>
        <ReadField label="Course" value={course}/><ReadField label="Module/ Unit" value={get(details,["module", "moduleUnit"],"Module 3 - AI Fundamentals")}/>
        <ReadField label="Category / Tags" value={Array.isArray(details.tags) ? details.tags.join(", ") : get(details,["category","tags"],"Artificial Intelligence, Fundamentals")} accent/><ReadField label="Language" value={get(details,["language"],"English")}/>
        <ReadField label="Description / Instructions" value={get(details,["description", "instructions"],"Assess learner understanding of core AI concepts.")} wide/>
      </div></ReviewSection>
      <ReviewSection number={2} title="Scoring & Grading" icon="gtarget.svg" editRoute="/assessments/create/details?reviewSection=1"><div className="reviewFieldGrid three">
        <ReadField label="Total Marks" value={total}/><ReadField label="Number of Question" value={count}/><ReadField label="Marks per Question" value={mark}/>
        <ReadField label="Negative Marking" value={get(details,["negativeMarkingValue"],"-0.25")}/><ReadField label="Passing Score" value={`${pass}%`}/><ReadField label="Grade to Pass" value={get(details,["gradeToPassScore"],"C")}/>
        <ReadField label="Grade category" value={get(details,["gradeCategory"],"A - 91-100%")}/><ReadField label="Partial Credit" value={<span className="reviewInlineSwitch">{get(details,["partialCreditMethod"],"Award partial marks")}<ReviewSwitch enabled={boolText(details.partialCredit, false)}/></span>}/><ReadField label="Rounding Rule" value={get(details,["roundingRule"],"Round 2 Assessment")}/>
        <div className="reviewField reviewWide reviewMarkingField"><span className="reviewLabel">Marking Scheme</span><div className="reviewMarkingFrame"><div className="reviewMarking"><ReviewTick blue/><span>{get(details,["markingScheme"],"Fixed marks per question")}</span></div></div></div>
      </div></ReviewSection>
      <ReviewSection number={3} title="Timing & Availability" icon="calendar.svg" editRoute="/assessments/create/details?reviewSection=2"><div className="reviewFieldGrid three">
        <ReadField label="Time Limit" value={<span className="reviewInlineSwitch">{duration}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.timeLimit)}/></span>}/>
        <ReadField label="Per question Timer" value={<span className="reviewInlineSwitch">{get(details,["perQuestionTimer"],"Set Time Per Question")}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.perQuestionTimer, false)}/></span>}/>
        <ReadField label="Time Zone" value={get(details,["timeZone"],"Asia/Kolkata")}/>
        <ReadField label="Available From" value={get(details,["availableFrom"],"12-10-2026 11:30 AM")}/><ReadField label="Available Until" value={get(details,["availableUntil"],"18-10-2026 11:30 AM")}/>
        <ReadField label="Late Submission" value={<span className="reviewInlineSwitch">{get(details,["lateSubmission"],"Grace Period - 10 Min")}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.lateSubmission)}/></span>}/>
      </div></ReviewSection>
      <ReviewSection number={4} title="Attempts & Access" icon="orefresh.svg" editRoute="/assessments/create/details?reviewSection=3"><div className="reviewFieldGrid three"><ReadField label="Number of Attempts" value={get(details,["attempts","allowedAttempts"],"2")}/><ReadField label="Attempt Cooldown" value={setting("cooldown","15 min")}/><ReadField label="Grading Method" value={get(details,["gradingMethod"],"Highest Score")}/><ReadField label="Access Code" value={get(details,["accessCode"],"A78X- K942")}/><ReadField label="Browser Lockdown" value={<span className="reviewInlineSwitch">Secure Exam Browser<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.browserLockdown)}/></span>}/><ReadField label="Webcam Proctoring" value={<span className="reviewInlineSwitch">Camera Check<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.webcamProctoring)}/></span>}/><ReadField label="Prerequisite" value={<span className="reviewInlineSwitch">Previous Assessment<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.prerequisite)}/></span>}/></div>
        <div className="reviewLearnerArea"><h3>Extra Time / Accommodations</h3><div className="reviewTableWrap"><table><thead><tr><th>Learner</th><th>ID</th><th>Extra Time</th><th>Accommodation</th></tr></thead><tbody>{learnerRecords.length ? learnerRecords.map((row,i)=><tr key={`${row.id || row.learner}-${i}`}><td><span className="reviewLinkText">{row.learner}</span></td><td>{row.id || `S${String(i+1).padStart(3,"0")}`}</td><td>{row.extraTime || "—"}</td><td>{row.accommodation || "—"}</td></tr>) : <tr><td colSpan={4}>No learner accommodations added.</td></tr>}</tbody></table></div></div>
      </ReviewSection>
      <ReviewSection number={5} title="Audience" icon="user-multiple2.svg" editRoute="/assessments/create/details?reviewSection=4"><div className="reviewFieldGrid two"><ReadField label="Who can take this assessment?" value={get(details,["audience", "assignTo", "whoCanTake"],"All enrolled learners")}/><ReadField label="Batch / Cohort" value={get(details,["batch", "batchCohort", "cohort"],"2026 — Batch A")}/><ReadField label="Academic Year" value={get(details,["academicYear"],"2026–2027")}/><ReadField label="Department" value={get(details,["department"],"Computer Science")}/><ReadField label="Section / Class" value={get(details,["section"],"Section A")}/><ReadField label="Excluded Learners" value={get(details,["excludedLearners", "exclusions"],"None")}/><ReadField label="Notify learners when published" value={<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.notifyLearners)}/>}/></div></ReviewSection>
      <ReviewSection number={6} title="Questions" icon="circle-question-mark.svg" editRoute="/assessments/create/content?reviewEdit=questions"><div className="reviewFieldGrid two"><ReadField label="Total Questions" value={count}/><ReadField label="Marks" value={totalQuestionMarks || total}/><ReadField label="All Answers Verified" value={<span className="reviewStatus"><ReviewTick/>{questions.length ? (allCorrect ? "All Questions Completed" : "Review incomplete questions") : "Question data not saved yet"}</span>}/><ReadField label="Feedback" value={<span className="reviewStatus"><ReviewTick/> {Object.keys(content).length ? "Added" : "Awaiting question data"}</span>}/><ReadField label="Explanation" value={<span className="reviewStatus"><ReviewTick/> {Object.keys(content).length ? "Added" : "Awaiting question data"}</span>}/><ReadField label="Mandatory" value={questions.length ? `${questions.filter(q=>q.mandatory).length}/${questions.length}` : "—"}/><ReadField label="Difficulty" value={<div className="reviewPillGroup">{["Easy","Medium","Hard"].map((level,i)=><span key={level} className="reviewValuePill"><ReviewTick blue/>{questions.filter(q=>q.difficulty===level).length || (questions.length ? "0" : i+1)} {level}</span>)}</div>}/><ReadField label="Bloom's" value={<span className="reviewValuePill"><ReviewTick blue/>{questions[0]?.bloom || "Analyze"}</span>}/></div></ReviewSection>
      <ReviewSection number={7} title="Results" icon="chart.svg" editRoute="/assessments/create/evaluation"><div className="reviewFieldGrid two"><ReadField label="Show Result After Submission" value={<ReviewSwitch enabled={isOn("showResultAfterSubmission", isOn("showResults") ? "on" : "off")}/>}/><ReadField label="Show Score" value={<ReviewSwitch enabled={isOn("showScore")}/>}/><ReadField label="Show Pass/ Fail" value={<ReviewSwitch enabled={isOn("passFail")}/>}/><ReadField label="Show Correct Answers" value={<ReviewSwitch enabled={isOn("showCorrectAnswers")}/>}/><ReadField label="Result Available" value={setting("resultAvailable", "Immediately")}/></div></ReviewSection>
      <ReviewSection number={8} title="Feedback" icon="message-circle-more.svg" editRoute="/assessments/create/evaluation?reviewPanel=feedback"><div className="reviewInnerGrid"><InnerCard heading="ANSWER FEEDBACK" icon="message-02.svg"><ReadSwitch label="Show Answer Feedback" on={isOn("answerFeedback")}/><ReadSwitch label="Show Explanation" on={isOn("explanation")}/><ReadSetting label="Feedback Timing" value={setting("feedbackTiming","After")}/><div className="reviewCheckStack">{["Correct Answer Feedback","Wrong Answer Feedback","Question Explanation"].map(label=><span key={label}><ReviewTick/>{label}</span>)}</div></InnerCard><InnerCard heading="COGNITIVE & BEHAVIORAL INSIGHTS" icon="blueview.svg"><ReadSwitch label="Answer Switching Behavioral" on={isOn("answerSwitching")}/><ReadSwitch label="Review Wrong Answers" on={isOn("reviewWrong")}/><ReadSwitch label="View Weakness Map" on={isOn("weaknessMap")}/></InnerCard></div></ReviewSection>
      <ReviewSection number={9} title="Security & Integrity" icon="shield-check.svg" editRoute="/assessments/create/evaluation?reviewPanel=security"><div className="reviewInnerGrid"><InnerCard heading="ASSESSMENT ACCESS" icon="lock.svg"><ReadSetting label="Access Control" value={setting("accessControl","Open")}/><ReadSwitch label="Require Secure Browser" on={isOn("secureBrowser")}/><ReadSwitch label="Prevent Copy / Paste" on={isOn("copyPaste")}/><ReadSwitch label="Prevent Printing" on={isOn("printing")}/></InnerCard><InnerCard heading="PROCTORING" icon="video.svg"><ReadSwitch label="Webcam Monitoring" on={isOn("webcam")}/><ReadSwitch label="Screen Monitoring" on={isOn("screenMonitoring")}/><ReadSwitch label="Full-Screen Mode" on={isOn("fullScreen")}/><ReadSwitch label="Identity Verification" on={isOn("identity")}/></InnerCard><InnerCard heading="MONITORING" icon="blueview.svg"><ReadSwitch label="Detect Tab Switching" on={isOn("tabSwitching")}/><ReadSwitch label="Detect Multiple Screens" on={isOn("multipleScreens")}/><ReadSwitch label="Detect Browser Exit" on={isOn("browserExit")}/><ReadSwitch label="Record Violations" on={isOn("recordViolations")}/><ReadSetting label="Violation Threshold" value={setting("violationThreshold","3")}/><ReadSetting label="Action" value={setting("violationAction","Warn")}/></InnerCard></div></ReviewSection>
    </div><footer className="reviewFooter"><button type="button" onClick={()=>router.push("/assessments/create/evaluation")}>Back</button>{publishError && <span role="alert" className="reviewPublishError">{publishError}</span>}<button type="button" className="reviewPublish" onClick={publish}>Publish</button></footer>
    </div></div>
  </div></div></section></div></main>;
}
