"use client";
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {assessmentStorage,getActiveAssessmentId} from "@/modules/assessments/storage/assessment-storage";
import "./wizard-navigation.css";
const PATHS=["/assessments/create","/assessments/create/details","/assessments/create/content","/assessments/create/evaluation","/assessments/create/review"];
/** Place inside an existing styled <li>: overlay preserves the Figma shapes and spacing. */
export default function WizardStepLink({index,current}:{index:number;current:number}){
 const router=useRouter();
 const [furthest,setFurthest]=useState(current);
 useEffect(()=>{const id=getActiveAssessmentId();const editing=!!id && sessionStorage.getItem("assessment-editing-id")===id;const visited=Number(assessmentStorage.getItem("creatorVisitedStep") || 0);setFurthest(editing ? 4 : Math.max(current, Number.isFinite(visited) ? visited : 0));},[current]);
 // Only previous, already-completed steps can be clicked; never skip ahead.
 return (index !== current && index <= furthest) ? <button type="button" className="assessment-wizard-step-hit" onClick={()=>router.push(PATHS[index])} aria-label={`Go to ${["Type","Details","Content","Evaluation","Review"][index]}`} title="Open visited step"/> : null;
}
