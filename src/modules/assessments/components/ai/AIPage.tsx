"use client";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from "react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import { getAssessmentAdapter } from "@/modules/assessments/config/component-registry";
import { assessmentStorage, getActiveAssessmentId } from "@/modules/assessments/storage/assessment-storage";
import "./ai.css";

/* Only image src icons; place the matching SVGs in public/assets/assessmenticons/. */
const ROOT = "/assets/assessmenticons/";
const ICON = {
  breadcrumb: "arrowrightdouble.svg", ai: "ai-brain.svg", alert: "alerto.svg", down: "arrow-down-01.svg",
  upload: "upload.svg", document: "file.svg", undo: "undo.svg", redo: "redo.svg",
  bold: "bold.svg", italic: "italic.svg", underline: "underline.svg", color: "highlighter.svg", highlight: "highlighter.svg", clear: "cancel.svg", ordered: "text-centerline-center-top.svg", superscript: "sigma.svg", subscript: "sigma.svg", list: "text-centerline-center-top.svg",
  align: "text-centerline-center-top.svg", image: "image.svg", link: "attachment.svg", attachment: "attachment.svg",
  checked: "checkmark-square-02.svg", radio: "checkmark-circle-02.svg", emptyRadio: "record.svg",
  extArrow: "arrowright.svg", extArrowUp: "arrowupright.svg", extRemove: "cancel-01.svg",
  extRemoveCircle: "cancel-circle.svg", extLayers: "layers.svg", extTime: "alarm-clock.svg", extTarget: "target-02.svg",
} as const;
function Asset({ icon, size = 20, className = "" }: { icon: string; size?: number; className?: string }) {
  return <img src={`${ROOT}${icon}`} className={className} width={size} height={size} alt="" aria-hidden="true" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />;
}

const STORAGE = "neurolxp-ai-question-generator-draft";
type CreatorType = string;
const aiDraftKey = (type: CreatorType) => `${STORAGE}-${type}`;
const TYPE_INFO: Record<string, { label: string; row: string; abbr: string }> = {
  "single-choice": { label: "MCQ", row: "mcq", abbr: "MC" },
  "short-answer": { label: "Short Answers", row: "short", abbr: "SA" },
  "one-word": { label: "One Word", row: "one", abbr: "OW" },
  "true-false": { label: "True / False", row: "tf", abbr: "TF" },
  "fill-in-the-blanks": { label: "Fill in the Blanks", row: "fill", abbr: "FB" },
  "long-answer": { label: "Long Answer", row: "essay", abbr: "LA" },
  "matching": { label: "Match the Following", row: "matching", abbr: "MA" },
  "drag-and-drop": { label: "Drag and Drop", row: "drag", abbr: "DD" },
  "memory-game": { label: "Memory Game", row: "memory", abbr: "MG" },
  "connect-the-dots": { label: "Connect the Dots", row: "connect", abbr: "CD" },
  "clickable-hotspot": { label: "Clickable Hotspot", row: "hotspot", abbr: "CH" },
  "image-based": { label: "Image Based", row: "image", abbr: "IB" },
  "assignment": { label: "Assignment", row: "assignment", abbr: "AS" },
  "problem-solving": { label: "Problem Solving", row: "problem", abbr: "PS" },
  "ai-interview": { label: "AI Interview", row: "interview", abbr: "AI" },
};
const typeInfo = (type: CreatorType) => type === "ai-viva" ? { label: "AI Viva", row: "interview", abbr: "AI" } : TYPE_INFO[getAssessmentAdapter(type)?.questionMode || "single-choice"] || TYPE_INFO["single-choice"];
const typeRowKey = (type: CreatorType): TypeKey => typeInfo(type).row;
const typeLabel = (type: CreatorType) => typeInfo(type).label;

