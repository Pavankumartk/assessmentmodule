"use client";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import { assessmentStorage, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";

const DEFAULT_INSTRUCTIONS = [
  "Look carefully at the image displayed with each question.",
  "Click the correct area of the image to place a marker.",
  "Use the number of markers requested by the question and check your choices before continuing.",
  "You can flag questions for later review and change answers before submitting.",
  "The timer begins when you select Start Assessment.",
  "Your answers are submitted automatically when the timer expires.",
];
function parse(key: string): Record<string, unknown> {
  try { const d: unknown=JSON.parse(assessmentStorage.getItem(key)||"{}");return d && typeof d==="object" && !Array.isArray(d)? d as Record<string,unknown>:{}; }
  catch{return {};}
}
function toText(value:unknown,fallback=""):string {return typeof value==="string"?value.replace(/<[^>]*>/g," ").trim()||fallback:typeof value==="number"?String(value):fallback;}
function Icon({name}:{name:string}) {return <img src={`/assets/viewericons/${name}`} width={24} height={24} alt="" aria-hidden="true"/>;}
function Summary({label,value,icon,tone}:{label:string;value:string;icon:string;tone:string}){return <div className={`viewerStat viewerStat--${tone}`}><span className="viewerStatIcon"><Icon name={icon}/></span><div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div></div>;}

export default function ClickableHotspotInstructions({assessmentId,onStart}:{assessmentId:string;onStart:()=>void}) {
  const [accepted,setAccepted]=useState(false);
  const info=useMemo(()=>{
    const record=getAssessment(assessmentId);
    const details=parse("mcqAssessmentDraft");
    const content=parse("clickableHotspotContentDraft");
    const summary=content.details && typeof content.details==="object"?content.details as Record<string,unknown>:{};
    const questions=Array.isArray(content.questions)?content.questions:[];
    const configured=questions.filter(item=>{
      if(!item || typeof item!=="object")return false;
      const q=item as Record<string,unknown>;
      return typeof q.imageSrc==="string" && Boolean(q.imageSrc) && Array.isArray(q.hotspots) && q.hotspots.length>0;
    });
    const lines=creatorInstructionLines(details.instructions, details.descriptionInstructions);
    const totalMarks=configured.length?configured.reduce((sum,item)=>sum+(Number((item as Record<string,unknown>).points)||0),0):Number(record?.marks??summary.totalMarks??0);
    const duration=toText(details.duration??summary.duration??details.durationMinutes, "60");
    const passing=toText(details.passingScore??summary.passingScore,"60%");
    return {title:record?.title || toText(details.assessmentTitle??details.title,"Clickable Hotspot"),
      count:String(configured.length || record?.questions || 0),marks:String(totalMarks),
      duration:/minute|hour/i.test(duration)?duration:`${duration} Minutes`,
      passing:passing.includes("%")?passing:`${passing}%`,
      negative:toText(details.negativeMarkingValue??details.negativeMarking,"NA"),
      instructions:lines.length?lines:DEFAULT_INSTRUCTIONS};
  },[assessmentId]);
  return <div className="viewerAppShell superAdminPage institutionAdminPage"><div className="viewerLayout"><Sidebar/><div className="viewerMain"><div className="viewerSharedHeader"><Header/></div>
    <main className="viewerScroll institutionScrollArea"><div className="viewerContent">
      <nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href="/learner">Dashboard</Link><Icon name="arrow-right-double.svg"/><Link href="/assessments/list">Assessment</Link><Icon name="arrow-right-double.svg"/><strong>{info.title}</strong></nav>
      <div className="viewerPageHeading"><h1>{info.title}</h1><p>Clickable Hotspot</p></div>
      <div className="viewerColumns"><aside className="viewerSummary" aria-label="Assessment summary">
        <Summary label="Total Questions" value={info.count} icon="list.svg" tone="blue"/><Summary label="Total Marks" value={info.marks} icon="star-award.svg" tone="orange"/>
        <Summary label="Total Time" value={info.duration} icon="alarm-clock.svg" tone="purple"/><Summary label="Passing Score" value={info.passing} icon="checkmark-circle.svg" tone="green"/>
        <Summary label="Negative Marking" value={info.negative} icon="remove-circle.svg" tone="red"/>
      </aside><div className="viewerRightColumn"><section className="viewerInstructions"><h2>Instructions</h2><ol>{info.instructions.map((line,i)=><li key={i}>{i+1}. {line}</li>)}</ol></section>
        <section className="viewerConfirmation" aria-label="Confirm instructions"><label className="viewerAgreement"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span className="viewerCheckboxIcon" aria-hidden="true"/><span>I have read and understood the instructions</span></label>
          <button type="button" className="viewerStart" disabled={!accepted} onClick={onStart}>Start Assessment</button>
        </section></div></div></div></main></div></div></div>;
}
