"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, type ReactNode, type FormEvent, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./connectdot.css";
import { assessmentStorage, getActiveAssessmentId, getAssessment, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`mcqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}
// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"];
const MCQC_SIZES = ["12", "14", "16", "18", "24"];
const MCQC_SYMBOLS = ["©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "∞", "π", "√", "∑", "α", "β", "γ", "Δ", "€", "£", "₹", "→", "←", "•", "✓", "★", "¼", "½", "¾", "§", "¶", "…", "—", "“", "”", "’"];
function MCQRichEditor({ editorId, value, html, onChange, onHtmlChange, placeholder, onError, maxWords }: {
  editorId: string; value: string; html?: string; onChange: (text: string) => void;
  onHtmlChange: (html: string) => void; placeholder: string; onError: (message: string) => void; maxWords?: number; showWordCount?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<"font" | "size" | "symbols" | null>(null);
  const [font, setFont] = useState("Arial");
  const [size, setSize] = useState("16");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 160 });
  const floatingMenu = useRef<HTMLDivElement>(null);
  const openFormatMenu = (kind: "font" | "size" | "symbols", trigger: HTMLButtonElement) => {
    if (menu === kind) { setMenu(null); return; }
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(kind === "symbols" ? 340 : kind === "font" ? 190 : 110, window.innerWidth - 24);
    const height = Math.min(kind === "symbols" ? 345 : 218, window.innerHeight - 24);
    const preferredTop = window.innerHeight - rect.bottom >= height + 12 ? rect.bottom + 6 : rect.top - height - 6;
    const top = Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12));
    setMenuPosition({ top, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width });
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
      el.querySelectorAll("img, video, audio, iframe, object, embed, picture, source, svg").forEach(node => node.remove());
      lastHtml.current = next;
    }
  }, [editorId, value, html]);
  // The 0/250 counter counts typed characters, including spaces and line breaks.
  const countCharacters = (text: string) => Array.from(text).length;
  const allowedInsertion = (text: string) => {
    if (!editor.current || maxWords === undefined) return text;
    const el = editor.current;
    const selection = window.getSelection();
    let prefix = (el.querySelector("div,p,li,br") ? el.innerText : el.textContent) || "";
    let suffix = "";
    if (selection?.rangeCount && el.contains(selection.anchorNode)) {
      const selectedRange = selection.getRangeAt(0);
      const before = document.createRange();
      before.selectNodeContents(el);
      before.setEnd(selectedRange.startContainer, selectedRange.startOffset);
      const after = document.createRange();
      after.selectNodeContents(el);
      after.setStart(selectedRange.endContainer, selectedRange.endOffset);
      prefix = before.toString();
      suffix = after.toString();
    }
    const available = Math.max(0, maxWords - countCharacters(prefix + suffix));
    if (countCharacters(text) <= available) return text;
    onError(`This field allows a maximum of ${maxWords} characters (including spaces).`);
    return Array.from(text).slice(0, available).join("");
  };
  const beforeInput = (event: FormEvent<HTMLDivElement>) => {
    const native = event.nativeEvent as InputEvent;
    if (!native.inputType?.startsWith("insert") || !native.data || maxWords === undefined) return;
    if (allowedInsertion(native.data) !== native.data) event.preventDefault();
  };
  const pasteText = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = allowedInsertion(event.clipboardData.getData("text/plain"));
    if (text) document.execCommand("insertText", false, text);
    notify();
  };
  const notify = () => {
    const el = editor.current;
    if (!el) return;
    // textContent preserves ordinary and trailing spaces; innerText keeps line breaks in formatted paragraphs.
    el.querySelectorAll("img, video, audio, iframe, object, embed, picture, source, svg").forEach(node => node.remove());
    let plain = ((el.querySelector("div,p,li,br") ? el.innerText : el.textContent) || "").replace(/\u00a0/g, " ");
    let clipped = plain;
    if (maxWords !== undefined && countCharacters(clipped) > maxWords) {
      clipped = Array.from(clipped).slice(0, maxWords).join("");
      onError(`This field allows a maximum of ${maxWords} characters (including spaces).`);
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
    <div ref={editor} id={editorId} role="textbox" aria-label={placeholder} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={placeholder}
      className="mcqcRichEditable" onBeforeInput={beforeInput} onInput={notify} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={pasteText}
      onDrop={event => { event.preventDefault(); event.currentTarget.focus(); const value = allowedInsertion(event.dataTransfer.getData("text/plain")); if (value) document.execCommand("insertText", false, value); notify(); }}/>
    {maxWords !== undefined && <small className="assessmentEditorCounter" aria-live="polite">{Array.from(value).length}/{maxWords}</small>}
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
  return <span className="mcqcDDSelectedCheck" aria-hidden="true"/>;
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
  title:string; icon:string; open:boolean; onToggle:()=>void; children: ReactNode; subtitle?:string;
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

// Connect the Dots content. The editor, dropdown and switch above are retained
// from the user-supplied match.tsx so their icons and special-character behavior match.
type DotPair = { id: string; left: string; right: string; marks: string;
  pictureSrc?: string; pictureFileName?: string; pictureAnswer?: string;
  pictureOriginalLeft?: string; pictureOriginalRight?: string;
};
type DotQuestion = {
  type: "Connect the Dots"; text: string; questionMode: string;
  columnA: string; columnB: string; connectionMode: string;
  shuffleLeft: boolean; shuffleRight: boolean; lineStyle: string;
  lineShape: string; endPoint: string; lineColour: string; dotStyle: string; layout: string;
  minConnections: string; responseRequired: boolean;
  instructions: string; graderInfo: string;
  pairs: DotPair[]; extras: string[]; extraEnabled: boolean;
  grading: "Equal Marks" | "Custom"; points: string; negative: string;
  partialCredit: boolean; minZero: boolean; allowMove: boolean;
  scoreOverrides: Record<string,string>;
  feedbackFull: string; feedbackPartial: string; feedbackZero: string;
  explanation: string; hint: string; showCorrectCount: boolean;
  showConnectionsAfterTrial: boolean; showHintBeforeAnswering: boolean;
  allowHintRequest: boolean; difficulty: string; category: string;
  bloom: string; tags: string[]; mandatory: boolean;
};
type AssessmentValues = {
  questionCount: number; totalMarks: number; duration: number; passingScore: string;
};
const DEFAULT_VALUES: AssessmentValues = {questionCount:20,totalMarks:40,duration:60,passingScore:"60%"};
const DRAFT_KEY = "connectDotsContentDraft";
const PASSING_SCORE_OPTIONS = Array.from({length:10},(_,i)=>`${(i+1)*10}%`);
const CATEGORIES = ["AI", "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Data Science", "Cybersecurity", "Cloud Computing", "Programming", "Database", "Web Development", "Software Engineering", "Computer Networks", "Operating Systems", "Data Structures & Algorithms", "Data Structures", "Mathematics", "Statistics", "Other"];
const BLOOMS = ["Remember", "Create", "Evaluate", "Analyse", "Apply", "Understand"];
const uid = () => `dot-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const blankPair = ():DotPair => ({id:uid(),left:"",right:"",marks:""});
const examplePairs = [
  ["Stack","Last-in First-Out used for undo operations"],
  ["Queue","First-in First-Out used for task scheduling"],
  ["Binary Search Tree","Ordered keys; O(log n) average search"],
  ["Hash Table","Key-value lookup; O(1) average access"],
  ["Graph","Nodes and edges; models networks and routes"]
];
function makeQuestion(sample=false):DotQuestion {
  return {
    type:"Connect the Dots",
    text:sample?"Connect each data structure (left) to its best description and typical use (right). Some items on the right do not match anything.":"",
    questionMode:"Text Based",columnA:"Data Structure",columnB:"Description",
    connectionMode:"One to one",shuffleLeft:false,shuffleRight:true,
    lineStyle:"Solid",lineShape:"Straight",endPoint:"Circle",lineColour:"Blue",dotStyle:"Circle",layout:"Two column",
    minConnections:"0",responseRequired:true,
    instructions:sample?"Click a dot on the left, then a dot on the right – or drag a line between them. Click a line to remove it.":"",
    graderInfo:sample?"Accept only the connections in the answer key.":"",
    pairs:sample?examplePairs.map(([left,right])=>({id:uid(),left,right,marks:""})):Array.from({length:5},blankPair),
    extras:[],extraEnabled:true,grading:"Equal Marks",points:"1",negative:"NA",
    partialCredit:true,minZero:true,allowMove:true,scoreOverrides:{},
    feedbackFull:sample?"Excellent – every pair is matched correctly!":"",
    feedbackPartial:sample?"Partly right – re-check the links marked in red.":"",
    feedbackZero:sample?"Review the lesson and try again.":"",
    explanation:sample?"Stack = LIFO; Queue = FIFO; BST = ordered keys; Hash table = O(1) lookup; Graph = nodes and edges.":"",
    hint:sample?"Think about how each structure stores and retrieves data.":"",
    showCorrectCount:true,showConnectionsAfterTrial:false,
    showHintBeforeAnswering:false,allowHintRequest:false,
    difficulty:"",category:sample?"AI":"",bloom:sample?"Analyse":"",
    tags:sample?["Data Structure","Stack"]:[],mandatory:true
  };
}
const words = (text:string) => (text.trim().match(/\S+/g)||[]).length;
const characters = (text:string) => Array.from(text).length;
const num = (value:unknown,fallback:number) => {const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback;};
const formatMarks = (value:number) => Number.isInteger(value)&&value>0&&value<10?String(value).padStart(2,"0"):String(Number(value.toFixed(2)));
function hasData(q:DotQuestion){return Boolean(q.text.trim()||q.pairs.some(p=>p.left.trim()||p.right.trim()||(q.questionMode==="Picture"&&(p.pictureSrc||p.pictureAnswer)))||q.extras.length);}
function errorsFor(q:DotQuestion):string[] {
  const errors:string[]=[];
  if(!q.text.trim())errors.push("Write your question.");
  if(characters(q.text)>250)errors.push("Question must contain no more than 250 characters (including spaces).");
  if(!q.columnA.trim()||!q.columnB.trim())errors.push("Enter both column headings.");
  // Numeric Value: the left item is a written problem; only the right answer is numeric.
  // Validate on save/continue without losing leading zeroes such as "02" in the editor.
  const validNumeric = (value:string) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim());
  const hasLetters = (value:string) => /\p{L}/u.test(value);
  if(q.questionMode==="Numeric Value"&&q.pairs.some(p=>p.right.trim()&&!validNumeric(p.right)))errors.push("Enter a valid numeric value on the right of every matching pair.");
  if(q.questionMode==="Text Based"&&q.pairs.some(p=>p.left.trim()&&!hasLetters(p.left)||p.right.trim()&&!hasLetters(p.right)))errors.push("Text Based matching pairs require text, not numbers only.");
  if(q.questionMode==="Numeric Value"&&q.extraEnabled&&q.extras.some(extra=>!validNumeric(extra)))errors.push("Numeric Value extra answers must contain numbers only.");
  if(q.questionMode!=="Numeric Value"&&q.extraEnabled&&q.extras.some(extra=>extra.trim()&&!hasLetters(extra)))errors.push("Text extra answers must contain letters.");
  if(q.pairs.length<2)errors.push("Add at least two matching pairs.");
  if(q.questionMode==="Picture") {
    if(q.pairs.some(p=>!pictureSource(p)))errors.push("Choose a picture for every matching pair (PNG or JPG, max 250 KB).");
    if(q.pairs.some(p=>!pictureAnswer(p).trim()))errors.push("Enter a Data Structure answer for every picture.");
    if(q.pairs.some(p=>pictureAnswer(p).trim()&&!/\p{L}/u.test(pictureAnswer(p))))errors.push("Picture matching answers must contain text.");
  } else if(q.pairs.some(p=>!p.left.trim()||!p.right.trim()))errors.push("Fill both fields in every matching pair.");
  if(q.questionMode==="Numeric Value"&&q.pairs.some(p=>p.left.length>250))errors.push("Data Structure fields must be 250 characters or fewer.");
  if(q.questionMode==="Numeric Value"&&q.pairs.some(p=>words(p.right)>250))errors.push("Description fields must be 250 words or fewer.");
  if(q.questionMode!=="Picture"&&q.connectionMode==="One to one"&&new Set(q.pairs.map(p=>p.left.trim().toLowerCase())).size!==q.pairs.length)errors.push("Each left-side item must be unique for one-to-one matching.");
  if(q.extraEnabled&&q.extras.some(x=>!x.trim()||q.pairs.some(p=>p.right.trim().toLowerCase()===x.trim().toLowerCase())))errors.push("Extra answers must be filled in and different from correct answers.");
  if(q.extraEnabled&&new Set(q.extras.map(x=>x.trim().toLowerCase())).size!==q.extras.length)errors.push("Extra answers cannot repeat.");
  if(q.extraEnabled&&q.extras.some(x=>characters(x)>250))errors.push("Extra answers must be at most 250 characters.");
  if(!Number.isFinite(Number(q.points))||Number(q.points)<=0)errors.push("Points must be greater than zero.");
  if(q.grading==="Custom"&&q.pairs.some(p=>p.marks.trim()===""||!Number.isFinite(Number(p.marks))||Number(p.marks)<0))errors.push("Enter a valid non-negative mark for every pair.");
  if(q.grading==="Custom"&&Math.abs(q.pairs.reduce((s,p)=>s+Number(p.marks||0),0)-Number(q.points))>0.001)errors.push("Custom pair marks must equal the question points.");
  if(!q.category||!q.bloom)errors.push("Choose Category and Bloom’s Taxonomy.");
  if(!q.feedbackFull.trim()||!q.feedbackPartial.trim()||!q.feedbackZero.trim())errors.push("Enter feedback for full, partial and zero marks.");
  if(!q.instructions.trim()||!q.graderInfo.trim())errors.push("Enter instructions for learners and information for graders.");
  if([q.instructions,q.graderInfo,q.feedbackFull,q.feedbackPartial,q.feedbackZero].some(x=>characters(x)>250))errors.push("Text editors allow a maximum of 250 characters each, including spaces.");
  if(!q.explanation.trim())errors.push("Enter an explanation.");
  if((q.showHintBeforeAnswering||q.allowHintRequest)&&!q.hint.trim())errors.push("Enter a hint before enabling hint options.");
  if(characters(q.explanation)>250||characters(q.hint)>250)errors.push("Explanation and hint are limited to 250 characters.");
  if(!Number.isFinite(Number(q.minConnections))||Number(q.minConnections)<0||Number(q.minConnections)>q.pairs.length)errors.push("Minimum connections must be between 0 and the number of pairs.");
  if(q.negative!=="NA"&&(!Number.isFinite(Number(q.negative))||Number(q.negative)<0))errors.push("Negative marking must be a non-negative number or NA.");
  return errors;
}
const complete=(q:DotQuestion)=>errorsFor(q).length===0;
const marksFor=(q:DotQuestion,index:number)=>q.grading==="Custom"?Number(q.pairs[index]?.marks||0):Number(q.points)/Math.max(1,q.pairs.length);
function scoreFor(q:DotQuestion,correct:number){
  const override=q.scoreOverrides[String(correct)];
  if(override!==undefined&&override!==""&&Number.isFinite(Number(override)))return Number(override);
  const partial=q.partialCredit?(q.grading==="Custom"?q.pairs.slice(0,correct).reduce((sum,_,i)=>sum+marksFor(q,i),0):correct*(Number(q.points)/Math.max(1,q.pairs.length))):correct===q.pairs.length?Number(q.points):0;
  const penalty=q.negative==="NA"?0:Number(q.negative)||0;
  const result=partial-(q.pairs.length-correct)*penalty;
  return q.minZero?Math.max(0,result):result;
}
function loadValues():AssessmentValues {
  for(const key of ["mcqAssessmentDraft","connectDotsAssessmentDraft"]){
    try {
      const raw=assessmentStorage.getItem(key) || (key==="connectDotsAssessmentDraft" ? localStorage.getItem(key) : null);
      if(!raw)continue;
      const parsed=JSON.parse(raw);
      if(!parsed||typeof parsed!=="object")continue;
      const details={...parsed,...(parsed.settings||{}),...(parsed.details||{})};
      if(!("questionCount" in details)&&!("totalQuestions" in details))continue;
      const count=Math.max(1,Math.min(100,Math.floor(num(details.questionCount??details.totalQuestions,20))));
      return {questionCount:count,totalMarks:num(details.totalMarks??details.maximumMarks,40),duration:num(details.duration??details.durationMinutes,60),passingScore:String(details.passingScore||"60%")};
    }catch{/* Try another details draft. */}
  }
  return DEFAULT_VALUES;
}
function saveDraft(questions:DotQuestion[],values:AssessmentValues,active:number,richHtml:Record<string,string>){
  const data={type:"Connect the Dots",questions:questions.slice(0,values.questionCount).map(pictureViewerQuestion),details:values,active,richHtml,savedAt:new Date().toISOString()};
  const serialized=JSON.stringify(data);
  assessmentStorage.setItem(DRAFT_KEY,serialized);
  return data;
}
function DotPreview({question,onClose}:{question:DotQuestion;onClose:()=>void}){
  const [selected,setSelected]=useState<string|null>(null);
  const [links,setLinks]=useState<{from:string;to:string}[]>([]);
  const [submitted,setSubmitted]=useState(false);
  const [showHint,setShowHint]=useState(false);
  const board=useRef<HTMLDivElement>(null);
  const [segments,setSegments]=useState<{id:string;x1:number;y1:number;x2:number;y2:number}[]>([]);
  const [boardSize,setBoardSize]=useState({width:0,height:0});
  const left=useMemo(()=>{const pairs=question.questionMode==="Picture"?question.pairs.map(p=>({...p,left:pictureSource(p)})):question.pairs;return question.shuffleLeft?[...pairs].reverse():pairs;},[question]);
  const right=useMemo(()=>{
    const opts=[...question.pairs.map(p=>({id:p.id,text:question.questionMode==="Picture"?pictureAnswer(p):p.right})),...(question.extraEnabled?question.extras.map((text,i)=>({id:`extra-${i}`,text})):[])];
    return question.shuffleRight?[...opts].reverse():opts;
  },[question]);
  useEffect(()=>{setLinks([]);setSelected(null);setSubmitted(false);},[question]);
  useEffect(()=>{
    const element=board.current;if(!element)return;
    const redraw=()=>{
      const bounds=element.getBoundingClientRect();
      setBoardSize({width:bounds.width,height:bounds.height});
      const visibleLinks=submitted&&question.showConnectionsAfterTrial?question.pairs.map(p=>({from:p.id,to:p.id})):links;
      setSegments(visibleLinks.flatMap(({from,to})=>{
        const a=Array.from(element.querySelectorAll<HTMLElement>("[data-dot-left]")).find(el=>el.dataset.dotLeft===from);
        const b=Array.from(element.querySelectorAll<HTMLElement>("[data-dot-right]")).find(el=>el.dataset.dotRight===to);
        if(!a||!b)return [];
        const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
        return [{id:from,x1:ar.right-bounds.left,y1:ar.top+ar.height/2-bounds.top,x2:br.left-bounds.left,y2:br.top+br.height/2-bounds.top}];
      }));
    };
    redraw();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(redraw):null;
    observer?.observe(element);
    window.addEventListener("resize",redraw);
    return ()=>{observer?.disconnect();window.removeEventListener("resize",redraw);};
  },[links,question,selected,submitted]);
  const connect=(to:string)=>{
    if(!selected||submitted)return;
    const from=selected;
    setLinks(prev=>{
      const already=prev.some(link=>link.from===from&&link.to===to);
      if(!question.allowMove && prev.some(link=>link.from===from) && !already && (question.connectionMode==="One to one"||question.connectionMode==="Many to one"))return prev;
      if(already)return prev.filter(link=>!(link.from===from&&link.to===to));
      const mode=question.connectionMode;
      const remaining=prev.filter(link=>{
        if((mode==="One to one"||mode==="Many to one")&&link.from===from)return false;
        if((mode==="One to one"||mode==="One to many")&&link.to===to)return false;
        return true;
      });
      return [...remaining,{from,to}];
    });
    setSelected(null);
  };
  const pathFor=(l:{x1:number;y1:number;x2:number;y2:number})=>{
    const {x1,y1,x2,y2}=l;
    if(question.lineShape==="Curved"){
      const mid=(x1+x2)/2;
      return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
    }
    if(question.lineShape==="Elbow (stepped)"){
      const mid=(x1+x2)/2;
      return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  };
  const strokeDash=question.lineStyle==="Dashed"?"8 5":question.lineStyle==="Dot style"?"1 6":question.lineStyle==="Dash-dot"?"8 4 1 4":undefined;
  const strokeColor=question.lineColour==="Green"?"#2A7308":question.lineColour==="Red"?"#E01E5A":"#2D4CC8";
  const endPoint=(l:{x1:number;y1:number;x2:number;y2:number},id:string)=>{
    const type=question.endPoint;
    const {x1,y1,x2,y2}=l;
    if(type==="None")return null;
    if(type==="Square")return <rect key={id} x={x2-5} y={y2-5} width={10} height={10} fill={strokeColor}/>;
    if(type==="Diamond")return <polygon key={id} points={`${x2},${y2-7} ${x2+7},${y2} ${x2},${y2+7} ${x2-7},${y2}`} fill={strokeColor}/>;
    if(type==="Arrow"){
      const angle=Math.atan2(y2-y1,x2-x1), len=11, spread=0.5;
      return <polygon key={id} points={`${x2},${y2} ${x2-len*Math.cos(angle-spread)},${y2-len*Math.sin(angle-spread)} ${x2-len*Math.cos(angle+spread)},${y2-len*Math.sin(angle+spread)}`} fill={strokeColor}/>;
    }
    return <circle key={id} cx={x2} cy={y2} r={5} fill={strokeColor}/>;
  };
  const correct=question.pairs.filter(p=>links.some(link=>link.from===p.id&&link.to===p.id)).length;
  const mark=scoreFor(question,correct);
  return <div className="mcqcConnectPreview">
    <div className="mcqcConnectPreviewTop"><div><h2>Learner Preview</h2><p>Connect the Dots · {question.points} Points</p></div><button type="button" className="mcqcFooterPill" onClick={onClose}>Back to Editor</button></div>
    <div className="mcqcConnectPreviewCard"><h3>{question.text||"Write your question to preview it."}</h3>
      {question.instructions&&<p>{question.instructions}</p>}
      <div className={`mcqcConnectBoard ${question.layout==="Stacked"?"is-stacked":""} ${question.dotStyle==="Square"?"is-square":""}`} ref={board}>
        <svg className="mcqcConnectLines" width="100%" height="100%" viewBox={`0 0 ${boardSize.width||1} ${boardSize.height||1}`} aria-hidden="true">
          {segments.map(line=><g key={line.id}><path d={pathFor(line)} stroke={strokeColor} strokeWidth="2.5" strokeDasharray={strokeDash} strokeLinecap="round" fill="none"/>{endPoint(line,line.id+"-end")}</g>)}
        </svg>
        <div className="mcqcConnectColumn"><h4>{question.columnA}</h4>{left.map(p=><button key={p.id} type="button" data-dot-left={p.id} className={`mcqcConnectDotItem ${selected===p.id?"is-selected":""}`} onClick={()=>{if(submitted)return;setSelected(p.id);}}><span>{question.questionMode==="Picture"&&isPictureAsset(p.left)?<img src={p.left} alt="Left matching item" className="mcqcConnectPairImage"/>:p.left||"Left item"}</span><i aria-hidden="true"/></button>)}</div>
        <div className="mcqcConnectColumn"><h4>{question.columnB}</h4>{right.map(p=><button key={p.id} type="button" data-dot-right={p.id} className="mcqcConnectDotItem is-right" onClick={()=>connect(p.id)}><i aria-hidden="true"/><span>{question.questionMode==="Picture"&&isPictureAsset(p.text)?<img src={p.text} alt="Right matching item" className="mcqcConnectPairImage"/>:p.text||"Right item"}</span></button>)}</div>
      </div>
      {showHint&&question.hint&&<p className="mcqcConnectHint">{question.hint}</p>}
      <div className="mcqcConnectPreviewActions">
        {question.hint&&(question.showHintBeforeAnswering||question.allowHintRequest)&&<button type="button" className="mcqcFooterPill" onClick={()=>setShowHint(v=>!v)}><Icon name={showHint?"eye-off.svg":"view.svg"} size={17}/>{showHint?"Hide Hint":"Hint"}</button>}
        <button type="button" className="mcqcFooterPill" onClick={()=>{setLinks([]);setSelected(null);setSubmitted(false);}}>Reset</button>
        <button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={submitted||links.length<Math.max(question.responseRequired?1:0,Number(question.minConnections)||0)} onClick={()=>setSubmitted(true)}>Submit</button>
      </div>
      {submitted&&<div className="mcqcConnectResult" role="status"><strong>{question.showCorrectCount?`${correct} / ${question.pairs.length} correct · `:""}{formatMarks(mark)} marks</strong><p>{correct===question.pairs.length?question.feedbackFull:correct>0?question.feedbackPartial:question.feedbackZero}</p>{question.explanation&&<p>{question.explanation}</p>}</div>}
    </div>
  </div>;
}
const isPictureAsset = (value:string) => /^data:image\/(?:png|jpeg);base64,/i.test(value) || /^data:image\/svg\+xml,/i.test(value) || /^\/assets\/assessmenticons\/[\w./-]+\.(?:svg|png|jpe?g)$/i.test(value);
// Picture mode uses the same pair IDs and grading as the existing matching questions.
// These five reference sketches appear only when the corresponding sample labels are used.
const PICTURE_REFERENCE_DRAWINGS: Record<string, string> = {
  stack: '<rect x="28" y="10" width="64" height="22"/><rect x="28" y="32" width="64" height="22"/><rect x="28" y="54" width="64" height="22"/>',
  queue: '<rect x="4" y="31" width="22" height="24"/><rect x="32" y="31" width="22" height="24"/><rect x="60" y="31" width="22" height="24"/><path d="M87 43h27m-11-10 11 10-11 10"/>',
  'binary search tree': '<path d="M60 12 35 39 16 68M35 39l18 29M60 12l25 27-7 29M85 39l20 29"/><circle cx="60" cy="12" r="8"/><circle cx="35" cy="39" r="8"/><circle cx="85" cy="39" r="8"/><circle cx="16" cy="68" r="8"/><circle cx="53" cy="68" r="8"/><circle cx="78" cy="68" r="8"/><circle cx="105" cy="68" r="8"/>',
  'hash table': '<rect x="4" y="9" width="30" height="68"/><path d="M4 31h30M4 53h30M39 43h40m-10-11 11 11-11 11"/><rect x="82" y="29" width="35" height="28"/>',
  graph: '<path d="M19 18 93 18 60 45 19 18 19 69 60 45 93 69 93 18 19 69 93 69"/><circle cx="19" cy="18" r="8"/><circle cx="93" cy="18" r="8"/><circle cx="60" cy="45" r="8"/><circle cx="19" cy="69" r="8"/><circle cx="93" cy="69" r="8"/>'
};
function referencePicture(label: string): string {
  const shape = PICTURE_REFERENCE_DRAWINGS[label.trim().toLowerCase()];
  if (!shape) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 88" fill="none" stroke="#4B46E5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${shape}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function pictureSource(pair: DotPair): string {
  return pair.pictureSrc ? (isPictureAsset(pair.pictureSrc) ? pair.pictureSrc : "") : (isPictureAsset(pair.left) ? pair.left : referencePicture(pair.left));
}
function pictureAnswer(pair: DotPair): string {
  return pair.pictureAnswer !== undefined ? pair.pictureAnswer :
    (isPictureAsset(pair.left) ? pair.right : pair.left || pair.right);
}
// Keep text/numeric fields intact when saving Picture pairs for the existing viewer.
function pictureViewerQuestion(question: DotQuestion): DotQuestion {
  if (question.questionMode !== "Picture") return question;
  return { ...question, columnA: "Diagram", columnB: "Data Structure", pairs: question.pairs.map(pair => ({
    ...pair, pictureOriginalLeft: pair.left, pictureOriginalRight: pair.right,
    left: pictureSource(pair), right: pictureAnswer(pair)
  })) };
}
function PictureThumbnail({ src, alt }: { src: string; alt: string }) {
  return <span className="mcqcPictureThumb">
    {src ? <img src={src} alt={alt} /> : <span className="mcqcPictureMissing">Image</span>}
  </span>;
}
// Description entries are limited to 250 WORDS, not 250 characters.
// Keep the same input element, so its original height, shadows and grid position stay unchanged.
function capWords(value: string, maxWords: number): string {
  const matches = [...value.matchAll(/\S+/g)];
  if (matches.length <= maxWords) return value;
  const last = matches[maxWords - 1];
  return value.slice(0, (last.index ?? 0) + last[0].length);
}
function DotPairField({value,onChange,label,mode,maxWords,onLimit,numericOnly=false,noLimit=false}:{value:string;onChange:(value:string)=>void;label:string;mode:string;maxWords?:number;onLimit?:()=>void;numericOnly?:boolean;noLimit?:boolean}){
  return <input type="text" inputMode={numericOnly?"decimal":undefined}
    aria-label={label} placeholder={mode==="Picture"?"Image path or label":label}
    maxLength={noLimit?undefined:maxWords===undefined?250:undefined} value={value}
    onChange={e=>{
      const entered=e.target.value;
      // Permit decimal signs and partial numbers while editing; final validation requires a number.
      if(numericOnly && !/^[+-]?(?:\d*(?:\.\d*)?)?$/.test(entered))return;
      const limited=noLimit||maxWords===undefined?entered:capWords(entered,maxWords);
      if(entered!==limited)onLimit?.();
      onChange(limited);
    }}/>
}

function PreviewSection({title,icon,open,onToggle,children,className=""}:{title:string;icon?:string;open:boolean;onToggle:()=>void;children:ReactNode;className?:string}){
  return <section className={`cdPreviewSection ${className}`}><button type="button" className="cdPreviewSectionHead" aria-expanded={open} onClick={onToggle}><span className="cdPreviewSectionTitle">{icon&&<span className="cdPreviewSectionIcon"><Icon name={icon} size={17}/></span>}{title}</span><Icon name="arrow-down-01.svg" size={19} className={open?"mcqcRotated":""}/></button>{open&&<div className="cdPreviewSectionBody">{children}</div>}</section>;
}
function PreviewToggle({label,enabled}:{label:string;enabled:boolean}){
  return <div className="cdPreviewToggleRow"><span>{label}</span><span className={`cdPreviewToggle ${enabled?"is-on":""}`} role="img" aria-label={`${label}: ${enabled?"ON":"OFF"}`}><b>{enabled?"ON":"OFF"}</b></span></div>;
}
function PreviewReadValue({label,value}:{label:string;value:string}){
  return <div className="cdReadValue"><span>{label}</span><strong>{value||"—"}</strong></div>;
}
function ConnectDotsReviewPreview({questions,values,onBack,onEdit,onContinue,saving}:{questions:DotQuestion[];values:AssessmentValues;onBack:()=>void;onEdit:(i:number)=>void;onContinue:()=>void;saving:boolean}){
  const [filter,setFilter]=useState("All Questions");
  const [filterOpen,setFilterOpen]=useState(false);
  const [learnerIndex,setLearnerIndex]=useState<number|null>(null);
  const [openSections,setOpenSections]=useState<Record<string,boolean>>({pairs:true,advanced:true,grading:true,learning:true,settings:true});
  const toggleSection=(key:string)=>setOpenSections(current=>({...current,[key]:!current[key]}));
  const filled=questions.map((question,index)=>({question,index})).filter(({question})=>hasData(question));
  const visible=filled.filter(({question})=>filter==="All Questions"||(filter==="Complete"?complete(question):!complete(question)));
  const ready=filled.length>0&&filled.every(({question})=>complete(question));
  if(learnerIndex!==null)return <DotPreview question={questions[learnerIndex]} onClose={()=>setLearnerIndex(null)}/>;
  return <div className="cdPreviewPage">
    <nav className="cdPreviewBreadcrumb" aria-label="Preview breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={17}/><button type="button" onClick={onBack}>Create Assessment</button><Icon name="arrowrightdouble.svg" size={17}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={17}/><strong>Preview Questions</strong></nav>
    <div className="cdPreviewHeading"><div><h1>Preview Questions</h1><p>Review Your Questions Before Saving.</p></div></div>
    <div className="cdPreviewOverview"><div className="cdPreviewStats"><div><strong>{values.questionCount}</strong><span>Questions</span></div><div><strong>{values.totalMarks}</strong><span>Marks</span></div><div className={`cdPreviewReady ${ready?"is-ready":""}`}><span className="cdReadyIcon">{ready?"✓":"!"}</span><span><strong>{ready?"Ready":"In Progress"}</strong><small>{ready?"All good to continue":"Review incomplete questions"}</small></span></div></div><div className="cdPreviewTools"><div className="cdPreviewFilterRoot"><button type="button" className="cdPreviewFilterButton" aria-expanded={filterOpen} onClick={()=>setFilterOpen(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{filterOpen&&<div className="cdPreviewFilterMenu">{["All Questions","Complete","Incomplete"].map(option=><button type="button" key={option} className={filter===option?"is-selected":""} onClick={()=>{setFilter(option);setFilterOpen(false);}}>{option}</button>)}</div>}</div><button type="button" className="cdPreviewLearnerButton" onClick={()=>setLearnerIndex(visible[0]?.index??filled[0]?.index??0)} disabled={!filled.length}><Icon name="view.svg" size={17}/>Learner Preview</button></div></div>
    {visible.length?visible.map(({question,index})=>{
      const valid=complete(question);
      const pairMarks=question.pairs.length?Number(question.points)/question.pairs.length:0;
      const read=[
        ["Connection mode",question.connectionMode],["Shuffle Left",question.shuffleLeft?"YES":"NO"],["Shuffle Right Items",question.shuffleRight?"YES":"NO"],
        ["Line Style",question.lineStyle],["Line Shape",question.lineShape],["End Point",question.endPoint],
        ["Line Colour",question.lineColour],["Dot Style",question.dotStyle],["Layout",question.layout],
        ["Minimum connections to submit",question.minConnections],["Response Required",question.responseRequired?"Yes":"No"]
      ];
      return <article className="cdPreviewQuestion" key={index}>
        <div className="cdPreviewMeta"><span className="cdPreviewTypePill">Connect the dots: {question.points} Points</span><span className="cdPreviewStatusPill">Status: <b className={valid?"is-complete":"is-incomplete"}>{valid?"Complete":"Incomplete"}</b></span><button type="button" className="cdPreviewEditButton" onClick={()=>onEdit(index)}><Icon name="edit.svg" size={15}/>Edit</button></div>
        <section className="cdPreviewPromptCard"><h2>Question {index+1}</h2><div className="cdPreviewPromptText">{question.text||"Question has not been written yet."}</div></section>
        <PreviewSection title="Matching Pairs (Each row is one correct match)" icon="dot.svg" open={openSections.pairs} onToggle={()=>toggleSection("pairs")} className="cdPreviewPairsSection">{question.questionMode==="Picture" ?
          <div className="cdPreviewPairTable cdPreviewPicturePairTable">
            <div className="cdPreviewPairHeader"><span>Diagram</span><span>Data Structure</span><span>Marks</span></div>
            {question.pairs.map((pair,pairIndex)=>{
              const picture=pictureSource(pair);
              const answer=pictureAnswer(pair);
              const pairFilled=Boolean(picture&&answer.trim());
              return <div key={pair.id} className={`cdPreviewPairRow ${pairFilled?"is-filled": ""}`}>
                <div className="cdPreviewPairLeft" data-label="Diagram">
                  <PictureThumbnail src={picture} alt={`Diagram ${pairIndex+1}`}/>
                  {pairFilled&&<span className="cdPreviewMatchCheck" aria-label="Correct match">✓</span>}
                </div>
                <div className="cdPreviewPairRight" data-label="Data Structure">{pairIndex+1}. {answer||"—"}</div>
                <div className="cdPreviewPairMarks" data-label="Marks">{formatMarks(question.grading==="Custom"?Number(pair.marks)||0:pairMarks)}</div>
              </div>;
            })}
          </div>
          : question.questionMode==="Numeric Value" ?
            <div className="cdPreviewPairTable cdPreviewNumericPairTable">
              <div className="cdPreviewPairHeader"><span>{question.columnA==="Data Structure"?"Slope Question":question.columnA}</span><span>{question.columnB==="Description"?"Numeric Value":question.columnB}</span><span>Marks</span></div>
              {question.pairs.map((pair,pairIndex)=>{
                const pairFilled=Boolean(pair.left.trim()&&pair.right.trim()&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(pair.right.trim()));
                return <div className={`cdPreviewPairRow ${pairFilled?"is-filled is-numeric-complete":""}`} key={pair.id}>
                  <div className="cdPreviewPairLeft" data-label={question.columnA==="Data Structure"?"Slope Question":question.columnA}><span className="cdPreviewNumericQuestionText">{pair.left||`Question ${pairIndex+1}`}</span>{pairFilled&&<span className="cdPreviewMatchCheck" aria-label="Completed numeric match">✓</span>}</div>
                  <div className="cdPreviewPairRight" data-label={question.columnB==="Description"?"Numeric Value":question.columnB}>{pair.right||"—"}</div>
                  <div className="cdPreviewPairMarks" data-label="Marks">{Number(marksFor(question,pairIndex).toFixed(2))}</div>
                </div>;
              })}
            </div>
          : <div className="cdPreviewPairTable"><div className="cdPreviewPairHeader"><span>{question.columnA||"Column A"}</span><span>{question.columnB||"Column B"}</span><span>Marks</span></div>{question.pairs.map((pair,pairIndex)=>{const pairFilled=Boolean(pair.left.trim()&&pair.right.trim());return <div className={`cdPreviewPairRow ${pairFilled?"is-filled":""}`} key={pair.id}><div className="cdPreviewPairLeft"><span>{String.fromCharCode(65+pairIndex)}.</span>{pair.left||`Left item ${pairIndex+1}`}</div><div className="cdPreviewPairRight">{pair.right||`Correct match ${pairIndex+1}`}{pairFilled&&<span className="cdPreviewMatchCheck" aria-label="Correct match">✓</span>}</div><div className="cdPreviewPairMarks">{formatMarks(question.grading==="Custom"?Number(pair.marks)||0:pairMarks)}</div></div>})}</div>}{question.extraEnabled&&<div className={`cdPreviewExtraAnswers ${question.questionMode==="Numeric Value"?"cdPreviewNumericExtras":question.questionMode==="Picture"?"cdPreviewPictureExtras":""}`}><h3>Extra Answers</h3>{question.extras.length?<div className="cdPreviewExtraChips">{question.extras.map((answer,extraIndex)=><span key={`${extraIndex}-${answer}`}>{answer}<b>Distractors</b></span>)}</div>:<p>No extra answers added.</p>}</div>}</PreviewSection>
        <PreviewSection title="Advanced Settings" icon="target.svg" open={openSections.advanced} onToggle={()=>toggleSection("advanced")} className="cdPreviewAdvancedSection"><div className="cdPreviewSettingsGrid">{read.map(([label,value])=><PreviewReadValue key={label} label={label} value={value}/>)}</div><div className="cdPreviewLongValue"><span>Instruction shown to learners</span><div>{question.instructions||"—"}</div></div><div className="cdPreviewLongValue"><span>Information for graders</span><div>{question.graderInfo||"—"}</div></div></PreviewSection>
        <PreviewSection title="Grading Method" icon="quiz.svg" open={openSections.grading} onToggle={()=>toggleSection("grading")} className="cdPreviewGradingSection"><div className="cdPreviewSettingsGrid cdPreviewGradingGrid"><PreviewReadValue label="Grading Method" value={question.grading}/><PreviewReadValue label="Points (total for Question)" value={question.points}/><PreviewReadValue label="Negative Marking" value={question.negative}/></div><div className="cdPreviewToggleList"><PreviewToggle label="Partial Credit" enabled={question.partialCredit}/><PreviewToggle label="Calculate grade with a minimum score of 0" enabled={question.minZero}/><PreviewToggle label="Allow learner to move items between zones before submit" enabled={question.allowMove}/></div><div className="cdPreviewPairMarksBar"><span>Total of pair marks: {Number(question.pairs.reduce((sum,_,i)=>sum+marksFor(question,i),0).toFixed(2))} / {question.points}</span><strong>{Math.abs(question.pairs.reduce((sum,_,i)=>sum+marksFor(question,i),0)-Number(question.points))<0.001?"Matches Points":"Check Points"}</strong></div><div className="cdPreviewSimulatorTitle">Score Simulator - Outcome per Pairs</div><div className="cdPreviewSimulatorTable"><div className="cdPreviewSimulatorHead"><span>Outcome</span><span>Marks</span></div>{Array.from({length:question.pairs.length+1},(_,rowIndex)=>question.pairs.length-rowIndex).map(n=><div className="cdPreviewSimulatorRow" key={n}><span>{n} correct, {question.pairs.length-n} wrong</span><strong>{formatMarks(scoreFor(question,n))}</strong></div>)}</div></PreviewSection>
        <PreviewSection title="Feedback and Learning" open={openSections.learning} onToggle={()=>toggleSection("learning")} className="cdPreviewLearningSection"><div className="cdPreviewFeedbackCards"><section className="cdPreviewFeedbackCard cdFullFeedback"><h3><span>✓</span>Full Marks</h3><div>{question.feedbackFull||"—"}</div></section><section className="cdPreviewFeedbackCard cdPartialFeedback"><h3><span>•</span>Partial Marks</h3><div>{question.feedbackPartial||"—"}</div></section><section className="cdPreviewFeedbackCard cdZeroFeedback"><h3><span>×</span>Zero Marks</h3><div>{question.feedbackZero||"—"}</div></section><section className="cdPreviewFeedbackCard cdLearningText"><h3><Icon name="assignments.svg" size={17}/>Explanation</h3><div>{question.explanation||"—"}</div></section><section className="cdPreviewFeedbackCard cdLearningText"><h3><Icon name="idea.svg" size={17}/>Hint</h3><div>{question.hint||"—"}</div></section></div></PreviewSection>
        <PreviewSection title="Question Settings" open={openSections.settings} onToggle={()=>toggleSection("settings")} className="cdPreviewQuestionSettings"><div className="cdPreviewQuestionSettingGrid"><div><span>Difficulty</span><strong><Icon name="target.svg" size={16}/>{question.difficulty}</strong></div><div><span>Bloom’s Taxonomy</span><strong><Icon name="brain.svg" size={16}/>{question.bloom||"—"}</strong></div><div><span>Category</span><strong><Icon name="folder.svg" size={16}/>{question.category||"—"}</strong></div><div><span>Tags</span><strong><Icon name="tag.svg" size={16}/>{question.tags.join(", ")||"—"}</strong></div><div><span>Mandatory</span><strong><Icon name="circle-check.svg" size={16}/>{question.mandatory?"YES":"NO"}</strong></div></div></PreviewSection>
      </article>;
    }):<div className="cdPreviewEmpty"><p>{filter==="All Questions"?"No questions have been entered yet.":`No ${filter.toLowerCase()} questions found.`}</p><button type="button" onClick={onBack}>Back to Question</button></div>}
    <footer className="cdPreviewFooter"><button type="button" className="cdFooterPill" onClick={onBack}>Back to Question</button>{saving&&<span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</footer>
  </div>;
}

function QuestionBuilder(){
  const router=useRouter();
  const [values,setValues]=useState<AssessmentValues>(DEFAULT_VALUES);
  const [questions,setQuestions]=useState<DotQuestion[]>(()=>Array.from({length:20},()=>makeQuestion(false)));
  const [active,setActive]=useState(0);
  const [preview,setPreview]=useState(false);
  const [sections,setSections]=useState({question:false,advanced:false,pairs:false,grading:false,feedback:false});
  const [feedbackOpen,setFeedbackOpen]=useState({explanation:true,hint:true});
  const [richHtml,setRichHtml]=useState<Record<string,string>>({});
  const [extraDrafts,setExtraDrafts]=useState<Record<number,string>>({});
  const [notice,setNotice]=useState("");
  const [continuing,setContinuing]=useState(false);
  const continueTimer=useRef<number | null>(null);
  useEffect(()=>()=>{if(continueTimer.current) window.clearTimeout(continueTimer.current);},[]);
  const [showValidation,setShowValidation]=useState(false);
  const [tagInput,setTagInput]=useState("");
  const [addingTag,setAddingTag]=useState(false);
  const [ready,setReady]=useState(false);
  const numberRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const details=loadValues();setValues(details);
    let savedData:any=null;
    try{const raw=assessmentStorage.getItem(DRAFT_KEY);if(raw)savedData=JSON.parse(raw);}catch{/* Use a fresh draft. */}
    const stored=Array.isArray(savedData?.questions)?savedData.questions:[];
    setQuestions(Array.from({length:details.questionCount},(_,i)=>stored[i]?{...makeQuestion(false),...stored[i],questionMode:stored[i].questionMode||"Text Based",lineStyle:["Solid","Dashed","Dot style","Dash-dot"].includes(stored[i].lineStyle)?stored[i].lineStyle:"Solid",lineShape:stored[i].lineShape||"Straight",endPoint:stored[i].endPoint||"Circle",pairs:Array.isArray(stored[i].pairs)?(stored[i].questionMode==="Picture"?stored[i].pairs.map((p:DotPair)=>({...p,left:p.pictureOriginalLeft??p.left,right:p.pictureOriginalRight??p.right})):stored[i].pairs):Array.from({length:5},blankPair)}:makeQuestion(false)));
    if(savedData?.richHtml&&typeof savedData.richHtml==="object")setRichHtml(savedData.richHtml);
    if(Number.isInteger(savedData?.active))setActive(Math.min(details.questionCount-1,Math.max(0,savedData.active)));
    setReady(true);
  },[]);
  useEffect(()=>{if(!ready)return;try{saveDraft(questions,values,active,richHtml);}catch{setNotice("Could not save this draft in your browser.");}},[ready,questions,values,active,richHtml]);
  const question=questions[active]||makeQuestion();
  const completed=questions.slice(0,values.questionCount).filter(complete).length;
  const earned=questions.slice(0,values.questionCount).filter(complete).reduce((s,q)=>s+(Number(q.points)||0),0);
  const totalPairMarks=question.pairs.reduce((sum,_,i)=>sum+marksFor(question,i),0);
  const extraDraft=extraDrafts[active]||"";
  const update=(patch:Partial<DotQuestion>)=>{setQuestions(old=>old.map((q,i)=>i===active?{...q,...patch}:q));};
  const updatePair=(id:string,patch:Partial<DotPair>)=>update({pairs:question.pairs.map(p=>p.id===id?{...p,...patch}:p),scoreOverrides:{}});
  const choosePicture=async (id:string,file?:File)=>{
    if(!file)return;
    const allowed=/\.(png|jpe?g)$/i.test(file.name)&&(!file.type||["image/png","image/jpeg"].includes(file.type));
    if(!allowed){setNotice("Choose a PNG or JPG image.");return;}
    if(file.size===0||file.size>250*1024){setNotice("Picture must be a non-empty PNG or JPG, 250 KB or smaller.");return;}
    try {
      const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
      const png = bytes.length>=8 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71 && bytes[4]===13 && bytes[5]===10 && bytes[6]===26 && bytes[7]===10;
      const jpeg = bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
      if((/\.png$/i.test(file.name)&&!png)||(/\.jpe?g$/i.test(file.name)&&!jpeg)){
        setNotice("The selected file is not a valid PNG or JPG image. Videos and other files are not allowed.");return;
      }
    } catch { setNotice("Unable to validate the selected image.");return; }
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result!=="string"||!/^data:image\/(?:png|jpeg);base64,/i.test(reader.result)){
        setNotice("Unable to read the selected picture.");return;
      }
      setQuestions(previous=>previous.map((q,index)=>index===active?{...q,
        pairs:q.pairs.map(p=>p.id===id?{...p,pictureSrc:reader.result as string,pictureFileName:file.name}:p),
        scoreOverrides:{}
      }:q));
      setNotice("");
    };
    reader.onerror=()=>setNotice("Unable to read the selected picture.");
    reader.readAsDataURL(file);
  };
  const toggle=(key:keyof typeof sections)=>setSections(old=>({...old,[key]:!old[key]}));
  const jump=(index:number,requireValid=false)=>{
    if(requireValid&&errorsFor(question).length){setShowValidation(true);setNotice(errorsFor(question)[0]);return;}
    const next=Math.min(values.questionCount-1,Math.max(0,index));
    setActive(next);setNotice("");setShowValidation(false);
    const area=numberRef.current;
    const tile=area?.querySelectorAll<HTMLElement>(".mcqcQuestionNumber")[next];
    if(area&&tile)tile.scrollIntoView({behavior:"smooth",inline:"nearest",block:"nearest"});
  };
  const editor=(key:string,value:string,onChange:(v:string)=>void,placeholder:string,limits?:{maxWords?:number;showWordCount?:boolean})=><MCQRichEditor key={key} editorId={key} value={value} html={richHtml[key]} onChange={onChange} onHtmlChange={html=>setRichHtml(old=>({...old,[key]:html}))} placeholder={placeholder} onError={setNotice} maxWords={limits?.maxWords} showWordCount={limits?.showWordCount}/>;
  const saveExtra=()=>{
    const value=extraDraft.trim();
    if(!value){setNotice("Write an extra answer before saving.");return;}
    if(characters(value)>250){setNotice("Extra answer must be at most 250 characters.");return;}
    if(question.questionMode==="Numeric Value"&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)){setNotice("Numeric Value extra answers must contain numbers only.");return;}
    if(question.questionMode!=="Numeric Value"&&!/\p{L}/u.test(value)){setNotice("Extra answers must contain text, not numbers only.");return;}
    if([...question.pairs.map(p=>p.right),...question.extras].some(x=>x.trim().toLowerCase()===value.toLowerCase())){setNotice("Extra answer already exists.");return;}
    update({extras:[...question.extras,value]});setExtraDrafts(old=>({...old,[active]:""}));setNotice("");
    setRichHtml(old=>{const next={...old};delete next[`dot-extra-${active}-${question.extras.length}`];return next;});
  };
  const requireCurrentValid=()=>{
    if(extraDraft.trim()){
      setNotice("Save the pending extra answer first.");
      setSections(s=>({...s,pairs:true}));
      return false;
    }
    const errors=errorsFor(question);
    if(errors.length){
      setShowValidation(true);
      setNotice(errors[0]);
      setSections(s=>({...s,question:true,advanced:true,pairs:true,grading:true,feedback:true}));
      return false;
    }
    setShowValidation(false);
    setNotice("");
    return true;
  };
  const openPreview=()=>{setShowValidation(false);setNotice("");setPreview(true);};
  const continueToEvaluation=()=>{
    if(!ready || continuing)return;
    if(extraDraft.trim()){setNotice("Save the pending extra answer first.");setSections(s=>({...s,pairs:true}));return;}
    const invalid=questions.slice(0,values.questionCount).findIndex(q=>!complete(q));
    if(invalid!==-1){jump(invalid);setPreview(false);setShowValidation(true);setNotice(`Question ${invalid+1}: ${errorsFor(questions[invalid])[0]}`);return;}
    try{saveDraft(questions,values,active,richHtml);updateAssessment({questions:values.questionCount,marks:questions.slice(0,values.questionCount).reduce((sum,q)=>sum+Number(q.points||0),0)});setNotice("");setContinuing(true);continueTimer.current=window.setTimeout(()=>{setContinuing(false);router.push("/assessments/create/evaluation");},3000);}
    catch{setNotice("Unable to save this assessment.");}
  };
  const addPair=()=>{if(question.pairs.length>=20){setNotice("Maximum 20 pairs.");return;}update({pairs:[...question.pairs,blankPair()],scoreOverrides:{}});};
  const removePair=(id:string)=>{if(question.pairs.length<=2){setNotice("At least two pairs are required.");return;}update({pairs:question.pairs.filter(p=>p.id!==id),scoreOverrides:{}});};
  if(preview)return <ConnectDotsReviewPreview questions={questions.slice(0,values.questionCount)} values={values} saving={continuing} onBack={()=>setPreview(false)} onEdit={i=>{setPreview(false);jump(i);}} onContinue={continueToEvaluation}/>;
  return <div className="mcqcBuilder mcqcMatchBuilder mcqcConnectBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={()=>router.back()}>Create Assessment</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Antony?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading mcqcMatchQuestionsHeading"><div><h2>Question {active+1} of {values.questionCount}</h2><p>{values.questionCount} Question | {values.totalMarks} Marks</p></div><button type="button" className="mcqcBuilderAction mcqcTopAdd" onClick={()=>jump(active+1,true)} disabled={active>=values.questionCount-1}><Icon name="plus.svg" size={19}/>Add</button></div>
      <div className="mcqcNumberNavigation"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg" size={20}/></button><div className="mcqcQuestionNumbers" ref={numberRef}>{questions.slice(0,values.questionCount).map((q,i)=><button key={i} type="button" className={`mcqcQuestionNumber ${complete(q)?"is-complete":active===i?"is-active":"is-empty"}`} aria-current={active===i?"step":undefined} onClick={()=>jump(i)}><span>{i+1}</span><small>{"CD"}</small><i aria-hidden="true"/></button>)}</div><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=values.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg" size={20}/></button></div>
      <div className="mcqcQuestionProgress"><span style={{width:`${completed/Math.max(1,values.questionCount)*100}%`}}/></div>
      <div className="mcqcQuestionForm mcqcDDQuestionForm mcqcMatchQuestionForm">
        <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Connect the Dots" onChange={v=>setNotice(v==="Connect the Dots"?"":`${v} is a different question type. This page creates Connect the Dots questions.`)}/></div>
        <DragPanel title="Question and Connection Board" icon="grid-view.svg" open={sections.question} onToggle={()=>toggle("question")}>
          <div className="mcqcBuilderField mcqcWriteField"><label>Write your Question </label><div className="mcqcEditorSurface">{editor(`dot-question-${active}`,question.text,v=>update({text:v}),"Write your question...",{maxWords:250})}</div></div>
          <div className="mcqcDDThree"><div className="mcqcBuilderField"><label>Column A Heading</label><NeumoSelect value={question.columnA} options={["Data Structure","Term","Item","Concept","Name"]} onChange={v=>update({columnA:v})}/></div><div className="mcqcBuilderField"><label>Column B Heading</label><NeumoSelect value={question.columnB} options={["Description","Answer","Definition","Match","Meaning"]} onChange={v=>update({columnB:v})}/></div><div className="mcqcBuilderField"><label>Question Mode</label><NeumoSelect value={question.questionMode} options={["Text Based","Numeric Value","Picture"]} onChange={v=>{update({questionMode:v});if(v==="Numeric Value"||v==="Picture")setSections(old=>({...old,pairs:true}));}}/></div></div>
        </DragPanel>
        <DragPanel title="Advanced Settings" icon="target.svg" open={sections.advanced} onToggle={()=>toggle("advanced")}>
          <div className="mcqcDDThree">{([
            ["Connection mode","connectionMode",["One to one","One to many","Many to one","Many to many"]],
            ["Shuffle Left","shuffleLeft",["NO","YES"]],
            ["Shuffle Right Items","shuffleRight",["YES","NO"]],
            ["Line Style","lineStyle",["Solid","Dashed","Dot style","Dash-dot"]],
            ["Line Shape","lineShape",["Straight","Curved","Elbow (stepped)"]],
            ["End Point","endPoint",["Circle","Arrow","Square","Diamond","None"]],
            ["Line Colour","lineColour",["Blue","Green","Red"]],
            ["Dot Style","dotStyle",["Circle","Square"]],
            ["Layout","layout",["Two column","Stacked"]],
            ["Minimum connections to submit","minConnections",Array.from({length:question.pairs.length+1},(_,i)=>String(i))],
            ["Response Required","responseRequired",["Yes","No"]]
          ] as const).map(([label,key,opts])=><div className="mcqcBuilderField" key={key}><label>{label}</label><NeumoSelect value={typeof question[key]==="boolean"?(question[key]?key==="responseRequired"?"Yes":"YES":key==="responseRequired"?"No":"NO"):String(question[key])} options={[...opts]} onChange={v=>update({[key]:typeof question[key]==="boolean"?v.toLowerCase()==="yes":v})}/></div>)}</div>
          <div className="mcqcBuilderField mcqcAdvancedDescriptionField"><label>Instruction shown to learners </label><div className="mcqcEditorSurface">{editor(`dot-instructions-${active}`,question.instructions,v=>update({instructions:v}),"Instructions for connecting the dots...",{maxWords:250,showWordCount:false})}</div></div>
          <div className="mcqcBuilderField mcqcAdvancedDescriptionField"><label>Information for graders </label><div className="mcqcEditorSurface">{editor(`dot-grader-${active}`,question.graderInfo,v=>update({graderInfo:v}),"Instructions for graders...",{maxWords:250,showWordCount:false})}</div></div>
        </DragPanel>
        <DragPanel title="Matching Pairs" icon="adjust-position.svg" open={sections.pairs} onToggle={()=>toggle("pairs")}>
          {question.questionMode==="Picture" ? <>
            <div className="mcqcConnectPairHead mcqcPicturePairHead"><span/><strong>Data Structure</strong><strong>Description</strong><span/></div>
            <div className="mcqcMatchPairs mcqcPicturePairs">{question.pairs.map((p,i)=><div className="mcqcMatchPairRow mcqcConnectPairRow mcqcPicturePairRow" key={p.id}>
              <span className="mcqcDDLetter">{i+1}</span>
              <div className="mcqcPictureFileFrame">
                <PictureThumbnail src={pictureSource(p)} alt={`Diagram ${i+1}`}/>
                <div className="mcqcPictureFileControls">
                  <label className="mcqcPictureChooseFile">
                    <Icon name="upload.svg" size={14}/><span>Choose File</span>
                    <input className="mcqcPictureFileInput" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" aria-label={`Choose picture ${i+1}`} onChange={event=>{choosePicture(p.id,event.currentTarget.files?.[0]);event.currentTarget.value="";}}/>
                  </label>
                  <small title={p.pictureFileName||"No File Chosen"}>{p.pictureFileName||"No File Chosen"} PNG,JPG max 250kb</small>
                </div>
              </div>
              <label className="mcqcPictureAnswerFrame">
                <span>{i+1}.</span>
                <input type="text" aria-label={`Data Structure answer ${i+1}`} value={pictureAnswer(p)} onChange={event=>updatePair(p.id,{pictureAnswer:event.target.value})}/>
              </label>
              <button type="button" className="mcqcIconButton mcqcDDRemoveDrag" aria-label={`Remove pair ${i+1}`} disabled={question.pairs.length<=2} onClick={()=>removePair(p.id)}><Icon name="cancel-circle.svg" size={16}/></button>
            </div>)}</div>
          </> : question.questionMode==="Numeric Value" ? <>
            <div className="mcqcConnectPairHead mcqcNumericPairHead"><span/><strong>{question.columnA}</strong><strong>{question.columnB}</strong><span/></div>
            <div className="mcqcMatchPairs mcqcNumericPairs">{question.pairs.map((p,i)=><div className="mcqcMatchPairRow mcqcConnectPairRow mcqcNumericPairRow" key={p.id}>
              <span className="mcqcDDLetter">{i+1}</span>
              <DotPairField label={`Question ${i+1}`} mode="Text Based" value={p.left} onChange={v=>updatePair(p.id,{left:v})}/>
              <DotPairField label={`Numeric value ${i+1}`} mode="Numeric Value" numericOnly value={p.right} onChange={v=>updatePair(p.id,{right:v})}/>
              <button type="button" className="mcqcIconButton mcqcDDRemoveDrag" aria-label={`Remove pair ${i+1}`} disabled={question.pairs.length<=2} onClick={()=>removePair(p.id)}><Icon name="cancel-circle.svg" size={16}/></button>
            </div>)}</div>
          </> : <>
            <div className="mcqcConnectPairHead"><span/><strong>{question.columnA}</strong><strong>{question.columnB}</strong><span/></div>
            <div className="mcqcMatchPairs">{question.pairs.map((p,i)=><div className="mcqcMatchPairRow mcqcConnectPairRow" key={p.id}>
              <span className="mcqcDDLetter">{i+1}</span>
              <DotPairField label={`${question.columnA} ${i+1}`} mode={question.questionMode} noLimit={question.questionMode==="Text Based"} value={p.left} onChange={v=>updatePair(p.id,{left:v})}/>
              <DotPairField label={`${question.columnB} ${i+1}`} mode={question.questionMode} noLimit={question.questionMode==="Text Based"} value={p.right} maxWords={question.questionMode==="Text Based"?undefined:250} onLimit={()=>setNotice("Description allows a maximum of 250 words.")} onChange={v=>updatePair(p.id,{right:v})}/>
              {question.questionMode!=="Text Based"&&<small className="mcqcConnectDescriptionWordCount" aria-label={`${words(p.right)} of 250 words in ${question.columnB} ${i+1}`}>{words(p.right)}/250</small>}
              <button type="button" className="mcqcIconButton mcqcDDRemoveDrag" aria-label={`Remove pair ${i+1}`} disabled={question.pairs.length<=2} onClick={()=>removePair(p.id)}><Icon name="cancel-circle.svg" size={16}/></button>
            </div>)}</div>
          </>}
          <div className="mcqcMatchPairActions"><button type="button" className="mcqcBuilderAction mcqcDDAddSmall" onClick={addPair}><Icon name="plus.svg" size={16}/>Add Pairs</button><small>2 to 20 Pairs</small></div>
          <div className="mcqcMatchExtras"><div className="mcqcDDToggleRow"><span>Extra Answers (Distractors) Optional</span><Switch label="Extra answers" checked={question.extraEnabled} onChange={v=>update({extraEnabled:v})}/></div>
            {question.extraEnabled&&<><div className="mcqcMatchExtraEditor"><div className="mcqcEditorSurface">{editor(`dot-extra-${active}-${question.extras.length}`,extraDraft,v=>setExtraDrafts(old=>({...old,[active]:v})),"Write an extra answer...",{maxWords:250})}</div><div className="mcqcMatchExtraSaveRow"><button type="button" className="mcqcMatchExtraSave" onClick={saveExtra}>Save</button></div></div>
              {question.extras.length>0&&<div className="mcqcConnectExtraChips">{question.extras.map((x,i)=><button type="button" key={i} onClick={()=>update({extras:question.extras.filter((_,j)=>i!==j)})}>{x}<Icon name="cancel.svg" size={14}/></button>)}</div>}
              <div className="mcqcMatchExtraActions"><button type="button" className="mcqcBuilderAction mcqcDDAddSmall" onClick={()=>{if(extraDraft.trim())saveExtra();else document.getElementById(`dot-extra-${active}-${question.extras.length}`)?.focus();}}><Icon name="plus.svg" size={16}/>Add Extra Answer</button></div></>}
          </div>
        </DragPanel>
        <DragPanel title="Grading Method" icon="quiz.svg" open={sections.grading} onToggle={()=>toggle("grading")}>
          <div className="mcqcDDThree"><div className="mcqcBuilderField"><label>Grading Method</label><NeumoSelect value={question.grading} options={["Equal Marks","Custom"]} onChange={v=>update({grading:v as DotQuestion["grading"],scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Points (total for Question)</label><NeumoSelect value={question.points} options={["1","2","3","4","5","6","8","10","15","20","25","30","40","50"]} onChange={v=>update({points:v,scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Negative Marking</label><NeumoSelect value={question.negative} options={["NA","0","0.25","0.5","1"]} onChange={v=>update({negative:v,scoreOverrides:{}})}/></div></div>
          {question.grading==="Custom"&&question.pairs.map((p,i)=><label key={p.id} className="mcqcDDCustomZone">Pair {i+1} marks<input type="number" min="0" step="0.5" value={p.marks} onChange={e=>updatePair(p.id,{marks:e.target.value})}/></label>)}
          <div className="mcqcDDToggleRow"><span>Partial Credit</span><Switch label="Partial Credit" checked={question.partialCredit} onChange={v=>update({partialCredit:v,scoreOverrides:{}})}/></div>
          <div className="mcqcDDToggleRow"><span>Calculate grade with a minimum score of 0</span><Switch label="Minimum score of 0" checked={question.minZero} onChange={v=>update({minZero:v,scoreOverrides:{}})}/></div>
          <div className="mcqcDDToggleRow"><span>Allow learner to move items between zones before submit</span><Switch label="Allow changes before submit" checked={question.allowMove} onChange={v=>update({allowMove:v})}/></div>
          <div className="mcqcDDScoreCheck">Total of pair marks: {Number(totalPairMarks.toFixed(2))} / {question.points}<strong className={Math.abs(totalPairMarks-Number(question.points))<0.001?"mcqcDDCorrect":"mcqcDDDistractor"}>{Math.abs(totalPairMarks-Number(question.points))<0.001?"Matches Points":"Check Points"}</strong></div>
          <div className="mcqcBuilderField"><label>Score Simulator - Outcome per Pairs</label><div className="mcqcDDScoreTable"><div className="mcqcDDScoreHead"><span>Outcome</span><span>Marks</span></div>{Array.from({length:question.pairs.length+1},(_,i)=>question.pairs.length-i).map(n=><div className="mcqcDDScoreRow" key={n}><span>{n} correct, {question.pairs.length-n} wrong</span><NeumoSelect value={formatMarks(scoreFor(question,n))} options={Array.from({length:Math.max(1,Math.floor(Number(question.points))+1)},(_,i)=>formatMarks(i)).reverse()} onChange={v=>update({scoreOverrides:{...question.scoreOverrides,[String(n)]:String(Number(v))}})}/></div>)}</div></div>
        </DragPanel>
        <DragPanel title="Feedback" icon="message-circle-more.svg" subtitle={`${Math.max(characters(question.feedbackFull),characters(question.feedbackPartial),characters(question.feedbackZero))}/250`} open={sections.feedback} onToggle={()=>toggle("feedback")}>
          {([['Full Marks','feedbackFull','Write feedback for full marks...'],['Partial Marks','feedbackPartial','Write feedback for partial marks...'],['Zero Marks','feedbackZero','Write feedback for zero marks...']] as const).map(([title,key,placeholder])=><div className={`mcqcBuilderField mcqcDDFeedbackField mcqcDDFeedback${key}`} key={key}><label>{title}</label><div className="mcqcEditorSurface">{editor(`dot-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder,{maxWords:250})}</div></div>)}
          {([['Explanation','explanation','assignments.svg','Explain the correct connections...'],['Hint','hint','idea.svg','Write a hint...']] as const).map(([title,key,icon,placeholder])=><div className="mcqcDDFeedbackSubpanel" key={key}><button type="button" className="mcqcDDFeedbackSubhead" aria-expanded={feedbackOpen[key]} onClick={()=>setFeedbackOpen(old=>({...old,[key]:!old[key]}))}><span className="mcqcDDPanelHeading"><span className="mcqcDDPanelIcon"><Icon name={icon} size={18}/></span><strong>{title}</strong></span><Icon name="arrow-down-01.svg" size={18} className={feedbackOpen[key]?"mcqcRotated":""}/></button>{feedbackOpen[key]&&<div className="mcqcDDFeedbackSubbody"><div className="mcqcEditorSurface">{editor(`dot-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder,{maxWords:250})}</div>{key==="hint"&&<div className="mcqcHintChecks"><label className={question.showCorrectCount?"is-checked":""}><input type="checkbox" checked={question.showCorrectCount} onChange={e=>update({showCorrectCount:e.target.checked})}/>Show number of correct connections after finishing</label><label className={question.showConnectionsAfterTrial?"is-checked":""}><input type="checkbox" checked={question.showConnectionsAfterTrial} onChange={e=>update({showConnectionsAfterTrial:e.target.checked})}/>Show correct connections after final try</label><label className={question.showHintBeforeAnswering?"is-checked":""}><input type="checkbox" checked={question.showHintBeforeAnswering} onChange={e=>update({showHintBeforeAnswering:e.target.checked})}/>Show hint before answering</label><label className={question.allowHintRequest?"is-checked":""}><input type="checkbox" checked={question.allowHintRequest} onChange={e=>update({allowHintRequest:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>)}
        </DragPanel>
        {showValidation&&errorsFor(question).length>0&&<div className="mcqcValidationErrors" role="alert">{errorsFor(question).map(err=><p key={err}>{err}</p>)}</div>}
      </div>
      <div className="mcqcBuilderBottom"><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" disabled={active>=values.questionCount-1} onClick={()=>jump(active+1,true)}><Icon name="plus.svg" size={20}/>Add Questions</button><div className="mcqcBuilderArrows"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg"/></button><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=values.questionCount-1} onClick={()=>jump(active+1,true)}><Icon name="arrowright.svg"/></button></div></div>
    </section>
    <aside className="mcqcBuilderAside mcqcMatchAside"><section className="mcqcAsideSection"><h3>Question Settings</h3>
      <div className="mcqcBuilderField"><label htmlFor="dot-points">Points</label><input id="dot-points" className="mcqcConnectPoints" type="number" min="1" step="1" value={question.points} onChange={e=>update({points:e.target.value,scoreOverrides:{}})}/></div>
      <div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={question.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div>
      <div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={question.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div>
      <div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={question.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div>
      <div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button type="button" className="mcqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag&&<input className="mcqcTagInput" autoFocus aria-label="New tag" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tagInput.trim()){e.preventDefault();update({tags:[...new Set([...question.tags,tagInput.trim()])]});setTagInput("");setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{question.tags.map(tag=><button type="button" key={tag} onClick={()=>update({tags:question.tags.filter(t=>t!==tag)})}>{tag}<Icon name="cancel.svg" size={14}/></button>)}</div></div>
      <div className="mcqcMandatory"><span>Mandatory</span><Switch label="Mandatory question" checked={question.mandatory} onChange={v=>update({mandatory:v})}/></div><p className="mcqcAsideHint">This Question is {question.mandatory?"Mandatory":"Optional"}</p>
    </section><section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{completed}</strong><span>Questions</span></div><div><strong>{earned}</strong><span>Marks</span></div><div><strong>{values.duration}</strong><span>Minutes</span></div></div><div className="mcqcSummaryProgress"><span style={{width:`${completed/Math.max(1,values.questionCount)*100}%`}}/></div><p>Target is {values.questionCount} questions · {values.totalMarks} marks. {completed===values.questionCount?"All questions are ready.":"Add questions to get started."}</p><div className="mcqcBuilderField"><label>Passing Score</label><PassingScoreSelect value={values.passingScore} onChange={v=>setValues(old=>({...old,passingScore:v}))}/></div></section></aside>
    </div>
    {notice&&<p className="mcqcBuilderNotice" role="status">{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" disabled={continuing} onClick={()=>router.push("/assessments/create/details")}>Back</button><button type="button" className="mcqcFooterPill" onClick={openPreview}>Preview Questions</button><div className="mcqcSaveContinueGroup">{continuing && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={continuing} onClick={continueToEvaluation}>Save &amp; Continue</button></div></div>
  </div>;
}
export default function ConnectDotsPage(){
  return <main className="mcqcAppShell"><div className="mcqcLayout"><Sidebar/><section className="mcqcMainContent"><div className="mcqcHeader"><Header/></div><div className="mcqcScrollArea"><div className="mcqcPageContent"><QuestionBuilder/></div></div></section></div></main>;
}