const SECTIONS = [
  { id: "source", title: "Source Material", subtitle: "Choose what AI should use" },
  { id: "destination", title: "Where to Save", subtitle: "Choose where questions go" },
  { id: "quantity", title: "Question Type and Quantity", subtitle: "Choose what to create and how many" },
  { id: "difficulty", title: "Difficulty and Thinking Level", subtitle: "Set question difficulty and thinking level" },
  { id: "multipleChoice", title: "Multiple Choice Settings", subtitle: "Control answer options" },
  { id: "feedback", title: "Feedback, hints and References", subtitle: "Add feedback, hints and sources." },
  { id: "language", title: "Language, notation and accessibility", subtitle: "Make questions clear and accessible" },
  { id: "quality", title: "Model and Quality Checks", subtitle: "Control AI quality and checks." },
  { id: "review", title: "Review And Permissions", subtitle: "Set who reviews and approves" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const SOURCES = ["Uploaded File", "Course Library", "External Content", "Pasted Text", "Topic or Syllabus", "Web Page"] as const;
const SOURCE_LABELS: Record<string, string> = { "Uploaded File": "Upload File", "Course Library": "Course Activity", "External Content": "External Source", "Topic or Syllabus": "Topic and Syllabus" };
const TYPES = [
  { key: "mcq", abbr: "MC", name: "Multiple Choice", desc: "One Or Several Correct Answers", tone: "blue", count: 6, mark: 1 },
  { key: "tf", abbr: "TF", name: "True / False", desc: "Two possible answers", tone: "orange", count: 2, mark: 1 },
  { key: "short", abbr: "SA", name: "Short Answers", desc: "Text Matched Against Accepted Answers", tone: "pink", count: 2, mark: 2 },
  { key: "one", abbr: "OW", name: "One Word", desc: "Short exact text answers", tone: "purple", count: 1, mark: 1 },
  { key: "fill", abbr: "FB", name: "Fill in the Blanks", desc: "Choose answers for missing words", tone: "blue", count: 1, mark: 1 },
  { key: "matching", abbr: "MA", name: "Matching", desc: "Match related pairs", tone: "purple", count: 1, mark: 3 },
  { key: "numeric", abbr: "NU", name: "Numerical", desc: "With Tolerance And Units", tone: "green", count: 0, mark: 1 },
  { key: "essay", abbr: "ES", name: "Essay", desc: "Graded Manually : A Rubric Is Drafted Too", tone: "teal", count: 1, mark: 10 },
  { key: "drag", abbr: "DD", name: "Drag and Drop in the Text", desc: "Graded Manually : A Rubric Is Drafted Too", tone: "olive", count: 0, mark: 2 },
] as const;
type TypeKey = string;
type TypeRow = { count: number; marks: number | ""; configured: boolean };
type ExternalLesson = { id: string; title: string; minutes: number; selected: boolean };
type ExternalSource = {
  id: string; title: string; url: string; lessons: ExternalLesson[];
  focus: string[]; related: string[]; chosenTopics: string[];
  fullSection: boolean; demo?: boolean;
};
const SAMPLE_LESSONS: ExternalLesson[] = [
  { id: "a", title: "4.1 Light-dependent reactions", minutes: 14, selected: true },
  { id: "b", title: "4.2 The Calvin Cycle", minutes: 19, selected: true },
  { id: "c", title: "4.3 Limiting Factors", minutes: 12, selected: true },
  { id: "d", title: "4.4 Quiz Walkthrough", minutes: 8, selected: true },
  { id: "e", title: "4.5 Light reactions review", minutes: 6, selected: true },
];
const SAMPLE_EXTERNAL: ExternalSource[] = [
  {
    id: "demo-photosynthesis", title: "Cell Biology Essentials - Section 4 : Photosynthesis",
    url: "https://www.udemy.com/course/cell-biology-essentials/", demo: true,
    lessons: SAMPLE_LESSONS.map(l => ({ ...l })),
    focus: ["Photosynthesis", "Rubisco"], related: ["Photolysis", "ATP synthesis", "Carbon fixation", "Light intensity", "CO2 Limits"],
    chosenTopics: ["Photosynthesis", "Rubisco"], fullSection: false,
  },
  {
    id: "demo-calvin", title: "Cell Biology Essentials - Section 4 : Calvin Cycle", demo: true,
    url: "https://www.udemy.com/course/cell-biology-essentials/?section=calvin",
    lessons: SAMPLE_LESSONS.map(l => ({ ...l, id: `calvin-${l.id}`, title: l.title.replace("4.", "5.") })),
    focus: ["Calvin Cycle", "Rubisco"], related: ["Carbon fixation", "ATP synthesis", "Photosynthesis"],
    chosenTopics: ["Calvin Cycle"], fullSection: false,
  },
  {
    id: "demo-rubisco", title: "Cell Biology Essentials - Section 4 : Rubisco", demo: true,
    url: "https://www.udemy.com/course/cell-biology-essentials/?section=rubisco",
    lessons: SAMPLE_LESSONS.map(l => ({ ...l, id: `rubisco-${l.id}`, title: l.title.replace("4.", "6.") })),
    focus: ["Rubisco", "Carbon fixation"], related: ["Calvin Cycle", "Photorespiration", "Photosynthesis"],
    chosenTopics: ["Rubisco"], fullSection: false,
  },
];
const EXTERNAL_READ = ["Captions and Transcripts", "Lecture notes and attached resources", "Slides shown on screen", "The platform own quiz questions"];
const EXTERNAL_RIGHTS = [
  "My institution’s licence covers using this content to create assessments",
  "Never reuse the source’s own wording in a stem or answer",
  "Record the platform, course and lecture on every question created",
];

type Settings = {
  source: string; fileName: string; fileSize: number; pageMode: string; pageRange: string;
  sourceText: string; topic: string; url: string; course: string; learningOutcomes: string; activityResource: string;
  onlySource: boolean; skipHeaders: boolean; includeFigures: boolean;
  courseSave: string; questionPattern: string; prefix: string; saveAs: string; tags: string; aiTag: boolean;
  rows: Record<TypeKey, TypeRow>;
  easy: number; medium: number; hard: number; thinking: string[]; reading: string; stemLength: string;
  answerOptions: number; correctAnswers: string; wrongRules: string[]; shuffleChoices: boolean; separateStem: boolean; numbering: string;
  feedbackRules: string[]; hintCount: string; removeWrong: boolean; citationRules: string[]; rationale: boolean;
  language: string; secondLanguage: boolean; notation: string; units: string; accessibility: string[];
  model: string; creativity: number; qualityRules: string[]; bannedWords: string;
  reviewRules: string[]; reviewer: string; recordRules: string[];
  externalPlatform: string; externalLinks: string; externalSources: ExternalSource[];
  externalRead: string[]; externalRights: string[]; externalAccount: string;
};
const DEFAULT: Settings = {
  source: "Uploaded File", fileName: "", fileSize: 0, pageMode: "All Pages", pageRange: "Select",
  sourceText: "", topic: "", url: "", course: "", learningOutcomes: "", activityResource: "",
  onlySource: true, skipHeaders: false, includeFigures: false,
  courseSave: "", questionPattern: "", prefix: "",
  saveAs: "Draft", tags: "", aiTag: true,
  rows: Object.fromEntries(TYPES.map(t => [t.key, { count: t.count, marks: t.mark, configured: false }])) as Record<TypeKey, TypeRow>,
  easy: 35, medium: 50, hard: 15, thinking: ["Remember", "Understand", "Apply"], reading: "", stemLength: "Short",
  answerOptions: 4, correctAnswers: "One only",
  wrongRules: ["Base them on common misconceptions", "Keep all options about the same length", "Allow ‘All of the above’ and ‘None of the above’", "Avoid absolutes such as always, never, only"],
  shuffleChoices: true, separateStem: true, numbering: "",
  feedbackRules: ["Each answer option", "The question overall (general feedback)", "Separate correct / partly correct / incorrect messages"],
  hintCount: "2", removeWrong: true, citationRules: ["Add the page or section each question came from", "Show the citation to students too"], rationale: true,
  language: "", secondLanguage: false, notation: "Latex", units: "",
  accessibility: ["Never rely on colour alone to describe an option", "Write alt text for any figure used in a stem", "Avoid culture-specific names, places and idioms"],
  model: "", creativity: 50,
  qualityRules: ["Flag near-duplicates of questions already in the bank", "Flag questions whose answer isn't supported by the source", "Flag two options that mean the same thing", "Flag questions that need outside knowledge"],
  bannedWords: "",
  reviewRules: ["I review every question myself", "A second reviewer must approve before status becomes Ready"],
  reviewer: "", recordRules: ["Keep the source, settings and prompt with each question", "Log this run in Generation history"],
  externalPlatform: "Udemy", externalLinks: "", externalSources: SAMPLE_EXTERNAL,
  externalRead: ["Captions and Transcripts", "Slides shown on screen"], externalRights: [...EXTERNAL_RIGHTS], externalAccount: "",
};
// AI Interview and AI Viva drafts start without selected values or example sources.
const emptyInterviewSettings = (): Settings => ({
  ...DEFAULT, source:"", pageMode:"", pageRange:"", onlySource:false, saveAs:"", aiTag:false,
  easy:0, medium:0, hard:0, thinking:[], stemLength:"", answerOptions:0, correctAnswers:"",
  wrongRules:[], shuffleChoices:false, separateStem:false, feedbackRules:[], hintCount:"",
  removeWrong:false, citationRules:[], rationale:false, notation:"", accessibility:[],
  creativity:-1, qualityRules:[], reviewRules:[], recordRules:[], externalPlatform:"",
  externalSources:[], externalRead:[], externalRights:[],
});

type ArrayField = "thinking" | "wrongRules" | "feedbackRules" | "citationRules" | "accessibility" | "qualityRules" | "reviewRules" | "recordRules";
function Pills({ items, value, onChange, name, className = "", buttonOnly = false }: { items: readonly string[]; value: string; onChange: (v: string) => void; name: string; className?: string; buttonOnly?: boolean }) {
  return <div className={`aiPills ${className} ${buttonOnly ? "aiPillsNoRadio" : ""}`} role="radiogroup" aria-label={name}>
    {items.map(item => <button key={item} type="button" role="radio" aria-checked={value === item} className={`aiPill ${item === value ? "selected" : ""}`} onClick={() => onChange(item)}>
      {!buttonOnly && <span className="aiRadioCircle" aria-hidden="true"><Asset icon={item === value ? ICON.radio : ICON.emptyRadio} size={16}/></span>}<span>{name === "Generate From" ? SOURCE_LABELS[item] || item : item}</span>
    </button>)}
  </div>;
}
function Check({ checked, onChange, children, note, blue = false }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; note?: string; blue?: boolean }) {
  return <label className={`aiCheck ${blue ? "aiCheckBlue" : ""}`}>
    <span className={`aiCheckMark ${checked ? "is-checked" : ""}`}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><Asset icon={ICON.checked} size={19} /></span>
    <span className="aiCheckText"><span>{children}</span>{note && <small>{note}</small>}</span>
  </label>;
}
function Group({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <section className={`aiGroup ${className}`}><h3>{label}</h3>{children}</section>;
}
function Dropdown({ label, value, options, onChange, hint, className = "" }: { label: string; value: string; options: string[]; onChange: (v: string) => void; hint?: string; className?: string }) {
  return <NeumoDropdown label={label} value={value} options={options} onChange={onChange} hint={hint} className={className} />;
}
type NeumoOption = string | { label: string; value?: string; group?: boolean; indent?: boolean };
// Keep only the seven tags in the reference. Discard outdated auto-filled tags in saved drafts.
const TAG_OPTIONS = ["biology", "light reactions", "calvin cycle", "easy", "medium", "hard", "application"];
const splitSavedTags = (value: string) => {
  const requested = new Set(value.split(",").map(tag => tag.trim().toLocaleLowerCase()).filter(Boolean));
  return TAG_OPTIONS.filter(tag => requested.has(tag.toLocaleLowerCase()));
};

function NeumoDropdown({ label, value, options, onChange, hint, className = "", ariaLabel, disabled = false, multiple = false }: {
  label: string; value: string; options: NeumoOption[]; onChange: (value: string) => void;
  hint?: string; className?: string; ariaLabel?: string; disabled?: boolean; multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedTags = multiple ? splitSavedTags(value) : [];
  const optionsMapped = options.map(entry => typeof entry === "string" ? { label: entry, value: entry } : entry);
  const seen = new Set<string>();
  const entries = optionsMapped.filter(entry => {
    if (entry.group) return true;
    const key = (entry.value ?? entry.label).trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Old drafts can contain a single value no longer in the options. Don't create duplicate options.
  const currentEntry = entries.find(entry => !entry.group && (entry.value ?? entry.label).toLocaleLowerCase() === value.toLocaleLowerCase());
  const allEntries = multiple || !value || currentEntry ? entries : [{ label: value, value }, ...entries];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".aiNDropdownTrigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open && rootRef.current) {
      const boundary = rootRef.current.closest(".aiScrollArea")?.getBoundingClientRect();
      const bounds = (rootRef.current.querySelector(".aiNDropdownControl") ?? rootRef.current).getBoundingClientRect();
      const bottom = Math.min(window.innerHeight, boundary?.bottom ?? window.innerHeight);
      const top = Math.max(0, boundary?.top ?? 0);
      const below = bottom - bounds.bottom;
      const above = bounds.top - top;
      setOpensUp(below < 300 && above > below);
    }
    setOpen(!open);
  };
  const choose = (chosen: string) => {
    if (multiple) {
      const next = selectedTags.some(tag => tag.toLocaleLowerCase() === chosen.toLocaleLowerCase())
        ? selectedTags.filter(tag => tag.toLocaleLowerCase() !== chosen.toLocaleLowerCase())
        : [...selectedTags, chosen];
      onChange(next.join(", "));
    } else {
      onChange(chosen);
    }
    // Close immediately after every selection, including Tags.
    setOpen(false);
  };
  const menuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".aiNDropdownOption"));
    const index = buttons.findIndex(button => button === document.activeElement);
    const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index < 0 ? buttons.length - 1 : (index - 1 + buttons.length) % buttons.length);
    buttons[next]?.focus();
  };
  const visibleValue = multiple ? (selectedTags.length ? selectedTags.join(", ") : "Select tags") : (currentEntry?.label ?? value) || "Select";
  return <div ref={rootRef} className={`aiNDropdown ${open ? "is-open" : ""} ${opensUp ? "opens-up" : ""} ${disabled ? "is-disabled" : ""} ${className}`}>
    {label && <label className="aiNDropdownLabel" htmlFor={listId + "-trigger"}>{label}</label>}
    <div className="aiNDropdownControl">
    <button type="button" id={listId + "-trigger"} className="aiNDropdownTrigger"
      disabled={disabled} aria-label={ariaLabel || label} aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-haspopup="listbox" onClick={toggleOpen}
      onKeyDown={event => { if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) { event.preventDefault(); toggleOpen(); } }}>
      <span className="aiNDropdownCurrent">{visibleValue}</span>
      <img src={`${ROOT}${ICON.down}`} width={20} height={20} alt="" aria-hidden="true" className="aiNDropdownArrow" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/>
    </button>
    {open && <div id={listId} role="listbox" aria-multiselectable={multiple || undefined} aria-label={ariaLabel || label} className="aiNDropdownMenu" onKeyDown={menuKeyDown}>
      {allEntries.map((entry, index) => entry.group ?
        <div key={`group-${index}`} className="aiNDropdownGroup" role="presentation">{entry.label}</div> :
        <button key={`${entry.value ?? entry.label}-${index}`} type="button" role="option"
          aria-selected={multiple ? selectedTags.some(tag => tag.toLocaleLowerCase() === (entry.value ?? entry.label).toLocaleLowerCase()) : value.toLocaleLowerCase() === (entry.value ?? entry.label).toLocaleLowerCase()}
          className={`aiNDropdownOption ${entry.indent ? "is-indented" : ""} ${(multiple ? selectedTags.some(tag => tag.toLocaleLowerCase() === (entry.value ?? entry.label).toLocaleLowerCase()) : value.toLocaleLowerCase() === (entry.value ?? entry.label).toLocaleLowerCase()) ? "is-selected" : ""} ${multiple ? "aiTagOption" : ""}`}
          onClick={() => choose(entry.value ?? entry.label)}>
          <span>{entry.label}</span>{multiple && selectedTags.some(tag => tag.toLocaleLowerCase() === (entry.value ?? entry.label).toLocaleLowerCase()) && <span className="aiTagOptionMark" aria-hidden="true">✓</span>}
        </button>
      )}
    </div>}
    </div>
    {hint && <small className="aiNDropdownHint">{hint}</small>}
  </div>;
}

