"use client";
import { quantumStorage as localStorage, quantumSessionStorage as sessionStorage } from "../quantum-storage";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./qc_content.css";

const ASSETS = "/assets/assessmenticons/";
// Shared assessment record: Details, Content, Evaluation and Review use the same ID.
const QC_CURRENT_ID = "quantumChampsCurrentId";
const qcRecordKey = (id: string) => `quantumChamps:${id}`;
type QCContentDraft = { settings?: Record<string, boolean>; questions?: Question[]; optionDetails?: Record<string, OptionDetail>; tags?: string[]; shortQuestions?: SAQuestion[]; shortConfigs?: Record<number, SAConfig>; shortTags?: string[]; saved?: boolean; updatedAt?: string };
function readQCRecord(id: string): Record<string, unknown> | null {
  try { const value = localStorage.getItem(qcRecordKey(id)); return value ? JSON.parse(value) as Record<string, unknown> : null; } catch { return null; }
}
function writeQCContent(id: string, patch: QCContentDraft, markSaved = false): boolean {
  const record = readQCRecord(id);
  if (!record) return false;
  const previous = record.content && typeof record.content === "object" ? record.content as QCContentDraft : {};
  const content = { ...previous, ...patch, saved: markSaved, updatedAt: new Date().toISOString() };
  const next = { ...record, assessmentId: id, content, status: markSaved ? "content_saved" : "content_draft" };
  localStorage.setItem(qcRecordKey(id), JSON.stringify(next));
  try { localStorage.setItem("quantumChampsDraft", JSON.stringify(next)); } catch { /* The primary assessment record was saved. */ }
  return true;
}

const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"] as const;
const SETTINGS = [
  { key: "randomize", label: "Randomize", icon: "shuffle.svg", defaultOn: false },
  { key: "shuffleAnswers", label: "Shuffle Answers", icon: "adjust-position.svg", defaultOn: false },
  { key: "flagQuestions", label: "Flag Questions", icon: "flag.svg", defaultOn: true },
  { key: "calculator", label: "Calculator", icon: "calculator.svg", defaultOn: true },
  { key: "formulaSheet", label: "Formula sheet", icon: "sigma.svg", defaultOn: true },
  { key: "scratchpad", label: "Scratchpad", icon: "sticky-note.svg", defaultOn: true },
] as const;

