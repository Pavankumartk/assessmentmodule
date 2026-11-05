"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { getDemoSession } from "@/modules/assessments/auth/demo-auth";
import { MCQRichEditor } from "@/modules/assessments/components/common/steps/ContentStep/ContentStep";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./content.css";
import "./ai-button.css";

const ASSETS = "/assets/assessmenticons/";
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
const newQuestion = (): Question => ({ type: "", text: "", options: ["", ""], correct: -1, points: "", difficulty: "", category: "", bloom: "", mandatory: true });
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
  return <div className="mcqcSelectRoot mcqcTypeRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="mcqcSelectTrigger" aria-label="Question Type" disabled aria-expanded={open} aria-controls="mcqcQuestionTypeList" onClick={() => setOpen(previous => !previous)}>
      <span>{label}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "mcqcRotated" : ""}/>
    </button>
    {open && <div id="mcqcQuestionTypeList" className="mcqcTypeDropdown">
      <label className="mcqcTypeSearch"><Icon name="search-02.svg" size={20}/><input autoFocus type="search" maxLength={250} placeholder="Search assessment types..." value={search} onChange={event => setSearch(event.target.value)}/></label>
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
  return <div className="mcqcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="mcqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="mcqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="mcqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}><span className={`mcqcOptionRadio ${value === option ? "mcqcOptionSelected" : ""}`} /><span>{option}</span></button>)}</div>}</div>;
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
    <nav className="mcqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><Link href="/assessments/create/details">Create Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="mcqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="mcqcPreviewControls"><div className="mcqcPreviewTotals"><div><strong>{valid.length}</strong><span>Questions</span></div><div><strong>{mcqValues.totalMarks}</strong><span>Marks</span></div><div className="mcqcPreviewReady"><span className="mcqcPreviewReadyCheck" aria-hidden="true" /><span><strong>{valid.length && valid.every(({q})=>ready(q))?"Ready":"In Progress"}</strong><small>{valid.length && valid.every(({q})=>ready(q))?"All good to continue":"Review incomplete questions"}</small></span></div></div><div className="mcqcPreviewTools"><div className="mcqcPreviewFilter"><button type="button" onClick={()=>setShowFilter(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{showFilter && <div>{["All Questions","Complete","Incomplete"].map(f=><button key={f} type="button" onClick={()=>{setFilter(f);setOpenQuestion(0);setShowFilter(false);}}>{f}</button>)}</div>}</div><button type="button" className="mcqcPreviewLearner" onClick={()=>setLearner(v=>!v)}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div></div>
      {current ? <article className="mcqcPreviewQuestion" key={current.index}><div className="mcqcPreviewMeta"><span>{current.q.type}: {current.q.points} Points</span><span>Status: <b className={ready(current.q)?"mcqcGreen":"mcqcOrange"}>{ready(current.q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(current.index)}><Icon name="edit.svg" size={16}/> Edit</button></div>
        <div className="mcqcPreviewPanel"><h3>Question {current.index+1}</h3><p>{current.q.text||"Question has not been written yet."}</p></div>
        <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("answers")}>Answer Options <Icon name="arrow-down-01.svg" size={18} className={sections.answers?"mcqcRotated":""}/></button>{sections.answers && <div className="mcqcPreviewAnswers">{current.q.options.map((answer,i)=><div key={i} className={`mcqcPreviewAnswer ${current.q.correct===i?"correct":"incorrect"}`}><PreviewStatus correct={current.q.correct===i} size={20}/><span className="mcqcAnswerLetter">{String.fromCharCode(65+i)}</span><span className="mcqcPreviewAnswerText">{answer||`Option ${String.fromCharCode(65+i)} (empty)`}</span>{!learner && <small>{current.q.correct===i?"Correct Answer":"Wrong Answer"}</small>}</div>)}</div>}</div>
        {!learner && <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("learning")}>Feedback and Learning <Icon name="arrow-down-01.svg" size={18} className={sections.learning?"mcqcRotated":""}/></button>{sections.learning && <div className="mcqcPreviewLearning"><section><h4><PreviewStatus correct={true} size={20}/> Correct-answer Feedback</h4>{current.q.options.map((answer,i)=>current.q.correct===i?<div key={i} className="mcqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={true} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><PreviewStatus correct={false} size={20}/> Wrong-answer Feedback</h4>{current.q.options.map((answer,i)=>current.q.correct!==i?<div key={i} className="mcqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={false} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><Icon name="assignments.svg" size={20}/> Explanation</h4><p>{current.q.correct >= 0 ? detail(current.index,current.q.correct).explanation.trim() || "No explanation entered." : "No correct answer selected."}</p></section><section><h4><Icon name="idea.svg" size={20}/> Hint</h4><p>{current.q.correct >= 0 ? detail(current.index,current.q.correct).hint.trim() || "No hint entered." : "No correct answer selected."}</p></section></div>}</div>}
        {!learner && <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={sections.settings?"mcqcRotated":""}/></button>{sections.settings && <div className="mcqcPreviewSettings">{[["Difficulty",current.q.difficulty,"blueview.svg"],["Bloom’s Taxonomy",current.q.bloom||"Not selected","brain.svg"],["Category",current.q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",current.q.mandatory?"YES":"NO","circle-check.svg"]].map(([label,value,icon])=><div key={label}><span>{label}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}</div>}
        <div className="mcqcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button></div></article>:<div className="mcqcPreviewEmpty"><p>{filter==="All Questions"?"No questions have been entered yet.":`No ${filter.toLowerCase()} questions found.`}</p><button type="button" onClick={onBack}>Back to Question</button></div>}
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

function QuestionBuilder({ questions, setQuestions, onExit, mcqValues }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onExit: () => void; mcqValues: MCQDetailsValues }) {
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
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);
  const saveAndContinue = () => {
    if (isSaving) return;
    try {
      assessmentStorage.setItem("shortAnswerContentDraft", JSON.stringify({ questions, optionDetails, tags, savedAt: new Date().toISOString() }));
      setNotice("");
      setSaveSuccess(true);
      setIsSaving(true);
      saveTimer.current = window.setTimeout(() => { setSaveSuccess(false); setIsSaving(false); router.push("/assessments/create/evaluation"); }, 3000);
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
  const chooseAdd = (option: string) => { setAddOpen(false); setBottomAddOpen(false); if (option === "Generate with AI") { router.push("/assessments/create/ai?type=short-answer"); return; } if (option === "Create Manually") addQuestion(); else setNotice(`${option} will be available when connected.`); };
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
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading"><div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div><div className="mcqcAddMenu"><button type="button" className="mcqcTopAdd" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}><Icon name="plus.svg" size={20} />Add</button>{addOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div></div>
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

      <div className="mcqcQuestionForm"><div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value={item.type} onChange={v => update({ type:v })}/></div>
        <div className="mcqcBuilderField mcqcWriteField"><label htmlFor="mcqcQuestionText">Write Your Question <small>{item.text.length}/250</small></label><div className="mcqcEditorSurface">{optionToolbar("mcqcQuestionText")}<textarea id="mcqcQuestionText" maxLength={250} rows={3} placeholder="Write your question here..." value={item.text} onChange={e => update({ text: e.target.value })}/></div></div>
        <div className="mcqcBuilderField"><label>Available Options</label><div className="mcqcAnswerOptions">{item.options.map((option,index) => { const open = expandedOptions.includes(index); const detail = getDetail(index); return <div className="mcqcAnswerSection" key={index}><button type="button" className="mcqcAnswerExpand" aria-expanded={open} onClick={() => { setExpandedOptions(open ? [] : [index]); setExpandedDetail(null); }}><span>Option {String.fromCharCode(65+index)}</span><Icon name="arrow-down-01.svg" size={21} className={open ? "mcqcRotated" : ""}/></button>{open && <div className="mcqcAnswerContent"><div className="mcqcOptionSubLabel"><span>Text</span><small>{option.length}/250</small></div><div className="mcqcOptionEditor">{optionToolbar(`mcqc-opt-${active}-${index}`)}<textarea id={`mcqc-opt-${active}-${index}`} rows={3} maxLength={250} placeholder={`Enter option ${String.fromCharCode(65+index)}`} value={option} onChange={e=>setOption(index,e.target.value)}/></div><label className="mcqcCorrectOption"><input type="checkbox" checked={item.correct===index} onChange={()=>update({correct:item.correct===index?-1:index})}/>Correct Answers</label>{(["feedback","explanation","hint"] as const).map(field => { const sectionId = `${index}-${field}`; const sectionOpen = expandedDetail===sectionId; return <div className="mcqcOptionDetail" key={field}><button type="button" className="mcqcOptionDetailHead" aria-expanded={sectionOpen} onClick={()=>setExpandedDetail(sectionOpen?null:sectionId)}><span className="mcqcDetailHeading"><Icon name={field==="feedback"?"message-circle-more.svg":field==="explanation"?"assignments.svg":"idea.svg"} size={18}/>{field[0].toUpperCase()+field.slice(1)}</span><small>{detail[field].length}/250</small><Icon name="arrow-down-01.svg" size={18} className={sectionOpen?"mcqcRotated":""}/></button>{sectionOpen && <div className="mcqcOptionDetailBody">{detailEditor(index,field)}{field==="hint" && <div className="mcqcHintChecks"><label><input type="checkbox" checked={detail.showHint} onChange={e=>setDetail(index,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={detail.allowHint} onChange={e=>setDetail(index,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>; })}{item.options.length>2 && <button type="button" className="mcqcRemoveOption" onClick={()=>{ update({options:item.options.filter((_,i)=>i!==index),correct:item.correct===index?-1:item.correct>index?item.correct-1:item.correct});setExpandedOptions([]);setExpandedDetail(null); }}>Remove Option</button>}</div>}</div>; })}</div><button type="button" className="mcqcAddOptions" onClick={()=>{update({options:[...item.options,""]});setExpandedOptions([item.options.length]);setExpandedDetail(null);}}><Icon name="plus.svg" size={20}/>Add Options</button></div>
      </div><div className="mcqcBuilderBottom"><div className="mcqcAddMenu mcqcBottomAddMenu"><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" onClick={() => { setBottomAddOpen(v => !v); setAddOpen(false); }} aria-expanded={bottomAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={21}/>Add Questions</button>{bottomAddOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div><div className="mcqcBuilderArrows"><button type="button" className="mcqcRoundNav" aria-label="Previous" onClick={() => setActive(n=>Math.max(0,n-1))}><Icon name="arrowleft.svg"/></button><button type="button" className="mcqcRoundNav" aria-label="Next" onClick={() => { if(active+1<mcqValues.questionCount)setActive(n=>n+1); }}><Icon name="arrowright.svg"/></button></div></div>
    </section><aside className="mcqcBuilderAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="mcqcPoints">Points</label><div className="mcqcPointsControl"><input id="mcqcPoints" type="number" min="0" step="1" value={item.points} onChange={e=>update({points:e.target.value})}/><div className="mcqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(item.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="mcqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(item.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div><div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={item.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={item.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div><div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" aria-label="New tag" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(v=>v!==tag))}>{tag} <span>×</span></button>)}</div></div><div className="mcqcMandatory"><span>Mandatory</span><button type="button" className={`mcqcSwitch ${item.mandatory ? 'mcqcSwitchOn' : ''}`} role="switch" aria-label="Mandatory Question" aria-checked={item.mandatory} onClick={()=>update({mandatory:!item.mandatory})}><span className="mcqcSwitchText">{item.mandatory?'ON':'OFF'}</span><span className="mcqcSwitchKnob"/></button></div><p className="mcqcAsideHint">This Question is Mandatory</p></section><section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{currentDone}/{mcqValues.questionCount}</strong><span>Questions</span></div><div><strong>{questions.reduce((n,q)=>n+(complete(q)?Number(q.points)||0:0),0)}</strong><span>Marks</span></div><div><strong>60</strong><span>Minutes</span></div></div><p>Marks per Question: {mcqValues.marksPerQuestion}</p><div className="mcqcSummaryProgress"><span style={{width:`${Math.min(100,currentDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. Add questions to get started.</p><div className="mcqcBuilderField"><label>Passing Score</label><NeumoSelect value="60%" options={["40%","50%","60%","70%","80%","90%"]} onChange={()=>{}}/></div></section></aside></div>
    {notice && <p className="mcqcBuilderNotice mcqcValidationError" role="alert">{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="mcqcFooterPill" onClick={()=>{setNotice("");setPreviewing(true);}}>Preview Questions</button><div className="mcqcSaveContinueGroup">{saveSuccess && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}


// Icon files are loaded from public/assets/assessmenticons/.
// Replace these filenames with the icons you supply; their slots keep the Figma sizes.
const SA_ICON_PATHS = {
  eye: `${ASSETS}view.svg`, ready: `${ASSETS}checkmark-square-02.svg`,
  fullMarks: `${ASSETS}circle-check.svg`, partialMarks: `${ASSETS}checkmark-circle-02.svg`, zeroMarks: `${ASSETS}cancel-circle.svg`,
  modelAnswer: `${ASSETS}clipboard-check.svg`, graderInfo: `${ASSETS}info.svg`,
  difficulty: `${ASSETS}target-02.svg`, bloom: `${ASSETS}brain-01.svg`, category: `${ASSETS}folder-03.svg`, tag: `${ASSETS}tag-01.svg`,
  breadcrumb: `${ASSETS}arrowrightdouble.svg`,
  arrowDown: `${ASSETS}arrow-down-01.svg`, edit: `${ASSETS}edit-01 copy.svg`,
  feedback: `${ASSETS}message-circle-more.svg`, explanation: `${ASSETS}assignments.svg`, hint: `${ASSETS}idea-01.svg`,
  undo: `${ASSETS}undo.svg`, redo: `${ASSETS}redo.svg`, bold: `${ASSETS}bold.svg`,
  italic: `${ASSETS}italic.svg`, underline: `${ASSETS}underline.svg`,
  pen: `${ASSETS}pen-line.svg`, highlighter: `${ASSETS}highlighter.svg`, pencil: `${ASSETS}pencil-line.svg`,
  bullet: `${ASSETS}dot.svg`, more: `${ASSETS}more-horizontal.svg`,
  plus: `${ASSETS}plus.svg`, remove: `${ASSETS}cancel-circle-half-dot.svg`, checked: `${ASSETS}checkmark-square-02.svg`,
};
function SAIcon({ name, size = 20, className = "" }: { name: keyof typeof SA_ICON_PATHS; size?: number; className?: string }) {
  const path = SA_ICON_PATHS[name];
  return <span className={`saPathIcon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    {path ? <img src={path} width={size} height={size} alt="" onError={event => { event.currentTarget.style.visibility = "hidden"; }} /> : null}
  </span>;
}
function SASelect({ value, options, onChange, label, compact = false, preview = false }: { value: string; options: string[]; onChange: (value: string) => void; label: string; compact?: boolean; preview?: boolean }) {
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
  return <div ref={root} className={`saSelect saCustomSelect ${compact ? "saSelectCompact" : ""} ${preview ? "saPreviewSelect" : ""} ${open ? "saSelectOpen" : ""}`} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="saSelectButton" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>
      <span>{value || `Select ${label.toLowerCase()}`}</span><SAIcon name="arrowDown" size={compact ? 16 : 20} className={open ? "saDropdownArrowOpen" : ""}/>
    </button>
    {open && <div className="saSelectPopup" role="listbox" aria-label={label}>
      {options.map(option => <button key={option} type="button" role="option" aria-selected={option === value} className={`saSelectOption ${option === value ? "saOptionActive" : ""}`} onClick={() => { onChange(option); setOpen(false); }}>
        {option === value && <span className="saOptionTick" aria-hidden="true">✓</span>}<span>{option}</span>
      </button>)}
    </div>}
  </div>;
}

// Empty contenteditable elements may report a line break or zero-width marker.
// Keep actual spaces and all user-entered text in the character count.
function feedbackTextWithoutEmptyMarker(value: string, html?: string): string {
  if (!value || !/^[\r\n\u200B\uFEFF]+$/.test(value)) return value;
  if (html && html.replace(/<[^>]*>/g, "").replace(/(?:&#8203;|&#x200b;|&ZeroWidthSpace;|[\r\n\u200B\uFEFF])/gi, "") !== "") return value;
  return "";
}
function SARichField({ value, onChange, html, onHtmlChange, onError, placeholder = "", label, plain = false, tall = false }: {
  value: string; onChange: (value: string) => void; html?: string; onHtmlChange: (html: string) => void; onError: (message: string) => void;
  placeholder?: string; label: string; plain?: boolean; tall?: boolean;
}) {
  const feedbackField = label === "Full Marks" || label === "Partial Marks" || label === "Zero Marks";
  const latestHtml = useRef(html);
  useEffect(() => { latestHtml.current = html; }, [html]);
  const countedValue = feedbackField ? feedbackTextWithoutEmptyMarker(value, html) : value;
  return <div className={`saRich ${plain ? "saRichPlain" : ""} ${tall ? "saRichTall" : ""}`}>
    <MCQRichEditor editorId={`sa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} value={countedValue} html={html} onChange={text => onChange(feedbackField ? feedbackTextWithoutEmptyMarker(text, latestHtml.current) : text)} onHtmlChange={nextHtml => { latestHtml.current = nextHtml; onHtmlChange(nextHtml); }} onError={onError} placeholder={placeholder || label} maxLength={250} extendedToolbar />
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
  hintBefore: boolean; hintAfter: boolean; graderInfo: string; richHtml?: Record<string, string>;
  gradingMethod?: "Equal Marks" | "Custom"; negativeMarking?: string; partialCredit?: boolean; minimumZero?: boolean; scoreOverrides?: Record<string, string>;
};
const saInitialLevels = (offset: number): SALevel[] => [
  { id: offset, title: "", points: "", description: "" },
  { id: offset + 1, title: "", points: "", description: "" },
  { id: offset + 2, title: "", points: "", description: "" },
];
const saDefaultConfig = (): SAConfig => ({
  responseFormat: "", inputSize: "", minWords: "", maxWords: "", maxChars: "", required: true,
  rubricOptions: [true, true, true, true, true, true, false],
  criteria: [
    { id: 1, title: "", description: "", levels: saInitialLevels(3) },
    { id: 2, title: "", description: "", levels: saInitialLevels(6) },
  ],
  feedback: ["", "", ""], explanation: "", hintBefore: true, hintAfter: false, graderInfo: "", richHtml: {},
});
// Previous versions inserted this complete example into untouched drafts.
// Only recognise the exact original example; preserve all other saved content.
function clearLegacyExample(config: SAConfig): SAConfig {
  if (!config || typeof config !== "object") return config;
  const expectedFeedback = ["Great — you explained both sides of overfitting.", "Partly right — mention how it behaves on new data.", "Review the lesson on generalization."];
  const exactExample = config.graderInfo === "Accept any answer that contrasts training vs unseen data."
    && config.explanation === "Overfitting = low training error, high error on unseen data."
    && Array.isArray(config.feedback) && config.feedback.length === 3 && config.feedback.every((text, index) => text === expectedFeedback[index])
    && Array.isArray(config.criteria) && config.criteria.length === 2
    && config.criteria[0]?.title === "Concept accuracy" && config.criteria[0]?.description === "Explains the idea correctly"
    && config.criteria[1]?.title === "Clarity and Language" && config.criteria[1]?.description === "Clear, Concise sentences"
    && config.criteria.every(criterion => Array.isArray(criterion.levels) && criterion.levels.length === 3 && criterion.levels.every((level, index) => level.title === ["Excellent", "Fair", "Poor"][index] && level.points === ["01", "00", "00"][index] && level.description === ["Accurate and Complete", "Partially correct or incomplete", "Incorrect or Missing"][index]))
    && !Object.values(config.richHtml || {}).some(Boolean);
  if (!exactExample) return config;
  return { ...config,
    responseFormat: config.responseFormat === "Plain Text" ? "" : config.responseFormat,
    inputSize: config.inputSize === "5" ? "" : config.inputSize,
    minWords: config.minWords === "10" ? "" : config.minWords,
    maxWords: config.maxWords === "50" ? "" : config.maxWords,
    maxChars: config.maxChars === "250" ? "" : config.maxChars,
    criteria: config.criteria.map(criterion => ({ ...criterion, title: "", description: "", levels: criterion.levels.map(level => ({ ...level, title: "", points: "", description: "" })) })),
    feedback: ["", "", ""], explanation: "", graderInfo: ""
  };
}
function ShortAnswerExpanded({ value, update, config, onConfigChange, onError }: {
  value: SAQuestion; update: (patch: Partial<SAQuestion>) => void; config: SAConfig;
  onConfigChange: (change: (previous: SAConfig) => SAConfig) => void; onError: (message: string) => void;
}) {
  const [sections, setSections] = useState<Record<string, boolean>>({ answer: true, model: true, rubric: true, feedback: true, explanation: true, hint: true });
  const { responseFormat, inputSize, minWords, maxWords, maxChars, required, rubricOptions, criteria, feedback, explanation, hintBefore, hintAfter, graderInfo } = config;
  const fieldSetter = <K extends keyof SAConfig,>(key: K) => (next: React.SetStateAction<SAConfig[K]>) =>
    onConfigChange(old => ({ ...old, [key]: typeof next === "function" ? (next as (value: SAConfig[K]) => SAConfig[K])(old[key]) : next }));
  const setResponseFormat = fieldSetter("responseFormat"), setInputSize = fieldSetter("inputSize"), setMinWords = fieldSetter("minWords"), setMaxWords = fieldSetter("maxWords"), setMaxChars = fieldSetter("maxChars"), setRequired = fieldSetter("required");
  const setRubricOptions = fieldSetter("rubricOptions"), setCriteria = (next: React.SetStateAction<SACriterion[]>) => onConfigChange(old => ({ ...old, criteria: typeof next === "function" ? next(old.criteria) : next, scoreOverrides: {} })), setFeedback = fieldSetter("feedback"), setExplanation = fieldSetter("explanation"), setHintBefore = fieldSetter("hintBefore"), setHintAfter = fieldSetter("hintAfter"), setGraderInfo = fieldSetter("graderInfo");
  const richProps = (key: string) => ({ html: config.richHtml?.[key], onHtmlChange: (html: string) => onConfigChange(old => ({ ...old, richHtml: { ...old.richHtml, [key]: html } })), onError });
  const nextId = useRef(Math.max(20, ...criteria.flatMap(item => [item.id + 1, ...item.levels.map(level => level.id + 1)])));
  const initialLevels = saInitialLevels;
  const toggle = (key: string) => setSections(old => ({ ...old, [key]: !old[key] }));
  const changeCriterion = (id: number, patch: Partial<SACriterion>) => setCriteria(old => old.map(item => item.id === id ? { ...item, ...patch } : item));
  const changeLevel = (criterionId: number, levelId: number, patch: Partial<SALevel>) => setCriteria(old => old.map(item => item.id === criterionId ? { ...item, levels: item.levels.map(level => level.id === levelId ? { ...level, ...patch } : level) } : item));
  const total = criteria.reduce((sum, criterion) => sum + (Number(criterion.levels[0]?.points) || 0), 0);
  const panel = (key: string, heading: string, body: React.ReactNode, meta = "Not shown to Learners", icon: keyof typeof SA_ICON_PATHS = "edit") =>
    <section className={`saAccordion saAccordion-${key}`}>
      <button type="button" className="saAccordionTitle" onClick={() => toggle(key)} aria-expanded={!!sections[key]} aria-controls={`sa-section-${key}`}>
        <span className="saSectionHeading"><span className="saSectionIcon"><SAIcon name={icon} size={16}/></span>{heading}</span>
        <span className="saSectionMeta">{!/^\d+\s*\/\s*\d+/.test(meta) && meta}<SAIcon name="arrowDown" size={24} className={sections[key] ? "saArrowOpen" : ""}/></span>
      </button>
      <div id={`sa-section-${key}`} className="saAccordionBody" hidden={!sections[key]}>{body}</div>
    </section>;
  return <div className="mcqcShortAnswerFields saExpanded">
    {panel("answer", "Answer Box Placeholder", <>
      <SARichField {...richProps("answer")} value={value.answer} onChange={text => update({ answer: text })} label="Answer box placeholder" placeholder="Type your Short answer (2-3 sentences)..." plain/>
      <div className="saSettingsGrid">
        <label>Response format<SASelect label="Response format" value={responseFormat} onChange={setResponseFormat} options={["Plain Text", "Rich Text"]}/></label>
        <label>Input box size (lines)<SASelect label="Input box size (lines)" value={inputSize} onChange={setInputSize} options={["3", "5", "8", "10"]}/></label>
        <label>Minimum Words<SASelect label="Minimum Words" value={minWords} onChange={setMinWords} options={["0", "5", "10", "20", "30"]}/></label>
        <label>Maximum Words<SASelect label="Maximum Words" value={maxWords} onChange={setMaxWords} options={["25", "50", "100", "150", "250"]}/></label>
        <label>Maximum Characters<SASelect label="Maximum Characters" value={maxChars} onChange={setMaxChars} options={["100", "250", "500", "1000", "2000"]}/></label>
      </div>
      <SASwitch label="Response Required" checked={required} onChange={setRequired}/>
    </>, `${value.answer.length}/250`)}
    {panel("model", "Model Answer and Grader Information", <>
      <div className="saLabeledField"><div className="saSmallLabel">Model Answer</div><SARichField {...richProps("modelAnswer")} value={value.rubric} onChange={text => update({ rubric: text })} label="Model Answer" placeholder="Enter the model answer..." tall/></div>
      <div className="saLabeledField"><div className="saSmallLabel">Information for Graders</div><SARichField {...richProps("graderInfo")} value={graderInfo} onChange={setGraderInfo} label="Information for Graders"/></div>
    </>)}
    {panel("rubric", "Grading Method and Rubrics", <>
      <div className="saCriteria">{criteria.map((criterion, index) => <div className="saCriterion" key={criterion.id}>
        <label>Criterion {index + 1}<input className="saGradeInput" maxLength={250} value={criterion.title} onChange={e => changeCriterion(criterion.id, { title: e.target.value })} placeholder="Enter criterion"/></label>
        {(config.gradingMethod ?? "Equal Marks") === "Custom" && <label>Criterion marks<input className="saGradeInput" type="number" min="0" step="0.5" value={criterion.levels[0]?.points ?? ""} onChange={e => { const points = e.target.value; changeCriterion(criterion.id, { levels: criterion.levels.length ? criterion.levels.map((level, i) => i === 0 ? { ...level, points } : level) : [{ id: nextId.current++, title: "Excellent", points, description: "" }] }); }}/></label>}
        <div className="saLabeledField"><div className="saSmallLabel">Description</div><SARichField {...richProps(`criterion-${criterion.id}-description`)} label={`Criterion ${index + 1} description`} value={criterion.description} onChange={description => changeCriterion(criterion.id, { description })} /></div>
        <div className="saLevelGrid">{criterion.levels.map((level, levelIndex) => <div className="saLevel" key={level.id}>
          <strong className="saLevelTitle">Level {levelIndex + 1}</strong>
          {criterion.levels.length > 1 && <button className="saRemoveLevel" type="button" aria-label={`Remove level ${levelIndex + 1}`} onClick={() => changeCriterion(criterion.id, { levels: criterion.levels.filter(item => item.id !== level.id) })}>×</button>}
          <div className="saLevelFields"><label>Title<input className="saGradeInput" maxLength={250} value={level.title} onChange={event => changeLevel(criterion.id, level.id, { title: event.target.value })} placeholder="Enter title" /></label>
          <label>Points<input className="saGradeInput" type="number" min="0" step="0.5" value={level.points} onChange={event => changeLevel(criterion.id, level.id, { points: event.target.value })} /></label>
          <label>Description<textarea maxLength={250} value={level.description} onChange={event => changeLevel(criterion.id, level.id, { description: event.target.value })} placeholder="Enter description" /></label></div>
        </div>)}</div>
        <div className="saCriterionActions"><button type="button" onClick={() => changeCriterion(criterion.id, { levels: [...criterion.levels, { id: nextId.current++, title: "", points: "", description: "" }] })}><SAIcon name="plus" size={16}/>Add Level</button>{criteria.length > 1 && <button type="button" onClick={() => setCriteria(old => old.filter(item => item.id !== criterion.id))}>Remove Criterion</button>}</div>
      </div>)}</div>
      <button className="saAddCriterion" type="button" onClick={() => { const id = nextId.current; nextId.current += 4; setCriteria(old => [...old, { id, title: "", description: "", levels: initialLevels(id + 1) }]); }}><SAIcon name="plus" size={22}/><span>Add Criterion</span></button>
      <div className="saTotal"><span>Total criterion marks</span><strong>{(config.gradingMethod ?? "Equal Marks") === "Equal Marks" ? Number(value.points || 0).toFixed(2) : total.toFixed(2)} / {value.points || "0"}</strong></div>
      <div className="saRubricOptions"><strong>Rubric Options</strong><div className="saRubricSwitches">{["Use rubric total as question points", "Allow learners to preview the rubric", "Show criterion description to learners", "Show points per level to learners", "Allow grader to add comment per criterion", "Calculate grade with a minimum score of 0", "Hide level scores while grading"].map((label, index) => <SASwitch key={label} label={label} checked={index === 5 ? (config.minimumZero ?? Boolean(rubricOptions[index])) : Boolean(rubricOptions[index])} onChange={checked => onConfigChange(old => ({ ...old, rubricOptions: old.rubricOptions.map((item, i) => i === index ? checked : item), ...(index === 5 ? { minimumZero: checked, scoreOverrides: {} } : {}) }))}/>)}</div></div>
      <details className="saAdvancedGrading"><summary>Grading settings</summary><div className="saAdvancedGradingBody">
      <div className="saSettingsGrid saGradingGrid">
        <label>Grading Method<SASelect label="Grading Method" value={config.gradingMethod ?? ""} onChange={v => onConfigChange(old => ({ ...old, gradingMethod: v as "Equal Marks" | "Custom", scoreOverrides: {} }))} options={["Equal Marks", "Custom"]}/></label>
        <label>Points (total for Question)<input className="saGradeInput" type="number" min="0" step="0.5" value={value.points} onChange={e => { update({ points: e.target.value }); onConfigChange(old => ({ ...old, scoreOverrides: {} })); }}/></label>
        <label>Negative Marking<SASelect label="Negative Marking" value={config.negativeMarking ?? ""} onChange={v => onConfigChange(old => ({ ...old, negativeMarking: v, scoreOverrides: {} }))} options={["NA", "0", "0.25", "0.5", "1"]}/></label>
      </div>
      <SASwitch label="Partial Credit" checked={config.partialCredit ?? true} onChange={checked => onConfigChange(old => ({ ...old, partialCredit: checked, scoreOverrides: {} }))}/>
      <div className="saGradeSimulation"><strong>Score Simulator - Outcome per Criteria</strong>{Array.from({ length: criteria.length + 1 }, (_, i) => criteria.length - i).map(correct => {
        const points = Number(value.points) || 0; const penalty = Number(config.negativeMarking) || 0;
        const customMarks = criteria.slice(0, correct).reduce((sum, criterion) => sum + (Number(criterion.levels[0]?.points) || 0), 0);
        const base = (config.partialCredit ?? true) ? (config.gradingMethod === "Custom" ? customMarks : points * correct / Math.max(criteria.length, 1)) : (correct === criteria.length ? points : 0);
        const calculated = base - penalty * (criteria.length - correct); const result = (config.minimumZero ?? true) ? Math.max(0, calculated) : calculated;
        return <div className="saGradeOutcome" key={correct}><span>{correct} correct, {criteria.length - correct} wrong</span><input className="saGradeInput" type="number" step="0.5" aria-label={`Marks for ${correct} correct criteria`} value={config.scoreOverrides?.[String(correct)] ?? (value.points ? String(Number(result.toFixed(2))) : "")} onChange={e => onConfigChange(old => ({ ...old, scoreOverrides: { ...old.scoreOverrides, [String(correct)]: e.target.value } }))}/></div>;
      })}</div>
      </div></details>
    </>, "", "edit")}
    {panel("feedback", "Feedback", <>{["Full Marks", "Partial Marks", "Zero Marks"].map((label, index) => <div className={`saLabeledField saFeedback-${index}`} key={label}>
      <div className="saSmallLabel">{label}</div><SARichField {...richProps(`feedback-${index}`)} label={label} value={feedback[index]} onChange={text => setFeedback(old => old.map((item, i) => i === index ? text : item))} tall/>
    </div>)}</>, `${Math.max(...feedback.map((text, index) => feedbackTextWithoutEmptyMarker(text, config.richHtml?.[`feedback-${index}`]).length), 0)}/250 characters`, "feedback")}
    {panel("explanation", "Explanation", <SARichField {...richProps("explanation")} label="Explanation" value={explanation} onChange={setExplanation} plain/>, `${explanation.length}/250`, "explanation")}
    {panel("hint", "Hint", <>
      <SARichField {...richProps("hint")} label="Hint" value={value.hint} onChange={text => update({ hint: text })} placeholder="Enter a hint..." plain/>
      <div className="saHintChecks">{[["Show hint before answering", hintBefore, setHintBefore], ["Allow learner to request hint", hintAfter, setHintAfter]].map(([label, checked, change]) =>
        <label className={`saCheck ${checked ? "saCheckOn" : ""}`} key={String(label)}><input type="checkbox" checked={Boolean(checked)} onChange={event => (change as (value: boolean) => void)(event.target.checked)}/><span className="saCheckBox">{checked ? <SAIcon name="checked" size={16}/> : null}</span><span>{String(label)}</span></label>
      )}</div>
    </>, `${value.hint.length}/250`, "hint")}
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
const saQuestionComplete = (question: SAQuestion) => !!question.text?.trim() && !!question.answer?.trim() && Number.isFinite(Number(question.points)) && Number(question.points) > 0 && !!question.category?.trim() && !!question.bloom?.trim();
function ShortAnswerPreview({ questions, configs, tags, onBack, onExit, onContinue, notice, saving }: {
  questions: SAQuestion[]; configs: Record<number, SAConfig>; tags: string[]; onBack: (index?: number) => void;
  onExit: () => void; onContinue: () => void; notice: string; saving: boolean;
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
        <div className="sapFilter"><SASelect label="Filter preview questions" value={filter} options={["All Questions", "Complete", "Incomplete"]} onChange={setFilter} preview /></div>
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
              <section className="sapCard sapRubric"><h3>Grading Method</h3><p>{config.gradingMethod ?? "Equal Marks"} · {question.points || "0"} points · Negative marking: {config.negativeMarking ?? "NA"}</p><p>Partial Credit: {(config.partialCredit ?? true) ? "ON" : "OFF"} · Minimum score of 0: {(config.minimumZero ?? true) ? "ON" : "OFF"}</p>{config.criteria.map((criterion,i)=><p key={criterion.id}>{criterion.title || `Criterion ${i+1}`}: {(config.gradingMethod ?? "Equal Marks") === "Custom" ? criterion.levels[0]?.points || "0" : (Number(question.points || 0)/Math.max(1,config.criteria.length)).toFixed(2)} marks</p>)}</section>
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
          {index === visible[visible.length - 1]?.index && <div className="sapFooter"><button type="button" onClick={() => onBack()}>Back to Question</button>{saving&&<span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</div>}
        </article>;
      })}
      {!visible.length && <div className="sapNoQuestions"><p>No questions match this filter.</p><button type="button" className="sapLearnerButton" onClick={() => setFilter("All Questions")}>Show All Questions</button><button type="button" className="sapLearnerButton" onClick={() => onBack()}>Back to Question</button></div>}
    </div>
    {notice && <p role="status" className="sapNotice mcqcValidationError">{notice}</p>}
  </div>;
}

function ShortAnswerBuilder({ onExit, mcqValues }: { onExit: () => void; mcqValues: MCQDetailsValues }) {
  const router = useRouter();
  const [welcomeName, setWelcomeName] = useState("Creator");
  useEffect(() => { const name = getDemoSession()?.displayName?.trim(); if (name) setWelcomeName(name.split(/\s+/)[0]); }, []);
  const [questions, setQuestions] = useState<SAQuestion[]>([{ text: "", points: "", difficulty: "", category: "", bloom: "", mandatory: true, answer: "", rubric: "", feedback: "", hint: "" }]);
  const [active, setActive] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [configs, setConfigs] = useState<Record<number, SAConfig>>({ 0: saDefaultConfig() });
  const updateConfig = (change: (previous: SAConfig) => SAConfig) => setConfigs(old => ({ ...old, [active]: change(old[active] ?? saDefaultConfig()) }));
  const switchPreview = (next: boolean, index?: number) => {
    if (index !== undefined) setActive(index);
    setPreviewing(next);
    requestAnimationFrame(() => { document.querySelector(".mcqcScrollArea")?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); document.getElementById(next ? "sa-preview-title" : "short-question-text")?.focus({ preventScroll: true }); });
  };
  const [answerOpen, setAnswerOpen] = useState(true);
  const numberScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = numberScrollRef.current;
    const selected = scroller?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!scroller || !selected) return;
    const left = selected.offsetLeft - scroller.offsetLeft;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (left + selected.offsetWidth > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = left + selected.offsetWidth - scroller.clientWidth;
  }, [active]);
  const [tags, setTags] = useState<string[]>([]);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [notice, setNotice] = useState("");
  const [continuing,setContinuing] = useState(false);
  const continueTimer = useRef<number | null>(null);
  useEffect(() => () => { if (continueTimer.current) window.clearTimeout(continueTimer.current); }, []);
  const [saved, setSaved] = useState(false);
  useEffect(()=>{try{const saved=JSON.parse(assessmentStorage.getItem("shortAnswerContentDraft")||"null");if(!saved)return;if(Array.isArray(saved.questions) && saved.questions.length)setQuestions(saved.questions);if(Array.isArray(saved.tags))setTags(saved.tags);if(saved.configs && typeof saved.configs === "object")setConfigs(Object.fromEntries(Object.entries(saved.configs as Record<string, SAConfig>).map(([index, config]) => [index, clearLegacyExample(config)])));}catch{}},[]);
  const current = questions[active];
  const update = (patch: Partial<typeof current>) => setQuestions(old => old.map((q, i) => i === active ? { ...q, ...patch } : q));
  const save = () => {
    for (let i=0;i<mcqValues.questionCount;i++) {
      const q=questions[i];
      const err=!q?.text.trim() ? "Enter the question text." :
        !q?.answer.trim() ? "Enter the model answer." :
        !q?.points.trim() || !(Number(q.points)>0) ? "Enter valid points greater than zero." :
        !q?.category.trim() ? "Select a category." :
        !q?.bloom.trim() ? "Select Bloom’s Taxonomy." : "";
      const grading = configs[i] ?? saDefaultConfig();
      if (grading.gradingMethod === "Custom" && (grading.criteria.some(c => !c.title.trim() || c.levels[0]?.points === "" || !Number.isFinite(Number(c.levels[0]?.points)) || Number(c.levels[0]?.points) < 0) || Math.abs(grading.criteria.reduce((sum,c)=>sum+Number(c.levels[0]?.points || 0),0) - Number(q?.points || 0)) > 0.001)) { setActive(i); setPreviewing(false); setNotice(`Question ${i+1}: criterion marks must be valid and total the question points.`); return false; }
      if (err) { setQuestions(old=>Array.from({length:Math.max(old.length,i+1)},(_,index)=>old[index]??{text:"",points:"",difficulty:"",category:"",bloom:"",mandatory:true,answer:"",rubric:"",feedback:"",hint:""})); setActive(i); setPreviewing(false); setNotice(`Question ${i+1}: ${err}`); return false; }
    }
    const sum=questions.slice(0,mcqValues.questionCount).reduce((n,q)=>n+Number(q.points),0);
    if (Math.abs(sum-mcqValues.totalMarks)>0.001) {setNotice(`Question marks total ${sum}, but Total Marks is ${mcqValues.totalMarks}.`);setPreviewing(false);return false;}
    try { assessmentStorage.setItem("shortAnswerContentDraft", JSON.stringify({ questions, tags, configs })); setSaved(true); setNotice("Successfully saved"); return true; }
    catch { setNotice("Could not save. Please try again."); return false; }
  };
  const saveAndContinue = () => {
    if (continuing || !save()) return;
    setNotice(""); setContinuing(true);
    continueTimer.current = window.setTimeout(() => { setContinuing(false); router.push("/assessments/create/evaluation"); }, 3000);
  };
  const selectQuestion = (index: number) => {
    setQuestions(old => Array.from({ length: Math.max(old.length, index + 1) }, (_, i) => old[i] ?? { text: "", points: "", difficulty: "", category: "", bloom: "", mandatory: true, answer: "", rubric: "", feedback: "", hint: "" }));
    setActive(index); setAnswerOpen(true);
  };
  const isQuestionComplete = (index: number) => {
    const question = questions[index];
    const settings = configs[index] ?? saDefaultConfig();
    return !!question && saQuestionComplete(question) && (settings.gradingMethod !== "Custom" || (settings.criteria.every(criterion => !!criterion.title.trim() && criterion.levels[0]?.points !== "" && Number.isFinite(Number(criterion.levels[0]?.points)) && Number(criterion.levels[0]?.points) >= 0) && Math.abs(settings.criteria.reduce((sum, criterion) => sum + Number(criterion.levels[0]?.points || 0), 0) - Number(question.points)) <= 0.001));
  };
  const completedCount = Array.from({length: mcqValues.questionCount}, (_, index) => index).filter(isQuestionComplete).length;
  if (previewing) return <ShortAnswerPreview questions={questions} configs={configs} tags={tags} notice={notice}
    onBack={(index) => switchPreview(false, index)} onExit={onExit} onContinue={saveAndContinue} saving={continuing}/>;
  return <div className="mcqcBuilder mcqcShortBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg"/><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg"/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! {welcomeName}?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading mcqcShortQuestionsHeading">
        <div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div>
      </div>
      <div className="mcqcTopQuestionNavigator mcqcShortQuestionNavigator" aria-label="Question navigation">
        <div className={`mcqcNumberNavigation ${mcqValues.questionCount <= 7 ? "mcqcFewQuestions" : "mcqcManyQuestions"}`}>
          <button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active === 0} onClick={() => selectQuestion(Math.max(0, active - 1))}><Icon name="arrowleft.svg" size={20}/></button>
          <div ref={numberScrollRef} className="mcqcNumberScroller"><div className="mcqcQuestionNumbers">
            {Array.from({ length: mcqValues.questionCount }, (_, index) => {
              const completed = isQuestionComplete(index);
              const selected = index === active;
              return <button type="button" key={index} disabled={index >= mcqValues.questionCount} className={`mcqcQuestionNumber ${completed ? "is-complete" : selected ? "is-active" : "is-empty"}`} aria-label={`Question ${index+1}, ${completed ? "complete" : "incomplete"}`} aria-current={selected ? "step" : undefined} onClick={() => selectQuestion(index)}>
                <span className="mcqcNumberValue">{index+1}</span>
                <span className={`mcqcNumberStatus ${completed ? "is-done" : "is-pending"}`} aria-hidden="true">{completed ? "✓" : ""}</span>
                <small>SA</small>
              </button>;
            })}
          </div></div>
          <button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active >= mcqValues.questionCount - 1} onClick={() => selectQuestion(Math.min(mcqValues.questionCount - 1, active + 1))}><Icon name="arrowright.svg" size={20}/></button>
        </div>
        <div className="mcqcQuestionProgress" aria-label="Question completion progress"><span style={{width:`${Math.min(100, Math.max(4, completedCount / Math.max(1, mcqValues.questionCount) * 100))}%`}}/></div>
      </div>
      <div className="mcqcQuestionForm">
      <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Short Answer" onChange={() => {}}/></div>
      <div className="mcqcBuilderField mcqcWriteField"><div className="mcqcFormHeading"><label htmlFor="short-question-text">Write Your Question</label></div><div className="mcqcEditorSurface"><MCQRichEditor key={active} editorId="short-question-text" value={current.text} html={configs[active]?.richHtml?.question} onChange={text => update({ text })} onHtmlChange={html => updateConfig(old => ({ ...old, richHtml: { ...old.richHtml, question: html } }))} onError={setNotice} placeholder="Write your question here..." maxLength={250} extendedToolbar /></div></div>
      <div className="mcqcBuilderField mcqcShortAnswerSettings"><div className="mcqcFormHeading"><label>Answer Settings</label></div><button type="button" className="mcqcSelectTrigger mcqcShortAnswerTrigger" aria-expanded={answerOpen} onClick={() => setAnswerOpen(v => !v)}><span>Answer box, Model answer, Rubrics, Feedback and Hint</span><Icon name="arrow-down-01.svg" size={20} className={answerOpen ? "mcqcRotated" : ""}/></button>{answerOpen && <ShortAnswerExpanded key={active} value={current} update={update} config={configs[active] ?? saDefaultConfig()} onConfigChange={updateConfig} onError={setNotice} />}</div>
    </div></section>
    <aside className="mcqcBuilderAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="short-points">Points</label><input id="short-points" type="number" min="0" value={current.points} onChange={e=>update({points:e.target.value})}/></div><div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={current.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={current.category} options={CATEGORIES} onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={current.bloom} options={BLOOMS} onChange={v=>update({bloom:v})}/></div><div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" autoFocus maxLength={250} aria-label="New tag" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(t=>t!==tag))}>{tag} <span>×</span></button>)}</div></div><div className="mcqcMandatory"><span>Mandatory</span><button type="button" role="switch" aria-label="Mandatory" aria-checked={current.mandatory} className={`mcqcSwitch ${current.mandatory ? 'mcqcSwitchOn' : ''}`} onClick={()=>update({mandatory:!current.mandatory})}><span className="mcqcSwitchText">{current.mandatory?'ON':'OFF'}</span><span className="mcqcSwitchKnob"/></button></div><p className="mcqcAsideHint">This Question is Mandatory</p></section></aside></div>
    <div className="mcqcShortFooter"><div className="mcqcShortFooterLeft"><button type="button" className="mcqcFooterPill" disabled={continuing} onClick={onExit}>Back</button><button type="button" className="mcqcFooterPill" onClick={()=>{setNotice("");switchPreview(true);}}>Preview Questions</button></div><div className="mcqcShortFooterRight">{continuing && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={continuing} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>{notice && <p role={notice === "Successfully saved" ? "status" : "alert"} className={notice === "Successfully saved" ? "mcqcBuilderNotice mcqcNoticeSuccess" : "mcqcBuilderNotice"}>{notice}</p>}
  </div>;
}

type MCQDetailsValues = { totalMarks: number; questionCount: number; marksPerQuestion: number };
const DEFAULT_MCQ_VALUES: MCQDetailsValues = { totalMarks: 20, questionCount: 20, marksPerQuestion: 1 };
const positiveInteger = (value: unknown, fallback: number) => { const number = Number(value); return Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback; };
const nonnegativeNumber = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 0 ? number : fallback; };
export default function MCQContentPage({startInBuilder=false,onExitBuilder}: {startInBuilder?:boolean;onExitBuilder?:()=>void} = {}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, boolean>>(() => Object.fromEntries(SETTINGS.map(item => [item.key, item.defaultOn])));
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(startInBuilder);
  const [mcqValues, setMcqValues] = useState<MCQDetailsValues>(DEFAULT_MCQ_VALUES);
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  useEffect(() => {
    try {
      const stored = assessmentStorage.getItem("shortAnswerAssessmentDraft");
      const draft = stored ? JSON.parse(stored) : {};
      const questionCount = positiveInteger(draft.questionCount ?? assessmentStorage.getItem("mcqQuestionCount"), 20);
      const totalMarks = nonnegativeNumber(draft.totalMarks, 20);
      const marksPerQuestion = nonnegativeNumber(draft.marksPerQuestion, 1);
      setMcqValues({ questionCount, totalMarks, marksPerQuestion });
      setQuestions(old => Array.from({ length: questionCount }, (_, index) => old[index] ?? { ...newQuestion(), points: String(marksPerQuestion) }));
    } catch { setQuestions(old => Array.from({ length: 20 }, (_, index) => old[index] ?? newQuestion())); }
  }, []);
  const action = (name: string) => name === "Create Questions" ? setBuilding(true) : name === "Generate With AI" ? router.push("/assessments/create/ai?type=short-answer") : setMessage(`${name} will be available when question creation is connected.`);

  return (
    <main className="mcqcAppShell">
      <div className="mcqcLayout">
        <Sidebar />
        <section className="mcqcMainContent">
          <div className="mcqcHeader"><Header /></div>
          <div className="mcqcScrollArea">
            {building ? <div className="mcqcPageContent"><ShortAnswerBuilder mcqValues={mcqValues} onExit={() => onExitBuilder ? onExitBuilder() : setBuilding(false)} /></div> : <div className="mcqcPageContent">
              <div className="mcqcBreadcrumb" aria-label="Breadcrumb">
                <Link href="/assessments">Assessment</Link>
                <Icon name="arrowrightdouble.svg" size={20} />
                <Link href="/assessments/create/details" className="mcqcBreadcrumbCurrent">Create Assessment</Link>
              </div>
              <ol className="mcqcWizard" aria-label="Assessment creation progress">
                {STEPS.map((step, index) => <li key={step} className={`mcqcWizardStep ${index < 2 ? "mcqcWizardDone" : index === 2 ? "mcqcWizardActive" : ""}`}><WizardStepLink index={index} current={2}/>
                  <span className="mcqcWizardNumber"><span>{index + 1}</span></span><span className="mcqcWizardText">{step}</span>
                </li>)}
              </ol>
              <header className="mcqcPageTitle"><h1>Assessment Content (Short Answers)</h1><p>Add Questions To Your Assessment.</p></header>
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
                      </div>
                      <button className="mcqcCreateButton" type="button" onClick={() => action("Create Questions")}><Icon name="plus.svg" size={24} />Create Questions</button>
                    </div>
                  </section>
                  <button type="button" className="mcqcBack" onClick={() => router.push("/assessments/create/details")}>Back</button>
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
                  </section>
                </aside>
              </div>
              {message && <p className="mcqcMessage mcqcValidationError" role="alert">{message}</p>}
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
