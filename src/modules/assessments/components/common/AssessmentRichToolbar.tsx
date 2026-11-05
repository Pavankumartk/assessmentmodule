"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./assessment-rich-toolbar.css";

type Props = {
  label: string;
  onRemember: () => void;
  onCommand: (name: string, argument?: string) => void;
  onChooseFile?: (kind: "image" | "attachment") => void;
  onError?: (message: string) => void;
  allowAttachment?: boolean;
};

const FONTS = ["Arial", "Segoe UI", "Inter", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36"];
const HIGHLIGHTS = ["#FFFFFF", "#FFF59D", "#F7DA36", "#FFD54F", "#FFB74D", "#FF8A80", "#F48FB1", "#CE93D8", "#B39DDB", "#9FA8DA", "#90CAF9", "#80DEEA", "#80CBC4", "#A5D6A7", "#C5E1A5", "#E6EE9C", "#FFE082", "#FFCCBC", "#BCAAA4", "#CFD8DC", "#E0E0E0", "#B0BEC5", "#78909C", "#374151"];

/** The AI Viva toolbar, shared by the creator's existing rich-text fields. */
export default function AssessmentRichToolbar({ label, onRemember, onCommand, onChooseFile, onError, allowAttachment = true }: Props) {
  const [family, setFamily] = useState("Arial");
  const [size, setSize] = useState("16");
  const [color, setColor] = useState("#F7DA36");
  const [fileError, setFileError] = useState("");
  const [menu, setMenu] = useState<"font" | "size" | "highlight" | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 190 });
  const toolbar = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const fallbackFile = useRef<HTMLInputElement>(null);
  const fallbackKind = useRef<"image" | "attachment">("image");

  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!toolbar.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setMenu(null);
    };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", scroll);
    };
  }, [menu]);

  const open = (kind: "font" | "size" | "highlight", element: HTMLButtonElement) => {
    if (kind === menu) { setMenu(null); return; }
    const rect = element.getBoundingClientRect();
    const width = Math.min(kind === "highlight" ? 248 : kind === "font" ? 192 : 90, window.innerWidth - 16);
    const height = Math.min(kind === "highlight" ? 180 : 225, window.innerHeight - 16);
    const top = window.innerHeight - rect.bottom >= height + 12 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    setPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    setMenu(kind);
  };
  const preserve = (event: React.MouseEvent) => { event.preventDefault(); onRemember(); };
  const tool = (title: string, icon: string, fallback: string, action: () => void) =>
    <button key={title} type="button" className="assessmentRichTool" title={title} aria-label={title} onMouseDown={preserve} onClick={action}>
      <img src={`/assets/assessmenticons/${icon}`} alt="" aria-hidden="true" onError={event => { event.currentTarget.style.display = "none"; const next = event.currentTarget.nextElementSibling as HTMLElement | null; if (next) next.style.display = "inline"; }}/><span className="assessmentRichFallback" aria-hidden="true">{fallback}</span>
    </button>;
  const select = (kind: "font" | "size", value: string) => <button type="button" className={`assessmentRichSelect ${kind === "size" ? "assessmentRichSize" : ""}`}
    aria-label={kind === "font" ? "Font family" : "Font size"} aria-haspopup="listbox" aria-expanded={menu === kind}
    onMouseDown={preserve} onClick={event => open(kind, event.currentTarget)}><span>{value}</span></button>;
  const link = () => {
    const url = window.prompt("Link address (https:// or mailto:)", "https://");
    if (url && /^(https?:\/\/|mailto:)/i.test(url)) onCommand("createLink", url);
  };
  const chooseFile = (kind: "image" | "attachment") => {
    setFileError("");
    if (onChooseFile) { onChooseFile(kind); return; }
    fallbackKind.current = kind;
    if (fallbackFile.current) {
      fallbackFile.current.accept = kind === "image" ? "image/*" : "";
      fallbackFile.current.value = "";
      fallbackFile.current.click();
    }
  };
  const insertFile = (file: File) => {
    const showError = (message: string) => { if (onError) onError(message); else setFileError(message); };
    if (file.size > 1024 * 1024) { showError("Please use a file smaller than 1 MB so it can be saved with the draft."); return; }
    if (fallbackKind.current === "image" && !file.type.startsWith("image/")) { showError("Please select an image."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      if (fallbackKind.current === "image") onCommand("insertImage", reader.result);
      else {
        const name = file.name.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
        onCommand("insertHTML", `<a href="${reader.result}" download="${name}">Attachment: ${name}</a>`);
      }
    };
    reader.readAsDataURL(file);
  };
  return <>
    <div ref={toolbar} className="assessmentRichToolbar" role="toolbar" aria-label={`${label} formatting tools`} tabIndex={0}>
      {tool("Undo", "undo.svg", "↶", () => onCommand("undo"))}
      {tool("Redo", "redo.svg", "↷", () => onCommand("redo"))}
      {select("font", family)}{select("size", size)}
      {tool("Bold", "bold.svg", "B", () => onCommand("bold"))}
      {tool("Italic", "italic.svg", "I", () => onCommand("italic"))}
      {tool("Underline", "underline.svg", "U", () => onCommand("underline"))}
      {tool("Strikethrough", "strikethrough.svg", "S", () => onCommand("strikeThrough"))}
      <button type="button" className="assessmentRichTool" title="Highlight colour" aria-label="Choose highlight colour" aria-expanded={menu === "highlight"} onMouseDown={preserve} onClick={event => open("highlight", event.currentTarget)}><span className="assessmentRichSwatch" style={{ background: color }}/></button>
      {tool("Bulleted list", "text-centerline-center-top.svg", "•≡", () => onCommand("insertUnorderedList"))}
      {tool("Numbered list", "list-numbered.svg", "1≡", () => onCommand("insertOrderedList"))}
      {tool("Decrease indent", "outdent.svg", "⇤", () => onCommand("outdent"))}
      {tool("Increase indent", "indent.svg", "⇥", () => onCommand("indent"))}
      {tool("Align left", "align-left.svg", "≡", () => onCommand("justifyLeft"))}
      {tool("Align centre", "align-center.svg", "≡", () => onCommand("justifyCenter"))}
      {tool("Align right", "align-right.svg", "≡", () => onCommand("justifyRight"))}
      {tool("Justify", "align-justify.svg", "≡", () => onCommand("justifyFull"))}
      {tool("Insert link", "link.svg", "↗", link)}
      {tool("Insert image", "image.svg", "▧", () => chooseFile("image"))}
      {allowAttachment && tool("Attach file", "attachment.svg", "⌁", () => chooseFile("attachment"))}
      {tool("Insert table", "table.svg", "▦", () => onCommand("insertHTML", "<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table><p><br></p>"))}
      {tool("Blockquote", "quote-left.svg", "❝", () => onCommand("formatBlock", "blockquote"))}
      {tool("Code block", "code.svg", "</>", () => onCommand("formatBlock", "pre"))}
      {tool("Superscript", "superscript.svg", "x²", () => onCommand("superscript"))}
      {tool("Subscript", "subscript.svg", "x₂", () => onCommand("subscript"))}
    </div>
    {!onChooseFile && <input ref={fallbackFile} type="file" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) insertFile(file); }}/>}
    {fileError && <div className="assessmentRichFileError" role="alert">{fileError}</div>}
    {menu && typeof document !== "undefined" && createPortal(<div ref={popup} className={`assessmentRichMenu ${menu === "highlight" ? "assessmentRichPalette" : ""}`} role={menu === "highlight" ? "group" : "listbox"}
      aria-label={menu === "font" ? "Font family" : menu === "size" ? "Font size" : "Highlight colours"} style={position}>
      {(menu === "highlight" ? HIGHLIGHTS : menu === "font" ? FONTS : SIZES).map(item => <button key={item} type="button"
        role={menu === "highlight" ? undefined : "option"} aria-selected={menu === "font" ? item === family : menu === "size" ? item === size : undefined}
        aria-label={menu === "highlight" ? `Highlight with ${item}` : undefined} style={menu === "highlight" ? { backgroundColor: item } : undefined}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (menu === "font") { setFamily(item); onCommand("fontName", item); } else if (menu === "size") { setSize(item); onCommand("fontSize", item); } else { setColor(item); onCommand("hiliteColor", item); } setMenu(null); }}>
        {menu === "highlight" ? null : menu === "size" ? `${item}px` : item}</button>)}
    </div>, document.body)}
  </>;
}
