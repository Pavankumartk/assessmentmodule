"use client";

import AssessmentRichToolbar from "@/modules/assessments/components/common/AssessmentRichToolbar";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import ImageBasedRichToolbar from "./ImageBasedRichToolbar";
import "./image-based-rich-toolbar.css";

const MAX_CHARACTERS = 250;
const STORAGE_KEY = "imageBasedCreatorRichFormattingV1";

type SavedFormat = { text: string; html: string };
type Props = {
  value: string;
  onChange: (next: string) => void;
  label: string;
  editorKey: string;
  rows?: number;
  placeholder?: string;
  tone?: string;
};

function plain(editor: HTMLElement): string {
  const value = (editor.innerText || "").replace(/\u00a0/g, " ").replace(/\r/g, "");
  return value === "\n" ? "" : value;
}

/** Only previously authored, harmless formatting is restored. Never inject arbitrary HTML. */
function safeMarkup(html: string): string {
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["B", "I", "U", "S", "STRONG", "EM", "SPAN", "FONT", "P", "DIV", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "A", "SUB", "SUP", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH"]);
  const disallowed = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "SVG", "MATH", "IMG", "VIDEO", "AUDIO", "LINK", "META"]);
  for (const element of Array.from(documentFragment.body.querySelectorAll("*"))) {
    if (disallowed.has(element.tagName)) { element.remove(); continue; }
    if (!allowed.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    for (const attribute of Array.from(element.attributes)) {
      const key = attribute.name.toLowerCase();
      if (key === "href" && element.tagName === "A" && /^(https?:\/\/|mailto:)/i.test(attribute.value)) continue;
      if (key === "color" && element.tagName === "FONT" && /^#[0-9a-f]{3,8}$/i.test(attribute.value)) continue;
      if (key === "face" && element.tagName === "FONT" && /^[\w\s,-]{1,64}$/.test(attribute.value)) continue;
      if (key === "style") {
        const safeProperties = new Set(["color", "background-color", "font-size", "font-family", "font-weight", "font-style", "text-decoration", "text-align"]);
        const safe = attribute.value.split(";").map(part => part.trim()).filter(Boolean).filter(part => {
          const separator = part.indexOf(":");
          if (separator < 1) return false;
          const property = part.slice(0, separator).trim().toLowerCase();
          const value = part.slice(separator + 1).trim();
          return safeProperties.has(property) && /^[#(),'".\w\s%-]{1,120}$/i.test(value) && !/(?:url|expression|import|javascript)/i.test(value);
        });
        if (safe.length) element.setAttribute("style", safe.join(";"));
        else element.removeAttribute("style");
        continue;
      }
      element.removeAttribute(attribute.name);
    }
  }
  return documentFragment.body.innerHTML;
}

function getSaved(editorKey: string): SavedFormat | undefined {
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const entry = all?.[editorKey];
    return typeof entry?.text === "string" && typeof entry?.html === "string" ? entry : undefined;
  } catch { return undefined; }
}

function saveFormat(editorKey: string, text: string, html: string): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    if (!all || typeof all !== "object" || Array.isArray(all)) return;
    all[editorKey] = { text, html: safeMarkup(html) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* Primary assessment draft still saves the plain text. */ }
}

export default function ImageBasedRichEditor({value, onChange, label, editorKey, rows=3, placeholder="", tone=""}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const assessmentImageEditorSelection = useRef<Range|null>(null);
  const rememberImageEditorSelection = () => { const selected=window.getSelection(); if(selected?.rangeCount && ref.current?.contains(selected.anchorNode)) assessmentImageEditorSelection.current=selected.getRangeAt(0).cloneRange(); };
  const runImageEditorCommand = (name:string, value?:string) => { ref.current?.focus(); const range=assessmentImageEditorSelection.current; if(range && ref.current?.contains(range.commonAncestorContainer)){ const selected=window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range); } document.execCommand(name,false,name === "fontSize" ? "7" : value); if(name === "fontSize" && value) ref.current?.querySelectorAll('font[size="7"]').forEach(node=>{node.removeAttribute("size");(node as HTMLElement).style.fontSize=value+"px";}); rememberImageEditorSelection(); notify(); };
  const displayedKey = useRef("");
  const [count, setCount] = useState(value.length);
  const [error, setError] = useState("");

  useEffect(() => {
    const editor = ref.current;
    if (!editor) return;
    if (displayedKey.current !== editorKey) {
      displayedKey.current = editorKey;
      const saved = getSaved(editorKey);
      if (saved?.text === value) {
        const markup = safeMarkup(saved.html);
        editor.innerHTML = markup;
        if (plain(editor) !== value) editor.innerText = value;
      } else editor.innerText = value;
      setCount(value.length);
    } else if (plain(editor) !== value && document.activeElement !== editor) {
      editor.innerText = value;
      setCount(value.length);
    }
  }, [editorKey, value]);

  const notify = () => {
    const editor = ref.current;
    if (!editor) return;
    let text = plain(editor);
    if (text.length > MAX_CHARACTERS) {
      // Fallback for browser editing commands that bypass beforeinput.
      text = text.slice(0, MAX_CHARACTERS);
      editor.innerText = text;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range);
    }
    setCount(text.length);
    saveFormat(editorKey, text, editor.innerHTML);
    onChange(text);
  };

  const onBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const input = event.nativeEvent as InputEvent;
    if (!input.inputType?.startsWith("insert") || !input.data) return;
    const editor = ref.current;
    if (!editor) return;
    const selection = window.getSelection();
    const replacing = selection && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode) ? selection.toString().length : 0;
    if (plain(editor).length - replacing + input.data.length > MAX_CHARACTERS) event.preventDefault();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const editor = ref.current;
    if (!editor) return;
    const selection = window.getSelection();
    const replacing = selection && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode) ? selection.toString().length : 0;
    const remaining = Math.max(0, MAX_CHARACTERS - plain(editor).length + replacing);
    const insert = event.clipboardData.getData("text/plain").slice(0, remaining);
    if (insert) document.execCommand("insertText", false, insert);
    notify();
  };


  return <div className={`ibqRich ibqUnifiedEditor ${tone}`}>
    <AssessmentRichToolbar label={label} onRemember={rememberImageEditorSelection} onCommand={runImageEditorCommand} onError={setError} />
    <div ref={ref} className="ibqRichInput" contentEditable suppressContentEditableWarning
      role="textbox" aria-label={label} aria-multiline="true" data-placeholder={placeholder}
      style={{minHeight: Math.max(108, rows*27 + 27)}}
      onInput={notify} onBeforeInput={onBeforeInput} onPaste={onPaste}
    />
    <small className="ibqRichCharacterCount" aria-label={`${count} of ${MAX_CHARACTERS} characters`} aria-live="polite">{count}/{MAX_CHARACTERS}</small>
    {error && <small role="alert" className="ibqRichError">{error}</small>}
  </div>;
}
