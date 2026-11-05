"use client";
import { creatorInstructionLines } from "@/modules/assessments/components/viewer/instruction-text";

import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import {assessmentStorage,getActiveAssessmentId,getAssessment} from "@/modules/assessments/storage/assessment-storage";
import ViewerQuestions from "./ViewerQuestions";
import ViewerInstructions from "@/modules/assessments/components/viewer/ViewerInstructions";
import "@/modules/assessments/components/viewer/AssessmentViewer/viewer.css";

const ICONS="/assets/viewericons/";
const standardInstructions=[
  "Select an answer for each blank in the question",
  "Each correct question carries its configured marks",
  "The timer starts when you begin",
  "You can flag questions for later review",
  "You can change your answer before Final Submission",
  "The test will auto-submit when time is up."
];
function Icon({name,size=22}:{name:string;size?:number}){return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true"/>;}
function SummaryItem({label,value,iconName,variant}:{label:string;value:string;iconName:string;variant:"blue"|"orange"|"purple"|"green"|"red"}){
  return <div className={`viewerStat viewerStat--${variant}`}><span className="viewerStatIcon"><Icon name={iconName} size={24}/></span><div className="viewerStatText"><strong>{label}</strong><span>{value}</span></div></div>;
}
type Details=Record<string,unknown>;
function val(data:Details,names:string[],fallback:string){for(const key of names){const value=data[key];if(typeof value==="string"&&value.trim())return value.trim();if(typeof value==="number"&&Number.isFinite(value))return String(value);}return fallback;}

export default function FillViewer(){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [started,setStarted]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [details,setDetails]=useState<Details>({});
  const [count,setCount]=useState(0);
  const [questionMarks,setQuestionMarks]=useState(0);
  const preview=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("preview")==="true";
  const startedKey=preview?"fillBlanksPreviewStarted":"fillBlanksViewerStarted";
  useEffect(()=>{
    try{
      const draft=JSON.parse(assessmentStorage.getItem("fillBlanksAssessmentDraft")||"{}");
      const content=JSON.parse(assessmentStorage.getItem("fillBlanksContentDraft")||"{}");
      const questions=Array.isArray(content.questions)?content.questions:[];
      setDetails(draft);setCount(questions.length);
      setQuestionMarks(questions.reduce((sum:number,q:{points?:unknown})=>sum+(Number(q.points)||1),0));
      const freshInstructions = new URLSearchParams(window.location.search).get("instructions") === "1";
      if (freshInstructions) assessmentStorage.removeItem(startedKey);
      setStarted(!freshInstructions && assessmentStorage.getItem(startedKey)==="yes");
    }catch{}
    setReady(true);
  },[startedKey]);
  if(!ready)return null;
  if(started)return <ViewerQuestions/>;
  const id=getActiveAssessmentId(),record=id?getAssessment(id):null;
  const title=val(details,["assessmentName","assessmentTitle","title"],record?.title||"Fill in the Blanks");
  const duration=val(details,["duration","timeLimit","totalTime"],"60");
  const passing=val(details,["passingScore","passingMarks"],"60%");
  const customInstructions=creatorInstructionLines(details.instructions, details.descriptionInstructions);
  const instructions=customInstructions.length?customInstructions:standardInstructions;
  const marks=val(details,["totalMarks"],String(questionMarks||record?.marks||0));
  const negative=val(details,["negativeMarkingValue"],"None");
  return <main className="superAdminPage institutionAdminPage viewerAppShell"><div className="dashboardLayout viewerLayout"><Sidebar/><section className="mainContent viewerMain"><div className="viewerSharedHeader"><Header/></div><div className="institutionScrollArea viewerScroll"><div className="pageContent institutionPageContent viewerContent">
    <nav className="viewerBreadcrumb" aria-label="Breadcrumb"><Link href={demoDashboardPath()}>Dashboard</Link><Icon name="arrow-right-double.svg" size={20}/><Link href="/assessments">Assessment</Link><Icon name="arrow-right-double.svg" size={20}/><strong>{title}</strong></nav>
    <div className="viewerPageHeading"><h1>{title}</h1><p>Fill in the Blanks</p></div>
    <ViewerInstructions
      details={{totalQuestions:String(count),totalMarks:marks,totalTime:/minute|hour/i.test(duration)?duration:`${duration} Minutes`,passingScore:passing,negativeMarking:negative,instructions}}
      accepted={accepted} onAcceptedChange={setAccepted}
      onStart={()=>{assessmentStorage.setItem(startedKey,"yes");setStarted(true);}}
      canStart={count>0} unavailableMessage="No published Fill in the Blanks questions are saved for this assessment."
    />
  </div></div></section></div></main>;
}
