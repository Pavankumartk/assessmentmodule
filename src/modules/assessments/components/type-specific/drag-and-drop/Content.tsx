"use client";
import AssessmentRichToolbar from "@/modules/assessments/components/common/AssessmentRichToolbar";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./dragdrop.css";
import { assessmentStorage, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`dragcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
}
// The same working toolbar is used for questions, answers, feedback, explanations and hints.
const MCQC_FONTS = ["Segoe UI", "Inter"];
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
  const [font, setFont] = useState("Segoe UI");
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
  return <div className="dragcRichEditorRoot">
    <AssessmentRichToolbar label={placeholder} onRemember={remember} onCommand={command} onError={onError} onChooseFile={kind => { setFileKind(kind); if (fileInput.current) { fileInput.current.accept = kind === "image" ? "image/*" : ""; fileInput.current.value = ""; fileInput.current.click(); } }} />
    {menu && typeof document !== "undefined" && createPortal(
      <div ref={floatingMenu} className={`dragcFloatingFormatMenu ${menu === "symbols" ? "dragcFloatingSymbols" : ""}`}
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
      className="dragcRichEditable" onInput={notify} onBeforeInput={e => { const input = e.nativeEvent as InputEvent; if (input.data && allowedText(input.data) !== input.data) e.preventDefault(); }} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={e => { e.preventDefault(); const text=allowedText(e.clipboardData.getData("text/plain")); if (text) document.execCommand("insertText", false, text); notify(); }}/>
    <small className="assessmentEditorCounter" aria-live="polite">{value.length}/250</small>
  </div>;
}
// Drag & Drop / Match the Following content. The existing layout and editor are reused.
type DragChoice = { id: string; text: string; kind: "Text" | "Image"; role: "Correct" | "Distractor" };
type DragQuestion = {
  type: string; text: string; points: string; difficulty: string; category: string; bloom: string;
  mandatory: boolean; items: DragChoice[]; mapping: Record<string,string>;
  shuffle: boolean; zoneWidth: string; grading: "Equal Marks" | "Custom";
  negative: string; partialCredit: boolean; minZero: boolean; allowMove: boolean;
  zoneMarks: Record<string,string>; scoreOverrides?: Record<string,string>; graderInfo: string;
  feedbackFull: string; feedbackPartial: string; feedbackZero: string;
  explanation: string; hint: string; showHint: boolean; allowHint: boolean;
};
type MCQDetailsValues = { totalMarks: number; questionCount: number; marksPerQuestion: number };
const DEFAULT_VALUES: MCQDetailsValues = { totalMarks: 1, questionCount: 1, marksPerQuestion: 1 };
const positiveInt = (v: unknown, fallback: number) => { const n = Number(v); return v !== null && v !== undefined && v !== "" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback; };
const nonnegative = (v: unknown, fallback: number) => { const n = Number(v); return v !== null && v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback; };
const newChoice = (index: number): DragChoice => ({ id: `choice-${index}`, text: "", kind: "Text", role: "Correct" });
const newQuestion = (points = 1): DragQuestion => ({
  type: "Drag & Drop", text: "", points: String(points), difficulty:"", category: "", bloom: "",
  mandatory: true, items: Array.from({ length: 4 }, (_, i) => newChoice(i)), mapping: {},
  shuffle: true, zoneWidth: "110", grading: "Equal Marks", negative: "NA", partialCredit: true,
  minZero: true, allowMove: true, zoneMarks: {}, scoreOverrides: {}, graderInfo: "", feedbackFull: "",
  feedbackPartial: "", feedbackZero: "", explanation: "", hint: "",
  showHint: false, allowHint: false
});
const zoneIds = (text: string): string[] => {
  const found = [...text.matchAll(/\[\[(\d+)\]\]/g)].map(m => m[1]);
  return [...new Set(found)];
};
const choiceLabel = (index: number) => String.fromCharCode(65 + index);
const displayedMarks = (value: number): string =>
  Number.isInteger(value) && value > 0 && value < 10 ? String(value).padStart(2, "0") : String(Number(value.toFixed(2)));
const marksMenu = (points: number, current: number): string[] => {
  const values = Array.from({length: Math.min(201,Math.max(0,Math.floor(points))+1)},(_,i)=>i);
  if (!values.some(v=>v===current)) values.push(current);
  return [...new Set(values.filter(v=>Number.isFinite(v) && v>=0 && v<=points))]
    .sort((a,b)=>b-a).map(displayedMarks);
};
const correctItemIds = (q: DragQuestion) => new Set(q.items.filter(x => x.role === "Correct").map(x => x.id));
const dragDropErrors = (q: DragQuestion): string[] => {
  const errors: string[] = [];
  const zones = zoneIds(q.text);
  const itemIds = correctItemIds(q);
  if (q.type !== "Drag & Drop") errors.push("Select Drag & Drop as the question type.");
  if (q.text.length > 250) errors.push("Question text must be 250 characters or fewer.");
  if (q.items.some(x => x.text.length > 250)) errors.push("Drag item text must be 250 characters or fewer.");
  if (!q.text.trim()) errors.push("Write your question.");
  if (!zones.length) errors.push("Add at least one drop zone.");
  if (q.items.length < 2) errors.push("Add at least two drag items.");
  if (q.items.some(x => !x.text.trim())) errors.push("Enter text for every drag item.");
  if (!itemIds.size) errors.push("Mark at least one item as Correct.");
  if (new Set(q.items.map(x => x.text.trim().toLowerCase())).size !== q.items.length) errors.push("Drag item labels must be unique.");
  zones.forEach(id => { if (!itemIds.has(q.mapping[id])) errors.push(`Choose a correct drag item for Zone [[${id}]].`); });
  const mapped = zones.map(id => q.mapping[id]).filter(Boolean);
  if (new Set(mapped).size !== mapped.length) errors.push("Map a different correct item to each zone.");
  if (!(Number(q.points) > 0) || !Number.isFinite(Number(q.points))) errors.push("Points must be greater than zero.");
  if (!q.difficulty) errors.push("Select a difficulty level.");
  if (!q.category) errors.push("Select a category.");
  if (!q.bloom) errors.push("Select a Bloom’s Taxonomy level.");
  if (Object.entries(q.scoreOverrides ?? {}).some(([count, value]) =>
    !Number.isInteger(Number(count)) || Number(count) < 0 || Number(count) > zones.length ||
    !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > Number(q.points))) {
    errors.push("Score simulator marks must be between 0 and the question's total points.");
  }
  if (q.grading === "Custom") {
    const values = zones.map(id => Number(q.zoneMarks[id] ?? 0));
    if (values.some(n => !Number.isFinite(n) || n < 0)) errors.push("Zone marks must be non-negative numbers.");
    if (Math.abs(values.reduce((s,n) => s + n, 0) - Number(q.points)) > .00001) errors.push("Total zone marks must match Points.");
  }
  return errors;
};
const isComplete = (q: DragQuestion) => dragDropErrors(q).length === 0;
const getZoneMarks = (q: DragQuestion, id: string) => q.grading === "Equal Marks" ? Number(q.points) / Math.max(1,zoneIds(q.text).length) : Number(q.zoneMarks[id] ?? 0);
const scoreFor = (q: DragQuestion, correctCount: number) => {
  const zones = zoneIds(q.text);
  const override = q.scoreOverrides?.[String(correctCount)];
  if (override !== undefined && override !== "" && Number.isFinite(Number(override))) return Number(override);
  const clamped = Math.max(0, Math.min(correctCount,zones.length));
  const values = zones.map(id => getZoneMarks(q,id));
  let score = q.partialCredit ? values.slice(0,clamped).reduce((s,n)=>s+n,0) : (clamped===zones.length ? Number(q.points) : 0);
  const penalty = q.negative === "NA" ? 0 : Number(q.negative) || 0;
  score -= (zones.length-clamped)*penalty;
  return q.minZero ? Math.max(0,score) : score;
};


const scoreForZoneMatches = (q: DragQuestion, matchedZones: string[]): number => {
  const zones = zoneIds(q.text);
  const override = q.scoreOverrides?.[String(matchedZones.length)];
  if (override !== undefined && override !== "" && Number.isFinite(Number(override))) return Number(override);
  let points = q.partialCredit
    ? matchedZones.reduce((sum, zone) => sum + getZoneMarks(q, zone), 0)
    : (matchedZones.length === zones.length ? Number(q.points) : 0);
  const penalty = q.negative === "NA" ? 0 : Number(q.negative) || 0;
  points -= (zones.length - matchedZones.length) * penalty;
  return q.minZero ? Math.max(0, points) : points;
};

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
  return <div className="dragcSelectRoot dragcTypeRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="dragcSelectTrigger" aria-label="Question Type" disabled aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? "dragcQuestionTypeList" : undefined} onClick={() => setOpen(previous => !previous)}>
      <span>{label || "Select Question Type"}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "dragcRotated" : ""}/>
    </button>
    {open && <div id="dragcQuestionTypeList" className="dragcTypeDropdown">
      <label className="dragcTypeSearch"><Icon name="search-02.svg" size={20}/><input autoFocus type="search" placeholder="Search assessment types..." value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="dragcTypeGroups">{ASSESSMENT_TYPE_GROUPS.map(group => {
        const filtered = group.items.filter(item => item === "Drag & Drop" && item.toLowerCase().includes(normalized));
        if (!filtered.length) return null;
        const isExpanded = normalized ? true : expanded.includes(group.heading);
        const items = filtered;
        return <section className="dragcTypeGroup" key={group.heading}>
          <button type="button" className="dragcTypeHeading" aria-expanded={isExpanded} onClick={() => setExpanded(previous => previous.includes(group.heading) ? previous.filter(name => name !== group.heading) : [...previous, group.heading])}>
            <span>{group.heading}</span><Icon name="arrow-down-01.svg" size={20} className={isExpanded ? "dragcRotated" : ""}/>
          </button>
          {isExpanded && <div className="dragcTypeOptions">{items.map(item => <button type="button" key={item} className="dragcTypeOption" role="radio" aria-checked={label === item} onClick={() => { onChange(item === "Multiple Choice Question (MCQ)" ? "MCQ" : item); setOpen(false); setSearch(""); }}>
            <span className={`dragcOptionRadio ${label === item ? "dragcOptionSelected" : ""}`} aria-hidden="true"/><span>{item}</span>
          </button>)}</div>}
        </section>;
      })}</div>
      {normalized && !ASSESSMENT_TYPE_GROUPS.some(group => group.heading.toLowerCase().includes(normalized) || group.items.some(item => item.toLowerCase().includes(normalized))) && <p className="dragcTypeEmpty">No assessment types found.</p>}
    </div>}
  </div>;
}
function NeumoSelect({ value, options, onChange, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div className="dragcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="dragcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="dragcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="dragcSelectItem" onClick={() => { onChange(option); setOpen(false); }}>{value === option ? <SelectedCheck/> : <span className="dragcOptionRadio"/>}<span>{option}</span></button>)}</div>}</div>;
}


// Figma's raised 24px checked circle. The SVG is supplied by the assessmenticons folder.
function SelectedCheck() {
  return <span className="dragcDDSelectedCheck" aria-hidden="true"><Icon name="checkmark-circle-02.svg" size={16}/></span>;
}

// Mapping values are stable drag-item IDs, so editing a label never breaks its zone mapping.
function MappingSelect({ items, value, usedIds, onChange }: {
  items: DragChoice[]; value: string; usedIds: string[]; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const choiceName = (choice: DragChoice, index: number) =>
    `${choiceLabel(index)}. ${choice.text.trim() || `Drag item ${choiceLabel(index)}`}`;
  const selectedIndex = items.findIndex(item => item.id === value);
  const selected = selectedIndex >= 0 ? choiceName(items[selectedIndex], selectedIndex) : "Select correct drag item";
  const choices = items.map((item, index) => ({ item, index })).filter(({ item }) => item.role === "Correct");
  return <div className="dragcSelectRoot dragcDDMappingSelect" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="dragcSelectTrigger" aria-label="Choose correct drag item" aria-expanded={open}
      aria-haspopup="listbox" onClick={() => setOpen(previous => !previous)}>
      <span>{selected}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "dragcRotated" : ""}/>
    </button>
    {open && <div className="dragcSelectList dragcDDMappingList" role="listbox" aria-label="Correct drag items">
      {choices.length === 0 && <p className="dragcDDMappingEmpty">Add a Correct drag item first.</p>}
      {choices.map(({ item, index }) => {
        const unavailable = !item.text.trim() || (usedIds.includes(item.id) && item.id !== value);
        return <button key={item.id} type="button" role="option" aria-selected={value === item.id}
          disabled={unavailable} className={`dragcSelectItem ${value === item.id ? "is-selected" : ""}`}
          onClick={() => { onChange(item.id); setOpen(false); }}>
          {value === item.id ? <SelectedCheck/> : <span className="dragcOptionRadio"/>}
          <span>{choiceName(item, index)}</span>
          {usedIds.includes(item.id) && item.id !== value && <small>Mapped</small>}
        </button>;
      })}
    </div>}
  </div>;
}

function Switch({ checked, onChange, label }: { checked:boolean; onChange:(value:boolean)=>void; label:string }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`dragcSwitch ${checked ? "dragcSwitchOn" : ""}`} onClick={()=>onChange(!checked)}>
    <span className="dragcSwitchText">{checked ? "ON" : "OFF"}</span>
  </button>;
}
function DragPanel({ title, icon, open, onToggle, children, subtitle }: {
  title:string; icon:string; open:boolean; onToggle:()=>void; children: React.ReactNode; subtitle?:string;
}) {
  return <section className={`dragcDDPanel ${open ? "is-open" : ""}`}>
    <button type="button" className="dragcAnswerExpand dragcDDPanelHead" aria-expanded={open} aria-label={`${title}: ${open ? "collapse" : "expand"}`} onClick={onToggle}>
      <span className="dragcDDPanelHeading"><span className="dragcDDPanelIcon"><Icon name={icon} size={19}/></span><strong>{title}</strong></span>
      {subtitle && !/^\d+\s*\/\s*\d+/.test(subtitle) && <small className="dragcDDPanelCount">{subtitle}</small>}
      <Icon name="arrow-down-01.svg" size={20} className={open ? "dragcRotated" : ""}/>
    </button>
    {open && <div className="dragcDDPanelBody">{children}</div>}
  </section>;
}
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function QuestionTextWithZones({text, q, learner, answers, onSelectZone}: {
 text:string; q:DragQuestion; learner:boolean; answers:Record<string,string>; onSelectZone:(zone:string)=>void;
}) {
  const parts = text.split(/(\[\[\d+\]\])/g);
  return <p className="dragcDDPreviewSentence">{parts.map((part,index)=>{
    const match = /^\[\[(\d+)\]\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;
    const zone = match[1]; const selected = answers[zone];
    const label = learner ? (q.items.find(x=>x.id===selected)?.text || "Drop here") : "Drop here";
    return <button type="button" key={index} className={`dragcDDDropZone ${selected ? "has-answer" : ""}`} disabled={!learner}
      onClick={()=>onSelectZone(zone)} onDragOver={e=>{if(learner)e.preventDefault();}}
      onDrop={e=>{ if(learner) { e.preventDefault(); const data=e.dataTransfer.getData("text/plain"); if(data) onSelectZone(zone+"|"+data); } }}
      aria-label={`Zone ${zone}: ${label}`} style={{minWidth:`${q.zoneWidth}px`}}>{label}</button>;
  })}</p>;
}
function DragPreview({ questions, active, setActive, tags, readyAll, onBack, onEdit, onContinue, saving }: {
 questions:DragQuestion[]; active:number; setActive:(v:number)=>void; tags:string[]; readyAll:boolean;
 onBack:()=>void; onEdit:(i:number)=>void; onContinue:()=>void; saving:boolean;
}) {
  const [filter,setFilter]=useState("All Questions");
  const [filterOpen,setFilterOpen]=useState(false);
  const [learner,setLearner]=useState(false);
  const [expanded,setExpanded]=useState({items:true,mapping:true,grading:true,feedback:true,settings:true});
  const [responses,setResponses]=useState<Record<number,Record<string,string>>>({});
  const [selectedChoice,setSelectedChoice]=useState<string|null>(null);
  const [showResult,setShowResult]=useState(false);
  const valid=questions.map((q,index)=>({q,index})).filter(({q})=>!!q.text.trim());
  const shown=valid.filter(({q})=>filter==="All Questions"||(filter==="Complete"?isComplete(q):!isComplete(q)));
  const current=shown.find(x=>x.index===active) || shown[0];
  const q=current?.q;
  const currentIndex=current?.index ?? 0;
  const answers=responses[currentIndex] || {};
  const zones=q ? zoneIds(q.text) : [];
  const displayChoices=useMemo(()=>{
    if (!q || !learner || !q.shuffle) return q?.items || [];
    return [...q.items].sort(()=>Math.random()-.5);
  },[q,learner]);
  const matchedZones=q ? zones.filter(z=>Boolean(q.mapping[z]) && answers[z]===q.mapping[z]) : [];
  const correctCount=matchedZones.length;
  const toggle=(key:keyof typeof expanded)=>setExpanded(old=>({...old,[key]:!old[key]}));
  const answerZone=(encoded:string)=>{
    const [zone,dragId] = encoded.split("|");
    if (!q) return;
    const chosen=dragId || selectedChoice;
    if(!chosen || (!q.allowMove && answers[zone])) return;
    if (!q.items.some(item => item.id === chosen)) return;
    setResponses(old => {
      const current = { ...old[currentIndex] };
      // One draggable choice occupies one zone at a time.
      Object.keys(current).forEach(key => { if (key !== zone && current[key] === chosen) delete current[key]; });
      current[zone] = chosen;
      return {...old, [currentIndex]: current};
    });
    setSelectedChoice(null);setShowResult(false);
  };
  const navTo=(dir:number)=>{if(!shown.length)return;const idx=Math.max(0,shown.findIndex(x=>x.index===currentIndex));setActive(shown[Math.min(shown.length-1,Math.max(0,idx+dir))].index);setShowResult(false);setSelectedChoice(null);};
  return <div className="dragcPreview">
    <nav className="dragcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><Link href="/assessments/create">Create Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="dragcPreviewCard">
      <header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="dragcPreviewControls">
        <div className="dragcPreviewTotals"><div><strong>{valid.length}</strong><span>Questions</span></div><div><strong>{valid.reduce((s,x)=>s+(Number(x.q.points)||0),0)}</strong><span>Marks</span></div><div className="dragcPreviewReady"><Icon name={readyAll?"checkmark-square-02.svg":"alert.svg"} size={18}/><span><strong>{readyAll?"Ready":"In Progress"}</strong><small>{readyAll?"All good to continue":"Review incomplete questions"}</small></span></div></div>
        <div className="dragcPreviewTools"><div className="dragcPreviewFilter"><button type="button" onClick={()=>setFilterOpen(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{filterOpen && <div>{["All Questions","Complete","Incomplete"].map(f=><button type="button" key={f} onClick={()=>{setFilter(f);setFilterOpen(false);}}>{f}</button>)}</div>}</div><button type="button" className="dragcPreviewLearner" onClick={()=>{setLearner(v=>!v);setShowResult(false);}}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div>
      </div>
      {q ? <article className="dragcPreviewQuestion" key={currentIndex}>
        <div className="dragcPreviewMeta"><span>Drag & Drop: {q.points} Points</span><span>Status: <b className={isComplete(q)?"dragcGreen":"dragcOrange"}>{isComplete(q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(currentIndex)}><Icon name="edit.svg" size={16}/> Edit</button></div>
        <div className="dragcPreviewPanel"><h3>Question {currentIndex+1}</h3><QuestionTextWithZones text={q.text} q={q} learner={learner} answers={answers} onSelectZone={answerZone}/></div>
        <div className="dragcPreviewPanel dragcDDPreviewItemsPanel"><button type="button" className="dragcPreviewSectionHead" aria-expanded={expanded.items} onClick={()=>toggle("items")}><span><Icon name="adjust-position.svg" size={18}/> Drag Items (Choices in the blank)</span><Icon name="arrow-down-01.svg" size={18} className={expanded.items?"dragcRotated":""}/></button>
        {expanded.items && <div className="dragcDDPreviewChoices">{displayChoices.map((c,i)=><button type="button" key={c.id} className={`dragcDDChoice ${selectedChoice===c.id?"is-selected":""}`} draggable={learner} onDragStart={e=>{e.dataTransfer.setData("text/plain",c.id);setSelectedChoice(c.id);}} onClick={()=>{if(learner)setSelectedChoice(c.id);}}><span>{LETTERS[i]}. {c.text||"(empty)"}</span>{!learner && <b className={c.role==="Correct"?"dragcDDCorrect":"dragcDDDistractor"}>{c.role}</b>}</button>)}</div>}
        {learner && <div className="dragcDDLearnerControls"><small>Select or drag an item, then choose a drop zone.</small><></>{showResult && <strong>{correctCount} of {zones.length} correct · {scoreForZoneMatches(q,matchedZones).toFixed(2)} points</strong>}</div>}</div>
        {!learner && <><div className="dragcPreviewPanel"><button type="button" className="dragcPreviewSectionHead" aria-expanded={expanded.mapping} onClick={()=>toggle("mapping")}><span><Icon name="clipboard-list.svg" size={18}/> Answer mapping &amp; grader information (not shown to learners)</span><Icon name="arrow-down-01.svg" size={18} className={expanded.mapping?"dragcRotated":""}/></button>{expanded.mapping && <div className="dragcDDPreviewMapping">{zones.map(zone=><div key={zone}><span>Zone [[{zone}]]</span><span>{q.items.find(x=>x.id===q.mapping[zone])?.text || "Not mapped"}</span></div>)}<h4>Information for Graders</h4><p className="dragcDDGraderNote">{q.graderInfo || "No additional grading notes."}</p></div>}</div>
        <div className="dragcPreviewPanel"><button type="button" className="dragcPreviewSectionHead" aria-expanded={expanded.grading} onClick={()=>toggle("grading")}>Grading Method <Icon name="arrow-down-01.svg" size={18} className={expanded.grading?"dragcRotated":""}/></button>{expanded.grading && <div className="dragcDDGradingDetails"><div className="dragcDDThree"><label>Grading Method<strong>{q.grading}</strong></label><label>Points (total for Question)<strong>{q.points}</strong></label><label>Negative Marking<strong>{q.negative}</strong></label></div>{[["Partial Credit",q.partialCredit],["Calculate grade with a minimum score of 0",q.minZero],["Allow learner to move items between zones before submit",q.allowMove]].map(([text,value])=><div key={String(text)} className="dragcDDToggleRow"><span>{text}</span><span className={`dragcDDPreviewSwitch ${value ? "is-on" : "is-off"}`} role="img" aria-label={`${text} ${value ? "on" : "off"}`}><span className="dragcDDPreviewSwitchTrack"><span className="dragcDDPreviewSwitchText">{value ? "ON" : "OFF"}</span></span></span></div>)}<div className="dragcDDScoreCheck">Total of zone marks: {zones.reduce((s,z)=>s+getZoneMarks(q,z),0).toFixed(2)} / {q.points} <span>{Math.abs(zones.reduce((s,z)=>s+getZoneMarks(q,z),0)-Number(q.points))<.0001?"Matches Points":"Does not match"}</span></div><div className="dragcDDPreviewScore"><h4>Score Simulator - Outcome per Zone</h4><div className="dragcDDScoreTable"><div className="dragcDDScoreHead"><span>Outcome</span><span>Marks</span></div>{Array.from({length:zones.length+1},(_,i)=>zones.length-i).map(n=><div key={n} className="dragcDDScoreRow"><span>{n} correct, {zones.length-n} wrong</span><span className="dragcDDPreviewScoreMark">{displayedMarks(scoreFor(q,n))}</span></div>)}</div></div></div>}</div>
        <div className="dragcPreviewPanel"><button type="button" className="dragcPreviewSectionHead" aria-expanded={expanded.feedback} onClick={()=>toggle("feedback")}>Feedback and Learning <Icon name="arrow-down-01.svg" size={18} className={expanded.feedback?"dragcRotated":""}/></button>{expanded.feedback && <div className="dragcPreviewLearning">{[["Full Marks",q.feedbackFull,"checkmark-circle.svg"],["Partial Marks",q.feedbackPartial,"alert.svg"],["Zero Marks",q.feedbackZero,"cancel-circle.svg"],["Explanation",q.explanation,"assignments.svg"],["Hint",q.hint,"idea.svg"]].map(([title,value,icon])=><section key={title}><h4><Icon name={icon} size={18}/>{title}</h4><p>{value || "No content entered."}</p></section>)}</div>}</div>
        <div className="dragcPreviewPanel"><button type="button" className="dragcPreviewSectionHead" aria-expanded={expanded.settings} onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={expanded.settings?"dragcRotated":""}/></button>{expanded.settings && <div className="dragcPreviewSettings">{[["Difficulty",q.difficulty,"target.svg"],["Bloom’s Taxonomy",q.bloom||"Not selected","brain.svg"],["Category",q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",q.mandatory?"YES":"NO","circle-check.svg"]].map(([title,value,icon])=><div key={title}><span>{title}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}</div></>}
        {shown.length>1 && <nav className="dragcTrueFalsePreviewPaging"><button type="button" disabled={currentIndex===shown[0].index} onClick={()=>navTo(-1)}>Previous Question</button><span>Question {shown.findIndex(x=>x.index===currentIndex)+1} of {shown.length}</span><button type="button" disabled={currentIndex===shown[shown.length-1].index} onClick={()=>navTo(1)}>Next Question</button></nav>}
        <div className="dragcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button>{saving && <span className="dragcSaveSuccessToast" role="status">Successfully saved</span>}</div>
      </article> : <div className="dragcPreviewEmpty"><p>No questions match this filter.</p><button type="button" onClick={onBack}>Back to Question</button></div>}
    </div>
  </div>;
}

function QuestionBuilder({ questions, setQuestions, mcqValues, onExit }: {
  questions:DragQuestion[]; setQuestions:React.Dispatch<React.SetStateAction<DragQuestion[]>>;
  mcqValues:MCQDetailsValues; onExit:()=>void;
}) {
  const router=useRouter();
  const [active,setActive]=useState(0);
  const [previewing,setPreviewing]=useState(false);
  const [sections,setSections]=useState({question:false,items:false,mapping:false,grading:false,feedback:false});
  const [feedbackSubsections,setFeedbackSubsections]=useState({explanation:true,hint:true});
  const [showValidation,setShowValidation]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [tags,setTags]=useState<string[]>([]);
  const [tagInput,setTagInput]=useState("");
  const [addingTag,setAddingTag]=useState(false);
  const [richHtml,setRichHtml]=useState<Record<string,string>>({});
  const [draftReady,setDraftReady]=useState(false);
  const [notice,setNotice]=useState("");
  const [saveSuccess,setSaveSuccess]=useState(false);
  const [isSaving,setIsSaving]=useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);
  const [numberScrollProgress,setNumberScrollProgress]=useState(0);
  const numberScrollRef=useRef<HTMLDivElement>(null);
  const question=questions[active] || newQuestion(mcqValues.marksPerQuestion);
  const zones=zoneIds(question.text);
  const questionDone=questions.filter(isComplete).length;
  const isReady=questions.length>=mcqValues.questionCount && questions.slice(0,mcqValues.questionCount).every(isComplete);
  const update=(patch:Partial<DragQuestion>)=>setQuestions(old=>old.map((q,i)=>i===active?{...q,...patch}:q));
  const updateQuestionText = (text: string) => setQuestions(old => old.map((q, i) => {
    if (i !== active) return q;
    const previousZones = zoneIds(q.text);
    const nextZones = zoneIds(text);
    const nextSet = new Set(nextZones);
    return {
      ...q, text,
      mapping: Object.fromEntries(Object.entries(q.mapping).filter(([zone]) => nextSet.has(zone))),
      zoneMarks: Object.fromEntries(Object.entries(q.zoneMarks).filter(([zone]) => nextSet.has(zone))),
      scoreOverrides: previousZones.join("|") === nextZones.join("|") ? q.scoreOverrides : {}
    };
  }));
  const toggle=(key:keyof typeof sections)=>setSections(old=>({...old,[key]:!old[key]}));
  const jump=(index:number)=>{setActive(Math.max(0,Math.min(mcqValues.questionCount-1,index)));setNotice("");};
  // Scroll the numbered strip when the selected question changes.
  const dragcNavigateQuestion = (index:number) => {
    const next = Math.max(0,Math.min(mcqValues.questionCount-1,index));
    jump(next);
    const strip = document.querySelector<HTMLElement>(".dragcLiveQuestionNav .dragcQuestionNumbers");
    const tile = strip?.querySelector<HTMLElement>('[data-dragc-index="' + next + '"]');
    if (strip && tile) {
      const area = strip.getBoundingClientRect(), item = tile.getBoundingClientRect();
      if (item.left < area.left) strip.scrollLeft -= area.left-item.left;
      else if (item.right > area.right) strip.scrollLeft += item.right-area.right;
    }
  };

  const syncScroll=()=>{const el=numberScrollRef.current;if(el)setNumberScrollProgress(el.scrollLeft/Math.max(1,el.scrollWidth-el.clientWidth));};
  useEffect(()=>{
    try {
      const saved=JSON.parse(assessmentStorage.getItem("dragDropContentDraft")||"{}");
      if(Number.isInteger(saved.active))setActive(Math.max(0,Math.min(questions.length-1,saved.active)));
      if(saved.richHtml && typeof saved.richHtml==="object") setRichHtml(saved.richHtml);
      if(Array.isArray(saved.tags)) setTags(saved.tags.filter((t:unknown):t is string=>typeof t==="string"));
    } catch { /* Keep the editable draft if old storage cannot be read. */ }
    setDraftReady(true);
  },[]);
  useEffect(()=>{if(!draftReady)return;try{assessmentStorage.setItem("dragDropContentDraft",JSON.stringify({questions,tags,richHtml,active}));}catch{setNotice("Could not save this draft in your browser.");}},[draftReady,questions,tags,richHtml,active]);
  const saveAndContinue=()=>{
    if(isSaving)return;
    setShowValidation(true);
    const firstInvalid=questions.slice(0,mcqValues.questionCount).findIndex(q=>!isComplete(q));
    if(!isReady){
      const index=firstInvalid>=0?firstInvalid:questions.length;
      jump(index);
      setNotice(`Question ${index+1}: ${questions[index]?dragDropErrors(questions[index])[0]:"Add remaining questions."}`);
      setPreviewing(false);
      setSaveSuccess(false);
      return;
    }
    try {
      assessmentStorage.setItem("dragDropContentDraft",JSON.stringify({questions,tags,richHtml,savedAt:new Date().toISOString()}));
      setSaveSuccess(true);
      setNotice("");
      setIsSaving(true);
      updateAssessment({questions:questions.length,marks:questions.reduce((n,q)=>n+Number(q.points||0),0)});
      saveTimer.current = window.setTimeout(() => { setSaveSuccess(false); setIsSaving(false); router.push("/assessments/create/evaluation"); }, 3000);
    } catch {
      setSaveSuccess(false);
      setIsSaving(false);
      setNotice("Could not save this draft in your browser.");
    }
  };
  const richEditor=(field:string,value:string,onChange:(s:string)=>void,placeholder:string)=>
    <div className="dragcEditorCountFrame"><MCQRichEditor key={field} editorId={field} value={value} html={richHtml[field]}
      onChange={onChange} onHtmlChange={html=>setRichHtml(old=>({...old,[field]:html}))} placeholder={placeholder} onError={setNotice}/></div>;
  const addZone=()=>{
    const id=String(Math.max(0,...zones.map(z=>Number(z)))+1);
    const nextText=question.text+(question.text.trim()?" ":"")+`[[${id}]]`;
    setRichHtml(old=>{const copy={...old};delete copy[`dragc-dd-question-${active}`];return copy;});
    update({
      text: nextText,
      zoneMarks: {...question.zoneMarks, [id]: question.grading === "Custom" ? "0" : String(Number(question.points)/(zones.length+1))},
      scoreOverrides: {}
    });
    setSections(old=>({...old,question:true,mapping:true}));
  };
  const addChoice=()=>{if(question.items.length>=26){setNotice("Maximum 26 drag items.");return;}update({items:[...question.items,newChoice(Date.now())]});setSections(old=>({...old,items:true}));};
  const updateChoice=(id:string,patch:Partial<DragChoice>)=>update({items:question.items.map(c=>c.id===id?{...c,...patch}:c)});
  const removeChoice=(id:string)=>{if(question.items.length<=2)return;const mapping=Object.fromEntries(Object.entries(question.mapping).filter(([,value])=>value!==id));update({items:question.items.filter(c=>c.id!==id),mapping});};
  const totalZoneMarks=zones.reduce((s,z)=>s+getZoneMarks(question,z),0);
  const addQuestion=()=>{jump(active+1);setAddOpen(false);setSections({question:false,items:false,mapping:false,grading:false,feedback:false});};
  if(previewing) return <DragPreview questions={questions} active={active} setActive={setActive} tags={tags} readyAll={isReady} saving={isSaving}
    onBack={()=>setPreviewing(false)} onEdit={index=>{jump(index);setPreviewing(false);setSections(old=>({...old,question:true,items:true}));}} onContinue={saveAndContinue}/>;
  return <div className="dragcBuilder">
    <div className="dragcBuilderTop"><nav className="dragcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg"/><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg"/><strong>Create Questions</strong></nav><div className="dragcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30}/><div><h2>Let&apos;s Get Started! Institute?</h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
    <div className={`dragcBuilderGrid ${active===0&&!questions.slice(1).some(q=>q.text.trim())?"dragcFirstQuestion":""}`}>
      <section className="dragcBuilderMain">
        <div className="assessmentCreatorQuestionHeading"><strong>Question {active + 1} of {mcqValues.questionCount}</strong></div>
        <div className="dragcQuestionsHeading" data-dragc-question-heading="true"><div><h2>Question {active+1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} {mcqValues.questionCount===1?"Question":"Questions"} | {mcqValues.totalMarks} Marks</p></div></div>
        <div className={"dragcNumberNavigation dragcLiveQuestionNav " + (mcqValues.questionCount<=7?"dragcFewQuestions":"dragcManyQuestions")} data-dragc-question-navigation="mcq" role="group" aria-label="Question navigation">
  <button type="button" className="dragcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>dragcNavigateQuestion(active-1)}><Icon name="arrowleft.svg" size={20}/></button>
  <div className="dragcNumberScroller"><div className="dragcQuestionNumbers" aria-label="Question numbers">
    {Array.from({length:mcqValues.questionCount},(_,index)=>{
      const item=questions[index];const status=item&&isComplete(item)?"is-complete":index===active?"is-active":"is-empty";
      return <button type="button" key={index} data-dragc-index={index} className={"dragcQuestionNumber " + status} aria-label={"Question " + (index+1)} aria-current={active===index?"step":undefined} onClick={()=>dragcNavigateQuestion(index)}>
        <span className="dragcNumberValue">{index+1}</span><span className={"dragcNumberStatus " + (status==="is-complete"?"is-done":"is-pending")} aria-hidden="true">{status==="is-complete"?"✓":""}</span><small>DD</small>
      </button>;
    })}
  </div></div>
  <button type="button" className="dragcRoundNav" aria-label="Next question" disabled={active>=mcqValues.questionCount-1} onClick={()=>dragcNavigateQuestion(active+1)}><Icon name="arrowright.svg" size={20}/></button>
</div>
        <div className="dragcQuestionForm dragcDDQuestionForm">
          <div className="dragcBuilderField"><label>Question Type</label><QuestionTypeDropdown value="Drag & Drop" onChange={v=>{if(v==="Drag & Drop" || v==="Match the Following"){update({type:"Drag & Drop"});setNotice("");}else{setNotice(`${v} is a different assessment type. Drag & Drop remains selected on this page.`);}}}/></div>
          <DragPanel title="Question and Drop Zone" icon="chart-01.svg" open={sections.question} onToggle={()=>toggle("question")}>
            <div className="dragcBuilderField dragcWriteField"><label>Write your Question</label><div className="dragcEditorSurface">{richEditor(`dragc-dd-question-${active}`,question.text,updateQuestionText,"Write your question...")}</div></div>
            <div className="dragcBuilderField"><label>Drag Zone</label><div className="dragcDDZones">{zones.length?zones.map(zone=><span className="dragcDDZonePlaceholder" key={zone}>[[{zone}]]</span>):null}</div></div>
            <div className="dragcDDTwo"><div className="dragcBuilderField dragcDDShuffleField"><label>Shuffle drag Items</label><div className="dragcDDToggleRow"><span>Shuffle drag Items</span><Switch label="Shuffle drag items" checked={question.shuffle} onChange={v=>update({shuffle:v})}/></div></div><div className="dragcBuilderField"><label>Drop zone width (px)</label><NeumoSelect value={question.zoneWidth} options={["80","100","110","120","150","180","220"]} onChange={v=>update({zoneWidth:v})}/></div></div>
          </DragPanel>
          <DragPanel title="Drag Items" icon="adjust-position.svg" open={sections.items} onToggle={()=>toggle("items")}>
            <div className="dragcDDItems">{question.items.map((choice,i)=><div className="dragcDDItemRow" key={choice.id}><span className="dragcDDLetter">{choiceLabel(i)}</span><input aria-label={`Drag item ${choiceLabel(i)}`} value={choice.text} onChange={e=>updateChoice(choice.id,{text:e.target.value})} placeholder={choice.kind === "Image" ? "Enter image src..." : `Enter drag item ${choiceLabel(i)}`}/><NeumoSelect value={choice.kind} options={["Text","Image"]} onChange={v=>updateChoice(choice.id,{kind:v as DragChoice["kind"]})}/><NeumoSelect value={choice.role === "Distractor" ? "Wrong" : "Correct"} options={["Correct","Wrong"]} onChange={v=>{const role:DragChoice["role"]=v==="Wrong"?"Distractor":"Correct";update({items:question.items.map(c=>c.id===choice.id?{...c,role}:c),mapping:role==="Distractor"?Object.fromEntries(Object.entries(question.mapping).filter(([,id])=>id!==choice.id)):question.mapping});}}/><button type="button" className="dragcIconButton dragcDDRemoveDrag" aria-label={`Remove drag item ${choiceLabel(i)}`} disabled={question.items.length<=2} onClick={()=>removeChoice(choice.id)}><Icon name="cancel-circle.svg" size={16}/></button></div>)}</div>
            <button type="button" className="dragcBuilderAction dragcDDAddSmall dragcDDAddDrags" onClick={addChoice}><Icon name="plus.svg" size={16}/><span>Add Drags</span></button>
          </DragPanel>
          <DragPanel title="Answer Correct mapping" icon="clipboard-list.svg" open={sections.mapping} onToggle={()=>toggle("mapping")}>
            <div className="dragcDDMapping">{zones.map(zone=><div className="dragcDDMapRow" key={zone}>
              <span>Zone [[{zone}]]</span>
              <MappingSelect
                items={question.items}
                value={question.mapping[zone] || ""}
                usedIds={zones.filter(other => other !== zone).map(other => question.mapping[other]).filter(Boolean)}
                onChange={choiceId => update({mapping:{...question.mapping,[zone]:choiceId}})}
              />
            </div>)}</div>
            <button type="button" className="dragcBuilderAction dragcDDAddSmall dragcDDAddZones" onClick={addZone}><Icon name="plus.svg" size={16}/><span>Add Zone</span></button>
          </DragPanel>
          <DragPanel title="Grading Method" icon="assignments.svg" open={sections.grading} onToggle={()=>toggle("grading")}>
            <div className="dragcDDThree"><div className="dragcBuilderField"><label>Grading Method</label><NeumoSelect value={question.grading} options={["Equal Marks","Custom"]} onChange={v=>update({grading:v as DragQuestion["grading"],scoreOverrides:{}})}/></div><div className="dragcBuilderField"><label>Points (total for Question)</label><NeumoSelect value={question.points} options={[...new Set([...Array.from({length:Math.max(10,zones.length)},(_,i)=>String(i+1)),"15","20","25","30","40","50","100",question.points])].sort((a,b)=>Number(a)-Number(b))} onChange={v=>update({points:v,scoreOverrides:{}})}/></div><div className="dragcBuilderField"><label>Negative Marking</label><NeumoSelect value={question.negative} options={["NA","0","0.25","0.5","1"]} onChange={v=>update({negative:v,scoreOverrides:{}})}/></div></div>
            {question.grading==="Custom"&&zones.map(zone=><label className="dragcDDCustomZone" key={zone}>Zone [[{zone}]] marks<input type="number" min={0} step="0.5" value={question.zoneMarks[zone]??""} placeholder="0" onChange={e=>update({zoneMarks:{...question.zoneMarks,[zone]:e.target.value},scoreOverrides:{}})}/></label>)}
            <div className="dragcDDToggleRow"><span>Partial Credit</span><Switch label="Partial Credit" checked={question.partialCredit} onChange={v=>update({partialCredit:v,scoreOverrides:{}})}/></div>
            <div className="dragcDDToggleRow"><span>Calculate grade with a minimum score of 0</span><Switch label="Minimum score 0" checked={question.minZero} onChange={v=>update({minZero:v,scoreOverrides:{}})}/></div>
            <div className="dragcDDToggleRow"><span>Allow learner to move items between zones before submit</span><Switch label="Move drag items" checked={question.allowMove} onChange={v=>update({allowMove:v})}/></div>
            <div className="dragcDDScoreCheck">Total of zone marks : {totalZoneMarks.toFixed(2)} / {question.points}<strong className={Math.abs(totalZoneMarks-Number(question.points))<.0001?"dragcDDCorrect":"dragcDDDistractor"}>{Math.abs(totalZoneMarks-Number(question.points))<.0001?"Matches Points":"Check Points"}</strong></div>
            <div className="dragcBuilderField"><label>Score Simulator - Outcome per Zone</label><div className="dragcDDScoreTable"><div className="dragcDDScoreHead"><span>Outcome</span><span>Marks</span></div>{zones.length > 0 && Array.from({length:zones.length+1},(_,i)=>zones.length-i).map(n=><div className="dragcDDScoreRow" key={n}><span>{n} correct, {zones.length-n} wrong</span><NeumoSelect value={displayedMarks(scoreFor(question,n))} options={marksMenu(Number(question.points),scoreFor(question,n))} onChange={value=>update({scoreOverrides:{...question.scoreOverrides,[n]:String(Number(value))}})}/></div>)}</div></div>
          </DragPanel>
          <DragPanel title="Feedback" icon="message-circle-more.svg"  open={sections.feedback} onToggle={()=>toggle("feedback")}>
            {([["Full Marks","feedbackFull","Write feedback for all zones matched..."],["Partial Marks","feedbackPartial","Write feedback for partial marks..."],["Zero Marks","feedbackZero","Write feedback for zero marks..."]] as const).map(([label,key,placeholder])=><div className={`dragcBuilderField dragcDDFeedbackField dragcDDFeedback${key}`} key={key}><label>{label}</label><div className="dragcEditorSurface">{richEditor(`dragc-dd-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder)}</div></div>)}
            {([["Explanation","explanation","assignments.svg","Explain the correct mapping..."],["Hint","hint","idea.svg","Write a hint..."]] as const).map(([label,key,icon,placeholder])=><div key={key} className="dragcDDFeedbackSubpanel">
              <button type="button" className="dragcDDFeedbackSubhead" aria-expanded={feedbackSubsections[key]} onClick={()=>setFeedbackSubsections(old=>({...old,[key]:!old[key]}))}>
                <span className="dragcDDPanelHeading"><span className="dragcDDPanelIcon"><Icon name={icon} size={18}/></span><strong>{label}</strong></span>
                <Icon name="arrow-down-01.svg" size={18} className={feedbackSubsections[key]?"dragcRotated":""}/>
              </button>
              {feedbackSubsections[key] && <div className="dragcDDFeedbackSubbody"><div className="dragcEditorSurface">{richEditor(`dragc-dd-${key}-${active}`,question[key],v=>update({[key]:v}),placeholder)}</div>{key==="hint" && <div className="dragcHintChecks"><label><input type="checkbox" checked={question.showHint} onChange={e=>update({showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={question.allowHint} onChange={e=>update({allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}
            </div>)}
          </DragPanel>
          {showValidation && dragDropErrors(question).length>0 && <div className="dragcValidationErrors" role="alert">{dragDropErrors(question).map(text=><p key={text}>{text}</p>)}</div>}
        </div>
        <div className="dragcBuilderBottom"><button type="button" className="dragcBuilderAction dragcSubmitQuestion" onClick={addQuestion}><Icon name="plus.svg" size={20}/>Add Questions</button><div className="dragcBuilderArrows"><button type="button" className="dragcRoundNav" aria-label="Previous" disabled={active===0} onClick={()=>jump(active-1)}><Icon name="arrowleft.svg"/></button><button type="button" className="dragcRoundNav" aria-label="Next" disabled={active>=mcqValues.questionCount-1} onClick={()=>jump(active+1)}><Icon name="arrowright.svg"/></button></div></div>
      </section>
      <aside className="dragcBuilderAside"><section className="dragcAsideSection"><h3>Question Settings</h3>
        <div className="dragcBuilderField"><label htmlFor="dragcPoints">Points</label><div className="dragcPointsControl"><input id="dragcPoints" type="number" min="0" step="1" value={question.points} onChange={e=>update({points:e.target.value})}/><div className="dragcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(question.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="dragcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(question.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div>
        <div className="dragcBuilderField"><label>Difficulty</label><NeumoSelect value={question.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="dragcBuilderField"><label>Category</label><NeumoSelect value={question.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="dragcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={question.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div>
        <div className="dragcBuilderField"><label>Tag</label><div className="dragcTagHolder"><button type="button" className="dragcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="dragcTagInput" autoFocus aria-label="New tag" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tagInput.trim()){e.preventDefault();setTags(old=>old.includes(tagInput.trim())?old:[...old,tagInput.trim()]);setTagInput("");setAddingTag(false);}}}/>}</div><div className="dragcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(t=>t!==tag))}>{tag}<Icon name="cancel-circle.svg" size={14}/></button>)}</div></div>
        <div className="dragcMandatory"><span>Mandatory</span><Switch checked={question.mandatory} onChange={v=>update({mandatory:v})} label="Mandatory Question"/></div><p className="dragcAsideHint">This Question is Mandatory</p>
      </section></aside>
    </div>
    {notice && <p className="dragcBuilderNotice dragcValidationError" role="status">{notice}</p>}
    <div className="dragcBuilderPageFooter"><button type="button" className="dragcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="dragcFooterPill" onClick={()=>{setPreviewing(true);setNotice("");}}>Preview Questions</button><div className="dragcSaveContinueGroup">{saveSuccess && <span className="dragcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="dragcFooterPill dragcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}
export default function DragDropContentPage() {
  const router=useRouter();
  const [mcqValues,setMcqValues]=useState<MCQDetailsValues>(DEFAULT_VALUES);
  const [questions,setQuestions]=useState<DragQuestion[]>([newQuestion()]);
  const [pageReady,setPageReady]=useState(false);
  useEffect(()=>{
    try {
      const detailsRaw=assessmentStorage.getItem("dragDropAssessmentDraft") || assessmentStorage.getItem("dragdropAssessmentDraft");
      const draft=detailsRaw?JSON.parse(detailsRaw):{};
      const questionCount=positiveInt(draft.questionCount??assessmentStorage.getItem("dragDropQuestionCount"),DEFAULT_VALUES.questionCount);
      const totalMarks=nonnegative(draft.totalMarks,DEFAULT_VALUES.totalMarks);
      const marksPerQuestion=nonnegative(draft.marksPerQuestion,DEFAULT_VALUES.marksPerQuestion);
      setMcqValues({questionCount,totalMarks,marksPerQuestion});
      const contentRaw=assessmentStorage.getItem("dragDropContentDraft");
      const content=contentRaw?JSON.parse(contentRaw) as {questions?:DragQuestion[]} : {};
      const saved=Array.isArray(content.questions)?content.questions:[];
      setQuestions(Array.from({length:questionCount},(_,i)=>saved[i]?{...newQuestion(marksPerQuestion),...saved[i],type:"Drag & Drop",items:Array.isArray(saved[i].items)?saved[i].items:[],mapping:saved[i].mapping||{}}:newQuestion(marksPerQuestion)));
    } catch {setQuestions(Array.from({length:DEFAULT_VALUES.questionCount},()=>newQuestion()));}
    setPageReady(true);
  },[]);
  return <main className="dragcAppShell"><div className="dragcLayout"><Sidebar/><section className="dragcMainContent"><div className="dragcHeader"><Header/></div><div className="dragcScrollArea"><div className="dragcPageContent">{pageReady && <QuestionBuilder questions={questions} setQuestions={setQuestions} mcqValues={mcqValues} onExit={()=>router.push("/assessments/create/details")}/>}</div></div></section></div></main>;
}