function EditorFontDropdown({ kind, ariaLabel, action }: { kind: "family" | "size"; ariaLabel: string; action: (value: string) => void }) {
  const [choice, setChoice] = useState(kind === "family" ? "Arial" : "3");
  const options: NeumoOption[] = kind === "family" ? ["Arial", "Segoe UI", "Georgia", "Verdana"] : [
    { label: "12", value: "2" }, { label: "16", value: "3" }, { label: "18", value: "4" }, { label: "24", value: "5" },
  ];
  return <NeumoDropdown label="" ariaLabel={ariaLabel} value={choice} options={options}
    className={`aiToolbarDropdown ${kind === "size" ? "aiToolbarSize" : ""}`}
    onChange={next => { setChoice(next); action(next); }}/ >;
}

function TextInput({ label, value, onChange, hint, placeholder, className = "" }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; className?: string }) {
  return <label className={`aiField ${className}`}><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />{hint && <small>{hint}</small>}</label>;
}
function Range({ value, onChange, label, color }: { value: number; onChange: (v: number) => void; label: string; color: string }) {
  return <div className="aiRangeControl" style={{ "--ai-track-color": color, "--ai-percent": `${value}%` } as CSSProperties}>
    <span className="aiRangeTrack" aria-hidden="true"><span className="aiRangeFill" /></span>
    <input className="aiSlider" type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label}/>
  </div>;
}
/* Use the user's assessmenticons SVGs, with readable symbols if a file is not present yet. */
const TOOLBAR_FALLBACK: Record<string, string> = {
  "Undo": "↶", "Redo": "↷", "Bold": "B", "Italic": "I", "Underline": "U",
  "Blue text": "A", "Highlight": "✎", "Clear formatting": "Tx", "Align left": "☰",
  "Bulleted list": "•≡", "Numbered list": "1≡", "Superscript": "x²", "Subscript": "x₂",
  "Insert link": "↗", "Attach file": "♧", "Insert image": "▧",
};
function ToolbarButton({ icon, label, action }: { icon: string; label: string; action: () => void }) {
  const [iconMissing, setIconMissing] = useState(false);
  return <button type="button" aria-label={label} title={label} onMouseDown={e => e.preventDefault()} onClick={action}>
    {iconMissing ? <span className={`aiToolbarFallback aiFallback-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`} aria-hidden="true">{TOOLBAR_FALLBACK[label] || "·"}</span> :
      <img src={`${ROOT}${icon}`} alt="" aria-hidden="true" width={17} height={17} onError={() => setIconMissing(true)}/>}
  </button>;
}

/* External Source checkboxes use an explicit image src. Other sections keep their existing Check component. */
function ExternalCheck({ checked, onChange, children, note, blue = false }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; note?: string; blue?: boolean }) {
  return <label className={`aiCheck ${blue ? "aiCheckBlue" : ""}`}>
    <span className={`aiCheckMark ${checked ? "is-checked" : ""}`}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <img src="/assets/assessmenticons/checkmark-square-02.svg" alt="" aria-hidden="true" width={19} height={19} className="aiExtImg" />
    </span>
    <span className="aiCheckText"><span>{children}</span>{note && <small>{note}</small>}</span>
  </label>;
}