function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`mcqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}


type Question = { type: string; text: string; options: string[]; correct: number; points: string; difficulty: string; category: string; bloom: string; mandatory: boolean };
const newQuestion = (): Question => ({ type: "MCQ", text: "", options: ["", ""], correct: -1, points: "1", difficulty: "Medium", category: "", bloom: "", mandatory: true });
const CATEGORIES = ["AI", "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Data Science", "Cybersecurity", "Cloud Computing", "Programming", "Database", "Web Development", "Software Engineering", "Computer Networks", "Operating Systems", "Data Structures & Algorithms", "Mathematics", "Statistics", "Other"];
const BLOOMS = ["Remember", "Create", "Evaluate", "Analyze", "Apply", "Understand"];
const QUESTION_TYPES = ["MCQ", "Multiple Response", "True / False", "Fill in the Blank", "One-Word Answer", "Short Answer", "Long Answer / Essay", "Numeric Response"];
const ASSESSMENT_TYPE_GROUPS = [
  { heading: "Academic assessment", items: ["Multiple Choice Question (MCQ)", "Multiple Response", "True / False", "Fill in the Blank", "One-Word Answer", "Short Answer", "Long Answer / Essay", "Numeric Response", "Formula Response", "Matrix Question", "Assertion & Reason", "Ranking Question", "Quick Quiz", "Timed Quiz", "Scenario Quiz"] },
  { heading: "Interactive Assessments", items: ["Drag & Drop", "Match the Following", "Sequence & Order", "Connect the Dots", "Clickable Hotspot", "Interactive Diagram", "Interactive Concept Map", "Puzzle Challenge", "Memory Game", "Interactive Story"] },
  { heading: "Multimedia Assessments", items: ["Image-Based Assessment", "Audio-Based Assessment", "Video-Based Assessment", "Visual Identification", "Video Response", "Audio Response", "Screen Recording Task", "Media Annotation"] },
  { heading: "Application & Practical Assessments", items: ["Case Study", "Problem-Solving Challenge", "Assignment", "Project Assessment", "Research Task", "Practical Task", "Lab Assessment", "Simulation Assessment", "Design Review", "Presentation Assessment", "Role-Play Assessment", "Oral Viva", "Product Demonstration"] },
  { heading: "Portfolio Assessments", items: ["Portfolio Assessment", "Project Showcase", "Code Portfolio", "Design Portfolio", "Research Portfolio"] },
  { heading: "Collaborative Assessments", items: ["Peer Assessment", "Self Assessment", "Group Project Assessment", "Team Challenge", "Discussion Assessment", "Debate Assessment", "Peer Review", "Collaborative Task"] },
  { heading: "Gamified Challenges", items: ["Quiz Battle", "Team Battle", "Tournament", "Daily Challenge", "Weekly Challenge", "Skill Sprint", "Boss Battle", "Mission Challenge", "Escape Room", "Mystery Challenge"] },
  { heading: "AI-Powered Assessments", items: ["AI Interview", "AI Viva", "Adaptive Assessment", "AI Mentor Challenge", "AI Competency Assessment", "AI Skill Gap Assessment"] },
  { heading: "Certification & Professional Assessments", items: ["Online Exam", "Mock Exam", "Skill Evaluation", "Competency Assessment", "Certification Assessment", "Certification Renewal Assessment", "Professional Readiness Assessment", "Compliance Assessment", "Safety Assessment", "Product Knowledge Assessment", "Sales Competency Assessment"] },
  { heading: "Career & Behavioral Assessments", items: ["Communication Assessment", "Soft Skills Assessment", "Leadership Assessment", "Situational Judgment Test", "Interview Readiness Assessment", "Industry Simulation", "Client Project Assessment", "Startup Challenge", "Product Design Challenge", "Consulting Challenge"] },
];

function QuestionTypeDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>(["Academic assessment"]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  const label = value === "MCQ" ? "Multiple Choice Question (MCQ)" : value;
  const normalized = search.trim().toLowerCase();
  return <div className="mcqcSelectRoot mcqcTypeRoot" ref={root}>
    <button type="button" className="mcqcSelectTrigger" aria-label="Question Type" aria-expanded={open} aria-controls="mcqcQuestionTypeList" onClick={() => setOpen(previous => !previous)}>
      <span>{label}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "mcqcRotated" : ""}/>
    </button>
    {open && <div id="mcqcQuestionTypeList" className="mcqcTypeDropdown">
      <label className="mcqcTypeSearch"><Icon name="search-02.svg" size={20}/><input autoFocus type="search" placeholder="Search assessment types..." value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="mcqcTypeGroups">{ASSESSMENT_TYPE_GROUPS.map(group => {
        const filtered = group.items.filter(item => item.toLowerCase().includes(normalized));
        if (normalized && !filtered.length && !group.heading.toLowerCase().includes(normalized)) return null;
        const isExpanded = normalized ? true : expanded.includes(group.heading);
        const items = normalized && !filtered.length ? group.items : filtered;
        return <section className="mcqcTypeGroup" key={group.heading}>
          <button type="button" className="mcqcTypeHeading" aria-expanded={isExpanded} onClick={() => setExpanded(previous => previous.includes(group.heading) ? previous.filter(name => name !== group.heading) : [...previous, group.heading])}>
            <span>{group.heading}</span><Icon name="arrow-down-01.svg" size={20} className={isExpanded ? "mcqcRotated" : ""}/>
          </button>
          {isExpanded && <div className="mcqcTypeOptions">{items.map(item => <button type="button" key={item} className="mcqcTypeOption" role="radio" aria-checked={label === item} onClick={() => { onChange(item === "Multiple Choice Question (MCQ)" ? "MCQ" : item); setOpen(false); setSearch(""); }}>
            <span className={`mcqcOptionRadio ${label === item ? "mcqcOptionSelected" : ""}`} aria-hidden="true"/><span>{item}</span>
          </button>)}</div>}
        </section>;
      })}</div>
      {normalized && !ASSESSMENT_TYPE_GROUPS.some(group => group.heading.toLowerCase().includes(normalized) || group.items.some(item => item.toLowerCase().includes(normalized))) && <p className="mcqcTypeEmpty">No assessment types found.</p>}
    </div>}
  </div>;
}

function NeumoSelect({ value, options, onChange, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div className="mcqcSelectRoot" ref={root}><button type="button" className="mcqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="mcqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="mcqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}><span className={`mcqcOptionRadio ${value === option ? "mcqcOptionSelected" : ""}`} /><span>{option}</span></button>)}</div>}</div>;
}
function PreviewStatus({ correct, size = 20 }: { correct: boolean; size?: number }) { return <span className={`mcqcPreviewStatusIcon ${correct ? "is-correct" : "is-wrong"}`} aria-hidden="true" />; }
type OptionDetail = { feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean };
function QuestionsPreview({ questions, details, tags, onBack, onEdit, mcqValues }: { questions: Question[]; details: Record<string,OptionDetail>; tags: string[]; onBack: () => void; onEdit: (index:number) => void; mcqValues: MCQDetailsValues }) {
  const [filter,setFilter] = useState("All Questions");
  const [showFilter,setShowFilter] = useState(false);
  const [openQuestion,setOpenQuestion] = useState(0);
  const [sections,setSections] = useState({ answers:true, learning:true, settings:true });
  const [openFeedback,setOpenFeedback] = useState<number|null>(null);
  const [learner,setLearner] = useState(false);
  const ready = (q:Question) => !!q.text.trim() && q.options.filter(Boolean).length>=2 && q.correct>=0 && !!q.category && !!q.bloom;
  const valid = questions.map((q,index)=>({q,index})).filter(({q})=>q.text.trim() || q.options.some(Boolean));
  const filtered = valid.filter(({q})=>filter==="All Questions" || (filter==="Complete"?ready(q):!ready(q)));
  const current = filtered[openQuestion] || filtered[0];
  const totalMarks = valid.reduce((n,{q})=>n+(Number(q.points)||0),0);
  const toggle = (key:"answers"|"learning"|"settings")=>setSections(old=>({...old,[key]:!old[key]}));
  const detail = (qi:number,oi:number) => details[`${qi}-${oi}`] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false};
  return <div className="mcqcPreview">
    <nav className="mcqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><Link href="/quantum-champs?resume=1">Create Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="mcqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="mcqcPreviewControls"><div className="mcqcPreviewTotals"><div><strong>{valid.length}</strong><span>Questions</span></div><div><strong>{mcqValues.totalMarks}</strong><span>Marks</span></div><div className="mcqcPreviewReady"><span className="mcqcPreviewReadyCheck" aria-hidden="true" /><span><strong>{valid.length && valid.every(({q})=>ready(q))?"Ready":"In Progress"}</strong><small>{valid.length && valid.every(({q})=>ready(q))?"All good to continue":"Review incomplete questions"}</small></span></div></div><div className="mcqcPreviewTools"><div className="mcqcPreviewFilter"><button type="button" onClick={()=>setShowFilter(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{showFilter && <div>{["All Questions","Complete","Incomplete"].map(f=><button key={f} type="button" onClick={()=>{setFilter(f);setOpenQuestion(0);setShowFilter(false);}}>{f}</button>)}</div>}</div><button type="button" className="mcqcPreviewLearner" onClick={()=>setLearner(v=>!v)}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div></div>
      {current ? <article className="mcqcPreviewQuestion" key={current.index}><div className="mcqcPreviewMeta"><span>{current.q.type}: {current.q.points} Points</span><span>Status: <b className={ready(current.q)?"mcqcGreen":"mcqcOrange"}>{ready(current.q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(current.index)}><Icon name="edit.svg" size={16}/> Edit</button></div>
        <div className="mcqcPreviewPanel"><h3>Question {current.index+1}</h3><p>{current.q.text||"Question has not been written yet."}</p></div>
        <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("answers")}>Answer Options <Icon name="arrow-down-01.svg" size={18} className={sections.answers?"mcqcRotated":""}/></button>{sections.answers && <div className="mcqcPreviewAnswers">{current.q.options.map((answer,i)=><div key={i} className={`mcqcPreviewAnswer ${current.q.correct===i?"correct":"incorrect"}`}><PreviewStatus correct={current.q.correct===i} size={20}/><span className="mcqcAnswerLetter">{String.fromCharCode(65+i)}</span><span className="mcqcPreviewAnswerText">{answer||`Option ${String.fromCharCode(65+i)} (empty)`}</span>{!learner && <small>{current.q.correct===i?"Correct Answer":"Wrong Answer"}</small>}</div>)}</div>}</div>
        {!learner && <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("learning")}>Feedback and Learning <Icon name="arrow-down-01.svg" size={18} className={sections.learning?"mcqcRotated":""}/></button>{sections.learning && <div className="mcqcPreviewLearning"><section><h4><PreviewStatus correct={true} size={20}/> Correct-answer Feedback</h4>{current.q.options.map((answer,i)=>current.q.correct===i?<div key={i} className="mcqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={true} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><PreviewStatus correct={false} size={20}/> Wrong-answer Feedback</h4>{current.q.options.map((answer,i)=>current.q.correct!==i?<div key={i} className="mcqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={false} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><Icon name="assignments.svg" size={20}/> Explanation</h4><p>{current.q.correct >= 0 ? detail(current.index,current.q.correct).explanation.trim() || "No explanation entered." : "No correct answer selected."}</p></section><section><h4><Icon name="idea.svg" size={20}/> Hint</h4><p>{current.q.correct >= 0 ? detail(current.index,current.q.correct).hint.trim() || "No hint entered." : "No correct answer selected."}</p></section></div>}</div>}
        {!learner && <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={sections.settings?"mcqcRotated":""}/></button>{sections.settings && <div className="mcqcPreviewSettings">{[["Difficulty",current.q.difficulty,"blueview.svg"],["Bloom’s Taxonomy",current.q.bloom||"Not selected","brain.svg"],["Category",current.q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",current.q.mandatory?"YES":"NO","circle-check.svg"]].map(([label,value,icon])=><div key={label}><span>{label}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}</div>}
        <div className="mcqcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button><button type="button" className="mcqcPreviewSave" onClick={onBack}>Save And Continue</button></div></article>:<div className="mcqcPreviewEmpty"><p>{filter==="All Questions"?"No questions have been entered yet.":`No ${filter.toLowerCase()} questions found.`}</p><button type="button" onClick={onBack}>Back to Question</button></div>}
    </div>
  </div>;
}
const questionNavigatorLabel = (type?: string) => {
  if (!type) return "";
  const labels: Record<string, string> = {
    "True / False": "T/F",
    "Drag & Drop": "DD",
    "Quick Quiz": "QC",
    "Fill in the Blank": "FB",
    "One-Word Answer": "OW",
    "Short Answer": "SA",
    "Long Answer / Essay": "LA",
    "Multiple Response": "MR",
    "Numeric Response": "NR",
    "MCQ": "MCQ",
    "Multiple Choice Question (MCQ)": "MCQ",
  };
  return labels[type] ?? type.split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 3).toUpperCase();
};

function QuestionBuilder({ questions, setQuestions, onExit, mcqValues, assessmentId }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onExit: () => void; mcqValues: MCQDetailsValues; assessmentId: string }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const numberScrollRef = useRef<HTMLDivElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bottomAddOpen, setBottomAddOpen] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<number[]>([]);
  const [optionDetails, setOptionDetails] = useState<Record<string, { feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>>({});
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [builderReady, setBuilderReady] = useState(false);
  useEffect(() => {
    if (!assessmentId) return;
    const content = readQCRecord(assessmentId)?.content as QCContentDraft | undefined;
    if (content?.optionDetails) setOptionDetails(content.optionDetails);
    if (content?.tags) setTags(content.tags);
    setBuilderReady(true);
  }, [assessmentId]);
  useEffect(() => {
    if (!builderReady || !assessmentId) return;
    writeQCContent(assessmentId, { questions, optionDetails, tags });
  }, [assessmentId, builderReady, questions, optionDetails, tags]);

  const saveAndContinue = () => {
    if (isSaving) return;
    if (!assessmentId) { setNotice("Assessment ID missing. Return to Details and save first."); return; }
    if (!questions.length || questions.some(q => !q.text.trim() || q.options.filter(v => v.trim()).length < 2 || q.correct < 0 || !q.options[q.correct]?.trim() || !q.category || !q.bloom)) {
      setNotice("Complete every question, answer, correct option, category and Bloom's level before continuing."); return;
    }
    if (!writeQCContent(assessmentId, { questions, optionDetails, tags }, true)) { setNotice("Assessment not found. Save Details first."); return; }
    try {
      try { sessionStorage.setItem("quantumChampsMcqContentDraft", JSON.stringify({ questions, optionDetails, tags, assessmentId, savedAt: new Date().toISOString() })); } catch { /* The primary assessment record was saved. */ }
      setNotice("");
      setSaveSuccess(true);
      setIsSaving(true);
      window.setTimeout(() => router.push("/quantum-champs/QC_Evaluation"), 1200);
    } catch {
      setSaveSuccess(false);
      setNotice("Could not save the questions. Please try again.");
    }
  };
  const [previewing, setPreviewing] = useState(false);
  const item = questions[active] || newQuestion();
  const update = (patch: Partial<Question>) => setQuestions(old => old.map((q, index) => index === active ? { ...q, ...patch } : q));
  const complete = (q: Question) => q.text.trim().length > 0 && q.options.filter(o => o.trim()).length >= 2 && q.correct >= 0 && !!q.options[q.correct]?.trim() && !!q.category && !!q.bloom;
  const partial = (q: Question) => !!q.text.trim() || q.options.some(v => !!v.trim()) || q.correct >= 0 || !!q.category || !!q.bloom;
  const addQuestion = () => { if (active >= mcqValues.questionCount - 1 && questions.length >= mcqValues.questionCount) { setNotice(`Only ${mcqValues.questionCount} questions are configured.`); setAddOpen(false); setBottomAddOpen(false); return; } setActive(n => Math.min(n + 1, mcqValues.questionCount - 1)); setExpandedOptions([]); setAddOpen(false); setNotice(""); };
  const chooseAdd = (option: string) => { setAddOpen(false); setBottomAddOpen(false); if (option === "Create Manually") addQuestion(); else setNotice(`${option} will be available when connected.`); };
  const setOption = (index: number, value: string) => update({ options: item.options.map((old, i) => i === index ? value : old) });
  const currentDone = questions.filter(complete).length;
  const optionKey = (index: number) => `${active}-${index}`;
  const getDetail = (index: number) => optionDetails[optionKey(index)] || { feedback: "", explanation: "", hint: "", showHint: false, allowHint: false };
  const setDetail = (index: number, patch: Partial<{ feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>) => setOptionDetails(old => ({...old, [optionKey(index)]: {...(old[optionKey(index)] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false}),...patch}}));
  const optionToolbar = (fieldId: string) => <div className="mcqcRichToolbar mcqcOptionToolbar">{["undo.svg", "redo.svg"].map(icon => <button type="button" key={icon} title={icon.replace(".svg", "")} onClick={() => document.getElementById(fieldId)?.focus()}><Icon name={icon} size={18}/></button>)}<button type="button" className="mcqcToolbarSelect mcqcToolbarFont" onClick={() => document.getElementById(fieldId)?.focus()}>Arial <Icon name="arrow-down-01.svg" size={15}/></button><button type="button" className="mcqcToolbarSelect mcqcToolbarSize" onClick={() => document.getElementById(fieldId)?.focus()}>16 <Icon name="arrow-down-01.svg" size={15}/></button>{["bold.svg", "italic.svg", "underline.svg", "pencil-line.svg", "highlighter.svg", "pen-line.svg", "text-centerline-center-top.svg"].map(icon => <button type="button" key={icon} title={icon.replace(".svg", "")} onClick={() => document.getElementById(fieldId)?.focus()}><Icon name={icon} size={18}/></button>)}<button type="button" title="More formatting" onClick={() => document.getElementById(fieldId)?.focus()}>•••</button></div>;
  const detailEditor = (index: number, field: "feedback" | "explanation" | "hint") => { const id = `mcqc-${field}-${active}-${index}`; return <div className="mcqcOptionEditor">{optionToolbar(id)}<textarea id={id} rows={3} maxLength={250} value={getDetail(index)[field]} placeholder={`Write ${field} here...`} onChange={e => setDetail(index,{[field]:e.target.value})}/></div>; };

  if (previewing) return <QuestionsPreview questions={questions} details={optionDetails} tags={tags} mcqValues={mcqValues} onBack={()=>setPreviewing(false)} onEdit={(index)=>{setActive(index);setPreviewing(false);setExpandedOptions([0]);}}/>;
  return <div className="mcqcBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" /><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg" /><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30} /><div><h2>Let's Get Started! Antony?</h2><p>Let's Build A Great Question.</p></div></div></div>
    <div className="mcqcTopQuestionNavigator" aria-label="Question navigation">
      <div className="mcqcNumberNavigation">
        <button type="button" className="mcqcRoundNav" aria-label="Previous question" onClick={() => setActive(n => Math.max(0,n-1))}>
          <Icon name="arrowleft.svg" size={20}/>
        </button>
        <div className="mcqcNumberScroller">
          <div ref={numberScrollRef} className="mcqcQuestionNumbers" aria-label="Question numbers">
            {Array.from({ length: mcqValues.questionCount }, (_, index) => {
              const q = questions[index];
              const status = index === active ? "is-active" : q && complete(q) ? "is-complete" : q && partial(q) ? "is-partial" : "is-empty";
              return <button type="button" key={index} className={`mcqcQuestionNumber ${status}`} aria-label={`Question ${index+1}`} aria-current={active===index?"step":undefined} onClick={() => { setActive(index); setExpandedOptions([]); setExpandedDetail(null); }}>
                <span className="mcqcNumberValue">{index+1}</span>
                {status !== "is-empty" && <span className={`mcqcNumberStatus ${status === "is-active" ? "is-active-dot" : ""}`} aria-hidden="true" />}
                {q && <small>{questionNavigatorLabel(q.type)}</small>}
              </button>;
            })}
          </div>
        </div>
        <button type="button" className="mcqcRoundNav" aria-label="Next question" onClick={() => { if (active + 1 < mcqValues.questionCount) setActive(n=>n+1); setExpandedOptions([]); setExpandedDetail(null); }}>
          <Icon name="arrowright.svg" size={20}/>
        </button>
      </div>
      <div className="mcqcQuestionProgress" aria-hidden="true">
        <span style={{ width: `${Math.min(100,Math.max(4,currentDone / mcqValues.questionCount*100))}%` }}/>
      </div>
    </div>

    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading"><div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div><div className="mcqcAddMenu"><button type="button" className="mcqcTopAdd" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}><Icon name="plus.svg" size={20} />Add</button>{addOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually", "Import From Question Bank", "Generate with AI"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div></div>
      <div className="mcqcQuestionForm"><div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value={item.type} onChange={v => update({ type:v })}/></div>
        <div className="mcqcBuilderField mcqcWriteField"><label htmlFor="mcqcQuestionText">Write Your Question <small>{item.text.length}/250</small></label><div className="mcqcEditorSurface">{optionToolbar("mcqcQuestionText")}<textarea id="mcqcQuestionText" maxLength={250} rows={3} placeholder="Write your question here..." value={item.text} onChange={e => update({ text: e.target.value })}/></div></div>
        <div className="mcqcBuilderField"><label>Available Options</label><div className="mcqcAnswerOptions">{item.options.map((option,index) => { const open = expandedOptions.includes(index); const detail = getDetail(index); return <div className="mcqcAnswerSection" key={index}><button type="button" className="mcqcAnswerExpand" aria-expanded={open} onClick={() => { setExpandedOptions(open ? [] : [index]); setExpandedDetail(null); }}><span>Option {String.fromCharCode(65+index)}</span><Icon name="arrow-down-01.svg" size={21} className={open ? "mcqcRotated" : ""}/></button>{open && <div className="mcqcAnswerContent"><div className="mcqcOptionSubLabel"><span>Text</span><small>{option.length}/250</small></div><div className="mcqcOptionEditor">{optionToolbar(`mcqc-opt-${active}-${index}`)}<textarea id={`mcqc-opt-${active}-${index}`} rows={3} maxLength={250} placeholder={`Enter option ${String.fromCharCode(65+index)}`} value={option} onChange={e=>setOption(index,e.target.value)}/></div><label className="mcqcCorrectOption"><input type="checkbox" checked={item.correct===index} onChange={()=>update({correct:item.correct===index?-1:index})}/>Correct Answers</label>{(["feedback","explanation","hint"] as const).map(field => { const sectionId = `${index}-${field}`; const sectionOpen = expandedDetail===sectionId; return <div className="mcqcOptionDetail" key={field}><button type="button" className="mcqcOptionDetailHead" aria-expanded={sectionOpen} onClick={()=>setExpandedDetail(sectionOpen?null:sectionId)}><span className="mcqcDetailHeading"><Icon name={field==="feedback"?"message-circle-more.svg":field==="explanation"?"assignments.svg":"idea.svg"} size={18}/>{field[0].toUpperCase()+field.slice(1)}</span><small>{detail[field].length}/250</small><Icon name="arrow-down-01.svg" size={18} className={sectionOpen?"mcqcRotated":""}/></button>{sectionOpen && <div className="mcqcOptionDetailBody">{detailEditor(index,field)}{field==="hint" && <div className="mcqcHintChecks"><label><input type="checkbox" checked={detail.showHint} onChange={e=>setDetail(index,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={detail.allowHint} onChange={e=>setDetail(index,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>; })}{item.options.length>2 && <button type="button" className="mcqcRemoveOption" onClick={()=>{ update({options:item.options.filter((_,i)=>i!==index),correct:item.correct===index?-1:item.correct>index?item.correct-1:item.correct});setExpandedOptions([]);setExpandedDetail(null); }}>Remove Option</button>}</div>}</div>; })}</div><button type="button" className="mcqcAddOptions" onClick={()=>{update({options:[...item.options,""]});setExpandedOptions([item.options.length]);setExpandedDetail(null);}}><Icon name="plus.svg" size={20}/>Add Options</button></div>
      </div><div className="mcqcBuilderBottom"><div className="mcqcAddMenu mcqcBottomAddMenu"><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" onClick={() => { setBottomAddOpen(v => !v); setAddOpen(false); }} aria-expanded={bottomAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={21}/>Add Questions</button>{bottomAddOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually", "Import From Question Bank", "Generate with AI"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div><div className="mcqcBuilderArrows"><button type="button" className="mcqcRoundNav" aria-label="Previous" onClick={() => setActive(n=>Math.max(0,n-1))}><Icon name="arrowleft.svg"/></button><button type="button" className="mcqcRoundNav" aria-label="Next" onClick={() => { if(active+1<mcqValues.questionCount)setActive(n=>n+1); }}><Icon name="arrowright.svg"/></button></div></div>
    </section><aside className="mcqcBuilderAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="mcqcPoints">Points</label><div className="mcqcPointsControl"><input id="mcqcPoints" type="number" min="0" step="1" value={item.points} onChange={e=>update({points:e.target.value})}/><div className="mcqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(item.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="mcqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(item.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div><div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={item.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={item.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div><div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" aria-label="New tag" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(v=>v!==tag))}>{tag} <span>×</span></button>)}</div></div><div className="mcqcMandatory"><span>Mandatory</span><button type="button" className={`mcqcSwitch ${item.mandatory ? 'mcqcSwitchOn' : ''}`} role="switch" aria-label="Mandatory Question" aria-checked={item.mandatory} onClick={()=>update({mandatory:!item.mandatory})}><span className="mcqcSwitchText">{item.mandatory?'ON':'OFF'}</span><span className="mcqcSwitchKnob"/></button></div><p className="mcqcAsideHint">This Question is Mandatory</p></section><section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{currentDone}/{mcqValues.questionCount}</strong><span>Questions</span></div><div><strong>{questions.reduce((n,q)=>n+(complete(q)?Number(q.points)||0:0),0)}</strong><span>Marks</span></div><div><strong>60</strong><span>Minutes</span></div></div><p>Marks per Question: {mcqValues.marksPerQuestion}</p><div className="mcqcSummaryProgress"><span style={{width:`${Math.min(100,currentDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. Add questions to get started.</p><div className="mcqcBuilderField"><label>Passing Score</label><NeumoSelect value="60%" options={["40%","50%","60%","70%","80%","90%"]} onChange={()=>{}}/></div></section></aside></div>
    {notice && <p className="mcqcBuilderNotice" role="status">{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" onClick={()=>{setNotice("");setPreviewing(true);}}>Preview Questions</button><div className="mcqcSaveContinueGroup">{saveSuccess && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}


// Icon files are loaded from public/assets/assessmenticons/.
// Replace these filenames with the icons you supply; their slots keep the Figma sizes.
const SA_ICON_PATHS = {
  eye: `${ASSETS}view.svg`, ready: `${ASSETS}checkmark-square-02.svg`,
  fullMarks: `${ASSETS}circle-check.svg`, partialMarks: `${ASSETS}partial-marks.svg`, zeroMarks: `${ASSETS}circle-x.svg`,
  modelAnswer: `${ASSETS}model-answer.svg`, graderInfo: `${ASSETS}information-circle.svg`,
  difficulty: `${ASSETS}target-02.svg`, bloom: `${ASSETS}brain-02.svg`, category: `${ASSETS}folder-01.svg`, tag: `${ASSETS}tag-01.svg`,
  breadcrumb: `${ASSETS}arrowrightdouble.svg`,
  arrowDown: `${ASSETS}arrow-down-01.svg`, edit: `${ASSETS}edit-01.svg`,
  feedback: `${ASSETS}message-circle-more.svg`, explanation: `${ASSETS}assignments.svg`, hint: `${ASSETS}idea-01.svg`,
  undo: `${ASSETS}undo.svg`, redo: `${ASSETS}redo.svg`, bold: `${ASSETS}bold.svg`,
  italic: `${ASSETS}italic.svg`, underline: `${ASSETS}underline.svg`,
  pen: `${ASSETS}pen-line.svg`, highlighter: `${ASSETS}highlighter.svg`, pencil: `${ASSETS}pencil-line.svg`,
  bullet: `${ASSETS}dot.svg`, more: `${ASSETS}more-horizontal.svg`,
  plus: `${ASSETS}plus.svg`, remove: `${ASSETS}cancel-02.svg`, checked: `${ASSETS}checkmark-square-02.svg`,
};
function SAIcon({ name, size = 20, className = "" }: { name: keyof typeof SA_ICON_PATHS; size?: number; className?: string }) {
  const path = SA_ICON_PATHS[name];
  return <span className={`saPathIcon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    {path ? <img src={path} width={size} height={size} alt="" onError={event => { event.currentTarget.style.visibility = "hidden"; }} /> : null}
  </span>;
}
function SASelect({ value, options, onChange, label, compact = false }: { value: string; options: string[]; onChange: (value: string) => void; label: string; compact?: boolean }) {
  return <span className={`saSelect ${compact ? "saSelectCompact" : ""}`}>
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select><SAIcon name="arrowDown" size={compact ? 16 : 20} />
  </span>;
}
function SAToolbar({ label, onAction, className = "" }: { label: string; onAction: () => void; className?: string }) {
  const tool = (name: keyof typeof SA_ICON_PATHS, title: string) => <button type="button" aria-label={title} title={title} onClick={onAction}><SAIcon name={name} /></button>;
  return <div className={`saMiniToolbar ${className}`} role="toolbar" aria-label={`${label} formatting`}>
    {tool("undo", "Undo")}{tool("redo", "Redo")}
    <button className="saToolFont" type="button" onClick={onAction}>Arial<SAIcon name="arrowDown" size={16}/></button>
    <button className="saToolSize" type="button" onClick={onAction}>16<SAIcon name="arrowDown" size={16}/></button>
    {tool("bold", "Bold")}{tool("italic", "Italic")}{tool("underline", "Underline")}
    {tool("pencil", "Pencil")}{tool("highlighter", "Highlight")}{tool("pen", "Pen")}{tool("more", "More formatting")}
  </div>;
}

function SARichField({ value, onChange, placeholder = "", label, plain = false, tall = false }: {
  value: string; onChange: (value: string) => void; placeholder?: string; label: string; plain?: boolean; tall?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  return <div className={`saRich ${plain ? "saRichPlain" : ""} ${tall ? "saRichTall" : ""}`}>
    <SAToolbar label={label} onAction={() => input.current?.focus()}/>
    <textarea ref={input} aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>
  </div>;
}
function SASwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="saSwitchLine"><span>{label}</span><button type="button" role="switch" aria-label={label} aria-checked={checked}
    className={`saToggle ${checked ? "saToggleOn" : ""}`} onClick={() => onChange(!checked)}>
    <span className="saToggleTrack"><span>{checked ? "ON" : "OFF"}</span></span><span className="saToggleKnob"/>
  </button></div>;
}

type SALevel = { id: number; title: string; points: string; description: string };
type SACriterion = { id: number; title: string; description: string; levels: SALevel[] };
type SAQuestion = { text: string; points: string; difficulty: string; category: string; bloom: string; mandatory: boolean; answer: string; rubric: string; feedback: string; hint: string };
type SAConfig = {
  responseFormat: string; inputSize: string; minWords: string; maxWords: string; maxChars: string; required: boolean;
  rubricOptions: boolean[]; criteria: SACriterion[]; feedback: string[]; explanation: string;
  hintBefore: boolean; hintAfter: boolean; graderInfo: string;
};
const saInitialLevels = (offset: number): SALevel[] => [
  { id: offset, title: "Excellent", points: "01", description: "Accurate and Complete" },
  { id: offset + 1, title: "Fair", points: "00", description: "Partially correct or incomplete" },
  { id: offset + 2, title: "Poor", points: "00", description: "Incorrect or Missing" },
];
const saDefaultConfig = (): SAConfig => ({
  responseFormat: "Plain Text", inputSize: "5", minWords: "10", maxWords: "50", maxChars: "250", required: true,
  rubricOptions: [true, true, true, true, true, true, false],
  criteria: [
    { id: 1, title: "Concept accuracy", description: "Explains the idea correctly", levels: saInitialLevels(3) },
    { id: 2, title: "Clarity and Language", description: "Clear, Concise sentences", levels: saInitialLevels(6) },
  ],
  feedback: ["Great — you explained both sides of overfitting.", "Partly right — mention how it behaves on new data.", "Review the lesson on generalization."],
  explanation: "Overfitting = low training error, high error on unseen data.", hintBefore: true, hintAfter: false,
  graderInfo: "Accept any answer that contrasts training vs unseen data.",
});
function ShortAnswerExpanded({ value, update, config, onConfigChange }: {
  value: SAQuestion; update: (patch: Partial<SAQuestion>) => void; config: SAConfig;
  onConfigChange: (change: (previous: SAConfig) => SAConfig) => void;
}) {
  const [sections, setSections] = useState<Record<string, boolean>>({ answer: true, model: true, rubric: true, feedback: true, explanation: true, hint: true });
  const { responseFormat, inputSize, minWords, maxWords, maxChars, required, rubricOptions, criteria, feedback, explanation, hintBefore, hintAfter, graderInfo } = config;
  const fieldSetter = <K extends keyof SAConfig,>(key: K) => (next: React.SetStateAction<SAConfig[K]>) =>
    onConfigChange(old => ({ ...old, [key]: typeof next === "function" ? (next as (value: SAConfig[K]) => SAConfig[K])(old[key]) : next }));
  const setResponseFormat = fieldSetter("responseFormat"), setInputSize = fieldSetter("inputSize"), setMinWords = fieldSetter("minWords"), setMaxWords = fieldSetter("maxWords"), setMaxChars = fieldSetter("maxChars"), setRequired = fieldSetter("required");
  const setRubricOptions = fieldSetter("rubricOptions"), setCriteria = fieldSetter("criteria"), setFeedback = fieldSetter("feedback"), setExplanation = fieldSetter("explanation"), setHintBefore = fieldSetter("hintBefore"), setHintAfter = fieldSetter("hintAfter"), setGraderInfo = fieldSetter("graderInfo");
  const nextId = useRef(Math.max(20, ...criteria.flatMap(item => [item.id + 1, ...item.levels.map(level => level.id + 1)])));
  const initialLevels = saInitialLevels;
  const toggle = (key: string) => setSections(old => ({ ...old, [key]: !old[key] }));
  const changeCriterion = (id: number, patch: Partial<SACriterion>) => setCriteria(old => old.map(item => item.id === id ? { ...item, ...patch } : item));
  const changeLevel = (criterionId: number, levelId: number, patch: Partial<SALevel>) => setCriteria(old => old.map(item => item.id === criterionId ? { ...item, levels: item.levels.map(level => level.id === levelId ? { ...level, ...patch } : level) } : item));
  const total = criteria.reduce((sum, criterion) => sum + Math.max(0, ...criterion.levels.map(level => Number(level.points) || 0)), 0);
  const panel = (key: string, heading: string, body: React.ReactNode, meta = "Not shown to Learners", icon: keyof typeof SA_ICON_PATHS = "edit") =>
    <section className={`saAccordion saAccordion-${key}`}>
      <button type="button" className="saAccordionTitle" onClick={() => toggle(key)} aria-expanded={!!sections[key]} aria-controls={`sa-section-${key}`}>
        <span className="saSectionHeading"><span className="saSectionIcon"><SAIcon name={icon} size={16}/></span>{heading}</span>
        <span className="saSectionMeta">{meta}<SAIcon name="arrowDown" size={24} className={sections[key] ? "saArrowOpen" : ""}/></span>
      </button>
      <div id={`sa-section-${key}`} className="saAccordionBody" hidden={!sections[key]}>{body}</div>
    </section>;
  return <div className="mcqcShortAnswerFields saExpanded">
    {panel("answer", "Answer Box Placeholder", <>
      <SARichField value={value.answer} onChange={text => update({ answer: text })} label="Answer box placeholder" placeholder="Type your Short answer (2-3 sentences)..." plain/>
      <div className="saSettingsGrid">
        <label>Response format<SASelect label="Response format" value={responseFormat} onChange={setResponseFormat} options={["Plain Text", "Rich Text"]}/></label>
        <label>Input box size (lines)<SASelect label="Input box size (lines)" value={inputSize} onChange={setInputSize} options={["3", "5", "8", "10"]}/></label>
        <label>Minimum Words<SASelect label="Minimum Words" value={minWords} onChange={setMinWords} options={["0", "5", "10", "20", "30"]}/></label>
        <label>Maximum Words<SASelect label="Maximum Words" value={maxWords} onChange={setMaxWords} options={["25", "50", "100", "150", "250"]}/></label>
        <label>Maximum Characters<SASelect label="Maximum Characters" value={maxChars} onChange={setMaxChars} options={["100", "250", "500", "1000", "2000"]}/></label>
      </div>
      <SASwitch label="Response Required" checked={required} onChange={setRequired}/>
    </>, "180/250")}
    {panel("model", "Model Answer and Grader Information", <>
      <div className="saLabeledField"><div className="saSmallLabel">Model Answer</div><SARichField value={value.rubric} onChange={text => update({ rubric: text })} label="Model Answer" placeholder="Overfitting happens when a model memorizes the training data, so it performs well there but fails on new data." tall/></div>
      <div className="saLabeledField"><div className="saSmallLabel">Information for Graders</div><SARichField value={graderInfo} onChange={setGraderInfo} label="Information for Graders"/></div>
    </>)}
    {panel("rubric", "Grading Method and Rubrics", <>
      <div className="saCriteria">
        {criteria.map((criterion, index) => <div className="saCriterion" key={criterion.id}>
          <div className="saLabeledField"><div className="saSmallLabel saLabelStrong">Criterion {index + 1}</div>
            <SASelect label={`Criterion ${index + 1}`} value={criterion.title} onChange={title => changeCriterion(criterion.id, { title })} options={["Concept accuracy", "Clarity and Language", "Completeness", "Relevance"]}/>
          </div>
          <div className="saLabeledField"><div className="saSmallLabel">Description</div><SARichField label={`Criterion ${index + 1} description`} value={criterion.description} onChange={description => changeCriterion(criterion.id, { description })}/></div>
          <div className="saLevelGrid">{criterion.levels.map((level, levelIndex) => <div className="saLevel" key={level.id}>
            <div className="saLevelTitle">Level {levelIndex + 1}<button type="button" className="saRemoveLevel" aria-label={`Remove criterion ${index + 1} level ${levelIndex + 1}`} onClick={() => changeCriterion(criterion.id, { levels: criterion.levels.filter(item => item.id !== level.id) })}><SAIcon name="remove" size={16}/></button></div>
            <div className="saLevelFields">
              <label>Title<SASelect compact label={`Criterion ${index + 1} level ${levelIndex + 1} title`} value={level.title} onChange={title => changeLevel(criterion.id, level.id, { title })} options={["Excellent", "Fair", "Poor"]}/></label>
              <label>Points<SASelect compact label={`Criterion ${index + 1} level ${levelIndex + 1} points`} value={level.points} onChange={points => changeLevel(criterion.id, level.id, { points })} options={["00", "01", "02", "03", "04", "05", "10"]}/></label>
              <label>Description<textarea aria-label={`Criterion ${index + 1} level ${levelIndex + 1} description`} value={level.description} onChange={event => changeLevel(criterion.id, level.id, { description: event.target.value })}/></label>
            </div>
          </div>)}</div>
          <div className="saCriterionActions">
            <button type="button" onClick={() => changeCriterion(criterion.id, { levels: [...criterion.levels, { id: nextId.current++, title: "Poor", points: "00", description: "" }] })}><SAIcon name="plus"/>Add Level</button>
            <button type="button" onClick={() => setCriteria(old => old.filter(item => item.id !== criterion.id))}>Remove Criterion</button>
          </div>
        </div>)}
      </div>
      <button className="saAddCriterion" type="button" onClick={() => { const id = nextId.current; nextId.current += 4; setCriteria(old => [...old, { id, title: "Concept accuracy", description: "", levels: initialLevels(id + 1) }]); }}><SAIcon name="plus" size={22}/><span>Add Criterion</span></button>
      <div className="saTotal"><span>Total Points From Criteria</span><strong>{total}</strong></div>
      <div className="saRubricOptions"><div className="saSmallLabel saLabelStrong">Rubric Options</div><div className="saRubricSwitches">
        {["Use rubric total as question points", "Allow learners to preview the rubric", "Show criterion description to learners", "Show points per level to learners", "Allow grader to add comments per criterion", "Calculate grade with maximum score of", "Hide level scores while grading"].map((label, index) =>
          <SASwitch key={label} label={label} checked={rubricOptions[index]} onChange={checked => setRubricOptions(old => old.map((item, i) => i === index ? checked : item))}/>
        )}
      </div></div>
    </>)}
    {panel("feedback", "Feedback", <>{["Full Marks", "Partial Marks", "Zero Marks"].map((label, index) => <div className={`saLabeledField saFeedback-${index}`} key={label}>
      <div className="saSmallLabel">{label}</div><SARichField label={label} value={feedback[index]} onChange={text => setFeedback(old => old.map((item, i) => i === index ? text : item))} tall/>
    </div>)}</>, "180/250", "feedback")}
    {panel("explanation", "Explanation", <SARichField label="Explanation" value={explanation} onChange={setExplanation} plain/>, "180/250", "explanation")}
    {panel("hint", "Hint", <>
      <SARichField label="Hint" value={value.hint} onChange={text => update({ hint: text })} placeholder="Think about training data versus new data." plain/>
      <div className="saHintChecks">{[["Show hint before answering", hintBefore, setHintBefore], ["Allow learner to request hint", hintAfter, setHintAfter]].map(([label, checked, change]) =>
        <label className={`saCheck ${checked ? "saCheckOn" : ""}`} key={String(label)}><input type="checkbox" checked={Boolean(checked)} onChange={event => (change as (value: boolean) => void)(event.target.checked)}/><span className="saCheckBox">{checked ? <SAIcon name="checked" size={16}/> : null}</span><span>{String(label)}</span></label>
      )}</div>
    </>, "180/250", "hint")}
  </div>;
}


// Preview stays in this page; shared Header and Sidebar remain in the outer layout.
// All preview icons use SA_ICON_PATHS above. No embedded SVGs or icon library required.
function SAPreviewSection({ title, id, children, compact = false }: { title: string; id: string; children: React.ReactNode; compact?: boolean }) {
  const [open, setOpen] = useState(true);
  return <section className={`sapSection ${compact ? "sapSectionCompact" : ""}`}>
    <h2><button type="button" className="sapSectionToggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(old => !old)}>
      {title}<SAIcon name="arrowDown" size={24} className={open ? "" : "sapArrowClosed"}/>
    </button></h2>
    <div id={id} className="sapSectionBody" hidden={!open}>{children}</div>
  </section>;
}
function SAPreviewCard({ title, icon, children, tone = "", inset = false }: {
  title: string; icon: keyof typeof SA_ICON_PATHS; children: React.ReactNode; tone?: string; inset?: boolean;
}) {
  return <section className={`sapCard ${tone ? `sapCard-${tone}` : ""} ${inset ? "sapFeedbackCard" : ""}`}>
    <h3><span className="sapRoundIcon"><SAIcon name={icon} size={20}/></span>{title}</h3>
    <div className={`sapCardText ${inset ? "sapFeedbackText" : ""}`}>{children}</div>
  </section>;
}
const saQuestionComplete = (question: SAQuestion) => !!question.text.trim() && question.points.trim() !== "" && Number.isFinite(Number(question.points)) && Number(question.points) >= 0;
function ShortAnswerPreview({ questions, configs, tags, onBack, onExit, onContinue, notice }: {
  questions: SAQuestion[]; configs: Record<number, SAConfig>; tags: string[]; onBack: (index?: number) => void;
  onExit: () => void; onContinue: () => void; notice: string;
}) {
  const [filter, setFilter] = useState("All Questions");
  const [learner, setLearner] = useState(false);
  const [learnerAnswers, setLearnerAnswers] = useState<Record<number, string>>({});
  const ready = questions.length > 0 && questions.every(saQuestionComplete);
  const total = questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
  const visible = questions.map((question, index) => ({ question, index })).filter(({ question }) => filter === "All Questions" || (filter === "Complete" ? saQuestionComplete(question) : !saQuestionComplete(question)));
  return <div className="sapPreview">
    <nav className="sapBreadcrumb" aria-label="Breadcrumb">
      <Link href="/assessments">Assessment</Link><SAIcon name="breadcrumb" size={20}/>
      <button type="button" onClick={onExit}>Create Assessment</button><SAIcon name="breadcrumb" size={20}/>
      <button type="button" onClick={() => onBack()}>Create Questions</button><SAIcon name="breadcrumb" size={20}/>
      <span aria-current="page">Preview Questions</span>
    </nav>
    <header className="sapPageTitle"><h1 id="sa-preview-title" tabIndex={-1}>Preview Questions</h1><p>Review Your Questions Before Saving.</p></header>
    <div className="sapOverview">
      <div className="sapSummary" aria-label="Question summary">
        <div className="sapCount"><strong>{questions.length}</strong><span>Questions</span></div>
        <div className="sapCount"><strong>{total}</strong><span>Marks</span></div>
        <div className={`sapReady ${ready ? "sapReadyComplete" : ""}`}><SAIcon name="ready" size={20}/><div><strong>{ready ? "Ready" : "Needs review"}</strong><span>{ready ? "All good to continue" : "Complete your questions"}</span></div></div>
      </div>
      <div className="sapPreviewActions">
        <label className="sapFilter"><select aria-label="Filter preview questions" value={filter} onChange={event => setFilter(event.target.value)}>{["All Questions", "Complete", "Incomplete"].map(option => <option key={option}>{option}</option>)}</select><SAIcon name="arrowDown" size={20}/></label>
        <button className="sapLearnerButton" type="button" aria-pressed={learner} onClick={() => setLearner(old => !old)}><SAIcon name="eye" size={24}/>{learner ? "Author Preview" : "Learner Preview"}</button>
      </div>
    </div>
    <div className="sapQuestionList">
      {visible.map(({ question, index }) => {
        const config = configs[index] ?? saDefaultConfig();
        const complete = saQuestionComplete(question);
        return <article className="sapQuestion" key={index} aria-label={`Question ${index + 1} preview`}>
          <div className="sapMetadata"><span className="sapPill">Short Answer: <strong>{question.points || "0"} {Number(question.points) === 1 ? "Point" : "Points"}</strong></span>
            {!learner && <><span className={`sapPill sapStatus ${complete ? "sapStatusComplete" : ""}`}>Status : <strong>{complete ? "Complete" : "Incomplete"}</strong></span>
            <button className="sapPill sapEdit" type="button" onClick={() => onBack(index)} aria-label={`Edit question ${index + 1}`}><SAIcon name="edit" size={16}/>Edit</button></>}
          </div>
          <section className="sapQuestionText"><h2>Questions {index + 1}</h2><p>{question.text || "No question entered yet."}</p></section>
          {learner ? <label className="sapLearnerAnswer"><span>Your Answer{config.required ? " (required)" : ""}</span><textarea aria-label={`Answer question ${index + 1}`} rows={Number(config.inputSize) || 5} maxLength={Number(config.maxChars) || undefined} placeholder={question.answer || "Type your Short answer (2-3 sentences)..."} value={learnerAnswers[index] ?? ""} onChange={event => setLearnerAnswers(old => ({ ...old, [index]: event.target.value }))}/><small>{config.minWords}–{config.maxWords} words · {config.maxChars} characters maximum</small>{config.hintBefore && question.hint && <p>Hint: {question.hint}</p>}</label> : <>
            <div className="sapAnswerPlaceholder">{question.answer || "Answer Box Placeholder"}</div>
            <SAPreviewSection title="Answer Settings" id={`sap-answer-${index}`}>
              <dl className="sapAnswerGrid">
                <div><dt>Responses</dt><dd><span>{config.responseFormat}</span><span>{config.inputSize} lines</span></dd></div>
                <div><dt>Length</dt><dd>{config.minWords}–{config.maxWords} words– {config.maxChars} character</dd></div>
                <div><dt>Required</dt><dd>{config.required ? "YES" : "NO"}</dd></div>
              </dl>
              <SAPreviewCard title="Model Answer" icon="modelAnswer"><p>{question.rubric || "No model answer provided."}</p></SAPreviewCard>
              <section className="sapCard sapRubric"><h3><span className="sapRoundIcon"><SAIcon name="modelAnswer" size={20}/></span>Grading – Rubric</h3>
                <div className="sapRubricRows" role="table" aria-label={`Question ${index + 1} grading rubric`}>
                  {config.criteria.length ? config.criteria.map(criterion => <div className="sapRubricRow" role="row" key={criterion.id} style={{ gridTemplateColumns: `minmax(0, .95fr) repeat(${Math.max(1, criterion.levels.length)}, minmax(0, 1fr))` }}>
                    <div role="rowheader"><strong>{criterion.title}</strong><p>{criterion.description}</p></div>
                    {criterion.levels.map(level => <div role="cell" key={level.id} className={`sapLevel-${level.title.toLowerCase()}`}><strong>{level.title} -{Number(level.points) || 0}</strong><p>{level.description}</p></div>)}
                  </div>) : <p className="sapEmptyRubric">No grading criteria added.</p>}
                </div>
              </section>
            </SAPreviewSection>
            <SAPreviewSection title="Feedback and Learning" id={`sap-feedback-${index}`}>
              <SAPreviewCard title="Full Marks" icon="fullMarks" tone="full" inset><p>{config.feedback[0] || "No feedback provided."}</p></SAPreviewCard>
              <SAPreviewCard title="Partial Marks" icon="partialMarks" tone="partial" inset><p>{config.feedback[1] || "No feedback provided."}</p></SAPreviewCard>
              <SAPreviewCard title="Zero Marks" icon="zeroMarks" tone="zero" inset><p>{config.feedback[2] || "No feedback provided."}</p></SAPreviewCard>
              <SAPreviewCard title="Explanation" icon="explanation" tone="explanation"><p>{config.explanation || "No explanation provided."}</p></SAPreviewCard>
              <SAPreviewCard title="Hint" icon="hint"><p>{question.hint || "No hint provided."}</p></SAPreviewCard>
              <SAPreviewCard title="Information for Graders" icon="graderInfo"><p>{config.graderInfo || "No grader information provided."}</p></SAPreviewCard>
            </SAPreviewSection>
            <SAPreviewSection title="Question Settings" id={`sap-settings-${index}`} compact>
              <dl className="sapQuestionSettings">
                {([{ label: "Difficulty", value: question.difficulty, icon: "difficulty" }, { label: "Blooms Taxonomy", value: question.bloom, icon: "bloom" }, { label: "Category", value: question.category, icon: "category" }, { label: "Tags", value: tags.join(", ") || "—", icon: "tag" }, { label: "Mandatory", value: question.mandatory ? "YES" : "NO", icon: "fullMarks" }] as const).map(setting => <div key={setting.label}><dt>{setting.label}</dt><dd><SAIcon name={setting.icon} size={24}/><span title={setting.value}>{setting.value}</span></dd></div>)}
              </dl>
            </SAPreviewSection>
          </>}
          {index === visible[visible.length - 1]?.index && <div className="sapFooter"><button type="button" onClick={() => onBack()}>Back to Question</button><button type="button" className="sapContinue" onClick={onContinue}>Save And Continue</button></div>}
        </article>;
      })}
      {!visible.length && <div className="sapNoQuestions"><p>No questions match this filter.</p><button type="button" className="sapLearnerButton" onClick={() => setFilter("All Questions")}>Show All Questions</button><button type="button" className="sapLearnerButton" onClick={() => onBack()}>Back to Question</button></div>}
    </div>
    {notice && <p role="status" className="sapNotice">{notice}</p>}
  </div>;
}

function ShortAnswerBuilder({ onExit, mcqValues, assessmentId }: { onExit: () => void; mcqValues: MCQDetailsValues; assessmentId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<SAQuestion[]>([{ text: "", points: "1", difficulty: "Medium", category: "", bloom: "", mandatory: true, answer: "", rubric: "", feedback: "", hint: "" }]);
  const [active, setActive] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [configs, setConfigs] = useState<Record<number, SAConfig>>({ 0: saDefaultConfig() });
  const updateConfig = (change: (previous: SAConfig) => SAConfig) => setConfigs(old => ({ ...old, [active]: change(old[active] ?? saDefaultConfig()) }));
  const switchPreview = (next: boolean, index?: number) => {
    if (index !== undefined) setActive(index);
    setPreviewing(next);
    requestAnimationFrame(() => { document.querySelector(".mcqcScrollArea")?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); document.getElementById(next ? "sa-preview-title" : "short-question-text")?.focus({ preventScroll: true }); });
  };
  const [answerOpen, setAnswerOpen] = useState(false);
  const [shortAddOpen, setShortAddOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [shortReady, setShortReady] = useState(false);
  useEffect(() => {
    if (!assessmentId) return;
    const content = readQCRecord(assessmentId)?.content as QCContentDraft | undefined;
    if (content?.shortQuestions?.length) setQuestions(content.shortQuestions);
    if (content?.shortConfigs) setConfigs(content.shortConfigs);
    if (content?.shortTags) setTags(content.shortTags);
    setShortReady(true);
  }, [assessmentId]);
  useEffect(() => {
    if (shortReady && assessmentId) writeQCContent(assessmentId, { shortQuestions: questions, shortConfigs: configs, shortTags: tags });
  }, [shortReady, assessmentId, questions, configs, tags]);
  const current = questions[active];
  const update = (patch: Partial<typeof current>) => setQuestions(old => old.map((q, i) => i === active ? { ...q, ...patch } : q));
  const save = () => {
    if (!assessmentId) { setNotice("Assessment ID missing. Save Details first."); return false; }
    if (!questions.length || questions.some(q => !q.text.trim() || !q.category || !q.bloom || !Number.isFinite(Number(q.points)) || Number(q.points) <= 0)) {
      setNotice("Complete question text, points, category and Bloom's level before saving."); return false;
    }
    try {
      if (!writeQCContent(assessmentId, { shortQuestions: questions, shortConfigs: configs, shortTags: tags }, true)) throw Error("Missing assessment");
      try { sessionStorage.setItem("quantumChampsShortAnswerContentDraft", JSON.stringify({ questions, tags, configs, assessmentId })); } catch { /* The primary assessment record was saved. */ }
      setSaved(true); setNotice("Successfully saved"); return true;
    } catch { setNotice("Could not save. Please try again."); return false; }
  };
  const add = () => { setQuestions(old => [...old, { text: "", points: "1", difficulty: "Medium", category: "AI", bloom: "Analyze", mandatory: true, answer: "", rubric: "", feedback: "", hint: "" }]); setActive(questions.length); setAnswerOpen(false); };
  const chooseShortAdd = (option: string) => { setShortAddOpen(false); if (option === "Create Manually") add(); else setNotice(`${option} will be available when connected.`); };
  const toolbar = <SAToolbar className="mcqcShortToolbar" label="Write Your Question" onAction={() => document.getElementById("short-question-text")?.focus()}/>;
  if (previewing) return <ShortAnswerPreview questions={questions} configs={configs} tags={tags} notice={notice}
    onBack={(index) => switchPreview(false, index)} onExit={onExit} onContinue={() => { if (save()) router.push('/quantum-champs/QC_Evaluation'); }}/>;
  return <div className="mcqcBuilder mcqcShortBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg"/><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg"/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Antony?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain"><div className="mcqcQuestionForm">
      <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Short Answer" onChange={() => {}}/></div>
      <div className="mcqcBuilderField mcqcWriteField"><div className="mcqcFormHeading"><label htmlFor="short-question-text">Write Your Question</label><span>{current.text.length}/250</span></div><div className="mcqcEditorSurface">{toolbar}<textarea id="short-question-text" maxLength={250} rows={3} placeholder="Write your question here..." value={current.text} onChange={e => update({ text: e.target.value })}/></div></div>
      <div className="mcqcBuilderField mcqcShortAnswerSettings"><div className="mcqcFormHeading"><label>Answer Settings</label><span>24/250</span></div><button type="button" className="mcqcSelectTrigger mcqcShortAnswerTrigger" aria-expanded={answerOpen} onClick={() => setAnswerOpen(v => !v)}><span>Answer box, Model answer, Rubrics, Feedback and Hint</span><Icon name="arrow-down-01.svg" size={20} className={answerOpen ? "mcqcRotated" : ""}/></button>{answerOpen && <ShortAnswerExpanded key={active} value={current} update={update} config={configs[active] ?? saDefaultConfig()} onConfigChange={updateConfig} />}</div>
    </div><div className="mcqcAddMenu mcqcShortAddMenu"><button type="button" className="mcqcShortAdd" onClick={() => setShortAddOpen(v => !v)} aria-expanded={shortAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={22}/>Add Questions</button>{shortAddOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually", "Import From Question Bank", "Generate with AI"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseShortAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`}/>{option}</button>)}</div>}</div></section>
    <aside className="mcqcBuilderAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="short-points">Points</label><input id="short-points" type="number" min="0" value={current.points} onChange={e=>update({points:e.target.value})}/></div><div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={current.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={current.category} options={CATEGORIES} onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={current.bloom} options={BLOOMS} onChange={v=>update({bloom:v})}/></div><div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" autoFocus aria-label="New tag" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(t=>t!==tag))}>{tag} <span>×</span></button>)}</div></div><div className="mcqcMandatory"><span>Mandatory</span><button type="button" role="switch" aria-label="Mandatory" aria-checked={current.mandatory} className={`mcqcSwitch ${current.mandatory ? 'mcqcSwitchOn' : ''}`} onClick={()=>update({mandatory:!current.mandatory})}><span className="mcqcSwitchText">{current.mandatory?'ON':'OFF'}</span><span className="mcqcSwitchKnob"/></button></div><p className="mcqcAsideHint">This Question is Mandatory</p></section></aside></div>
    <div className="mcqcShortFooter"><button type="button" className="mcqcFooterPill" onClick={()=>{setNotice("");switchPreview(true);}}>Preview Questions</button><div className="mcqcShortFooterRight"><button type="button" className="mcqcFooterPill" onClick={save}>Save</button><button type="button" className="mcqcFooterPill mcqcFooterContinue" onClick={()=>{if (!saved) { setNotice('Please click Save first, then Continue.'); return; } if (save()) router.push('/quantum-champs/QC_Evaluation');}}>Continue</button></div></div>{notice && <p role="status" className="mcqcBuilderNotice">{notice}</p>}
  </div>;
}

