/** Browser-only, versioned storage: no API, Prisma, or server dependencies. */
import {getDemoSession} from "../auth/demo-auth";
export type AssessmentStatus = "Draft" | "Published" | "Scheduled";
export interface StoredAssessment {
  id: string;
  tenantId?: string;
  creatorId?: string;
  typeCode: string;
  typeLabel: string;
  title: string;
  course: string;
  questions: number;
  marks: number;
  status: AssessmentStatus;
  attemptCount?: number;
  createdAt: string;
  updatedAt: string;
}
const LIST_KEY = "neurolxp.assessments.v1";
const ACTIVE_KEY = "neurolxp.assessments.activeId";
const DRAFT_PREFIX = "neurolxp.assessments.draft.v1.";
const changed = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("neurolxp-assessments-changed")); };
const canUseStorage = () => typeof window !== "undefined";
export function getActiveAssessmentId(): string | null {
  if (!canUseStorage()) return null;
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function setActiveAssessmentId(id: string) {
  if (canUseStorage() && id) localStorage.setItem(ACTIVE_KEY,id);
}
export function getAssessments(): StoredAssessment[] {
  if (!canUseStorage()) return [];
  try {
    const value = JSON.parse(localStorage.getItem(LIST_KEY) || "[]");
    return Array.isArray(value) ? value.filter((v) => v && typeof v.id === "string") : [];
  } catch { return []; }
}
export function getAssessment(id: string): StoredAssessment | undefined {
  return getAssessments().find((a) => a.id === id);
}
export function saveAssessment(record: StoredAssessment): StoredAssessment {
  const entries = getAssessments();
  const index = entries.findIndex(a => a.id === record.id);
  if (index < 0) entries.unshift(record); else entries[index] = record;
  localStorage.setItem(LIST_KEY,JSON.stringify(entries)); changed();
  return record;
}
export function beginAssessment(typeCode: string, typeLabel: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const creator=getDemoSession();
  if (!creator || creator.role!=="admin") throw new Error("Sign in as an Institute Admin to create assessments.");
  saveAssessment({id,tenantId:creator.tenantId,creatorId:creator.userId,typeCode,typeLabel,title:"Untitled Assessment",course:"",questions:0,marks:0,status:"Draft",createdAt:now,updatedAt:now});
  setActiveAssessmentId(id);
  return id;
}
export function updateAssessment(values: Partial<StoredAssessment>, assessmentId=getActiveAssessmentId()) {
  if (!assessmentId) return;
  const previous = getAssessment(assessmentId);
  if (!previous) return;
  const session=getDemoSession();
  if(!session || (previous.tenantId||"north")!==session.tenantId) return;
  // Learners can update the submission count, never Creator fields or publication status.
  if(session.role==="learner") {
    if(previous.status!=="Published" || Object.keys(values).some(key=>key!=="attemptCount")) return;
    const count=Number(values.attemptCount);if(!Number.isSafeInteger(count)||count<0)return;
  }
  saveAssessment({...previous,...values,id:previous.id,createdAt:previous.createdAt,updatedAt:new Date().toISOString()});
}
export function duplicateAssessment(id: string) {
  const previous = getAssessment(id);
  if (!previous) return null;
  const now = new Date().toISOString();
  const copy = {...previous,id:crypto.randomUUID(),title:previous.title + " (Copy)",status:"Draft" as const,createdAt:now,updatedAt:now};
  for (const key of DRAFT_KEYS) {
    const original = localStorage.getItem(`${DRAFT_PREFIX}${id}.${key}`);
    if (original !== null) localStorage.setItem(`${DRAFT_PREFIX}${copy.id}.${key}`,original);
  }
  return saveAssessment(copy);
}

// Keep draft copying complete for every registered creator, including its evaluation settings.
const ADDITIONAL_WORKFLOW_DRAFT_KEYS = [
  "aiContentDraft", "aiInterviewViewerConfig", "aiInterviewEvaluationDraft",
  "problemSolvingContentDraft", "problemSolvingViewerState", "problemSolvingViewerResult",
  "assignmentDetailsDraft", "assignmentContentDraft", "assignmentEvaluationDraft",
  "clickableHotspotContentDraft",
  "trueFalseAssessmentDraft", "trueFalseContentDraft", "trueFalseEvaluationDraft",
  "fillBlanksAssessmentDraft", "fillBlanksContentDraft", "fillBlanksEvaluationDraft",
  "longAnswerAssessmentDraft", "longAnswerContentDraft", "longAnswerEvaluationDraft",
  "dragDropAssessmentDraft", "dragDropContentDraft", "dragDropEvaluationDraft",
  "memoryGameAssessmentDraft", "memoryGameContentDraft", "memoryGameEvaluationDraft",
  "imageBasedContentDraft", "imageBasedViewerResult", "matchFollowingContentDraft",
  "neurolxp-one-word-evaluation", "oneWordPreviewDraft",
] as const;

export const DRAFT_KEYS = ["connectDotsContentDraft","connectDotsViewerState","mcqQuestionCount","mcqAssessmentDraft","mcqContentDraft","mcqAssessmentEvaluationDraft","viewerAssessmentResult","viewerRetryResult","viewerCurrentQuestion","viewerRetryQuestions","viewerRetryDurationMinutes","viewerScratchPads","viewerFormulaStars","viewerFlaggedQuestionIndexes","viewerBookmarkedQuestionIndexes","viewerReviewedQuestionIndexes","shortAnswerAssessmentDraft","shortAnswerContentDraft","shortAnswerEvaluationDraft","oneWordAssessmentDraft","oneWordContentDraft","oneWordPreviewDraft","oneWordEvaluationDraft","shortAnswerViewerResult","oneWordViewerResult","shortAnswerViewerScratchPads","viewerScratchPads","shortAnswerViewerFormulaStars"].concat([...ADDITIONAL_WORKFLOW_DRAFT_KEYS]);
/** Drop-in replacement for legacy sessionStorage usage; data is isolated by assessmentId. */
export const assessmentStorage = {
  getItem(key:string):string|null {
    if (!canUseStorage()) return null;
    const id = getActiveAssessmentId();
    if (!id) return null;
    return localStorage.getItem(`${DRAFT_PREFIX}${id}.${key}`);
  },
  setItem(key:string,value:string):void {
    if (!canUseStorage()) return;
    const id=getActiveAssessmentId();
    if (!id) throw new Error("No active assessment selected");
    localStorage.setItem(`${DRAFT_PREFIX}${id}.${key}`,value);
    changed();
  },
  removeItem(key:string):void {
    const id=getActiveAssessmentId();
    if (id) localStorage.removeItem(`${DRAFT_PREFIX}${id}.${key}`);
    changed();
  }
};
export function viewerPath(id = getActiveAssessmentId()): string {
 return id ? `/assessments/${encodeURIComponent(id)}/viewer` : "/assessments";
}
export function resultPath(id = getActiveAssessmentId()): string {
 return id ? `/assessments/${encodeURIComponent(id)}/results` : "/assessments";
}

/** Publish an assessment using its type-specific draft, without a backend. */
export function publishAssessment(typeCode: "short-answer" | "one-word" | "long-answer") {
 const detailKey = typeCode === "one-word" ? "oneWordAssessmentDraft" : typeCode === "long-answer" ? "longAnswerAssessmentDraft" : "shortAnswerAssessmentDraft";
 const contentKey = typeCode === "one-word" ? "oneWordContentDraft" : typeCode === "long-answer" ? "longAnswerContentDraft" : "shortAnswerContentDraft";
 const detail = JSON.parse(assessmentStorage.getItem(detailKey) || "{}");
 const content = JSON.parse(assessmentStorage.getItem(contentKey) || "{}");
 const questions = Array.isArray(content.questions) ? content.questions : [];
 const count = questions.filter((q: { text?: string }) => q?.text?.trim()).length;
 if (!count) throw new Error("Please save at least one question before publishing.");
 const record = getAssessment(getActiveAssessmentId() || "");
 if (!record || record.typeCode !== typeCode) throw new Error("The selected assessment does not match this creator.");
 updateAssessment({title:detail.assessmentTitle || detail.title || record.typeLabel,course:detail.course || detail.courseName || "",questions:count,marks:Number(detail.totalMarks) || questions.reduce((n:number,q:{points?:number|string})=>n+(Number(q.points)||0),0),status:"Published"});
 return record.id;
}
