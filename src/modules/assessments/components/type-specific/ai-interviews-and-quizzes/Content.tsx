"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./ai.css";
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";
const ASSETS = "/assets/assessmenticons/";
const STORAGE_KEY = "aiContentDraft";
const STEPS = ["Type", "Details", "Content", "Evaluation", "Review"] as const;
const FONT_FAMILIES = ["Arial", "Segoe UI", "Inter", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36"];
const SYMBOLS = ["©", "®", "™", "°", "±", "×", "÷", "≠", "≤", "≥", "∞", "π", "√", "∑", "α", "β", "γ", "Δ", "€", "£", "₹", "→", "←", "•", "✓", "★", "¼", "½", "¾", "§", "¶", "…", "—", "“", "”", "’"];
const SAMPLE_QUESTIONS = [
  "Tell me about yourself and why you applied for this role.",
  "Describe a project where you solved a hard problem under a tight deadline.",
  "How do you handle a disagreement with a teammate?",
  "Describe a situation where you had to learn a new skill quickly.",
  "Where do you see yourself in three years?",
];
const ROLES = ["Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Data Analyst", "Data Scientist", "UI/UX Designer", "Product Manager", "QA Engineer", "DevOps Engineer", "Business Analyst"];
type AIQuestion = { id: string; html: string };
type Draft = { assessmentType?: "ai-interview"; targetRole: string; strategy: string; difficulty: string; questionCount: number; questions: AIQuestion[]; savedAt?: string };
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const initialQuestions = (): AIQuestion[] => SAMPLE_QUESTIONS.map((question, index) => ({ id: `sample-${index + 1}`, html: question }));
const makeId = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `question-${Date.now()}-${Math.random().toString(36).slice(2)}`;
// Apply a small safe subset of rich HTML before restoring a draft or showing its text.
function safeHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "CODE", "SUP", "SUB", "A", "IMG", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH"]);
  const walker = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) { child.parentNode?.removeChild(child); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      if (!allowed.has(el.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "FORM", "VIDEO", "AUDIO", "META", "LINK"].includes(el.tagName)) el.remove();
        else { walker(el); el.replaceWith(...Array.from(el.childNodes)); }
        continue;
      }
      for (const attribute of Array.from(el.attributes)) {
        const key = attribute.name.toLowerCase();
        const value = attribute.value;
        let keep = false;
        if (key === "style") keep = /^(?:\s*(?:color|background-color|font-size|font-family|text-align|font-weight|font-style|text-decoration)\s*:[^;]+;?\s*)+$/i.test(value) && !/url\s*\(|expression\s*\(|[<>]/i.test(value);
        if (el.tagName === "A" && key === "href") keep = /^(https?:\/\/|mailto:)/i.test(value);
        if (el.tagName === "IMG" && key === "src") keep = /^(https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(value);
        if (el.tagName === "IMG" && key === "alt") keep = true;
        if (el.tagName === "FONT" && key === "face") keep = FONT_FAMILIES.includes(value);
        if (el.tagName === "FONT" && key === "color") keep = /^#[0-9a-f]{3,8}$/i.test(value) || /^(black|white|red|blue|green)$/i.test(value);
        if (["TD", "TH"].includes(el.tagName) && ["colspan", "rowspan"].includes(key)) keep = /^\d{1,2}$/.test(value);
        if (!keep) el.removeAttribute(attribute.name);
      }
      if (el.tagName === "A") { el.setAttribute("rel", "noopener noreferrer"); el.setAttribute("target", "_blank"); }
      walker(el);
    }
  };
  walker(template.content);
  return template.innerHTML;
}
function plainText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const element = document.createElement("div");
  element.innerHTML = safeHtml(html);
  return (element.textContent || "").replace(/\u00a0/g, " ").trim();
}
function Icon({ name, size = 20, fallback = "" }: { name: string; size?: number; fallback?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing && fallback.startsWith("align:")) return <span aria-hidden="true" className={`aiAlignGlyph aiAlignGlyph--${fallback.slice(6)}`}><i/><i/><i/></span>;
  if (missing) return fallback ? <span aria-hidden="true" className="aiIconFallback">{fallback}</span> : null;
  return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" className="aiIcon" onError={() => setMissing(true)} />;
}
// Neumorphic option list for the three assessment fields; other controls stay unchanged.
function NeumoDropdown({ id, value, options, onChange }: {
  id: string; value: string; options: { value: string; label: string }[]; onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  useEffect(() => {
    if (!open) return;
    const selectedItem = items.current[selectedIndex];
    selectedItem?.focus({ preventScroll: true });
    const list = root.current?.querySelector<HTMLDivElement>('.aiNeumoOptions');
    if (list && selectedItem) {
      const panelRect = list.getBoundingClientRect(), itemRect = selectedItem.getBoundingClientRect();
      if (itemRect.bottom > panelRect.bottom) list.scrollTop += itemRect.bottom - panelRect.bottom + 7;
      if (itemRect.top < panelRect.top) list.scrollTop -= panelRect.top - itemRect.top + 7;
    }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && root.current?.querySelector('.aiNeumoOptions')?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, selectedIndex]);
  const openList = () => {
    if (trigger.current) {
      const rect = trigger.current.getBoundingClientRect();
      setAbove(window.innerHeight - rect.bottom < 235 && rect.top > 235);
    }
    setOpen(true);
  };
  const choose = (next: string) => { onChange(next); setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const onListKeyDown = (event: import("react").KeyboardEvent<HTMLDivElement>) => {
    const index = items.current.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    const option = items.current[next];
    option?.focus({ preventScroll: true });
    const list = root.current?.querySelector<HTMLDivElement>('.aiNeumoOptions');
    if (option && list) {
      const panelRect = list.getBoundingClientRect(), itemRect = option.getBoundingClientRect();
      if (itemRect.bottom > panelRect.bottom) list.scrollTop += itemRect.bottom - panelRect.bottom + 7;
      if (itemRect.top < panelRect.top) list.scrollTop -= panelRect.top - itemRect.top + 7;
    }
  };
  const selected = options[selectedIndex]?.label || '';
  return <div className="aiFieldControl aiSelectControl aiNeumoSelect" ref={root}>
    <button ref={trigger} id={id} type="button" className="aiNeumoSelectTrigger"
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id + "Options"}
      onClick={() => { if (open) setOpen(false); else openList(); }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openList(); } }}>
      <span>{selected}</span><Icon name="arrow-down-01.svg" size={19} fallback="⌄" />
    </button>
    {open && <div id={id + "Options"} role="listbox" aria-label={id === 'aiStrategy' ? 'Question Strategy' : id === 'aiDifficulty' ? 'Difficulty' : 'Number of question'}
      className={`aiNeumoOptions${above ? " aiNeumoOptionsUp" : ""}`} onKeyDown={onListKeyDown}>
      {options.map((option, index) => <button key={option.value} ref={element => { items.current[index] = element; }}
        type="button" role="option" aria-selected={value === option.value} className="aiNeumoOption"
        onClick={() => choose(option.value)}>{option.label}</button>)}
    </div>}
  </div>;
}
// Keep the role field editable, but provide the same visible arrow and dropdown as the other fields.
function RoleSelector({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const close = (event: Event) => { if (event.target instanceof Node && root.current?.contains(event.target)) return; setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("scroll", close, true); document.removeEventListener("keydown", escape); };
  }, [open]);
  const options = ROLES.filter(role => role.toLowerCase().includes(roleSearch.trim().toLowerCase()));
  return <div className="aiRoleRoot" ref={root}>
    <div className="aiFieldControl aiRoleControl">
      <input ref={input} id="aiTargetRole" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="aiRoleOptions" autoComplete="off"
        value={value} placeholder="Enter or select a target role" onChange={event => { onChange(event.target.value); setRoleSearch(event.target.value); setOpen(true); }}
        onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }} />
      <button type="button" className="aiRoleArrow" aria-label="Choose target role" title="Choose target role" aria-expanded={open}
        onClick={() => { setRoleSearch(""); setOpen(previous => !previous); input.current?.focus(); }}>
        <Icon name="arrow-down-01.svg" size={19} fallback="⌄" />
      </button>
    </div>
    {open && <div id="aiRoleOptions" className="aiRoleOptions" role="listbox" aria-label="Target roles">
      {options.length ? options.map(role => <button type="button" role="option" aria-selected={value === role} key={role}
        onClick={() => { onChange(role); setRoleSearch(""); setOpen(false); input.current?.focus(); }}>{role}</button>)
        : <p className="aiRoleNoMatch">No preset role matches. You can use your custom role.</p>}
    </div>}
  </div>;
}
function AIToolbarEditor({ value, onChange, questionNumber, onError }: {
  value: string; onChange: (html: string) => void; questionNumber: number; onError: (error: string) => void;
}) {
  const editable = useRef<HTMLDivElement>(null);
  const pictureInput = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [family, setFamily] = useState("Arial");
  const [size, setSize] = useState("16");
  const [heading, setHeading] = useState("");
  const [highlightColor, setHighlightColor] = useState("#f7da36");
  const HIGHLIGHT_PALETTE = ["#FFFFFF", "#FFF59D", "#F7DA36", "#FFD54F", "#FFB74D", "#FF8A80", "#F48FB1", "#CE93D8", "#B39DDB", "#9FA8DA", "#90CAF9", "#80DEEA", "#80CBC4", "#A5D6A7", "#C5E1A5", "#E6EE9C", "#FFE082", "#FFCCBC", "#BCAAA4", "#CFD8DC", "#E0E0E0", "#B0BEC5", "#78909C", "#374151"];
  const [extraToolsOpen, setExtraToolsOpen] = useState(false);
  const extraToolsButton = useRef<HTMLButtonElement>(null);
  const extraToolsMenu = useRef<HTMLDivElement>(null);
  const [extraMenuPosition, setExtraMenuPosition] = useState({ top: 0, left: 0, width: 248 });
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"font" | "size" | "heading" | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 160 });
  const menuRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editable.current) editable.current.innerHTML = safeHtml(value);
    // Each question owns its own editor instance via key={selectedQuestion.id}.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!symbolsOpen) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setSymbolsOpen(false); };
    const close = (event: Event) => { if (event.target instanceof Node && root.current?.contains(event.target)) return; setSymbolsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSymbolsOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("scroll", close, true); document.removeEventListener("keydown", escape); };
  }, [symbolsOpen]);
  useEffect(() => {
    if (!activeMenu) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !menuRoot.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const closeOnScroll = (event: Event) => {
      if (!menuRoot.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveMenu(null); };
    const closeOnResize = () => setActiveMenu(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", closeOnScroll, true);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", closeOnScroll, true);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [activeMenu]);
  useEffect(() => {
    if (!extraToolsOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!extraToolsButton.current?.contains(target) && !extraToolsMenu.current?.contains(target)) setExtraToolsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setExtraToolsOpen(false); extraToolsButton.current?.focus({ preventScroll: true }); }
    };
    const closeOnScroll = (event: Event) => {
      if (event.target instanceof Node && extraToolsMenu.current?.contains(event.target)) return;
      setExtraToolsOpen(false);
    };
    const closeOnResize = () => setExtraToolsOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [extraToolsOpen]);

  const remember = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editable.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    editable.current?.focus();
    if (!savedRange.current) return;
    const selection = window.getSelection();
    try { selection?.removeAllRanges(); selection?.addRange(savedRange.current); }
    catch { /* Use the current caret when an old range is no longer valid. */ }
  };
  const notify = () => { if (editable.current) onChange(safeHtml(editable.current.innerHTML)); };
  const apply = (command: string, argument?: string) => {
    restore();
    document.execCommand(command, false, command === "fontSize" ? "7" : argument);
    if (command === "fontSize" && argument && editable.current) {
      editable.current.querySelectorAll('font[size="7"]').forEach(node => {
        const span = document.createElement("span");
        span.style.fontSize = `${argument}px`;
        span.innerHTML = node.innerHTML;
        node.replaceWith(span);
      });
    }
    remember();
    notify();
  };
  const insertLink = () => {
    remember();
    const url = window.prompt("Link address (https:// or mailto:)", "https://");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { onError("Please use an http, https, or mailto link."); return; }
    restore();
    if (window.getSelection()?.toString()) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    remember(); notify();
  };
  const insertTable = () => apply("insertHTML", "<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table><p><br></p>");
  const insertPicture = (file: File) => {
    if (!file.type.startsWith("image/")) { onError("Please select an image."); return; }
    if (file.size > 1024 * 1024) { onError("Images must be smaller than 1 MB to save the draft."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") apply("insertImage", reader.result); };
    reader.readAsDataURL(file);
  };
  const openSelect = (kind: "font" | "size" | "heading", button: HTMLButtonElement) => {
    remember();
    if (activeMenu === kind) { setActiveMenu(null); return; }
    const rect = button.getBoundingClientRect();
    const width = Math.min(kind === "font" ? 192 : kind === "heading" ? 160 : 90, window.innerWidth - 16);
    const height = kind === "size" ? 246 : 225;
    const top = window.innerHeight - rect.bottom >= height + 12 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    setMenuPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    setActiveMenu(kind);
  };
  const chooseMenuValue = (kind: "font" | "size" | "heading", next: string) => {
    if (kind === "font") { setFamily(next); apply("fontName", next); }
    else if (kind === "size") { setSize(next); apply("fontSize", next); }
    else { setHeading(next); apply("formatBlock", next); }
    setActiveMenu(null);
  };
  const openExtraTools = (button: HTMLButtonElement) => {
    if (extraToolsOpen) { setExtraToolsOpen(false); return; }
    const rect = button.getBoundingClientRect();
    const width = Math.min(248, window.innerWidth - 16);
    const menuHeight = 172;
    const top = window.innerHeight - rect.bottom >= menuHeight + 8
      ? rect.bottom + 8
      : Math.max(8, rect.top - menuHeight - 8);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setExtraMenuPosition({ top, left, width });
    setActiveMenu(null);
    setSymbolsOpen(false);
    setExtraToolsOpen(true);
  };
  const picker = (kind: "font" | "size" | "heading", display: string) => <button type="button"
    aria-label={kind === "font" ? "Font family" : kind === "size" ? "Font size" : "Heading style"}
    aria-haspopup="listbox" aria-expanded={activeMenu === kind}
    className={`aiToolSelectLabel${kind === "size" ? " aiToolSize" : kind === "heading" ? " aiHeadingSelect" : ""}`}
    onMouseDown={event => { event.preventDefault(); remember(); }} onClick={event => openSelect(kind, event.currentTarget)}>
      <span className="aiPickerText">{display}</span>
    </button>;
  const tool = (title: string, icon: string, fallback: string, action: () => void) =>
    <button key={title} type="button" className="aiEditorTool" title={title} aria-label={title}
      onMouseDown={event => { event.preventDefault(); remember(); }} onClick={action}>
      <Icon name={icon} size={18} fallback={fallback} />
    </button>;
  return <div className="aiEditor" ref={root}>
    {/* One horizontally scrollable toolbar, without duplicate tools or a 'More' button. */}
    <div className="aiToolbarScroll" role="toolbar" aria-label="Question formatting tools" tabIndex={0}>
      {tool("Undo", "undo.svg", "↶", () => apply("undo"))}
      {tool("Redo", "redo.svg", "↷", () => apply("redo"))}
      {picker("font", family)}
      {picker("size", size)}
      {tool("Bold", "bold.svg", "B", () => apply("bold"))}
      {tool("Italic", "italic.svg", "I", () => apply("italic"))}
      {tool("Underline", "underline.svg", "U̲", () => apply("underline"))}
      {tool("Strikethrough", "strikethrough.svg", "S̶", () => apply("strikeThrough"))}
      <button ref={extraToolsButton} type="button" className="aiColorTool aiHighlightTool" title="Highlight colour" aria-label="Choose highlight colour" aria-haspopup="dialog" aria-expanded={extraToolsOpen}
        onMouseDown={event => { event.preventDefault(); remember(); }}
        onClick={event => openExtraTools(event.currentTarget)}>
        <span className="aiHighlightSwatch" aria-hidden="true" style={{ backgroundColor: highlightColor }} />
      </button>
      {tool("Bulleted list", "text-centerline-center-top.svg", "•≡", () => apply("insertUnorderedList"))}
      {tool("Numbered list", "list-numbered.svg", "1≡", () => apply("insertOrderedList"))}
      {tool("Decrease indent", "outdent.svg", "⇤", () => apply("outdent"))}
      {tool("Increase indent", "indent.svg", "⇥", () => apply("indent"))}
      <span className="aiToolbarGroup aiAlignGroup" role="group" aria-label="Text alignment">
        {tool("Align left", "align-left.svg", "align:left", () => apply("justifyLeft"))}
        {tool("Align centre", "align-center.svg", "align:center", () => apply("justifyCenter"))}
        {tool("Align right", "align-right.svg", "align:right", () => apply("justifyRight"))}
        {tool("Justify", "align-justify.svg", "align:justify", () => apply("justifyFull"))}
      </span>
      {picker("heading", heading ? `Heading ${heading.slice(1)}` : "Headings")}
      {tool("Paragraph", "paragraph.svg", "¶", () => { setHeading(""); apply("formatBlock", "p"); })}
      {tool("Insert link", "link.svg", "🔗", insertLink)}
      {tool("Insert image", "image.svg", "▧", () => { if (pictureInput.current) { pictureInput.current.value = ""; pictureInput.current.click(); } })}
      {tool("Insert table", "table.svg", "▦", insertTable)}
      {tool("Blockquote", "quote-left.svg", "❝", () => apply("formatBlock", "blockquote"))}
      {tool("Code block", "code.svg", "</>", () => apply("formatBlock", "pre"))}
      {tool("Superscript", "superscript.svg", "x²", () => apply("superscript"))}
      {tool("Subscript", "subscript.svg", "x₂", () => apply("subscript"))}
    </div>
    {extraToolsOpen && typeof document !== "undefined" && createPortal(<div ref={extraToolsMenu} className="aiExtraToolsMenu" role="group" aria-label="Highlight colours" style={{ top: extraMenuPosition.top, left: extraMenuPosition.left, width: extraMenuPosition.width }}>
      {HIGHLIGHT_PALETTE.map(color => <button key={color} type="button" className="aiPaletteSwatch" title={color} aria-label={`Highlight with ${color}`} aria-pressed={highlightColor.toUpperCase() === color.toUpperCase()}
        style={{ backgroundColor: color }} onMouseDown={event => event.preventDefault()}
        onClick={() => { setHighlightColor(color); apply("hiliteColor", color); setExtraToolsOpen(false); }} />)}
    </div>, document.body)}

        {activeMenu && typeof document !== "undefined" && createPortal(
      <div ref={menuRoot} className="aiFloatingMenu" role="listbox"
        aria-label={activeMenu === "font" ? "Font family" : activeMenu === "size" ? "Font size" : "Heading style"}
        style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}>
        {(activeMenu === "font" ? FONT_FAMILIES.map(v => ({ value: v, label: v }))
          : activeMenu === "size" ? FONT_SIZES.map(v => ({ value: v, label: `${v}px` }))
          : [1,2,3,4].map(v => ({ value: `h${v}`, label: `Heading ${v}` })))
          .map(item => <button key={item.value} type="button" role="option"
            aria-selected={activeMenu === "font" ? item.value === family : activeMenu === "size" ? item.value === size : item.value === heading}
            onMouseDown={event => event.preventDefault()}
            onClick={() => chooseMenuValue(activeMenu, item.value)}>{item.label}</button>)}
      </div>, document.body)}
    {symbolsOpen && <div className="aiSymbolMenu" role="group" aria-label="Special characters">
      {SYMBOLS.map(symbol => <button type="button" key={symbol} title={`Insert ${symbol}`} aria-label={`Insert ${symbol}`}
        onMouseDown={event => { event.preventDefault(); remember(); }} onClick={() => { apply("insertText", symbol); setSymbolsOpen(false); }}>{symbol}</button>)}
    </div>}
    <input ref={pictureInput} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) insertPicture(file); }} />
    <div className="aiEditorInputLine"><span className="aiQuestionPrefix">Q{questionNumber}-</span>
      <div ref={editable} className="aiEditable" role="textbox" aria-label={`Question ${questionNumber} text`} aria-multiline="true"
        contentEditable suppressContentEditableWarning data-placeholder="Write your question here..." onInput={notify}
        onMouseUp={remember} onKeyUp={remember} onFocus={remember}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
            event.preventDefault(); remember(); apply("removeFormat");
          }
        }}
        onPaste={event => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); notify(); }} />
    </div>
  </div>;
}
function sampleForRole(role: string, difficulty: string, count: number): AIQuestion[] {
  const field = role.trim() || "this role";
  const hard = difficulty === "Hard";
  const bank = [
    `Tell me about yourself and why you applied for the ${field} role.`,
    `Describe a project where you solved a challenging ${field.toLowerCase()} problem under a tight deadline.`,
    `How do you handle disagreements and feedback within a team?`,
    `Walk me through the process you use to plan, execute, and review your work as a ${field}.`,
    `What interests you most about this role and where do you see yourself in three years?`,
    `Describe a time when you needed to learn a new tool or concept quickly.`,
    `How would you diagnose a recurring problem affecting your team's results?`,
    `Tell me about a decision you made with incomplete information.`,
    `What trade-offs would you consider when balancing quality, speed, and cost?`,
    `How do you measure the success of a project or feature?`,
  ];
  const advanced = [
    `Describe a complex architectural or strategic trade-off you would make as a ${field}.`,
    `How would you manage a critical failure with multiple unknown root causes?`,
    `How would you explain a technically difficult decision to nontechnical stakeholders?`,
  ];
  return Array.from({ length: count }, (_, index) => ({ id: makeId(), html: escapeHtml(hard && index % 3 === 2 ? advanced[index % advanced.length] : bank[index % bank.length]) }));
}
function nextEvaluationPath(pathname: string): string {
  if (/\/content\/?$/i.test(pathname)) return pathname.replace(/\/content\/?$/i, "/evaluation");
  if (/ai[-_]content\/?$/i.test(pathname)) return pathname.replace(/ai[-_]content\/?$/i, "ai_evaluation");
  return "/assessments/create/evaluation";
}
export default function AIContentPage() {
  const router = useRouter();
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [strategy, setStrategy] = useState("Adaptive");
  const [difficulty, setDifficulty] = useState("Adaptive");
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState<AIQuestion[]>(initialQuestions);
  const [selectedId, setSelectedId] = useState("sample-1");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedQuestion = questions.find(question => question.id === selectedId);
  const currentIndex = Math.max(0, questions.findIndex(question => question.id === selectedId));
  useEffect(() => {
    try {
      const raw = assessmentStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Draft;
        if (typeof draft.targetRole === "string") setTargetRole(draft.targetRole);
        if (typeof draft.strategy === "string") {
          const legacyStrategies: Record<string, string> = { "AI generated_adaptive": "Adaptive", "AI generated_fixed": "AI-Generated", Manual: "Predefined" };
          setStrategy(legacyStrategies[draft.strategy] || (["AI-Generated", "Adaptive", "Predefined", "Hybrid"].includes(draft.strategy) ? draft.strategy : "Adaptive"));
        }
        if (typeof draft.difficulty === "string") setDifficulty(draft.difficulty);
        if (Number.isInteger(draft.questionCount) && draft.questionCount >= 1 && draft.questionCount <= 50) setQuestionCount(draft.questionCount);
        if (Array.isArray(draft.questions)) {
          const restored = draft.questions.filter(q => q && typeof q.id === "string" && typeof q.html === "string").slice(0, 50).map(q => ({ id: q.id, html: safeHtml(q.html) }));
          setQuestions(restored);
          setSelectedId(restored[0]?.id ?? "");
        }
      }
    } catch { /* Keep screenshot defaults if a prior draft is invalid. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { assessmentStorage.setItem(STORAGE_KEY, JSON.stringify({ assessmentType: "ai-interview" as const, targetRole, strategy, difficulty, questionCount, questions } satisfies Draft)); }
    catch { /* Explicit save shows a validation / storage error when necessary. */ }
  }, [loaded, targetRole, strategy, difficulty, questionCount, questions]);
  const updateQuestion = useCallback((id: string, html: string) => setQuestions(previous => previous.map(question => question.id === id ? { ...question, html } : question)), []);
  const addQuestion = () => {
    if (questions.length >= 50) { setMessage("The maximum is 50 questions."); return; }
    const empty = questions.find(q => !plainText(q.html));
    if (empty) { setSelectedId(empty.id); setMessage("Complete the empty question before adding another one."); return; }
    const created = { id: makeId(), html: "" };
    setQuestions(previous => [...previous, created]);
    setQuestionCount(previous => Math.max(previous, questions.length + 1));
    setSelectedId(created.id);
    setMessage("New question added. Type your question in the editor above.");
  };
  const removeQuestion = (id: string) => {
    const remaining = questions.filter(question => question.id !== id);
    setQuestions(remaining);
    setQuestionCount(Math.max(1, remaining.length));
    if (id === selectedId) setSelectedId(remaining[0]?.id ?? "");
    setMessage(remaining.length ? "Question removed." : "All questions removed. Add a new question to continue.");
  };
  const generate = async () => {
    if (!targetRole.trim()) { setMessage("Please enter a target role before generating questions."); return; }
    if (questions.some(q => q.html !== "" && !SAMPLE_QUESTIONS.includes(plainText(q.html))) && !window.confirm("Generating new questions will replace your existing question list. Continue?")) return;
    setGenerating(true); setMessage("");
    try {
      // When an AI endpoint is available, accept its response; otherwise use clearly labelled sample prompts.
      const response = await fetch("/api/ai-assessment/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, questionStrategy: strategy, difficulty, numberOfQuestions: questionCount }),
      });
      if (!response.ok) throw new Error("AI endpoint not available");
      const data: unknown = await response.json();
      const entries = typeof data === "object" && data !== null && "questions" in data ? (data as { questions: unknown }).questions : data;
      if (!Array.isArray(entries)) throw new Error("Unexpected AI response");
      const result = entries.slice(0, questionCount).map((q: unknown) => {
        const text = typeof q === "string" ? q : q && typeof q === "object" && "text" in q && typeof q.text === "string" ? q.text : "";
        return { id: makeId(), html: escapeHtml(text) };
      }).filter(q => plainText(q.html));
      if (!result.length) throw new Error("AI returned no questions");
      setQuestions(result); setSelectedId(result[0].id);
      setMessage(`${result.length} questions generated. Review and edit them before continuing.`);
    } catch {
      const result = sampleForRole(targetRole, difficulty, questionCount);
      setQuestions(result); setSelectedId(result[0].id);
      setMessage("Sample questions created locally. Connect POST /api/ai-assessment/generate to enable live AI generation.");
    } finally { setGenerating(false); }
  };
  const saveContinue = () => {
    if (saving) return;
    if (!targetRole.trim()) { setMessage("Target Role is required."); return; }
    if (!questions.length) { setMessage("Add at least one question before continuing."); return; }
    const blank = questions.findIndex(question => !plainText(question.html));
    if (blank >= 0) { setSelectedId(questions[blank].id); setMessage(`Question ${blank + 1} cannot be empty. Please enter its content.`); return; }
    if (questions.length !== questionCount) { setMessage(`You selected ${questionCount} questions, but the list contains ${questions.length}. Add or generate the remaining questions, or update the number of questions.`); return; }
    try {
      assessmentStorage.setItem(STORAGE_KEY, JSON.stringify({ assessmentType: "ai-interview" as const, targetRole, strategy, difficulty, questionCount, questions, savedAt: new Date().toISOString() } satisfies Draft));
      setMessage(""); setSaving(true);
      router.push(nextEvaluationPath(window.location.pathname));
    } catch { setSaving(false); setMessage("Unable to save the assessment. Please check browser storage and try again."); }
  };
  return <main className="aiAppShell"><div className="aiLayout"><Sidebar /><section className="aiMainContent"><div className="aiHeader"><Header /></div><div className="aiScrollArea"><div className="aiPageContent">
    <nav className="aiBreadcrumb" aria-label="Breadcrumb"><Link href="/Assessment">Assessment</Link><Icon name="arrowrightdouble.svg" size={20} fallback="»" /><strong>Create Assessment</strong></nav>
    <ol className="aiWizard" aria-label="Assessment creation steps">{STEPS.map((step, index) => <li className={`aiWizardStep ${index < 2 ? "aiStepDone" : index === 2 ? "aiStepActive" : ""}`} key={step}><span className="aiStepNumber"><span>{index + 1}</span></span><span className="aiStepText">{step}</span></li>)}</ol>
    <header className="aiPageTitle"><h1>Question Content (AI Interview)</h1><p>Define What The AI Should Ask. You Can Review And Edit Every Question.</p></header>
    <section className="aiContentPanel" aria-label="AI Interview question content">
      <div className="aiFormGrid">
        <div className="aiField"><label htmlFor="aiTargetRole">Target Role</label><RoleSelector value={targetRole} onChange={setTargetRole} /></div>
        <div className="aiField"><label htmlFor="aiStrategy">Question Strategy</label><NeumoDropdown id="aiStrategy" value={strategy} onChange={setStrategy} options={["AI-Generated", "Adaptive", "Predefined", "Hybrid"].map(item => ({ value: item, label: item }))} /></div>
        <div className="aiField"><label htmlFor="aiDifficulty">Difficulty</label><NeumoDropdown id="aiDifficulty" value={difficulty} onChange={setDifficulty} options={["Adaptive", "Easy", "Medium", "Hard"].map(item => ({ value: item, label: item }))} /></div>
        <div className="aiField"><label htmlFor="aiQuestionCount">Number of question</label><NeumoDropdown id="aiQuestionCount" value={String(questionCount)} onChange={next => setQuestionCount(Number(next))} options={Array.from({ length: 50 }, (_, index) => ({ value: String(index + 1), label: String(index + 1).padStart(2, "0") }))} /></div>
      </div>
      <div className="aiQuestionsHeading"><h2>Questions</h2><button type="button" className="aiActionButton aiGenerateButton" onClick={() => void generate()} disabled={generating}>{generating ? "Generating…" : "Generate With AI"}</button></div>
      {selectedQuestion ? <AIToolbarEditor key={selectedQuestion.id} value={selectedQuestion.html} onChange={html => updateQuestion(selectedQuestion.id, html)} questionNumber={currentIndex + 1} onError={setMessage} /> : <div className="aiNoQuestions">No questions available. Use Add Question or Generate With AI.</div>}
      <div className="aiAddRow"><button type="button" className="aiActionButton aiAddButton" onClick={addQuestion}>Add Question</button></div>
      <div className="aiQuestionList" aria-label="Saved questions">{questions.map((question, index) => <div className={`aiQuestionCard ${question.id === selectedId ? "aiQuestionCardActive" : ""}`} key={question.id}><button className="aiQuestionCardText" type="button" onClick={() => { setSelectedId(question.id); setMessage(""); }} aria-label={`Edit question ${index + 1}`} aria-current={question.id === selectedId ? "true" : undefined}><span>Q{index + 1}- {plainText(question.html) || "New question — click to edit"}</span></button><button className="aiQuestionRemove" type="button" aria-label={`Remove question ${index + 1}`} title="Remove question" onClick={() => removeQuestion(question.id)}><Icon name="cancel-circel.svg" size={18} fallback="×" /></button></div>)}</div>
    </section>
    {message && <p className="aiNotice" role="status">{message}</p>}
    <footer className="aiFooter"><button type="button" className="aiFooterButton aiFooterBack" onClick={() => router.back()}>Back</button><button type="button" className="aiFooterButton aiFooterContinue" disabled={saving || generating} onClick={saveContinue}>{saving ? "Saving…" : "Save & Continue"}</button></footer>
  </div></div></section></div></main>;
}
