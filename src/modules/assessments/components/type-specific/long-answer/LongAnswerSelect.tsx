"use client";
import {useEffect,useId,useRef,useState} from "react";

/** Neumorphic dropdown shared by Long Answer Content and Preview. */
type Props = {
 value:string;
 onChange:(next:string)=>void;
 options:string[];
 placeholder?:string;
 className?:string;
 ariaLabel?:string;
};
export default function LongAnswerSelect({value,onChange,options,placeholder="Select",className="",ariaLabel}:Props){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const listId=useId();
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const esc=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
  document.addEventListener("pointerdown",outside);
  document.addEventListener("keydown",esc);
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",esc);};
 },[open]);
 const choice=(next:string)=>{onChange(next);setOpen(false);};
 return <div ref={root} className={`la-dropdown ${open?"is-open":""} ${className}`} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
   <button type="button" className="la-dropdown-trigger" aria-label={ariaLabel||placeholder} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={()=>setOpen(v=>!v)} onKeyDown={event=>{
     if(event.key==="ArrowDown"||event.key==="ArrowUp"){
       event.preventDefault();
       if(!open){setOpen(true);return;}
       const current=Math.max(0,options.indexOf(value));
       choice(options[(current+(event.key==="ArrowDown"?1:options.length-1))%options.length]);
     }
   }}>
    <span>{value||placeholder}</span>
    <img src="/assets/assessmenticons/arrow-down-01.svg" width={18} height={18} alt="" aria-hidden="true"/>
   </button>
   {open&&<div className="la-dropdown-menu" id={listId} role="listbox" aria-label={ariaLabel||placeholder}>
     {options.map(option=><button key={option} type="button" role="option" aria-selected={option===value} className={option===value?"is-selected":""} onClick={()=>choice(option)}>{option}</button>)}
   </div>}
 </div>;
}
