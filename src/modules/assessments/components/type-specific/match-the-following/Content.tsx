"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import "./match.css";
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`mcqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}
// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"];
const MCQC_SIZES = ["12", "14", "16", "18", "24"];
const MCQC_SYMBOLS = ["©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "∞", "π", "√", "∑", "α", "β", "γ", "Δ", "€", "£", "₹", "→", "←", "•", "✓", "★", "¼", "½", "¾", "§", "¶", "…", "—", "“", "”", "’"];
function MCQRichEditor({ editorId, value, html, onChange, onHtmlChange, placeholder, onError, maxChars, maxWords }: {
  editorId: string; value: string; html?: string; onChange: (text: string) => void;
  onHtmlChange: (html: string) => void; placeholder: string; onError: (message: string) => void; maxChars?: number; maxWords?: number;
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
  const allowedText = (text: string) => {
    const el = editor.current;
    if (!el || maxChars === undefined) return text;
    const selection = window.getSelection();
    const selected = selection?.anchorNode && selection.focusNode && el.contains(selection.anchorNode) && el.contains(selection.focusNode) ? selection.toString().length : 0;
    const current = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").length;
    return text.slice(0, Math.max(0, maxChars - current + selected));
  };
  const notify = () => {
    const el = editor.current;
    if (!el) return;
    let plain = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ");
    let clipped = plain;
    if (maxChars !== undefined && clipped.length > maxChars && clipped.length > value.length) {
      el.innerHTML = lastHtml.current ?? "";
      const range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      onError(`This field allows a maximum of ${maxChars} characters.`);
      return;
    }
    if (maxWords !== undefined) {
      const words = clipped.match(/\S+/g) ?? [];
      if (words.length > maxWords) {
        const parts = [...clipped.matchAll(/\S+/g)];
        clipped = clipped.slice(0, (parts[maxWords - 1]?.index ?? 0) + parts[maxWords - 1][0].length);
        onError(`This field allows a maximum of ${maxWords} words.`);
      }
    }
    if (clipped !== plain) {
      el.textContent = clipped;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      plain = clipped;
    }
    lastHtml.current = el.innerHTML;
    onHtmlChange(el.innerHTML);
    onChange(plain);
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
      {button("text-centerline-center-top.svg", "Bulleted list", () => command("insertUnorderedList"))}
      {button("image.svg", "Insert image", () => { setFileKind("image"); if (fileInput.current) { fileInput.current.accept="image/*"; fileInput.current.value=""; fileInput.current.click(); } })}
      {button("attachment.svg", "Attach file", () => { setFileKind("attachment"); if (fileInput.current) { fileInput.current.accept=""; fileInput.current.value=""; fileInput.current.click(); } })}
    </div>
    {menu && typeof document !== "undefined" && createPortal(
      <div ref={floatingMenu} className={`mcqcFloatingFormatMenu ${menu === "symbols" ? "mcqcFloatingSymbols" : ""}`}
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
      className="mcqcRichEditable" onInput={notify} onBeforeInput={e => { const input = e.nativeEvent as InputEvent; if (input.data && allowedText(input.data) !== input.data) e.preventDefault(); }} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={e => { e.preventDefault(); const text=allowedText(e.clipboardData.getData("text/plain")); if (text) document.execCommand("insertText", false, text); notify(); }}/>
    {maxChars !== undefined && <small className="assessmentEditorCounter" aria-live="polite">{Array.from(value).length}/{maxChars}</small>}
  </div>;
}

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
  const [expanded, setExpanded] = useState<string[]>(["Interactive Assessments"]);
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
  return <div className="mcqcSelectRoot mcqcTypeRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="mcqcSelectTrigger" aria-label="Question Type" disabled aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? "mcqcQuestionTypeList" : undefined} onClick={() => setOpen(previous => !previous)}>
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
  return <div className="mcqcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="mcqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="mcqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="mcqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}>{value === option ? <SelectedCheck/> : <span className="mcqcOptionRadio"/>}<span>{option}</span></button>)}</div>}</div>;
}


// Figma's raised 24px checked circle. The SVG is supplied by the assessmenticons folder.
function SelectedCheck() {
  return <span className="mcqcDDSelectedCheck" aria-hidden="true"><Icon name="checkmark-circle-02.svg" size={16}/></span>;
}

function PassingScoreSelect({value,onChange}:{value:string;onChange:(score:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [position,setPosition]=useState({top:0,left:0,width:200,maxHeight:160});
  const trigger=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const positionMenu=()=>{
    const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
    const viewportWidth=document.documentElement.clientWidth;
    const viewportHeight=window.innerHeight;
    const width=Math.min(rect.width,viewportWidth-16);
    const left=Math.max(8,Math.min(rect.left,viewportWidth-width-8));
    const below=viewportHeight-rect.bottom-8;
    const above=rect.top-8;
    const upward=below<120&&above>below;
    const available=upward?above:below;
    const maxHeight=Math.min(160,Math.max(52,available));
    const top=upward?Math.max(8,rect.top-maxHeight-5):Math.max(8,Math.min(rect.bottom+5,viewportHeight-maxHeight-8));
    setPosition({top,left,width,maxHeight});
  };
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{const target=event.target as Node;if(!trigger.current?.contains(target)&&!menu.current?.contains(target))setOpen(false);};
    const keyboard=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);trigger.current?.focus();}};
    const scroll=(event:Event)=>{if(event.target instanceof Node&&menu.current?.contains(event.target))return;positionMenu();};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",keyboard);
    window.addEventListener("scroll",scroll,true);
    window.addEventListener("resize",scroll);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);window.removeEventListener("scroll",scroll,true);window.removeEventListener("resize",scroll);};
  },[open]);
  return <span className="mcqcMatchPassingScore">
    <button ref={trigger} type="button" className="mcqcPassingScoreTrigger" aria-label="Passing Score" aria-haspopup="listbox" aria-expanded={open} onClick={()=>{if(open){setOpen(false);return;}positionMenu();setOpen(true);}}><span>{value}</span><Icon name="arrow-down-01.svg" size={17} className={open?"mcqcRotated":""}/></button>
    {open&&typeof document!=="undefined"&&createPortal(<div ref={menu} className="mcqcPassingScoreMenu" role="listbox" aria-label="Passing Score percentages" style={{top:position.top,left:position.left,width:position.width,maxHeight:position.maxHeight}}>
      {PASSING_SCORE_OPTIONS.map(score=><button key={score} type="button" role="option" aria-selected={score===value} className={`mcqcPassingScoreOption ${score===value?"is-selected":""}`} onClick={()=>{onChange(score);setOpen(false);}}><span className={`mcqcPassingScoreRadio ${score===value?"is-selected":""}`} aria-hidden="true"/><span>{score}</span></button>)}
    </div>,document.body)}
  </span>;
}

function Switch({ checked, onChange, label }: { checked:boolean; onChange:(value:boolean)=>void; label:string }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`mcqcSwitch ${checked ? "mcqcSwitchOn" : ""}`} onClick={()=>onChange(!checked)}>
    <span className="mcqcSwitchText">{checked ? "ON" : "OFF"}</span>
    <span className="mcqcSwitchKnob" aria-hidden="true"/>
  </button>;
}
function DragPanel({ title, icon, open, onToggle, children, subtitle }: {
  title:string; icon:string; open:boolean; onToggle:()=>void; children: React.ReactNode; subtitle?:string;
}) {
  return <section className={`mcqcDDPanel ${open ? "is-open" : ""}`}>
    <button type="button" className="mcqcAnswerExpand mcqcDDPanelHead" aria-expanded={open} aria-label={`${title}: ${open ? "collapse" : "expand"}`} onClick={onToggle}>
      <span className="mcqcDDPanelHeading"><span className="mcqcDDPanelIcon"><Icon name={icon} size={19}/></span><strong>{title}</strong></span>
      {subtitle && !/^\d+\s*\/\s*\d+/.test(subtitle) && <small className="mcqcDDPanelCount">{subtitle}</small>}
      <Icon name="arrow-down-01.svg" size={20} className={open ? "mcqcRotated" : ""}/>
    </button>
    {open && <div className="mcqcDDPanelBody">{children}</div>}
  </section>;
}

// Match the Following question data; kept compatible with the learner viewer.
type MatchPair = { id: string; term: string; description: string; marks: string };
type MatchQuestion = {
  type: string; text: string; points: string; difficulty: string; category: string; bloom: string;
  mandatory: boolean; columnA: string; columnB: string; answerStyle: string; shuffle: boolean;
  pairs: MatchPair[]; extras: string[]; extraEnabled: boolean;
  grading: "Equal Marks" | "Custom"; negative: string; partialCredit: boolean;
  minZero: boolean; allowMove: boolean; scoreOverrides: Record<string,string>;
  feedbackFull: string; feedbackPartial: string; feedbackZero: string;
  explanation: string; hint: string; showHint: boolean; allowHint: boolean;
};
type AssessmentValues = { totalMarks:number; questionCount:number; marksPerQuestion:number; duration:number; passingScore:string };
const DEFAULT_VALUES: AssessmentValues = { totalMarks:20, questionCount:20, marksPerQuestion:1, duration:60, passingScore:"60%" };
const PASSING_SCORE_OPTIONS = Array.from({length:10},(_,i)=>`${(i+1)*10}%`);
const normalizePassingScore = (value:unknown) => { const n=Number.parseFloat(String(value??"60%")); return `${Math.min(100,Math.max(10,Math.round((Number.isFinite(n)?n:60)/10)*10))}%`; };
const CATEGORIES = ["AI", "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Data Science", "Cybersecurity", "Cloud Computing", "Programming", "Database", "Web Development", "Software Engineering", "Computer Networks", "Operating Systems", "Data Structures & Algorithms", "Mathematics", "Statistics", "Other"];
const BLOOMS = ["Remember", "Create", "Evaluate", "Analyse", "Apply", "Understand"];
const CONTENT_KEY = "matchFollowingContentDraft";
const DETAILS_KEYS = ["mcqAssessmentDraft", "matchFollowingAssessmentDraft", "matchTheFollowingAssessmentDraft", "matchfollowingAssessmentDraft", "matchAssessmentDraft", "matchingAssessmentDraft", "assessmentDetailsDraft", "assessmentDraft", "dragDropAssessmentDraft"];
const countNumber = (value:unknown, fallback:number) => { const n=Number(value); return value!==null&&value!==undefined&&value!==""&&Number.isFinite(n)&&n>=1?Math.floor(n):fallback; };
const nonnegativeNumber = (value:unknown, fallback:number) => { const n=Number(value); return value!==null&&value!==undefined&&value!==""&&Number.isFinite(n)&&n>=0?n:fallback; };
const pairId = () => `pair-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newPair = ():MatchPair => ({id:pairId(),term:"",description:"",marks:""});
const newQuestion = (points=1):MatchQuestion => ({
  type:"Match the Following",text:"",points:String(points),difficulty:"",category:"",bloom:"",mandatory:true,
  columnA:"Term",columnB:"Description",answerStyle:"Dropdown",shuffle:true,
  pairs:Array.from({length:4},newPair),extras:[],extraEnabled:true,
  grading:"Equal Marks",negative:"NA",partialCredit:true,minZero:true,allowMove:true,scoreOverrides:{},
  feedbackFull:"",feedbackPartial:"",feedbackZero:"",explanation:"",hint:"",showHint:false,allowHint:false
});
const choiceLabel = (index:number):string => { let n=index+1; let result=""; while(n){n--;result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26);}return result; };
const displayedMarks = (n:number) => Number.isInteger(n)&&n>0&&n<10?String(n).padStart(2,"0"):String(Number(n.toFixed(2)));
const normalizeQuestion = (raw:unknown, points:number):MatchQuestion => {
  const r=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const fallback=newQuestion(points);
  const savedPairs=Array.isArray(r.pairs)?r.pairs:[];
  const pairs=savedPairs.length ? savedPairs.map((item,i)=>{
    const p=item&&typeof item==="object"&&!Array.isArray(item)?item as Record<string,unknown>:{};
    return {id:String(p.id||`pair-${i}`),term:String(p.term??p.left??""),description:String(p.description??p.right??""),marks:String(p.marks??"")};
  }) : fallback.pairs;
  return {...fallback,...r,type:"Match the Following",pairs,
    extras:Array.isArray(r.extras)?r.extras.map(x=>String(x??"")):(Array.isArray(r.distractors)?r.distractors.map(x=>String(x??"")):[]),
    scoreOverrides:r.scoreOverrides&&typeof r.scoreOverrides==="object"&&!Array.isArray(r.scoreOverrides)?r.scoreOverrides as Record<string,string>:{}
  } as MatchQuestion;
};
const wordCount = (text:string) => (text.trim().match(/\S+/g) ?? []).length;
const hasAnyData = (q:MatchQuestion) => Boolean(q.text.trim() || q.pairs.some(p=>p.term.trim()||p.description.trim())||q.extras.some(x=>x.trim()));
const matchErrors = (q:MatchQuestion):string[] => {
  const errors:string[]=[];
  if(!q.text.trim()) errors.push("Write your question.");
  if(!q.columnA.trim() || !q.columnB.trim() || !q.answerStyle.trim()) errors.push("Select both column headings and an answer style.");
  if(q.text.trim().length>250) errors.push("Question must be at most 250 characters.");
  if(q.pairs.length<2) errors.push("Add at least two matching pairs.");
  if(q.pairs.some(p=>!p.term.trim()||!p.description.trim())) errors.push("Enter both the term and description for every matching pair.");
  if(q.pairs.some(p=>p.term.length>250||p.description.length>250)||q.extras.some(x=>x.length>250)) errors.push("Each term, description and extra answer must be at most 250 characters.");
  if(new Set(q.pairs.map(p=>p.term.trim().toLowerCase())).size!==q.pairs.length) errors.push("Term names must be unique.");
  if(new Set(q.pairs.map(p=>p.description.trim().toLowerCase())).size!==q.pairs.length) errors.push("Each matching description must be unique.");
  if(q.extraEnabled&&q.extras.some(x=>!x.trim())) errors.push("Complete or remove empty extra answers.");
  if(q.extraEnabled&&q.extras.some(x=>q.pairs.some(p=>p.description.trim().toLowerCase()===x.trim().toLowerCase()))) errors.push("Extra answers must not duplicate correct descriptions.");
  if(q.extraEnabled&&new Set(q.extras.map(x=>x.trim().toLowerCase())).size!==q.extras.length) errors.push("Extra answers must not duplicate one another.");
  for(const key of ["feedbackFull","feedbackPartial","feedbackZero"] as const){
    if(!q[key].trim()) errors.push(`Complete ${key==="feedbackFull"?"Full Marks":key==="feedbackPartial"?"Partial Marks":"Zero Marks"} feedback.`);
    if(q[key].length>250) errors.push("Each feedback field is limited to 250 characters.");
  }
  if(!q.explanation.trim()) errors.push("Enter an explanation for the matching question.");
  if(q.explanation.length>250) errors.push("Explanation must be 250 characters or fewer.");
  if(q.hint.length>250) errors.push("Hint must be 250 characters or fewer.");
  if((q.showHint||q.allowHint)&&!q.hint.trim()) errors.push("Write the hint before enabling it for learners.");
  if(!(Number(q.points)>0)||!Number.isFinite(Number(q.points))) errors.push("Points must be a valid number greater than zero.");
  if(q.negative!=="NA"&&(!Number.isFinite(Number(q.negative))||Number(q.negative)<0)) errors.push("Choose valid negative marking.");
  if(!q.difficulty||!q.category||!q.bloom) errors.push("Select difficulty, category and Bloom’s Taxonomy.");
  if(q.grading==="Custom"){
    const marks=q.pairs.map(p=>Number(p.marks));
    if(q.pairs.some(p=>p.marks.trim()==="")||marks.some(n=>!Number.isFinite(n)||n<0)) errors.push("Enter valid custom marks for every pair.");
    else if(Math.abs(marks.reduce((sum,n)=>sum+n,0)-Number(q.points))>.00001) errors.push("Total pair marks must equal Points.");
  }
  if(Object.entries(q.scoreOverrides).some(([n,v])=>!Number.isInteger(Number(n))||Number(n)<0||Number(n)>q.pairs.length||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>Number(q.points))) errors.push("Simulator marks must be between 0 and the question points.");
  return errors;
};
const isComplete=(q:MatchQuestion)=>matchErrors(q).length===0;
const marksFor=(q:MatchQuestion, index:number)=>q.grading==="Custom"?Number(q.pairs[index]?.marks||0):Number(q.points)/Math.max(1,q.pairs.length);
const scoreFor=(q:MatchQuestion, n:number)=>{
  const override=q.scoreOverrides[String(n)];
  if(override!==undefined&&override!==""&&Number.isFinite(Number(override))) return Number(override);
  const count=q.pairs.length;
  const partial=q.partialCredit ? q.pairs.slice(0,n).reduce((s,_,i)=>s+marksFor(q,i),0): n===count?Number(q.points):0;
  const penalty=q.negative==="NA"?0:Number(q.negative)||0;
  const result=partial-(count-n)*penalty;
  return q.minZero?Math.max(0,result):result;
};
function loadDetails():AssessmentValues{
  const read=(key:string)=>{try{return JSON.parse(assessmentStorage.getItem(key)||"null");}catch{return null;}};
  let draft:Record<string,unknown>={};
  for(const key of DETAILS_KEYS){const d=read(key);if(d&&typeof d==="object"&&!Array.isArray(d)){
    const raw=d as Record<string,unknown>; const inner=raw.details&&typeof raw.details==="object"?raw.details as Record<string,unknown>:{};
    const settings=raw.settings&&typeof raw.settings==="object"?raw.settings as Record<string,unknown>:{};
    const candidate={...raw,...settings,...inner};
    if(["questionCount","totalQuestions","numberOfQuestions","noOfQuestions","totalNoOfQuestions","assessmentQuestionCount","questionsCount"].some(key=>candidate[key]!==undefined)){draft=candidate;break;}
  }}
  const questionCount=countNumber(draft.questionCount??draft.numberOfQuestions??draft.totalQuestions??draft.noOfQuestions??draft.totalNoOfQuestions??draft.assessmentQuestionCount??draft.questionsCount??assessmentStorage.getItem("matchFollowingQuestionCount"),DEFAULT_VALUES.questionCount);
  const totalMarks=nonnegativeNumber(draft.totalMarks??draft.maximumMarks??draft.maxMarks,DEFAULT_VALUES.totalMarks);
  return {questionCount,totalMarks,marksPerQuestion:nonnegativeNumber(draft.marksPerQuestion??(totalMarks/questionCount),DEFAULT_VALUES.marksPerQuestion),duration:nonnegativeNumber(draft.duration??draft.durationMinutes??draft.timeLimit,60),passingScore:normalizePassingScore(assessmentStorage.getItem("matchFollowingPassingScore")||draft.passingScore||"60%")};
}
function saveContent(questions:MatchQuestion[], tags:string[],richHtml:Record<string,string>,details:AssessmentValues){
  const data={type:"Match the Following",passingScore:details.passingScore,questions:questions.slice(0,details.questionCount).map(q=>({
    ...q,
    pairs:q.pairs.map(p=>({id:p.id,term:p.term,description:p.description,marks:p.marks})),
    distractors:q.extraEnabled?q.extras.filter(x=>x.trim()):[],
    options:[...q.pairs.map(p=>p.description),...(q.extraEnabled?q.extras.filter(Boolean):[])],
    correctAnswers:q.pairs.map((_,i)=>i),
  })),tags,richHtml,questionCount:details.questionCount,savedAt:new Date().toISOString()};
  assessmentStorage.setItem(CONTENT_KEY,JSON.stringify(data));
  
  
  return data;
}
function PreviewSectionIcon({ name }: {name:string}) {
  return <span className="mcqcMatchPreviewHeadIcon"><Icon name={name} size={19}/></span>;
}
function MatchPreview({questions,active,tags,readyAll,onBack,onEdit,onContinue,saving}:{
  questions:MatchQuestion[]; active:number;tags:string[];readyAll:boolean;onBack:()=>void;onEdit:(index:number)=>void;onContinue:()=>void;saving:boolean;
}){
  const [filter,setFilter]=useState("All Questions");
  const [learner,setLearner]=useState(false);
  const [expanded,setExpanded]=useState({pairs:true,grading:true,feedback:true,settings:true});
  const [learnerAnswers,setLearnerAnswers]=useState<Record<number,Record<number,string>>>({});
  const questionList=questions.map((q,index)=>({q,index})).filter(({q})=>hasAnyData(q));
  const filtered=questionList.filter(({q})=>filter==="All Questions"||(filter==="Complete"?isComplete(q):!isComplete(q)));
  const entry=filtered.find(({index})=>index===active)??filtered[0];
  const q=entry?.q;
  const index=entry?.index??0;
  const responses=learnerAnswers[index]??{};
  const toggle=(name:keyof typeof expanded)=>setExpanded(s=>({...s,[name]:!s[name]}));
  const options=useMemo(()=>q?[...q.pairs.map(p=>p.description),...(q.extraEnabled?q.extras.filter(Boolean):[])]:[],[q]);
  const updateResponse=(row:number,value:string)=>{
    setLearnerAnswers(old=>{const next={...(old[index]??{})};Object.entries(next).forEach(([k,v])=>{if(Number(k)!==row&&v===value&&value)delete next[Number(k)];});next[row]=value;return {...old,[index]:next};});
  };
  return <div className="mcqcPreview mcqcMatchPreview">
    <nav className="mcqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="mcqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="mcqcPreviewControls"><div className="mcqcPreviewTotals">
        <div><strong>{questionList.length}</strong><span>Questions</span></div><div><strong>{questionList.reduce((sum,item)=>sum+(Number(item.q.points)||0),0)}</strong><span>Marks</span></div>
        <div className="mcqcPreviewReady"><Icon name={readyAll?"checkmark-square-02.svg":"alerto.svg"} size={18}/><span><strong>{readyAll?"Ready":"In Progress"}</strong><small>{readyAll?"All good to continue":"Review incomplete questions"}</small></span></div></div>
        <div className="mcqcPreviewTools"><select className="mcqcMatchPreviewFilter" aria-label="Filter questions" value={filter} onChange={e=>setFilter(e.target.value)}><option>All Questions</option><option>Complete</option><option>Incomplete</option></select><button type="button" className="mcqcPreviewLearner" onClick={()=>setLearner(v=>!v)}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div>
      </div>
      {q?<article className="mcqcPreviewQuestion" key={index}>
        <div className="mcqcPreviewMeta"><span>Match the Following: {q.points} Points</span><span>Status: <b className={isComplete(q)?"mcqcGreen":"mcqcOrange"}>{isComplete(q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(index)}><Icon name="edit.svg" size={16}/>Edit</button></div>
        <div className="mcqcPreviewPanel"><h3>Question {index+1}</h3><p>{q.text||"Write your question."}</p></div>
        <div className="mcqcPreviewPanel mcqcMatchPreviewPairs">
          <button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.pairs} onClick={()=>toggle("pairs")}><span className="mcqcMatchPreviewTitle"><PreviewSectionIcon name="adjust-position.svg"/>Matching Pairs (Each row is one correct match)</span><Icon name="arrow-down-01.svg" size={18} className={expanded.pairs?"mcqcRotated":""}/></button>
          {expanded.pairs&&<div className="mcqcMatchPreviewPairsBody"><div className="mcqcMatchPreviewHeading"><span>{q.columnA||"Term"}</span><span>{q.columnB||"Description"}{!learner?" - Correct match":""}</span>{!learner&&<span>Marks</span>}</div>
            {q.pairs.map((pair,row)=><div className="mcqcMatchPreviewRow" key={pair.id}>
              <div className="mcqcMatchPreviewTerm">{choiceLabel(row)}. {pair.term||"—"}</div>
              {learner?<NeumoSelect value={responses[row]||""} placeholder="Choose..." options={options.filter(opt=>opt===responses[row]||!Object.values(responses).includes(opt))} onChange={v=>updateResponse(row,v)}/>:<div className="mcqcMatchPreviewCorrect">{pair.description||"Not entered"}<Icon name="checkmark-circle.svg" size={17}/></div>}
              {!learner&&<div className="mcqcMatchPreviewMarks">{displayedMarks(marksFor(q,row))}</div>}
            </div>)}
            {!learner&&q.extraEnabled&&<div className="mcqcMatchExtrasPreview"><strong>Extra Answers</strong>{q.extras.some(x=>x.trim())?q.extras.filter(Boolean).map((x,i)=><div key={i}>{x}<span>Distractor</span></div>):<div className="mcqcMatchExtraEmpty">No extra answers added</div>}</div>}
          </div>}
        </div>
        {!learner&&<>
          <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.grading} onClick={()=>toggle("grading")}><span className="mcqcMatchPreviewTitle"><PreviewSectionIcon name="assignments.svg"/>Grading Method</span><Icon name="arrow-down-01.svg" size={18} className={expanded.grading?"mcqcRotated":""}/></button>
            {expanded.grading&&<div className="mcqcDDGradingDetails"><div className="mcqcDDThree"><label>Grading Method<strong>{q.grading}</strong></label><label>Points (total for Question)<strong>{q.points}</strong></label><label>Negative Marking<strong>{q.negative}</strong></label></div>
              {([['Partial Credit',q.partialCredit],['Calculate grade with a minimum score of 0',q.minZero],['Allow learner to move items between zones before submit',q.allowMove]] as const).map(([label,value])=><div key={label} className="mcqcDDToggleRow"><span>{label}</span><span className={`mcqcDDPreviewSwitch ${value?'is-on':'is-off'}`}><span className="mcqcDDPreviewSwitchTrack"><span className="mcqcDDPreviewSwitchText">{value?'ON':'OFF'}</span></span></span></div>)}
              <div className="mcqcDDScoreCheck">Total of pair marks: {q.pairs.reduce((s,_,i)=>s+marksFor(q,i),0).toFixed(2)} / {q.points}<span className={Math.abs(q.pairs.reduce((s,_,i)=>s+marksFor(q,i),0)-Number(q.points))<.0001?"mcqcMatchPointsGood":"mcqcMatchPointsBad"}>{Math.abs(q.pairs.reduce((s,_,i)=>s+marksFor(q,i),0)-Number(q.points))<.0001?"Matches Points":"Check Points"}</span></div>
              <div className="mcqcDDPreviewScore"><h4>Score Simulator - Outcome per Pairs</h4><div className="mcqcDDScoreTable"><div className="mcqcDDScoreHead"><span>Outcome</span><span>Marks</span></div>{Array.from({length:q.pairs.length+1},(_,i)=>q.pairs.length-i).map(n=><div className="mcqcDDScoreRow" key={n}><span>{n} correct, {q.pairs.length-n} wrong</span><span className="mcqcDDPreviewScoreMark">{displayedMarks(scoreFor(q,n))}</span></div>)}</div></div>
            </div>}
          </div>
          <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.feedback} onClick={()=>toggle("feedback")}><span className="mcqcMatchPreviewTitle"><PreviewSectionIcon name="message-circle-more.svg"/>Feedback and Learning</span><Icon name="arrow-down-01.svg" size={18} className={expanded.feedback?"mcqcRotated":""}/></button>
            {expanded.feedback&&<div className="mcqcPreviewLearning mcqcMatchFeedbackPreview">{([['Full Marks',q.feedbackFull,'checkmark-circle.svg'],['Partial Marks',q.feedbackPartial,'alerto.svg'],['Zero Marks',q.feedbackZero,'cancel-circle.svg'],['Explanation',q.explanation,'assignments.svg'],['Hint',q.hint,'idea.svg']] as const).map(([heading,value,icon])=><section key={heading} className={`mcqcMatchLearningCard ${heading.toLowerCase().replace(/\s/g,"-")}`}><h4><PreviewSectionIcon name={icon}/>{heading}</h4><div className={`mcqcMatchLearningValue ${heading === "Explanation" || heading === "Hint" ? "mcqcMatchLearningText" : ""}`}>{value||'No content entered.'}</div></section>)}</div>}
          </div>
          <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.settings} onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={expanded.settings?"mcqcRotated":""}/></button>
            {expanded.settings&&<div className="mcqcPreviewSettings">{[["Difficulty",q.difficulty,"target.svg"],["Bloom’s Taxonomy",q.bloom||"Not selected","brain.svg"],["Category",q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",q.mandatory?"YES":"NO","circle-check.svg"]].map(([title,value,icon])=><div key={title}><span>{title}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}
          </div>
        </>}

      </article>:<p className="mcqcBuilderNotice">No questions in this filter. Return to Create Questions to add a matching question.</p>}
      <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" onClick={onBack}>Back to Question</button>{saving&&<span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</div>
    </div>
  </div>;
}
function QuestionBuilder({questions,setQuestions,mcqValues,onPassingScoreChange,onExit}:{questions:MatchQuestion[];setQuestions:React.Dispatch<React.SetStateAction<MatchQuestion[]>>;mcqValues:AssessmentValues;onPassingScoreChange:(score:string)=>void;onExit:()=>void}){
  const router=useRouter();
  const [active,setActive]=useState(0);
  const [previewing,setPreviewing]=useState(false);
  const [sections,setSections]=useState({question:false,pairs:false,grading:false,feedback:false});
  const [feedbackSubsections,setFeedbackSubsections]=useState({explanation:true,hint:true});
  const [showValidation,setShowValidation]=useState(false);
  const [tags,setTags]=useState<string[]>([]);
  const [tagInput,setTagInput]=useState("");
  const [addingTag,setAddingTag]=useState(false);
  const [richHtml,setRichHtml]=useState<Record<string,string>>({});
  const [draftReady,setDraftReady]=useState(false);
  const [extraDrafts,setExtraDrafts]=useState<Record<number,string>>({});
  const extraDraft=extraDrafts[active]??"";
  const setExtraDraft=(value:string)=>setExtraDrafts(previous=>({...previous,[active]:value}));
  const [notice,setNotice]=useState("");
  const [saveSuccess,setSaveSuccess]=useState(false);
  const [isSaving,setIsSaving]=useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);
  const [extraError,setExtraError]=useState("");
  const numberScrollRef=useRef<HTMLDivElement>(null);
  const question=questions[active]||newQuestion(mcqValues.marksPerQuestion);
  const questionDone=questions.slice(0,mcqValues.questionCount).filter(isComplete).length;
  const isReady=questions.length===mcqValues.questionCount&&questions.every(isComplete);
  const totalPairMarks=question.pairs.reduce((sum,_,i)=>sum+marksFor(question,i),0);
  const update=(patch:Partial<MatchQuestion>)=>setQuestions(old=>old.map((q,i)=>i===active?{...q,...patch}:q));
  const updatePair=(id:string,patch:Partial<MatchPair>)=>update({pairs:question.pairs.map(p=>p.id===id?{...p,...patch}:p),scoreOverrides:{}});
  const removePair=(id:string)=>{if(question.pairs.length<=2){setNotice("At least two matching pairs are required.");return;} update({pairs:question.pairs.filter(p=>p.id!==id),scoreOverrides:{}});};
  const addPair=()=>{if(question.pairs.length>=26){setNotice("Maximum 26 pairs per question.");return;}update({pairs:[...question.pairs,newPair()],scoreOverrides:{}});};
  const toggle=(name:keyof typeof sections)=>setSections(old=>({...old,[name]:!old[name]}));
  const jump=(index:number)=>{const n=Math.max(0,Math.min(mcqValues.questionCount-1,index));setActive(n);setNotice("");setExtraError("");
    const el=numberScrollRef.current;if(el){const tile=el.querySelectorAll<HTMLElement>(".mcqcQuestionNumber")[n];if(tile){const left=tile.offsetLeft-el.offsetLeft;const right=left+tile.offsetWidth;if(left<el.scrollLeft)el.scrollTo({left,behavior:"smooth"});else if(right>el.scrollLeft+el.clientWidth)el.scrollTo({left:right-el.clientWidth,behavior:"smooth"});}}};
  const scrollNumbers=(direction:number)=>numberScrollRef.current?.scrollBy({left:direction*340,behavior:"smooth"});
  const richEditor=(key:string,value:string,onChange:(v:string)=>void,placeholder:string,limits?:{maxChars?:number;maxWords?:number})=><MCQRichEditor key={key} editorId={key} value={value} html={richHtml[key]} onChange={onChange} onHtmlChange={html=>setRichHtml(old=>({...old,[key]:html}))} placeholder={placeholder} onError={setNotice} maxChars={limits?.maxChars} maxWords={limits?.maxWords}/>;
  const saveExtraAnswer=()=>{
    const value=extraDraft.trim();
    if(!value){setExtraError("Enter an extra answer before saving.");return;}
    if(value.length>250){setExtraError("Extra answer must have at most 250 characters.");return;}
    const all=[...question.pairs.map(p=>p.description.trim().toLowerCase()),...question.extras.map(x=>x.trim().toLowerCase())];
    if(all.includes(value.toLowerCase())){setExtraError("Extra answers must not repeat a description or another distractor.");return;}
    update({extras:[...question.extras,value]});
    setExtraDraft("");setExtraError("");
    setRichHtml(old=>{const next={...old};delete next[`mcqc-match-extra-${active}-${question.extras.length}`];return next;});
  };
  useEffect(()=>{
    try{const saved=JSON.parse(assessmentStorage.getItem(CONTENT_KEY)||"{}");if(Number.isInteger(saved.active))setActive(Math.max(0,Math.min(questions.length-1,saved.active)));if(saved.richHtml&&typeof saved.richHtml==="object")setRichHtml(saved.richHtml);if(Array.isArray(saved.tags))setTags(saved.tags.filter((v:unknown):v is string=>typeof v==="string"));}catch{/*Keep current values.*/}
    setDraftReady(true);
  },[]);
  useEffect(()=>{if(!draftReady)return;try{assessmentStorage.setItem(CONTENT_KEY,JSON.stringify({questions,tags,richHtml,active,questionCount:mcqValues.questionCount}));}catch{setNotice("Could not save this draft in your browser.");}},[draftReady,questions,tags,richHtml,active,mcqValues.questionCount]);
  const saveAndContinue=()=>{
    if(isSaving)return;
    const pending=Object.entries(extraDrafts).find(([index,value])=>questions[Number(index)]?.extraEnabled&&value.trim());
    if(pending){
      const pendingIndex=Number(pending[0]);
      setShowValidation(true);setPreviewing(false);setSections(old=>({...old,pairs:true}));
      jump(pendingIndex);
      setExtraError("Save the extra answer using its Save button before continuing.");
      setNotice(`Question ${pendingIndex+1}: save the pending extra answer before continuing.`);
      return;
    }
    setShowValidation(true);
    const firstInvalid=questions.findIndex(q=>!isComplete(q));
    if(!isReady){jump(firstInvalid<0?0:firstInvalid);setPreviewing(false);setNotice(`Question ${firstInvalid+1}: ${matchErrors(questions[firstInvalid])[0]||"Complete the required fields."}`);setSaveSuccess(false);return;}
    try{saveContent(questions,tags,richHtml,mcqValues);setSaveSuccess(true);setNotice("");setIsSaving(true);saveTimer.current=window.setTimeout(()=>{setSaveSuccess(false);setIsSaving(false);router.push("/assessments/create/evaluation");},3000);}
    catch{setSaveSuccess(false);setIsSaving(false);setNotice("Could not save this draft in your browser.");}
  };
  useEffect(()=>{
    const scrollArea=document.querySelector<HTMLElement>(".mcqcScrollArea");
    if(scrollArea) scrollArea.scrollTo({top:0,behavior:"auto"});
  },[previewing]);
  if(previewing)return <MatchPreview questions={questions} active={active} tags={tags} readyAll={isReady} saving={isSaving} onBack={()=>setPreviewing(false)} onEdit={index=>{jump(index);setPreviewing(false);setSections(s=>({...s,question:true,pairs:true}));}} onContinue={saveAndContinue}/>;
  return <div className="mcqcBuilder mcqcMatchBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg"/><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg"/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Antony?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid">
      <section className="mcqcBuilderMain">
        <div className="mcqcQuestionsHeading mcqcMatchQuestionsHeading"><div><h2>Question {active+1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Question | {mcqValues.totalMarks} Marks</p></div><button type="button" className="mcqcBuilderAction mcqcTopAdd" onClick={()=>jump(active+1)} disabled={active===mcqValues.questionCount-1}><Icon name="plus.svg" size={19}/>Add</button></div>
        <div className="mcqcNumberNavigation"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg" size={21}/></button><div className="mcqcQuestionNumbers" ref={numberScrollRef} aria-label="Question numbers">
          {questions.slice(0,mcqValues.questionCount).map((q,i)=>{const state=isComplete(q)?"is-complete":i===active?"is-active":"is-empty";return <button type="button" key={i} className={`mcqcQuestionNumber ${state}`} aria-label={`Question ${i+1}`} aria-current={i===active?"step":undefined} onClick={()=>jump(i)}><span>{i+1}</span><small>MTF</small><i aria-hidden="true"/></button>;})}
        </div><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=mcqValues.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg" size={21}/></button></div>
        <div className="mcqcQuestionProgress"><span style={{width:`${Math.round(questionDone/Math.max(1,mcqValues.questionCount)*100)}%`}}/></div>
        <div className="mcqcQuestionForm mcqcDDQuestionForm mcqcMatchQuestionForm">
          <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Match the Following" onChange={v=>{if(v!=="Match the Following")setNotice(`${v} is another assessment type. Match the Following remains selected on this page.`);else setNotice("");}}/></div>
          <DragPanel title="Question and Columns" icon="grid-view.svg" open={sections.question} onToggle={()=>toggle("question")}>
            <div className="mcqcBuilderField mcqcWriteField"><label>Write your Question </label><div className="mcqcEditorSurface">{richEditor(`mcqc-match-question-${active}`,question.text,v=>update({text:v}),"Write your question...",{maxChars:250})}</div></div>
            <div className="mcqcMatchThree"><div className="mcqcBuilderField"><label>Column A Heading</label><NeumoSelect value={question.columnA} options={["Term","Question","Item","Concept","Name"]} onChange={v=>update({columnA:v})}/></div><div className="mcqcBuilderField"><label>Column B Heading</label><NeumoSelect value={question.columnB} options={["Description","Answer","Definition","Match","Meaning"]} onChange={v=>update({columnB:v})}/></div><div className="mcqcBuilderField"><label>Answer Style</label><NeumoSelect value={question.answerStyle} options={["Dropdown","Drag & Drop"]} onChange={v=>update({answerStyle:v})}/></div></div>
            <div className="mcqcBuilderField mcqcDDShuffleField"><label>Shuffle drag items</label><div className="mcqcDDToggleRow"><span>Shuffle drag Items</span><Switch label="Shuffle drag items" checked={question.shuffle} onChange={v=>update({shuffle:v})}/></div></div>
          </DragPanel>
          <DragPanel title="Matching Pairs" icon="adjust-position.svg" subtitle="Each row is one correct match" open={sections.pairs} onToggle={()=>toggle("pairs")}>
            <div className="mcqcMatchPairs">{question.pairs.map((p,i)=><div className="mcqcMatchPairRow" key={p.id}><span className="mcqcDDLetter">{choiceLabel(i)}</span><input aria-label={`Term ${choiceLabel(i)}`} placeholder={`Term ${choiceLabel(i)}`} maxLength={250} value={p.term} onChange={e=>updatePair(p.id,{term:e.target.value})}/><input aria-label={`Matching description ${choiceLabel(i)}`} placeholder="Description" maxLength={250} value={p.description} onChange={e=>updatePair(p.id,{description:e.target.value})}/><button type="button" className="mcqcIconButton mcqcDDRemoveDrag" aria-label={`Remove matching pair ${choiceLabel(i)}`} onClick={()=>removePair(p.id)} disabled={question.pairs.length<=2}><Icon name="cancel-circle.svg" size={16}/></button></div>)}</div>
            <div className="mcqcMatchPairActions"><button type="button" className="mcqcBuilderAction mcqcDDAddSmall" onClick={addPair}><Icon name="plus.svg" size={16}/><span>Add Pairs</span></button><small>{question.pairs.length} Pairs</small></div>
            <div className="mcqcMatchExtras"><div className="mcqcDDToggleRow"><span>Extra Answers (Distractors) Optional</span><Switch checked={question.extraEnabled} onChange={v=>update({extraEnabled:v})} label="Extra answers enabled"/></div>{question.extraEnabled&&<><div className="mcqcMatchExtraEditor"><div className="mcqcEditorSurface">{richEditor(`mcqc-match-extra-${active}-${question.extras.length}`,extraDraft,v=>{setExtraDraft(v);setExtraError("");},"Write an extra answer...",{maxChars:250})}<div className="mcqcMatchExtraSaveRow"><button type="button" className="mcqcMatchExtraSave" onClick={saveExtraAnswer}>Save</button></div></div></div>{extraError&&<p className="mcqcValidationError" role="alert">{extraError}</p>}<div className="mcqcMatchExtraActions"><button type="button" className="mcqcBuilderAction mcqcDDAddSmall" onClick={()=>{if(extraDraft.trim())saveExtraAnswer();else document.getElementById(`mcqc-match-extra-${active}-${question.extras.length}`)?.focus();}}><Icon name="plus.svg" size={16}/><span>Add Extra Answer</span></button></div></>}
            </div>
          </DragPanel>
          <DragPanel title="Grading Method" icon="quiz.svg" open={sections.grading} onToggle={()=>toggle("grading")}>
            <div className="mcqcDDThree"><div className="mcqcBuilderField"><label>Grading Method</label><NeumoSelect value={question.grading} options={["Equal Marks","Custom"]} onChange={v=>update({grading:v as MatchQuestion["grading"],scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Points (total for Question)</label><NeumoSelect value={question.points} options={[...new Set([...Array.from({length:Math.max(10,question.pairs.length)},(_,i)=>String(i+1)),"15","20","25","30","40","50","100",question.points])].sort((a,b)=>Number(a)-Number(b))} onChange={v=>update({points:v,scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Negative Marking</label><NeumoSelect value={question.negative} options={["NA","0","0.25","0.5","1"]} onChange={v=>update({negative:v,scoreOverrides:{}})}/></div></div>
            {question.grading==="Custom"&&question.pairs.map((p,i)=><label key={p.id} className="mcqcDDCustomZone">Pair {choiceLabel(i)} marks<input type="number" min="0" step="0.5" placeholder="0" value={p.marks} onChange={e=>updatePair(p.id,{marks:e.target.value})}/></label>)}
            <div className="mcqcDDToggleRow"><span>Partial Credit</span><Switch label="Partial Credit" checked={question.partialCredit} onChange={v=>update({partialCredit:v,scoreOverrides:{}})}/></div>
            <div className="mcqcDDToggleRow"><span>Calculate grade with a minimum score of 0</span><Switch label="Minimum score of 0" checked={question.minZero} onChange={v=>update({minZero:v,scoreOverrides:{}})}/></div>
            <div className="mcqcDDToggleRow"><span>Allow learner to move items between zones before submit</span><Switch label="Move items" checked={question.allowMove} onChange={v=>update({allowMove:v})}/></div>
            <div className="mcqcDDScoreCheck">Total of pair marks: {totalPairMarks.toFixed(2)} / {question.points}<strong className={Math.abs(totalPairMarks-Number(question.points))<.0001?"mcqcDDCorrect":"mcqcDDDistractor"}>{Math.abs(totalPairMarks-Number(question.points))<.0001?"Matches Points":"Check Points"}</strong></div>
            <div className="mcqcBuilderField"><label>Score Simulator - Outcome per Pairs</label><div className="mcqcDDScoreTable"><div className="mcqcDDScoreHead"><span>Outcome</span><span>Marks</span></div>{Array.from({length:question.pairs.length+1},(_,i)=>question.pairs.length-i).map(n=><div className="mcqcDDScoreRow" key={n}><span>{n} correct, {question.pairs.length-n} wrong</span><NeumoSelect value={displayedMarks(scoreFor(question,n))} options={Array.from({length:Math.max(1,Math.floor(Number(question.points))+1)},(_,i)=>displayedMarks(i)).reverse()} onChange={v=>update({scoreOverrides:{...question.scoreOverrides,[String(n)]:String(Number(v))}})}/></div>)}</div></div>
          </DragPanel>
          <DragPanel title="Feedback" icon="message-circle-more.svg" subtitle={`${Math.max(question.feedbackFull.length,question.feedbackPartial.length,question.feedbackZero.length)}/250`} open={sections.feedback} onToggle={()=>toggle("feedback")}>
            {([['Full Marks','feedbackFull','Write feedback for all pairs matched...'],['Partial Marks','feedbackPartial','Write feedback for partial marks...'],['Zero Marks','feedbackZero','Write feedback for zero marks...']] as const).map(([title,key,placeholder])=><div className={`mcqcBuilderField mcqcDDFeedbackField mcqcDDFeedback${key}`} key={key}><label>{title} </label><div className="mcqcEditorSurface">{richEditor(`mcqc-match-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder,{maxChars:250})}</div></div>)}
            {([['Explanation','explanation','assignments.svg','Explain the correct matching pairs...'],['Hint','hint','idea.svg','Write a hint...']] as const).map(([title,key,icon,placeholder])=><div key={key} className="mcqcDDFeedbackSubpanel"><button type="button" className="mcqcDDFeedbackSubhead" aria-expanded={feedbackSubsections[key]} onClick={()=>setFeedbackSubsections(old=>({...old,[key]:!old[key]}))}><span className="mcqcDDPanelHeading"><span className="mcqcDDPanelIcon"><Icon name={icon} size={18}/></span><strong>{title}</strong></span><Icon name="arrow-down-01.svg" size={18} className={feedbackSubsections[key]?"mcqcRotated":""}/></button>{feedbackSubsections[key]&&<div className="mcqcDDFeedbackSubbody"><div className="mcqcEditorSurface">{richEditor(`mcqc-match-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder,{maxChars:250})}</div>{key==="hint"&&<div className="mcqcHintChecks"><label><input type="checkbox" checked={question.showHint} onChange={e=>update({showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={question.allowHint} onChange={e=>update({allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>)}
          </DragPanel>
          {showValidation&&matchErrors(question).length>0&&<div className="mcqcValidationErrors" role="alert">{matchErrors(question).map(err=><p key={err}>{err}</p>)}</div>}
        </div>
        <div className="mcqcBuilderBottom"><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" onClick={()=>{jump(active+1);setSections({question:false,pairs:false,grading:false,feedback:false});}} disabled={active===mcqValues.questionCount-1}><Icon name="plus.svg" size={20}/>Add Questions</button><div className="mcqcBuilderArrows"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg"/></button><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active===mcqValues.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg"/></button></div></div>
      </section>
      <aside className="mcqcBuilderAside mcqcMatchAside"><section className="mcqcAsideSection"><h3>Question Settings</h3>
        <div className="mcqcBuilderField"><label htmlFor="mcqcPoints">Points</label><div className="mcqcPointsControl"><input id="mcqcPoints" type="number" min="0" step="1" value={question.points} onChange={e=>update({points:e.target.value,scoreOverrides:{}})}/><div className="mcqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(question.points)||0)+1),scoreOverrides:{}})}><Icon name="arrow-down-01.svg" size={14} className="mcqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(question.points)||0)-1)),scoreOverrides:{}})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div>
        <div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={question.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={question.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={question.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div>
        <div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="mcqcTagInput" autoFocus aria-label="New tag" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tagInput.trim()){e.preventDefault();setTags(old=>old.includes(tagInput.trim())?old:[...old,tagInput.trim()]);setTagInput("");setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(t=>t!==tag))}>{tag}<Icon name="cancel.svg" size={14}/></button>)}</div></div>
        <div className="mcqcMandatory"><span>Mandatory</span><Switch checked={question.mandatory} onChange={v=>update({mandatory:v})} label="Mandatory Question"/></div><p className="mcqcAsideHint">This Question is Mandatory</p>
      </section>
        <section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{questionDone}</strong><span>Questions</span></div><div><strong>{questions.slice(0,mcqValues.questionCount).filter(isComplete).reduce((sum,q)=>sum+(Number(q.points)||0),0)}</strong><span>Marks</span></div><div><strong>{mcqValues.duration}</strong><span>Minutes</span></div></div><div className="mcqcSummaryProgress"><span style={{width:`${Math.round(questionDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. {isReady?"All questions are ready.":"Add questions to get started."}</p><div className="mcqcBuilderField"><label>Passing Score</label><PassingScoreSelect value={mcqValues.passingScore} onChange={onPassingScoreChange}/></div></section>
      </aside>
    </div>
    {notice&&<p className="mcqcBuilderNotice mcqcValidationError" role="status">{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="mcqcFooterPill" onClick={()=>{if(Object.entries(extraDrafts).some(([index,value])=>questions[Number(index)]?.extraEnabled&&value.trim())){setExtraError("Save each pending extra answer first.");setSections(old=>({...old,pairs:true}));return;}setShowValidation(true);setPreviewing(true);setNotice("");}}>Preview Questions</button><div className="mcqcSaveContinueGroup">{saveSuccess&&<span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}
export default function MatchContentPage(){
  const router=useRouter();
  const [values,setValues]=useState<AssessmentValues>(DEFAULT_VALUES);
  const [questions,setQuestions]=useState<MatchQuestion[]>(()=>Array.from({length:DEFAULT_VALUES.questionCount},()=>newQuestion()));
  const [pageReady,setPageReady]=useState(false);
  useEffect(()=>{
    const d=loadDetails();setValues(d);
    let saved:unknown[]=[];
    try{for(const key of [CONTENT_KEY,"matchTheFollowingContentDraft","matchfollowingContentDraft"]){const text=assessmentStorage.getItem(key);if(!text)continue;const parsed=JSON.parse(text);if(Array.isArray(parsed.questions)){saved=parsed.questions;break;}}}catch{/*Load a new draft.*/}
    setQuestions(Array.from({length:d.questionCount},(_,i)=>normalizeQuestion(saved[i],d.marksPerQuestion)));
    setPageReady(true);
  },[]);
  const updatePassingScore=(score:string)=>{setValues(previous=>({...previous,passingScore:score}));try{assessmentStorage.setItem("matchFollowingPassingScore",score);}catch{/*Keep the selected value in this page.*/}};
  return <main className="mcqcAppShell"><div className="mcqcLayout"><Sidebar/><section className="mcqcMainContent"><div className="mcqcHeader"><Header/></div><div className="mcqcScrollArea"><div className="mcqcPageContent">{pageReady && <QuestionBuilder questions={questions} setQuestions={setQuestions} mcqValues={values} onPassingScoreChange={updatePassingScore} onExit={()=>router.push("/assessments/create/details")}/>}</div></div></section></div></main>;
}
