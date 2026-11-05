"use client";
import AIInterviewContent from "../type-specific/ai-interviews-and-quizzes/Content";
import AIInterviewEvaluation from "../type-specific/ai-interviews-and-quizzes/Evaluation";
import ProblemSolvingContent from "../type-specific/problem-solving/Content";
import AssignmentEvaluationStep from "../type-specific/assignment/Evaluation";
import AssignmentContentStep from "../type-specific/assignment/Content";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assessmentStorage, getActiveAssessmentId, getAssessment } from "../../storage/assessment-storage";
import { getAssessmentAdapter, hasAssessmentWorkflow } from "../../config/component-registry";
import {getDemoSession} from "../../auth/demo-auth";
import DetailsStep from "./steps/DetailsStep/DetailsStep";
import ContentStep from "./steps/ContentStep/ContentStep";
import EvaluationStep from "./steps/EvaluationStep/EvaluationStep";
import ReviewStep from "./steps/ReviewStep/ReviewStep";
import ShortDetails from "../type-specific/short-answer/Details";
import ShortContent from "../type-specific/short-answer/Content";
import ShortEvaluation from "../type-specific/short-answer/Evaluation";
import ShortReview from "../type-specific/short-answer/Review";
import OneDetails from "../type-specific/one-word/Details";
import OneContent from "../type-specific/one-word/Content";
import OneEvaluation from "../type-specific/one-word/Evaluation";
import OneReview from "../type-specific/one-word/Review";
import TrueFalseDetails from "../type-specific/true-false/Details";
import TrueFalseContent from "../type-specific/true-false/Content";
import TrueFalseEvaluation from "../type-specific/true-false/Evaluation";
import TrueFalseReview from "../type-specific/true-false/Review";
import FillDetails from "../type-specific/fill-in-the-blanks/Details";
import FillContent from "../type-specific/fill-in-the-blanks/Content";
import FillEvaluation from "../type-specific/fill-in-the-blanks/Evaluation";
import FillReview from "../type-specific/fill-in-the-blanks/Review";
import LongDetails from "../type-specific/long-answer/Details";
import LongContent from "../type-specific/long-answer/Content";
import LongEvaluation from "../type-specific/long-answer/Evaluation";
import LongReview from "../type-specific/long-answer/Review";
import DragDetails from "../type-specific/drag-and-drop/Details";
import DragContent from "../type-specific/drag-and-drop/Content";
import MemoryDetails from "../type-specific/memory-game/Details";
import MemoryContent from "../type-specific/memory-game/Content";
import MatchContent from "../type-specific/match-the-following/Content";
import ClickableHotspotContent from "../type-specific/clickable-hotspot/Content";
import ConnectDotsContent from "../type-specific/connect-the-dots/Content";
import MatchReview from "../type-specific/match-the-following/Review";
import ImageContent from "../type-specific/image-based/Content";
import ImageReview from "../type-specific/image-based/Review";
import AssessmentContentEntry from "./AssessmentContentEntry";

/** A single shared Creator for every assessment type (no MCQ-only routes). */
export type AssessmentFormStep = "details" | "content" | "evaluation" | "review";
const STEPS = {
  details: DetailsStep,
  content: ContentStep,
  evaluation: EvaluationStep,
  review: ReviewStep,
};
const TYPE_STEPS = {
  "ai-viva": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-assessment": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-interviews-and-quizes": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-interviews-quizzes": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-interviews": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-interview": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "ai-interviews-and-quizzes": {details:STEPS.details,content:AIInterviewContent,evaluation:AIInterviewEvaluation,review:STEPS.review},
  "problem-solving-challenge": {details:STEPS.details,content:ProblemSolvingContent,evaluation:STEPS.evaluation,review:STEPS.review},
  "problem-solving": {details:STEPS.details,content:ProblemSolvingContent,evaluation:STEPS.evaluation,review:STEPS.review},
  "assignment": {details:STEPS.details,content:AssignmentContentStep,evaluation:AssignmentEvaluationStep,review:ReviewStep},
 "clickable-hotspot": {details:DetailsStep, content:ClickableHotspotContent, evaluation:EvaluationStep, review:ReviewStep},
 "true-false": { details:TrueFalseDetails, content:TrueFalseContent, evaluation:TrueFalseEvaluation, review:TrueFalseReview },
 "fill-in-the-blanks": { details:FillDetails, content:FillContent, evaluation:FillEvaluation, review:FillReview },
 "long-answer": { details:LongDetails, content:LongContent, evaluation:LongEvaluation, review:LongReview },
 "drag-and-drop": { details:DragDetails, content:DragContent, evaluation:EvaluationStep, review:ReviewStep },
 "memory-game": { details:MemoryDetails, content:MemoryContent, evaluation:EvaluationStep, review:ReviewStep },
 "short-answer": { details:ShortDetails, content:ShortContent, evaluation:ShortEvaluation, review:ShortReview },
 "one-word": { details:OneDetails, content:OneContent, evaluation:OneEvaluation, review:OneReview },
 "match-the-following": { details:DetailsStep, content:MatchContent, evaluation:EvaluationStep, review:MatchReview },
 "connect-the-dots": { details:DetailsStep, content:ConnectDotsContent, evaluation:EvaluationStep, review:ReviewStep },
 "image-based": {details:DetailsStep, content:ImageContent, evaluation:EvaluationStep, review:ImageReview},
};
export default function AssessmentForm({ step }: { step: AssessmentFormStep }) {
  const router = useRouter();
  const [typeCode, setTypeCode] = useState<string | null>(null);
  useEffect(() => {
    const id = getActiveAssessmentId();
    const record = id ? getAssessment(id) : undefined;
    const session=getDemoSession();
    if (!session || session.role!=="admin" || !record || (record.tenantId||"north")!==session.tenantId || !hasAssessmentWorkflow(record.typeCode)) {
      router.replace("/assessments/create");
      return;
    }
    setTypeCode(record.typeCode);
    const onWizardStep = (event: Event) => {
      const name=(event as CustomEvent<string>).detail;
      if (name === "type") router.push("/assessments/create");
      else if (["details","content","evaluation","review"].includes(name)) router.push(`/assessments/create/${name}`);
    };
    // Different creators use either direct router navigation or their step event.
    // Accept each existing event without changing any creator page's CSS/markup.
    const stepEvents = ["one-word-step", "assessment-step", "drag-and-drop-step", "memory-game-step"] as const;
    stepEvents.forEach(name => window.addEventListener(name,onWizardStep));
    return () => stepEvents.forEach(name => window.removeEventListener(name,onWizardStep));
  }, [router]);
  useEffect(() => {
    if (!typeCode || getAssessmentAdapter(typeCode)?.questionMode !== "ai-interview") return;
    try { assessmentStorage.setItem("aiCreatorLastStep", step); } catch { /* Existing draft data remains available. */ }
  }, [step, typeCode]);
  if (!typeCode) return null;
  const configured = TYPE_STEPS[typeCode as keyof typeof TYPE_STEPS];
  // Reuse the existing Figma Review page for every assessment type.
  // Keep type-specific Details, Content and Evaluation screens unchanged.
  const Screen = step === "review" ? ReviewStep : configured ? configured[step] : STEPS[step];
  const isAiCreator = getAssessmentAdapter(typeCode)?.questionMode === "ai-interview";
  return <div className={`assessment-variant assessment-variant--${typeCode}${isAiCreator ? " assessment-variant--ai-creator" : ""}`}>{step === "content" ? <AssessmentContentEntry typeCode={typeCode} Editor={Screen} /> : <Screen />}</div>;
}