/* External Source only: settings are local, so previews never impersonate an API fetch. */
function ExternalSourcesPanel({ settings, patch }: { settings: Settings; patch: (changes: Partial<Settings>) => void }) {
  const sources = settings.externalSources ?? SAMPLE_EXTERNAL;
  const [openCard, setOpenCard] = useState<string | null>("demo-photosynthesis");
  const [showConnection, setShowConnection] = useState(false);
  const [notice, setNotice] = useState("");
  const [bad, setBad] = useState(false);
  const updateSources = (next: ExternalSource[]) => patch({ externalSources: next });
  const updateCard = (id: string, transform: (source: ExternalSource) => ExternalSource) =>
    updateSources(sources.map(source => source.id === id ? transform(source) : source));
  const selectedLessons = sources.reduce((sum, source) => sum + source.lessons.filter(l => l.selected).length, 0);
  const fetchLinks = () => {
    const entered = (settings.externalLinks ?? "").split(/\r?\n/).map(line => line.trim().replace(/^[•*\-]\s*/, "")).filter(Boolean);
    if (!entered.length) { setBad(true); setNotice("Paste one course or lesson URL per line before selecting Fetch All."); return; }
    if (entered.length > 10) { setBad(true); setNotice("Add up to 10 links at a time."); return; }
    const valid: { href: string; title: string }[] = [];
    for (const value of entered) {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw Error("Invalid URL");
        const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).slice(-1)[0] || url.hostname);
        const title = slug.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        valid.push({ href: url.href, title });
      } catch { setBad(true); setNotice(`Invalid URL: ${value}`); return; }
    }
    const existing = new Set(sources.filter(source => !source.demo).map(source => source.url));
    const unique = valid.filter(item => !existing.has(item.href) && (existing.add(item.href), true));
    if (!unique.length) { setBad(true); setNotice("These URLs are already in Sources added."); return; }
    const next = unique.map((item, i): ExternalSource => ({
      id: `local-${Date.now()}-${i}`, url: item.href, title: item.title,
      lessons: Array.from({ length: 5 }, (_, j) => ({ id: `lesson-${j}`, title: `Section ${j + 1} - Add lesson title`, minutes: 0, selected: false })),
      focus: [], related: [], chosenTopics: [], fullSection: true, demo: false,
    }));
    patch({ externalSources: [...sources, ...next], externalLinks: "" });
    setOpenCard(next[0].id); setBad(false);
    setNotice(`${next.length} link${next.length === 1 ? "" : "s"} added as editable local previews. Live lesson fetching requires a platform connector.`);
  };
  return <div className="aiExternal">
    <Group label="Platform">
      <div className="aiExternalPlatform aiInset">
        <NeumoDropdown label="" ariaLabel="External platform" className="aiExternalPlatformDropdown" value={settings.externalPlatform || "Udemy"}
          options={['Udemy','Coursera','edX','LinkedIn Learning','YouTube','Other']}
          onChange={value => patch({ externalPlatform: value })}/>
        <button type="button" className="aiExtButton aiConnectionButton" onClick={() => setShowConnection(open => !open)}>Manage Connections <img src="/assets/assessmenticons/arrowright blue.svg" alt="" width={24} height={24} aria-hidden="true" className="aiExtImg aiExtActionIcon" /></button>
        <p className="aiExternalConnectionNote">{settings.externalAccount ? `Account reference: ${settings.externalAccount}` : "Example: bio.dept@campus.edu · Udemy Business"} <span>· Connection not verified (local preview)</span></p>
        {showConnection && <div className="aiConnectionPanel"><label>Account label (optional)<input type="email" placeholder="your.name@institution.edu" value={settings.externalAccount || ""} onChange={e => patch({ externalAccount: e.target.value })}/></label><p>Saving an account label does not connect to a course platform. Authentication and fetching require an approved API integration.</p><button type="button" className="aiExtButton" onClick={() => setShowConnection(false)}>Close</button></div>}
      </div>
    </Group>
    <Group label="Courses or Lessons (Add up to 10 links at once)">
      <div className="aiExternalLinks aiInset">
        <textarea rows={5} aria-label="External course or lesson URLs" value={settings.externalLinks ?? ""} onChange={e => patch({ externalLinks: e.target.value })} placeholder={"https://www.udemy.com/course/cell-biology-essentials/\nhttps://www.udemy.com/course/example-second-course/"}/>
        <p>Add one link per line. Select the links you need, then fetch them.</p>
        <button className="aiExtButton" type="button" onClick={fetchLinks}>Fetch All</button>
        <small>Frontend preview: new URLs become editable cards. Real course titles, lectures, captions, and authentication need a platform connection.</small>
      </div>
      {notice && <p className={`aiExternalNotice ${bad ? "is-error" : ""}`} role="status">{notice}</p>}
    </Group>
    <Group label="Sources added">
      <div className="aiExternalCards aiInset">
        {sources.length === 0 && <p className="aiExternalEmpty">No sources added. Paste course links above and select Fetch All.</p>}
        {sources.map(source => {
          const open = openCard === source.id;
          const selected = source.lessons.filter(lesson => lesson.selected).length;
          const minutes = source.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
          return <article className={`aiExtCard ${open ? "is-open" : ""}`} key={source.id}>
            <div className="aiExtCardHeader">
              <span className="aiExtAvatar" aria-hidden="true">{settings.externalPlatform === "Udemy" ? "UDE" : (settings.externalPlatform || "EXT").slice(0,3).toUpperCase()}</span>
              <button type="button" className="aiExtCardHeading" onClick={() => setOpenCard(open ? null : source.id)} aria-expanded={open} aria-controls={`ai-ext-card-${source.id}`}>
                <strong>{source.title}</strong>
                <span className="aiExtMeta"><span><img src="/assets/assessmenticons/layers.svg" alt="" width={20} height={20} aria-hidden="true" className="aiExtImg" /> {source.lessons.length} Sections</span><span><img src="/assets/assessmenticons/alarm-clock.svg" alt="" width={20} height={20} aria-hidden="true" className="aiExtImg" /> {minutes ? `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")} Min` : "Length unknown"}</span><span><img src="/assets/assessmenticons/checkcircle red.svg" alt="" width={20} height={20} aria-hidden="true" className="aiExtImg" /> {selected} Selected</span><em className="aiExtTopicCount"><img src="/assets/assessmenticons/targetg.svg" alt="" aria-hidden="true" width={16} height={16} className="aiExtImg" /> {source.chosenTopics.length} Topics Selected</em></span>
              </button>
              <button className="aiExtIconButton" type="button" aria-label={open ? "Collapse course" : "Expand course"} onClick={() => setOpenCard(open ? null : source.id)}><img src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={20} height={20} aria-hidden="true" className={`aiExtImg ${open ? "aiExtRotate" : ""}`} /></button>
              <button className="aiExtIconButton" type="button" aria-label={`Remove ${source.title}`} onClick={() => { updateSources(sources.filter(item => item.id !== source.id)); if (open) setOpenCard(null); }}><img src="/assets/assessmenticons/cancel.svg" alt="" width={20} height={20} aria-hidden="true" className="aiExtImg" /></button>
            </div>
            {open && <div id={`ai-ext-card-${source.id}`} className="aiExtCardBody">
              <div className="aiExtSectionsHead"><strong><span className="aiExtHeadingIcon aiExtHeadingIcon-sections" aria-hidden="true"><img src="/assets/assessmenticons/file.svg" alt="" width={17} height={17} onError={event => { event.currentTarget.style.display = "none"; }}/></span>Sections</strong><div><button className="aiExtButton" type="button" onClick={() => updateCard(source.id, item => ({ ...item, lessons: item.lessons.map(l => ({ ...l, selected: true })) }))}>Select All</button><button className="aiExtButton" type="button" onClick={() => updateCard(source.id, item => ({ ...item, lessons: item.lessons.map(l => ({ ...l, selected: false })) }))}>Clear</button></div></div>
              <div className="aiExtLessons">{source.lessons.map((lesson, index) => <div key={lesson.id} className="aiExtLesson"><ExternalCheck checked={lesson.selected} onChange={checked => updateCard(source.id, item => ({ ...item, lessons: item.lessons.map(l => l.id === lesson.id ? { ...l, selected: checked } : l) }))}>{lesson.title}</ExternalCheck>{!source.demo && <input aria-label={`Edit title for section ${index+1}`} value={lesson.title} onChange={e => updateCard(source.id, item => ({ ...item, lessons: item.lessons.map(l => l.id === lesson.id ? { ...l, title: e.target.value } : l) }))}/>}<span>{lesson.minutes ? `${String(lesson.minutes).padStart(2,"0")} Min Captions` : "No captions fetched"}</span></div>)}</div>
              <div className="aiExtFocus"><strong><span className="aiExtHeadingIcon aiExtHeadingIcon-focus" aria-hidden="true"><img src="/assets/assessmenticons/target-01.svg" alt="" width={17} height={17} onError={event => { event.currentTarget.style.display = "none"; }}/></span>Focus Topics (optional)</strong><p>Choose specific topics from the selected sections</p>
                <div className="aiExtTopicRows">
                  <div className="aiExtChosenTopics" aria-label="Selected focus topics">
                    {source.chosenTopics.map(topic => <button key={topic} type="button" className="aiExtTag selected" aria-pressed="true" title={`Remove ${topic} from focus topics`} onClick={() => updateCard(source.id, item => ({ ...item, chosenTopics: item.chosenTopics.filter(t => t !== topic) }))}>
                      <span className="aiExtChipMark" aria-hidden="true"><img src="/assets/assessmenticons/cancel-circle.svg" alt="" width={14} height={14} onError={event => { event.currentTarget.style.display = "none"; }}/></span>{topic}
                    </button>)}
                  </div>
                  <div className="aiExtRelatedLabel">Related Topics</div>
                  <div className="aiExtRelatedTopics" aria-label="Related topics">
                    {[...new Set([...source.focus, ...source.related])].filter(topic => !source.chosenTopics.includes(topic)).map(topic => <button key={topic} type="button" className="aiExtTag" aria-pressed="false" title={`Add ${topic} to focus topics`} onClick={() => updateCard(source.id, item => ({ ...item, chosenTopics: [...item.chosenTopics, topic] }))}>{topic}</button>)}
                  </div>
                </div>
                <button type="button" className={`aiExtButton aiFullSection ${source.fullSection ? "active" : ""}`} onClick={() => updateCard(source.id, item => ({ ...item, fullSection: !item.fullSection }))}>{source.fullSection ? "Using full selected sections" : "Use full Section instead"}</button>
              </div>
            </div>}
          </article>;
        })}
        <div className="aiExternalCount">{sources.length} source{sources.length === 1 ? "" : "s"} added · {selectedLessons} sections selected</div>
      </div>
    </Group>
    <Group label="What to read"><div className="aiExternalWhat aiInset">{EXTERNAL_READ.map(name => <div key={name} className="aiExternalCheckRow"><ExternalCheck checked={(settings.externalRead ?? []).includes(name)} onChange={checked => patch({ externalRead: checked ? [...(settings.externalRead ?? []), name] : (settings.externalRead ?? []).filter(v => v !== name) })} note={name === "Slides shown on screen" ? "Read with OCR from video frames (requires connected service)" : name === "The platform own quiz questions" ? "Used only as a style guide – never copied" : undefined}>{name}</ExternalCheck></div>)}</div></Group>
    <Group label="Rights"><div className="aiExternalRights aiInset"><div className="aiExtRightsWarning"><span className="aiWarningCircle"><img src="/assets/assessmenticons/alerto.svg" alt="" width={17} height={17} aria-hidden="true" className="aiExtImg" /></span>Third-party content may be licensed. Questions should use new wording, with ideas coming from the original material.</div>{EXTERNAL_RIGHTS.map(name => <div key={name} className="aiExternalCheckRow"><ExternalCheck checked={(settings.externalRights ?? []).includes(name)} onChange={checked => patch({ externalRights: checked ? [...(settings.externalRights ?? []), name] : (settings.externalRights ?? []).filter(v => v !== name) })} note={name === EXTERNAL_RIGHTS[0] ? "Check with your library or platform terms if you’re unsure" : undefined}>{name}</ExternalCheck></div>)}</div></Group>
  </div>;
}

