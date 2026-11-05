"use client";
import AssessmentRichToolbar from "@/modules/assessments/components/common/AssessmentRichToolbar";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./fillblanks.css";
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";

const ASSETS = "/assets/assessmenticons/";

function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`fillqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}



// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"];
const MCQC_SIZES = ["12", "14", "16", "18", "24"];
const MCQC_SYMBOLS = ["©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "∞", "π", "√", "∑", "α", "β", "γ", "Δ", "€", "£", "₹", "→", "←", "•", "✓", "★", "¼", "½", "¾", "§", "¶", "…", "—", "“", "”", "’"];
function MCQRichEditor({ editorId, value, html, onChange, onHtmlChange, placeholder, onError }: {
  editorId: string; value: string; html?: string; onChange: (text: string) => void;
  onHtmlChange: (html: string) => void; placeholder: string; onError: (message: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileKind, setFileKind] = useState<"image" | "attachment">("image");
  const [menu, setMenu] = useState<"font" | "size" | "symbols" | null>(null);
  const [font, setFont] = useState("Arial");
  const [size, setSize] = useState("16");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 160 });
  const floatingMenu = useRef<HTMLDivElement>(null);
  const openFormatMenu = (kind: "font" | "size" | "symbols", trigger: HTMLButtonElement) => {
    if (menu === kind) { setMenu(null); return; }
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(kind === "symbols" ? 270 : kind === "font" ? 190 : 110, window.innerWidth - 16);
    const height = Math.min(kind === "symbols" ? 280 : 218, window.innerHeight - 16);
    const preferredTop = window.innerHeight - rect.bottom >= height + 12 ? rect.bottom + 6 : rect.top - height - 6;
    const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
    setMenuPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    setMenu(kind);
  };
  useEffect(() => {
    if (!menu) return;
    const closeOnOutsideScroll = (event: Event) => {
      if (event.target instanceof Node && floatingMenu.current?.contains(event.target)) return;
      setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    window.addEventListener("scroll", closeOnOutsideScroll, true);
    window.addEventListener("resize", closeOnOutsideScroll);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("scroll", closeOnOutsideScroll, true);
      window.removeEventListener("resize", closeOnOutsideScroll);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);
  const selection = useRef<Range | null>(null);
  const lastHtml = useRef<string | null>(null);
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    const next = html ?? value;
    if (lastHtml.current === null || (el.textContent || "") !== value && document.activeElement !== el) {
      el.innerHTML = html ?? "";
      if (!html) el.textContent = value;
      lastHtml.current = next;
    }
  }, [editorId, value, html]);
  const charLimit = /(?:explanation|hint)/i.test(editorId) ? 250 : undefined;
  const allowedText = (text: string) => {
    const el = editor.current;
    if (!el || charLimit === undefined) return text;
    const selection = window.getSelection();
    const selected = selection?.anchorNode && selection.focusNode && el.contains(selection.anchorNode) && el.contains(selection.focusNode) ? selection.toString().length : 0;
    const current = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").length;
    return text.slice(0, Math.max(0, charLimit - current + selected));
  };
  const notify = () => {
    const el = editor.current;
    if (!el) return;
    const plain = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ");
    if (charLimit !== undefined && plain.length > charLimit && plain.length > value.length) {
      el.innerHTML = lastHtml.current ?? "";
      const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      onError("This field allows a maximum of 250 characters.");
      return;
    }
    lastHtml.current = el.innerHTML;
    onHtmlChange(el.innerHTML);
    onChange((el.innerText || el.textContent || "").replace(/\u00a0/g, " "));
  };
  const remember = () => {
    const sel = window.getSelection();
    if (sel?.rangeCount && editor.current?.contains(sel.anchorNode)) selection.current = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    editor.current?.focus();
    if (selection.current) {
      const sel = window.getSelection();
      try { sel?.removeAllRanges(); sel?.addRange(selection.current); } catch { /* Use the caret position. */ }
    }
  };
  const command = (name: string, valueArg?: string) => {
    restore();
    if (name === "fontName" && valueArg) applyAssessmentFont(editor.current, valueArg); else document.execCommand(name, false, name === "fontSize" ? "7" : valueArg);
    if (name === "fontSize" && valueArg && editor.current) {
      editor.current.querySelectorAll('font[size="7"]').forEach(node => {
        node.removeAttribute("size");
        (node as HTMLElement).style.fontSize = `${valueArg}px`;
      });
    }
    remember();
    notify();
    setMenu(null);
  };
  const addFile = async (file: File) => {
    if (file.size > 1024 * 1024) { onError("Please use a file smaller than 1 MB so it can be saved with the draft."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = typeof reader.result === "string" ? reader.result : "";
      if (!data) return;
      restore();
      const el = editor.current;
      if (!el) return;
      if (fileKind === "image" && file.type.startsWith("image/")) {
        document.execCommand("insertImage", false, data);
      } else {
        const a = document.createElement("a");
        a.href = data; a.download = file.name; a.textContent = `Attachment: ${file.name}`;
        const range = window.getSelection()?.getRangeAt(0);
        range?.insertNode(a);
        range?.setStartAfter(a); range?.collapse(true);
      }
      notify();
    };
    reader.readAsDataURL(file);
  };
  const button = (name: string, title: string, action: () => void) =>
    <button type="button" title={title} aria-label={title} onMouseDown={e => { e.preventDefault(); remember(); }} onClick={action}><Icon name={name} size={18}/></button>;
  return <div className="fillqcRichEditorRoot">
    <AssessmentRichToolbar label={placeholder} onRemember={remember} onCommand={command} onError={onError} onChooseFile={kind => { setFileKind(kind); if (fileInput.current) { fileInput.current.accept = kind === "image" ? "image/*" : ""; fileInput.current.value = ""; fileInput.current.click(); } }} />
    {menu && typeof document !== "undefined" && createPortal(
      <div ref={floatingMenu} className={`fillqcFloatingFormatMenu ${menu === "symbols" ? "fillqcFloatingSymbols" : ""}`}
        role={menu === "symbols" ? "group" : "listbox"}
        aria-label={menu === "font" ? "Font family" : menu === "size" ? "Font size" : "Special characters"}
        style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}>
        {menu === "symbols" ? MCQC_SYMBOLS.map(v =>
          <button key={v} type="button" title={`Insert ${v}`} aria-label={`Insert ${v}`}
            onMouseDown={e => e.preventDefault()} onClick={() => command("insertText", v)}>{v}</button>
        ) : (menu === "font" ? MCQC_FONTS : MCQC_SIZES).map(v =>
          <button key={v} type="button" role="option" aria-selected={menu === "font" ? font === v : size === v}
            onMouseDown={e => e.preventDefault()}
            onClick={() => { if (menu === "font") { setFont(v); command("fontName", v); } else { setSize(v); command("fontSize", v); } }}>
            {menu === "font" ? v : `${v}px`}
          </button>
        )}
      </div>, document.body)}
    <input ref={fileInput} type="file" hidden onChange={e => { const f=e.target.files?.[0]; if (f) void addFile(f); }}/>
    <div ref={editor} id={editorId} role="textbox" aria-label={placeholder} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={placeholder}
      className="fillqcRichEditable" onInput={notify} onBeforeInput={e => { const input = e.nativeEvent as InputEvent; if (input.data && allowedText(input.data) !== input.data) e.preventDefault(); }} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={e => { e.preventDefault(); const text=allowedText(e.clipboardData.getData("text/plain")); if (text) document.execCommand("insertText", false, text); notify(); }}/>
    <small className="assessmentEditorCounter" aria-live="polite">{value.length}/250</small>
  {250 !== undefined && <small className="assessmentRichCounter" aria-live="polite">{Array.from((value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^\r?\n$/, "")).length}/{250}</small>}</div>;
}

type Question = {
  type: string; typeSelected?: boolean; text: string; options: string[];
  correct: number; blankCorrect?: number[]; points: string; difficulty: string;
  category: string; bloom: string; mandatory: boolean;
};
const BLANK_PATTERN = /_{3,}|\[\[blank\]\]|\{\{blank\}\}/gi;
const blankCount = (text: string) => (text.match(BLANK_PATTERN) ?? []).length;
const blankChoices = (q: Question) => {
  // Answer choices are option indexes: 0 = A, 1 = B, 2 = C, etc.
  // No option is automatically correct, and each blank can use any option.
  const count = Math.max(1, blankCount(q.text));
  return Array.from({ length: count }, (_, i) => {
    const chosen = q.blankCorrect?.[i];
    return typeof chosen === "number" ? chosen : (i === 0 ? q.correct : -1);
  });
};
const fillBlankErrors = (q: Question): string[] => {
  const result: string[] = [];
  if (!q.text.trim()) result.push("Enter the question text.");
  else if (!blankCount(q.text)) result.push("Include at least one blank using _____ in your question.");
  if (q.text.length > 250) result.push("Question text must be 250 characters or fewer.");
  const filledOptions = q.options.map(option => option.trim()).filter(Boolean);
  if (filledOptions.length < 2) result.push("Enter at least two answer options.");
  if (q.options.some(option => option.length > 250)) result.push("Each answer option must be 250 characters or fewer.");
  if (new Set(filledOptions.map(option => option.toLowerCase())).size !== filledOptions.length) result.push("Answer options must be different.");
  blankChoices(q).forEach((optionIndex, i) => {
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= q.options.length || !q.options[optionIndex]?.trim()) {
      result.push(blankCount(q.text) > 1 ? `Select a correct answer for Blank ${i + 1} (any option).` : "Select a correct answer from any option.");
    }
  });
  if (!q.category) result.push("Select a question category.");
  if (!q.bloom) result.push("Select a Bloom’s Taxonomy level.");
  if (!q.difficulty) result.push("Select a difficulty level.");
  if (!q.points.trim() || !(Number(q.points) > 0)) result.push("Points must be greater than zero.");
  return result;
};
const isFillBlankComplete = (q: Question) => fillBlankErrors(q).length === 0;
const newQuestion = (): Question => ({ type: "Fill in the Blanks", typeSelected: true, text: "", options: ["", ""], correct: -1, blankCorrect: [], points: "1", difficulty: "", category: "", bloom: "", mandatory: true });
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
  const label = value === "MCQ" ? "Multiple Choice Question (MCQ)" : value === "Fill in the Blanks" ? "Fill in the Blank" : value;
  const normalized = search.trim().toLowerCase();
  return <div className="fillqcSelectRoot fillqcTypeRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="fillqcSelectTrigger" aria-label="Question Type" disabled aria-expanded={open} aria-controls="fillqcQuestionTypeList" onClick={() => setOpen(previous => !previous)}>
      <span>{label || "Select Question Type"}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "fillqcRotated" : ""}/>
    </button>
    {open && <div id="fillqcQuestionTypeList" className="fillqcTypeDropdown">
      <label className="fillqcTypeSearch"><Icon name="search-02.svg" size={20}/><input autoFocus type="search" placeholder="Search assessment types..." value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="fillqcTypeGroups">{ASSESSMENT_TYPE_GROUPS.map(group => {
        const filtered = group.items.filter(item => item.toLowerCase().includes(normalized));
        if (normalized && !filtered.length && !group.heading.toLowerCase().includes(normalized)) return null;
        const isExpanded = normalized ? true : expanded.includes(group.heading);
        const items = normalized && !filtered.length ? group.items : filtered;
        return <section className="fillqcTypeGroup" key={group.heading}>
          <button type="button" className="fillqcTypeHeading" aria-expanded={isExpanded} onClick={() => setExpanded(previous => previous.includes(group.heading) ? previous.filter(name => name !== group.heading) : [...previous, group.heading])}>
            <span>{group.heading}</span><Icon name="arrow-down-01.svg" size={20} className={isExpanded ? "fillqcRotated" : ""}/>
          </button>
          {isExpanded && <div className="fillqcTypeOptions">{items.map(item => <button type="button" key={item} className="fillqcTypeOption" role="radio" aria-checked={label === item} onClick={() => { onChange(item === "Multiple Choice Question (MCQ)" ? "MCQ" : item); setOpen(false); setSearch(""); }}>
            <span className={`fillqcOptionRadio ${label === item ? "fillqcOptionSelected" : ""}`} aria-hidden="true"/><span>{item}</span>
          </button>)}</div>}
        </section>;
      })}</div>
      {normalized && !ASSESSMENT_TYPE_GROUPS.some(group => group.heading.toLowerCase().includes(normalized) || group.items.some(item => item.toLowerCase().includes(normalized))) && <p className="fillqcTypeEmpty">No assessment types found.</p>}
    </div>}
  </div>;
}

function NeumoSelect({ value, options, onChange, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div className="fillqcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="fillqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="fillqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="fillqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}><span className={`fillqcOptionRadio ${value === option ? "fillqcOptionSelected" : ""}`} /><span>{option}</span></button>)}</div>}</div>;
}
function PreviewStatus({ correct, size = 20 }: { correct: boolean; size?: number }) {
  return <span className={`fillqcPreviewStatusIcon ${correct ? "is-correct" : "is-wrong"}`} aria-hidden="true" />;
}
type OptionDetail = { feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean };
function QuestionsPreview({ questions, details, tags, onBack, onEdit, onContinue, saving, mcqValues }: {
  questions: Question[]; details: Record<string,OptionDetail>; tags: string[];
  onBack: () => void; onEdit: (index:number) => void; onContinue: () => void; saving: boolean;
  mcqValues: MCQDetailsValues;
}) {
  const [filter,setFilter] = useState("All Questions");
  const [showFilter,setShowFilter] = useState(false);
  const [openQuestion,setOpenQuestion] = useState(0);
  const [sections,setSections] = useState({ answers:true, learning:true, settings:true });
  const [openFeedback,setOpenFeedback] = useState<number|null>(null);
  const [learner,setLearner] = useState(false);
  const [learnerAnswers,setLearnerAnswers] = useState<Record<string,string>>({});
  const [checkedLearner,setCheckedLearner] = useState(false);
  const [notice,setNotice] = useState("");
  const valid = questions.map((q,index)=>({q,index})).filter(({q})=>q.text.trim() || q.options.some(Boolean));
  const filtered = valid.filter(({q})=>filter==="All Questions" || (filter==="Complete" ? isFillBlankComplete(q) : !isFillBlankComplete(q)));
  const current = filtered[openQuestion] || filtered[0];
  const readyAll = questions.length >= mcqValues.questionCount && questions.slice(0, mcqValues.questionCount).every(isFillBlankComplete);
  const toggle = (key:"answers"|"learning"|"settings") => setSections(old=>({...old,[key]:!old[key]}));
  const detail = (qi:number,oi:number) => details[`${qi}-${oi}`] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false};
  const continuePreview = () => {
    if (!readyAll) {
      setNotice("Complete all configured fill-in-the-blanks questions before continuing.");
      return;
    }
    onContinue();
  };
  return <div className="fillqcPreview">
    <nav className="fillqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><Link href="/assessments/create/details">Create Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="fillqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="fillqcPreviewControls"><div className="fillqcPreviewTotals"><div><strong>{valid.length}</strong><span>Questions</span></div><div><strong>{valid.reduce((total,{q})=>total+(Number(q.points)||0),0)}</strong><span>Marks</span></div><div className="fillqcPreviewReady"><span className="fillqcPreviewReadyCheck" aria-hidden="true" /><span><strong>{readyAll?"Ready":"In Progress"}</strong><small>{readyAll?"All good to continue":"Review incomplete questions"}</small></span></div></div><div className="fillqcPreviewTools"><div className="fillqcPreviewFilter"><button type="button" onClick={()=>setShowFilter(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{showFilter && <div>{["All Questions","Complete","Incomplete"].map(f=><button key={f} type="button" onClick={()=>{setFilter(f);setOpenQuestion(0);setShowFilter(false);}}>{f}</button>)}</div>}</div><button type="button" className="fillqcPreviewLearner" onClick={()=>{setLearner(v=>!v);setCheckedLearner(false);}}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div></div>
      {current ? <article className="fillqcPreviewQuestion" key={current.index}><div className="fillqcPreviewMeta"><span>Fill in the Blanks: {current.q.points} Points</span><span>Status: <b className={isFillBlankComplete(current.q)?"fillqcGreen":"fillqcOrange"}>{isFillBlankComplete(current.q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(current.index)}><Icon name="edit.svg" size={16}/> Edit</button></div>
        <div className="fillqcPreviewPanel"><h3>Question {current.index+1}</h3><p>{current.q.text||"Question has not been written yet."}</p>
          {learner && blankCount(current.q.text)>0 && <div className="fillqcLearnerBlanks">{blankChoices(current.q).map((answerIndex,i)=>{
            const key=`${current.index}-${i}`;
            const response=learnerAnswers[key] ?? "";
            const expected=current.q.options[answerIndex] ?? "";
            const correct=response.trim().toLocaleLowerCase()===expected.trim().toLocaleLowerCase();
            return <label key={key}>Blank {i+1}<input value={response} placeholder={`Type answer for blank ${i+1}`} onChange={event=>{setLearnerAnswers(old=>({...old,[key]:event.target.value}));setCheckedLearner(false);}}/>{checkedLearner && <small className={correct?"is-correct":"is-wrong"}>{correct?"Correct answer":"Try again"}</small>}</label>;
          })}<></></div>}
        </div>
        <div className="fillqcPreviewPanel"><button type="button" className="fillqcPreviewSectionHead" onClick={()=>toggle("answers")}>Answer Options <Icon name="arrow-down-01.svg" size={18} className={sections.answers?"fillqcRotated":""}/></button>{sections.answers && <div className="fillqcPreviewAnswers">{current.q.options.map((answer,i)=>{ const correctFor = blankChoices(current.q).flatMap((choice,blankIndex)=>choice===i?[blankIndex+1]:[]); const correct=correctFor.length>0; return <div key={i} className={`fillqcPreviewAnswer ${learner?"":correct?"correct":"incorrect"}`}>{!learner && <PreviewStatus correct={correct} size={20}/>}<span className="fillqcAnswerLetter">{String.fromCharCode(65+i)}</span><span className="fillqcPreviewAnswerText">{learner ? (answer || `Option ${String.fromCharCode(65+i)}`) : (answer || `Option ${String.fromCharCode(65+i)} (empty)`)}</span>{!learner && <small>{correct?"Correct Answer":"Wrong Answer"}</small>}</div>;})}</div>}</div>
        {!learner && <div className="fillqcPreviewPanel"><button type="button" className="fillqcPreviewSectionHead" onClick={()=>toggle("learning")}>Feedback and Learning <Icon name="arrow-down-01.svg" size={18} className={sections.learning?"fillqcRotated":""}/></button>{sections.learning && <div className="fillqcPreviewLearning"><section><h4><PreviewStatus correct={true} size={20}/> Correct-answer Feedback</h4>{current.q.options.map((answer,i)=>blankChoices(current.q).includes(i)?<div key={i} className="fillqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={true} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><PreviewStatus correct={false} size={20}/> Wrong-answer Feedback</h4>{current.q.options.map((answer,i)=>!blankChoices(current.q).includes(i)?<div key={i} className="fillqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={false} size={17}/>{String.fromCharCode(65+i)} — {answer||"(empty)"}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>:null)}</section><section><h4><Icon name="assignments.svg" size={20}/> Explanation</h4><p>{blankChoices(current.q).map(i=>i>=0?detail(current.index,i).explanation.trim():"").filter(Boolean).join("\n") || "No explanation entered."}</p></section><section><h4><Icon name="idea.svg" size={20}/> Hint</h4><p>{blankChoices(current.q).map(i=>i>=0?detail(current.index,i).hint.trim():"").filter(Boolean).join("\n") || "No hint entered."}</p></section></div>}</div>}
        {!learner && <div className="fillqcPreviewPanel"><button type="button" className="fillqcPreviewSectionHead" onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={sections.settings?"fillqcRotated":""}/></button>{sections.settings && <div className="fillqcPreviewSettings">{[["Difficulty",current.q.difficulty||"Not selected","target.svg"],["Bloom’s Taxonomy",current.q.bloom||"Not selected","brain.svg"],["Category",current.q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",current.q.mandatory?"YES":"NO","circle-check.svg"]].map(([label,value,icon])=><div key={label}><span>{label}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}</div>}
        <div className="fillqcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button>{saving && <span className="fillqcSaveSuccessToast" role="status">Successfully saved</span>}</div></article>:<div className="fillqcPreviewEmpty"><button type="button" onClick={onBack}>Back to Question</button></div>}
      {notice && <p className="fillqcBuilderNotice fillqcValidationError" role="alert">{notice}</p>}
    </div>
  </div>;
}
function QuestionBuilder({ questions, setQuestions, onExit, mcqValues }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onExit: () => void; mcqValues: MCQDetailsValues }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [selectedBlank, setSelectedBlank] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const numberScrollRef = useRef<HTMLDivElement>(null);
  const [numberScrollProgress, setNumberScrollProgress] = useState(0);
  const syncNumberScroll = () => { const el = numberScrollRef.current; if (el) setNumberScrollProgress(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)); };
  const [addOpen, setAddOpen] = useState(false);
  const [bottomAddOpen, setBottomAddOpen] = useState(false);
  useEffect(() => {
    if (!addOpen && !bottomAddOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".fillqcAddMenu")) { setAddOpen(false); setBottomAddOpen(false); }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAddOpen(false); setBottomAddOpen(false); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [addOpen, bottomAddOpen]);
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
    setShowValidation(true);
    const firstInvalid = questions.slice(0, mcqValues.questionCount).findIndex(q => !isFillBlankComplete(q));
    if (questions.length < mcqValues.questionCount || firstInvalid >= 0) {
      const index = firstInvalid >= 0 ? firstInvalid : questions.length;
      setActive(Math.min(index, mcqValues.questionCount - 1));
      setSelectedBlank(0);
      const problem = questions[index] ? fillBlankErrors(questions[index])[0] : "Add the remaining configured questions.";
      setNotice(`Question ${index + 1}: ${problem}`);
      setSaveSuccess(false);
      return;
    }
    const sum = questions.slice(0, mcqValues.questionCount).reduce((n,q)=>n+(Number(q.points)||0),0);
    if (Math.abs(sum-mcqValues.totalMarks)>0.001) {
      setNotice(`Question points total ${sum}, but Total Marks is ${mcqValues.totalMarks}. Update the points to match.`);
      setSaveSuccess(false);
      return;
    }
    try {
      assessmentStorage.setItem("fillBlanksContentDraft", JSON.stringify({ questions, optionDetails, tags, richHtml, savedAt: new Date().toISOString() }));
      setNotice("");
      setSaveSuccess(true);
      setIsSaving(true);
      saveTimer.current = window.setTimeout(() => { setSaveSuccess(false); setIsSaving(false); router.push("/assessments/create/evaluation"); }, 3000);
    } catch {
      setIsSaving(false);
      setSaveSuccess(false);
      setNotice("Could not save the fill-in-the-blanks questions. Please try again.");
    }
  };
  const [previewing, setPreviewing] = useState(false);
  const item = questions[active] || newQuestion();
  const update = (patch: Partial<Question>) => setQuestions(old => old.map((q, index) => index === active ? { ...q, ...patch } : q));
  const complete = isFillBlankComplete;
  const partial = (q: Question) => !!q.text.trim() || q.options.some(v => !!v.trim()) || blankChoices(q).some(i => i >= 0) || !!q.category || !!q.bloom;
  const addQuestion = () => { setSelectedBlank(0); if (active >= mcqValues.questionCount - 1 && questions.length >= mcqValues.questionCount) { setNotice(`Only ${mcqValues.questionCount} questions are configured.`); setAddOpen(false); setBottomAddOpen(false); return; } setActive(n => Math.min(n + 1, mcqValues.questionCount - 1)); setExpandedOptions([]); setAddOpen(false); setNotice(""); };
  const chooseAdd = (option: string) => { setAddOpen(false); setBottomAddOpen(false); if (option === "Create Manually") addQuestion(); else if (option === "Generate with AI") router.push("/assessments/create/ai?type=fill-in-the-blanks"); else setNotice(`${option} will be available when connected.`); };
  const setOption = (index: number, value: string) => update({ options: item.options.map((old, i) => i === index ? value : old) });
  const currentBlank = Math.min(selectedBlank, Math.max(0, blankCount(item.text) - 1));
  const setCorrectForBlank = (optionIndex: number) => {
    const current = blankChoices(item);
    const next = current.map((choice, blankIndex) => blankIndex === currentBlank ? (choice === optionIndex ? -1 : optionIndex) : choice);
    update({ blankCorrect: next, correct: next[0] ?? -1 });
  };
  const currentDone = questions.filter(complete).length;
  const optionKey = (index: number) => `${active}-${index}`;
  const getDetail = (index: number) => optionDetails[optionKey(index)] || { feedback: "", explanation: "", hint: "", showHint: false, allowHint: false };
  const setDetail = (index: number, patch: Partial<{ feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>) => setOptionDetails(old => ({...old, [optionKey(index)]: {...(old[optionKey(index)] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false}),...patch}}));
  const [richHtml, setRichHtml] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(assessmentStorage.getItem("fillBlanksContentDraft") || "{}");
      if (Number.isInteger(saved.active)) setActive(Math.max(0, Math.min(questions.length - 1, saved.active)));
      if (saved.richHtml && typeof saved.richHtml === "object") setRichHtml(saved.richHtml);
      if (saved.optionDetails && typeof saved.optionDetails === "object") setOptionDetails(saved.optionDetails);
      if (Array.isArray(saved.tags)) setTags(saved.tags.filter((tag: unknown): tag is string => typeof tag === "string"));
    } catch { /* Existing unsaved editor content stays available. */ }
    setDraftReady(true);
  }, []);
  useEffect(() => { if (!draftReady) return; try { assessmentStorage.setItem("fillBlanksContentDraft", JSON.stringify({questions,optionDetails,tags,richHtml,active})); } catch { setNotice("Could not save this draft in your browser."); } }, [draftReady,questions,optionDetails,tags,richHtml,active]);
  const richEditor = (fieldId: string, value: string, onChange: (next: string) => void, placeholder: string) =>
    <MCQRichEditor key={fieldId} editorId={fieldId} value={value} html={richHtml[fieldId]}
      onChange={onChange} onHtmlChange={(html) => setRichHtml(previous => ({ ...previous, [fieldId]: html }))}
      placeholder={placeholder} onError={setNotice} />;
  const detailEditor = (index: number, field: "feedback" | "explanation" | "hint") => {
    const id = `fillqc-${field}-${active}-${index}`;
    return <div className="fillqcOptionEditor">{richEditor(id, getDetail(index)[field], text => setDetail(index, { [field]: text }), `Write ${field} here...`)}</div>;
  };

  if (previewing) return <QuestionsPreview questions={questions} details={optionDetails} tags={tags} mcqValues={mcqValues} saving={isSaving} onBack={()=>setPreviewing(false)} onContinue={saveAndContinue} onEdit={(index)=>{setActive(index);setSelectedBlank(0);setPreviewing(false);setExpandedOptions([0]);}}/>;
  return <div className="fillqcBuilder">
    <div className="fillqcBuilderTop"><nav className="fillqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" /><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg" /><strong>Create Questions</strong></nav><div className="fillqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30} /><div><h2>Let's Get Started! Antony?</h2><p>Let's Build A Great Question.</p></div></div></div>
    <div className="fillqcBuilderGrid"><section className="fillqcBuilderMain">
      <div className="fillqcQuestionsHeading"><div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div><div className="fillqcAddMenu"><button type="button" className="fillqcTopAdd" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}><Icon name="plus.svg" size={20} />Add</button>{addOpen && <div className="fillqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`fillqcOptionRadio ${index === 0 ? "fillqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div></div>
      <div className={`fillqcNumberNavigation ${mcqValues.questionCount <= 7 ? "fillqcFewQuestions" : "fillqcManyQuestions"}`}><button type="button" className="fillqcRoundNav" aria-label="Previous question" disabled={active === 0} onClick={() => setActive(n => Math.max(0,n-1))}><Icon name="arrowleft.svg" size={20}/></button><div className="fillqcNumberScroller"><div ref={numberScrollRef} onScroll={syncNumberScroll} className="fillqcQuestionNumbers" aria-label="Question numbers">{Array.from({ length: mcqValues.questionCount }, (_, index) => { const q = questions[index]; const status = q && complete(q) ? "is-complete" : index === active ? "is-active" : "is-empty"; return <button type="button" key={index} className={`fillqcQuestionNumber ${status}`} aria-label={`Question ${index+1}`} aria-current={active===index?"step":undefined} onClick={() => { setActive(index); setSelectedBlank(0); setExpandedOptions([]); setExpandedDetail(null); }}><span className="fillqcNumberValue">{index+1}</span><span className={`fillqcNumberStatus ${status === "is-complete" ? "is-done" : "is-pending"}`} aria-hidden="true">{status === "is-complete" ? "✓" : ""}</span>{q && q.typeSelected === true && q.type && <small>{q.type === "Fill in the Blanks" || q.type === "Fill in the Blank" ? "FIB" : q.type === "MCQ" ? "MCQ" : q.type.split(/\s+/).map(part => part[0] || "").join("").slice(0, 4).toUpperCase()}</small>}</button>; })}</div><div className="fillqcNumberShortTrack" aria-hidden="true"><span className="fillqcNumberShortThumb" style={{ left: `calc((100% - var(--fillqc-scroll-thumb, min(67px, 26%))) * ${numberScrollProgress})` }} /></div></div><button type="button" className="fillqcRoundNav" aria-label="Next question" disabled={active >= mcqValues.questionCount - 1} onClick={() => { if (active + 1 < mcqValues.questionCount) setActive(n=>n+1); setExpandedOptions([]); setExpandedDetail(null); }}><Icon name="arrowright.svg" size={20}/></button></div>
      <div className="fillqcQuestionProgress"><span style={{ width: `${Math.min(100,Math.max(4,currentDone / mcqValues.questionCount*100))}%` }}/></div>
      <div className="fillqcQuestionForm"><div className="fillqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value={item.type} onChange={type=>update({type,typeSelected:true})}/></div>
        <div className="fillqcBuilderField fillqcWriteField"><label htmlFor="fillqcQuestionText">Write Your Question </label><div className="fillqcEditorSurface">{richEditor(`fillqc-question-${active}`, item.text, text => update({ text }), "Write a sentence with _____ for each blank...")}</div></div>
        <div className="fillqcBuilderField"><label>Available Options</label>
          {blankCount(item.text) > 1 && <div className="fillqcBlankTarget"><label>Correct answer for</label><NeumoSelect value={`Blank ${currentBlank + 1}`} options={Array.from({length:blankCount(item.text)},(_,i)=>`Blank ${i+1}`)} onChange={value=>setSelectedBlank(Number(value.replace("Blank ",""))-1)}/></div>}
          <div className="fillqcAnswerOptions">{item.options.map((option,index)=>{ const open=expandedOptions.includes(index); const detail=getDetail(index); const chosen=blankChoices(item)[currentBlank]===index; return <div className="fillqcAnswerSection" key={index}>
            <button type="button" className="fillqcAnswerExpand" aria-expanded={open} onClick={()=>{setExpandedOptions(open?[]:[index]);setExpandedDetail(null);}}><span>Option {String.fromCharCode(65+index)}</span><Icon name="arrow-down-01.svg" size={21} className={open?"fillqcRotated":""}/></button>
            {open && <div className="fillqcAnswerContent"><div className="fillqcOptionSubLabel"><span>Text</span></div><div className="fillqcOptionEditor">{richEditor(`fillqc-opt-${active}-${index}`,option,text=>setOption(index,text),`Enter option ${String.fromCharCode(65+index)}`)}</div><label className="fillqcCorrectOption"><input type="checkbox" checked={chosen} onChange={()=>setCorrectForBlank(index)}/>{blankCount(item.text)>1?`Correct Answer for Blank ${currentBlank+1}`:"Correct Answers"}</label>
              {(["feedback","explanation","hint"] as const).map(field=>{const sectionId=`${index}-${field}`;const sectionOpen=expandedDetail===sectionId;return <div className="fillqcOptionDetail" key={field}><button type="button" className="fillqcOptionDetailHead" aria-expanded={sectionOpen} onClick={()=>setExpandedDetail(sectionOpen?null:sectionId)}><span className="fillqcDetailHeading"><Icon name={field==="feedback"?"message-circle-more.svg":field==="explanation"?"assignments.svg":"idea.svg"} size={18}/>{field[0].toUpperCase()+field.slice(1)}</span><Icon name="arrow-down-01.svg" size={18} className={sectionOpen?"fillqcRotated":""}/></button>{sectionOpen && <div className="fillqcOptionDetailBody">{detailEditor(index,field)}{field==="hint" && <div className="fillqcHintChecks"><label><input type="checkbox" checked={detail.showHint} onChange={e=>setDetail(index,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={detail.allowHint} onChange={e=>setDetail(index,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>;})}
              {item.options.length>2 && <button type="button" className="fillqcRemoveOption" onClick={()=>{const next=blankChoices(item).map(choice=>choice===index?-1:choice>index?choice-1:choice);update({options:item.options.filter((_,i)=>i!==index),correct:next[0]??-1,blankCorrect:next});setExpandedOptions([]);setExpandedDetail(null);}}>Remove Option</button>}
            </div>}
          </div>;})}</div><button type="button" className="fillqcAddOptions" onClick={()=>{update({options:[...item.options,""]});setExpandedOptions([item.options.length]);setExpandedDetail(null);}}><Icon name="plus.svg" size={20}/>Add Options</button>
          {showValidation && fillBlankErrors(item).length>0 && <div className="fillqcValidationErrors" role="alert">{fillBlankErrors(item).map(error=><p key={error}>{error}</p>)}</div>}
        </div>
      </div><div className="fillqcBuilderBottom"><div className="fillqcAddMenu fillqcBottomAddMenu"><button type="button" className="fillqcBuilderAction fillqcSubmitQuestion" onClick={() => { setBottomAddOpen(v => !v); setAddOpen(false); }} aria-expanded={bottomAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={21}/>Add Questions</button>{bottomAddOpen && <div className="fillqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`fillqcOptionRadio ${index === 0 ? "fillqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div><div className="fillqcBuilderArrows"><button type="button" className="fillqcRoundNav" aria-label="Previous" onClick={() => setActive(n=>Math.max(0,n-1))}><Icon name="arrowleft.svg"/></button><button type="button" className="fillqcRoundNav" aria-label="Next" onClick={() => { if(active+1<mcqValues.questionCount)setActive(n=>n+1); }}><Icon name="arrowright.svg"/></button></div></div>
    </section><aside className="fillqcBuilderAside"><section className="fillqcAsideSection"><h3>Question Settings</h3><div className="fillqcBuilderField"><label htmlFor="fillqcPoints">Points</label><div className="fillqcPointsControl"><input id="fillqcPoints" type="number" min="0" step="1" value={item.points} onChange={e=>update({points:e.target.value})}/><div className="fillqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(item.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="fillqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(item.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div><div className="fillqcBuilderField"><label>Difficulty</label><NeumoSelect value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="fillqcBuilderField"><label>Category</label><NeumoSelect value={item.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="fillqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={item.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div><div className="fillqcBuilderField"><label>Tag</label><div className="fillqcTagHolder"><button type="button" className="fillqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="fillqcTagInput" aria-label="New tag" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="fillqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(v=>v!==tag))}>{tag} <Icon name="cancel.svg" size={14}/></button>)}</div></div><div className="fillqcMandatory"><span>Mandatory</span><button type="button" className={`fillqcSwitch ${item.mandatory ? 'fillqcSwitchOn' : ''}`} role="switch" aria-label="Mandatory Question" aria-checked={item.mandatory} onClick={()=>update({mandatory:!item.mandatory})}><span className="fillqcSwitchText">{item.mandatory?'ON':'OFF'}</span><span className="fillqcSwitchKnob"/></button></div><p className="fillqcAsideHint">This Question is Mandatory</p></section><section className="fillqcAsideSection fillqcBuilderSummary"><h3>Assessment Summary</h3><div className="fillqcStatGrid"><div><strong>{currentDone}/{mcqValues.questionCount}</strong><span>Questions</span></div><div><strong>{questions.reduce((n,q)=>n+(complete(q)?Number(q.points)||0:0),0)}</strong><span>Marks</span></div><div><strong>{mcqValues.durationMinutes}</strong><span>Minutes</span></div></div><p>Marks per Question: {mcqValues.marksPerQuestion}</p><div className="fillqcSummaryProgress"><span style={{width:`${Math.min(100,currentDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. Add questions to get started.</p><div className="fillqcBuilderField"><label>Passing Score</label><input className="fillqcSummaryValue" value={mcqValues.passingScore} aria-label="Passing Score" readOnly/></div></section></aside></div>
    {notice && <p className="fillqcBuilderNotice" role="status">{notice}</p>}
    <div className="fillqcBuilderPageFooter"><button type="button" className="fillqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="fillqcFooterPill" onClick={()=>{setNotice("");setPreviewing(true);}}>Preview Questions</button><div className="fillqcSaveContinueGroup">{saveSuccess && <span className="fillqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="fillqcFooterPill fillqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}

type MCQDetailsValues = { totalMarks: number; questionCount: number; marksPerQuestion: number; durationMinutes: number; passingScore: string };
const DEFAULT_MCQ_VALUES: MCQDetailsValues = { totalMarks: 1, questionCount: 1, marksPerQuestion: 1, durationMinutes: 60, passingScore: "60%" };
const positiveInteger = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback; };
const nonnegativeNumber = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 0 ? number : fallback; };
export default function FillBlanksContentPage() {
  const router = useRouter();
  const [mcqValues, setMcqValues] = useState<MCQDetailsValues>(DEFAULT_MCQ_VALUES);
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  const [pageReady, setPageReady] = useState(false);
  useEffect(() => {
    try {
      const details = assessmentStorage.getItem("fillBlanksAssessmentDraft") || assessmentStorage.getItem("fillblanksAssessmentDraft");
      const draft = details ? JSON.parse(details) : {};
      const questionCount = positiveInteger(draft.questionCount ?? assessmentStorage.getItem("fillBlanksQuestionCount"), DEFAULT_MCQ_VALUES.questionCount);
      const totalMarks = nonnegativeNumber(draft.totalMarks, DEFAULT_MCQ_VALUES.totalMarks);
      const marksPerQuestion = nonnegativeNumber(draft.marksPerQuestion, DEFAULT_MCQ_VALUES.marksPerQuestion);
      const durationRaw = Number.parseFloat(String(draft.duration ?? draft.timeLimit ?? "60"));
      const durationMinutes = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 60;
      const passingRaw = String(draft.passingScore ?? "").trim();
      const passingMarks = Number(draft.passingMarks);
      const passingScore = passingRaw ? (passingRaw.includes("%") ? passingRaw : `${passingRaw}%`) :
        draft.passingMarks !== undefined && totalMarks > 0 && Number.isFinite(passingMarks)
          ? `${Math.round(passingMarks / totalMarks * 100)}%` : "60%";
      setMcqValues({ questionCount, totalMarks, marksPerQuestion, durationMinutes, passingScore });
      const content = assessmentStorage.getItem("fillBlanksContentDraft");
      const parsed = content ? JSON.parse(content) as { questions?: Question[] } : {};
      const savedQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      setQuestions(Array.from({ length: questionCount }, (_, index) => {
        const saved = savedQuestions[index];
        return saved ? { ...newQuestion(), ...saved, type: saved.type || "Fill in the Blanks", typeSelected: true } : { ...newQuestion(), points: String(marksPerQuestion) };
      }));
    } catch {
      setQuestions(Array.from({ length: DEFAULT_MCQ_VALUES.questionCount }, () => newQuestion()));
    }
    setPageReady(true);
  }, []);

  return (
    <main className="fillqcAppShell">
      <div className="fillqcLayout">
        <Sidebar />
        <section className="fillqcMainContent">
          <div className="fillqcHeader"><Header /></div>
          <div className="fillqcScrollArea">
            <div className="fillqcPageContent">
              {pageReady && <QuestionBuilder questions={questions} setQuestions={setQuestions} mcqValues={mcqValues} onExit={() => router.push("/assessments/create/details")} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
