"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import {validateMcqDetails,validateMcqQuestions} from "@/modules/assessments/validation/mcq-validation";
import { assessmentStorage,updateAssessment,getActiveAssessmentId,getAssessment } from "@/modules/assessments/storage/assessment-storage";
import { getAssessmentAdapter } from "@/modules/assessments/config/component-registry";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "../../sidebar/page";
import Header from "../../header/Header";
import "./review.css";

type Dict = Record<string, unknown>;
type ReviewQuestion = { id?: string; text?: string; html?: string; question?: string; label?: string; title?: string; points?: string | number; correct?: number; options?: string[]; difficulty?: string; bloom?: string; mandatory?: boolean };
const ROOT = "/assets/assessmenticons/";
const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"];
const get = (data: Dict, keys: string[], fallback = "—"): string => {
  for (const key of keys) { const value = data[key]; if (value !== null && value !== undefined && String(value).trim()) return String(value); }
  return fallback;
};
const boolText = (value: unknown, fallback = true) => value === undefined ? fallback : value === true || value === "on" || value === "Yes";
function Asset({ name, size = 18 }: { name: string; size?: number }) { return <img src={`${ROOT}${name}`} alt="" width={size} height={size} className="reviewAsset" />; }
function ReviewTick({ blue = false }: { blue?: boolean }) { return <span className={`reviewTick ${blue ? "reviewTickBlue" : ""}`} aria-hidden="true"><span /></span>; }
function ReviewSwitch({ enabled }: { enabled: boolean }) { return <span className={`reviewSwitch ${enabled ? "isOn" : ""}`} aria-label={enabled ? "On" : "Off"}><span>{enabled ? "ON" : "OFF"}</span><i /></span>; }
function ReadField({ label, value, wide = false, accent = false }: { label: string; value: React.ReactNode; wide?: boolean; accent?: boolean }) { return <div className={`reviewField ${wide ? "reviewWide" : ""}`}><span className="reviewLabel">{label}</span><div className={`reviewValue ${accent ? "reviewAccent" : ""}`}>{value}</div></div>; }
function ReadSetting({ label, value }: { label: string; value: React.ReactNode }) { return <div className="reviewSetting"><span>{label}</span><div className="reviewSettingValue">{value}</div></div>; }
function ReadSwitch({ label, on }: { label: string; on: boolean }) { return <ReadSetting label={label} value={<ReviewSwitch enabled={on} />} />; }
function InnerCard({ heading, icon, children }: { heading: string; icon: string; children: React.ReactNode }) { return <section className="reviewInnerCard"><h3><span className="reviewSmallIcon"><Asset name={icon} size={18}/></span>{heading}</h3><div className="reviewInnerRows">{children}</div></section>; }
function ReviewSection({ number, title, icon, editRoute, children }: { number: number; title: string; icon: string; editRoute: string; children: React.ReactNode }) { return <section className="reviewSection"><div className="reviewSectionHead"><div className="reviewSectionTitle"><span className="reviewNumber"><Asset name={icon} size={20}/></span><strong>{number}. {title}</strong></div><Link className="reviewEdit" href={editRoute}><Asset name="editbig.svg" size={24}/>Edit</Link></div><div className="reviewSectionBody">{children}</div></section>; }
function AIReviewSection({title,editRoute,children}:{title:string;editRoute:string;children:React.ReactNode}) {
  const [open,setOpen]=useState(true);
  const id=`ai-review-${title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
  return <section className="aiReviewSection"><div className="aiReviewSectionHead"><h2>{title}</h2><div className="aiReviewSectionActions"><Link href={editRoute} className="aiReviewEdit"><Asset name="edit-03.svg" size={20}/>Edit</Link><button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${title}`} aria-expanded={open} aria-controls={id} className="aiReviewExpand" onClick={()=>setOpen(previous=>!previous)}><Asset name="arrow-down-01.svg" size={28}/></button></div></div>{open && <div className="aiReviewSectionBody" id={id}>{children}</div>}</section>;
}
function AIReviewField({label,value,wide=false}:{label:string;value:React.ReactNode;wide?:boolean}) {
  return <div className={`aiReviewField${wide ? " aiReviewFieldWide" : ""}`}><span className="aiReviewLabel">{label}</span><div className="aiReviewValue">{value}</div></div>;
}
function AIReviewSwitch({on}:{on:boolean}) {
  return <span className={`aiReviewSwitch${on ? " isOn" : ""}`} role="img" aria-label={on ? "On" : "Off"}><span>{on ? "ON" : "OFF"}</span><i/></span>;
}
const aiText = (value: unknown): string => String(value ?? "").replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();
type ReviewPageProps = {
  detailsKey?: string;
  contentKey?: string;
  evaluationKey?: string;
  dragAndDrop?: boolean;
  fillBlanks?: boolean;
  memoryGame?: boolean;
  trueFalse?: boolean;
};
export default function MCQReviewPage({detailsKey,contentKey,evaluationKey}:ReviewPageProps = {}) {
  const router = useRouter();
  const [publishError,setPublishError]=useState("");
  const [aiReviewMessage,setAiReviewMessage]=useState("");
  const [publishConfirmOpen,setPublishConfirmOpen]=useState(false);
  useEffect(() => { if (!publishConfirmOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPublishConfirmOpen(false); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [publishConfirmOpen]);
  const [publishSuccess,setPublishSuccess]=useState(false);
  const [activeType,setActiveType] = useState("mcq");
  const [typeLabel,setTypeLabel] = useState("MCQ");
  const [activeTitle,setActiveTitle] = useState("");
  const [activeCourse,setActiveCourse] = useState("");
  const [activeTotal,setActiveTotal] = useState(0);
  const publish=()=>{
    const record=getAssessment(getActiveAssessmentId()||"");
    if (!record || record.typeCode !== activeType) {setPublishError("Choose the assessment you are creating before publishing.");return;}
    if(activeType==="mcq"){
      const validDetails=validateMcqDetails(details);
      if(validDetails.ok===false){setPublishError(validDetails.message);return;}
      const validQuestions=validateMcqQuestions(questions,Number(details.questionCount??20),Number(details.totalMarks??20));
      if(validQuestions.ok===false){setPublishError(validQuestions.message);return;}
    } else {
      // The Drag & Drop / Memory Game creator persists questions in its own draft.
      // Never publish an empty draft by applying MCQ-only validation to these types.
      if (!questions.length) {setPublishError(`Save the ${typeLabel} questions in Content before publishing.`);return;}
      const configuredCount=Number(details.questionCount || details.questions || 0);
      if(configuredCount>0 && questions.length<configuredCount){setPublishError(`Save all ${configuredCount} questions before publishing.`);return;}
      if (getAssessmentAdapter(activeType)?.questionMode === "ai-interview" && questions.some(question => !String(question.html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").trim())) {setPublishError("Complete every AI question in Content before publishing.");return;}
      if (getAssessmentAdapter(activeType)?.questionMode === "ai-interview") {
        const validDetails=validateMcqDetails(details,{skipScoring:true});
        if (!validDetails.ok) {setPublishError(validDetails.message);return;}
        const weights=evaluation.weights && typeof evaluation.weights === "object" && !Array.isArray(evaluation.weights) ? evaluation.weights as Dict : {};
        const totalWeight=["accuracy","understanding","communication","confidence","relevance"].reduce((sum,key)=>sum+(Number(weights[key])||0),0);
        if (!evaluation.method || typeof evaluation.passingScore !== "number" || totalWeight !== 100) {setPublishError("Complete the AI evaluation settings before publishing.");return;}
      }
    }
    const publishedMarks=questions.reduce((sum,q)=>sum+(Number(q.points)||0),0);
    updateAssessment({title:activeTitle||title,course:activeCourse||course,questions:questions.length,marks:publishedMarks||activeTotal||Number(total)||0,status:"Published"});
    setPublishError("");
    setPublishConfirmOpen(false);
    setPublishSuccess(true);
    window.setTimeout(() => router.push("/assessments"), 3000);
  };
  const [details, setDetails] = useState<Dict>({});
  const [evaluation, setEvaluation] = useState<Dict>({});
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [content, setContent] = useState<Dict>({});
  useEffect(() => {
    const read = (key: string): Dict => { try { return JSON.parse(assessmentStorage.getItem(key) || "{}") as Dict; } catch { return {}; } };
    const record=getAssessment(getActiveAssessmentId()||"");
    const type=record?.typeCode || "mcq";
    const adapter=getAssessmentAdapter(type);
    const a=read(detailsKey || adapter?.draftKeys.details || "mcqAssessmentDraft");
    const c=read(contentKey || adapter?.draftKeys.content || "mcqContentDraft");
    setActiveType(type);
    setTypeLabel(record?.typeLabel || (type === "mcq" ? "MCQ" : type));
    setActiveTitle(record?.title || "");
    setActiveCourse(record?.course || "");
    setActiveTotal(Number(record?.marks)||0);
    setDetails(a);setEvaluation(read(evaluationKey || adapter?.draftKeys.evaluation || "mcqAssessmentEvaluationDraft"));setContent(c);
    if(Array.isArray(c.questions))setQuestions(c.questions as ReviewQuestion[]);
    else if(Array.isArray(c.items))setQuestions(c.items as ReviewQuestion[]);
    else if(Array.isArray(c.cards))setQuestions(c.cards as ReviewQuestion[]);
    else setQuestions([]);
  }, []);
  const isLong = activeType === "long-answer";
  const isAiAssessment = getAssessmentAdapter(activeType)?.questionMode === "ai-interview";
  const missing = (fallback: string) => isLong || isAiAssessment ? "—" : fallback;
  const total = get(details, ["totalMarks"], activeTotal ? String(activeTotal) : missing("40"));
  const count = get(details, ["questionCount"], questions.length ? String(questions.length) : missing("20"));
  const mark = get(details, ["marksPerQuestion"], missing("1"));
  const pass = get(details, ["passingScore", "gradeToPass"], get(evaluation, ["passingScore"], missing("60")));
  const passNumber = Number(pass.replace(/[^0-9.]/g, ""));
  const passingMarks = Number.isFinite(passNumber) ? `${Math.round(Number(total) * passNumber / 100)}/${total}` : "—";
  const duration = get(details, ["duration", "timeLimit"], missing("30 Minutes"));
  const title = get(details, ["assessmentTitle", "title", "assessmentName"], activeTitle || "Untitled Assessment");
  const course = get(details, ["course", "courseName"], activeCourse || "—");
  const learnerRecords = Array.isArray(details.accommodationRows) ? details.accommodationRows as { learner: string; id?: string; extraTime?: string; accommodation?: string }[] : [];
  const totalQuestionMarks = questions.reduce((sum, q) => sum + Number(q.points || 0), 0);
  const allCorrect = questions.length > 0 && (activeType !== "mcq" || questions.every(q => (q.correct ?? -1) >= 0 && !!q.text?.trim() && (q.options || []).filter(Boolean).length >= 2));
  const aiWeights = (evaluation.weights && typeof evaluation.weights === "object" && !Array.isArray(evaluation.weights) ? evaluation.weights : {}) as Dict;
  const nestedSettings = (evaluation.dropdownSettings && typeof evaluation.dropdownSettings === "object" ? evaluation.dropdownSettings : {}) as Dict;
  const longKeys: Record<string,string> = {showResultAfterSubmission:"showResult",showResults:"showResult",passFail:"showPassFail",answerFeedback:"showAnswerFeedback",explanation:"showExplanation",reviewWrong:"reviewWrongAnswers",copyPaste:"preventCopyPaste",printing:"preventPrinting",webcam:"webcamMonitoring",fullScreen:"fullScreenMode",identity:"identityVerification",tabSwitching:"detectTabSwitching",multipleScreens:"detectMultipleScreens",browserExit:"detectBrowserExit",cooldown:"attemptCooldown"};
  const setting = (key: string, fallback = "on") => {
    if (!isLong) return get(evaluation, [key], fallback);
    const value = nestedSettings[longKeys[key] || key] ?? evaluation[key];
    return typeof value === "boolean" ? (value ? "on" : "off") : value == null || value === "" ? fallback : String(value);
  };
  const isOn = (key: string, fallback = "on") => boolText(setting(key, fallback));
  const longDate = (which: "From" | "Until") => {
    const toggles = details.toggles as Dict | undefined;
    if (!toggles?.[which === "From" ? "availableFrom" : "availableUntil"]) return "—";
    return [details[`available${which}Date`], details[`available${which}Time`]].filter(Boolean).join(" ") || "—";
  };
  const longDescription = String(details.descriptionInstructions || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "—";
  const aiToggles = details.toggles && typeof details.toggles === "object" && !Array.isArray(details.toggles) ? details.toggles as Dict : {};
  const aiDate = (which: "From" | "Until") => {
    const key = which === "From" ? "availableFrom" : "availableUntil";
    if (!boolText(aiToggles[key],false)) return "—";
    const date = String(details[`${key}Date`] || "");
    const formatted = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8,10)}-${date.slice(5,7)}-${date.slice(0,4)}` : date;
    return [formatted,details[`${key}Time`]].filter(Boolean).join(" ") || "—";
  };
  const removeAiQuestion = (index: number) => {
    if (questions.length <= 1) { setAiReviewMessage("At least one question is required."); return; }
    if (!window.confirm(`Remove question ${index + 1}?`)) return;
    const next = questions.filter((_,itemIndex)=>itemIndex!==index);
    const adapter = getAssessmentAdapter(activeType);
    const contentDraftKey = contentKey || adapter?.draftKeys.content || "aiContentDraft";
    const detailsDraftKey = detailsKey || adapter?.draftKeys.details || "mcqAssessmentDraft";
    let previousContent: string | null;
    let previousDetails: string | null;
    let previousCount: string | null;
    try {
      previousContent = assessmentStorage.getItem(contentDraftKey);
      previousDetails = assessmentStorage.getItem(detailsDraftKey);
      previousCount = assessmentStorage.getItem("mcqQuestionCount");
    } catch {
      setAiReviewMessage("Unable to remove the question. Please check browser storage.");
      return;
    }
    const nextContent = {...content,questions:next,questionCount:next.length};
    const nextDetails = {...details,questionCount:String(next.length)};
    try {
      assessmentStorage.setItem(contentDraftKey,JSON.stringify(nextContent));
      assessmentStorage.setItem(detailsDraftKey,JSON.stringify(nextDetails));
      assessmentStorage.setItem("mcqQuestionCount",String(next.length));
      updateAssessment({questions:next.length});
      setContent(nextContent);setDetails(nextDetails);setQuestions(next);setAiReviewMessage("");
    } catch {
      try {
        if(previousContent===null) assessmentStorage.removeItem(contentDraftKey); else assessmentStorage.setItem(contentDraftKey,previousContent);
        if(previousDetails===null) assessmentStorage.removeItem(detailsDraftKey); else assessmentStorage.setItem(detailsDraftKey,previousDetails);
        if(previousCount===null) assessmentStorage.removeItem("mcqQuestionCount"); else assessmentStorage.setItem("mcqQuestionCount",previousCount);
      } catch { /* Report the original storage failure. */ }
      setAiReviewMessage("Unable to remove the question. Please check browser storage.");
    }
  };
  if (isAiAssessment) return <main className="superAdminPage institutionAdminPage reviewAppShell aiReview"><div className="dashboardLayout reviewDashboardLayout"><Sidebar/><section className="mainContent reviewMainContent"><div className="reviewHeaderSlot"><Header/></div><div className="institutionScrollArea reviewScrollArea"><div className="pageContent institutionPageContent reviewPageContent">
    <nav className="reviewBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><Asset name="arrowrightdouble.svg" size={18}/><Link href="/assessments/create/details">Create Assessment</Link></nav>
    <ol className="reviewWizard" aria-label="Assessment creation progress">{STEPS.map((label,index)=><li key={label} className={`reviewWizardStep ${index < 4 ? "isDone" : "isCurrent"}`} aria-current={index === 4 ? "step" : undefined}><span className="reviewWizardNumber"><span>{index+1}</span></span><span>{label}</span><WizardStepLink index={index} current={4}/></li>)}</ol>
    <header className="reviewPageHeading"><h1>Review And Publish</h1><p>Check everything before publishing to learners.</p></header>
    <div className="aiReviewSections">
      <AIReviewSection title="Basic Information" editRoute="/assessments/create/details?reviewSection=0"><div className="aiReviewGrid">
        <AIReviewField label="Assessment Name" value={get(details,["assessmentName","assessmentTitle"],activeTitle || "—")} wide/>
        <AIReviewField label="Assessment Type" value="AI Assessment"/><AIReviewField label="Assessment Format" value={activeType === "ai-viva" ? "AI Viva" : "AI Interview"}/>
        <AIReviewField label="Course" value={course}/><AIReviewField label="Module / Unit" value={get(details,["module","moduleUnit"])} />
        <AIReviewField label="Category / tags" value={Array.isArray(details.tags) && details.tags.length ? details.tags.join(", ") : "—"}/><AIReviewField label="Language" value={get(details,["language"])} />
        <AIReviewField label="Subject" value={get(details,["subject"])} /><AIReviewField label="Level" value={get(details,["level"])} />
        <AIReviewField label="Description / Instructions" value={<span className="aiReviewLongText">{aiText(details.descriptionInstructions) || "—"}</span>} wide/>
        <AIReviewField label="Activity instructions" value={<span className="aiReviewLongText">{aiText(details.activityInstructions) || "—"}</span>} wide/>
        <div className="aiReviewFieldWide aiReviewInline"><span>Display description on course page</span><AIReviewSwitch on={boolText(aiToggles.displayDescription,false)}/></div>
        <AIReviewField label="AI Voice" value={get(details,["aiVoice"])} /><AIReviewField label="Additional Files (Max 2MB)" value={<span className="aiReviewFile"><Asset name="image.svg" size={24}/>{get(details,["additionalFileName"],"No file added")}</span>}/>
      </div></AIReviewSection>
      <AIReviewSection title="Timing & Availability" editRoute="/assessments/create/details?reviewSection=2"><div className="aiReviewGrid aiReviewGridThree">
        <AIReviewField label="Time Limit" value={<span className="aiReviewValueSwitch">{get(details,["timeLimit"])}<AIReviewSwitch on={boolText(aiToggles.timeLimit,false)}/></span>}/>
        <AIReviewField label="Per-question Timer" value={<span className="aiReviewValueSwitch">{get(details,["perQuestionTimer"])}<AIReviewSwitch on={boolText(aiToggles.perQuestionTimer,false)}/></span>}/>
        <AIReviewField label="Time Zone" value={get(details,["timeZone"])}/>
        <AIReviewField label="Available from" value={<span className="aiReviewValueSwitch">{aiDate("From")}<AIReviewSwitch on={boolText(aiToggles.availableFrom,false)}/></span>} wide/>
        <AIReviewField label="Available Until" value={<span className="aiReviewValueSwitch">{aiDate("Until")}<AIReviewSwitch on={boolText(aiToggles.availableUntil,false)}/></span>} wide/>
      </div></AIReviewSection>
      <AIReviewSection title="Attempts & Access" editRoute="/assessments/create/details?reviewSection=3"><div className="aiReviewGrid aiReviewGridThree">
        <AIReviewField label="Number of Attempts" value={get(details,["attempts","allowedAttempts"])} /><AIReviewField label="Attempt Cooldown" value={get(details,["attemptCooldown"])} /><AIReviewField label="Additional Attempt" value={get(details,["additionalAttempt"])} />
        <AIReviewField label="Restrict access" value={get(details,["restrictAccess"])} /><AIReviewField label="Access Code" value={<span className="aiReviewValueSwitch">{get(details,["accessCode"])}<AIReviewSwitch on={boolText(aiToggles.accessCode,false)}/></span>}/>
        <AIReviewField label="Camera" value={<span className="aiReviewValueSwitch">Camera Required<AIReviewSwitch on={boolText(aiToggles.cameraRequired,false)}/></span>}/>
        <AIReviewField label="Browser Lockdown" value={<span className="aiReviewValueSwitch">{get(details,["browserLockdown"])}<AIReviewSwitch on={boolText(aiToggles.browserLockdown,false)}/></span>}/>
        <AIReviewField label="Webcam Proctoring" value={<span className="aiReviewValueSwitch">{get(details,["webcamProctoring"])}<AIReviewSwitch on={boolText(aiToggles.webcamProctoring,false)}/></span>}/>
        <AIReviewField label="Microphone" value={<span className="aiReviewValueSwitch">Microphone Required<AIReviewSwitch on={boolText(aiToggles.microphoneRequired,false)}/></span>}/>
        <div className="aiReviewField aiReviewFieldWide"><span className="aiReviewLabel">Extra Time / Accommodations</span><div className="reviewTableWrap aiReviewTable"><table><thead><tr><th>Learner</th><th>ID</th><th>Extra Time</th><th>Accommodation</th></tr></thead><tbody>{learnerRecords.length ? learnerRecords.map((row,index)=><tr key={`${row.id || row.learner}-${index}`}><td>{row.learner}</td><td>{row.id || "—"}</td><td>{row.extraTime || "—"}</td><td>{row.accommodation || "—"}</td></tr>) : <tr><td colSpan={4}>No learner accommodations added.</td></tr>}</tbody></table></div></div>
      </div></AIReviewSection>
      <AIReviewSection title="Audience" editRoute="/assessments/create/details?reviewSection=4"><div className="aiReviewGrid aiReviewGridThree">
        <AIReviewField label="Batch / Cohort" value={get(details,["batch","batchCohort","cohort"])} /><AIReviewField label="Academic Year" value={get(details,["academicYear"])} /><AIReviewField label="Department" value={get(details,["department"])} />
        <AIReviewField label="Program" value={get(details,["program"])} /><AIReviewField label="Section / Class" value={get(details,["section"])} /><AIReviewField label="Excluded Learners" value={get(details,["excludedLearners","exclusions"],"None")} />
        <AIReviewField label="Notify learners when published" value={<span className="aiReviewValueSwitch">Notify Learners<AIReviewSwitch on={boolText(aiToggles.notifyLearners,false)}/></span>}/>
      </div></AIReviewSection>
      <AIReviewSection title="Questions" editRoute="/assessments/create/content?reviewEdit=questions"><div className="aiReviewList">{questions.length ? questions.map((question,index)=><div className="aiReviewQuestion" key={question.id || index}><span>Q{index+1} - {aiText(question.html || question.text || question.question) || "No question entered"}</span><button type="button" className="aiReviewRemoveQuestion" aria-label={`Remove question ${index+1}`} onClick={()=>removeAiQuestion(index)}><Asset name="cancel-circle.svg" size={16}/></button></div>) : <div className="aiReviewQuestion">No questions saved yet.</div>}</div>{aiReviewMessage && <p className="aiReviewError" role="alert">{aiReviewMessage}</p>}</AIReviewSection>
      <AIReviewSection title="Rubrics" editRoute="/assessments/create/evaluation"><div className="aiReviewList">{([ ["accuracy","Content Accuracy"], ["understanding","Depth of understanding"], ["communication","Communication clarity"], ["confidence","Confidence and fluency"], ["relevance","Relevance to question"] ] as const).map(([key,label])=><div className="aiReviewRubric" key={key}><span>{label}</span><span>{typeof aiWeights[key] === "number" ? `${aiWeights[key]}%` : "—"}</span></div>)}</div></AIReviewSection>
    </div>
    <footer className="reviewFooter aiReviewFooter"><button type="button" onClick={()=>{const id=getActiveAssessmentId();if(id)router.push(`/assessments/${encodeURIComponent(id)}/preview`);else setPublishError("Choose an assessment to preview.");}}>Preview as learners</button><div className="aiReviewFooterActions"><button type="button" onClick={()=>router.push("/assessments/create/evaluation")}>Cancel</button><button type="button" className="reviewPublish" onClick={()=>{setPublishError("");setPublishConfirmOpen(true);}} disabled={publishSuccess}>Publish</button></div></footer>
    {publishError && !publishConfirmOpen && <p className="aiReviewError" role="alert">{publishError}</p>}
    {publishSuccess && <div className="aiPublishSuccessOverlay"><section className="aiPublishSuccessDialog" role="dialog" aria-modal="true" aria-labelledby="aiPublishSuccessTitle"><div className="aiPublishSuccessArt"><img src="/assets/viewericons/blast.png" alt=""/><img src="/assets/viewericons/checkmark-circle.svg" alt=""/></div><h2 id="aiPublishSuccessTitle">Assessment Published Successfully</h2><p>{title}</p><button type="button" onClick={()=>router.push("/assessments")}>Back to Assessments</button></section></div>}
    {publishConfirmOpen && <ViewerSubmitConfirm variant="publish" answered={0} remaining={0} flagged={0} error={publishError} onBack={()=>setPublishConfirmOpen(false)} onSubmit={publish}/>}
  </div></div></section></div></main>;
  return <main className="superAdminPage institutionAdminPage reviewAppShell"><div className="dashboardLayout reviewDashboardLayout"><Sidebar/><section className="mainContent reviewMainContent"><div className="reviewHeaderSlot"><Header/></div><div className="institutionScrollArea reviewScrollArea"><div className="pageContent institutionPageContent reviewPageContent">
    <nav className="reviewBreadcrumb"><Link href="/assessments">Assessment</Link><Asset name="arrowrightdouble.svg" size={18}/><strong>Create Assessment</strong></nav>
    <ol className="reviewWizard" aria-label="Assessment creation progress">{STEPS.map((label, index) => <li key={label} className={`reviewWizardStep ${index < 4 ? "isDone" : "isCurrent"}`} aria-current={index === 4 ? "step" : undefined}><span className="reviewWizardNumber"><span>{index + 1}</span></span><span>{label}</span><WizardStepLink index={index} current={4}/></li>)}</ol>
    <header className="reviewPageHeading"><h1>Review And Publish</h1><p>Everything Looks Ready ?</p></header>
    <div className="reviewSections">
      <ReviewSection number={1} title="Basic Information" icon="google-doc.svg" editRoute="/assessments/create/details?reviewSection=0"><div className="reviewFieldGrid two">
        <ReadField label="Assessment Name" value={title}/><ReadField label="Assessment Type" value={activeType === "mcq" ? get(details,["assessmentType"],"MCQ") : typeLabel}/>
        <ReadField label="Course" value={course}/><ReadField label="Module/ Unit" value={get(details,["module", "moduleUnit"],missing("Module 3 - AI Fundamentals"))}/>
        <ReadField label="Category / Tags" value={Array.isArray(details.tags) ? details.tags.join(", ") || (isLong ? "—" : "") : get(details,["category","tags"],missing("Artificial Intelligence, Fundamentals"))} accent/><ReadField label="Language" value={get(details,["language"],missing("English"))}/>
        <ReadField label="Description / Instructions" value={isLong || isAiAssessment ? longDescription : get(details,["description", "instructions"],"Assess learner understanding of core AI concepts.")} wide/>
      </div></ReviewSection>
      {!isAiAssessment && <ReviewSection number={2} title="Scoring & Grading" icon="gtarget.svg" editRoute="/assessments/create/details?reviewSection=1"><div className="reviewFieldGrid three">
        <ReadField label="Total Marks" value={total}/><ReadField label="Number of Question" value={count}/><ReadField label="Marks per Question" value={mark}/>
        <ReadField label="Negative Marking" value={get(details,["negativeMarkingValue"],missing("-0.25"))}/><ReadField label="Passing Score" value={isLong ? (pass === "—" || pass.includes("%") ? pass : `${pass}%`) : `${pass}%`}/><ReadField label="Grade to Pass" value={get(details,isLong ? ["gradeToPass"] : ["gradeToPassScore"],missing("C"))}/>
        <ReadField label="Grade category" value={get(details,["gradeCategory"],missing("A - 91-100%"))}/><ReadField label="Partial Credit" value={<span className="reviewInlineSwitch">{get(details,["partialCreditMethod"],missing("Award partial marks"))}<ReviewSwitch enabled={boolText(details.partialCredit, false)}/></span>}/><ReadField label="Rounding Rule" value={get(details,["roundingRule"],missing("Round 2 Assessment"))}/>
        <div className="reviewField reviewWide reviewMarkingField"><span className="reviewLabel">Marking Scheme</span><div className="reviewMarkingFrame"><div className="reviewMarking"><ReviewTick blue/><span>{get(details,["markingScheme"],missing("Fixed marks per question"))}</span></div></div></div>
      </div></ReviewSection>}
      <ReviewSection number={isAiAssessment ? 2 : 3} title="Timing & Availability" icon="calendar.svg" editRoute="/assessments/create/details?reviewSection=2"><div className="reviewFieldGrid three">
        <ReadField label="Time Limit" value={<span className="reviewInlineSwitch">{duration}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.timeLimit)}/></span>}/>
        <ReadField label="Per question Timer" value={<span className="reviewInlineSwitch">{get(details,["perQuestionTimer"],missing("Set Time Per Question"))}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.perQuestionTimer, false)}/></span>}/>
        <ReadField label="Time Zone" value={get(details,["timeZone"],missing("Asia/Kolkata"))}/>
        <ReadField label="Available From" value={isLong || isAiAssessment ? longDate("From") : get(details,["availableFrom"],"12-10-2026 11:30 AM")}/><ReadField label="Available Until" value={isLong || isAiAssessment ? longDate("Until") : get(details,["availableUntil"],"18-10-2026 11:30 AM")}/>
        <ReadField label="Late Submission" value={<span className="reviewInlineSwitch">{get(details,["lateSubmission"],missing("Grace Period - 10 Min"))}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.lateSubmission)}/></span>}/>
      </div></ReviewSection>
      <ReviewSection number={isAiAssessment ? 3 : 4} title="Attempts & Access" icon="orefresh.svg" editRoute="/assessments/create/details?reviewSection=3"><div className="reviewFieldGrid three"><ReadField label="Number of Attempts" value={get(details,["attempts","allowedAttempts"],missing("2"))}/><ReadField label="Attempt Cooldown" value={isLong ? get(details,["attemptCooldown"],setting("cooldown","—")) : setting("cooldown","15 min")}/>{!isAiAssessment && <ReadField label="Grading Method" value={get(details,["gradingMethod"],missing("Highest Score"))}/>}<ReadField label="Access Code" value={get(details,["accessCode"],missing("A78X- K942"))}/><ReadField label="Browser Lockdown" value={<span className="reviewInlineSwitch">{isLong ? get(details,["browserLockdown"],"—") : "Secure Exam Browser"}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.browserLockdown)}/></span>}/><ReadField label="Webcam Proctoring" value={<span className="reviewInlineSwitch">{isLong ? get(details,["webcamProctoring"],"—") : "Camera Check"}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.webcamProctoring)}/></span>}/><ReadField label="Prerequisite" value={<span className="reviewInlineSwitch">{isLong ? get(details,["prerequisite"],"—") : "Previous Assessment"}<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.prerequisite)}/></span>}/></div>
        <div className="reviewLearnerArea"><h3>Extra Time / Accommodations</h3><div className="reviewTableWrap"><table><thead><tr><th>Learner</th><th>ID</th><th>Extra Time</th><th>Accommodation</th></tr></thead><tbody>{learnerRecords.length ? learnerRecords.map((row,i)=><tr key={`${row.id || row.learner}-${i}`}><td><span className="reviewLinkText">{row.learner}</span></td><td>{row.id || `S${String(i+1).padStart(3,"0")}`}</td><td>{row.extraTime || "—"}</td><td>{row.accommodation || "—"}</td></tr>) : <tr><td colSpan={4}>No learner accommodations added.</td></tr>}</tbody></table></div></div>
      </ReviewSection>
      <ReviewSection number={isAiAssessment ? 4 : 5} title="Audience" icon="user-multiple2.svg" editRoute="/assessments/create/details?reviewSection=4"><div className="reviewFieldGrid two"><ReadField label="Who can take this assessment?" value={get(details,["audience", "assignTo", "whoCanTake"],"All enrolled learners")}/><ReadField label="Batch / Cohort" value={get(details,["batch", "batchCohort", "cohort"],missing("2026 — Batch A"))}/><ReadField label="Academic Year" value={get(details,["academicYear"],missing("2026–2027"))}/><ReadField label="Department" value={get(details,["department"],missing("Computer Science"))}/>{isLong && <ReadField label="Program" value={get(details,["program"],"—")}/>}<ReadField label="Section / Class" value={get(details,["section"],missing("Section A"))}/><ReadField label="Excluded Learners" value={get(details,["excludedLearners", "exclusions"],"None")}/><ReadField label="Notify learners when published" value={<ReviewSwitch enabled={boolText((details.toggles as Dict | undefined)?.notifyLearners)}/>}/></div></ReviewSection>
      <ReviewSection number={isAiAssessment ? 5 : 6} title="Questions" icon="circle-question-mark.svg" editRoute="/assessments/create/content?reviewEdit=questions"><div className="reviewFieldGrid two"><ReadField label="Total Questions" value={count}/>{!isAiAssessment && <ReadField label="Marks" value={totalQuestionMarks || total}/>}<ReadField label={activeType === "mcq" ? "All Answers Verified" : "Questions Saved"} value={<span className="reviewStatus"><ReviewTick/>{!questions.length ? "Question data not saved yet" : activeType === "mcq" ? (allCorrect ? "All Questions Completed" : "Review incomplete questions") : "Questions saved for review"}</span>}/><ReadField label="Feedback" value={<span className="reviewStatus"><ReviewTick/> {Object.keys(content).length ? "Added" : "Awaiting question data"}</span>}/><ReadField label="Explanation" value={<span className="reviewStatus"><ReviewTick/> {Object.keys(content).length ? "Added" : "Awaiting question data"}</span>}/><ReadField label="Mandatory" value={questions.length ? `${questions.filter(q=>q.mandatory).length}/${questions.length}` : "—"}/><ReadField label="Difficulty" value={<div className="reviewPillGroup">{["Easy","Medium","Hard"].map((level,i)=><span key={level} className="reviewValuePill"><ReviewTick blue/>{questions.filter(q=>q.difficulty===level).length || (questions.length ? "0" : i+1)} {level}</span>)}</div>}/><ReadField label="Bloom's" value={<span className="reviewValuePill"><ReviewTick blue/>{questions[0]?.bloom || missing("Analyze")}</span>}/></div></ReviewSection>
      {isAiAssessment ? <ReviewSection number={6} title="AI Evaluation" icon="chart.svg" editRoute="/assessments/create/evaluation"><div className="reviewFieldGrid two">
        <ReadField label="Evaluation Method" value={get(evaluation,["method"],"—")}/><ReadField label="Passing Score" value={typeof evaluation.passingScore === "number" ? `${evaluation.passingScore}%` : "—"}/>
        {([ ["accuracy", "Content Accuracy"], ["understanding", "Depth of Understanding"], ["communication", "Communication Clarity"], ["confidence", "Confidence and Fluency"], ["relevance", "Relevance to Question"] ] as const).map(([key,label])=><ReadField key={key} label={label} value={typeof aiWeights[key] === "number" ? `${aiWeights[key]}%` : "—"}/>)}
        <ReadField label="Show rubric to learners" value={<ReviewSwitch enabled={evaluation.showRubric === true}/>}/><ReadField label="Show feedback to learners" value={<ReviewSwitch enabled={evaluation.showFeedback === true}/>}/>
      </div></ReviewSection> : <>
      <ReviewSection number={isAiAssessment ? 6 : 7} title="Results" icon="chart.svg" editRoute="/assessments/create/evaluation"><div className="reviewFieldGrid two"><ReadField label="Show Result After Submission" value={<ReviewSwitch enabled={isOn("showResultAfterSubmission", isOn("showResults") ? "on" : "off")}/>}/><ReadField label="Show Score" value={<ReviewSwitch enabled={isOn("showScore")}/>}/><ReadField label="Show Pass/ Fail" value={<ReviewSwitch enabled={isOn("passFail")}/>}/><ReadField label="Show Correct Answers" value={<ReviewSwitch enabled={isOn("showCorrectAnswers")}/>}/><ReadField label="Result Available" value={setting("resultAvailable", "Immediately")}/></div></ReviewSection>
      <ReviewSection number={isAiAssessment ? 7 : 8} title="Feedback" icon="message-circle-more.svg" editRoute="/assessments/create/evaluation?reviewPanel=feedback"><div className="reviewInnerGrid"><InnerCard heading="ANSWER FEEDBACK" icon="message-circle-more.svg"><ReadSwitch label="Show Answer Feedback" on={isOn("answerFeedback")}/><ReadSwitch label="Show Explanation" on={isOn("explanation")}/><ReadSetting label="Feedback Timing" value={setting("feedbackTiming","After")}/><div className="reviewCheckStack">{["Correct Answer Feedback","Wrong Answer Feedback",...(isOn("explanation") ? ["Question Explanation"] : [])].map(label=><span key={label}><ReviewTick/>{label}</span>)}</div></InnerCard><InnerCard heading="COGNITIVE & BEHAVIORAL INSIGHTS" icon="blueview.svg"><ReadSwitch label="Answer Switching Behavioral" on={isOn("answerSwitching")}/><ReadSwitch label="Review Wrong Answers" on={isOn("reviewWrong")}/><ReadSwitch label="View Weakness Map" on={isOn("weaknessMap")}/></InnerCard></div></ReviewSection>
      <ReviewSection number={isAiAssessment ? 8 : 9} title="Security & Integrity" icon="shield-check.svg" editRoute="/assessments/create/evaluation?reviewPanel=security"><div className="reviewInnerGrid"><InnerCard heading="ASSESSMENT ACCESS" icon="lock.svg"><ReadSetting label="Access Control" value={setting("accessControl","Open")}/><ReadSwitch label="Require Secure Browser" on={isOn("secureBrowser")}/><ReadSwitch label="Prevent Copy / Paste" on={isOn("copyPaste")}/><ReadSwitch label="Prevent Printing" on={isOn("printing")}/></InnerCard><InnerCard heading="PROCTORING" icon="video.svg"><ReadSwitch label="Webcam Monitoring" on={isOn("webcam")}/><ReadSwitch label="Screen Monitoring" on={isOn("screenMonitoring")}/><ReadSwitch label="Full-Screen Mode" on={isOn("fullScreen")}/><ReadSwitch label="Identity Verification" on={isOn("identity")}/></InnerCard><InnerCard heading="MONITORING" icon="blueview.svg"><ReadSwitch label="Detect Tab Switching" on={isOn("tabSwitching")}/><ReadSwitch label="Detect Multiple Screens" on={isOn("multipleScreens")}/><ReadSwitch label="Detect Browser Exit" on={isOn("browserExit")}/><ReadSwitch label="Record Violations" on={isOn("recordViolations")}/><ReadSetting label="Violation Threshold" value={setting("violationThreshold","3")}/><ReadSetting label="Action" value={setting("violationAction","Warn")}/></InnerCard></div></ReviewSection>
      </>}
    </div><footer className="reviewFooter"><button type="button" onClick={()=>router.push("/assessments/create/evaluation")}>Back</button>{publishError && !publishConfirmOpen && <span role="alert" className="reviewPublishError">{publishError}</span>}{publishSuccess && <span role="status" style={{color:"#2A7308"}}>Assessment published successfully.</span>}<button type="button" className="reviewPublish" onClick={()=>{setPublishError("");setPublishConfirmOpen(true);}} disabled={publishSuccess}>Publish</button></footer>
    {publishConfirmOpen && <ViewerSubmitConfirm variant="publish" answered={0} remaining={0} flagged={0} error={publishError} onBack={()=>setPublishConfirmOpen(false)} onSubmit={publish}/>}
  </div></div></section></div></main>;
}
