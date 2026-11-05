"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./truefalse.css";
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={`tfqcIcon ${className}`} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />;
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
  return <div className="tfqcRichEditorRoot">
    <div className="tfqcRichToolbar tfqcOptionToolbar" role="toolbar" aria-label={`${placeholder} formatting`}>
      {button("undo.svg", "Undo", () => command("undo"))}
      {button("redo.svg", "Redo", () => command("redo"))}
      <div className="tfqcRichMenuRoot"><button type="button" className="tfqcToolbarSelect tfqcToolbarFont" aria-expanded={menu === "font"} onMouseDown={e => { e.preventDefault(); remember(); }} onClick={e => openFormatMenu("font", e.currentTarget)}>{font}<Icon name="arrow-down-01.svg" size={15}/></button>
        </div>
      <div className="tfqcRichMenuRoot"><button type="button" className="tfqcToolbarSelect tfqcToolbarSize" aria-expanded={menu === "size"} onMouseDown={e => { e.preventDefault(); remember(); }} onClick={e => openFormatMenu("size", e.currentTarget)}>{size}<Icon name="arrow-down-01.svg" size={15}/></button>
        </div>
      {button("bold.svg", "Bold", () => command("bold"))}
      {button("italic.svg", "Italic", () => command("italic"))}
      {button("underline.svg", "Underline", () => command("underline"))}
      {button("text-centerline-center-top.svg", "Bulleted list", () => command("insertUnorderedList"))}
      {button("image.svg", "Insert image", () => { setFileKind("image"); if (fileInput.current) { fileInput.current.accept="image/*"; fileInput.current.value=""; fileInput.current.click(); } })}
      {button("attachment.svg", "Attach file", () => { setFileKind("attachment"); if (fileInput.current) { fileInput.current.accept=""; fileInput.current.value=""; fileInput.current.click(); } })}
    </div>
    {menu && typeof document !== "undefined" && createPortal(
      <div ref={floatingMenu} className={`tfqcFloatingFormatMenu ${menu === "symbols" ? "tfqcFloatingSymbols" : ""}`}
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
      className="tfqcRichEditable" onInput={notify} onBeforeInput={e => { const input = e.nativeEvent as InputEvent; if (input.data && allowedText(input.data) !== input.data) e.preventDefault(); }} onKeyUp={remember} onMouseUp={remember} onFocus={remember} onPaste={e => { e.preventDefault(); const text=allowedText(e.clipboardData.getData("text/plain")); if (text) document.execCommand("insertText", false, text); notify(); }}/>
    <small className="assessmentEditorCounter" aria-live="polite">{value.length}/250</small>
  </div>;
}
type Question = {
  type: string; typeSelected?: boolean; text: string; options: string[];
  correct: number; blankCorrect?: number[]; points: string; difficulty: string;
  category: string; bloom: string; mandatory: boolean;
};
// One correct answer per question, including an additional option if the creator added one.
const trueFalseAnswer = (q: Question) =>
  Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length
    ? q.correct
    : (Number.isInteger(q.blankCorrect?.[0]) && (q.blankCorrect?.[0] ?? -1) >= 0 && (q.blankCorrect?.[0] ?? -1) < q.options.length
      ? q.blankCorrect![0]
      : -1);
const trueFalseErrors = (q: Question): string[] => {
  const errors: string[] = [];
  if (q.type !== "True / False") errors.push("Select True / False as the question type.");
  if (!q.text.trim()) errors.push("Write your True / False question.");
  if (q.text.length > 250) errors.push("Question text must be 250 characters or fewer.");
  if (q.options.length < 2 || q.options[0]?.trim().toLowerCase() !== "true" || q.options[1]?.trim().toLowerCase() !== "false")
    errors.push("The first two answer options must be True and False.");
  if (q.options.some(option => !option.trim())) errors.push("Enter text for every added answer option.");
  if (q.options.some(option => option.length > 250)) errors.push("Each answer option must be 250 characters or fewer.");
  const normalizedOptions = q.options.map(option => option.trim().toLowerCase()).filter(Boolean);
  if (new Set(normalizedOptions).size !== normalizedOptions.length) errors.push("Answer options must be different.");
  if (trueFalseAnswer(q) < 0) errors.push("Select the correct answer option.");
  if (!q.points.trim() || !Number.isFinite(Number(q.points)) || Number(q.points) <= 0)
    errors.push("Points must be greater than zero.");
  if (!q.difficulty) errors.push("Select a difficulty level.");
  if (!q.category) errors.push("Select a category.");
  if (!q.bloom) errors.push("Select a Bloom’s Taxonomy level.");
  return errors;
};
const isTrueFalseComplete = (q: Question) => trueFalseErrors(q).length === 0;
const newQuestion = (): Question => ({ type: "True / False", typeSelected: true, text: "", options: ["True", "False"], correct: -1, blankCorrect: [-1], points: "1", difficulty: "", category: "", bloom: "", mandatory: true });
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
  return <div className="tfqcSelectRoot tfqcTypeRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <button type="button" className="tfqcSelectTrigger" aria-label="Question Type" disabled aria-expanded={open} aria-controls="tfqcQuestionTypeList" onClick={() => setOpen(previous => !previous)}>
      <span>{label || "Select Question Type"}</span><Icon name="arrow-down-01.svg" size={20} className={open ? "tfqcRotated" : ""}/>
    </button>
    {open && <div id="tfqcQuestionTypeList" className="tfqcTypeDropdown">
      <label className="tfqcTypeSearch"><Icon name="search-02.svg" size={20}/><input autoFocus type="search" placeholder="Search assessment types..." value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="tfqcTypeGroups">{ASSESSMENT_TYPE_GROUPS.map(group => {
        const filtered = group.items.filter(item => item.toLowerCase().includes(normalized));
        if (normalized && !filtered.length && !group.heading.toLowerCase().includes(normalized)) return null;
        const isExpanded = normalized ? true : expanded.includes(group.heading);
        const items = normalized && !filtered.length ? group.items : filtered;
        return <section className="tfqcTypeGroup" key={group.heading}>
          <button type="button" className="tfqcTypeHeading" aria-expanded={isExpanded} onClick={() => setExpanded(previous => previous.includes(group.heading) ? previous.filter(name => name !== group.heading) : [...previous, group.heading])}>
            <span>{group.heading}</span><Icon name="arrow-down-01.svg" size={20} className={isExpanded ? "tfqcRotated" : ""}/>
          </button>
          {isExpanded && <div className="tfqcTypeOptions">{items.map(item => <button type="button" key={item} className="tfqcTypeOption" role="radio" aria-checked={label === item} onClick={() => { onChange(item === "Multiple Choice Question (MCQ)" ? "MCQ" : item); setOpen(false); setSearch(""); }}>
            <span className={`tfqcOptionRadio ${label === item ? "tfqcOptionSelected" : ""}`} aria-hidden="true"/><span>{item}</span>
          </button>)}</div>}
        </section>;
      })}</div>
      {normalized && !ASSESSMENT_TYPE_GROUPS.some(group => group.heading.toLowerCase().includes(normalized) || group.items.some(item => item.toLowerCase().includes(normalized))) && <p className="tfqcTypeEmpty">No assessment types found.</p>}
    </div>}
  </div>;
}
function NeumoSelect({ value, options, onChange, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div className="tfqcSelectRoot" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}><button type="button" className="tfqcSelectTrigger" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value || placeholder || "Select"}</span><Icon name="arrow-down-01.svg" size={20} /></button>{open && <div className="tfqcSelectList" role="radiogroup">{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} className="tfqcSelectItem" onClick={() => { onChange(option); setOpen(false); }}><span className={`tfqcOptionRadio ${value === option ? "tfqcOptionSelected" : ""}`} /><span>{option}</span></button>)}</div>}</div>;
}
function PreviewStatus({ correct, size = 20 }: { correct: boolean; size?: number }) {
  return <span className={`tfqcPreviewStatusIcon ${correct ? "is-correct" : "is-wrong"}`} aria-hidden="true" />;
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
  const [learnerAnswers,setLearnerAnswers] = useState<Record<number,number>>({});
  const [notice,setNotice] = useState("");
  const valid = questions.map((q,index)=>({q,index})).filter(({q}) => q.text.trim());
  const filtered = valid.filter(({q})=>filter === "All Questions" || (filter === "Complete" ? isTrueFalseComplete(q) : !isTrueFalseComplete(q)));
  const current = filtered[openQuestion] || filtered[0];
  const readyAll = questions.length >= mcqValues.questionCount && questions.slice(0, mcqValues.questionCount).every(isTrueFalseComplete);
  const toggle = (key:"answers"|"learning"|"settings") => setSections(old=>({...old,[key]:!old[key]}));
  const detail = (qi:number,oi:number) => details[`${qi}-${oi}`] || { feedback:"", explanation:"", hint:"", showHint:false, allowHint:false };
  const continuePreview = () => {
    if (!readyAll) { setNotice("Complete all configured True / False questions before continuing."); return; }
    onContinue();
  };
  return <div className="tfqcPreview">
    <nav className="tfqcPreviewCrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><Link href="/assessments/create">Create Assessment</Link><Icon name="arrowrightdouble.svg" size={18}/><button type="button" onClick={onBack}>Create Questions</button><Icon name="arrowrightdouble.svg" size={18}/><strong>Preview Questions</strong></nav>
    <div className="tfqcPreviewCard"><header><h2>Preview Questions</h2><p>Review Your Questions Before Saving.</p></header>
      <div className="tfqcPreviewControls"><div className="tfqcPreviewTotals"><div><strong>{valid.length}</strong><span>Questions</span></div><div><strong>{valid.reduce((total,{q})=>total+(Number(q.points)||0),0)}</strong><span>Marks</span></div><div className="tfqcPreviewReady"><span className="tfqcPreviewReadyCheck" aria-hidden="true" /><span><strong>{readyAll ? "Ready" : "In Progress"}</strong><small>{readyAll ? "All good to continue" : "Review incomplete questions"}</small></span></div></div><div className="tfqcPreviewTools"><div className="tfqcPreviewFilter"><button type="button" onClick={()=>setShowFilter(v=>!v)}>{filter}<Icon name="arrow-down-01.svg" size={16}/></button>{showFilter && <div>{["All Questions","Complete","Incomplete"].map(f=><button key={f} type="button" onClick={()=>{setFilter(f);setOpenQuestion(0);setShowFilter(false);}}>{f}</button>)}</div>}</div><button type="button" className="tfqcPreviewLearner" onClick={()=>setLearner(v=>!v)}><Icon name="blueview.svg" size={18}/>{learner?"Editor Preview":"Learner Preview"}</button></div></div>
      {current ? <article className="tfqcPreviewQuestion" key={current.index}><div className="tfqcPreviewMeta"><span>True / False: {current.q.points} Points</span><span>Status: <b className={isTrueFalseComplete(current.q)?"tfqcGreen":"tfqcOrange"}>{isTrueFalseComplete(current.q)?"Complete":"Incomplete"}</b></span><button type="button" onClick={()=>onEdit(current.index)}><Icon name="edit.svg" size={16}/> Edit</button></div>
        <div className="tfqcPreviewPanel"><h3>Question {current.index+1}</h3><p>{current.q.text||"Question has not been written yet."}</p></div>
        <div className="tfqcPreviewPanel"><button type="button" className="tfqcPreviewSectionHead" onClick={()=>toggle("answers")}>Answer Options <Icon name="arrow-down-01.svg" size={18} className={sections.answers?"tfqcRotated":""}/></button>{sections.answers && <div className="tfqcPreviewAnswers">{current.q.options.map((answer,i)=>{const correct=trueFalseAnswer(current.q)===i; const chosen=learnerAnswers[current.index]===i; return learner ? <button key={i} type="button" className={`tfqcPreviewAnswer tfqcLearnerTFAnswer ${chosen ? "is-selected" : ""}`} aria-pressed={chosen} onClick={()=>setLearnerAnswers(old=>({...old,[current.index]:i}))}><span className="tfqcAnswerLetter">{String.fromCharCode(65+i)}</span><span className="tfqcPreviewAnswerText">{answer}</span></button> : <div key={i} className={`tfqcPreviewAnswer ${correct?"correct":"incorrect"}`}><PreviewStatus correct={correct} size={20}/><span className="tfqcAnswerLetter">{String.fromCharCode(65+i)}</span><span className="tfqcPreviewAnswerText">{answer}</span><small>{correct?"Correct Answers":"Wrong Answers"}</small></div>;})}</div>}</div>
        {!learner && <div className="tfqcPreviewPanel"><button type="button" className="tfqcPreviewSectionHead" onClick={()=>toggle("learning")}>Feedback and Learning <Icon name="arrow-down-01.svg" size={18} className={sections.learning?"tfqcRotated":""}/></button>{sections.learning && <div className="tfqcPreviewLearning"><section><h4><PreviewStatus correct={true} size={20}/> Correct-answer Feedback</h4>{current.q.options.map((_,i)=>i).filter(i=>trueFalseAnswer(current.q)===i).map(i=><div key={i} className="tfqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={true} size={17}/>{String.fromCharCode(65+i)} — {current.q.options[i]}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>)}</section><section><h4><PreviewStatus correct={false} size={20}/> Wrong-answer Feedback</h4>{current.q.options.map((_,i)=>i).filter(i=>trueFalseAnswer(current.q)!==i).map(i=><div key={i} className="tfqcPreviewFeedbackItem"><button type="button" onClick={()=>setOpenFeedback(openFeedback===i?null:i)}><PreviewStatus correct={false} size={17}/>{String.fromCharCode(65+i)} — {current.q.options[i]}<Icon name="arrow-down-01.svg" size={16}/></button>{(openFeedback===i||openFeedback===null) && <p>{detail(current.index,i).feedback || "No feedback entered."}</p>}</div>)}</section><section><h4><Icon name="assignments.svg" size={20}/> Explanation</h4><p>{(() => {
  const correctIndex = trueFalseAnswer(current.q);
  return correctIndex >= 0 ? detail(current.index,correctIndex).explanation.trim() || "No explanation entered." : "Select the correct answer to preview its explanation.";
})()}</p></section><section><h4><Icon name="idea.svg" size={20}/> Hint</h4><p>{(() => {
  const correctIndex = trueFalseAnswer(current.q);
  return correctIndex >= 0 ? detail(current.index,correctIndex).hint.trim() || "No hint entered." : "Select the correct answer to preview its hint.";
})()}</p></section></div>}</div>}
        {!learner && <div className="tfqcPreviewPanel"><button type="button" className="tfqcPreviewSectionHead" onClick={()=>toggle("settings")}>Question Settings <Icon name="arrow-down-01.svg" size={18} className={sections.settings?"tfqcRotated":""}/></button>{sections.settings && <div className="tfqcPreviewSettings">{[["Difficulty",current.q.difficulty||"Not selected","target.svg"],["Bloom’s Taxonomy",current.q.bloom||"Not selected","brain.svg"],["Category",current.q.category||"Not selected","folder.svg"],["Tags",tags.join(", ")||"No tags","tag.svg"],["Mandatory",current.q.mandatory?"YES":"NO","circle-check.svg"]].map(([label,value,icon])=><div key={label}><span>{label}</span><strong><Icon name={icon} size={18}/>{value}</strong></div>)}</div>}</div>}
        {filtered.length > 1 && <nav className="tfqcTrueFalsePreviewPaging" aria-label="Preview question navigation"><button type="button" disabled={openQuestion === 0} onClick={()=>{setOpenQuestion(i=>Math.max(0,i-1));setOpenFeedback(null);}}>Previous Question</button><span>Question {filtered.findIndex(q=>q.index===current.index)+1} of {filtered.length}</span><button type="button" disabled={openQuestion >= filtered.length-1} onClick={()=>{setOpenQuestion(i=>Math.min(filtered.length-1,i+1));setOpenFeedback(null);}}>Next Question</button></nav>}
        <div className="tfqcPreviewBottom"><button type="button" onClick={onBack}>Back to Question</button>{saving && <span className="tfqcSaveSuccessToast" role="status">Successfully saved</span>}</div></article> : <div className="tfqcPreviewEmpty"><p>No questions to preview.</p><button type="button" onClick={onBack}>Back to Question</button></div>}
      {notice && <p className="tfqcBuilderNotice tfqcValidationError" role="alert">{notice}</p>}
    </div>
  </div>;
}
function QuestionBuilder({ questions, setQuestions, onExit, mcqValues, duration, passingScore }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onExit: () => void; mcqValues: MCQDetailsValues; duration:string; passingScore:string }) {
  const router = useRouter();
  const [active, setActive] = useState(0);

  const [showValidation, setShowValidation] = useState(false);
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);
  const saveAndContinue = () => {
    if (isSaving) return;
    setShowValidation(true);
    const firstInvalid = questions.slice(0, mcqValues.questionCount).findIndex(q => !isTrueFalseComplete(q));
    if (questions.length < mcqValues.questionCount || firstInvalid >= 0) {
      const index = firstInvalid >= 0 ? firstInvalid : questions.length;
      setActive(Math.min(index, mcqValues.questionCount - 1));
      
      const problem = questions[index] ? trueFalseErrors(questions[index])[0] : "Add the remaining configured questions.";
      setNotice(`Question ${index + 1}: ${problem}`);
      setSaveSuccess(false);
      return;
    }
    try {
      assessmentStorage.setItem("trueFalseContentDraft", JSON.stringify({ questions, optionDetails, tags, richHtml, savedAt: new Date().toISOString() }));
      setNotice("");
      setSaveSuccess(true);
      setIsSaving(true);
      saveTimer.current = window.setTimeout(() => { setSaveSuccess(false); setIsSaving(false); router.push("/assessments/create/evaluation"); }, 3000);
    } catch {
      setIsSaving(false);
      setSaveSuccess(false);
      setNotice("Could not save the True / False questions. Please try again.");
    }
  };
  const [previewing, setPreviewing] = useState(false);
  const item = questions[active] || newQuestion();
  const update = (patch: Partial<Question>) => setQuestions(old => old.map((q, index) => index === active ? { ...q, ...patch } : q));
  const complete = isTrueFalseComplete;
  const partial = (q: Question) => !!q.text.trim() || trueFalseAnswer(q) >= 0 || !!q.category || !!q.bloom;
  const addQuestion = () => {  if (active >= mcqValues.questionCount - 1 && questions.length >= mcqValues.questionCount) { setNotice(`Only ${mcqValues.questionCount} questions are configured.`); setAddOpen(false); setBottomAddOpen(false); return; } setActive(n => Math.min(n + 1, mcqValues.questionCount - 1)); setExpandedOptions([]); setAddOpen(false); setNotice(""); };
  const chooseAdd = (option: string) => { setAddOpen(false); setBottomAddOpen(false); if (option === "Create Manually") addQuestion(); else router.push("/assessments/create/ai?type=true-false"); };
  const setOption = (index: number, value: string) => {
    update({ options: item.options.map((old, i) => i === index ? value : old) });
  };
  const addOption = () => {
    if (item.options.length >= 10) {
      setNotice("You can add up to 10 answer options to a question.");
      return;
    }
    const newIndex = item.options.length;
    update({ options: [...item.options, ""] });
    setExpandedOptions([newIndex]); // Open only the new option, never either existing option.
    setExpandedDetail(null);
    setNotice("");
  };
  const setCorrectForBlank = (optionIndex: number) => {
    // Exclusive selection: only one option can be marked correct.
    const next = trueFalseAnswer(item) === optionIndex ? -1 : optionIndex;
    update({ correct: next, blankCorrect: [next] });
    setNotice("");
  };
  const currentDone = questions.filter(complete).length;
  const optionKey = (index: number) => `${active}-${index}`;
  const getDetail = (index: number) => optionDetails[optionKey(index)] || { feedback: "", explanation: "", hint: "", showHint: false, allowHint: false };
  const setDetail = (index: number, patch: Partial<{ feedback: string; explanation: string; hint: string; showHint: boolean; allowHint: boolean }>) => setOptionDetails(old => ({...old, [optionKey(index)]: {...(old[optionKey(index)] || {feedback:"",explanation:"",hint:"",showHint:false,allowHint:false}),...patch}}));
  const [richHtml, setRichHtml] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(assessmentStorage.getItem("trueFalseContentDraft") || "{}");
      if (Number.isInteger(saved.active)) setActive(Math.max(0, Math.min(questions.length - 1, saved.active)));
      if (saved.richHtml && typeof saved.richHtml === "object") setRichHtml(saved.richHtml);
      if (saved.optionDetails && typeof saved.optionDetails === "object") setOptionDetails(saved.optionDetails);
      if (Array.isArray(saved.tags)) setTags(saved.tags.filter((tag: unknown): tag is string => typeof tag === "string"));
    } catch { /* Existing unsaved editor content stays available. */ }
    setDraftReady(true);
  }, []);
  useEffect(() => { if (!draftReady) return; try { assessmentStorage.setItem("trueFalseContentDraft", JSON.stringify({questions,optionDetails,tags,richHtml,active})); } catch { setNotice("Could not save this draft in your browser."); } }, [draftReady,questions,optionDetails,tags,richHtml,active]);
  const richEditor = (fieldId: string, value: string, onChange: (next: string) => void, placeholder: string) =>
    <MCQRichEditor key={fieldId} editorId={fieldId} value={value} html={richHtml[fieldId]}
      onChange={onChange} onHtmlChange={(html) => setRichHtml(previous => ({ ...previous, [fieldId]: html }))}
      placeholder={placeholder} onError={setNotice} />;
  const detailEditor = (index: number, field: "feedback" | "explanation" | "hint") => {
    const id = `tfqc-${field}-${active}-${index}`;
    return <div className="tfqcOptionEditor">{richEditor(id, getDetail(index)[field], text => setDetail(index, { [field]: text }), `Write ${field} here...`)}</div>;
  };
  if (previewing) return <QuestionsPreview questions={questions} details={optionDetails} tags={tags} mcqValues={mcqValues} saving={isSaving} onBack={()=>setPreviewing(false)} onContinue={saveAndContinue} onEdit={(index)=>{setActive(index);setPreviewing(false);setExpandedOptions([0]);}}/>;
  return <div className="tfqcBuilder">
    <div className="tfqcBuilderTop"><nav className="tfqcBuilderCrumb" aria-label="Question breadcrumb"><Link href="/assessments">Assessment</Link><Icon name="arrowrightdouble.svg" /><button type="button" onClick={onExit}>Create Assessment</button><Icon name="arrowrightdouble.svg" /><strong>Create Questions</strong></nav><div className="tfqcBuilderWelcome"><Icon name="ai-sparkles.svg" size={30} /><div><h2>Let's Get Started! Antony?</h2><p>Let's Build A Great Question.</p></div></div></div>
    <div className={`tfqcBuilderGrid ${active === 0 && !questions.slice(1).some(q=>q.text.trim()) ? "tfqcFirstQuestion" : ""}`}><section className="tfqcBuilderMain">
      <div className="tfqcQuestionsHeading"><div><h2>Question {active + 1} of {mcqValues.questionCount}</h2><p>{mcqValues.questionCount} Questions | {mcqValues.totalMarks} Marks</p></div><div className="tfqcAddMenu"><button type="button" className="tfqcTopAdd" onClick={() => setAddOpen(v => !v)} aria-expanded={addOpen}><Icon name="plus.svg" size={20} />Add</button>{addOpen && <div className="tfqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`tfqcOptionRadio ${index === 0 ? "tfqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div></div>
      <div className={`tfqcNumberNavigation ${mcqValues.questionCount <= 7 ? "tfqcFewQuestions" : "tfqcManyQuestions"}`}><button type="button" className="tfqcRoundNav" aria-label="Previous question" disabled={active === 0} onClick={() => setActive(n => Math.max(0,n-1))}><Icon name="arrowleft.svg" size={20}/></button><div className="tfqcNumberScroller"><div ref={numberScrollRef} onScroll={syncNumberScroll} className="tfqcQuestionNumbers" aria-label="Question numbers">{Array.from({ length: mcqValues.questionCount }, (_, index) => { const q = questions[index]; const status = q && complete(q) ? "is-complete" : index === active ? "is-active" : "is-empty"; return <button type="button" key={index} className={`tfqcQuestionNumber ${status}`} aria-label={`Question ${index+1}`} aria-current={active===index?"step":undefined} onClick={() => { setActive(index);  setExpandedOptions([]); setExpandedDetail(null); }}><span className="tfqcNumberValue">{index+1}</span><span className={`tfqcNumberStatus ${status === "is-complete" ? "is-done" : "is-pending"}`} aria-hidden="true">{status === "is-complete" ? "✓" : ""}</span>{q && q.typeSelected === true && q.type && <small>{q.type === "True / False" ? "T/F" : q.type === "MCQ" ? "MCQ" : q.type.split(/\s+/).map(part => part[0] || "").join("").slice(0, 4).toUpperCase()}</small>}</button>; })}</div><div className="tfqcNumberShortTrack" aria-hidden="true"><span className="tfqcNumberShortThumb" style={{ left: `calc((100% - var(--tfqc-scroll-thumb, min(67px, 26%))) * ${numberScrollProgress})` }} /></div></div><button type="button" className="tfqcRoundNav" aria-label="Next question" disabled={active >= mcqValues.questionCount - 1} onClick={() => { if (active + 1 < mcqValues.questionCount) setActive(n=>n+1); setExpandedOptions([]); setExpandedDetail(null); }}><Icon name="arrowright.svg" size={20}/></button></div>
      <div className="tfqcQuestionProgress"><span style={{ width: `${Math.min(100,Math.max(4,currentDone / mcqValues.questionCount*100))}%` }}/></div>
      <div className="tfqcQuestionForm"><div className="tfqcBuilderField"><label>Question Type</label><QuestionTypeDropdown value={item.type} onChange={type=>update({type,typeSelected:true})}/></div>
        <div className="tfqcBuilderField tfqcWriteField"><label htmlFor="tfqcQuestionText">Write Your Question </label><div className="tfqcEditorSurface">{richEditor(`tfqc-question-${active}`, item.text, text => update({ text }), "Write your True / False question...")}</div></div>
        <div className="tfqcBuilderField"><label>Available Options</label>
          
          <div className="tfqcAnswerOptions">{item.options.map((option,index)=>{ const open=expandedOptions.includes(index); const detail=getDetail(index); const chosen=trueFalseAnswer(item)===index; return <div className="tfqcAnswerSection" key={index}>
            <button type="button" className="tfqcAnswerExpand" aria-expanded={open} onClick={()=>{setExpandedOptions(open?[]:[index]);setExpandedDetail(null);}}><span>{index === 0 ? "True" : index === 1 ? "False" : option.trim() || `Option ${String.fromCharCode(65 + index)}`}</span><Icon name="arrow-down-01.svg" size={21} className={open?"tfqcRotated":""}/></button>
            {open && <div className="tfqcAnswerContent"><div className="tfqcOptionSubLabel"><span>Text</span></div><div className="tfqcOptionEditor">{richEditor(`tfqc-opt-${active}-${index}`,option,text=>setOption(index,text),`Enter option ${String.fromCharCode(65+index)}`)}</div><label className="tfqcCorrectOption"><input type="checkbox" checked={chosen} onChange={()=>setCorrectForBlank(index)}/>Correct Answers</label>
              {(["feedback","explanation","hint"] as const).map(field=>{const sectionId=`${index}-${field}`;const sectionOpen=expandedDetail===sectionId;return <div className="tfqcOptionDetail" key={field}><button type="button" className="tfqcOptionDetailHead" aria-expanded={sectionOpen} onClick={()=>setExpandedDetail(sectionOpen?null:sectionId)}><span className="tfqcDetailHeading"><Icon name={field==="feedback"?"message-circle-more.svg":field==="explanation"?"assignments.svg":"idea.svg"} size={18}/>{field[0].toUpperCase()+field.slice(1)}</span><Icon name="arrow-down-01.svg" size={18} className={sectionOpen?"tfqcRotated":""}/></button>{sectionOpen && <div className="tfqcOptionDetailBody">{detailEditor(index,field)}{field==="hint" && <div className="tfqcHintChecks"><label><input type="checkbox" checked={detail.showHint} onChange={e=>setDetail(index,{showHint:e.target.checked})}/>Show hint before answering</label><label><input type="checkbox" checked={detail.allowHint} onChange={e=>setDetail(index,{allowHint:e.target.checked})}/>Allow learner to request hint</label></div>}</div>}</div>;})}
              
            </div>}
          </div>;})}</div><button type="button" className="tfqcAddOptions" onClick={addOption}><Icon name="plus.svg" size={20}/>Add Options</button>
          {showValidation && trueFalseErrors(item).length>0 && <div className="tfqcValidationErrors" role="alert">{trueFalseErrors(item).map(error=><p key={error}>{error}</p>)}</div>}
        </div>
      </div><div className="tfqcBuilderBottom"><div className="tfqcAddMenu tfqcBottomAddMenu"><button type="button" className="tfqcBuilderAction tfqcSubmitQuestion" onClick={() => { setBottomAddOpen(v => !v); setAddOpen(false); }} aria-expanded={bottomAddOpen} aria-haspopup="true"><Icon name="plus.svg" size={21}/>Add Questions</button>{bottomAddOpen && <div className="tfqcAddMenuList" role="radiogroup">{["Create Manually"].map((option,index) => <button type="button" key={option} role="radio" aria-checked={index === 0} onClick={() => chooseAdd(option)}><span className={`tfqcOptionRadio ${index === 0 ? "tfqcOptionSelected" : ""}`} />{option}</button>)}</div>}</div><div className="tfqcBuilderArrows"><button type="button" className="tfqcRoundNav" aria-label="Previous" onClick={() => setActive(n=>Math.max(0,n-1))}><Icon name="arrowleft.svg"/></button><button type="button" className="tfqcRoundNav" aria-label="Next" onClick={() => { if(active+1<mcqValues.questionCount)setActive(n=>n+1); }}><Icon name="arrowright.svg"/></button></div></div>
    </section><aside className="tfqcBuilderAside"><section className="tfqcAsideSection"><h3>Question Settings</h3><div className="tfqcBuilderField"><label htmlFor="tfqcPoints">Points</label><div className="tfqcPointsControl"><input id="tfqcPoints" type="number" min="0" step="1" value={item.points} onChange={e=>update({points:e.target.value})}/><div className="tfqcPointsSteppers"><button type="button" aria-label="Increase points" onClick={()=>update({points:String((Number(item.points)||0)+1)})}><Icon name="arrow-down-01.svg" size={14} className="tfqcArrowUp"/></button><button type="button" aria-label="Decrease points" onClick={()=>update({points:String(Math.max(0,(Number(item.points)||0)-1))})}><Icon name="arrow-down-01.svg" size={14}/></button></div></div></div><div className="tfqcBuilderField"><label>Difficulty</label><NeumoSelect value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>update({difficulty:v})}/></div><div className="tfqcBuilderField"><label>Category</label><NeumoSelect value={item.category} options={CATEGORIES} placeholder="Select Category" onChange={v=>update({category:v})}/></div><div className="tfqcBuilderField"><label>Bloom’s Taxonomy</label><NeumoSelect value={item.bloom} options={BLOOMS} placeholder="Select Bloom’s Level" onChange={v=>update({bloom:v})}/></div><div className="tfqcBuilderField"><label>Tag</label><div className="tfqcTagHolder"><button type="button" className="tfqcAddTag" onClick={()=>setAddingTag(v=>!v)}><Icon name="plus.svg" size={17}/>Add Tag</button>{addingTag && <input className="tfqcTagInput" aria-label="New tag" autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();setTags(old=>[...old,tagInput.trim()]);setTagInput('');setAddingTag(false);}}}/>}</div><div className="tfqcTagRow">{tags.map(tag=><button type="button" key={tag} onClick={()=>setTags(old=>old.filter(v=>v!==tag))}>{tag} <Icon name="cancel.svg" size={14}/></button>)}</div></div><div className="tfqcMandatory"><span>Mandatory</span><button type="button" className={`tfqcSwitch ${item.mandatory ? 'tfqcSwitchOn' : ''}`} role="switch" aria-label="Mandatory Question" aria-checked={item.mandatory} onClick={()=>update({mandatory:!item.mandatory})}><span className="tfqcSwitchText">{item.mandatory?'ON':'OFF'}</span><span className="tfqcSwitchKnob"/></button></div><p className="tfqcAsideHint">This Question is Mandatory</p></section><section className="tfqcAsideSection tfqcBuilderSummary"><h3>Assessment Summary</h3><div className="tfqcStatGrid"><div><strong>{currentDone}/{mcqValues.questionCount}</strong><span>Questions</span></div><div><strong>{questions.reduce((n,q)=>n+(complete(q)?Number(q.points)||0:0),0)}</strong><span>Marks</span></div><div><strong>{duration}</strong><span>Minutes</span></div></div><p>Marks per Question: {mcqValues.marksPerQuestion}</p><div className="tfqcSummaryProgress"><span style={{width:`${Math.min(100,currentDone/mcqValues.questionCount*100)}%`}}/></div><p>Target is {mcqValues.questionCount} questions · {mcqValues.totalMarks} marks. Add questions to get started.</p><div className="tfqcBuilderField"><label>Passing Score</label><div className="tfqcReadonlyValue">{passingScore}</div></div></section></aside></div>
    {notice && <p className="tfqcBuilderNotice" role="status">{notice}</p>}
    <div className="tfqcBuilderPageFooter"><button type="button" className="tfqcFooterPill" disabled={isSaving} onClick={onExit}>Back</button><button type="button" className="tfqcFooterPill" onClick={()=>{setNotice("");setPreviewing(true);}}>Preview Questions</button><div className="tfqcSaveContinueGroup">{saveSuccess && <span className="tfqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="tfqcFooterPill tfqcFooterContinue" disabled={isSaving} onClick={saveAndContinue}>Save &amp; Continue</button></div></div>
  </div>;
}
type MCQDetailsValues = { totalMarks: number; questionCount: number; marksPerQuestion: number };
const DEFAULT_MCQ_VALUES: MCQDetailsValues = { totalMarks: 1, questionCount: 1, marksPerQuestion: 1 };
const positiveInteger = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 1 ? Math.floor(number) : fallback; };
const nonnegativeNumber = (value: unknown, fallback: number) => { const number = Number(value); return value !== null && value !== undefined && value !== "" && Number.isFinite(number) && number >= 0 ? number : fallback; };
export default function TrueFalseContentPage() {
  const router = useRouter();
  const [mcqValues, setMcqValues] = useState<MCQDetailsValues>(DEFAULT_MCQ_VALUES);
  const [questions, setQuestions] = useState<Question[]>([newQuestion()]);
  const [pageReady, setPageReady] = useState(false);
  const [assessmentDuration,setAssessmentDuration]=useState("—");
  const [passingScore,setPassingScore]=useState("—");
  useEffect(() => {
    try {
      const details = assessmentStorage.getItem("trueFalseAssessmentDraft") || assessmentStorage.getItem("truefalseAssessmentDraft");
      const draft = details ? JSON.parse(details) : {};
      const questionCount = positiveInteger(draft.questionCount ?? assessmentStorage.getItem("trueFalseQuestionCount"), DEFAULT_MCQ_VALUES.questionCount);
      const totalMarks = nonnegativeNumber(draft.totalMarks, DEFAULT_MCQ_VALUES.totalMarks);
      const marksPerQuestion = nonnegativeNumber(draft.marksPerQuestion, DEFAULT_MCQ_VALUES.marksPerQuestion);
      setMcqValues({ questionCount, totalMarks, marksPerQuestion });
      setAssessmentDuration(String(draft.duration ?? draft.timeLimit ?? "—"));
      setPassingScore(String(draft.passingScore ?? draft.passingMarks ?? "—"));
      const content = assessmentStorage.getItem("trueFalseContentDraft");
      const parsed = content ? JSON.parse(content) as { questions?: Question[] } : {};
      const savedQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      setQuestions(Array.from({ length: questionCount }, (_, index) => {
        const saved = savedQuestions[index];
        return saved
          ? { ...newQuestion(), ...saved, type: "True / False", options: Array.isArray(saved.options) && saved.options.length >= 2 ? saved.options : ["True","False"], blankCorrect: [trueFalseAnswer(saved)], correct: trueFalseAnswer(saved), typeSelected: true }
          : { ...newQuestion(), points: String(marksPerQuestion) };
      }));
    } catch {
      setQuestions(Array.from({ length: DEFAULT_MCQ_VALUES.questionCount }, () => newQuestion()));
    }
    setPageReady(true);
  }, []);
  return (
    <main className="tfqcAppShell">
      <div className="tfqcLayout">
        <Sidebar />
        <section className="tfqcMainContent">
          <div className="tfqcHeader"><Header /></div>
          <div className="tfqcScrollArea">
            <div className="tfqcPageContent">
              {pageReady && <QuestionBuilder questions={questions} setQuestions={setQuestions} mcqValues={mcqValues} duration={assessmentDuration} passingScore={passingScore} onExit={() => router.push("/assessments/create/details")} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
