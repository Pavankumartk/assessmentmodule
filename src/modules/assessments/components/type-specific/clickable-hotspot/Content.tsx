"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, type ReactNode, type PointerEvent, type FormEvent, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./clickablehotspot.css";
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
    const closeOutside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
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
  useEffect(() => { if (!open) return; const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
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
    const outside=(event:Event)=>{const target=event.target as Node;if(!trigger.current?.contains(target)&&!menu.current?.contains(target))setOpen(false);};
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
type HotspotRegion = {
  id: string; label: string; role: "Correct" | "Wrong"; comment: string;
  x: number; y: number; width: number; height: number; correct: boolean;
  marks: string;
};
type DotQuestion = {
  type: "Clickable Hotspot"; text: string; questionMode: string;
  imageSrc: string; imageFileName: string; imageAlt?: string; markerStyle?: string; markerColour?: string; showOutlines?: boolean; allowZoom?: boolean;
  hotspots: HotspotRegion[]; maxMarkers: number; clicksOutsideWrong: boolean;
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
const DRAFT_KEY = "clickableHotspotContentDraft";
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

// Images are supplied by the creator; no preselected example images or hotspots.
function makeQuestion(sample=false):DotQuestion {
  return {
    type:"Clickable Hotspot", imageSrc:"", imageFileName:"", imageAlt:"", markerStyle:"Cross Hair",markerColour:"Green",showOutlines:true,allowZoom:true, hotspots:[], maxMarkers:1, clicksOutsideWrong:true,
    text:sample?"Click the part of the CPU that does calculations.":"",
    questionMode:"Text Based",columnA:"Data Structure",columnB:"Description",
    connectionMode:"One to one",shuffleLeft:false,shuffleRight:true,
    lineStyle:"Solid",lineShape:"Straight",endPoint:"Circle",lineColour:"Blue",dotStyle:"Circle",layout:"Two column",
    minConnections:"0",responseRequired:true,
    instructions:sample?"Click a dot on the left, then a dot on the right – or drag a line between them. Click a line to remove it.":"",
    graderInfo:sample?"Accept only the connections in the answer key.":"",
    pairs:[],
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
function hasData(q:DotQuestion){return Boolean(q.text.trim()||q.imageSrc||q.hotspots.length||q.feedbackFull.trim());}
function errorsFor(q:DotQuestion):string[] {
  const errors:string[]=[];
  if(!q.text.trim())errors.push("Write your question.");
  if(characters(q.text)>250)errors.push("Question must be 250 characters or fewer, including spaces.");
  if(!q.imageSrc || !/^data:image\/(?:png|jpeg);base64,|^\/(?!\/)/i.test(q.imageSrc))errors.push("Choose a PNG or JPG question image.");
  if(!q.hotspots.length)errors.push("Add at least one hotspot on the image.");
  if(q.hotspots.length>20)errors.push("Maximum 20 hotspots per question.");
  if(q.hotspots.some(h=>!h.label.trim()))errors.push("Enter a name for each hotspot.");
  if(q.hotspots.some(h=>!h.comment.trim()))errors.push("Enter a comment when clicked for each hotspot.");
  if(q.hotspots.length && !q.hotspots.some(h=>h.role==="Correct"))errors.push("Mark at least one hotspot as Correct.");
  if(q.hotspots.some(h=>h.x<0||h.y<0||h.width<=0||h.height<=0||h.x+h.width>100.01||h.y+h.height>100.01))errors.push("Hotspots must remain inside the uploaded image.");
  if(q.maxMarkers<1||q.maxMarkers>20)errors.push("Markers must be between 1 and 20.");
  if(!Number.isFinite(Number(q.points))||Number(q.points)<=0)errors.push("Points must be greater than zero.");
  if(q.grading==="Custom"&&q.hotspots.some(h=>h.marks.trim()===""||Number(h.marks)<0))errors.push("Enter non-negative marks for every hotspot.");
  if(q.grading==="Custom"&&Math.abs(q.hotspots.reduce((n,h)=>n+Number(h.marks||0),0)-Number(q.points))>.001)errors.push("Custom marks must equal total question points.");
  if(!q.category||!q.bloom)errors.push("Choose Category and Bloom’s Taxonomy.");
  if(!q.feedbackFull.trim()||!q.feedbackPartial.trim()||!q.feedbackZero.trim())errors.push("Enter feedback for full, partial, and zero marks.");
  if([q.feedbackFull,q.feedbackPartial,q.feedbackZero,q.explanation,q.hint].some(t=>characters(t)>250))errors.push("Rich-text editors allow 250 characters including spaces.");
  if(!q.explanation.trim())errors.push("Enter an explanation.");
  if((q.showHintBeforeAnswering||q.allowHintRequest)&&!q.hint.trim())errors.push("Enter a hint before enabling the hint option.");
  return errors;
}
const complete=(q:DotQuestion)=>errorsFor(q).length===0;
const marksFor=(q:DotQuestion,index:number)=>q.grading==="Custom"?Number(q.hotspots[index]?.marks||0):Number(q.points)/Math.max(1,q.hotspots.length);
function scoreFor(q:DotQuestion,correct:number){
  const override=q.scoreOverrides[String(correct)];
  if(override!==undefined&&override!==""&&Number.isFinite(Number(override)))return Number(override);
  const correctRegions=q.hotspots.filter(h=>h.role==="Correct").length;
  const score=q.partialCredit?Math.min(1,correct/Math.max(1,correctRegions))*Number(q.points):correct>=correctRegions?Number(q.points):0;
  const negative=q.negative==="NA"?0:Number(q.negative)||0;
  return q.minZero?Math.max(0,score-negative):score-negative;
}
function loadValues():AssessmentValues {
  for (const key of ["mcqAssessmentDraft", "clickableHotspotAssessmentDraft"]) {
    try {
      const value = assessmentStorage.getItem(key);
      if (!value) continue;
      const parsed = JSON.parse(value);
      const details = {...parsed, ...(parsed.settings||{}), ...(parsed.details||{})};
      if (!("questionCount" in details) && !("totalQuestions" in details)) continue;
      return {
        questionCount: Math.min(100, Math.max(1, Math.floor(num(details.questionCount??details.totalQuestions,20)))),
        totalMarks: num(details.totalMarks??details.maximumMarks,40),
        duration: num(details.duration??details.durationMinutes,60),
        passingScore: String(details.passingScore||"60%"),
      };
    } catch { /* Keep saved creator data isolated to the active assessment. */ }
  }
  return DEFAULT_VALUES;
}
function saveDraft(questions:DotQuestion[],values:AssessmentValues,active:number,richHtml:Record<string,string>){
  const data={type:"Clickable Hotspot",questions:questions.slice(0,values.questionCount).map(q=>({
    ...q,type:"Clickable Hotspot",hotspot:{imageSrc:q.imageSrc,maxMarkers:q.maxMarkers,
      areas:q.hotspots.map(h=>({id:h.id,label:h.label,x:h.x,y:h.y,width:h.width,height:h.height,correct:h.role==="Correct",comment:h.comment}))},
    hotspots:q.hotspots.map(h=>({...h,correct:h.role==="Correct"}))
  })),details:values,active,richHtml,savedAt:new Date().toISOString()};
  const serialized=JSON.stringify(data);
  assessmentStorage.setItem(DRAFT_KEY, serialized);
  return data;
}
function HotspotArtwork({question,onCreate,onRemove,showRegions=false,selectedIds=[]}:{
  question:DotQuestion;onCreate?:(rect:{x:number;y:number;width:number;height:number})=>void;
  onRemove?:(id:string)=>void;showRegions?:boolean;selectedIds?:string[];
}){
  const canvas=useRef<HTMLDivElement>(null);
  const image=useRef<HTMLImageElement>(null);
  const drag=useRef<{x:number;y:number;id:number}|null>(null);
  const [bounds,setBounds]=useState({left:0,top:0,width:0,height:0});
  useEffect(()=>{
    const recalc=()=>{
      const el=canvas.current,im=image.current;
      if(!el||!im||!im.naturalWidth||!im.naturalHeight)return;
      const outer=el.getBoundingClientRect();
      const scale=Math.min(outer.width/im.naturalWidth,outer.height/im.naturalHeight);
      const width=im.naturalWidth*scale,height=im.naturalHeight*scale;
      setBounds({left:(outer.width-width)/2,top:(outer.height-height)/2,width,height});
    };
    recalc();const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(recalc):null;
    if(canvas.current)observer?.observe(canvas.current);
    window.addEventListener("resize",recalc);
    return()=>{observer?.disconnect();window.removeEventListener("resize",recalc);};
  },[question.imageSrc]);
  const geometry={left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height};
  const point=(clientX:number,clientY:number)=>{
    const rect=canvas.current?.getBoundingClientRect();
    if(!rect||bounds.width===0||bounds.height===0)return null;
    const x=(clientX-rect.left-bounds.left)/bounds.width*100;
    const y=(clientY-rect.top-bounds.top)/bounds.height*100;
    return x<0||x>100||y<0||y>100?null:{x,y};
  };
  const begin=(event:PointerEvent<HTMLDivElement>)=>{
    if(!onCreate||!question.imageSrc||event.target!==event.currentTarget)return;
    const p=point(event.clientX,event.clientY);if(!p)return;
    drag.current={...p,id:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);
  };
  const end=(event:PointerEvent<HTMLDivElement>)=>{
    const start=drag.current;drag.current=null;
    if(!onCreate||!start||start.id!==event.pointerId)return;
    const finish=point(event.clientX,event.clientY)||start;
    const dx=Math.abs(finish.x-start.x),dy=Math.abs(finish.y-start.y);
    const click=dx<2&&dy<2;
    const width=click?14:Math.max(3,dx),height=click?16:Math.max(3,dy);
    const x=Math.max(0,Math.min(100-width,click?start.x-width/2:Math.min(start.x,finish.x)));
    const y=Math.max(0,Math.min(100-height,click?start.y-height/2:Math.min(start.y,finish.y)));
    onCreate({x,y,width,height});
  };
  return <div className="mcqcHotspotOuter"><div className="mcqcHotspotInner"><div className="mcqcHotspotCanvas" ref={canvas}>
    {question.imageSrc? <>
      <img ref={image} src={question.imageSrc} alt={question.imageAlt || "Clickable hotspot question illustration"} className="mcqcHotspotImage" style={geometry} onLoad={()=>{
        const el=canvas.current,im=image.current;if(!el||!im||!im.naturalWidth)return;
        const r=el.getBoundingClientRect();const scale=Math.min(r.width/im.naturalWidth,r.height/im.naturalHeight);
        const w=im.naturalWidth*scale,h=im.naturalHeight*scale;
        setBounds({left:(r.width-w)/2,top:(r.height-h)/2,width:w,height:h});
      }}/>
      {bounds.width>0&&<div className="mcqcHotspotImageLayer" style={geometry} onPointerDown={begin} onPointerUp={end} role={onCreate?"button":undefined} tabIndex={onCreate?0:undefined} aria-label={onCreate?"Click or drag to create a hotspot region":undefined} onKeyDown={event=>{if(onCreate&&(event.key==="Enter"||event.key===" ")){event.preventDefault();onCreate({x:43,y:42,width:14,height:16});}}}>
        {(showRegions?question.hotspots:question.hotspots.filter(h=>selectedIds.includes(h.id))).map(h=><button key={h.id} type="button" className={`mcqcHotspotRegion ${h.role==="Correct"?"is-correct":"is-wrong"}`} style={{left:`${h.x}%`,top:`${h.y}%`,width:`${h.width}%`,height:`${h.height}%`}} aria-label={`${h.label}: ${h.role}. ${onRemove?"Click to remove region":""}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onRemove?.(h.id);}}><span>{h.label}</span>{h.role==="Correct"&&<span className="mcqcHotspotTarget"><Icon name="gtarget.svg" size={17}/></span>}</button>)}
      </div>}
    </>:<div className="mcqcHotspotNoImage"><Icon name="image.svg" size={24}/><span>No image selected. Choose a PNG or JPG image above.</span></div>}
  </div></div></div>;
}
function HotspotLearnerPreview({question,onClose}:{question:DotQuestion;onClose:()=>void}){
  const [selected,setSelected]=useState<string[]>([]);const [submitted,setSubmitted]=useState(false);
  const add=(rect:{x:number;y:number;width:number;height:number})=>{
    if(submitted)return;
    const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
    const selectedArea=question.hotspots.find(h=>x>=h.x&&x<=h.x+h.width&&y>=h.y&&y<=h.y+h.height);
    if(selectedArea)setSelected(old=>old.includes(selectedArea.id)?old.filter(id=>id!==selectedArea.id):[...old.filter(id=>id!==selectedArea.id),selectedArea.id].slice(-question.maxMarkers));
  };
  const right=selected.filter(id=>question.hotspots.find(h=>h.id===id)?.role==="Correct").length;
  return <div className="mcqcConnectPreview"><div className="mcqcConnectPreviewTop"><div><h2>Learner Preview · Clickable Hotspot</h2><p>{question.text}</p></div><button type="button" className="mcqcFooterPill" onClick={onClose}>Back to Preview Questions</button></div>
    <div className="mcqcConnectPreviewCard"><p>Click inside the image to select a hotspot. Click the highlighted region again to remove it. Markers: {question.maxMarkers}</p>
      <HotspotArtwork question={question} onCreate={add} showRegions={false} selectedIds={selected} onRemove={id=>setSelected(old=>old.filter(x=>x!==id))}/>
      <div className="mcqcConnectPreviewActions"><button type="button" className="mcqcFooterPill" onClick={()=>{setSelected([]);setSubmitted(false);}}>Retry</button><button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={!selected.length||submitted} onClick={()=>setSubmitted(true)}>Submit</button></div>
      {submitted&&<div className="mcqcConnectResult"><strong>{right} correct · {formatMarks(scoreFor(question,right))} marks</strong><p>{right>0?question.feedbackFull:question.feedbackZero}</p></div>}
    </div></div>;
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
  const [openSections,setOpenSections]=useState<Record<string,boolean>>({pairs:true,advanced:false,grading:true,learning:true,settings:true});
  const toggleSection=(key:string)=>setOpenSections(current=>({...current,[key]:!current[key]}));
  const filled=questions.map((question,index)=>({question,index})).filter(({question})=>hasData(question));
  const visible=filled.filter(({question})=>filter==="All Questions"||(filter==="Complete"?complete(question):!complete(question)));
  const ready=questions.length>0&&questions.every(complete);
  if(learnerIndex!==null)return <HotspotLearnerPreview question={questions[learnerIndex]} onClose={()=>setLearnerIndex(null)}/>;
  return <div className="cdPreviewPage">
    <nav className="cdPreviewBreadcrumb" aria-label="Preview breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={17}/><button type="button" onClick={onBack}>Create Assessment</button><Icon name="arrowrightdouble.svg" size={17}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={17}/><strong>Preview Questions</strong></nav>
    <div className="cdPreviewHeading"><div><h1>Preview Questions</h1><p>Review Your Questions Before Saving.</p></div></div>
    <div className="cdPreviewOverview"><div className="cdPreviewStats"><div><strong>{values.questionCount}</strong><span>Questions</span></div><div><strong>{values.totalMarks}</strong><span>Marks</span></div><div className={`cdPreviewReady ${ready?"is-ready":""}`}><span className="cdReadyIcon">{ready?"✓":"!"}</span><span><strong>{ready?"Ready":"In Progress"}</strong><small>{ready?"All good to continue":"Review incomplete questions"}</small></span></div></div><div className="cdPreviewTools"><div className="cdPreviewFilterRoot"><button type="button" className="cdPreviewFilterButton" aria-expanded={filterOpen} onClick={()=>setFilterOpen(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{filterOpen&&<div className="cdPreviewFilterMenu">{["All Questions","Complete","Incomplete"].map(option=><button type="button" key={option} className={filter===option?"is-selected":""} onClick={()=>{setFilter(option);setFilterOpen(false);}}>{option}</button>)}</div>}</div><button type="button" className="cdPreviewLearnerButton" onClick={()=>setLearnerIndex(visible[0]?.index??filled[0]?.index??0)} disabled={!filled.length}><Icon name="view.svg" size={17}/>Learner Preview</button></div></div>
    {visible.length?visible.map(({question,index})=>{
      const valid=complete(question);
      const pairMarks=question.hotspots.length?Number(question.points)/question.hotspots.length:0;
      const read=[
        ["Connection mode",question.connectionMode],["Shuffle Left",question.shuffleLeft?"YES":"NO"],["Shuffle Right Items",question.shuffleRight?"YES":"NO"],
        ["Line Style",question.lineStyle],["Line Shape",question.lineShape],["End Point",question.endPoint],
        ["Line Colour",question.lineColour],["Dot Style",question.dotStyle],["Layout",question.layout],
        ["Minimum connections to submit",question.minConnections],["Response Required",question.responseRequired?"Yes":"No"]
      ];
      return <article className="cdPreviewQuestion" key={index}>
        <div className="cdPreviewMeta"><span className="cdPreviewTypePill">Clickable Hotspot : {question.points} Points</span><span className="cdPreviewStatusPill">Status: <b className={valid?"is-complete":"is-incomplete"}>{valid?"Complete":"Incomplete"}</b></span><button type="button" className="cdPreviewEditButton" onClick={()=>onEdit(index)}><Icon name="edit.svg" size={15}/>Edit</button></div>
        <section className="cdPreviewPromptCard"><h2>Question {index+1}</h2><div className="cdPreviewPromptText">{question.text||"Question has not been written yet."}</div></section>
        <PreviewSection title="Hotspots (Each row is one clickable region)" icon="adjust-position.svg" open={openSections.pairs} onToggle={()=>toggleSection("pairs")} className="cdPreviewPairsSection">
          <HotspotArtwork question={question} showRegions={true}/>
          <div className="clickableReviewHead"><span>NR</span><span>Hotspots</span><span>Role</span><span>Comment when click</span></div>
          {question.hotspots.map((h,i)=><div className="clickableReviewRow" key={h.id}>
            <span className="clickableReviewValue">{i+1}</span><span className="clickableReviewValue">{h.label||"—"}</span>
            <span className="clickableReviewRoleFrame"><span className={`clickableRole ${h.role==="Correct"?"is-correct":"is-wrong"}`}>{h.role}</span></span>
            <span className="clickableReviewValue">{h.comment||"—"}</span>
          </div>)}
        </PreviewSection>
        <PreviewSection title="Grading Method" icon="quiz.svg" open={openSections.grading} onToggle={()=>toggleSection("grading")} className="cdPreviewGradingSection"><div className="cdPreviewSettingsGrid cdPreviewGradingGrid">
          <PreviewReadValue label="Grading Method" value={question.grading}/><PreviewReadValue label="Points (total for Question)" value={question.points}/><PreviewReadValue label="Negative Marking" value={question.negative}/>
        </div><div className="cdPreviewToggleList"><PreviewToggle label="Clicks outside every hotspot count as wrong" enabled={question.clicksOutsideWrong}/><PreviewToggle label="Calculate grade with a minimum score of 0" enabled={question.minZero}/></div></PreviewSection>
        <PreviewSection title="Feedback and Learning" open={openSections.learning} onToggle={()=>toggleSection("learning")} className="cdPreviewLearningSection"><div className="cdPreviewFeedbackCards"><section className="cdPreviewFeedbackCard cdFullFeedback"><h3><span className="clickableFeedbackHeadingIcon clickableFeedbackHeadingIconFull"><Icon name="circle-check.svg" size={15}/></span>Full Marks</h3><div>{question.feedbackFull||"—"}</div></section><section className="cdPreviewFeedbackCard cdPartialFeedback"><h3><span className="clickableFeedbackHeadingIcon clickableFeedbackHeadingIconPartial"><Icon name="quiz.svg" size={15}/></span>Partial Marks</h3><div>{question.feedbackPartial||"—"}</div></section><section className="cdPreviewFeedbackCard cdZeroFeedback"><h3><span className="clickableFeedbackHeadingIcon clickableFeedbackHeadingIconZero"><Icon name="cancel-circle.svg" size={15}/></span>Zero Marks</h3><div>{question.feedbackZero||"—"}</div></section><section className="cdPreviewFeedbackCard cdLearningText"><h3><span className="clickableFeedbackHeadingIcon clickableFeedbackHeadingIconExplanation"><Icon name="assignments.svg" size={15}/></span>Explanation</h3><div>{question.explanation||"—"}</div></section><section className="cdPreviewFeedbackCard cdLearningText"><h3><span className="clickableFeedbackHeadingIcon clickableFeedbackHeadingIconHint"><Icon name="idea.svg" size={15}/></span>Hint</h3><div>{question.hint||"—"}</div></section></div></PreviewSection>
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
  const [sections,setSections]=useState({question:true,advanced:false,pairs:true,grading:false,feedback:false});
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
    setQuestions(Array.from({length:details.questionCount},(_,i)=>{
      if(!stored[i])return makeQuestion(false);
      const saved=stored[i];
      // Older sample thumbnails are not creator uploads. Remove only those demos.
      const wasDemo=/^\/assets\/assessmenticons\/clickable-(?:cpu|cloud|network|hardware)-example\.png$/i.test(saved.imageSrc||"");
      return {...makeQuestion(false),...saved,type:"Clickable Hotspot",
        imageSrc:wasDemo?"":saved.imageSrc||"",
        imageFileName:wasDemo?"":saved.imageFileName||"",
        hotspots:wasDemo?[]:Array.isArray(saved.hotspots)?saved.hotspots:[],
        maxMarkers:Number(saved.maxMarkers)||1};
    }));
    if(savedData?.richHtml&&typeof savedData.richHtml==="object")setRichHtml(savedData.richHtml);
    if(Number.isInteger(savedData?.active))setActive(Math.min(details.questionCount-1,Math.max(0,savedData.active)));
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!ready || continuing)return;
    try{saveDraft(questions,values,active,richHtml);}catch{setNotice("Image draft could not be saved. Use a smaller PNG/JPG before refreshing.");}
  },[questions,values,active,richHtml,ready]);
  const question=questions[active]||makeQuestion();
  const completed=questions.slice(0,values.questionCount).filter(complete).length;
  const earned=questions.slice(0,values.questionCount).filter(complete).reduce((s,q)=>s+(Number(q.points)||0),0);
  const totalPairMarks=question.hotspots.reduce((sum,_,i)=>sum+marksFor(question,i),0);
  const extraDraft=extraDrafts[active]||"";
  const update=(patch:Partial<DotQuestion>)=>{setQuestions(old=>old.map((q,i)=>i===active?{...q,...patch}:q));};
  const updatePair=(id:string,patch:Partial<DotPair>)=>update({pairs:question.pairs.map(p=>p.id===id?{...p,...patch}:p),scoreOverrides:{}});
  const chooseQuestionImage=async(file?:File)=>{
    if(!file)return;
    if(!/\.(png|jpe?g)$/i.test(file.name)||!(["image/png","image/jpeg"].includes(file.type))){setNotice("Only PNG or JPG images can be uploaded. No video files.");return;}
    if(!file.size||file.size>2*1024*1024){setNotice("Choose a non-empty image smaller than 2 MB.");return;}
    try{
      const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
      const jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      if(!(/\.png$/i.test(file.name)?png:jpg))throw Error("Invalid image data");
      const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(Error("Invalid image"));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
      const im=new Image();im.src=src;await im.decode();
      setQuestions(old=>old.map((q,i)=>i===active?{...q,imageSrc:src,imageFileName:file.name,imageAlt:file.name.replace(/\.[^.]+$/, ""),hotspots:[]}:q));
      setNotice("");
    }catch{setNotice("The image could not be read. Please select a valid PNG or JPG.");}
  };
  const addHotspotOption=()=>{
    if(!question.imageSrc){setNotice("Choose or upload an image first.");setSections(old=>({...old,question:true}));return;}
    const index=question.hotspots.length;
    const x=12+(index%5)*16,y=15+(Math.floor(index/5)%4)*17;
    addHotspot({x,y,width:12,height:12});
  };
  const addHotspot=(rect:{x:number;y:number;width:number;height:number})=>{
    if(!question.imageSrc){setNotice("Choose an image before adding hotspots.");return;}
    if(question.hotspots.length>=20){setNotice("Maximum 20 hotspots.");return;}
    const index=question.hotspots.length+1;
    update({hotspots:[...question.hotspots,{id:uid(),label:`Hotspot ${index}`,role:"Wrong",comment:"",...rect,correct:false,marks:""}]});
    setNotice("");
  };
  const updateHotspot=(id:string,patch:Partial<HotspotRegion>)=>update({hotspots:question.hotspots.map(h=>h.id===id?{...h,...patch,correct:patch.role?patch.role==="Correct":h.correct}:h)});
  const removeHotspot=(id:string)=>update({hotspots:question.hotspots.filter(h=>h.id!==id)});
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
    if(!ready)return;
    
    const invalid=questions.slice(0,values.questionCount).findIndex(q=>!complete(q));
    if(invalid!==-1){jump(invalid);setPreview(false);setShowValidation(true);setNotice(`Question ${invalid+1}: ${errorsFor(questions[invalid])[0]}`);return;}
    try {
    const id = getActiveAssessmentId();
    const record = id ? getAssessment(id) : undefined;
    if (!record || record.typeCode !== "clickable-hotspot") { setNotice("Open a Clickable Hotspot assessment before saving."); return; }
    saveDraft(questions,values,active,richHtml);
    updateAssessment({questions: values.questionCount, marks: questions.slice(0,values.questionCount).reduce((sum,q)=>sum+(Number(q.points)||0),0)});
    setNotice("");setContinuing(true);continueTimer.current=window.setTimeout(()=>{setContinuing(false);router.push("/assessments/create/evaluation");},3000);
  }
    catch{setNotice("Unable to save this assessment.");}
  };
  const addPair=()=>{};
  const removePair=(_id:string)=>{};
  if(preview)return <ConnectDotsReviewPreview questions={questions.slice(0,values.questionCount)} values={values} saving={continuing} onBack={()=>setPreview(false)} onEdit={i=>{setPreview(false);jump(i);}} onContinue={continueToEvaluation}/>;
  return <div className="mcqcBuilder mcqcMatchBuilder mcqcConnectBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={()=>router.push("/assessments/create/details")}>Create Assessment</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Antony?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading mcqcMatchQuestionsHeading"><div><h2>Question {active+1} of {values.questionCount}</h2><p>{values.questionCount} Question | {values.totalMarks} Marks</p></div><button type="button" className="mcqcBuilderAction mcqcTopAdd" onClick={()=>jump(active+1,true)} disabled={active>=values.questionCount-1}><Icon name="plus.svg" size={19}/>Add</button></div>
      <div className="mcqcNumberNavigation"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg" size={20}/></button><div className="mcqcQuestionNumbers" ref={numberRef}>{questions.slice(0,values.questionCount).map((q,i)=><button key={i} type="button" className={`mcqcQuestionNumber ${complete(q)?"is-complete":active===i?"is-active":"is-empty"}`} aria-current={active===i?"step":undefined} onClick={()=>jump(i)}><span>{i+1}</span><small>{"CH"}</small><i aria-hidden="true"/></button>)}</div><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=values.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg" size={20}/></button></div>
      <div className="mcqcQuestionProgress"><span style={{width:`${completed/Math.max(1,values.questionCount)*100}%`}}/></div>
      <div className="mcqcQuestionForm mcqcDDQuestionForm mcqcMatchQuestionForm">
        <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Clickable Hotspot" onChange={v=>setNotice(v==="Clickable Hotspot"?"":`${v} is a different question type. This page creates Clickable Hotspot questions.`)}/></div>
        <DragPanel title="Question and Connection Board" icon="grid-view.svg" open={sections.question} onToggle={()=>toggle("question")}>
          <div className="mcqcBuilderField mcqcWriteField"><label>Write your Question </label><div className="mcqcEditorSurface">{editor(`hotspot-question-${active}`,question.text,v=>update({text:v}),"Click the part of the image...",{maxWords:250})}</div></div>
          <div className="clickableImageChooser">
            <label className="clickableSectionLabel">Choose an Image</label>
            <div className="clickableImageGallery clickableUploadedImageGallery">
              <label className={`clickableImageUploadTile ${question.imageSrc?"is-selected":""}`}>
                {question.imageSrc ? <img className="clickableUploadedThumbnail" src={question.imageSrc} alt={question.imageAlt||"Uploaded question image"}/>:<Icon name="image.svg" size={25}/>}
                <span><Icon name="upload.svg" size={17}/>{question.imageSrc?"Change Image":"Upload Image"}</span>
                <input aria-label={question.imageSrc?"Replace the question image":"Upload a PNG or JPG image"} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={e=>{void chooseQuestionImage(e.currentTarget.files?.[0]);e.currentTarget.value="";}}/>
              </label>
            </div>
            <small className="clickableImageFileInfo">{question.imageSrc ? (question.imageFileName||"Uploaded image") : "No image selected"} · PNG or JPG, maximum 2 MB. Videos not supported.</small>
          </div>
          <div className="clickableImageOptions">
            <div className="mcqcBuilderField"><label>How Many Clicks</label><NeumoSelect value={question.maxMarkers===1?"Single":String(question.maxMarkers)} options={["Single","2","3","4","5","6","7","8","9","10"]} onChange={v=>update({maxMarkers:v==="Single"?1:Number(v)})}/></div>
            <div className="mcqcBuilderField"><label>Alt Text</label><input className="clickableAltText" value={question.imageAlt||""} onChange={e=>update({imageAlt:e.target.value})} placeholder="Describe the image"/></div>
            <div className="mcqcBuilderField"><label>Marker Style</label><NeumoSelect value={question.markerStyle||"Cross Hair"} options={["Cross Hair","Circle","Dot"]} onChange={v=>update({markerStyle:v})}/></div>
            <div className="mcqcBuilderField"><label>Marker Colour</label><NeumoSelect value={question.markerColour||"Green"} options={["Green","Blue","Orange"]} onChange={v=>update({markerColour:v})}/></div>
          </div>
          <div className="clickableImageToggles">
            <div className="mcqcDDToggleRow"><span>Show hotspot outlines to learners</span><Switch label="Show hotspot outlines" checked={question.showOutlines!==false} onChange={v=>update({showOutlines:v})}/></div>
            <div className="mcqcDDToggleRow"><span>Allow zoom in the attempt page</span><Switch label="Allow image zoom" checked={question.allowZoom!==false} onChange={v=>update({allowZoom:v})}/></div>
            <div className="mcqcDDToggleRow"><span>Allow learner to move or remove markers</span><Switch label="Allow moving and removing markers" checked={question.allowMove} onChange={v=>update({allowMove:v})}/></div>
          </div>
        </DragPanel>
        <DragPanel title="Hotspots" icon="target.svg" subtitle={`${question.hotspots.length} regions`} open={sections.pairs} onToggle={()=>toggle("pairs")}>
          <div className="clickableHotspotsImageBoard">
            <HotspotArtwork question={question} onCreate={addHotspot} showRegions={true}/>
            {!question.imageSrc&&<p className="clickableImageHelp">Choose an image above to create hotspots inside this frame.</p>}
          </div>
          {question.hotspots.map((h,i)=><div className="clickableHotspotsRow" key={h.id}>
            <span className="clickableHotspotNumber">{i+1}</span>
            <input className="clickableHotspotName" list="clickableHotspotNameOptions" aria-label={`Hotspot ${i+1} name`} value={h.label} onChange={e=>updateHotspot(h.id,{label:e.target.value})} placeholder="Hotspot name"/>
            <div className="clickableHotspotRole" role="group" aria-label={`Hotspot ${i+1} answer role`}>
              <button type="button" aria-pressed={h.role==="Correct"} className={`clickableHotspotRoleButton is-correct ${h.role==="Correct"?"is-active":""}`} onClick={()=>updateHotspot(h.id,{role:"Correct"})}><span className="clickableRolePill">Correct</span></button>
              <button type="button" aria-pressed={h.role==="Wrong"} className={`clickableHotspotRoleButton is-wrong ${h.role==="Wrong"?"is-active":""}`} onClick={()=>updateHotspot(h.id,{role:"Wrong"})}><span className="clickableRolePill">Wrong</span></button>
            </div>
            <button type="button" className="mcqcIconButton clickableHotspotRemove" aria-label={`Remove hotspot ${i+1}`} onClick={()=>removeHotspot(h.id)}><Icon name="cancel-circle.svg" size={19}/></button>
            <input className="clickableHotspotComment" list="clickableHotspotCommentOptions" aria-label={`Hotspot ${i+1} comment when clicked`} value={h.comment} onChange={e=>updateHotspot(h.id,{comment:e.target.value})} placeholder="Comment when click"/>
          </div>)}
          <datalist id="clickableHotspotNameOptions">{Array.from(new Set(question.hotspots.map(area=>area.label))).filter(Boolean).map(label=><option key={label} value={label}/>)}</datalist>
          <datalist id="clickableHotspotCommentOptions">{Array.from(new Set(question.hotspots.map(area=>area.comment))).filter(Boolean).map(comment=><option key={comment} value={comment}/>)}</datalist>
          {!question.hotspots.length&&<p className="clickableNoHotspots">Click or drag over the image to create a hotspot. You can also use Add Options.</p>}
          <div className="clickableAddOptionsRow"><button type="button" className="clickableAddOptionsButton" onClick={addHotspotOption}><Icon name="plus.svg" size={17}/>Add Options</button></div>
        </DragPanel>
        <DragPanel title="Grading Method" icon="quiz.svg" open={sections.grading} onToggle={()=>toggle("grading")}>
          <div className="mcqcDDThree"><div className="mcqcBuilderField"><label>Grading Method</label><NeumoSelect value={question.grading} options={["Equal Marks","Custom"]} onChange={v=>update({grading:v as DotQuestion["grading"],scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Points (total for Question)</label><NeumoSelect value={question.points} options={["1","2","3","4","5","6","8","10","15","20","25","30","40","50"]} onChange={v=>update({points:v,scoreOverrides:{}})}/></div><div className="mcqcBuilderField"><label>Negative Marking</label><NeumoSelect value={question.negative} options={["NA","0","0.25","0.5","1"]} onChange={v=>update({negative:v,scoreOverrides:{}})}/></div></div>
          {question.grading==="Custom"&&question.hotspots.map((h,i)=><label key={h.id} className="mcqcDDCustomZone">Hotspot {i+1} marks<input type="number" min="0" step="0.5" value={h.marks} onChange={e=>updateHotspot(h.id,{marks:e.target.value})}/></label>)}
          <div className="mcqcDDToggleRow"><span>Clicks outside every hotspot count as wrong</span><Switch label="Count outside clicks as wrong" checked={question.clicksOutsideWrong} onChange={v=>update({clicksOutsideWrong:v})}/></div>
          <div className="mcqcDDToggleRow"><span>Calculate grade with a minimum score of 0</span><Switch label="Minimum score of 0" checked={question.minZero} onChange={v=>update({minZero:v})}/></div>
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
export default function ClickableHotspotPage(){
  return <main className="mcqcAppShell"><div className="mcqcLayout"><Sidebar/><section className="mcqcMainContent"><div className="mcqcHeader"><Header/></div><div className="mcqcScrollArea"><div className="mcqcPageContent"><QuestionBuilder/></div></div></section></div></main>;
}
