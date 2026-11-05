"use client";
import AssessmentRichToolbar from "@/modules/assessments/components/common/AssessmentRichToolbar";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, type FormEvent, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import "./problemsolving.css";
import { assessmentStorage, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`mcqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}
// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"];
const MCQC_SIZES = ["12", "14", "16", "18", "24"];
type EditorMenu = "font" | "size" | "textColors" | "highlightColors" | "alignments" | "headings";
const PS_TEXT_COLORS = [
  {label:"Default", value:"#2F3547"}, {label:"Blue",value:"#2D4CC8"},
  {label:"Green",value:"#2A7308"}, {label:"Red",value:"#B31B2A"},
  {label:"Purple",value:"#7C0981"}, {label:"Black",value:"#000000"}
];
const PS_HIGHLIGHT_COLORS = [
  {label:"Yellow",value:"#FFF0A8"}, {label:"Green",value:"#C8E8C0"},
  {label:"Blue",value:"#D9E6FF"}, {label:"Pink",value:"#F9D5E4"},
  {label:"Remove highlight",value:"transparent"}
];
function MCQRichEditor({ editorId, value, html, onChange, onHtmlChange, placeholder, onError, maxChars }: {
  editorId: string; value: string; html?: string; onChange: (text: string) => void;
  onHtmlChange: (html: string) => void; placeholder: string; onError: (message: string) => void; maxChars?: number;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileKind, setFileKind] = useState<"image" | "attachment">("image");
  const [menu, setMenu] = useState<EditorMenu | null>(null);
  // Render the formatting toolbar only after hydration. The same buttons and
  // handlers mount on the client; the server/initial client HTML remain identical.
  const [toolbarReady, setToolbarReady] = useState(false);
  useEffect(() => { setToolbarReady(true); }, []);
  const [font, setFont] = useState("Arial");
  const [size, setSize] = useState("16");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 160 });
  const floatingMenu = useRef<HTMLDivElement>(null);
  const openFormatMenu = (kind: EditorMenu, trigger: HTMLElement) => {
    if (menu === kind) { setMenu(null); return; }
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(["alignments","headings","textColors","highlightColors"].includes(kind) ? 260 : kind === "font" ? 190 : 110, window.innerWidth - 16);
    const height = Math.min(240, window.innerHeight - 16);
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
  // Match the 0/250 counter: count every character, including spaces.
  const countCharacters = (text: string) => Array.from(text).length;
  const readText = (el: HTMLDivElement) =>
    (el.querySelector("div,p,li,br") ? el.innerText : el.textContent || "").replace(/\u00a0/g, " ");
  const allowedInsertion = (incoming: string): string => {
    if (maxChars === undefined || !editor.current) return incoming;
    const el = editor.current;
    const selection = window.getSelection();
    const selected = selection?.rangeCount && el.contains(selection.anchorNode)
      ? selection.toString() : "";
    const available = Math.max(0, maxChars - (countCharacters(readText(el)) - countCharacters(selected)));
    if (countCharacters(incoming) <= available) return incoming;
    onError(`This field allows a maximum of ${maxChars} characters (including spaces).`);
    return Array.from(incoming).slice(0, available).join("");
  };
  const notify = () => {
    const el = editor.current;
    if (!el) return;
    let plain = readText(el);
    if (maxChars !== undefined && countCharacters(plain) > maxChars) {
      plain = Array.from(plain).slice(0, maxChars).join("");
      // Only reset the editable content if an insertion bypassed the limit.
      el.textContent = plain;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      onError(`This field allows a maximum of ${maxChars} characters (including spaces).`);
    }
    lastHtml.current = el.innerHTML;
    onHtmlChange(el.innerHTML);
    onChange(plain);
  };
  const beforeInput = (event: FormEvent<HTMLDivElement>) => {
    const native = event.nativeEvent as InputEvent;
    if (!native.inputType?.startsWith("insert") || !native.data || maxChars === undefined) return;
    const accepted = allowedInsertion(native.data);
    if (accepted === native.data) return;
    event.preventDefault();
    if (accepted) {
      document.execCommand("insertText", false, accepted);
      notify();
    }
  };
  const pasteText = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const accepted = allowedInsertion(event.clipboardData.getData("text/plain"));
    if (accepted) document.execCommand("insertText", false, accepted);
    notify();
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
  // Inline formatting controls all operate on the same saved caret selection.
  const insertLink = () => {
    const entered = window.prompt("Enter a link (https:// or mailto:)", "https://");
    if (entered === null) return;
    const url = entered.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { onError("Use an http(s) or mailto link."); return; }
    restore();
    const selectedText = window.getSelection()?.toString() || "";
    if (selectedText) document.execCommand("createLink", false, url);
    else {
      const safe = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
      document.execCommand("insertHTML", false, `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`);
    }
    remember(); notify(); setMenu(null);
  };
  const applyFormattingTool = (key: string, trigger: HTMLButtonElement) => {
    if (["font","size","textColors","highlightColors","alignments","headings"].includes(key)) {
      openFormatMenu(key as EditorMenu, trigger);
      return;
    }
    if (key === "link") return insertLink();
    if (key === "image") {
      setFileKind("image");
      if (fileInput.current) { fileInput.current.accept = "image/png,image/jpeg,image/gif,image/webp"; fileInput.current.value=""; fileInput.current.click(); }
      setMenu(null); return;
    }
    if (key === "code") return command("formatBlock", "pre");
    if (key === "paragraph") return command("formatBlock", "p");
    if (key === "blockquote") return command("formatBlock", "blockquote");
    command(key);
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
  // Match the existing 34px neumorphic buttons; only missing actions are added.
  // A multi-choice tool uses one compact button, with a small list of choices.
  const optionTool = (label: string, glyph: string, kind: EditorMenu, icon?: string) =>
    <div className="mcqcRichMenuRoot"><button type="button" className="psInlineToolButton"
      title={label} aria-label={label} aria-expanded={menu === kind}
      onMouseDown={e => { e.preventDefault(); remember(); }} onClick={e => openFormatMenu(kind, e.currentTarget)}>
      {icon ? <Icon name={icon} size={18}/> : <span className="psInlineToolGlyph" aria-hidden="true">{glyph}</span>}
    </button></div>;
  const actionTool = (label: string, glyph: string, key: string, icon?: string) =>
    <button type="button" className="psInlineToolButton" title={label} aria-label={label}
      onMouseDown={e => { e.preventDefault(); remember(); }}
      onClick={e => applyFormattingTool(key, e.currentTarget)}>
      {icon ? <Icon name={icon} size={18}/> : <span className="psInlineToolGlyph" aria-hidden="true">{glyph}</span>}
    </button>;
  return <div className="mcqcRichEditorRoot">
    <AssessmentRichToolbar label={placeholder} onRemember={remember} onCommand={command} onError={onError} onChooseFile={kind => { setFileKind(kind); if (fileInput.current) { fileInput.current.accept = kind === "image" ? "image/*" : ""; fileInput.current.value = ""; fileInput.current.click(); } }} />
    {toolbarReady && menu && typeof document !== "undefined" && createPortal(
      <div ref={floatingMenu}
        className={`mcqcFloatingFormatMenu ${["textColors","highlightColors","alignments","headings"].includes(menu) ? "psFormatOptionMenu" : ""}`}
        role="listbox"
        aria-label={menu}
        style={{top:menuPosition.top,left:menuPosition.left,width:menuPosition.width,maxHeight:Math.min(270, typeof window !== "undefined" ? window.innerHeight-24 : 330)}}>
        {menu === "font" || menu === "size" ? (menu === "font" ? MCQC_FONTS : MCQC_SIZES).map(v=><button key={v} type="button" role="option" aria-selected={menu === "font" ? font === v : size === v}
          onMouseDown={e=>{e.preventDefault();remember();}}
          onClick={()=>{if(menu === "font"){setFont(v);command("fontName",v);}else{setSize(v);command("fontSize",v);}}}>
          {menu === "font" ? v : `${v}px`}</button>)
        : menu === "textColors" || menu === "highlightColors" ? (menu === "textColors" ? PS_TEXT_COLORS : PS_HIGHLIGHT_COLORS).map(color=><button key={color.label} type="button" className="psFormatChoice" onMouseDown={e=>{e.preventDefault();remember();}} onClick={()=>command(menu === "textColors" ? "foreColor" : "hiliteColor",color.value)}><span className="psColorSwatch" style={{background:color.value}}/>{color.label}</button>)
        : menu === "alignments" ? [{label:"Align Left",key:"justifyLeft"},{label:"Align Centre",key:"justifyCenter"},{label:"Align Right",key:"justifyRight"},{label:"Justify",key:"justifyFull"}].map(choice=><button key={choice.key} type="button" className="psFormatChoice" onMouseDown={e=>{e.preventDefault();remember();}} onClick={()=>command(choice.key)}>{choice.label}</button>)
        : menu === "headings" ? ["h1","h2","h3","h4","h5","h6"].map(tag=><button key={tag} type="button" className="psFormatChoice" onMouseDown={e=>{e.preventDefault();remember();}} onClick={()=>command("formatBlock",tag)}>{tag.toUpperCase()}</button>) : null}
      </div>,document.body)}
    <input ref={fileInput} type="file" hidden onChange={e => { const f=e.target.files?.[0]; if (f) void addFile(f); }}/>
    <div ref={editor} id={editorId} role="textbox" aria-label={placeholder} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={placeholder}
      className="mcqcRichEditable" onBeforeInput={beforeInput} onInput={notify} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={pasteText}/>
    {maxChars !== undefined && <small className="assessmentEditorCounter" aria-live="polite">{Array.from(value).length}/{maxChars}</small>}
  {maxChars !== undefined && <small className="assessmentRichCounter" aria-live="polite">{Array.from((value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^\r?\n$/, "")).length}/{maxChars}</small>}</div>;
}

const ASSESSMENT_TYPE_GROUPS = [
  { heading: "Academic assessment", items: ["Multiple Choice Question (MCQ)", "Multiple Response", "True / False", "Fill in the Blank", "One-Word Answer", "Short Answer", "Long Answer / Essay", "Numeric Response", "Formula Response", "Matrix Question", "Assertion & Reason", "Ranking Question", "Quick Quiz", "Timed Quiz", "Scenario Quiz"] },
  { heading: "Interactive Assessments", items: ["Drag & Drop", "Match the Following", "Sequence & Order", "Connect the Dots", "Clickable Hotspot", "Interactive Diagram", "Interactive Concept Map", "Puzzle Challenge", "Memory Game", "Interactive Story"] },
  { heading: "Multimedia Assessments", items: ["Image-Based Assessment", "Audio-Based Assessment", "Video-Based Assessment", "Visual Identification", "Video Response", "Audio Response", "Screen Recording Task", "Media Annotation"] },
  { heading: "Application & Practical Assessments", items: ["Case Study", "Problem Solving", "Assignment", "Project Assessment", "Research Task", "Practical Task", "Lab Assessment", "Simulation Assessment", "Design Review", "Presentation Assessment", "Role-Play Assessment", "Oral Viva", "Product Demonstration"] },
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
      {subtitle && <small className="mcqcDDPanelCount">{subtitle}</small>}
      <Icon name="arrow-down-01.svg" size={20} className={open ? "mcqcRotated" : ""}/>
    </button>
    {open && <div className="mcqcDDPanelBody">{children}</div>}
  </section>;
}


// Problem Solving — retain the shared creator shell, dropdowns and rich-text editor.
type SolutionStep = { id:string; title:string; marks:string; description:string; feedbackCorrect:string; feedbackWrong:string; explanation:string; hint:string; showHint:boolean; allowHint:boolean };
type Criterion = {id:string; criterion:string; check:string; marks:string; weight:string};
type Level = {grade:string; level:string; achievement:string; meaning:string};
type ResultBand = {range:string; classification:string; result:"Pass"|"Fail"};
type RubricRule = "checkEveryCriterion"|"allowCriterionFeedback"|"allowOverallFeedback"|"autoTotal"|"wholeNumbers"|"lockAfterSubmit"|"auditLog"|"allowAdminOverride";
type ProblemQuestion = {
  type:"Problem Solving"; text:string; dataInput:string; attachment:string; attachmentName:string;
  steps:SolutionStep[]; rubricType:string; evaluation:string; rubricTotal:string; passMarks:string;
  criteria:Criterion[]; levels:Level[]; resultBands:ResultBand[]; rules:Record<RubricRule,boolean>;
  feedbackFull:string; feedbackZero:string; explanation:string; hint:string; points:string;
  difficulty:string; category:string; bloom:string; mandatory:boolean; tags:string[];
};
type AssessmentValues = {totalMarks:number; questionCount:number; marksPerQuestion:number; duration:number; passingScore:string};
const CONTENT_KEY="problemSolvingContentDraft";
// Set this to your existing Problem Solving evaluation route if your project uses another path.
const EVALUATION_ROUTE="/assessments/create/evaluation";
const DETAILS_KEYS=["mcqAssessmentDraft","problemSolvingAssessmentDraft"];
const DEFAULT_VALUES:AssessmentValues={totalMarks:20,questionCount:20,marksPerQuestion:1,duration:60,passingScore:"60%"};
const PASSING_SCORE_OPTIONS=Array.from({length:10},(_,i)=>`${(i+1)*10}%`);
const CATEGORIES=["AI","Data Structures","Mathematics","Science","Programming","Computer Science","Data Science","Cybersecurity","Other"];
const BLOOMS=["Remember","Understand","Apply","Analyse","Evaluate","Create"];
const RUBRIC_TYPES=["Analytic Rubric","Custom Rubric"];
const EVALUATION_METHODS=["Manual Evaluation","AI-Assisted Evaluation","Automatic Evaluation"];
const characterCount=(value:string)=>Array.from(value.replace(/\u00a0/g," ")).length;
const textCounter=(value:string)=><small className="psWordCount" aria-label={`${characterCount(value)} of 250 characters`}>{characterCount(value)}/250</small>;
const rubricTypeLabel=(value:string)=>value==="Analytic"?"Analytic Rubric":value==="Custom"?"Custom Rubric":value;
const evaluationLabel=(value:string)=>value==="Manual"?"Manual Evaluation":value==="AI-Assisted"?"AI-Assisted Evaluation":value==="Automatic"?"Automatic Evaluation":value;
const uid=()=>`ps-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const newStep=():SolutionStep=>({id:uid(),title:"",marks:"1",description:"",feedbackCorrect:"",feedbackWrong:"",explanation:"",hint:"",showHint:false,allowHint:false});
const newCriterion=(name="",check="",marks="10",weight="10%"):Criterion=>({id:uid(),criterion:name,check,marks,weight});
const DEFAULT_LEVELS:Level[]=[
  {grade:"05",level:"Excellent",achievement:"90–100%",meaning:"Accurate, complete, well reasoned"},
  {grade:"04",level:"Good",achievement:"75–89%",meaning:"Mostly right, minor gaps"},
  {grade:"03",level:"Satisfactory",achievement:"60–74%",meaning:"Acceptable, some weak spots"},
  {grade:"02",level:"Needs Improvement",achievement:"40–59%",meaning:"Partly right, major fixes needed"},
  {grade:"01",level:"Poor",achievement:"01–39%",meaning:"Big gaps"},
  {grade:"00",level:"Not Demonstrated",achievement:"0%",meaning:"No evidence"}
];
const DEFAULT_BANDS:ResultBand[]=[
  {range:"90–100",classification:"Outstanding",result:"Pass"},
  {range:"75–89",classification:"Very Good",result:"Pass"},
  {range:"60–74",classification:"Good",result:"Pass"},
  {range:"50–59",classification:"Satisfactory",result:"Pass"},
  {range:"0–49",classification:"Needs Improvement",result:"Fail"}
];
const RULES:{key:RubricRule;label:string}[]=[
  {key:"checkEveryCriterion",label:"Evaluator must mark every criterion before submitting"},
  {key:"allowCriterionFeedback",label:"Allow feedback for each criterion"},
  {key:"allowOverallFeedback",label:"Allow overall feedback"},
  {key:"autoTotal",label:"Total is calculated automatically (never typed)"},
  {key:"wholeNumbers",label:"Whole numbers only, from 0 up to the criterion max"},
  {key:"lockAfterSubmit",label:"Finalized marks need authorized reopening"},
  {key:"auditLog",label:"Record every grading change in an audit log"},
  {key:"allowAdminOverride",label:"Admin can change marks, pass marks and text without code"}
];
const defaultRules=()=>Object.fromEntries(RULES.map(r=>[r.key,true])) as Record<RubricRule,boolean>;
const exampleText="Ravi has 5 apples. He gets 3 more apples, then gives 2 apples to a friend. How many apples does Ravi have now?";
const exampleStep=(title:string,description:string,marks:string):SolutionStep=>({...newStep(),title,description,marks,
  feedbackCorrect:`Correct ${description}`,feedbackWrong:"Not quite – check your calculation.",explanation:description,hint:"Work it out one step at a time."});
function newQuestion(points=4,example=false):ProblemQuestion{
  return {
    type:"Problem Solving",text:example?exampleText:"",dataInput:example?"Use only addition and subtraction.":"",attachment:"",attachmentName:"",
    steps:example?[
      exampleStep("Add the new apples","8", "1"),
      exampleStep("Subtract the apples given away","6", "1"),
      exampleStep("Numeric","6","2")
    ]:[newStep()],
    rubricType:"Analytic Rubric",evaluation:"Manual Evaluation",rubricTotal:"100",passMarks:"50",
    criteria:[
      newCriterion("Problem Understanding","Knows the problem, limits and goal","15","15%"),
      newCriterion("Problem Analysis","Finds the cause, key facts and links","15","15%"),
      newCriterion("Solution Approach","Picks a logical, practical method","20","20%"),
      newCriterion("Logical Reasoning","Clear, step by step thinking","15","15%"),
      newCriterion("Solution Accuracy","Answer is correct and complete","15","15%"),
      newCriterion("Practical Application","Would work in real life","10","10%"),
      newCriterion("Validation & Testing","Checks the answer, spots errors","5","5%"),
      newCriterion("Explanation & Presentation","Clear steps and reasons","5","5%")
    ],levels:DEFAULT_LEVELS.map(l=>({...l})),resultBands:DEFAULT_BANDS.map(b=>({...b})),rules:defaultRules(),
    feedbackFull:example?"Correct-answer feedback – Well done! 5 + 3 = 8 and 8 − 2 = 6.":"",
    feedbackZero:example?"Wrong-answer feedback – Try again, add first then subtract. Recheck each step.":"",
    explanation:example?"Adding Increases The Count; Giving Away Decreases It.":"",
    hint:example?"Do it One Step At A Time.":"",
    points:String(points),difficulty:"",category:example?"AI":"",bloom:example?"Analyse":"",mandatory:true,tags:example?["Data Structure","Stack"]:[]
  };
}
function normalizeQuestion(raw:unknown,points:number):ProblemQuestion{
  const r=(raw && typeof raw==="object" && !Array.isArray(raw)?raw:{}) as Partial<ProblemQuestion>;
  const fallback=newQuestion(points);
  return {...fallback,...r,type:"Problem Solving",
    rubricType:rubricTypeLabel(String(r.rubricType||fallback.rubricType)),
    evaluation:evaluationLabel(String(r.evaluation||fallback.evaluation)),
    steps:Array.isArray(r.steps)&&r.steps.length?r.steps.map(s=>({...newStep(),...s,id:s.id||uid()})):fallback.steps,
    criteria:Array.isArray(r.criteria)?r.criteria.map(c=>({...newCriterion(),...c,id:c.id||uid()})):fallback.criteria,
    levels:Array.isArray(r.levels)?r.levels:fallback.levels,
    resultBands:Array.isArray(r.resultBands)?r.resultBands:fallback.resultBands,
    rules:{...defaultRules(),...r.rules},tags:Array.isArray(r.tags)?r.tags:fallback.tags
  };
}
const hasData=(q:ProblemQuestion)=>!!(q.text.trim()||q.dataInput.trim()||q.steps.some(s=>s.title.trim()||s.description.trim()));
function errorsFor(q:ProblemQuestion):string[]{
  const e:string[]=[];
  if(!q.text.trim())e.push("Write your problem-solving question.");
  if(characterCount(q.text)>250)e.push("Question exceeds 250 characters.");
  if(characterCount(q.dataInput)>250)e.push("Constraints/assumptions exceeds 250 characters.");
  if(q.steps.some(s=>[s.description,s.feedbackCorrect,s.feedbackWrong,s.explanation,s.hint].some(t=>characterCount(t)>250)))e.push("A solution-step text editor exceeds 250 characters.");
  if(!q.dataInput.trim())e.push("Enter the constraints or assumptions for the problem.");
  if(!q.steps.length)e.push("Add at least one solution step.");
  if(q.steps.some(s=>!s.title.trim()||!s.description.trim()))e.push("Enter a title and solution description for every step.");
  if(q.steps.some(s=>!Number.isFinite(Number(s.marks))||Number(s.marks)<0))e.push("Step marks must be non-negative numbers.");
  if(q.steps.some(s=>(s.showHint||s.allowHint)&&!s.hint.trim()))e.push("Complete enabled step hints.");
  if(!q.difficulty||!q.category||!q.bloom)e.push("Choose difficulty, category and Bloom's Taxonomy.");
  if(!(Number(q.points)>0))e.push("Question Points must be greater than zero.");
  if(!(Number(q.rubricTotal)>0))e.push("Rubric Total Marks must be greater than zero.");
  if(Number(q.passMarks)<0||Number(q.passMarks)>Number(q.rubricTotal))e.push("Pass marks must be within the rubric total.");
  if(!q.criteria.length||q.criteria.some(c=>!c.criterion.trim()||!c.check.trim()))e.push("Complete every rubric criterion and What to check field.");
  if(q.criteria.some(c=>!Number.isFinite(Number(c.marks))||Number(c.marks)<0))e.push("Enter valid criterion marks.");
  const total=q.criteria.reduce((sum,c)=>sum+(Number(c.marks)||0),0);
  if(Math.abs(total-Number(q.rubricTotal))>.001)e.push("Rubric criterion max marks must equal the rubric total.");
  return e;
}
const complete=(q:ProblemQuestion)=>errorsFor(q).length===0;
const sumCriterionMarks=(q:ProblemQuestion)=>q.criteria.reduce((s,c)=>s+(Number(c.marks)||0),0);
function loadDetails():AssessmentValues{
  for(const key of DETAILS_KEYS){
    try{
      const raw=assessmentStorage.getItem(key);if(!raw)continue;
      const obj=JSON.parse(raw);const v={...obj,...obj?.settings,...obj?.details};
      if(!v.questionCount&&!v.totalQuestions)continue;
      const count=Math.max(1,Math.min(100,Number(v.questionCount??v.totalQuestions)||20));
      const marks=Number(v.totalMarks??v.maximumMarks)||20;
      return {questionCount:count,totalMarks:marks,marksPerQuestion:marks/count,duration:Number(v.duration??v.durationMinutes)||60,passingScore:String(v.passingScore||"60%")};
    }catch{/* Try next details key. */}
  }
  return DEFAULT_VALUES;
}
function saveDraft(questions:ProblemQuestion[],details:AssessmentValues,richHtml:Record<string,string>={}){
  const data={type:"Problem Solving",questions,details,richHtml,questionCount:details.questionCount,savedAt:new Date().toISOString()};
  const raw=JSON.stringify(data);
  assessmentStorage.setItem(CONTENT_KEY,raw);
  // The shared Evaluation/Review components already use this assessment-local draft key.
  // Mirroring makes the existing steps see Problem Solving questions without altering their code.
  assessmentStorage.setItem("mcqContentDraft", JSON.stringify({questions,questionCount:questions.length,questionType:"Problem Solving",updatedAt:data.savedAt}));
  updateAssessment({questions:questions.filter(q=>q.text.trim()).length,marks:questions.reduce((sum,q)=>sum+(Number(q.points)||0),0)});
  return data;
}
function PreviewSectionIcon({name}:{name:string}){return <span className="mcqcMatchPreviewHeadIcon"><Icon name={name} size={18}/></span>}
function RubricPreview({q}:{q:ProblemQuestion}){
  return <div className="psRubricPreview">
    <h4>1. Rubric Set up</h4>
    <div className="psRubricFields"><label>Rubric Type<strong>{rubricTypeLabel(q.rubricType)}</strong></label><label>Evaluation Method<strong>{evaluationLabel(q.evaluation)}</strong></label><label>Total Marks<strong>{q.rubricTotal} marks</strong></label><label>Pass marks<strong>{q.passMarks}</strong></label></div>
    <h4>2. Evaluation Criteria</h4>
    <div className="psTableScroll"><table className="psRubricTable"><thead><tr><th>NO</th><th>Criterion</th><th>What to check</th><th>Max marks</th><th>Weights</th><th>Action</th></tr></thead><tbody>{q.criteria.map((c,i)=><tr key={c.id}><td>{String(i+1).padStart(2,"0")}</td><td>{c.criterion}</td><td>{c.check}</td><td>{c.marks}</td><td>{c.weight}</td><td>—</td></tr>)}</tbody><tfoot><tr><td colSpan={3}>Total</td><td>{sumCriterionMarks(q)}</td><td colSpan={2}/></tr></tfoot></table></div>
    <h4>3. Performance levels (same for every criterion)</h4>
    <div className="psTableScroll"><table className="psRubricTable"><thead><tr><th>Grade</th><th>Level</th><th>Achievement</th><th>Meaning</th></tr></thead><tbody>{q.levels.map(l=><tr key={l.grade}><td>{l.grade}</td><td>{l.level}</td><td>{l.achievement}</td><td>{l.meaning}</td></tr>)}</tbody></table></div>
    <h4>4. Final result bands</h4>
    <div className="psTableScroll"><table className="psRubricTable"><thead><tr><th>Final Score</th><th>Classification</th><th>Result</th></tr></thead><tbody>{q.resultBands.map(b=><tr key={b.range}><td>{b.range}</td><td>{b.classification}</td><td className={b.result==="Pass"?"psPass":"psFail"}>{b.result}</td></tr>)}</tbody></table></div>
    <h4>5. Rules</h4>{RULES.map(({key,label})=><div className="mcqcDDToggleRow psPreviewRule" key={key}><span>{label}</span><span className={`psPreviewFigmaSwitch ${q.rules[key]?"is-on":""}`} role="img" aria-label={`${label}: ${q.rules[key]?"ON":"OFF"}`}><span className="psPreviewFigmaSwitchInner"><span className="psPreviewFigmaSwitchText">{q.rules[key]?"ON":"OFF"}</span></span></span></div>)}
  </div>;
}
function ProblemPreview({questions,active,readyAll,onBack,onEdit,onContinue,saving}:{questions:ProblemQuestion[];active:number;readyAll:boolean;onBack:()=>void;onEdit:(i:number)=>void;onContinue:()=>void;saving:boolean}){
  const [filter,setFilter]=useState("All Questions");
  const [learner,setLearner]=useState(false);
  const [expanded,setExpanded]=useState({steps:true,grading:true});
  const toggle=(name:keyof typeof expanded)=>setExpanded(s=>({...s,[name]:!s[name]}));
  const filled=questions.map((q,index)=>({q,index})).filter(({q})=>hasData(q));
  const visible=filled.filter(({q})=>filter==="All Questions"||(filter==="Complete"?complete(q):!complete(q)));
  const current=visible.find(e=>e.index===active)??visible[0];const q=current?.q,index=current?.index??0;
  return <div className="mcqcPreview mcqcMatchPreview psPreview">
    <nav className="mcqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="mcqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="mcqcPreviewControls"><div className="mcqcPreviewTotals"><div><strong>{filled.length}</strong><span>Questions</span></div><div><strong>{filled.reduce((sum,e)=>sum+(Number(e.q.points)||0),0)}</strong><span>Marks</span></div><div className="mcqcPreviewReady"><Icon name={readyAll?"checkmark-square-02.svg":"alerto.svg"} size={18}/><span><strong>{readyAll?"Ready":"In Progress"}</strong><small>{readyAll?"All good to continue":"Review incomplete questions"}</small></span></div></div>
      <div className="mcqcPreviewTools"><select className="mcqcMatchPreviewFilter" aria-label="Filter questions" value={filter} onChange={e=>setFilter(e.target.value)}><option>All Questions</option><option>Complete</option><option>Incomplete</option></select><button type="button" className="mcqcPreviewLearner" onClick={()=>setLearner(v=>!v)}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div></div>
      {q?<article className="mcqcPreviewQuestion" key={index}>
        <div className="mcqcPreviewMeta"><span>Problem solving · {q.points} Points</span><span>Status: <b className={complete(q)?"mcqcGreen":"mcqcOrange"}>{complete(q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(index)}><Icon name="edit.svg" size={16}/>Edit</button></div>
        <div className="mcqcPreviewPanel"><h3>Question {index+1}</h3><p>{q.text||"Write your question."}</p>{q.dataInput&&<p className="psPreviewInput">{q.dataInput}</p>}{q.attachment&&<a href={q.attachment} download={q.attachmentName}>{q.attachmentName}</a>}</div>
        <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.steps} onClick={()=>toggle("steps")}><span className="mcqcMatchPreviewTitle"><PreviewSectionIcon name="adjust-position.svg"/>Solutions steps</span><Icon name="arrow-down-01.svg" className={expanded.steps?"mcqcRotated":""} size={18}/></button>{expanded.steps&&<div className="psPreviewSteps">{q.steps.map((s,i)=>{const isFinal=i===q.steps.length-1&&/^(numeric|final(?: answer| result)?)(?:\s*[-:])?$/i.test(s.title.trim());const displayTitle=isFinal?`Final answer- ${s.description||s.title}`:`Step ${i+1} – ${s.title||`Step ${i+1}`}`;return <div key={s.id} className="psPreviewStep"><div className="psPreviewStepRow"><span className="psPreviewStepText">{displayTitle}</span><small>{s.marks} Mark{s.marks==="1"?"":"s"}</small></div>{learner?<textarea aria-label={`Your response for step ${i+1}`} placeholder="Enter your answer..."/>:null}</div>;})}</div>}</div>
        {!learner&&<>
          <div className="mcqcPreviewPanel"><button type="button" className="mcqcPreviewSectionHead" aria-expanded={expanded.grading} onClick={()=>toggle("grading")}><span className="mcqcMatchPreviewTitle"><PreviewSectionIcon name="assignments.svg"/>Grading Method</span><Icon name="arrow-down-01.svg" className={expanded.grading?"mcqcRotated":""} size={18}/></button>{expanded.grading&&<RubricPreview q={q}/>}</div>

        </>}
      </article>:<p className="mcqcBuilderNotice">No questions match this filter.</p>}
      <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" onClick={onBack}>Back to Question</button>{saving&&<span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</div>
    </div>
  </div>;
}
function PSNumberStepper({value,min=0,step=1,onChange,label}:{value:string;min?:number;step?:number;onChange:(value:string)=>void;label:string}){
  const n=Number(value);
  const adjust=(by:number)=>onChange(String(Math.max(min,Number(((Number.isFinite(n)?n:min)+by*step).toFixed(4)))));
  return <div className="psNumberStepper"><input type="number" min={min} step={step} aria-label={label} value={value} onChange={e=>onChange(e.target.value)}/><div className="psNumberArrows"><button type="button" aria-label={`Increase ${label}`} onClick={()=>adjust(1)}><Icon name="arrow-down-01.svg" className="mcqcRotated" size={13}/></button><button type="button" aria-label={`Decrease ${label}`} onClick={()=>adjust(-1)}><Icon name="arrow-down-01.svg" size={13}/></button></div></div>;
}
function ProblemBuilder({questions,setQuestions,values,onPassingScoreChange,onExit}:{questions:ProblemQuestion[];setQuestions:React.Dispatch<React.SetStateAction<ProblemQuestion[]>>;values:AssessmentValues;onPassingScoreChange:(score:string)=>void;onExit:()=>void}){
  const router=useRouter();
  const [active,setActive]=useState(0),[previewing,setPreviewing]=useState(false);
  const [sections,setSections]=useState({question:true,steps:true,grading:true});
  const [stepExpanded,setStepExpanded]=useState<Record<string,boolean>>({});
  const [selectedStepId,setSelectedStepId]=useState<string|null>(null);
  const [showValidation,setShowValidation]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{if(notice!=="Saved successfully.")return;const timer=window.setTimeout(()=>setNotice(""),3000);return()=>window.clearTimeout(timer);},[notice]);
  const [richHtml,setRichHtml]=useState<Record<string,string>>({}),[tagInput,setTagInput]=useState("");
  const [draftReady,setDraftReady]=useState(false);
  const [addingTag,setAddingTag]=useState(false),[isSaving,setIsSaving]=useState(false);
  const saveTimer=useRef<number | null>(null);
  useEffect(()=>()=>{if(saveTimer.current)window.clearTimeout(saveTimer.current);},[]);
  const numbers=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
  const question=questions[active]||newQuestion(values.marksPerQuestion);
  const currentStepId=question.steps.some(step=>step.id===selectedStepId)?selectedStepId:question.steps[0]?.id;
  // Red text belongs beside the field itself; no validation popup.
  const validationMessage=(message:string,invalid:boolean)=>showValidation&&invalid?<p className="psInlineError" role="alert">{message}</p>:null;
  const questionDone=questions.slice(0,values.questionCount).filter(complete).length;
  const isReady=questions.length===values.questionCount&&questions.every(complete);
  const update=(patch:Partial<ProblemQuestion>)=>setQuestions(old=>old.map((q,i)=>i===active?{...q,...patch}:q));
  const updateStep=(id:string,patch:Partial<SolutionStep>)=>update({steps:question.steps.map(s=>s.id===id?{...s,...patch}:s)});
  const updateCriterion=(id:string,patch:Partial<Criterion>)=>update({criteria:question.criteria.map(c=>c.id===id?{...c,...patch}:c)});
  const toggle=(key:keyof typeof sections)=>setSections(s=>({...s,[key]:!s[key]}));
  const jump=(index:number)=>{
    const n=Math.max(0,Math.min(values.questionCount-1,index));setActive(n);setNotice("");
    const node=numbers.current?.querySelectorAll<HTMLElement>(".mcqcQuestionNumber")[n];node?.scrollIntoView({behavior:"smooth",inline:"nearest",block:"nearest"});
  };
  const editor=(field:string,value:string,onChange:(v:string)=>void,placeholder:string,limits:{maxChars?:number}={maxChars:250})=>
    <MCQRichEditor editorId={`ps-${field}-${active}`} value={value} html={richHtml[`ps-${field}-${active}`]} onChange={onChange}
      onHtmlChange={html=>setRichHtml(old=>({...old,[`ps-${field}-${active}`]:html}))} placeholder={placeholder} onError={setNotice} maxChars={limits.maxChars}/>;
  const handleSupportFile=(file?:File)=>{
    if(!file)return;
    const allowed=/\.(png|jpe?g|pdf|csv|xls|xlsx|db|sqlite)$/i.test(file.name);
    if(!allowed){setNotice("Choose an image, PDF, spreadsheet, CSV or database file. Videos are not supported.");return;}
    if(file.size>2*1024*1024){setNotice("Choose a supporting file smaller than 2 MB.");return;}
    const reader=new FileReader();
    reader.onload=()=>{update({attachment:String(reader.result||""),attachmentName:file.name});setNotice("");};
    reader.readAsDataURL(file);
  };
  const addStep=()=>{if(question.steps.length>=20){setNotice("Maximum 20 solution steps.");return;}const step=newStep();update({steps:[...question.steps,step]});setSelectedStepId(step.id);setStepExpanded(s=>({...s,[step.id]:true}));};
  const save=(advance=false)=>{
    setShowValidation(advance);
    const invalid=questions.findIndex(q=>!complete(q));
    if(advance && invalid>=0){
      // Show errors next to the first invalid question fields, without scrolling the document.
      setPreviewing(false);setActive(invalid);setSections({question:true,steps:true,grading:true});
      setNotice("");return false;
    }
    try{saveDraft(questions,values,richHtml);setNotice("Saved successfully.");return true;}
    catch{setNotice("Cannot save draft. Check browser storage.");return false;}
  };
  const requestContinue=()=>{
    if(isSaving)return;
    // Validate inline. Save the valid draft automatically before navigating.
    if(!save(true))return;
    setIsSaving(true);
    setNotice("");
    saveTimer.current=window.setTimeout(()=>{setIsSaving(false);router.push(EVALUATION_ROUTE);},3000);
  };
  useEffect(()=>{
    try{const raw=assessmentStorage.getItem(CONTENT_KEY);if(raw){const saved=JSON.parse(raw);if(Number.isInteger(saved.active))setActive(Math.max(0,Math.min(questions.length-1,saved.active)));if(saved.richHtml&&typeof saved.richHtml==="object")setRichHtml(saved.richHtml);}}catch{/* Use plain-text fallback. */}
    setDraftReady(true);
  },[]);
  useEffect(()=>{if(!draftReady)return;try{assessmentStorage.setItem(CONTENT_KEY,JSON.stringify({questions,details:values,richHtml,active,questionCount:values.questionCount}));}catch{setNotice("Could not save this draft in your browser.");}},[draftReady,questions,values,richHtml,active]);
  useEffect(()=>{
    const el=document.querySelector<HTMLElement>(".mcqcScrollArea");el?.scrollTo({top:0,behavior:"auto"});
  },[previewing]);
  if(previewing)return <ProblemPreview questions={questions} active={active} readyAll={isReady} saving={isSaving} onBack={()=>setPreviewing(false)} onEdit={i=>{jump(i);setPreviewing(false);setSections(s=>({...s,question:true,steps:true}));}} onContinue={requestContinue}/>;
  return <div className="mcqcBuilder mcqcMatchBuilder psBuilder">
    <div className="mcqcBuilderTop"><nav className="mcqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg"/><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg"/><strong>Create Questions</strong></nav><div className="mcqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Antony?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <ol className="mcqcWizard psWizard" aria-label="Assessment steps">{["Type","Details","Content","Evaluation","Review"].map((name,i)=><li key={name} className={`mcqcWizardStep ${i<2?"mcqcWizardDone":i===2?"mcqcWizardActive":""}`}><span className="mcqcWizardNumber"><span>{i+1}</span></span><span>{name}</span></li>)}</ol>
    <div className="mcqcBuilderGrid"><section className="mcqcBuilderMain">
      <div className="mcqcQuestionsHeading mcqcMatchQuestionsHeading"><div><h2>Question {active+1} of {values.questionCount}</h2><p>{values.questionCount} Question | {values.totalMarks} Marks</p></div><button type="button" className="mcqcBuilderAction mcqcTopAdd" onClick={()=>jump(active+1)} disabled={active>=values.questionCount-1}><Icon name="plus.svg" size={19}/>Add</button></div>
      <div className="mcqcNumberNavigation"><button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg"/></button><div className="mcqcQuestionNumbers" ref={numbers}>{questions.slice(0,values.questionCount).map((q,i)=><button type="button" className={`mcqcQuestionNumber ${complete(q)?"is-complete":i===active?"is-active":"is-empty"}`} key={i} onClick={()=>jump(i)} aria-current={active===i?"step":undefined}><span>{i+1}</span><small>PS</small><i aria-hidden="true"/></button>)}</div><button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=values.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg"/></button></div>
      <div className="mcqcQuestionProgress"><span style={{width:`${questionDone/Math.max(1,values.questionCount)*100}%`}}/></div>
      {showValidation&&questions.some((q,i)=>i!==active&&!complete(q))&&<p className="psQuestionNavError" role="alert">Other questions still need required fields. Select their question numbers to review them.</p>}
      <div className="mcqcQuestionForm mcqcDDQuestionForm psQuestionForm">
        <div className="mcqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Problem Solving" onChange={v=>{if(v!=="Problem Solving")setNotice(`${v} has its own creator page. This page remains Problem Solving.`);}}/></div>
        <DragPanel title="Question and Data input" icon="grid-view.svg" open={sections.question} onToggle={()=>toggle("question")}>
          <div className="mcqcBuilderField"><label>Write your Question </label><div className="mcqcEditorSurface">{editor("question",question.text,v=>update({text:v}),"Write your problem-solving question...")}</div>{validationMessage("Write your problem-solving question.",!question.text.trim())}{validationMessage("Question exceeds 250 characters.",characterCount(question.text)>250)}</div>
          <div className="mcqcBuilderField"><label>Constraints/assumptions </label><div className="mcqcEditorSurface">{editor("data",question.dataInput,v=>update({dataInput:v}),"Enter constraints or assumptions...")}</div>{validationMessage("Enter the constraints or assumptions for the problem.",!question.dataInput.trim())}{validationMessage("Maximum 250 characters.",characterCount(question.dataInput)>250)}</div>
          <div className="mcqcBuilderField"><label>Attachments (image/diagram/database)</label>
            <input type="file" ref={fileInput} accept=".png,.jpg,.jpeg,.pdf,.csv,.xls,.xlsx,.db,.sqlite" hidden onChange={e=>{handleSupportFile(e.target.files?.[0]);e.target.value="";}}/>
            <div className="psUploadZone" onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="copy";}} onDrop={e=>{e.preventDefault();handleSupportFile(e.dataTransfer.files?.[0]);}}>
              <button type="button" className="psUpload" onClick={()=>fileInput.current?.click()}><Icon name="image.svg" size={22}/><span><Icon name="upload.svg" size={19}/>{question.attachmentName||"Upload or drag file here"}</span></button>
              {question.attachment&&<button type="button" className="psRemoveFile" onClick={()=>update({attachment:"",attachmentName:""})} aria-label="Remove supporting file"><Icon name="cancel-circle.svg" size={17}/>Remove</button>}
            </div>
          </div>
        </DragPanel>
        <DragPanel title="Solution steps" icon="adjust-position.svg" subtitle={`${question.steps.length} Steps`} open={sections.steps} onToggle={()=>toggle("steps")}>
          <div className="psStepTabs" role="tablist" aria-label="Solution steps">
            {question.steps.map((step,i)=><button key={step.id} id={`ps-tab-${step.id}`} type="button" role="tab" aria-selected={step.id===currentStepId} aria-controls={`ps-step-${step.id}`} className={`psStepTab ${step.id===currentStepId?"is-active":""} ${showValidation&&(!step.title.trim()||!step.description.trim()||((step.showHint||step.allowHint)&&!step.hint.trim()))?"has-error":""}`} onClick={()=>setSelectedStepId(step.id)}>Step {i+1}</button>)}
          </div>
          {validationMessage("Add at least one solution step.",!question.steps.length)}
          {question.steps.map((step,i)=>{
            if(step.id!==currentStepId)return null;
            return <section className="psStep" key={step.id} role="tabpanel" id={`ps-step-${step.id}`} aria-labelledby={`ps-tab-${step.id}`}>
              <div className="psStepBody">
                <div className="psStepFields"><div className="mcqcBuilderField"><label>Step Title</label><input type="text" maxLength={120} list={`ps-step-titles-${step.id}`} value={step.title} placeholder="Add step title" onChange={e=>updateStep(step.id,{title:e.target.value})}/><datalist id={`ps-step-titles-${step.id}`}><option value="Numeric"/><option value="Calculation"/><option value="Add the new apples"/><option value="Subtract the apples given away"/></datalist>{validationMessage("Enter a step title.",!step.title.trim())}</div><div className="mcqcBuilderField"><label>Marks</label><PSNumberStepper label={`Step ${i+1} marks`} min={0} step={0.5} value={step.marks} onChange={v=>updateStep(step.id,{marks:v})}/>{validationMessage("Step marks must be non-negative numbers.",!Number.isFinite(Number(step.marks))||Number(step.marks)<0)}</div></div>
                <div className="mcqcBuilderField"><label>Expected answer </label><div className="mcqcEditorSurface">{editor(`step-${step.id}-desc`,step.description,v=>updateStep(step.id,{description:v}),"Enter the expected answer...",{maxChars:250})}</div>{validationMessage("Enter the expected answer for this step.",!step.description.trim())}{validationMessage("Maximum 250 characters.",characterCount(step.description)>250)}</div>
                <div className="mcqcBuilderField psGreenLabel"><label>Correct answer feedback </label><div className="mcqcEditorSurface">{editor(`step-${step.id}-correct`,step.feedbackCorrect,v=>updateStep(step.id,{feedbackCorrect:v}),"Feedback when this step is correct...")}</div>{validationMessage("Maximum 250 characters.",characterCount(step.feedbackCorrect)>250)}</div>
                <div className="mcqcBuilderField psRedLabel"><label>Wrong answer feedback </label><div className="mcqcEditorSurface">{editor(`step-${step.id}-wrong`,step.feedbackWrong,v=>updateStep(step.id,{feedbackWrong:v}),"Feedback when this step is wrong...")}</div>{validationMessage("Maximum 250 characters.",characterCount(step.feedbackWrong)>250)}</div>
                <div className="mcqcDDFeedbackSubpanel"><button type="button" className="mcqcDDFeedbackSubhead" aria-expanded={stepExpanded[`${step.id}:explanation`]??true} onClick={()=>setStepExpanded(s=>({...s,[`${step.id}:explanation`]:!(s[`${step.id}:explanation`]??true)}))}><span className="mcqcDDPanelHeading"><span className="mcqcDDPanelIcon"><Icon name="assignments.svg" size={18}/></span><strong>Explanation</strong></span><span className="psStepCounter"></span><Icon name="arrow-down-01.svg" className={(stepExpanded[`${step.id}:explanation`]??true)?"mcqcRotated":""} size={17}/></button>{(stepExpanded[`${step.id}:explanation`]??true)&&<div className="mcqcDDFeedbackSubbody"><div className="mcqcEditorSurface">{editor(`step-${step.id}-explanation`,step.explanation,v=>updateStep(step.id,{explanation:v}),"Explain this step...")}</div>{validationMessage("Maximum 250 characters.",characterCount(step.explanation)>250)}</div>}</div>
                <div className="mcqcDDFeedbackSubpanel"><button type="button" className="mcqcDDFeedbackSubhead" aria-expanded={stepExpanded[`${step.id}:hint`]??true} onClick={()=>setStepExpanded(s=>({...s,[`${step.id}:hint`]:!(s[`${step.id}:hint`]??true)}))}><span className="mcqcDDPanelHeading"><span className="mcqcDDPanelIcon"><Icon name="idea.svg" size={18}/></span><strong>Hint</strong></span><span className="psStepCounter"></span><Icon name="arrow-down-01.svg" className={(stepExpanded[`${step.id}:hint`]??true)?"mcqcRotated":""} size={17}/></button>{(stepExpanded[`${step.id}:hint`]??true)&&<div className="mcqcDDFeedbackSubbody"><div className="mcqcEditorSurface">{editor(`step-${step.id}-hint`,step.hint,v=>updateStep(step.id,{hint:v}),"Give the learner a hint...")}</div>{validationMessage("Maximum 250 characters.",characterCount(step.hint)>250)}<div className="mcqcHintChecks"><label><input type="checkbox" checked={step.showHint} onChange={e=>updateStep(step.id,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={step.allowHint} onChange={e=>updateStep(step.id,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>{validationMessage("Enter a hint before enabling the hint option.",(step.showHint||step.allowHint)&&!step.hint.trim())}</div>}</div>
                <button className="psRemoveStep" type="button" disabled={question.steps.length===1} onClick={()=>{update({steps:question.steps.filter(s=>s.id!==step.id)});setSelectedStepId(question.steps.find(s=>s.id!==step.id)?.id??null);}}><Icon name="cancel-circle.svg" size={17}/>Remove Step</button>
              </div>
            </section>;
          })}
          <button type="button" className="mcqcBuilderAction psAddStep" onClick={addStep}><Icon name="plus.svg" size={18}/>Add Step</button>
        </DragPanel>
        <DragPanel title="Grading Method (Rubrics)" icon="assignments.svg" open={sections.grading} onToggle={()=>toggle("grading")}>
          <div className="psRubricEditor">
            <h4>1. Rubric Set up</h4><div className="psRubricFields"><div className="mcqcBuilderField psRubricDropdown"><label>Rubric Type</label><NeumoSelect value={rubricTypeLabel(question.rubricType)} options={RUBRIC_TYPES} onChange={v=>update({rubricType:v})}/></div><div className="mcqcBuilderField psRubricDropdown"><label>Evaluation Method</label><NeumoSelect value={evaluationLabel(question.evaluation)} options={EVALUATION_METHODS} onChange={v=>update({evaluation:v})}/></div><div className="mcqcBuilderField"><label>Total Marks</label><PSNumberStepper label="Total Marks" min={1} value={question.rubricTotal} onChange={v=>update({rubricTotal:v})}/>{validationMessage("Rubric Total Marks must be greater than zero.",!(Number(question.rubricTotal)>0))}</div><div className="mcqcBuilderField"><label>Pass marks</label><PSNumberStepper label="Pass marks" min={0} value={question.passMarks} onChange={v=>update({passMarks:v})}/>{validationMessage("Pass marks must be within the rubric total.",Number(question.passMarks)<0||Number(question.passMarks)>Number(question.rubricTotal))}</div></div>
            <h4>2. Evaluation Criteria</h4><div className="psTableScroll"><table className="psRubricTable psEditableTable"><thead><tr><th>NO</th><th>Criterion</th><th>What to check</th><th>Max marks</th><th>Weights</th><th>Action</th></tr></thead><tbody>{question.criteria.map((c,i)=><tr key={c.id}><td>{String(i+1).padStart(2,"0")}</td><td><input aria-label={`Criterion ${i+1}`} value={c.criterion} onChange={e=>updateCriterion(c.id,{criterion:e.target.value})}/></td><td><input aria-label={`What to check ${i+1}`} value={c.check} onChange={e=>updateCriterion(c.id,{check:e.target.value})}/></td><td><input type="number" min="0" aria-label={`Max marks ${i+1}`} value={c.marks} onChange={e=>updateCriterion(c.id,{marks:e.target.value})}/></td><td><input aria-label={`Weight ${i+1}`} value={c.weight} onChange={e=>updateCriterion(c.id,{weight:e.target.value})}/></td><td><button type="button" disabled={question.criteria.length<=1} onClick={()=>update({criteria:question.criteria.filter(row=>row.id!==c.id)})}>Remove</button></td></tr>)}</tbody><tfoot><tr><td colSpan={3}>Total</td><td colSpan={3}>{sumCriterionMarks(question)}</td></tr></tfoot></table></div><div className="psCriteriaActions"><button type="button" className="mcqcBuilderAction psAddCriterion" onClick={()=>update({criteria:[...question.criteria,newCriterion()]})}><Icon name="plus.svg" size={17}/>Add Criterion</button><button type="button" className="mcqcBuilderAction psResetCriterion" onClick={()=>update({criteria:newQuestion(Number(question.points)).criteria})}>Reset to default 8</button></div>
            {validationMessage("Complete every rubric criterion and What to check field.",!question.criteria.length||question.criteria.some(c=>!c.criterion.trim()||!c.check.trim()))}
            {validationMessage("Enter valid criterion marks.",question.criteria.some(c=>!Number.isFinite(Number(c.marks))||Number(c.marks)<0))}
            {validationMessage("Rubric criterion max marks must equal the rubric total.",Math.abs(sumCriterionMarks(question)-Number(question.rubricTotal))>.001)}
            <h4>3. Performance levels (same for every criterion)</h4><div className="psTableScroll"><table className="psRubricTable"><thead><tr><th>Grade</th><th>Level</th><th>Achievement</th><th>Meaning</th></tr></thead><tbody>{question.levels.map(l=><tr key={l.grade}><td>{l.grade}</td><td><input aria-label={`Level ${l.grade}`} value={l.level} onChange={e=>update({levels:question.levels.map(v=>v.grade===l.grade?{...v,level:e.target.value}:v)})}/></td><td><input aria-label={`Achievement ${l.grade}`} value={l.achievement} onChange={e=>update({levels:question.levels.map(v=>v.grade===l.grade?{...v,achievement:e.target.value}:v)})}/></td><td><input aria-label={`Meaning ${l.grade}`} value={l.meaning} onChange={e=>update({levels:question.levels.map(v=>v.grade===l.grade?{...v,meaning:e.target.value}:v)})}/></td></tr>)}</tbody></table></div>
            <h4>4. Final result bands</h4><div className="psTableScroll"><table className="psRubricTable"><thead><tr><th>Final Score</th><th>Classification</th><th>Result</th></tr></thead><tbody>{question.resultBands.map(b=><tr key={b.range}><td><input aria-label={`Final score range ${b.range}`} value={b.range} onChange={e=>update({resultBands:question.resultBands.map(v=>v===b?{...v,range:e.target.value}:v)})}/></td><td><input aria-label={`Classification ${b.range}`} value={b.classification} onChange={e=>update({resultBands:question.resultBands.map(v=>v===b?{...v,classification:e.target.value}:v)})}/></td><td><select aria-label={`Result ${b.range}`} value={b.result} onChange={e=>update({resultBands:question.resultBands.map(v=>v===b?{...v,result:e.target.value as "Pass"|"Fail"}:v)})}><option>Pass</option><option>Fail</option></select></td></tr>)}</tbody></table></div>
            <h4>5. Rules</h4>{RULES.map(({key,label})=><div className="mcqcDDToggleRow psRule" key={key}><span>{label}</span><Switch label={label} checked={question.rules[key]} onChange={v=>update({rules:{...question.rules,[key]:v}})}/></div>)}

          </div>
        </DragPanel>
      </div>
      <div className="mcqcBuilderBottom"><button type="button" className="mcqcBuilderAction mcqcSubmitQuestion" onClick={()=>jump(active+1)} disabled={active>=values.questionCount-1}><Icon name="plus.svg" size={20}/>Add Questions</button><div className="mcqcBuilderArrows"><button className="mcqcRoundNav" type="button" disabled={active===0} aria-label="Previous question" onClick={()=>jump(active-1)}><Icon name="arrowleft.svg"/></button><button className="mcqcRoundNav" type="button" disabled={active>=values.questionCount-1} aria-label="Next question" onClick={()=>jump(active+1)}><Icon name="arrowright.svg"/></button></div></div>
    </section>
    <aside className="mcqcBuilderAside mcqcMatchAside"><section className="mcqcAsideSection"><h3>Question Settings</h3><div className="mcqcBuilderField"><label htmlFor="psPoints">Points</label><div className="mcqcPointsControl"><input id="psPoints" type="number" min="1" value={question.points} onChange={e=>update({points:e.target.value})}/><div className="mcqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(question.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="mcqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(1,(Number(question.points)||1)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div>{validationMessage("Question Points must be greater than zero.",!(Number(question.points)>0))}</div>
      <div className="mcqcBuilderField"><label>Difficulty</label><NeumoSelect value={question.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/>{validationMessage("Choose difficulty.",!question.difficulty)}</div><div className="mcqcBuilderField"><label>Category</label><NeumoSelect value={question.category} options={CATEGORIES} onChange={v=>update({category:v})}/>{validationMessage("Choose a category.",!question.category)}</div><div className="mcqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={question.bloom} options={BLOOMS} onChange={v=>update({bloom:v})}/>{validationMessage("Choose Bloom’s Taxonomy.",!question.bloom)}</div>
      <div className="mcqcBuilderField"><label>Tag</label><div className="mcqcTagHolder"><button className="mcqcAddTag" type="button" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag&&<input className="mcqcTagInput" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tagInput.trim()){e.preventDefault();update({tags:[...new Set([...question.tags,tagInput.trim()])]});setTagInput("");setAddingTag(false);}}}/>}</div><div className="mcqcTagRow">{question.tags.map(tag=><button key={tag} type="button" onClick={()=>update({tags:question.tags.filter(t=>t!==tag)})}>{tag}<Icon name="cancel.svg" size={14}/></button>)}</div></div><div className="mcqcMandatory"><span>Mandatory</span><Switch label="Mandatory Question" checked={question.mandatory} onChange={v=>update({mandatory:v})}/></div><p className="mcqcAsideHint">This Question is Mandatory</p></section>
      <section className="mcqcAsideSection mcqcBuilderSummary"><h3>Assessment Summary</h3><div className="mcqcStatGrid"><div><strong>{questionDone}</strong><span>Questions</span></div><div><strong>{questions.filter(complete).reduce((s,q)=>s+(Number(q.points)||0),0)}</strong><span>Marks</span></div><div><strong>{values.duration}</strong><span>Minutes</span></div></div><div className="mcqcSummaryProgress"><span style={{width:`${questionDone/Math.max(1,values.questionCount)*100}%`}}/></div><p>Target is {values.questionCount} questions · {values.totalMarks} marks. {isReady?"All questions are ready.":"Add questions to get started."}</p><div className="mcqcBuilderField"><label>Passing Score</label><PassingScoreSelect value={values.passingScore} onChange={onPassingScoreChange}/></div></section>
    </aside></div>
    {notice&&<p role={notice==="Saved successfully."?"status":"alert"} className={notice==="Saved successfully."?"mcqcSaveSuccessToast":"mcqcBuilderNotice"}>{notice}</p>}
    <div className="mcqcBuilderPageFooter"><button type="button" className="mcqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="mcqcFooterPill" onClick={()=>{try{saveDraft(questions,values,richHtml);}catch{/* Storage full: preview current state. */}setPreviewing(true);setShowValidation(true);setNotice("");}}>Preview Questions</button><div className="mcqcSaveContinueGroup">{isSaving && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="mcqcFooterPill" onClick={()=>save(false)}>Save</button><button type="button" className="mcqcFooterPill mcqcFooterContinue" disabled={isSaving} onClick={requestContinue}>Continue to evaluation</button></div></div>
  </div>;
}
export default function ProblemSolvingContentPage(){
  const router=useRouter();
  const [values,setValues]=useState<AssessmentValues>(DEFAULT_VALUES);
  const [questions,setQuestions]=useState<ProblemQuestion[]>(()=>Array.from({length:DEFAULT_VALUES.questionCount},(_,i)=>newQuestion(DEFAULT_VALUES.marksPerQuestion,false)));
  const [pageReady,setPageReady]=useState(false);
  useEffect(()=>{
    const details=loadDetails();setValues(details);
    let saved:unknown[]=[];
    try{const raw=assessmentStorage.getItem(CONTENT_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.questions))saved=parsed.questions;}}catch{/* Keep sample. */}
    setQuestions(Array.from({length:details.questionCount},(_,i)=>saved[i]?normalizeQuestion(saved[i],details.marksPerQuestion):newQuestion(details.marksPerQuestion,false)));
    setPageReady(true);
  },[]);
  const updatePassingScore=(score:string)=>setValues(old=>({...old,passingScore:score}));
  return <main className="mcqcAppShell problemSolvingCreator"><div className="mcqcLayout"><Sidebar/><section className="mcqcMainContent"><div className="mcqcHeader"><Header/></div><div className="mcqcScrollArea"><div className="mcqcPageContent">{pageReady && <ProblemBuilder questions={questions} setQuestions={setQuestions} values={values} onPassingScoreChange={updatePassingScore} onExit={()=>router.back()}/>}</div></div></section></div></main>;
}
