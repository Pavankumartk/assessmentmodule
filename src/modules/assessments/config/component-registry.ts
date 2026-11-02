/** Frontend-only *runtime* capabilities, independent of localStorage metadata. */
import { mcqAssessmentAdapter } from "../components/type-specific/mcq";

export type QuestionMode = "single-choice" | "short-answer" | "one-word" | "matching" | "image-based" | "true-false" | "fill-in-the-blanks" | "long-answer" | "drag-and-drop" | "memory-game" | "connect-the-dots" | "clickable-hotspot" | "assignment" | "problem-solving" | "ai-interview";
export interface AssessmentAdapter {
  code: string;
  questionMode: QuestionMode;
  draftKeys: { readonly details: string; readonly content: string; readonly evaluation: string };
}

/** Add another adapter here when its Creator, Viewer, evaluation and results are implemented. */
export const ASSESSMENT_ADAPTERS: Record<string, AssessmentAdapter> = {
  "ai-assessment": {code:"ai-assessment",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "ai-interviews-and-quizes": {code:"ai-interviews-and-quizes",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "ai-interviews-quizzes": {code:"ai-interviews-quizzes",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "ai-interviews": {code:"ai-interviews",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "ai-interview": {code:"ai-interview",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "ai-interviews-and-quizzes": {code:"ai-interviews-and-quizzes",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "problem-solving-challenge": {code:"problem-solving-challenge",questionMode:"problem-solving",draftKeys:{details:"mcqAssessmentDraft",content:"problemSolvingContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "problem-solving": {code:"problem-solving",questionMode:"problem-solving",draftKeys:{details:"mcqAssessmentDraft",content:"problemSolvingContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "assignment": {code:"assignment",questionMode:"assignment",draftKeys:{details:"mcqAssessmentDraft",content:"assignmentContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "clickable-hotspot": {code:"clickable-hotspot",questionMode:"clickable-hotspot",draftKeys:{details:"mcqAssessmentDraft",content:"clickableHotspotContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "true-false": { code:"true-false", questionMode:"true-false", draftKeys:{details:"trueFalseAssessmentDraft",content:"trueFalseContentDraft",evaluation:"trueFalseEvaluationDraft"} },
  "fill-in-the-blanks": { code:"fill-in-the-blanks", questionMode:"fill-in-the-blanks", draftKeys:{details:"fillBlanksAssessmentDraft",content:"fillBlanksContentDraft",evaluation:"fillBlanksEvaluationDraft"} },
  "long-answer": { code:"long-answer", questionMode:"long-answer", draftKeys:{details:"longAnswerAssessmentDraft",content:"longAnswerContentDraft",evaluation:"longAnswerEvaluationDraft"} },
  "drag-and-drop": { code:"drag-and-drop", questionMode:"drag-and-drop", draftKeys:{details:"dragDropAssessmentDraft",content:"dragDropContentDraft",evaluation:"dragDropEvaluationDraft"} },
  "connect-the-dots": { code:"connect-the-dots", questionMode:"connect-the-dots", draftKeys:{details:"mcqAssessmentDraft",content:"connectDotsContentDraft",evaluation:"mcqAssessmentEvaluationDraft"} },
  "memory-game": { code:"memory-game", questionMode:"memory-game", draftKeys:{details:"memoryGameAssessmentDraft",content:"memoryGameContentDraft",evaluation:"memoryGameEvaluationDraft"} },
  "image-based": {code:"image-based",questionMode:"image-based",draftKeys:{details:"mcqAssessmentDraft",content:"imageBasedContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  "match-the-following": {code:"match-the-following",questionMode:"matching",draftKeys:{details:"mcqAssessmentDraft",content:"matchFollowingContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}},
  [mcqAssessmentAdapter.code]: mcqAssessmentAdapter,
  "short-answer": {code:"short-answer",questionMode:"short-answer",draftKeys:{details:"shortAnswerAssessmentDraft",content:"shortAnswerContentDraft",evaluation:"shortAnswerEvaluationDraft"}},
  "one-word": {code:"one-word",questionMode:"one-word",draftKeys:{details:"oneWordAssessmentDraft",content:"oneWordContentDraft",evaluation:"oneWordEvaluationDraft"}},
};

export const hasAssessmentWorkflow = (code: string): boolean => Boolean(ASSESSMENT_ADAPTERS[code]);
export const getAssessmentAdapter = (code: string): AssessmentAdapter | undefined => ASSESSMENT_ADAPTERS[code];
