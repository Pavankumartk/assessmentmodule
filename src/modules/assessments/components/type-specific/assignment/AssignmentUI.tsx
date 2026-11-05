"use client";
import { AssessmentEditorDropdown } from "@/modules/assessments/components/common/steps/DetailsStep/DetailsStep";
import {useEffect,useRef,useState,type ReactNode,type ChangeEvent} from "react";
import Link from "next/link";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./assignment.css";

export function AssetIcon({name,size=18}:{name:string;size?:number}){
 return <img className="asgn-icon" alt="" aria-hidden="true" width={size} height={size} src={`/assets/assessmenticons/${name}`}/>;
}
export type AssignmentStep="details"|"content"|"evaluation";
const STEPS=["Type","Details","Content","Evaluation","Review"] as const;
export function AssignmentShell({step,children,subtitle}:{step:AssignmentStep;children:ReactNode;subtitle?:string}){
 const current=step==="details"?1:step==="content"?2:3;
 const appRef=useRef<HTMLDivElement>(null);
 const sidebarRef=useRef<HTMLElement>(null);
 // The shared Sidebar has its own expandable width. Reserve that real width for
 // Assignment Content rather than placing the content underneath the sidebar.
 useEffect(()=>{
  if(step!=="content" && step!=="evaluation")return;
  const app=appRef.current;
  const wrapper=sidebarRef.current;
  if(!app||!wrapper)return;
  let frame=0;
  const measure=()=>{
   const origin=wrapper.getBoundingClientRect();
   const candidates=[wrapper.firstElementChild,...wrapper.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']")];
   const widths=candidates.flatMap((candidate)=>{
    if(!(candidate instanceof HTMLElement))return [];
    const rect=candidate.getBoundingClientRect();
    if(rect.width<64||rect.width>360||Math.abs(rect.left-origin.left)>25)return [];
    return [rect.width];
   });
   const width=Math.max(0,...widths);
   if(width>=64)app.style.setProperty("--asgn-sidebar-width",Math.round(width)+"px");
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const resize=new ResizeObserver(schedule);
  resize.observe(wrapper);
  if(wrapper.firstElementChild)resize.observe(wrapper.firstElementChild);
  const mutation=new MutationObserver(schedule);
  mutation.observe(wrapper,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style","aria-expanded","data-state"]});
  window.addEventListener("resize",schedule);
  schedule();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener("resize",schedule);};
 },[step]);
 if(step==="content" || step==="evaluation")return (
  <div className={`asgn-app asgn-figma-content-shell${step==="evaluation"?" asgn-evaluation-shell":""}`} ref={appRef}>
   <aside className="asgn-sidebar" ref={sidebarRef}><Sidebar/></aside>
   <div className="asgn-right">
    <div className="asgn-header"><Header/></div>
    <main className="asgn-main">
     <nav className="asgn-breadcrumb" aria-label="Breadcrumb">
      <Link href="/assessments">Assessment</Link><span className="asgn-figma-bread-arrow" aria-hidden="true">»</span>
      <strong>Create Assessment</strong>
     </nav>
     <nav className="asgn-steps" aria-label="Assessment creation steps">
      {STEPS.map((item,i)=>{
       const url=i===0?"/assessments/create":i===1?"/assessments/create/details":i===2?"/assessments/create/content":i===3?"/assessments/create/evaluation":"/assessments/create/review";
       return <div className={`asgn-step ${i<current?"asgn-step-done":i===current?"asgn-step-active":"asgn-step-future"}`} key={item}>
        {i<current?<Link href={url}><span>{i+1}</span><b>{item}</b></Link>:<span><i>{i+1}</i><b>{item}</b></span>}
       </div>;
      })}
     </nav>
     <div className="asgn-heading"><h1>Assessment Details ( Assignment )</h1><p>{subtitle||"Provide The Essential Details And Settings For Your Assessment."}</p></div>
     {children}
    </main>
   </div>
  </div>
 );
 return <div className="asgn-app" ref={appRef}><aside className="asgn-sidebar" ref={sidebarRef}><Sidebar/></aside><div className="asgn-right"><div className="asgn-header"><Header/></div>
  <main className="asgn-main">
   <nav className="asgn-breadcrumb" aria-label="Breadcrumb"><Link href="/assessments">Assessment</Link><AssetIcon name="arrowrightdouble.svg" size={17}/><Link href="/assessments/create/details">Create Assessment</Link><AssetIcon name="arrowrightdouble.svg" size={17}/><strong>{step==="details"?"Assessment Details":"Evaluation"}</strong></nav>
   <div className="asgn-heading"><div><h1>{step==="details"?"Assessment Details (Assignment)":"Assignment Evaluation"}</h1><p>{subtitle||"Provide the essential details and settings for your assessment."}</p></div><span className="asgn-type-chip"><AssetIcon name="assignments.svg" size={18}/> Assignment</span></div>
   <nav className="asgn-steps" aria-label="Assessment creation steps">{STEPS.map((item,i)=>{
    const url=i===0?"/assessments/create":i===1?"/assessments/create/details":i===2?"/assessments/create/content":i===3?"/assessments/create/evaluation":"/assessments/create/review";
    return <div className={`asgn-step ${i<current?"asgn-step-done":i===current?"asgn-step-active":"asgn-step-future"}`} key={item}>{i<current?<Link href={url}><span>{i+1}</span><b>{item}</b></Link>:<span><i>{i+1}</i><b>{item}</b></span>}</div>;
   })}</nav>
   {children}
  </main></div></div>;
}
export function Panel({title,children,icon="assignments.svg",extra}:{title:string;children:ReactNode;icon?:string;extra?:ReactNode}){
 return <section className="asgn-panel"><div className="asgn-panel-title"><span className="asgn-panel-icon"><AssetIcon name={icon}/></span><h2>{title}</h2>{extra&&<span className="asgn-panel-extra">{extra}</span>}</div><div className="asgn-panel-body">{children}</div></section>;
}
export function Field({label,children,error,help}:{label:string;children:ReactNode;error?:string;help?:string}){
 return <label className="asgn-field"><span className="asgn-label">{label}</span>{children}{help&&<small className="asgn-help">{help}</small>}{error&&<small className="asgn-error" role="alert">{error}</small>}</label>;
}
export function Toggle({label,value,onChange,help}:{label:string;value:boolean;onChange:(v:boolean)=>void;help?:string}){
 return <div className="asgn-toggle-row"><div><span className="asgn-toggle-label">{label}</span>{help&&<small className="asgn-help">{help}</small>}</div><button aria-label={label} aria-pressed={value} type="button" className={`asgn-toggle ${value?"is-on":""}`} onClick={()=>onChange(!value)}><span>{value?"ON":"OFF"}</span><i/></button></div>;
}
export function ActionFooter({onBack,onSave,onContinue,loading=false}:{onBack:()=>void;onSave:()=>void;onContinue:()=>void;loading?:boolean}){
 return <div className="asgn-footer"><button type="button" className="asgn-button" onClick={onBack}><AssetIcon name="arrowleft.svg"/>Back</button><div className="asgn-footer-right"><button type="button" className="asgn-button" onClick={onSave}>Save</button><button disabled={loading} type="button" className="asgn-button asgn-button-primary" onClick={onContinue}>Save &amp; Continue <AssetIcon name="arrowright.svg"/></button></div></div>;
}
export function Notice({errors,message}:{errors:string[];message?:string}){return <>{message&&<div role={message === "Assignment content saved successfully." ? "status" : "alert"} className={message === "Assignment content saved successfully." ? "asgn-notice asgn-notice-success" : "asgn-notice"}>{message}</div>}{errors.length>0&&<div className="asgn-validation" role="alert"><strong>Please correct the following before continuing:</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}</>;}
export function DateTimeRow({label,enabled,onEnabled,date,onDate,time,onTime}:{label:string;enabled:boolean;onEnabled:(v:boolean)=>void;date:string;onDate:(v:string)=>void;time:string;onTime:(v:string)=>void}){
 return <div className="asgn-datetime"><Toggle label={label} value={enabled} onChange={onEnabled}/><div className="asgn-fields-grid asgn-grid-two"><Field label="Date"><input type="date" disabled={!enabled} value={date} onChange={e=>onDate(e.target.value)}/></Field><Field label="Time"><input type="time" disabled={!enabled} value={time} onChange={e=>onTime(e.target.value)}/></Field></div></div>;
}

// Figma-like rich text field: toolbar actions are functional; pasted content is plain text.
function safeRichHtml(html:string){
 const doc=new DOMParser().parseFromString(html,"text/html");
 const allowed=new Set(["B","STRONG","I","EM","U","P","BR","DIV","UL","OL","LI","SPAN","FONT"]);
 const blocked=new Set(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","SVG","MATH","IMG","VIDEO","AUDIO","FORM"]);
 const clean=(node:Node):Node[]=>{
   if(node.nodeType===Node.TEXT_NODE)return [document.createTextNode(node.textContent||"")];
   if(!(node instanceof Element)||blocked.has(node.tagName))return [];
   const children=Array.from(node.childNodes).flatMap(clean);
   if(!allowed.has(node.tagName))return children;
   const el=document.createElement(node.tagName.toLowerCase());
   if (node.tagName === "FONT") {
     const face=node.getAttribute("face") || ""; const size=node.getAttribute("size") || "";
     if (["Arial","Segoe UI","Georgia","Times New Roman","Verdana"].includes(face)) el.setAttribute("face",face);
     if (/^[1-7]$/.test(size)) el.setAttribute("size",size);
   }
   if (node instanceof HTMLElement && /^\d{1,2}px$/.test(node.style.fontSize)) el.style.fontSize=node.style.fontSize;
   for(const child of children)el.appendChild(child);
   return [el];
 };
 const container=document.createElement("div");for(const node of Array.from(doc.body.childNodes).flatMap(clean))container.appendChild(node);
 return container.innerHTML;
}
export function RichTextField({label,value,html,onChange,onHtmlChange,placeholder}:{label:string;value:string;html?:string;onChange:(v:string)=>void;onHtmlChange?:(v:string)=>void;placeholder?:string}){
 const editor=useRef<HTMLDivElement>(null);const [font,setFont]=useState("Arial");const [size,setSize]=useState("16");
 useEffect(()=>{const el=editor.current;if(el&&document.activeElement!==el&&el.textContent!==value){if(html)el.innerHTML=safeRichHtml(html);else el.textContent=value;}},[value,html]);
 const selection=useRef<Range | null>(null);
 const remember=()=>{const selected=window.getSelection();if(selected?.rangeCount&&editor.current?.contains(selected.anchorNode))selection.current=selected.getRangeAt(0).cloneRange();};
 const command=(cmd:string,arg?:string)=>{editor.current?.focus();if(selection.current&&editor.current?.contains(selection.current.commonAncestorContainer)){const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(selection.current);}document.execCommand(cmd,false,cmd==="fontSize"?"7":arg);if(cmd==="fontSize"&&arg)editor.current?.querySelectorAll('font[size="7"]').forEach(node=>{node.removeAttribute("size");(node as HTMLElement).style.fontSize=`${arg}px`;});remember();update();};
 const update=()=>{if(!editor.current)return;onChange(editor.current.textContent||"");onHtmlChange?.(safeRichHtml(editor.current.innerHTML));};
 return <div className="asgn-rich-field"><span className="asgn-label">{label}</span><div className="asgn-rich-box">
  <div className="asgn-toolbar" role="toolbar" aria-label={`${label} formatting`}>
   <button type="button" aria-label="Undo" onMouseDown={e=>e.preventDefault()} onClick={()=>command("undo")}><AssetIcon name="undo-02.svg" size={16}/></button>
   <button type="button" aria-label="Redo" onMouseDown={e=>e.preventDefault()} onClick={()=>command("redo")}><AssetIcon name="redo.svg" size={16}/></button>
   <AssessmentEditorDropdown className="mcqEditorFont" label="Font" value={font} options={["Arial", "Segoe UI", "Georgia", "Times New Roman", "Verdana"]} onOpen={remember} onChange={v=>{setFont(v);command("fontName",v);}} />
   <AssessmentEditorDropdown className="mcqEditorSize" label="Font size" value={size} options={["12", "14", "16", "18", "24"]} onOpen={remember} onChange={v=>{setSize(v);command("fontSize",v);}} />
   <button type="button" aria-label="Bold" onMouseDown={e=>e.preventDefault()} onClick={()=>command("bold")}><b>B</b></button>
   <button type="button" aria-label="Italic" onMouseDown={e=>e.preventDefault()} onClick={()=>command("italic")}><i>I</i></button>
   <button type="button" aria-label="Underline" onMouseDown={e=>e.preventDefault()} onClick={()=>command("underline")}><u>U</u></button>
   <button type="button" aria-label="Bulleted list" onMouseDown={e=>e.preventDefault()} onClick={()=>command("insertUnorderedList")}><AssetIcon name="dot.svg" size={17}/></button>
   <button type="button" aria-label="Align center" onMouseDown={e=>e.preventDefault()} onClick={()=>command("justifyCenter")}><AssetIcon name="text-centerline-center-top.svg" size={17}/></button>
  </div><div ref={editor} className="asgn-rich-editable" contentEditable role="textbox" aria-label={label} aria-multiline="true" data-placeholder={placeholder||"Type here..."} suppressContentEditableWarning onKeyUp={remember} onMouseUp={remember} onInput={update} onBlur={()=>{remember();update();}} onPaste={e=>{e.preventDefault();document.execCommand("insertText",false,e.clipboardData.getData("text/plain"));update();}}/>
 </div></div>;
}

export function FileDrop({label,files,onPick,maxMB=2,multiple=false}:{label:string;files:{name:string;size:number}[];onPick:(files:File[])=>void;maxMB?:number;multiple?:boolean}){
 const handle=(event:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(event.target.files||[]);onPick(files);event.target.value="";};
 return <div className="asgn-file-field"><span className="asgn-label">{label}</span><label className="asgn-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onPick(Array.from(e.dataTransfer.files));}}><AssetIcon name="upload-01.svg" size={24}/><b>Choose Files</b><span>Drag or choose files (max {maxMB} MB per file)</span><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" multiple={multiple} onChange={handle}/></label>{files.length>0?<div className="asgn-file-list">{files.map((file,i)=><span key={`${file.name}-${i}`}><AssetIcon name="attachment.svg" size={14}/>{file.name} · {(file.size/1048576).toFixed(2)} MB</span>)}</div>:<small className="asgn-help">No files chosen</small>}</div>;
}
