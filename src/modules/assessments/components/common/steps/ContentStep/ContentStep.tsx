"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import {validateMcqQuestions} from "@/modules/assessments/validation/mcq-validation";
import { assessmentStorage, updateAssessment } from "@/modules/assessments/storage/assessment-storage";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAssessmentTypeGroups } from "@/modules/assessments/config/assessment-types";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../../sidebar/page";
import Header from "../../header/Header";
import "./content.css";

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



// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"];
const MCQC_SIZES = ["12", "14", "16", "18", "24"];
const MCQC_SYMBOLS = ["©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "∞", "π", "√", "∑", "α", "β", "γ", "Δ", "€", "£", "₹", "→", "←", "•", "✓", "★", "¼", "½", "¾", "§", "¶", "…", "—", "“", "”", "’"];
export function MCQRichEditor({ editorId, value, html, onChange, onHtmlChange, placeholder, onError, maxLength, extendedToolbar = false }: {
  editorId: string; value: string; html?: string; onChange: (text: string) => void;
  onHtmlChange: (html: string) => void; placeholder: string; onError: (message: string) => void; maxLength?: number; extendedToolbar?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textColorInput = useRef<HTMLInputElement>(null);
  const highlightColorInput = useRef<HTMLInputElement>(null);
  const [fileKind, setFileKind] = useState<"image" | "attachment">("image");
  const [menu, setMenu] = useState<"font" | "size" | "symbols" | null>(null);
  const [font, setFont] = useState("Arial");
  const [size, setSize] = useState("16");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 160 });
  const openFormatMenu = (kind: "font" | "size" | "symbols", trigger: HTMLButtonElement) => {
    if (menu === kind) { setMenu(null); return; }
    const rect = trigger.getBoundingClientRect();
    const width = kind === "symbols" ? Math.min(270, window.innerWidth - 16) : kind === "font" ? 190 : 110;
    const height = kind === "symbols" ? 280 : 218;
    const top = window.innerHeight - rect.bottom >= height + 12 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    setMenuPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    setMenu(kind);
  };
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
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
  const charLimit = maxLength ?? (/(?:explanation|hint)/i.test(editorId) ? 250 : undefined);
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
      onError(`This field allows a maximum of ${charLimit} characters.`);
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
    document.execCommand(name, false, name === "fontSize" ? "7" : valueArg);
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
  return <div className="mcqcRichEditorRoot">
    <div className="mcqcRichToolbar mcqcOptionToolbar" role="toolbar" aria-label={`${placeholder} formatting`}>
      {button("undo.svg", "Undo", () => command("undo"))}
      {button("redo.svg", "Redo", () => command("redo"))}
      <div className="mcqcRichMenuRoot"><button type="button" className="mcqcToolbarSelect mcqcToolbarFont" aria-expanded={menu === "font"} onMouseDown={e => { e.preventDefault(); remember(); }} onClick={e => openFormatMenu("font", e.currentTarget)}>{font}<Icon name="arrow-down-01.svg" size={15}/></button>
        </div>
      <div className="mcqcRichMenuRoot"><button type="button" className="mcqcToolbarSelect mcqcToolbarSize" aria-expanded={menu === "size"} onMouseDown={e => { e.preventDefault(); remember(); }} onClick={e => openFormatMenu("size", e.currentTarget)}>{size}<Icon name="arrow-down-01.svg" size={15}/></button>
        </div>
      {button("bold.svg", "Bold", () => command("bold"))}
      {button("italic.svg", "Italic", () => command("italic"))}
      {button("underline.svg", "Underline", () => command("underline"))}
      {extendedToolbar && <><button type="button" className="mcqcColorTrigger" title="Text color" aria-label="Text color" onMouseDown={e=>{e.preventDefault();remember();}} onClick={()=>textColorInput.current?.click()}>A</button>{button("pen-line.svg", "Text color pen", () => textColorInput.current?.click())}{button("highlighter.svg", "Highlight color", () => highlightColorInput.current?.click())}</>}
      {button("text-centerline-center-top.svg", "Bulleted list", () => command("insertUnorderedList"))}
      {button("image.svg", "Insert image", () => { setFileKind("image"); if (fileInput.current) { fileInput.current.accept="image/*"; fileInput.current.value=""; fileInput.current.click(); } })}
      {button("attachment.svg", "Attach file", () => { setFileKind("attachment"); if (fileInput.current) { fileInput.current.accept=""; fileInput.current.value=""; fileInput.current.click(); } })}
    </div>
    {menu && typeof document !== "undefined" && createPortal(
      <div className={`mcqcFloatingFormatMenu ${menu === "symbols" ? "mcqcFloatingSymbols" : ""}`}
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
    {extendedToolbar && <><input ref={textColorInput} type="color" aria-label="Choose text color" tabIndex={-1} className="mcqcHiddenColorInput" onChange={event=>command("foreColor",event.target.value)}/><input ref={highlightColorInput} type="color" aria-label="Choose highlight color" tabIndex={-1} className="mcqcHiddenColorInput" onChange={event=>command("hiliteColor",event.target.value)}/></>}
    <input ref={fileInput} type="file" hidden onChange={e => { const f=e.target.files?.[0]; if (f) void addFile(f); }}/>
    <div ref={editor} id={editorId} role="textbox" aria-label={placeholder} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={placeholder}
      className="mcqcRichEditable" onInput={notify} onBeforeInput={e => { const input = e.nativeEvent as InputEvent; if (input.data && allowedText(input.data) !== input.data) e.preventDefault(); }} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={e => { e.preventDefault(); const text=allowedText(e.clipboardData.getData("text/plain")); if (text) document.execCommand("insertText", false, text); notify(); }}/>
    {(charLimit !== undefined || editorId.startsWith("mcqc-")) && <small className="assessmentEditorCounter" aria-live="polite">{value.length}/{charLimit ?? 250}</small>}
  </div>;
}

type Question = { type: string; typeSelected?: boolean; text: string; options: string[]; correct: number; points: string; difficulty: string; category: string; bloom: string; mandatory: boolean };
const newQuestion = (): Question => ({ type: "MCQ", typeSelected: true, text: "", options: ["", ""], correct: -1, points: "", difficulty: "", category: "", bloom: "", mandatory: false });
const CATEGORIES = ["AI", "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Data Science", "Cybersecurity", "Cloud Computing", "Programming", "Database", "Web Development", "Software Engineering", "Computer Networks", "Operating Systems", "Data Structures & Algorithms", "Mathematics", "Statistics", "Other"];
const BLOOMS = ["Remember", "Create", "Evaluate", "Analyze", "Apply", "Understand"];
function QuestionTypeDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ASSESSMENT_TYPE_GROUPS = getAssessmentTypeGroups(true);
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
    <button type="button" className="mcqcSelectTrigger" aria-label="Question Type" aria-expanded={open} aria-controls="mcqcQuestionTypeList" onClick={() => setOpen(previous => !previous)}>
      <span>{label || "Select Question Type"}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "mcqcRotated" : ""}/>
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
  return <div className="mcqcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="mcqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="mcqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="mcqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}><span className={`mcqcOptionRadio ${value === option ? "mcqcOptionSelected" : ""}`} /><span>{option}</span></button>)}</div>}</div>;
}
function PreviewStatus({ correct, size = 20 }: { correct: boolean; size?: number }) { return <span className={`mcqcPreviewStatusIcon ${correct ? "is-correct" : "is-wrong"}`} aria-hidden="true" />; }
type OptionDetail = { feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean };
function QuestionsPreview({ questions, details, tags, onBack, onEdit, onContinue, saving, mcqValues }: { questions: Question[]; details: Record<string,OptionDetail>; tags: string[]; onBack: () => void; onEdit: (index:number) => void; onContinue: () => void; saving: boolean; mcqValues: MCQDetailsValues }) {
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
        <div className="mcqcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button>{saving && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</div></article>:<div className="mcqcPreviewEmpty"><p>{filter==="All Questions"?"No questions have been entered yet.":`No ${filter.toLowerCase()} questions found.`}</p><button type="button" onClick={onBack}>Back to Question</button></div>}
    </div>
  </div>;
}
function QuestionBuilder({ questions, setQuestions, onExit, mcqValues, setMcqValues }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onExit: () => void; mcqValues: MCQDetailsValues; setMcqValues: React.Dispatch<React.SetStateAction<MCQDetailsValues>> }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const numberScrollRef = useRef<HTMLDivElement>(null);
  const [numberScrollProgress, setNumberScrollProgress] = useState(0);
  const syncNumberScroll = () => { const el = numberScrollRef.current; if (el) setNumberScrollProgress(el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)); };
  const [addOpen, setAddOpen] = useState(false);
  const [bottomAddOpen, setBottomAddOpen] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<number[]>([]);
  const [optionDetails, setOptionDetails] = useState<Record<string, { feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>>({});
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [notice, setNotice] = useState("");
  const [validationFailed,setValidationFailed]=useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);
  const saveAndContinue = () => {
    if (isSaving) return;
    const checked=validateMcqQuestions(questions,mcqValues.questionCount,mcqValues.totalMarks);
    if(checked.ok===false){setValidationFailed(true);setNotice(checked.message);if(checked.question!==undefined)setActive(checked.question);return;}
    try {
      assessmentStorage.setItem("mcqContentDraft", JSON.stringify({ questions, optionDetails, tags, richHtml, savedAt: new Date().toISOString() }));
      setValidationFailed(false);
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
  const complete = (q: Question) => validateMcqQuestions([q], 1).ok;
  const partial = (q: Question) => !!q.text.trim() || q.options.some(v => !!v.trim()) || q.correct >= 0 || !!q.category || !!q.bloom;
  const addQuestion = () => { if (active >= mcqValues.questionCount - 1 && questions.length >= mcqValues.questionCount) { setNotice(`Only ${mcqValues.questionCount} questions are configured.`); setAddOpen(false); setBottomAddOpen(false); return; } setActive(n => Math.min(n + 1, mcqValues.questionCount - 1)); setExpandedOptions([]); setAddOpen(false); setNotice(""); };
  const chooseAdd = (option: string) => { setAddOpen(false); setBottomAddOpen(false); if (option === "Create Manually") addQuestion(); else setNotice(`${option} will be available when connected.`); };
  const setOption = (index: number, value: string) => update({ options: item.options.map((old, i) => i === index ? value : old) });
  const currentDone = questions.filter(complete).length;
  const optionKey = (index: number) => `${active}-${index}`;
  const getDetail = (index: number) => optionDetails[optionKey(index)] || { feedback: "", explanation: "", hint: "", showHint: false, allowHint: false };
  const setDetail = (index: number, patch: Partial<{ feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>) => setOptionDetails(old => ({...old, [optionKey(index)]: {...(old[optionKey(index)] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false}),...patch}}));
  const [richHtml, setRichHtml] = useState<Record<string, string>>({});
  const removeQuestion = () => {
    if (mcqValues.questionCount <= 1) { setNotice("At least one question is required."); return; }
    if (!window.confirm("Remove this question? The question count and total marks will decrease.")) return;
    const newCount = mcqValues.questionCount - 1;
    try {
      const detailsRaw = assessmentStorage.getItem("mcqAssessmentDraft");
      const countRaw = assessmentStorage.getItem("mcqQuestionCount");
      const contentRaw = assessmentStorage.getItem("mcqContentDraft");
      const details = JSON.parse(detailsRaw || "{}");
      const content = JSON.parse(contentRaw || "{}");
      const weighted = details.markingScheme === "Weighted questions" || details.markingScheme === "Custom marking";
      const removedPoints = Number(questions[active]?.points) || mcqValues.marksPerQuestion;
      const total = Number((weighted ? mcqValues.totalMarks - removedPoints : newCount * mcqValues.marksPerQuestion).toFixed(6));
      if (!Number.isFinite(total) || total <= 0) { setNotice("Cannot remove this question because the remaining total marks would not be positive. Adjust the marks first."); return; }
      const nextQuestions = questions.filter((_, index) => index !== active);
      const nextDetails = Object.fromEntries(Object.entries(optionDetails).flatMap(([key, value]) => {
        const match = /^(\d+)(-.+)$/.exec(key); if (!match) return [[key, value]];
        const index = Number(match[1]); return index === active ? [] : [[String(index > active ? index - 1 : index) + match[2], value]];
      }));
      const nextHtml = Object.fromEntries(Object.entries(richHtml).flatMap(([key, value]) => {
        const match = /^(mcqc-(?:question|opt|feedback|explanation|hint)-)(\d+)(.*)$/.exec(key); if (!match) return [[key, value]];
        const index = Number(match[2]); return index === active ? [] : [[match[1] + (index > active ? index - 1 : index) + match[3], value]];
      }));
      try {
        assessmentStorage.setItem("mcqAssessmentDraft", JSON.stringify({...details, questionCount: String(newCount), totalMarks: String(total)}));
        assessmentStorage.setItem("mcqQuestionCount", String(newCount));
        assessmentStorage.setItem("mcqContentDraft", JSON.stringify({...content, questions: nextQuestions, optionDetails: nextDetails, tags, richHtml: nextHtml, savedAt: new Date().toISOString()}));
        updateAssessment({questions: newCount, marks: total});
      } catch (error) {
        for (const [key, value] of [["mcqAssessmentDraft", detailsRaw], ["mcqQuestionCount", countRaw], ["mcqContentDraft", contentRaw]] as const) {
          try { if (value === null) assessmentStorage.removeItem(key); else assessmentStorage.setItem(key, value); } catch { /* Keep the original error visible. */ }
        }
        throw error;
      }
      setQuestions(nextQuestions); setOptionDetails(nextDetails); setRichHtml(nextHtml);
      setMcqValues(previous => ({...previous, questionCount: newCount, totalMarks: total}));
      setActive(Math.min(active, newCount - 1)); setExpandedOptions([]); setExpandedDetail(null); setNotice("");
    } catch { setNotice("Could not remove the question. Please try again."); }
  };
  const [builderReady,setBuilderReady]=useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(assessmentStorage.getItem("mcqContentDraft") || "{}");
      if (saved.richHtml && typeof saved.richHtml === "object") setRichHtml(saved.richHtml);
      if (saved.optionDetails && typeof saved.optionDetails === "object") setOptionDetails(saved.optionDetails);
      if (Array.isArray(saved.tags))setTags(saved.tags);
    } catch { /* Existing unsaved editor content stays available. */ }
    const frame=window.requestAnimationFrame(()=>setBuilderReady(true));
    return ()=>window.cancelAnimationFrame(frame);
  }, []);
  useEffect(()=>{
    if (!builderReady) return;
    try {assessmentStorage.setItem("mcqContentDraft",JSON.stringify({questions,optionDetails,tags,richHtml,savedAt:new Date().toISOString()}));} catch {}
  },[builderReady,questions,optionDetails,tags,richHtml]);
  const richEditor = (fieldId: string, value: string, onChange: (next: string) => void, placeholder: string) =>
    <MCQRichEditor key={fieldId} editorId={fieldId} value={value} html={richHtml[fieldId]}
      onChange={onChange} onHtmlChange={(html) => setRichHtml(previous => ({ ...previous, [fieldId]: html }))}
      placeholder={placeholder} onError={setNotice} />;
  const detailEditor = (index: number, field: "feedback" | "explanation" | "hint") => {
    const id = `mcqc-${field}-${active}-${index}`;
    return <div className="mcqcOptionEditor">{richEditor(id, getDetail(index)[field], text => setDetail(index, { [field]: text }), `Write ${field} here...`)}</div>;
  };

  if (previewing) return <QuestionsPreview questions={questions} details={optionDetails} tags={tags} mcqValues={mcqValues} saving={isSaving} onContinue={saveAndContinue} onBack={()=>setPreviewing(false)} onEdit={(index)=>{setActive(index);setPreviewing(false);setExpandedOptions([0]);}}/>;
  return <div className="mcqcBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" /><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg" /><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30} /><div><h2>Let's Get Started! Antony?</h2><p>Let's Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading"><div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div><div className="mcqcAddMenu" onPointerLeave={event => { if (event.pointerType !== "mouse") return; const element = event.currentTarget; window.setTimeout(() => { if (!element.matches(":hover")) setAddOpen(false); }, 300); }}><button type="button" className="mcqcTopAdd" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}><Icon name="plus.svg" size={20} />Add</button>{addOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div></div>
      <div className={`mcqcNumberNavigation ${mcqValues.questionCount <= 7 ? "mcqcFewQuestions" : "mcqcManyQuestions"}`}><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active === 0} onClick={() => setActive(n => Math.max(0,n-1))}><Icon name="arrowleft.svg" size={20}/></button><div className="mcqcNumberScroller"><div ref={numberScrollRef} onScroll={syncNumberScroll} className="mcqcQuestionNumbers" aria-label="Question numbers">{Array.from({ length: mcqValues.questionCount }, (_, index) => { const q = questions[index]; const status = q && complete(q) ? "is-complete" : index === active ? "is-active" : "is-empty"; return <button type="button" key={index} className={`mcqcQuestionNumber ${status}`} aria-label={`Question ${index+1}`} aria-current={active===index?"step":undefined} onClick={() => { setActive(index); setExpandedOptions([]); setExpandedDetail(null); }}><span className="mcqcNumberValue">{index+1}</span><span className={`mcqcNumberStatus ${status === "is-complete" ? "is-done" : "is-pending"}`} aria-hidden="true">{status === "is-complete" ? "✓" : ""}</span>{q && q.typeSelected === true && q.type && <small>{q.type === "MCQ" ? "MCQ" : q.type === "True / False" ? "T/F" : q.type.slice(0,2).toUpperCase()}</small>}</button>; })}</div><div className="mcqcNumberShortTrack" aria-hidden="true"><span className="mcqcNumberShortThumb" style={{ left: `calc((100% - var(--mcqc-scroll-thumb, min(67px, 26%))) * ${numberScrollProgress})` }} /></div></div><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active >= mcqValues.questionCount - 1} onClick={() => { if (active + 1 < mcqValues.questionCount) setActive(n=>n+1); setExpandedOptions([]); setExpandedDetail(null); }}><Icon name="arrowright.svg" size={20}/></button></div>
      <button type="button" className="mcqcRemoveQuestion" disabled={mcqValues.questionCount <= 1} title={mcqValues.questionCount <= 1 ? "At least one question is required" : "Remove this question"} onClick={removeQuestion}>Remove Question</button>
      <div className="mcqcQuestionProgress"><span style={{ width: `${Math.min(100,Math.max(4,currentDone / mcqValues.questionCount*100))}%` }}/></div>
      <div className="mcqcQuestionForm"><div className="mcqcBuilderField"><label>Question Type</label><div className="mcqcSelectRoot mcqcTypeRoot"><button type="button" className="mcqcSelectTrigger" aria-label="Question Type" disabled><span>MCQ</span></button></div></div>
        <div className="mcqcBuilderField mcqcWriteField"><label htmlFor="mcqcQuestionText">Write Your Question </label><div className="mcqcEditorSurface">{richEditor(`mcqc-question-${active}`, item.text, text => update({ text }), "Write your question here...")}</div></div>
        <div className="mcqcBuilderField"><label>Available Options</label><div className="mcqcAnswerOptions">{item.options.map((option,index) => { const open = expandedOptions.includes(index); const detail = getDetail(index); return <div className="mcqcAnswerSection" key={index}><button type="button" className="mcqcAnswerExpand" aria-expanded={open} onClick={() => { setExpandedOptions(open ? [] : [index]); setExpandedDetail(null); }}><span>Option {String.fromCharCode(65+index)}</span><Icon name="arrow-down-01.svg" size={21} className={open ? "mcqcRotated" : ""}/></button>{open && <div className="mcqcAnswerContent"><div className="mcqcOptionSubLabel"><span>Text</span></div><div className="mcqcOptionEditor">{richEditor(`mcqc-opt-${active}-${index}`, option, text => setOption(index, text), `Enter option ${String.fromCharCode(65+index)}`)}</div><label className="mcqcCorrectOption"><input type="checkbox" checked={item.correct===index} onChange={()=>update({correct:item.correct===index?-1:index})}/>Correct Answers</label>{(["feedback","explanation","hint"] as const).map(field => { const sectionId = `${index}-${field}`; const sectionOpen = expandedDetail===sectionId; return <div className="mcqcOptionDetail" key={field}><button type="button" className="mcqcOptionDetailHead" aria-expanded={sectionOpen} onClick={()=>setExpandedDetail(sectionOpen?null:sectionId)}><span className="mcqcDetailHeading"><Icon name={field==="feedback"?"message-circle-more.svg":field==="explanation"?"assignments.svg":"idea.svg"} size={18}/>{field[0].toUpperCase()+field.slice(1)}</span><Icon name="arrow-down-01.svg" size={18} className={sectionOpen?"mcqcRotated":""}/></button>{sectionOpen && <div className="mcqcOptionDetailBody">{detailEditor(index,field)}{field==="hint" && <div className="mcqcHintChecks"><label><input type="checkbox" checked={detail.showHint} onChange={e=>setDetail(index,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={detail.allowHint} onChange={e=>setDetail(index,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>; })}{item.options.length>2 && <button type="button" className="mcqcRemoveOption" onClick={()=>{ update({options:item.options.filter((_,i)=>i!==index),correct:item.correct===index?-1:item.correct>index?item.correct-1:item.correct});setExpandedOptions([]);setExpandedDetail(null); }}>Remove Option</button>}</div>}</div>; })}</div><button type="button" className="mcqcAddOptions" onClick={()=>{update({options:[...item.options,""]});setExpandedOptions([item.options.length]);setExpandedDetail(null);}}><Icon name="plus.svg" size={20}/>Add Options</button></div>
      </div><div className="mcqcBuilderBottom"><div className="mcqcAddMenu mcqcBottomAddMenu" onPointerLeave={event => { if (event.pointerType !== "mouse") return; const element = event.currentTarget; window.setTimeout(() => { if (!element.matches(":hover")) setBottomAddOpen(false); }, 300); }}><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" onClick={() => { setBottomAddOpen(v => !v); setAddOpen(false); }} aria-expanded={bottomAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={21}/>Add Questions</button>{bottomAddOpen && <div className="mcqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`mcqcOptionRadio ${index === 0 ? "mcqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div><div className="mcqcBuilderArrows"><button type="button" className="mcqcRoundNav" aria-label="Previous" onClick={() => setActive(n=>Math.max(0,n-1))}><Icon name="arrowleft.svg"/></button><button type="button" className="mcqcRoundNav" aria-label="Next" onClick={() => { if(active+1<mcqValues.questionCount)setActive(n=>n+1); }}><Icon name="arrowright.svg"/></button></div></div>
    </section><aside className="mcqcBuilderAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="mcqcPoints">Points</label><div className="mcqcPointsControl"><input id="mcqcPoints" type="number" min="0" step="1" value={item.points} onChange={e=>update({points:e.target.value})}/><div className="mcqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(item.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="mcqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(item.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div><div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={item.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={item.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div><div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" aria-label="New tag" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div>{tags.length > 0 && <div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(v=>v!==tag))}>{tag} <span>×</span></button>)}</div>}</div><div className="mcqcMandatory"><span>Mandatory</span><button type="button" className={`mcqcSwitch ${item.mandatory ? 'mcqcSwitchOn' : ''}`} role="switch" aria-label="Mandatory Question" aria-checked={item.mandatory} onClick={()=>update({mandatory:!item.mandatory})}><span className="mcqcSwitchText">{item.mandatory?'ON':'OFF'}</span><span className="mcqcSwitchKnob"/></button></div><p className="mcqcAsideHint">This Question is Mandatory</p></section><section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{currentDone}/{mcqValues.questionCount}</strong><span>Questions</span></div><div><strong>{questions.reduce((n,q)=>n+(complete(q)?Number(q.points)||0:0),0)}</strong><span>Marks</span></div><div><strong>60</strong><span>Minutes</span></div></div><p>Marks per Question: {mcqValues.marksPerQuestion}</p><div className="mcqcSummaryProgress"><span style={{width:`${Math.min(100,currentDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. Add questions to get started.</p><div className="mcqcBuilderField"><label>Passing Score</label><NeumoSelect value="60%" options={["40%","50%","60%","70%","80%","90%"]} onChange={()=>{}}/></div></section></aside></div>
    {notice && <p className={`mcqcBuilderNotice ${validationFailed ? "mcqcValidationError" : ""}`} role={validationFailed ? "alert" : "status"}>{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="mcqcFooterPill" onClick={()=>{setNotice("");setPreviewing(true);}}>Preview Questions</button><div className="mcqcSaveContinueGroup">{saveSuccess && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
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
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    try {
      const stored = assessmentStorage.getItem("mcqAssessmentDraft");
      const draft = stored ? JSON.parse(stored) : {};
      const questionCount = positiveInteger(draft.questionCount ?? assessmentStorage.getItem("mcqQuestionCount"), 20);
      const totalMarks = nonnegativeNumber(draft.totalMarks, 20);
      const marksPerQuestion = nonnegativeNumber(draft.marksPerQuestion, 1);
      setMcqValues({ questionCount, totalMarks, marksPerQuestion });
      const savedContent=JSON.parse(assessmentStorage.getItem("mcqContentDraft")||"{}");
      setQuestions(old => Array.from({ length: questionCount }, (_, index) => savedContent.questions?.[index] ?? old[index] ?? { ...newQuestion(), points: String(marksPerQuestion) }));
    } catch { setQuestions(old => Array.from({ length: 20 }, (_, index) => old[index] ?? newQuestion())); }
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reviewEdit") !== "questions") return;
    try {
      const saved = assessmentStorage.getItem("mcqContentDraft");
      const parsed = saved ? JSON.parse(saved) as { questions?: Question[] } : null;
      if (Array.isArray(parsed?.questions) && parsed.questions.length) {
        setQuestions(parsed.questions);
      }
    } catch { /* Retain existing questions if the saved draft is unavailable. */ }
    setBuilding(true);
  }, []);
  const action = (name: string) => name === "Create Questions" ? setBuilding(true) : setMessage(`${name} will be available when question creation is connected.`);

  return (
    <main className="mcqcAppShell">
      <div className="mcqcLayout">
        <Sidebar />
        <section className="mcqcMainContent">
          <div className="mcqcHeader"><Header /></div>
          <div className="mcqcScrollArea">
            {building ? <div className="mcqcPageContent"><QuestionBuilder questions={questions} setQuestions={setQuestions} mcqValues={mcqValues} setMcqValues={setMcqValues} onExit={() => onExitBuilder ? onExitBuilder() : setBuilding(false)} /></div> : <div className="mcqcPageContent">
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
              <header className="mcqcPageTitle"><h1>Assessment Content (MCQ)</h1><p>Add Questions To Your Assessment.</p></header>
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
              {message && <p className="mcqcMessage" role="status">{message}</p>}
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
