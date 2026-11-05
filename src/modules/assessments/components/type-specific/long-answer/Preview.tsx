"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {getActiveAssessmentId,viewerPath} from "@/modules/assessments/storage/assessment-storage";
import type {LongQuestion} from "./long-answer-data";
import Select from "./LongAnswerSelect";
import {validLongQuestion} from "./long-answer-data";

type Props={questions:LongQuestion[];onBack:()=>void;onSaveAndContinue:()=>void;onEdit:(index:number)=>void;saving:boolean};
const Asset=({name}:{name:string})=><img alt="" aria-hidden="true" src={`/assets/assessmenticons/${name}`} width={19} height={19}/>;
function Toggle({on}:{on:boolean}){return <span className={`la-mini-switch ${on?"is-on":""}`}>{on?"ON":"OFF"}</span>;}
function Block({heading,icon,children}:{heading:string;icon?:string;children:React.ReactNode}){
 const [open,setOpen]=useState(true);
 return <section className="la-preview-block"><button type="button" className="la-preview-sectionhead" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>{icon&&<span className="la-icon-round"><Asset name={icon}/></span>}{heading}</span><span className={`la-collapse-chevron ${open?"is-expanded":""}`}><Asset name="arrow-down-01.svg"/></span></button>{open&&<div className="la-preview-sectionbody">{children}</div>}</section>;
}
function Field({label,value}:{label:string;value:React.ReactNode}){return <div className="la-preview-field"><label>{label}</label><div>{value||"—"}</div></div>;}
export default function LongAnswerPreview({questions,onBack,onEdit,onSaveAndContinue,saving}:Props){
 const [filter,setFilter]=useState("All Questions"); const [index,setIndex]=useState(0);
 const router=useRouter();
 const valid=useMemo(()=>questions.map(q=>validLongQuestion(q).length===0),[questions]);
 const indices=questions.map((_,i)=>i).filter(i=>filter==="All Questions"||(filter==="Complete"?valid[i]:!valid[i]));
 const activeIndex=indices.includes(index)?index:indices[0]??0;
 const q=questions[activeIndex];
 const total=questions.reduce((n,question)=>n+(Number(question.points)||0),0);
 const completed=valid.filter(Boolean).length;
 return <div className="la-preview">
  <nav className="la-breadcrumb">Assessment <Asset name="arrowrightdouble.svg"/> Create Assessment <Asset name="arrowrightdouble.svg"/> Create Questions <Asset name="arrowrightdouble.svg"/> <strong>Preview Questions</strong></nav>
  <div className="la-preview-title"><h1>Preview Questions</h1><p>Review Your Questions Before Savings</p></div>
  <div className="la-preview-tools"><div className="la-preview-stats"><span>{questions.length}<small>Questions</small></span><span>{total}<small>Marks</small></span><span className={completed===questions.length?"la-ok":"la-alert"}>{completed===questions.length?"✓ Ready":"Needs Attention"}<small>{completed===questions.length?"All good to continue":`${questions.length-completed} incomplete`}</small></span></div>
   <div className="la-preview-buttons"><Select ariaLabel="Filter questions" className="la-preview-filter" value={filter} onChange={setFilter} options={["All Questions","Complete","Need Attention"]}/><button type="button" onClick={()=>{const id=getActiveAssessmentId();if(id)router.push(`${viewerPath(id)}?preview=true`);}}><Asset name="view.svg"/>Learner Preview</button></div>
  </div>
  <div className="la-preview-canvas">{indices.length===0?<p>No questions match this filter.</p>:<>
   <div className="la-preview-head"><div className="la-preview-tabs">{indices.map(i=><button type="button" key={i} className={activeIndex===i?"selected":""} onClick={()=>setIndex(i)}>Question {i+1}</button>)}</div><div className="la-preview-headright"><span>Long Answer: {Number(q.points)||0} Points</span><span className={valid[activeIndex]?"la-ok":"la-alert"}>Status: {valid[activeIndex]?"Complete":"Needs Attention"}</span><button onClick={()=>onEdit(activeIndex)}><Asset name="editbig.svg"/>Edit</button></div></div>
   <div className="la-preview-question"><h2>Question {activeIndex+1}</h2><div className="la-inset la-preview-questiontext">{q.text||"Question text not entered"}</div></div>
   <div className="la-preview-placeholder">Answer Box Placeholder</div>
   <Block heading="Answer Settings" icon="editbig.svg"><div className="la-preview-fieldgrid"><Field label="Responses" value={`${q.responseFormat} · ${q.inputBoxLines} lines`}/><Field label="Length" value={`${q.minWords}–${q.maxWords} words · ${q.maxCharacters} characters`}/><Field label="Required" value={q.responseRequired?"YES":"NO"}/></div>
     <article className="la-preview-info"><h3><span className="la-icon-round"><Asset name="editbig.svg"/></span>Model Answer</h3><p>{q.modelAnswer||"—"}</p></article>
     <article className="la-preview-info"><h3>Grading Method</h3><p>{q.gradingMethod ?? "Equal Marks"} · {q.points} points · Negative marking: {q.negativeMarking ?? "NA"}</p><p>Partial Credit: {(q.partialCredit ?? true)?"ON":"OFF"} · Minimum score of 0: {(q.minimumZero ?? true)?"ON":"OFF"}</p>{q.criteria.map((criterion,i)=><p key={criterion.id}>{criterion.title||`Criterion ${i+1}`}: {(q.gradingMethod??"Equal Marks")==="Custom"?criterion.levels[0]?.points||"0":(Number(q.points||0)/Math.max(1,q.criteria.length)).toFixed(2)} marks</p>)}</article>
   </Block>
   <Block heading="Feedback and Learning" icon="message-circle-more.svg"><div className="la-preview-info-list">{[{heading:"Full Marks",value:q.feedbackFull,cls:"la-green",icon:"checkmark-circle.svg"},{heading:"Partial Marks",value:q.feedbackPartial,cls:"la-orange",icon:"alert.svg"},{heading:"Zero Marks",value:q.feedbackZero,cls:"la-red",icon:"cancel.svg"},{heading:"Explanation",value:q.explanation,cls:"",icon:"idea.svg"},{heading:"Hint",value:q.hint,cls:"",icon:"idea.svg"},{heading:"Information for Graders",value:q.graderInfo,cls:"",icon:"editbig.svg"}].map(item=><article key={item.heading} className="la-preview-info"><h3 className={item.cls}><span className="la-icon-round"><Asset name={item.icon}/></span>{item.heading}</h3><p>{item.value||"—"}</p></article>)}</div></Block>
   <Block heading="Question Settings" icon="assignments.svg"><div className="la-preview-fieldgrid la-preview-settings"><Field label="Difficulty" value={q.difficulty}/><Field label="Blooms Taxonomy" value={q.bloom}/><Field label="Category" value={q.category}/><Field label="Tags" value={q.tags.join(", ")}/><Field label="Mandatory" value={q.mandatory?<Toggle on/>:<Toggle on={false}/>}/></div></Block>
  </>}
  <div className="la-preview-footer"><button type="button" onClick={onBack}>Back to Question</button><div className="la-footer-right">{saving&&<span className="la-save-notice" role="status">Successfully saved</span>}</div></div>
  </div>
 </div>;
}
