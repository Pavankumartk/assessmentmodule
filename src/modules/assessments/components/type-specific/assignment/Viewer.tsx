"use client";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";
import {maySubmitCurrentAttempt} from "@/modules/assessments/components/learner/learner-assessment-data";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import { getActiveAssessmentId, getAssessment, assessmentStorage, updateAssessment, viewerPath } from "@/modules/assessments/storage/assessment-storage";
import { getDemoSession, demoDashboardPath } from "@/modules/assessments/auth/demo-auth";
import ViewerSubmitConfirm from "@/modules/assessments/components/viewer/ViewerSubmitConfirm";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";
import "./viewassignment.css";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";

/* Keep the viewer icon directory used in the uploaded viewer. The editor
   keeps the assessmenticons directory used by the existing rich-text editor. */
const VIEW_ICONS = "/assets/viewericons/";
const EDITOR_ICONS = "/assets/assessmenticons/";
const SUBMISSION_KEY = "assignmentViewerSubmission";
const MAX_CHARS = 250;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TABS = ["Assignment", "Submission", "Grade Feedback", "Settings"] as const;
type Tab = typeof TABS[number];
type Dict = Record<string, unknown>;
type Resource = { id: string; name: string; kind: string; size: string; url: string };
type Attachment = { id: string; name: string; size: number; type: string; dataUrl: string };
type Draft = { id: string; title: string; description: string; openedAt: string; dueAt: string; marks: number; bloom: string; attemptsAllowed: number; resources: Resource[]; feedback: string; gradingStatus: string; comments: number; instructions: string[]; duration: string; passingScore: string; settings?: Record<string, string> };
type Submission = { assignmentId: string; text: string; html: string; files: Attachment[]; savedAt: string; submittedAt: string; attempt: number };

/* The grading criteria and descriptive bands mirror the supplied Grade Feedback reference.
   They are display-only in the learner view: students cannot change their own marks. */
const GRADE_CRITERIA = [
  { title: "Understanding of Assignment", description: "Understands the questions and instructions.", max: 10, demo: 9 },
  { title: "Content Accuracy & Relevance", description: "Gives correct and relevant answers.", max: 25, demo: 24 },
  { title: "Completeness of Submission", description: "Answers all questions and tasks.", max: 15, demo: 14 },
  { title: "Critical Thinking & Analysis", description: "Thinks logically and explains why.", max: 15, demo: 14 },
  { title: "Practical Application & Examples", description: "Uses concepts with examples or solutions.", max: 10, demo: 8 },
  { title: "Originality & Academic Integrity", description: "Works independently and credits sources.", max: 10, demo: 7 },
  { title: "Structure & Organization", description: "Organizes answers clearly.", max: 5, demo: 3 },
  { title: "References & Supporting Evidence", description: "Provides sources and proof where needed.", max: 5, demo: 3 },
  { title: "Clarity & Presentation", description: "Uses clear language and correct terms.", max: 5, demo: 2 },
] as const;
const PERFORMANCE_LEVELS = [
  ["05", "Excellent", "90–100%", "Complete, accurate, well-structured, and strongly supported work"],
  ["04", "Good", "75–89%", "Mostly correct and complete, with minor improvements required"],
  ["03", "Satisfactory", "60–74%", "Meets fundamental requirements but has some gaps"],
  ["02", "Needs Improvement", "40–59%", "Partially meets requirements with significant weaknesses"],
  ["01", "Poor", "1–39%", "Major gaps, incorrect answers, or largely incomplete work"],
  ["0", "Not Demonstrated", "0%", "No relevant evidence or response for the criterion"],
] as const;
const RESULT_BANDS = [
  ["90–100%", "Outstanding", true], ["75–89%", "Very Good", true],
  ["60–74%", "Good", true], ["50–59%", "Satisfactory", true],
  ["1–49%", "Needs Improvement", false], ["0%", "Unsatisfactory", false],
] as const;
function performanceName(percent: number) {
  return percent >= 90 ? "Excellent" : percent >= 75 ? "Good" : percent >= 60 ? "Satisfactory" : percent >= 40 ? "Needs Improvement" : percent > 0 ? "Poor" : "Not Demonstrated";
}
function gradeData(assignmentId: string): Dict {
  /* Read existing evaluation results, if connected. Never let the learner write marks. */
  const user=getDemoSession()?.userId||"learner";
  const keys = [`assignmentGradingResult.${user}`,`assignmentEvaluationResult.${user}`];
  for (const key of keys) {
    const data = readJSON(key);
    if (Object.keys(data).length && (!data.assignmentId || data.assignmentId === assignmentId)) return data;
  }
  return {};
}
function displaySetting(draft: Draft, key: string, fallback: string): string {
  return draft.settings?.[key] || fallback;
}


