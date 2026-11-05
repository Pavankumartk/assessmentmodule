"use client";
import {useEffect} from "react";
import {getDemoSession} from "@/modules/assessments/auth/demo-auth";
import {assessmentStorage,getAssessment} from "@/modules/assessments/storage/assessment-storage";
import {getAssessmentAdapter} from "@/modules/assessments/config/component-registry";
import {useRouter,useParams} from "next/navigation";
import {setActiveAssessmentId} from "@/modules/assessments/storage/assessment-storage";
export default function Edit(){const {assessmentId}=useParams<{assessmentId:string}>();const router=useRouter();useEffect(()=>{const session=getDemoSession(),record=getAssessment(assessmentId);if(!session){router.replace("/login");return;}if(session.role!=="admin" || !record || (record.tenantId||"north")!==session.tenantId){router.replace(session.role==="admin"?"/assessments":"/learner");return;}setActiveAssessmentId(assessmentId);
  if (record.status === "Draft" && getAssessmentAdapter(record.typeCode)?.questionMode === "ai-interview") {
    try {
      sessionStorage.setItem("assessment-editing-id",assessmentId);
      const last = assessmentStorage.getItem("aiCreatorLastStep");
      const hasContent = Boolean(assessmentStorage.getItem("aiContentDraft"));
      const hasEvaluation = Boolean(assessmentStorage.getItem("aiEvaluationDraft"));
      const step = last && ["details","content","evaluation","review","generate"].includes(last) ? last : hasEvaluation ? "evaluation" : hasContent ? "content" : "details";
      if (step === "generate") { router.replace(`/assessments/create/ai?type=${encodeURIComponent(record.typeCode)}`); return; }
      const editingQuestions = step === "content" && (assessmentStorage.getItem("aiCreatorContentEditorOpen") === "1" || hasContent);
      router.replace(`/assessments/create/${step}${editingQuestions ? "?edit=1" : ""}`);
      return;
    } catch { /* Fall back to the existing Details route if storage is unavailable. */ }
  }
  router.replace("/assessments/create/details");},[assessmentId,router]);return null;}
