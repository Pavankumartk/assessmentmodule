"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { applyAssessmentFont } from "./image-based-editor-font";
import "./image-based-rich-toolbar.css";

const fonts = ["Arial", "Segoe UI", "Inter", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const sizes = ["12", "14", "16", "18", "20", "24", "28", "32", "36"];
const colors = ["#FFFFFF", "#FFF59D", "#F7DA36", "#FFD54F", "#FFB74D", "#FF8A80", "#F48FB1", "#CE93D8", "#B39DDB", "#9FA8DA", "#90CAF9", "#80DEEA", "#80CBC4", "#A5D6A7", "#C5E1A5", "#E6EE9C", "#FFE082", "#FFCCBC", "#BCAAA4", "#CFD8DC", "#E0E0E0", "#B0BEC5", "#78909C", "#374151"];

function ToolbarIcon({ icon, fallback }: { icon: string; fallback: string }) {
  const [missing, setMissing] = useState(false);
  return missing ? <span aria-hidden="true">{fallback}</span> : <img src={`/assets/assessmenticons/${icon}.svg`} width={18} height={18} alt="" aria-hidden="true" onError={() => setMissing(true)}/>;
}

/** The Interview/Viva toolbar, shared by creator editors without changing their saved value format. */
export default function ImageBasedRichToolbar({ editorRef, onChange, onError, label = "Text formatting" }: {
  editorRef: RefObject<HTMLElement | null>;
  onChange?: () => void;
  onError?: (message: string) => void;
  label?: string;
}) {
  const selection = useRef<Range | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textColorRef = useRef<HTMLInputElement>(null);
  const fileKind = useRef<"image" | "attachment">("image");
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [family, setFamily] = useState("Arial");
  const [size, setSize] = useState("16");
  const [highlight, setHighlight] = useState("#F7DA36");
  const [menu, setMenu] = useState<"font" | "size" | "highlight" | null>(null);
  const [position, setPosition] = useState({top:0,left:0,width:192});
  const remember = () => {
    const current = window.getSelection();
    if (current?.rangeCount && editorRef.current?.contains(current.anchorNode) && editorRef.current.contains(current.focusNode)) selection.current = current.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    editor.focus();
    if (selection.current && editor.contains(selection.current.commonAncestorContainer)) {
      try { const current=window.getSelection(); current?.removeAllRanges(); current?.addRange(selection.current); } catch { /* Keep the current caret. */ }
    }
    return true;
  };
  const notify = () => {
    if (onChange) onChange();
    else editorRef.current?.dispatchEvent(new Event("input", {bubbles:true}));
  };
  const apply = (command:string, value?:string) => {
    if (!restore()) return;
    if (command === "fontName" && value) applyAssessmentFont(editorRef.current, value);
    else document.execCommand(command, false, command === "fontSize" ? "7" : value);
    if (command === "fontSize" && value) editorRef.current?.querySelectorAll('font[size="7"]').forEach(element => {element.removeAttribute("size"); (element as HTMLElement).style.fontSize=`${value}px`;});
    remember(); notify();
  };
  const openMenu = (next:"font"|"size"|"highlight", trigger:HTMLElement) => {
    remember();
    if (menu === next) { setMenu(null); return; }
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(next === "highlight" ? 248 : next === "size" ? 100 : 192, window.innerWidth - 16);
    const height = next === "highlight" ? 172 : 225;
    setPosition({top:window.innerHeight-rect.bottom >= height+8 ? rect.bottom+6 : Math.max(8,rect.top-height-6),left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),width});
    setMenu(next);
  };
  useEffect(() => {
    if (!menu) return;
    const outside=(event:PointerEvent)=>{if(!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node))setMenu(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key === "Escape")setMenu(null);};
    const scroll=(event:Event)=>{if(!(event.target instanceof Node) || !menuRef.current?.contains(event.target))setMenu(null);};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);document.addEventListener("scroll",scroll,true);window.addEventListener("resize",scroll);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);document.removeEventListener("scroll",scroll,true);window.removeEventListener("resize",scroll);};
  },[menu]);
  const tool = (label:string, icon:string, fallback:string, action:()=>void) => <button key={label} type="button" title={label} aria-label={label} onMouseDown={event=>{remember();event.preventDefault();}} onClick={action}><ToolbarIcon icon={icon} fallback={fallback}/></button>;
  const insertLink = () => {
    remember(); const url=window.prompt("Link address (https:// or mailto:)","https://"); if(!url)return;
    if(!/^(https?:\/\/|mailto:)/i.test(url)){onError?.("Please use an http, https, or mailto link.");return;}
    if(!restore())return;
    if(window.getSelection()?.toString())document.execCommand("createLink",false,url);
    else {const link=document.createElement("a");link.href=url;link.textContent=url;document.execCommand("insertHTML",false,link.outerHTML);}
    remember();notify();
  };
  const chooseFile = (kind:"image"|"attachment") => {remember();fileKind.current=kind;if(fileRef.current){fileRef.current.value="";fileRef.current.accept=kind === "image" ? "image/*" : "";fileRef.current.click();}};
  const insertFile = (file?:File) => {
    if(!file)return;
    if(fileKind.current === "image" && !file.type.startsWith("image/")){onError?.("Please select an image.");return;}
    if(file.size>1024*1024){onError?.("Please use a file smaller than 1 MB.");return;}
    const reader=new FileReader();
    reader.onload=()=>{
      if(typeof reader.result !== "string" || !restore())return;
      if(fileKind.current === "image")document.execCommand("insertImage",false,reader.result);
      else {
        const link=document.createElement("a");link.href=reader.result;link.download=file.name;link.textContent=`Attachment: ${file.name}`;
        const current=window.getSelection();if(current?.rangeCount){const range=current.getRangeAt(0);range.insertNode(link);range.setStartAfter(link);range.collapse(true);current.removeAllRanges();current.addRange(range);}
      }
      remember();notify();
    };
    reader.readAsDataURL(file);
  };
  return <>
    <div className="ibqSharedRichToolbar" role="toolbar" aria-label={label} ref={rootRef}>
      {tool("Undo","undo","↶",()=>apply("undo"))}{tool("Redo","redo","↷",()=>apply("redo"))}
      <button className="ibqSharedRichSelect" type="button" aria-label="Font family" aria-haspopup="listbox" aria-expanded={menu === "font"} onMouseDown={event=>{remember();event.preventDefault();}} onClick={event=>openMenu("font",event.currentTarget)}>{family}<span aria-hidden="true">⌄</span></button>
      <button className="ibqSharedRichSelect ibqSharedRichSize" type="button" aria-label="Font size" aria-haspopup="listbox" aria-expanded={menu === "size"} onMouseDown={event=>{remember();event.preventDefault();}} onClick={event=>openMenu("size",event.currentTarget)}>{size}<span aria-hidden="true">⌄</span></button>
      {tool("Bold","bold","B",()=>apply("bold"))}{tool("Italic","italic","I",()=>apply("italic"))}{tool("Underline","underline","U",()=>apply("underline"))}{tool("Strikethrough","strikethrough","S",()=>apply("strikeThrough"))}
      {tool("Text color","pen-line","A",()=>{remember();textColorRef.current?.click();})}
      <button type="button" title="Highlight colour" aria-label="Highlight colour" aria-haspopup="dialog" aria-expanded={menu === "highlight"} onMouseDown={event=>{remember();event.preventDefault();}} onClick={event=>openMenu("highlight",event.currentTarget)}><span className="ibqSharedRichSwatch" style={{backgroundColor:highlight}}/></button>
      {tool("Bulleted list","text-centerline-center-top","•≡",()=>apply("insertUnorderedList"))}{tool("Numbered list","list-numbered","1≡",()=>apply("insertOrderedList"))}{tool("Decrease indent","outdent","⇤",()=>apply("outdent"))}{tool("Increase indent","indent","⇥",()=>apply("indent"))}
      {tool("Align left","align-left","≡",()=>apply("justifyLeft"))}{tool("Align centre","align-center","≡",()=>apply("justifyCenter"))}{tool("Align right","align-right","≡",()=>apply("justifyRight"))}{tool("Justify","align-justify","≡",()=>apply("justifyFull"))}
      {tool("Paragraph","paragraph","¶",()=>apply("formatBlock","p"))}{tool("Insert link","link","↗",insertLink)}{tool("Insert image","image","▧",()=>chooseFile("image"))}{tool("Attach file","attachment","⌁",()=>chooseFile("attachment"))}
      {tool("Insert table","table","▦",()=>apply("insertHTML","<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table><p><br></p>"))}{tool("Blockquote","quote-left","❝",()=>apply("formatBlock","blockquote"))}{tool("Code block","code","</>",()=>apply("formatBlock","pre"))}{tool("Superscript","superscript","x²",()=>apply("superscript"))}{tool("Subscript","subscript","x₂",()=>apply("subscript"))}
    </div>
    <input ref={fileRef} type="file" hidden style={{display:"none"}} onChange={event=>insertFile(event.currentTarget.files?.[0])}/>
    <input ref={textColorRef} type="color" tabIndex={-1} aria-label="Choose text color" style={{position:"fixed",width:1,height:1,opacity:0,pointerEvents:"none"}} onChange={event=>apply("foreColor",event.currentTarget.value)}/>
    {menu && typeof document !== "undefined" && createPortal(<div ref={menuRef} className={`ibqSharedRichMenu${menu === "highlight" ? " ibqSharedRichPalette" : ""}`} role={menu === "highlight" ? "group" : "listbox"} aria-label={menu === "font" ? "Font family" : menu === "size" ? "Font size" : "Highlight colours"} style={position}>
      {menu === "highlight" ? colors.map(color=><button key={color} type="button" title={color} aria-label={`Highlight with ${color}`} aria-pressed={highlight === color} style={{backgroundColor:color}} onMouseDown={event=>event.preventDefault()} onClick={()=>{setHighlight(color);apply("hiliteColor",color);setMenu(null);}}/>) : (menu === "font" ? fonts : sizes).map(value=><button type="button" role="option" key={value} aria-selected={menu === "font" ? family === value : size === value} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(menu === "font"){setFamily(value);apply("fontName",value);}else{setSize(value);apply("fontSize",value);}setMenu(null);}}>{menu === "font" ? value : `${value}px`}</button>)}
    </div>,document.body)}
  </>;
}