type MCQDetailsValues = { totalMarks: number; questionCount: number; marksPerQuestion: number };
const DEFAULT_MCQ_VALUES: MCQDetailsValues = { totalMarks: 20, questionCount: 20, marksPerQuestion: 1 };
const positiveInteger = (value: unknown, fallback: number) => { const number = Number(value); return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback; };
const nonnegativeNumber = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 0 ? number : fallback; };
export default function MCQContentPage() {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState("");
  const [recordReady, setRecordReady] = useState(false);
  const [savedSignature, setSavedSignature] = useState("");
  const [settings, setSettings] = useState<Record<string, boolean>>(() => Object.fromEntries(SETTINGS.map(item => [item.key, item.defaultOn])));
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(false);
  const [mcqValues, setMcqValues] = useState<MCQDetailsValues>(DEFAULT_MCQ_VALUES);
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  useEffect(() => {
    const id = localStorage.getItem(QC_CURRENT_ID);
    if (!id || !readQCRecord(id)) { setMessage("No saved assessment found. Go back to Details and save it first."); setRecordReady(true); return; }
    const record = readQCRecord(id)!;
    const content = record.content as QCContentDraft | undefined;
    setAssessmentId(id);
    if (content?.settings) setSettings(old => ({ ...old, ...content.settings }));
    const details = record as Record<string, unknown>;
    const configuredCount = positiveInteger(details.questionCount ?? details.totalQuestions ?? (Number(details.questionsPerRound) * Number(details.rounds)), 20);
    const count = content?.questions?.length || configuredCount;
    const marks = nonnegativeNumber(details.totalMarks ?? details.totalXP, 20);
    const perQuestion = nonnegativeNumber(details.marksPerQuestion, 1);
    setMcqValues({ questionCount: count, totalMarks: marks, marksPerQuestion: perQuestion });
    const loadedQuestions = Array.from({ length: count }, (_, index) => content?.questions?.[index] ?? { ...newQuestion(), points: String(perQuestion) });
    setQuestions(loadedQuestions);
    if (content?.saved) setSavedSignature(JSON.stringify({ settings: { ...Object.fromEntries(SETTINGS.map(item => [item.key, item.defaultOn])), ...content.settings }, questions: loadedQuestions }));
    setRecordReady(true);
  }, []);
  useEffect(() => {
    if (recordReady && assessmentId) writeQCContent(assessmentId, { settings, questions });
  }, [recordReady, assessmentId, settings, questions]);

  const currentSignature = JSON.stringify({ settings, questions });
  const saveContent = () => {
    if (!assessmentId) { setMessage("Please save Assessment Details first."); return; }
    if (!writeQCContent(assessmentId, { settings, questions }, true)) { setMessage("Unable to find this assessment. Save Details first."); return; }
    setSavedSignature(currentSignature);
    setMessage(`Content saved under assessment ${assessmentId}.`);
  };
  const continueContent = () => {
    if (!savedSignature || savedSignature !== currentSignature) { setMessage("Please click Save first, then Continue."); return; }
    if (!questions.length || questions.some(q => !q.text.trim() || q.options.filter(o => o.trim()).length < 2 || q.correct < 0 || !q.options[q.correct]?.trim() || !q.category || !q.bloom)) {
      setMessage("Complete and save all questions before continuing to Evaluation."); return;
    }
    router.push("/quantum-champs/QC_Evaluation");
  };
const action = (name: string) => !assessmentId ? setMessage("Please save Assessment Details first.") : name === "Create Questions" ? router.push("/quantum-champs/QC_Create_Question") : setMessage(`${name} will be available when question creation is connected.`);
  return (
    <main className="mcqcAppShell">
      <div className="mcqcLayout">
        <Sidebar />
        <section className="mcqcMainContent">
          <div className="mcqcHeader"><Header /></div>
          <div className="mcqcScrollArea">
            {building ? <div className="mcqcPageContent"><ShortAnswerBuilder mcqValues={mcqValues} assessmentId={assessmentId} onExit={() => setBuilding(false)} /></div> : <div className="mcqcPageContent">
              <div className="mcqcBreadcrumb" aria-label="Breadcrumb">
                <Link href="/assessments">Assessment</Link>
                <Icon name="arrowrightdouble.svg" size={20} />
                <Link href="/quantum-champs?resume=1" className="mcqcBreadcrumbCurrent">Create Assessment</Link>
              </div>
              <ol className="mcqcWizard" aria-label="Assessment creation progress">
                {STEPS.map((step, index) => <li key={step} className={`mcqcWizardStep ${index < 2 ? "mcqcWizardDone" : index === 2 ? "mcqcWizardActive" : ""}`}>
                  <span className="mcqcWizardNumber"><span>{index + 1}</span></span><span className="mcqcWizardText">{step}</span>
                </li>)}
              </ol>
              <header className="mcqcPageTitle"><h1>Assessment Content (Short Anwers)</h1><p>Add Questions To Your Assessment.</p></header>
              <div className="mcqcColumns">
                <div className="mcqcLeftColumn">
                  <section className="mcqcQuestionsPanel" aria-label="Questions">
                    <h2>Questions (0)</h2>
                    <div className="mcqcEmptyState">
                      <Icon name="package-open.svg" size={129} className="mcqcEmptyIcon" />
                      <h3>No Questions Added Yet</h3>
                      <p>Start by Adding Questions.</p>
                      <div className="mcqcActions">
                        <button type="button" onClick={() => action("Bulk Upload")}><Icon name="upload.svg" />Bulk Upload</button>
                        <button type="button" onClick={() => action("Question Bank")}><Icon name="clipboard-list.svg" size={24} />Question Bank</button>
                        <button type="button" onClick={() => action("Generate With AI")}><Icon name="ai-chip.svg" size={24} />Generate With AI</button>
                      </div>
                      <button className="mcqcCreateButton" type="button" onClick={() => action("Create Questions")}><Icon name="plus.svg" size={24} />Create Questions</button>
                    </div>
                  </section>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <button type="button" className="mcqcBack" onClick={() => router.push("/quantum-champs?resume=1")}>Back</button>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button type="button" className="mcqcBack" onClick={saveContent}>Save</button>
                      <button type="button" className="mcqcBack" onClick={continueContent}>Continue</button>
                    </div>
                  </div>
                </div>
                <aside className="mcqcSummaryPanel" aria-label="Assessment summary and settings">
                  <section className="mcqcSummarySection">
                    <h2>Assessment Summary</h2>
                    <div className="mcqcSummaryRow"><Icon name="quiz.svg" /><span>Questions</span><strong>{mcqValues.questionCount}</strong></div>
                    <div className="mcqcSummaryRow"><Icon name="checkmark-circle.svg" /><span>Total Marks</span><strong>{mcqValues.totalMarks}</strong></div>
                    <div className="mcqcSummaryRow"><Icon name="checkmark-circle.svg"/><span>Marks per Question</span><strong>{mcqValues.marksPerQuestion}</strong></div>
                    <div className="mcqcSummaryRow"><Icon name="alarm-clock.svg" /><span>Time</span><strong>60 Min</strong></div>
                    <div className="mcqcSummaryRow"><Icon name="locate-fixed.svg" /><span>Passing Score</span><strong>60%</strong></div>
                  </section>
                  <section className="mcqcSettingsSection"><h2>Assessment Settings</h2>
                    {SETTINGS.map(item => <div className="mcqcSettingRow" key={item.key}>
                      <Icon name={item.icon} size={19} /><span>{item.label}</span>
                      <button type="button" role="switch" aria-label={item.label} aria-checked={settings[item.key]}
                        className={`mcqcSwitch ${settings[item.key] ? "mcqcSwitchOn" : ""}`}
                        onClick={() => setSettings(previous => ({ ...previous, [item.key]: !previous[item.key] }))}>
                        <span className="mcqcSwitchText">{settings[item.key] ? "ON" : "OFF"}</span><span className="mcqcSwitchKnob" />
                      </button>
                    </div>)}
                    <button type="button" className="mcqcConfigure" onClick={() => action("Configure")}>Configure</button>
                  </section>
                </aside>
              </div>
              {message && <p className="mcqcMessage" role="status">{message}</p>}
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