function obj(value: unknown): Dict { return value && typeof value === "object" && !Array.isArray(value) ? value as Dict : {}; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function choose(data: Dict, keys: string[], fallback = ""): string {
  for (const key of keys) { const value = str(data[key]); if (value) return value; }
  return fallback;
}
function validDate(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
function readJSON(key: string): Dict { return readScopedJSON(key); }
function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
function fileSize(bytes: number): string { return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`; }
function normalizeResources(raw: unknown): Resource[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).map((entry, index) => {
    const value = obj(entry);
    const name = typeof entry === "string" ? entry : choose(value, ["name", "fileName", "filename", "title"], `Resource ${index + 1}`);
    const kind = name.split(".").pop()?.toUpperCase() || "FILE";
    const uri = choose(value, ["url", "href", "dataUrl", "src", "downloadUrl"]);
    const url = uri.startsWith("/") && !uri.startsWith("//") || uri.startsWith("data:") || uri.startsWith("blob:") || /^https:\/\//.test(uri) ? uri : "";
    const rawSize = typeof value.size === "number" ? fileSize(value.size) : str(value.displaySize, str(value.size, ""));
    return { id: `r${index}`, name, kind, size: rawSize, url };
  });
}
function readScopedJSON(key:string):Dict {
  try { const raw=assessmentStorage.getItem(key); return raw?obj(JSON.parse(raw)) : {}; } catch {return {};}
}
function loadDraft(): Draft {
  const assessmentId=getActiveAssessmentId() || "";
  const assessment=getAssessment(assessmentId);
  const assignmentDetails=readScopedJSON("assignmentDetailsDraft");
  const legacyDetails=readScopedJSON("mcqAssessmentDraft");
  const fallbackDetails=legacyDetails.typeCode==="assignment" || legacyDetails.assessmentType==="Assignment" ? legacyDetails : {};
  const creatorDetails={...fallbackDetails,...assignmentDetails};
  const content=readScopedJSON("assignmentContentDraft");
  const rawFile=obj(content.questionDocument);
  const creatorTitle=choose(creatorDetails,["name","assessmentTitle","title"]);
  const dateValue=(date:string,time:string)=>date?validDate(date+(time?"T"+time:"T23:59:00")):"";
  const available=creatorDetails.availableEnabled===true?dateValue(str(creatorDetails.availableDate),str(creatorDetails.availableTime)):"";
  const deadline=creatorDetails.dueEnabled===true?dateValue(str(creatorDetails.dueDate),str(creatorDetails.dueTime)):"";
  const evaluation=readScopedJSON("assignmentEvaluationDraft");
  const documentResource=rawFile.name?normalizeResources([{name:rawFile.name,size:rawFile.size,dataUrl:rawFile.dataUrl}]):[];
  const attachments=Array.isArray(creatorDetails.files)?normalizeResources(creatorDetails.files):[];
  const savedMarks=Number(evaluation.maxGrade ?? assessment?.marks ?? 100);
  const savedAttempts=Number(creatorDetails.attempts ?? 1);
  return {
    id:assessmentId, title:creatorTitle || assessment?.title || "Assignment",
    description:choose(creatorDetails,["description","instructions","summary"], "Complete the attached assignment and submit your work."),
    openedAt:available || assessment?.createdAt || "", dueAt:deadline,
    marks:Number.isFinite(savedMarks)&&savedMarks>0?savedMarks:100, bloom:choose(creatorDetails,["bloom","taxonomy"],"Apply"),
    attemptsAllowed:Number.isInteger(savedAttempts)&&savedAttempts>0?savedAttempts:1,
    resources:[...documentResource,...attachments], feedback:"", gradingStatus:"Not graded",comments:0,
    instructions: creatorInstructionLines(assignmentDetails.instructions, assignmentDetails.instructionsHtml, fallbackDetails.instructions, fallbackDetails.instructionsHtml),
    duration: choose(creatorDetails,["duration","durationMinutes","timeLimit","timeLimitMinutes"],"Not timed"),
    passingScore: choose(creatorDetails,["passingScore","passingPercentage","passPercentage"],String(evaluation.passGrade??"Not set")),
    settings:{cutoff: str(creatorDetails.cutoffDate), gradeReminder:str(creatorDetails.gradeDate),
      submissionTypes:[content.onlineText!==false?"Online text":null,content.fileSubmissions!==false?"Files":null].filter(Boolean).join(", "),
      feedbackTypes:[content.feedbackComments!==false?"Comments":null,content.feedbackFiles!==false?"Feedback files":null].filter(Boolean).join(", "),
      attempts: String(savedAttempts),grade: String(savedMarks),gradingMethod: str(evaluation.method,"Rubric"),
      groupSubmission:content.groupSubmission===true?"Yes":"No", blindMarking:evaluation.anonymous===true?"Yes":"No"}
  };
}
function viewerSubmissionKey(){return SUBMISSION_KEY+"."+(getDemoSession()?.userId || "learner");}
function Icon({ name, size = 20, folder = VIEW_ICONS, fallback = "" }: { name: string; size?: number; folder?: string; fallback?: string }) {
  const [missing, setMissing] = useState(false);
  return missing ? <span className="vaIconFallback" aria-hidden="true">{fallback}</span> :
    <img src={`${folder}${name}`} width={size} height={size} alt="" aria-hidden="true" className="vaIcon" onError={() => setMissing(true)} />;
}
function Clock({ remaining }: { remaining: number }) {
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining / 3600000) % 24;
  const minutes = Math.floor(remaining / 60000) % 60;
  const digits = [String(days).padStart(2, "0"), String(hours).padStart(2, "0"), String(minutes).padStart(2, "0")];
  return <div className="vaClock" aria-label={`${days} days ${hours} hours ${minutes} minutes remaining`}>
    {digits.map((value, index) => <div className="vaClockBlock" key={index}>
      <div className="vaClockDigits">{value.split("").map((digit, i) => <span key={i}>{digit}</span>)}</div>
      <small>{["days", "hrs", "mins"][index]}</small>
    </div>)}
  </div>;
}
function cleanHtml(value: string): string {
  if (typeof document === "undefined") return "";
  const doc = document.createElement("div");
  doc.innerHTML = value;
  const safe = new Set(["B", "STRONG", "I", "EM", "U", "S", "P", "DIV", "BR", "UL", "OL", "LI", "SPAN", "FONT", "SUB", "SUP", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "CODE", "A", "IMG"]);
  const safeLink = (url: string) => /^(?:https:\/\/|mailto:|\/(?!\/)|#)/i.test(url);
  const safeImage = (url: string) => /^(?:data:image\/(?:png|jpeg|webp|gif);base64,|https:\/\/|\/(?!\/))/i.test(url);
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (!safe.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent || ""));
        continue;
      }
      const href = child.getAttribute("href") || "";
      const src = child.getAttribute("src") || "";
      for (const attr of Array.from(child.attributes)) {
        const allowedStyle = attr.name === "style" && attr.value.split(";").every(rule => !rule.trim() || /^(?:color|background-color|font-size|font-family|text-align|font-weight|font-style|text-decoration|margin-left|max-width|width|height)\s*:/i.test(rule.trim()) && !/url\s*\(|expression\s*\(|[<>]/i.test(rule));
        const allowedHref = child.tagName === "A" && attr.name === "href" && safeLink(href);
        const allowedSrc = child.tagName === "IMG" && attr.name === "src" && safeImage(src);
        const allowedAlt = child.tagName === "IMG" && attr.name === "alt";
        const allowedFace = child.tagName === "FONT" && attr.name === "face" && ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"].includes(attr.value);
        if (!allowedStyle && !allowedHref && !allowedSrc && !allowedAlt && !allowedFace) child.removeAttribute(attr.name);
      }
      if (child.tagName === "IMG" && !safeImage(src)) { child.remove(); continue; }
      walk(child);
    }
  };
  walk(doc);
  return doc.innerHTML;
}
function Editor({ value, html, onChange, disabled }: { value: string; html: string; onChange: (text: string, html: string) => void; disabled?: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const lastValue = useRef("");
  const lastHtml = useRef("");
  const selection = useRef<Range | null>(null);
  const [menu, setMenu] = useState<"font" | "size" | "colors" | "highlights" | "alignment" | "heading" | null>(null);
  const [menuRect, setMenuRect] = useState({ left: 0, top: 0, width: 180, maxHeight: 230 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState("Arial");
  const [size, setSize] = useState("16");

  useEffect(() => {
    const el = area.current;
    if (!el || document.activeElement === el) return;
    if (lastValue.current === value && lastHtml.current === html) return;
    el.innerHTML = html ? cleanHtml(html) : "";
    if (!html) el.textContent = value;
    lastValue.current = value;
    lastHtml.current = html;
  }, [value, html]);
  const remember = () => {
    const selected = window.getSelection();
    if (selected?.rangeCount && area.current?.contains(selected.anchorNode)) selection.current = selected.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    area.current?.focus();
    const selected = window.getSelection();
    if (selection.current) {
      try { selected?.removeAllRanges(); selected?.addRange(selection.current); }
      catch { /* Keep the last cursor position. */ }
    }
  };
  const notify = () => {
    const el = area.current;
    if (!el) return;
    const text = ((el.querySelector("p,div,li,br") ? el.innerText : el.textContent) || "").replace(/\u00a0/g, " ");
    const limited = Array.from(text).slice(0, MAX_CHARS).join("");
    if (limited !== text) {
      el.textContent = limited;
      const caret = document.createRange(); caret.selectNodeContents(el); caret.collapse(false);
      const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(caret);
    }
    const nextHtml = el.innerHTML;
    lastValue.current = limited;
    lastHtml.current = nextHtml;
    onChange(limited, nextHtml);
    remember();
  };
  const beforeInput = (event: FormEvent<HTMLDivElement>) => {
    const native = event.nativeEvent as InputEvent;
    if (!native.inputType?.startsWith("insert") || !native.data) return;
    const el = area.current;
    if (!el) return;
    const selected = window.getSelection();
    const selectedText = selected?.rangeCount && el.contains(selected.anchorNode) ? selected.getRangeAt(0).toString() : "";
    if (Array.from((el.textContent || "").replace(/\u00a0/g, " ")).length - Array.from(selectedText).length + Array.from(native.data).length > MAX_CHARS) event.preventDefault();
  };
  const command = (action: string, option?: string) => {
    restore();
    if (action === "fontName" && option) applyAssessmentFont(area.current, option); else document.execCommand(action, false, option);
    if (action === "fontSize" && option && area.current) {
      const fontPx: Record<string, string> = {"2":"12", "3":"14", "4":"16", "5":"18", "6":"24"};
      area.current.querySelectorAll('font[size]').forEach(node => {
        const element = node as HTMLElement;
        element.style.fontSize = `${fontPx[element.getAttribute("size") || ""] || "16"}px`;
        element.removeAttribute("size");
      });
    }
    notify();
    setMenu(null);
  };
  const showMenu = (kind: "font" | "size" | "colors" | "highlights" | "alignment" | "heading", trigger: HTMLButtonElement) => {
    remember();
    if (menu === kind) { setMenu(null); return; }
    // Position the portal immediately beside the clicked toolbar button.
    // Constrain its height to the available viewport, not a distant fixed row.
    const rect = trigger.getBoundingClientRect();
    const gutter = 8;
    const isColorPalette = kind === "colors" || kind === "highlights";
    const width = Math.min(isColorPalette ? 214 : kind === "alignment" ? 184 : 190, window.innerWidth - gutter * 2);
    const desiredHeight = isColorPalette ? 92 : kind === "font" ? 215 : 190;
    const below = Math.max(0, window.innerHeight - rect.bottom - gutter * 2);
    const above = Math.max(0, rect.top - gutter * 2);
    const openBelow = below >= Math.min(desiredHeight, 145) || below >= above;
    const maxHeight = Math.max(48, Math.min(desiredHeight, openBelow ? below : above));
    setMenuRect({
      left: Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter)),
      top: openBelow ? Math.min(rect.bottom + gutter, window.innerHeight - maxHeight - gutter)
        : Math.max(gutter, rect.top - maxHeight - gutter),
      width, maxHeight,
    });
    setMenu(kind);
  };
  useEffect(() => {
    if (!menu) return;
    const outside = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    const scroll = (event: Event) => { if (event.target instanceof Node && menuRef.current?.contains(event.target)) return; setMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", scroll);
    };
  }, [menu]);
  const action = (title: string, symbol: string, icon: string | null, fn: () => void) =>
    <button type="button" title={title} aria-label={title} disabled={disabled}
      onMouseDown={e => { e.preventDefault(); remember(); }} onClick={fn}>
      {icon ? <Icon name={icon} folder={EDITOR_ICONS} size={18} fallback={symbol}/> : <span className="vaToolGlyph">{symbol}</span>}
    </button>;
  const pick = (title: string, text: string, kind: "font" | "size" | "colors" | "highlights" | "alignment" | "heading") =>
    <button type="button" className="vaEditorSelect" title={title} aria-label={title} disabled={disabled} aria-expanded={menu === kind}
      onMouseDown={e => { e.preventDefault(); remember(); }} onClick={event => showMenu(kind, event.currentTarget)}>
      <span className="vaSelectText">{text}</span><span className="vaSelectArrow" aria-hidden="true">⌄</span>
    </button>;
  const insertLink = () => {
    const url = window.prompt("Enter link URL (https:// or mailto:)", "https://");
    if (!url) return;
    if (!/^(https:\/\/|mailto:)/i.test(url.trim())) return;
    restore();
    document.execCommand("createLink", false, url.trim());
    notify();
  };
  const addImage = (file: File) => {
    if (!/^(image\/png|image\/jpeg|image\/webp|image\/gif)$/.test(file.type) || file.size > MAX_FILE_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      restore();
      document.execCommand("insertImage", false, reader.result);
      if (area.current) {
        area.current.querySelectorAll("img").forEach(image => {
          image.style.maxWidth = "100%";
          image.style.height = "auto";
        });
      }
      notify();
    };
    reader.readAsDataURL(file);
  };
  return <div className="vaEditor">
    <div className="vaEditorToolbarShell">
      <div className="vaEditorToolbar" ref={toolbar} role="toolbar" aria-label="Submission text formatting">
        {action("Undo", "↶", "undo.svg", () => command("undo"))}
        {action("Redo", "↷", "redo.svg", () => command("redo"))}
        {pick("Font family", font, "font")}
        {pick("Font size", size, "size")}
        {action("Bold", "B", "bold.svg", () => command("bold"))}
        {action("Italic", "I", "italic.svg", () => command("italic"))}
        {action("Underline", "U", "underline.svg", () => command("underline"))}
        {pick("Highlight colour", "▨", "highlights")}
        {action("Bulleted list", "☷", "text-centerline-center-top.svg", () => command("insertUnorderedList"))}
        {action("Numbered list", "1.", null, () => command("insertOrderedList"))}
        {action("Indent", "⇥", null, () => command("indent"))}
        {action("Outdent", "⇤", null, () => command("outdent"))}
        {pick("Text alignment", "≡", "alignment")}
        {pick("Headings", "H", "heading")}
        {action("Paragraph", "¶", null, () => command("formatBlock", "p"))}
        {action("Insert link", "↗", null, insertLink)}
        {action("Insert image", "▧", "image.svg", () => fileInput.current?.click())}
        {action("Blockquote", "❝", null, () => command("formatBlock", "blockquote"))}
        {action("Code block", "</>", null, () => command("formatBlock", "pre"))}
        {action("Superscript", "x²", null, () => command("superscript"))}
        {action("Subscript", "x₂", null, () => command("subscript"))}
      </div>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
      onChange={event => { const file = event.target.files?.[0]; if (file) addImage(file); event.currentTarget.value = ""; }}/>
    {menu && typeof document !== "undefined" && createPortal(<div className={`vaEditorPopup vaAssignmentFormatMenu ${menu === "colors" || menu === "highlights" ? "vaColorGridMenu" : menu === "alignment" ? "vaAlignmentMenu" : ""}`} ref={menuRef}
      style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width, maxHeight: menuRect.maxHeight }}
      role="listbox" aria-label={`Choose ${menu}`}>
      {menu === "font" ? ["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"].map(v => <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setFont(v); command("fontName", v); }}>{v}</button>)
        : menu === "size" ? ["12", "14", "16", "18", "24"].map(v => <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setSize(v); command("fontSize", {"12":"2", "14":"3", "16":"4", "18":"5", "24":"6"}[v] || "4"); }}>{v} px</button>)
        : menu === "colors" || menu === "highlights" ? ["#374151", "#2D4CC8", "#2A7308", "#E01E5A", "#000000", "#FFED99", "#FFFFFF"].map(color => <button key={color} type="button" className="vaColorGridChoice" title={color} aria-label={`${menu === "colors" ? "Text colour" : "Highlight colour"} ${color}`} onMouseDown={e => e.preventDefault()} onClick={() => command(menu === "colors" ? "foreColor" : "hiliteColor", color)}><i style={{ background: color }}/></button>)
        : menu === "alignment" ? [{label:"Left",cmd:"justifyLeft"},{label:"Centre",cmd:"justifyCenter"},{label:"Right",cmd:"justifyRight"},{label:"Justify",cmd:"justifyFull"}].map(choice => <button key={choice.cmd} type="button" onMouseDown={e => e.preventDefault()} onClick={() => command(choice.cmd)}>{choice.label}</button>)
        : [{label:"Heading 1",tag:"h1"},{label:"Heading 2",tag:"h2"},{label:"Heading 3",tag:"h3"},{label:"Paragraph",tag:"p"}].map(choice => <button key={choice.tag} type="button" onMouseDown={e => e.preventDefault()} onClick={() => command("formatBlock", choice.tag)}>{choice.label}</button>)}
    </div>, document.body)}
    <div className="vaEditorContent" role="textbox" aria-label="Online text" aria-multiline="true" contentEditable={!disabled}
      suppressContentEditableWarning ref={area} onInput={notify} onBeforeInput={beforeInput} onKeyUp={remember} onMouseUp={remember} onFocus={remember}
      onPaste={event => { event.preventDefault(); const selectionText = window.getSelection()?.toString() || "";
        const existing = Array.from(area.current?.textContent || "").length - Array.from(selectionText).length;
        const pasted = Array.from(event.clipboardData.getData("text/plain")).slice(0, Math.max(0, MAX_CHARS - existing)).join("");
        document.execCommand("insertText", false, pasted); notify(); }}
      onDrop={event => event.preventDefault()}/>
  </div>;
}

function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({ id: `${file.name}-${file.lastModified}-${file.size}`, name: file.name, type: file.type,
      size: file.size, dataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  });
}

export default function ViewAssignmentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({id:"",title:"Assignment",description:"",openedAt:"",dueAt:"",marks:100,bloom:"Apply",attemptsAllowed:1,resources:[],feedback:"",gradingStatus:"Not graded",comments:0,instructions:[],duration:"Not timed",passingScore:"Not set"}));
  const [tab, setTab] = useState<Tab>("Assignment");
  const [submission, setSubmission] = useState<Submission>(() => ({ assignmentId: "", text: "", html: "", files: [], savedAt: "", submittedAt: "", attempt: 1 }));
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [evaluation, setEvaluation] = useState<Dict>({});
  const [gradeCriteria,setGradeCriteria]=useState<{title:string;description:string;max:number;demo:number}[]>([...GRADE_CRITERIA]);
  const [showInstructions,setShowInstructions]=useState(true);
  const [accepted,setAccepted]=useState(false);
  const [showSubmitConfirm,setShowSubmitConfirm]=useState(false);
  const [showSuccess,setShowSuccess]=useState(false);
  const [statementAccepted,setStatementAccepted]=useState(false);
  const [contentSettings,setContentSettings]=useState<Dict>({});

  useEffect(() => {
    const loaded = loadDraft();
    setEvaluation(gradeData(loaded.id)); setDraft(loaded); setNow(Date.now());
    const cfg=readScopedJSON("assignmentContentDraft");setContentSettings(cfg);
    const rubric=readScopedJSON("assignmentEvaluationDraft");
    if(Array.isArray(rubric.criteria)&&rubric.criteria.length){
      setGradeCriteria((rubric.criteria as Dict[]).map(v=>({title:str(v.title,"Criterion"),description:str(v.description),max:Number(v.marks)||0,demo:0})));
    }
    let existing = readJSON(viewerSubmissionKey());
    const freshAttempt = new URLSearchParams(window.location.search).get("instructions") === "1";
    const used = Number(getAssessment(loaded.id)?.attemptCount) || 0;
    if (freshAttempt && existing.assignmentId === loaded.id && existing.submittedAt && used < loaded.attemptsAllowed) {
      try {
        const historyKey = `${viewerSubmissionKey()}.history`;
        const rawHistory = JSON.parse(assessmentStorage.getItem(historyKey) || "[]");
        const history = Array.isArray(rawHistory) ? rawHistory : [];
        const blank = {assignmentId:loaded.id,text:"",html:"",files:[],savedAt:"",submittedAt:"",attempt:Math.max(used, Number(existing.attempt) || 1) + 1};
        assessmentStorage.setItem(historyKey, JSON.stringify([...history, existing]));
        assessmentStorage.setItem(viewerSubmissionKey(), JSON.stringify(blank));
        existing = blank;
      } catch { /* Keep the previous submission if its archive could not be saved. */ }
    }
    // Same as MCQ: an unsubmitted assessment always starts with instructions.
    // Do not reuse the old learner-wide acceptance flag from another assignment.
    setAccepted(false);
    if (existing.assignmentId === loaded.id) {
      setShowInstructions(!Boolean(existing.submittedAt));
      setSubmission({ assignmentId: loaded.id, text: str(existing.text), html: str(existing.html),
        files: Array.isArray(existing.files) ? (existing.files as Attachment[]).filter(f => typeof f.dataUrl === "string") : [],
        savedAt: str(existing.savedAt), submittedAt: str(existing.submittedAt),
        attempt: Number(existing.attempt) || 1 });
    } else { setSubmission(old => ({ ...old, assignmentId: loaded.id })); setShowInstructions(true); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ready]);

  const msRemaining = draft.dueAt ? Math.max(0, new Date(draft.dueAt).getTime() - now) : 0;
  const submitted = Boolean(submission.submittedAt);
  const hasWork = Boolean(submission.text.trim() || submission.files.length);
  const progress = submitted ? 100 : 0;
  const save = useCallback((next: Submission) => {
    try {
      const value = JSON.stringify(next);
      if(new URLSearchParams(window.location.search).get("preview")!=="true") assessmentStorage.setItem(viewerSubmissionKey(), value);
      setSubmission(next); setError(""); setNotice("Submission saved."); return true;
    } catch { setError("Could not save files in browser storage. Remove a large file and try again."); return false; }
  }, []);
  const updateText = useCallback((text: string, html: string) => {
    setSubmission(old => ({ ...old, text, html })); setError(""); setNotice("");
  }, []);
  const addFiles = async (items: FileList | File[]) => {
    if (submitted) return;
    const provided = Array.from(items);
    const permitted=String(contentSettings.acceptedTypes||"PDF,DOC,DOCX,JPG,PNG,TXT").toLowerCase();
    const maxBytes=Math.max(1,Number(contentSettings.maxFileSize)||2)*1024*1024;
    const allowed=permitted.includes("images")?["png","jpg","jpeg","webp","gif"]:permitted.split(/[,;\s]+/).map(s=>s.replace(/^\./,""));
    const invalid = provided.find(f => f.size > maxBytes || !allowed.includes(f.name.split(".").pop()?.toLowerCase()||""));
    if (invalid) { setError(`${invalid.name}: choose an accepted file up to ${Number(contentSettings.maxFileSize)||2} MB.`); return; }
    if(submission.files.length+provided.length>Math.max(1,Number(contentSettings.maxFiles)||3)){setError("Maximum allowed files reached.");return;}
    try {
      const files = await Promise.all(provided.map(readFile));
      setSubmission(old => ({ ...old, files: [...old.files.filter(f => !files.some(g => g.id === f.id)), ...files] }));
      setError(""); setNotice("");
    } catch { setError("Unable to read the selected files. Please try again."); }
  };
  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files);
    event.currentTarget.value = "";
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault(); setIsDragging(false);
    if (!submitted && event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };
  const saveClick = () => save({ ...submission, savedAt: new Date().toISOString() });
  const submitClick = () => {
    if (!hasWork) { setError("Enter online text or attach at least one file before continuing."); return; }
    if(contentSettings.requireStatement===true && !statementAccepted){setError("Please accept the submission statement.");return;}
    if (draft.dueAt && msRemaining <= 0 && !submitted) { setError("The assignment deadline has passed."); return; }
    if (submitted) { setTab("Grade Feedback"); return; }
    setShowSubmitConfirm(true);
  };
  const confirmSubmission=()=>{
    if (!maySubmitCurrentAttempt()) { router.replace("/learner"); return; }
    setShowSubmitConfirm(false);
    const time=new Date().toISOString();
    if(save({...submission,savedAt:time,submittedAt:time})){
      if(new URLSearchParams(window.location.search).get("preview")!=="true") {
        try {
          const prior=JSON.parse(assessmentStorage.getItem("viewerAttempts") || "[]");
          const attempts=Array.isArray(prior) ? prior : [];
          const count=Math.max(attempts.length, Number(getAssessment(draft.id)?.attemptCount) || 0) + 1;
          const answer=[submission.text, ...submission.files.map(file=>file.name)].filter(Boolean).join("\n");
          const result={attemptId:crypto.randomUUID(),title:draft.title,assessmentType:"assignment",questions:[{text:draft.description || draft.title,options:[],correct:-1,selected:null,questionType:"short-answer",answerText:answer,expectedAnswer:"",gradingStatus:"pending",points:draft.marks}],totalQuestions:1,correctAnswers:0,incorrectAnswers:0,unanswered:0,pendingCount:1,totalMarks:draft.marks,earnedMarks:0,scorePercent:null,submittedAt:time};
          assessmentStorage.setItem("viewerAssessmentResult", JSON.stringify(result));
          assessmentStorage.setItem("viewerAttempts", JSON.stringify([...attempts, result]));
          updateAssessment({attemptCount:count});
        } catch { setError("The submission was saved, but its attempt history could not be updated."); }
      }
      setTab("Grade Feedback");setShowSuccess(true);setNotice("Assignment submitted successfully.");
    }
  };
  const openTab = (next: Tab) => { setTab(next); setNotice(""); setError(""); };
  const downloadResource = (resource: Resource) => {
    if (!resource.url) { setNotice("This resource has no downloadable file. Please contact your institute administrator."); return; }
    const a = document.createElement("a"); a.href = resource.url; a.download = resource.name;
    a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); a.remove();
  };
  
  const savedScores = Array.isArray(evaluation.marks) ? evaluation.marks :
    Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  const scores: (number | null)[] = gradeCriteria.map((criterion, index) => {
    const item = savedScores[index];
    const value = typeof item === "object" && item !== null ?
      (item as Dict).awarded ?? (item as Dict).marks : item;
    if (value !== "" && value !== undefined && value !== null && Number.isFinite(Number(value)))
      return Math.max(0, Math.min(criterion.max, Number(value)));
    return null;
  });
  const totalPossible = gradeCriteria.reduce((sum, c) => sum + c.max, 0);
  const totalAwarded = scores.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const gradePercent = totalPossible ? Math.round(totalAwarded / totalPossible * 100) : 0;
  const passingScore = Number(readScopedJSON("assignmentEvaluationDraft").passGrade ?? evaluation.passMarks ?? 50);
  const isGraded = Boolean(evaluation.finalized || evaluation.status === "Graded" || evaluation.status === "Finalized");
  const scoreReady = scores.every(value => value !== null);
  const currentStatus = isGraded ? "Graded" : "Evaluation draft";
  const feedbackComments = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  const gradeFeedback = str(evaluation.overallFeedback, draft.feedback);
  const lookupFeedback = (index: number): string => {
    const entry = feedbackComments[index];
    return str(obj(entry).feedback, "");
  };
  return <main className="superAdminPage institutionAdminPage viewerAppShell viewAssignmentApp">
    <div className="dashboardLayout vaLayout">
      <Sidebar />
      <section className="mainContent vaMain">
        <div className="vaSharedHeader"><Header /></div>
        <div className="institutionScrollArea vaScroll">
          <div className="pageContent institutionPageContent vaContent">
            <div className="vaTop">
              <nav className="vaBreadcrumb" aria-label="Breadcrumb">
                <Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" fallback="»"/>
                <Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg" fallback="»"/>
                <strong>{draft.title}</strong>
              </nav>
              {draft.dueAt ? <Clock remaining={ready ? msRemaining : 0}/> : <span className="vaNoDeadline">No deadline set</span>}
            </div>
            <div className="vaPageHeading"><h1>{showInstructions ? draft.title : "Assessment Details (Assignment)"}</h1><p>{showInstructions ? "Assignment" : "Provide The Essential Details And Settings For Your Assessment."}</p></div>
            {showInstructions ? (
              <div className="vaMcqInstructions" aria-label="Assignment assessment instructions">
                <div className="viewerColumns vaMcqInstructionColumns">
                  <aside className="viewerSummary vaMcqInstructionSummary" aria-label="Assessment summary">
                    {([
                      ["Total Questions", "1 Assignment", "list.svg", "blue"],
                      ["Total Marks", String(draft.marks), "star-award.svg", "orange"],
                      ["Total Time", /^\d+$/.test(draft.duration) ? draft.duration + " Minutes" : draft.duration, "alarm-clock.svg", "purple"],
                      ["Passing Score", draft.passingScore === "Not set" ? "Not set" : /%/.test(draft.passingScore) ? draft.passingScore : draft.passingScore + " marks", "checkmark-circle.svg", "green"],
                      ["Negative Marking", "Not applicable", "remove-circle.svg", "red"],
                    ] as const).map(([label,value,icon,tone]) => (
                      <div className={`viewerStat viewerStat--${tone}`} key={label}>
                        <span className="viewerStatIcon"><Icon name={icon} size={24} fallback="•" /></span>
                        <div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div>
                      </div>
                    ))}
                  </aside>
                  <div className="viewerRightColumn vaMcqInstructionRight">
                    <section className="viewerInstructions" aria-labelledby="va-instructions-heading">
                      <h2 id="va-instructions-heading">Instructions</h2>
                      <ol>
                        {draft.instructions.length ? draft.instructions.map((item,i)=><li key={i}>{i+1}. {item}</li>) : <li>No activity instructions have been provided for this assignment.</li>}
                      </ol>
                    </section>
                    <section className="viewerConfirmation" aria-label="Confirm instructions">
                      <label className="viewerAgreement">
                        <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>
                        <span className="viewerCheckboxIcon" aria-hidden="true">{accepted ? "✓" : ""}</span>
                        <span>I have read and understood the instructions</span>
                      </label>
                      <button className="viewerStart" type="button" disabled={!accepted} onClick={()=>setShowInstructions(false)}>Start Assessment</button>
                    </section>
                  </div>
                </div>
              </div>
            ) : (
            <div className="vaGrid">
              <div className="vaPrimary">
                <section className="vaCard vaAssignmentCard">
                  <div className="vaAssignmentName"><h2>{draft.title}</h2><strong>{draft.marks} marks</strong></div>
                  <p className="vaDescription">{draft.description}</p>
                  <div className="vaDates"><b>Opened: {formatDate(draft.openedAt)}</b><span aria-hidden="true">|</span><b className="vaDue">Due: {draft.dueAt ? formatDate(draft.dueAt) : "No deadline"}</b></div>
                  <div className="vaProgressRow"><div className="vaProgressTrack"><div style={{ width: `${progress}%` }}/></div><strong>{progress}%</strong></div>
                  <nav className="vaTabs" aria-label="Assignment sections">{TABS.map(item =>
                    <button key={item} type="button" className={tab === item ? "is-active" : ""} aria-current={tab === item ? "step" : undefined} onClick={() => openTab(item)}>{item}</button>
                  )}</nav>
                  {tab === "Assignment" && <div className="vaTabBody">
                    <h3>Resources</h3>
                    <div className="vaResourceBox">{draft.resources.length ? draft.resources.map(resource =>
                      <div className="vaResource" key={resource.id}>
                        <span className="vaResourceName">{resource.name} <small>{resource.kind}{resource.size ? ` · ${resource.size}` : ""}</small></span>
                        <button type="button" className="vaDownload" onClick={() => downloadResource(resource)}>
                          <span className="vaMutedDownload"><Icon name="download.svg" fallback="↓" size={17}/></span> Download
                        </button>
                      </div>) : <p className="vaNoResources">No resources attached to this assignment.</p>}</div>
                    <h3 className="vaStatusTitle">Submission Status</h3>
                    <div className="vaStatusBox">
                      <div><strong>Attempt number</strong><span>Attempt {submission.attempt} ({draft.attemptsAllowed} allowed)</span></div>
                      <div><strong>Submission status</strong><span className={submitted ? "vaGreen" : "vaOrange"}>{submitted ? "Submitted" : "No submission yet"}</span></div>
                      <div><strong>Grading status</strong><span className="vaBlue">{draft.gradingStatus}</span></div>
                      <div><strong>Time remaining</strong><span>{draft.dueAt ? `${Math.floor(msRemaining / 86400000)} days ${Math.floor(msRemaining / 3600000) % 24} hours` : "No deadline"}</span></div>
                      <div><strong>Last modified</strong><span>{submission.savedAt ? formatDate(submission.savedAt) : "–"}</span></div>
                      <div><strong>File submissions</strong><span>{submission.files.length ? submission.files.map(f => f.name).join(", ") : "–"}</span></div>
                      <div><strong>Online text</strong><span>{submission.text ? `${Array.from(submission.text).length} characters` : "–"}</span></div>
                      <div><strong>Submission comments</strong><span>Comments({draft.comments})</span></div>
                    </div>
                  </div>}
                  {tab === "Submission" && <div className="vaTabBody vaSubmissionTab">
                    <h3 className="vaTabTitle">Add Submission</h3>
                    {contentSettings.onlineText!==false && <div className="vaFieldHeading"><label htmlFor="va-online-editor">Online text</label><span>{Array.from(submission.text).length}/{MAX_CHARS}</span></div>}
                    {contentSettings.onlineText!==false && <div id="va-online-editor"><Editor value={submission.text} html={submission.html} onChange={updateText} disabled={submitted}/></div>}
                    {contentSettings.fileSubmissions!==false && <label className="vaUploadHeading" htmlFor="va-upload-files">Final Submission</label>}
                    {contentSettings.fileSubmissions!==false && <div className="vaFileChooser"><button type="button" className="vaChooseFile" onClick={() => fileInput.current?.click()} disabled={submitted}>Choose Files</button>
                      <span>{submission.files.length ? `${submission.files.length} file${submission.files.length === 1 ? "" : "s"} chosen` : "No files chosen"}</span>
                    </div>}
                    <input id="va-upload-files" ref={fileInput} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip" multiple hidden onChange={onChoose} disabled={submitted||contentSettings.fileSubmissions===false}/>
                    {contentSettings.fileSubmissions!==false && <div className={`vaDropzone ${isDragging ? "is-dragging" : ""}`} role="button" tabIndex={submitted ? -1 : 0} aria-label="Upload or drag and drop assignment files"
                      onClick={() => !submitted && fileInput.current?.click()}
                      onKeyDown={e => { if (!submitted && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInput.current?.click(); } }}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                      <Icon name="upload.svg" size={28} fallback="⇧"/><span>Drag and drop files (max {Number(contentSettings.maxFileSize)||2} MB)</span>
                    </div>}
                    {submission.files.length > 0 && <div className="vaAttachedFiles">{submission.files.map(file =>
                      <div key={file.id}><span>{file.name} · {fileSize(file.size)}</span>
                        {!submitted && <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setSubmission(old => ({ ...old, files: old.files.filter(f => f.id !== file.id) }))}>×</button>}
                      </div>)}</div>}
                    {contentSettings.requireStatement===true && !submitted && <label className="vaSubmissionStatement"><input type="checkbox" checked={statementAccepted} onChange={e=>setStatementAccepted(e.target.checked)}/> I confirm this submission is my own work.</label>}
                    {error && <p className="vaError" role="alert">{error}</p>}
                    {notice && <p className="vaNotice" role="status">{notice}</p>}
                    <div className="vaSubmissionActions">
                      <button className="vaBigButton vaBack" type="button" onClick={() => openTab("Assignment")}>Back</button>
                      <div><button className="vaBigButton" type="button" disabled={submitted} onClick={saveClick}>Save</button>
                        <button className="vaBigButton vaNext" type="button" onClick={submitClick}>Next</button></div>
                    </div>
                  </div>}
                  {tab === "Grade Feedback" && <div className="vaTabBody vaGradeTab">
                    <div className="vaGradeIntro vaInsetPanel">
                      <div><h3>Assignment Evaluation</h3><p>Assessment ID: {draft.id} | Manual grading</p></div>
                      <span className="vaOutlineStatus">{currentStatus}</span>
                    </div>
                    <section className="vaGradeSection vaInsetPanel">
                      <h3>Assignment and Submissions details</h3>
                      <div className="vaDetailRows">
                        <div><strong>Question documents</strong><span className="vaGradeDocCell">{draft.resources.length ? draft.resources.map((resource) => <span className="vaGradeFile" key={resource.id}>
                          {/* Existing icon: public/assets/viewericons/file-text.svg */}
                          <Icon name="file-text.svg" fallback="▤" size={17} />
                          {resource.url ? <button type="button" onClick={() => downloadResource(resource)}>{resource.name}</button> : resource.name}
                        </span>) : "No question documents attached"}</span></div>
                        <div><strong>Student Submission</strong><span className="vaGradeDocCell">{submission.files.length ? submission.files.map((file) => <span className="vaGradeFile" key={file.id}>
                          {/* Icon path: /assets/viewericons/attachment.svg */}
                          <Icon name="attachment.svg" fallback="⌁" size={17}/>
                          <a href={file.dataUrl} download={file.name}>{file.name}</a>
                        </span>) : submission.text.trim() ? "Online text submission" : "No submission yet"}</span></div>
                        <div><strong>Submission Status</strong><span className={submitted ? "vaGreen" : "vaOrange"}>• {submitted ? "Submitted" : "Pending"}</span></div>
                      </div>
                    </section>
                    <section className="vaGradeSection vaInsetPanel">
                      <h3>Evaluation marks entry</h3>
                      <div className="vaGradeTableWrap"><table className="vaGradeTable vaMarksTable">
                        <thead><tr><th>NO.</th><th>Evaluation criterion</th><th>Max Marks</th><th>Marks Awarded</th><th>Feedback</th></tr></thead>
                        <tbody>{gradeCriteria.map((criterion, index) => <tr key={criterion.title}>
                          <td data-label="NO.">{String(index + 1).padStart(2, "0")}</td>
                          <td data-label="Evaluation criterion"><strong>{criterion.title}</strong><small>{criterion.description}</small></td>
                          <td data-label="Max Marks"><span className="vaGradeNumber">{String(criterion.max).padStart(2, "0")}</span></td>
                          <td data-label="Marks Awarded"><span className="vaGradeNumber">{scores[index] === null ? "—" : String(scores[index]).padStart(2, "0")}</span></td>
                          <td data-label="Feedback"><span className="vaFeedbackValue">{lookupFeedback(index) || "Optional"}</span></td>
                        </tr>)}</tbody>
                      </table></div>
                      <div className="vaGradeTotalRow" role="status" aria-label="Total marks awarded">
                        <strong className="vaGradeTotalLabel">Total marks awarded</strong>
                        <strong className="vaGradeTotalMax">{totalPossible}</strong>
                        <strong className="vaGradeTotalAwarded">{scoreReady ? `${totalAwarded}/${totalPossible}` : `—/${totalPossible}`}</strong>
                        <span className="vaGradeTotalStatus"><span className="vaOutlineStatus">{isGraded ? "Complete" : "Incomplete"}</span></span>
                      </div>
                      <div className="vaGradeSummary">
                        <div><label>Minimum Passing Marks</label><span className="vaGradeInsetValue">{passingScore}</span></div>
                        <div><label>Performance</label><span className="vaGradeInsetValue">{scoreReady ? performanceName(gradePercent) : "Pending"}</span></div>
                        <div><label>Result</label><span className="vaGradeInsetValue">{isGraded && scoreReady ? <span className={`vaResultPill ${totalAwarded >= passingScore ? "is-pass" : "is-fail"}`}>{totalAwarded >= passingScore ? "Pass" : "Fail"}</span> : <span className="vaOutlineStatus">Pending</span>}</span></div>
                      </div>
                      <label className="vaOverallLabel">Overall evaluator feedback</label>
                      <div className="vaOverallFeedback" aria-label="Overall evaluator feedback">{gradeFeedback || ""}</div>
                    </section>
                    <section className="vaGradeSection vaInsetPanel">
                      <h3>Performance grading levels</h3>
                      <div className="vaGradeTableWrap"><table className="vaGradeTable vaLevelsTable">
                        <thead><tr><th>Grade</th><th>Performance Level</th><th>Achievement</th><th>Evaluation Description</th></tr></thead>
                        <tbody>{PERFORMANCE_LEVELS.map((row) => <tr key={row[0]}><td data-label="Grade">{row[0]}</td><td data-label="Performance Level"><strong>{row[1]}</strong></td><td data-label="Achievement">{row[2]}</td><td data-label="Evaluation Description">{row[3]}</td></tr>)}</tbody>
                      </table></div>
                      <p className="vaGradeFootnote">Guidance only – the evaluator enters marks directly and is not restricted to fixed grade choices.</p>
                    </section>
                    <section className="vaGradeSection vaInsetPanel">
                      <h3>Final performance classification</h3>
                      <div className="vaGradeTableWrap"><table className="vaGradeTable vaResultTable">
                        <thead><tr><th>Total marks</th><th>Performance</th><th>Result</th></tr></thead>
                        <tbody>{RESULT_BANDS.map((band) => <tr key={band[0]}><td data-label="Total marks">{band[0]}</td><td data-label="Performance"><strong>{band[1]}</strong></td><td data-label="Result"><span className={`vaResultPill ${band[2] ? "is-pass" : "is-fail"}`}>{band[2] ? "Pass" : "Fail"}</span></td></tr>)}</tbody>
                      </table></div>
                      <p className="vaGradeFootnote">These result bands assume a configurable passing mark of {passingScore}/{totalPossible}.</p>
                    </section>
                    <div className="vaGradeActions"><button type="button" className="vaBigButton vaBack" onClick={() => openTab("Submission")}>Back</button><button type="button" className="vaBigButton vaNext" onClick={() => openTab("Settings")}>Next</button></div>
                  </div>}
                  {tab === "Settings" && <div className="vaTabBody vaSettingsTab">
                    <h3>Settings</h3>
                    <div className="vaSettingsRows vaInsetPanel">
                      <div><strong>Allow submissions from</strong><span>{formatDate(draft.openedAt)}</span></div>
                      <div><strong>Due date</strong><span>{formatDate(draft.dueAt)}</span></div>
                      <div><strong>Cut-off date</strong><span>{displaySetting(draft, "cutoff", "Not set")}</span></div>
                      <div><strong>Remind me to grade by</strong><span>{displaySetting(draft, "gradeReminder", "Not set")}</span></div>
                      <div><strong>Submission types</strong><span>{displaySetting(draft, "submissionTypes", "Online text (250 characters), Files (2 MB each)")}</span></div>
                      <div><strong>Feedback types</strong><span>{displaySetting(draft, "feedbackTypes", "Comments, Feedback files")}</span></div>
                      <div><strong>Attempts</strong><span>{displaySetting(draft, "attempts", `Manual reopen, max ${draft.attemptsAllowed}`)}</span></div>
                      <div><strong>Grade</strong><span>{displaySetting(draft, "grade", `Point, max ${totalPossible}, to pass ${passingScore}`)}</span></div>
                      <div><strong>Grading method</strong><span>{displaySetting(draft, "gradingMethod", "Rubric")}</span></div>
                      <div><strong>Group submission</strong><span>{displaySetting(draft, "groupSubmission", "No")}</span></div>
                      <div><strong>Blind Marking</strong><span>{displaySetting(draft, "blindMarking", "No")}</span></div>
                    </div>
                  </div>}
                  {tab !== "Submission" && notice && <p className="vaNotice" role="status">{notice}</p>}

                </section>
                {tab === "Settings" && <div className="vaSettingsBack"><button type="button" className="vaBigButton vaBack" onClick={() => openTab("Grade Feedback")}>Back</button></div>}
                {tab === "Assignment" && <div className="vaAssignmentFooter"><div><strong>Bloom’s Taxonomy</strong><span>{draft.bloom}</span></div>
                  <button className="vaBigButton vaAddSubmission" type="button" onClick={() => openTab("Submission")}>Add Submission</button>
                </div>}
              </div>
              <aside className="vaCard vaNavigator" aria-label="Assignment navigator">
                <h2>Assignment Navigator</h2>
                <div className="vaNavItems">{TABS.map((item, index) => <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => openTab(item)}>{index + 1}. {index === 2 ? "Grade and feedback" : item}</button>)}</div>
                <h2 className="vaToolsTitle">Tools</h2>
                <div className="vaTools">
                  <button type="button" onClick={() => router.push(`${viewerPath()}/scratch`)}><Icon name="sticky-note.svg" fallback="▤"/> Scratch Pad <Icon name="arrowupright.svg" fallback="↗" size={17}/></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/calculator`)}><Icon name="calculator.svg" fallback="▦"/> Calculator <Icon name="arrowup.svg" fallback="↗" size={17}/></button>
                  <button type="button" onClick={() => router.push(`${viewerPath()}/formulasheet`)}><Icon name="sigma.svg" fallback="∑"/> Formula Sheet <Icon name="arrowupg.svg" fallback="↗" size={17}/></button>
                </div>
              </aside>
            </div>
            )}
            {showSubmitConfirm && <>
              <div className="viewerAppShell" />
              <ViewerSubmitConfirm answered={hasWork ? 1 : 0} remaining={hasWork ? 0 : 1} flagged={0} onBack={()=>setShowSubmitConfirm(false)} onSubmit={confirmSubmission}/>
            </>}
            {showSuccess && <div className="vaConfirmOverlay" role="presentation"><div className="vaConfirmCard" role="dialog" aria-modal="true" aria-labelledby="va-success-title">
              <h2 id="va-success-title">Assignment Submitted Successfully</h2><p>Your submission is complete. Grade and feedback will appear when released by your evaluator.</p>
              <div><button type="button" className="vaBigButton" onClick={()=>{setShowSuccess(false);router.push(demoDashboardPath());}}>Back to Dashboard</button><button type="button" className="vaBigButton vaNext" onClick={()=>setShowSuccess(false)}>Grade Feedback</button></div>
            </div></div>}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