export default function AIPage() {
  const router = useRouter();
  const [creatorType, setCreatorType] = useState<CreatorType>("mcq");
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [expanded, setExpanded] = useState<SectionId[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [legacySettings, setLegacySettings] = useState<Partial<Settings> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const editorSelectionRef = useRef<Range | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Pasted Text has its own editor, selection and attachment inputs; Learning Outcomes is unchanged.
  const pasteEditorSelectionRef = useRef<Range | null>(null);
  const pasteEditorRef = useRef<HTMLDivElement>(null);
  const pasteImageInput = useRef<HTMLInputElement>(null);
  const pasteAttachmentInput = useRef<HTMLInputElement>(null);
  // Topic Name has its own rich-text editor and separate undo/selection history.
  const topicEditorSelectionRef = useRef<Range | null>(null);
  const topicEditorRef = useRef<HTMLDivElement>(null);
  const topicImageInput = useRef<HTMLInputElement>(null);
  const topicAttachmentInput = useRef<HTMLInputElement>(null);
  const patch = (changes: Partial<Settings>) => {
    if (isAiCreator) {
      const next = { ...settingsRef.current, ...changes };
      settingsRef.current = next;
      setSettings(next);
      try { assessmentStorage.setItem("aiGeneratorDraft", JSON.stringify(next)); }
      catch { setIsError(true); setMessage("Could not save settings. Please check browser storage."); return; }
    } else setSettings(prev => ({ ...prev, ...changes }));
    setMessage(""); setIsError(false);
  };
  const toggleSection = (section: SectionId) => setExpanded(prev => prev.includes(section) ? [] : [section]);
  const toggleList = (key: ArrayField, value: string) => patch({ [key]: settings[key].includes(value) ? settings[key].filter(item => item !== value) : [...settings[key], value] });
  const checkList = (key: ArrayField, entries: { name: string; note?: string }[]) => <div className="aiCheckboxes">{entries.map(entry => <div key={entry.name} className="aiCheckEntry"><Check checked={settings[key].includes(entry.name)} onChange={() => toggleList(key, entry.name)} note={entry.note}>{entry.name}</Check></div>)}</div>;
  const rowUpdate = (key: TypeKey, data: Partial<TypeRow>) => patch({ rows: { ...settings.rows, [key]: { ...settings.rows[key], ...data } } });
  const selectedInfo = typeInfo(creatorType);
  const isAiCreator = getAssessmentAdapter(creatorType)?.questionMode === "ai-interview";
  const questionTypes: ReadonlyArray<{key: string; abbr: string; name: string; desc: string; tone: string; count: number; mark: number}> = TYPES.some(t => t.key === selectedInfo.row) ? TYPES : [...TYPES, { key: selectedInfo.row, abbr: selectedInfo.abbr, name: selectedInfo.label, desc: "Questions for this assessment", tone: "blue", count: 0, mark: 1 }];
  const totalQuestions = questionTypes.reduce((sum, t) => sum + (settings.rows[t.key]?.count ?? 0), 0);

  useEffect(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get("type");
      const currentType: CreatorType = requested && getAssessmentAdapter(requested) ? requested : "mcq";
      setCreatorType(currentType);
      // Separate local drafts for MCQ, One Word and Short Answers. Do not mix question counts.
      const selectedKey = typeRowKey(currentType);
      const activeTypes = TYPES.some(t => t.key === selectedKey) ? TYPES : [...TYPES, { key: selectedKey, mark: 1 }];
      const aiCreator = getAssessmentAdapter(currentType)?.questionMode === "ai-interview";
      const typeDefaults: Settings = { ...(aiCreator ? emptyInterviewSettings() : DEFAULT), rows: Object.fromEntries(activeTypes.map(t => [t.key, {
        count: aiCreator ? 0 : t.key === selectedKey ? 1 : 0, marks: aiCreator ? "" : t.mark, configured: false,
      }])) as Record<TypeKey, TypeRow> };
      setSettings(typeDefaults);
      if (aiCreator) {
        assessmentStorage.setItem("aiCreatorLastStep", "generate");
        const openSections = JSON.parse(assessmentStorage.getItem("aiGeneratorExpanded") || "[]");
        if (Array.isArray(openSections)) setExpanded(openSections.filter((id): id is SectionId => SECTIONS.some(section => section.id === id)));
      }
      const stored = aiCreator ? assessmentStorage.getItem("aiGeneratorDraft") : localStorage.getItem(aiDraftKey(currentType));
      const activeId = aiCreator ? getActiveAssessmentId() : null;
      if (activeId && typeof sessionStorage !== "undefined" && sessionStorage.getItem("assessment-editing-id") === activeId && (!stored || assessmentStorage.getItem("aiGeneratorLegacyAvailable") === "1")) {
        try {
          const legacyRaw = localStorage.getItem(aiDraftKey(currentType));
          const legacy = legacyRaw ? JSON.parse(legacyRaw) as Partial<Settings> : null;
          if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
            setLegacySettings(legacy);
            assessmentStorage.setItem("aiGeneratorLegacyAvailable", "1");
          }
        } catch { /* Keep the per-assessment draft if an older shared draft is invalid. */ }
      }
      if (stored) {
        const result = JSON.parse(stored) as Partial<Settings>;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          setSettings(prev => ({ ...prev, ...result,
            tags: splitSavedTags(typeof result.tags === "string" ? result.tags : prev.tags).join(", "),
            // Remove only the old sample defaults from saved drafts. Keep user-entered values.
            activityResource: /^topic 3 - lecture note$/i.test(result.activityResource || "") ? "" : (result.activityResource ?? prev.activityResource),
            courseSave: result.courseSave === "BIO-201 > Unit 3 - Photosynthesis" ? "" : (result.courseSave ?? prev.courseSave),
            questionPattern: result.questionPattern === "U3 - {topic} - {type}-{n}" ? "" : (result.questionPattern ?? prev.questionPattern),
            prefix: result.prefix === "BIO201-U3-AI-001" ? "" : (result.prefix ?? prev.prefix),
            reading: result.reading === "Undergraduate" ? "" : (result.reading ?? prev.reading),
            numbering: result.numbering === "A,b,c" ? "" : (result.numbering ?? prev.numbering),
            language: result.language === "English" ? "" : (result.language ?? prev.language),
            units: result.units === "SI Units" ? "" : (result.units ?? prev.units),
            model: result.model === "Standard - Good balance of speed and quality" ? "" : (result.model ?? prev.model),
            bannedWords: result.bannedWords === "eg: Exam paper codes, Student name" ? "" : (result.bannedWords ?? prev.bannedWords),
            reviewer: result.reviewer === "DR.A.Menon ( Course Lead )" ? "" : (result.reviewer ?? prev.reviewer),
            rows: Object.fromEntries(activeTypes.map(t => [t.key, { ...prev.rows[t.key], ...(result.rows?.[t.key] || {}) }])) as Record<TypeKey, TypeRow> }));
        }
      }
    } catch { /* Ignore invalid stored draft. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (isAiCreator) assessmentStorage.setItem("aiGeneratorDraft", JSON.stringify(settings));
      else localStorage.setItem(aiDraftKey(creatorType), JSON.stringify(settings));
    } catch { /* Explicit Save reports storage issues. */ }
  }, [settings, ready, creatorType, isAiCreator]);
  useEffect(() => {
    if (!ready || !isAiCreator) return;
    try { assessmentStorage.setItem("aiGeneratorExpanded", JSON.stringify(expanded)); } catch { /* Settings can still be saved. */ }
  }, [expanded, ready, isAiCreator]);
  useEffect(() => {
    const element = editorRef.current;
    if (element && document.activeElement !== element && element.innerHTML !== settings.learningOutcomes) element.innerHTML = settings.learningOutcomes;
  }, [settings.learningOutcomes, expanded]);
  useEffect(() => {
    // Restore pasted content on re-opening its source option, without moving the typing caret.
    const element = pasteEditorRef.current;
    if (!element || document.activeElement === element) return;
    if (element.innerHTML !== settings.sourceText) {
      // Existing plain-text drafts remain text; formatted content uses the editor's HTML.
      if (/<\/?(?:div|p|br|b|strong|i|em|u|span|font|ul|ol|li|a|sup|sub|img)\b/i.test(settings.sourceText)) element.innerHTML = settings.sourceText;
      else element.textContent = settings.sourceText;
    }
  }, [settings.sourceText, settings.source, expanded]);
  useEffect(() => {
    // Restore the saved Topic Name without moving the caret while typing.
    const element = topicEditorRef.current;
    if (!element || document.activeElement === element) return;
    if (element.innerHTML !== settings.topic) {
      if (/<\/?(?:div|p|br|b|strong|i|em|u|span|font|ul|ol|li|a|sup|sub|img)\b/i.test(settings.topic)) element.innerHTML = settings.topic;
      else element.textContent = settings.topic;
    }
  }, [settings.topic, settings.source, expanded]);
  const save = () => {
    try { if (isAiCreator) assessmentStorage.setItem("aiGeneratorDraft", JSON.stringify(settings)); else localStorage.setItem(aiDraftKey(creatorType), JSON.stringify(settings)); setIsError(false); setMessage("Settings saved in this browser."); return true; }
    catch { setIsError(true); setMessage("Could not save settings. Please check browser storage."); return false; }
  };
  const restoreLegacySettings = () => {
    if (!legacySettings) return;
    const rows = Object.fromEntries(questionTypes.map(item => [item.key, { ...settingsRef.current.rows[item.key], ...(legacySettings.rows?.[item.key] || {}) }])) as Record<TypeKey, TypeRow>;
    const next = { ...settingsRef.current, ...legacySettings, rows };
    try {
      assessmentStorage.setItem("aiGeneratorDraft", JSON.stringify(next));
      assessmentStorage.removeItem("aiGeneratorLegacyAvailable");
      settingsRef.current = next; setSettings(next); setLegacySettings(null); setIsError(false);
      setMessage("Earlier shared settings restored. Check that they belong to this assessment.");
    } catch { setIsError(true); setMessage("Could not restore settings. Please check browser storage."); }
  };
  const generate = () => {
    if (isAiCreator && !settings.source) { setExpanded(["source"]); setMessage("Choose source material before generating questions."); setIsError(true); return; }
    if (settings.source === "Uploaded File" && !file) { setExpanded(["source"]); setMessage("Upload a file before generating questions."); setIsError(true); return; }
    if ((settings.source === "Pasted Text" && !settings.sourceText.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim()) || (settings.source === "Topic or Syllabus" && !settings.topic.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim()) || (settings.source === "Web Page" && !settings.url.trim())) {
      setExpanded(["source"]); setMessage("Enter source material before generating questions."); setIsError(true); return;
    }
    if (settings.source === "Course Library" && !settings.activityResource?.trim()) {
      setExpanded(["source"]); setMessage("Choose an activity or resource before generating questions."); setIsError(true); return;
    }
    if (settings.source === "External Content" && !(settings.externalSources ?? []).some(s => !s.demo && s.lessons.some(l => l.selected))) { setExpanded(["source"]); setMessage("Add a real source URL and select its sections. Demo cards are only layout previews."); setIsError(true); return; }
    if (!totalQuestions) { setExpanded(["quantity"]); setMessage("Choose at least one question."); setIsError(true); return; }
    if (save()) { setIsError(true); setMessage("Configuration saved. AI question generation requires connecting an AI service."); }
  };
  const upload = (selected?: File) => {
    if (!selected) return;
    if (!/\.(pdf|doc|docx|txt|md|csv)$/i.test(selected.name)) { setMessage("Supported formats: PDF, DOC, DOCX, TXT, MD, CSV."); setIsError(true); return; }
    if (selected.size > 15 * 1024 * 1024) { setMessage("Maximum upload size is 15 MB."); setIsError(true); return; }
    setFile(selected); patch({ source: "Uploaded File", fileName: selected.name, fileSize: selected.size });
  };
  const removeFile = () => { setFile(null); patch({ fileName: "", fileSize: 0 }); if (fileInput.current) fileInput.current.value = ""; };
  const rememberEditorSelection = (target: "learning" | "paste" | "topic" = "learning") => {
    const element = target === "paste" ? pasteEditorRef.current : target === "topic" ? topicEditorRef.current : editorRef.current;
    const selectionRef = target === "paste" ? pasteEditorSelectionRef : target === "topic" ? topicEditorSelectionRef : editorSelectionRef;
    const selection = window.getSelection();
    if (selection?.rangeCount && element?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };
  const applyFormat = (command: string, value?: string, target: "learning" | "paste" | "topic" = "learning") => {
    const editor = target === "paste" ? pasteEditorRef.current : target === "topic" ? topicEditorRef.current : editorRef.current;
    const selectionRef = target === "paste" ? pasteEditorSelectionRef : target === "topic" ? topicEditorSelectionRef : editorSelectionRef;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && selectionRef.current && editor.contains(selectionRef.current.commonAncestorContainer)) {
      try { selection.removeAllRanges(); selection.addRange(selectionRef.current); } catch { /* Keep the current editor caret. */ }
    }
    if (command === "fontName" && value) applyAssessmentFont(editor, value); else document.execCommand(command, false, value);
    rememberEditorSelection(target);
    patch(target === "paste" ? { sourceText: editor.innerHTML } : target === "topic" ? { topic: editor.innerHTML } : { learningOutcomes: editor.innerHTML });
  };
  const addEditorImage = (selected?: File, target: "learning" | "paste" | "topic" = "learning") => {
    if (!selected?.type.startsWith("image/")) return;
    if (selected.size > 1024 * 1024) { setMessage("Use an image smaller than 1 MB for the local draft."); setIsError(true); return; }
    const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") applyFormat("insertImage", reader.result, target); }; reader.readAsDataURL(selected);
  };
  const addEditorAttachment = (selected?: File, target: "learning" | "paste" | "topic" = "learning") => {
    if (!selected) return;
    if (selected.size > 400 * 1024) { setMessage("Use an attachment smaller than 400 KB to include it in the local draft."); setIsError(true); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const link = document.createElement("a");
      link.href = reader.result;
      link.download = selected.name;
      link.textContent = `Attachment: ${selected.name}`;
      applyFormat("insertHTML", link.outerHTML, target);
    };
    reader.readAsDataURL(selected);
  };
  const pasteFormat = (command: string, value?: string) => applyFormat(command, value, "paste");
  const topicFormat = (command: string, value?: string) => applyFormat(command, value, "topic");
  const updateDifficulty = (key: "easy" | "medium" | "hard", value: number) => {
    const others = (["easy", "medium", "hard"] as const).filter(k => k !== key);
    const left = 100 - value; const oldTotal = settings[others[0]] + settings[others[1]];
    const first = oldTotal ? Math.round(left * settings[others[0]] / oldTotal) : Math.round(left / 2);
    patch({ [key]: value, [others[0]]: first, [others[1]]: left - first });
  };
  const estimateEasy = Math.round(totalQuestions * settings.easy / 100);
  const estimateMedium = Math.round(totalQuestions * settings.medium / 100);
  const estimateHard = Math.max(0, totalQuestions - estimateEasy - estimateMedium);

  const content = (section: SectionId): ReactNode => {
    switch (section) {
      case "source": return <div className="aiFlow">
        <div className="aiSourceTitle"><strong>Generate From</strong> <span>(Questions are grounded in whichever source you pick)</span></div>
        <Pills className="aiSourcePills" buttonOnly name="Generate From" items={SOURCES} value={settings.source} onChange={v => patch({ source: v })}/>
        {settings.source === "Uploaded File" && <Group label="Files">
          <input ref={fileInput} className="aiVisuallyHidden" type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv" onChange={e => upload(e.currentTarget.files?.[0])}/>
          <div className={`aiDrop ${dragOver ? "dragover" : ""}`} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={e => { e.preventDefault(); setDragOver(false); }} onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}>
            <button type="button" className="aiDropDescription" onClick={() => fileInput.current?.click()}><strong>Drop files here or browse</strong><small>Supported formats: PDF, DOC, DOCX, TXT, MD, CSV. Maximum 15 MB.</small></button>
            {!file ? <button type="button" className="aiUploadButton" onClick={() => fileInput.current?.click()}><Asset icon={ICON.upload} size={18}/>Upload</button> :
              <div className="aiFileCard"><span className="aiFileIcon"><span className={`aiPdfLabel ${file.name.toLowerCase().endsWith(".pdf") ? "aiPdfFile" : "aiOtherFile"}`}>{file.name.toLowerCase().endsWith(".pdf") ? "PDF" : file.name.split(".").pop()?.toUpperCase()}</span></span><div className="aiFileInfo"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB | {file.name.toLowerCase().endsWith(".pdf") ? "Text Layer Detected" : "File Selected"}</small></div><button type="button" className="aiRemoveFile" onClick={removeFile}>Remove</button></div>}
          </div>
        </Group>}
        {settings.source === "Pasted Text" && <Group label="Paste Your Text" className="aiPasteGroup">
          <div className="aiEditor"><div className="aiToolbar" role="toolbar" aria-label="Paste Your Text toolbar">
            <ToolbarButton icon={ICON.undo} label="Undo" action={() => pasteFormat("undo")}/><ToolbarButton icon={ICON.redo} label="Redo" action={() => pasteFormat("redo")}/>
            <EditorFontDropdown kind="family" ariaLabel="Pasted text font family" action={value => pasteFormat("fontName", value)}/>
            <EditorFontDropdown kind="size" ariaLabel="Pasted text font size" action={value => pasteFormat("fontSize", value)}/>
            <ToolbarButton icon={ICON.bold} label="Bold" action={() => pasteFormat("bold")}/><ToolbarButton icon={ICON.italic} label="Italic" action={() => pasteFormat("italic")}/><ToolbarButton icon={ICON.underline} label="Underline" action={() => pasteFormat("underline")}/>
            <ToolbarButton icon={ICON.color} label="Blue text" action={() => pasteFormat("foreColor", "#2D4CC8")}/><ToolbarButton icon={ICON.highlight} label="Highlight" action={() => pasteFormat("hiliteColor", "#FFF4AA")}/><ToolbarButton icon={ICON.clear} label="Clear formatting" action={() => pasteFormat("removeFormat")}/><ToolbarButton icon={ICON.align} label="Align left" action={() => pasteFormat("justifyLeft")}/><ToolbarButton icon={ICON.list} label="Bulleted list" action={() => pasteFormat("insertUnorderedList")}/>
            <ToolbarButton icon={ICON.ordered} label="Numbered list" action={() => pasteFormat("insertOrderedList")}/><ToolbarButton icon={ICON.superscript} label="Superscript" action={() => pasteFormat("superscript")}/><ToolbarButton icon={ICON.subscript} label="Subscript" action={() => pasteFormat("subscript")}/><ToolbarButton icon={ICON.link} label="Insert link" action={() => { const link = window.prompt("Enter URL"); if (link && /^https?:\/\//i.test(link)) pasteFormat("createLink", link); }}/>
            <ToolbarButton icon={ICON.attachment} label="Attach file" action={() => pasteAttachmentInput.current?.click()}/><ToolbarButton icon={ICON.image} label="Insert image" action={() => pasteImageInput.current?.click()}/>
          </div><input ref={pasteImageInput} className="aiVisuallyHidden" type="file" accept="image/*" onChange={e => { addEditorImage(e.target.files?.[0], "paste"); e.target.value = ""; }}/><input ref={pasteAttachmentInput} className="aiVisuallyHidden" type="file" onChange={e => { addEditorAttachment(e.target.files?.[0], "paste"); e.target.value = ""; }}/>
          <div className="aiEditable aiPasteEditable" ref={pasteEditorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Paste Your Text" aria-multiline="true" data-placeholder="Eg : Paste lecture, a transcript or passage..." onInput={e => { rememberEditorSelection("paste"); patch({ sourceText: e.currentTarget.innerHTML }); }} onKeyUp={() => rememberEditorSelection("paste")} onMouseUp={() => rememberEditorSelection("paste")} onBlur={() => rememberEditorSelection("paste")}/></div>
        </Group>}
        {settings.source === "Topic or Syllabus" && <Group label="Topic Name" className="aiPasteGroup aiTopicGroup">
          <div className="aiEditor"><div className="aiToolbar" role="toolbar" aria-label="Topic Name toolbar">
            <ToolbarButton icon={ICON.undo} label="Undo" action={() => topicFormat("undo")}/><ToolbarButton icon={ICON.redo} label="Redo" action={() => topicFormat("redo")}/>
            <EditorFontDropdown kind="family" ariaLabel="Topic name font family" action={value => topicFormat("fontName", value)}/>
            <EditorFontDropdown kind="size" ariaLabel="Topic name font size" action={value => topicFormat("fontSize", value)}/>
            <ToolbarButton icon={ICON.bold} label="Bold" action={() => topicFormat("bold")}/><ToolbarButton icon={ICON.italic} label="Italic" action={() => topicFormat("italic")}/><ToolbarButton icon={ICON.underline} label="Underline" action={() => topicFormat("underline")}/>
            <ToolbarButton icon={ICON.color} label="Blue text" action={() => topicFormat("foreColor", "#2D4CC8")}/><ToolbarButton icon={ICON.highlight} label="Highlight" action={() => topicFormat("hiliteColor", "#FFF4AA")}/><ToolbarButton icon={ICON.clear} label="Clear formatting" action={() => topicFormat("removeFormat")}/><ToolbarButton icon={ICON.align} label="Align left" action={() => topicFormat("justifyLeft")}/><ToolbarButton icon={ICON.list} label="Bulleted list" action={() => topicFormat("insertUnorderedList")}/>
            <ToolbarButton icon={ICON.ordered} label="Numbered list" action={() => topicFormat("insertOrderedList")}/><ToolbarButton icon={ICON.superscript} label="Superscript" action={() => topicFormat("superscript")}/><ToolbarButton icon={ICON.subscript} label="Subscript" action={() => topicFormat("subscript")}/><ToolbarButton icon={ICON.link} label="Insert link" action={() => { const link = window.prompt("Enter URL"); if (link && /^https?:\/\//i.test(link)) topicFormat("createLink", link); }}/>
            <ToolbarButton icon={ICON.attachment} label="Attach file" action={() => topicAttachmentInput.current?.click()}/><ToolbarButton icon={ICON.image} label="Insert image" action={() => topicImageInput.current?.click()}/>
          </div><input ref={topicImageInput} className="aiVisuallyHidden" type="file" accept="image/*" onChange={e => { addEditorImage(e.target.files?.[0], "topic"); e.target.value = ""; }}/><input ref={topicAttachmentInput} className="aiVisuallyHidden" type="file" onChange={e => { addEditorAttachment(e.target.files?.[0], "topic"); e.target.value = ""; }}/>
          <div className="aiEditable aiPasteEditable" ref={topicEditorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Topic Name" aria-multiline="true" data-placeholder="Eg :Enter Topic name .." onInput={e => { rememberEditorSelection("topic"); patch({ topic: e.currentTarget.innerHTML }); }} onKeyUp={() => rememberEditorSelection("topic")} onMouseUp={() => rememberEditorSelection("topic")} onBlur={() => rememberEditorSelection("topic")}/></div>
        </Group>}
        {settings.source === "Web Page" && <label className="aiField aiWebAddressField"><span>Web Page Address</span><input type="url" inputMode="url" autoComplete="url" aria-label="Web Page Address" value={settings.url} placeholder="https://" onChange={e => patch({ url: e.target.value })}/></label>}

        {settings.source === "Course Library" && <NeumoDropdown
          className="aiActivityField"
          label="Activity or Resource"
          value={settings.activityResource}
          options={["Topic 1 - Introduction to Data Structures", "Topic 2 - Arrays and Linked Lists", "Topic 3 - Lecture Note", "Topic 4 - Class activity"]}
          onChange={value => patch({ activityResource: value })}
        />}
        {settings.source === "External Content" && <ExternalSourcesPanel settings={settings} patch={patch}/>}
        {settings.source !== "External Content" && settings.source !== "Course Library" && settings.source !== "Pasted Text" && settings.source !== "Topic or Syllabus" && settings.source !== "Web Page" && <Group label="Choose Content"><div className="aiInset aiPageRange"><Pills items={["All Pages", "Page Range"]} name="Choose Content" value={settings.pageMode} onChange={v => patch({ pageMode: v })}/><NeumoDropdown label="" ariaLabel="Page range" className="aiPageRangeDropdown" value={settings.pageRange}
          options={["Select", "Pages 1–5", "Pages 6–10", "All even pages", "Custom"]}
          disabled={settings.pageMode !== "Page Range"}
          onChange={value => patch({ pageRange: value, pageMode: "Page Range" })}/>{settings.pageMode === "Page Range" && settings.pageRange === "Custom" && <input className="aiCustomRange" aria-label="Custom page numbers" placeholder="1-5, 8, 12" />}</div></Group>}
        <Group label="Learning Outcomes (Options)"><div className="aiOutcomeHeading"><span>{(settings.learningOutcomes.replace(/<[^>]*>/g, "").length).toLocaleString()}/10,000</span></div>
          <div className="aiEditor"><div className="aiToolbar" role="toolbar" aria-label="Learning outcomes toolbar">
            <ToolbarButton icon={ICON.undo} label="Undo" action={() => applyFormat("undo")}/><ToolbarButton icon={ICON.redo} label="Redo" action={() => applyFormat("redo")}/>
            <EditorFontDropdown kind="family" ariaLabel="Font family" action={value => applyFormat("fontName", value)}/>
            <EditorFontDropdown kind="size" ariaLabel="Font size" action={value => applyFormat("fontSize", value)}/>
            <ToolbarButton icon={ICON.bold} label="Bold" action={() => applyFormat("bold")}/><ToolbarButton icon={ICON.italic} label="Italic" action={() => applyFormat("italic")}/><ToolbarButton icon={ICON.underline} label="Underline" action={() => applyFormat("underline")}/>
            <ToolbarButton icon={ICON.color} label="Blue text" action={() => applyFormat("foreColor", "#2D4CC8")}/><ToolbarButton icon={ICON.highlight} label="Highlight" action={() => applyFormat("hiliteColor", "#FFF4AA")}/><ToolbarButton icon={ICON.clear} label="Clear formatting" action={() => applyFormat("removeFormat")}/><ToolbarButton icon={ICON.align} label="Align left" action={() => applyFormat("justifyLeft")}/><ToolbarButton icon={ICON.list} label="Bulleted list" action={() => applyFormat("insertUnorderedList")}/>
            <ToolbarButton icon={ICON.ordered} label="Numbered list" action={() => applyFormat("insertOrderedList")}/><ToolbarButton icon={ICON.superscript} label="Superscript" action={() => applyFormat("superscript")}/><ToolbarButton icon={ICON.subscript} label="Subscript" action={() => applyFormat("subscript")}/><ToolbarButton icon={ICON.link} label="Insert link" action={() => { const link = window.prompt("Enter URL"); if (link && /^https?:\/\//i.test(link)) applyFormat("createLink", link); }}/>
            <ToolbarButton icon={ICON.attachment} label="Attach file" action={() => attachmentInput.current?.click()}/>
            <ToolbarButton icon={ICON.image} label="Insert image" action={() => imageInput.current?.click()}/>
          </div><input ref={imageInput} className="aiVisuallyHidden" type="file" accept="image/*" onChange={e => { addEditorImage(e.target.files?.[0]); e.target.value = ""; }}/><input ref={attachmentInput} className="aiVisuallyHidden" type="file" onChange={e => { addEditorAttachment(e.target.files?.[0]); e.target.value = ""; }}/>
          <div className="aiEditable" ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Learning Outcomes" aria-multiline="true" data-placeholder="Eg : Explain how light energy is converted to chemical energy ?" onInput={e => { rememberEditorSelection(); patch({ learningOutcomes: e.currentTarget.innerHTML }); }} onKeyUp={() => rememberEditorSelection("learning")} onMouseUp={() => rememberEditorSelection("learning")} onBlur={() => rememberEditorSelection("learning")}/></div>
        </Group>
        <div className={settings.source === "External Content" ? "aiExternalScope" : ""}>{settings.source === "External Content" && <h3>Scope</h3>}<div className="aiCheckboxes aiSourceChecks">{settings.source === "External Content" ? <>
    <ExternalCheck blue checked={settings.onlySource} onChange={v => patch({ onlySource: v })}>Only ask about content present in the source</ExternalCheck>
    <ExternalCheck checked={settings.skipHeaders} onChange={v => patch({ skipHeaders: v })}>Skip headers, page numbers, references and captions</ExternalCheck>
    <ExternalCheck checked={settings.includeFigures} onChange={v => patch({ includeFigures: v })}>Include figures and tables as question material</ExternalCheck>
    </> : <>
    <Check blue checked={settings.onlySource} onChange={v => patch({ onlySource: v })}>Only ask about content present in the source</Check>
    <Check checked={settings.skipHeaders} onChange={v => patch({ skipHeaders: v })}>Skip headers, page numbers, references and captions</Check>
    <Check checked={settings.includeFigures} onChange={v => patch({ includeFigures: v })}>Include figures and tables as question material</Check>
    </>}</div></div>
      </div>;
      case "destination": return <div className="aiFlow">
        <NeumoDropdown label="Question Category" value={settings.courseSave} options={[
          "BIO-201 > Unit 3 - Photosynthesis", { label: "Photosynthesis", group: true },
          { label: "Unit 1", value: "Photosynthesis > Unit 1", indent: true },
          { label: "Unit 2", value: "Photosynthesis > Unit 2", indent: true },
          { label: "Unit 3", value: "Photosynthesis > Unit 3", indent: true },
          "Current Assessment", "Course Library", "Local Drafts",
        ]} onChange={v => patch({ courseSave: v })}/>
        <div className="aiTwo"><TextInput label="Question name Pattern" value={settings.questionPattern} onChange={v => patch({ questionPattern: v })} hint="Preview : U3 - light Reaction - MCQ - 01"/><TextInput label="ID Number Prefix" value={settings.prefix} onChange={v => patch({ prefix: v })} hint="Preview : BIO201-U3-AI-001"/></div>
        <Group label="Status on save"><div className="aiInset aiStatusChoices"><Pills name="Status on save" items={["Draft", "Ready"]} value={settings.saveAs} onChange={v => patch({ saveAs: v })}/></div></Group>
        <NeumoDropdown label="Tags" className="aiTagsDropdown" multiple value={settings.tags}
          options={TAG_OPTIONS} onChange={value => patch({ tags: value })}/>
        <Check blue checked={settings.aiTag} onChange={v => patch({ aiTag: v })}>Add the tag Ai generated automatically</Check>
      </div>;
      case "quantity": return <div className="aiFlow aiQuantity">
        <div className="aiTotals">{totalQuestions} Questions</div>
        <div className="aiTableScroll"><table className="aiTypeTable"><thead><tr><th>Type</th><th>How Many</th><th>Default Mark</th><th>Options</th></tr></thead><tbody>{questionTypes.map(t => {
          const current = settings.rows[t.key]; return <tr key={t.key}><td><div className="aiTypeItem"><span className={`aiTypeBadge aiTone-${t.tone}`}>{t.abbr}</span><span><strong>{t.name}</strong><small>{t.desc}</small></span></div></td>
            <td><div className="aiCounter"><button type="button" aria-label={`Decrease ${t.name}`} disabled={current.count === 0} onClick={() => rowUpdate(t.key, { count: Math.max(0, current.count - 1) })}>−</button><output>{current.count}</output><button type="button" aria-label={`Increase ${t.name}`} onClick={() => rowUpdate(t.key, { count: Math.min(100, current.count + 1) })}>+</button></div></td>
            <td><input className="aiMarks" aria-label={`${t.name} marks per question`} type="text" inputMode="numeric" pattern="[0-9]*" value={isAiCreator && current.marks === "" ? "" : String(current.marks).padStart(2, "0")} onChange={e => { if (/^\d{0,3}$/.test(e.target.value)) rowUpdate(t.key, { marks: isAiCreator && e.target.value === "" ? "" : Math.min(100, Math.max(0, Number(e.target.value) || 0)) }); }}/></td>
            <td><button type="button" className={`aiConfigure ${current.configured ? "configured" : ""}`} aria-pressed={current.configured} onClick={() => rowUpdate(t.key, { configured: !current.configured })}><span>Configure</span></button></td></tr>;
        })}</tbody></table></div>
      </div>;
      case "difficulty": return <div className="aiFlow">
        <Group label="Difficulty Mix (Shares are adjusted to total 100%)"><div className="aiInset aiRanges">{([ ["easy", "Easy", "#247c12"], ["medium", "Medium", "#2d4cc8"], ["hard", "Hard", "#cb5c13"] ] as const).map(([key, label, color]) => <div className="aiRangeRow" key={key}><span>{label}</span><Range value={settings[key]} color={color} label={`${label} difficulty percentage`} onChange={v => updateDifficulty(key, v)}/><output>{settings[key]}%</output></div>)}</div><p className="aiSubHint">Roughly : {estimateEasy} Easy | {estimateMedium} Medium | {estimateHard} hard Across this Run</p></Group>
        <Group label="Thinking Level ( Blooms Taxonomy )"><div className="aiInset aiThinking">{checkList("thinking", [
          { name: "Remember", note: "Recall Terms, Facts And Definitions" }, { name: "Understand", note: "Explain Ideas In The Students Own Words" },
          { name: "Apply", note: "Use A Principle In A New Situation" }, { name: "Analyze", note: "Compare, Interpret Data, Find Relationship" },
          { name: "Evaluate", note: "Judge, Justify, Critique" }, { name: "Create", note: "Design Or Propose Something New" },
        ])}</div></Group>
        <div className="aiTwo aiReadingStem"><NeumoDropdown label="Reading Level" value={settings.reading} options={["School", "Undergraduate", "Postgraduate", "Professional"]} onChange={v => patch({ reading: v })}/>
          <Group label="Stem Length"><div className="aiInset aiStemBox"><Pills name="Stem Length" items={["Short", "Medium", "Scenario - Based"]} value={settings.stemLength} onChange={v => patch({ stemLength: v })}/></div></Group></div>
      </div>;
      case "multipleChoice": return <div className="aiFlow">
        <Dropdown label="Answers Per Question" value={isAiCreator && !settings.answerOptions ? "" : String(settings.answerOptions)} options={["2", "3", "4", "5", "6"]} onChange={v => patch({ answerOptions: Number(v) })}/>
        <Group label="Correct Answers"><Pills buttonOnly name="Correct Answers" items={["One only", "One or More", "Mixed"]} value={settings.correctAnswers} onChange={v => patch({ correctAnswers: v })}/></Group>
        <Group label="Wrong Answers">{checkList("wrongRules", [
          { name: "Base them on common misconceptions" }, { name: "Keep all options about the same length" }, { name: "Allow ‘All of the above’ and ‘None of the above’" }, { name: "Avoid absolutes such as always, never, only" },
        ])}</Group>
        <Group label="Shuffle"><div className="aiCheckboxes"><Check checked={settings.shuffleChoices} onChange={v => patch({ shuffleChoices: v })}>Shuffle options when a student sees the question</Check><Check checked={settings.separateStem} onChange={v => patch({ separateStem: v })}>Spread correct answers evenly across positions</Check></div></Group>
        <Dropdown label="Numbering" value={settings.numbering} options={["A,b,c", "1,2,3", "a,b,c"]} onChange={v => patch({ numbering: v })}/>
      </div>;
      case "feedback": return <div className="aiFlow">
        <Group label="Write Feedback for">{checkList("feedbackRules", [
          { name: "Each answer option", note: "Explains Why That Option Is Right Or Wrong." }, { name: "The question overall (general feedback)" }, { name: "Separate correct / partly correct / incorrect messages" },
        ])}</Group>
        <Dropdown label="Hints" value={settings.hintCount} options={["0", "1", "2", "3", "4", "5"]} onChange={v => patch({ hintCount: v })}/>
        <Check checked={settings.removeWrong} onChange={v => patch({ removeWrong: v })}>Remove wrong answers after each try</Check>
        <Group label="Cite the source">{checkList("citationRules", [{ name: "Add the page or section each question came from" }, { name: "Show the citation to students too" }])}</Group>
        <Group label="Worked solution"><Check checked={settings.rationale} onChange={v => patch({ rationale: v })}>Include a step-by-step solution for calculation questions</Check></Group>
      </div>;
      case "language": return <div className="aiFlow">
        <Dropdown label="Question Language" value={settings.language} options={["English", "Hindi", "Kannada", "Tamil", "Telugu"]} onChange={v => patch({ language: v })}/>
        <Check checked={settings.secondLanguage} onChange={v => patch({ secondLanguage: v })}>Also produce a second language version</Check>
        <Group label="Mathematics and Formulas"><Pills buttonOnly name="Mathematics and Formulas" items={["Latex", "Math ML", "Plain Text"]} value={settings.notation} onChange={v => patch({ notation: v })}/></Group>
        <NeumoDropdown label="Units" value={settings.units} options={["SI Units", "Imperial Units", "No Units", "Custom", "Mixed"]} onChange={v => patch({ units: v })}/>
        <Group label="Accessibility">{checkList("accessibility", [
          { name: "Never rely on colour alone to describe an option" }, { name: "Write alt text for any figure used in a stem" }, { name: "Avoid culture-specific names, places and idioms" },
        ])}</Group>
      </div>;
      case "quality": return <div className="aiFlow">
        <NeumoDropdown label="Model" value={settings.model} options={["Standard - Good balance of speed and quality", "Advanced - Higher quality (if supported)", "Fast - Lower latency"]} onChange={v => patch({ model: v })} hint="Set by your site administrator. Advanced is available only if supported."/>
        <Group label="Variety"><div className="aiVarietyDropdownWrap"><NeumoDropdown label="" ariaLabel="Variety preset" value={isAiCreator && settings.creativity < 0 ? "" : settings.creativity <= 33 ? "Focused" : settings.creativity < 67 ? "Balanced" : "Scenario-Based"} options={["Focused", "Balanced", "Scenario-Based"]} onChange={value => patch({ creativity: value === "Focused" ? 20 : value === "Balanced" ? 50 : 85 })}/></div><div className="aiInset aiVariety"><span>{isAiCreator && settings.creativity < 0 ? "Select variety" : settings.creativity <= 33 ? "Focused" : settings.creativity < 67 ? "Balanced" : "Scenario-Based"}</span><Range label="Variety" value={isAiCreator ? Math.max(0,settings.creativity) : settings.creativity} color="#247c12" onChange={v => patch({ creativity: v })}/></div><p className="aiSubHint"><strong>Low:</strong> source-focused. <strong>High:</strong> scenario-focused.</p></Group>
        <Group label="Checks before review">{checkList("qualityRules", [
          { name: "Flag near-duplicates of questions already in the bank" }, { name: "Flag questions whose answer isn't supported by the source" }, { name: "Flag two options that mean the same thing" }, { name: "Flag questions that need outside knowledge" },
        ])}</Group>
        <Dropdown label="Banned Words" value={settings.bannedWords} options={["eg: Exam paper codes, Student name", "Student names", "Personal information", "None"]} onChange={v => patch({ bannedWords: v })} hint="Never Appear in a question"/>
      </div>;
      case "review": return <div className="aiFlow">
        <Group label="Before saving">{checkList("reviewRules", [{ name: "I review every question myself" }, { name: "A second reviewer must approve before status becomes Ready" }])}</Group>
        <Dropdown label="Reviewer" value={settings.reviewer} options={["DR.A.Menon ( Course Lead )", "Assessment Creator", "Instructor", "Admin"]} onChange={v => patch({ reviewer: v })}/>
        <Group label="Record Keeping">{checkList("recordRules", [{ name: "Keep the source, settings and prompt with each question" }, { name: "Log this run in Generation history" }])}</Group>
      </div>;
    }
  };

  return <main className="superAdminPage institutionAdminPage aiAppShell"><div className="dashboardLayout aiWorkspace"><Sidebar /><section className="mainContent aiMainContent"><div className="aiHeaderSlot"><Header /></div><div className="institutionScrollArea aiScrollArea"><div className="pageContent institutionPageContent aiPageContent">
    <div className="aiTop"><div className="aiTopLeft"><nav className="aiBreadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><Asset icon={ICON.breadcrumb}/><Link href="/assessments/create/content">Create Assessment</Link><Asset icon={ICON.breadcrumb}/><strong>Generate With AI</strong></nav><div className="aiIntro"><h2>Generate Questions With AI — {typeLabel(creatorType)}</h2><p>Configure question generation settings for this assessment.</p></div></div><div className="aiIdentity"><Asset icon={ICON.ai} size={36}/><div><h1>Generate With AI</h1><p>Create Questions Faster</p></div></div></div>
    <section className="aiPanel" aria-label="AI generation settings"><div className="aiWarning" role="note"><span className="aiWarningCircle"><Asset icon={ICON.alert} size={19}/></span><p>AI-Generated Questions Are Drafts. Review For Accuracy And Duplicates Before Publishing.</p></div>
      {isAiCreator && legacySettings && <div className="aiWarning aiLegacySettings" role="note" style={{display:"flex",flexWrap:"wrap"}}><p>Older generator settings were shared across AI assessments. Check that they belong to this assessment before restoring them. Uploaded files must be selected again.</p><button type="button" className="aiAction" onClick={restoreLegacySettings}>Restore earlier settings</button></div>}
      <div className="aiAccordionList">{SECTIONS.map((item, index) => { const open = expanded.includes(item.id); return <section key={item.id} className={`aiAccordion ${open ? "open" : ""}`}><h2><button className="aiAccordionToggle" type="button" aria-expanded={open} aria-controls={`ai-section-${item.id}`} id={`ai-label-${item.id}`} onClick={() => toggleSection(item.id)}><span className="aiAccordionNumber">{index + 1}</span><span className="aiAccordionText"><strong>{item.title}</strong><small>{item.subtitle}</small></span><Asset icon={ICON.down} size={28} className="aiAccordionArrow"/></button></h2>{open && <div className="aiAccordionContent" id={`ai-section-${item.id}`} role="region" aria-labelledby={`ai-label-${item.id}`}>{content(item.id)}</div>}</section>; })}</div>
      {message && <p className={`aiMessage ${isError ? "error" : ""}`} role={isError ? "alert" : "status"}>{message}</p>}
      <div className="aiActions"><button type="button" className="aiAction" onClick={() => router.push("/assessments/create/content")}>Cancel</button><button type="button" className="aiAction" onClick={save}>Save</button><button type="button" className="aiAction aiGenerate" onClick={generate}>Generate Questions</button></div>
    </section>
  </div></div></section></div></main>;
}
