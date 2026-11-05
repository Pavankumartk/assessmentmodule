import type {StoredAssessment} from "@/modules/assessments/storage/assessment-storage";
import {getActiveAssessmentId, getAssessment} from "@/modules/assessments/storage/assessment-storage";
import {getAssessmentAdapter} from "@/modules/assessments/config/component-registry";

export type LearnerStatus = "Live" | "Upcoming" | "Completed";
export type LearnerAttempt = {
  attemptId?: string;
  submittedAt?: string;
  scorePercent?: number;
  earnedMarks?: number;
  totalMarks?: number;
  pendingCount?: number;
};
export type LearnerAssessment = {
  record: StoredAssessment;
  status: LearnerStatus;
  course: string;
  module: string;
  totalQuestions: number;
  totalMarks: number;
  duration: number | null;
  passingScore: string;
  negativeMarking: string;
  maxAttempts: number | null;
  attemptLimitLabel: string;
  attemptsUsed: number;
  attempts: LearnerAttempt[];
  startAt: Date | null;
  endAt: Date | null;
  schedule: string;
  mode: string;
  canStart: boolean;
};

type Draft = Record<string, unknown>;
const PREFIX = "neurolxp.assessments.draft.v1.";

function storedJson(id: string, key: string): unknown {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(`${PREFIX}${id}.${key}`) || "null"); }
  catch { return null; }
}
function draftFor(record: StoredAssessment): Draft {
  const key = getAssessmentAdapter(record.typeCode)?.draftKeys.details ?? "mcqAssessmentDraft";
  const saved = storedJson(record.id, key);
  const details = saved && typeof saved === "object" && !Array.isArray(saved) ? saved as Draft : {};
  const assignment = record.typeCode === "assignment" ? storedJson(record.id, "assignmentDetailsDraft") : null;
  return assignment && typeof assignment === "object" && !Array.isArray(assignment) ? {...details, ...assignment as Draft} : details;
}
function stringValue(value: unknown): string { return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""; }
function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return value === undefined || value === null || value === "" || !Number.isFinite(number) || number <= 0 ? null : number;
}
function dateTime(dateValue: unknown, timeValue: unknown): Date | null {
  const day = stringValue(dateValue);
  if (!day) return null;
  const time = stringValue(timeValue) || "00:00";
  const parsed = new Date(day.includes("T") ? day : `${day}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function shortDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {day:"numeric",month:"short"}).format(date);
}
function clock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {hour:"2-digit",minute:"2-digit",hour12:false}).format(date);
}
export function formatDue(date: Date | null): string { return date ? shortDate(date) : "No closing date"; }
export function learnerAssessmentData(record: StoredAssessment, now = new Date()): LearnerAssessment {
  const draft = draftFor(record);
  const toggles = draft.toggles && typeof draft.toggles === "object" ? draft.toggles as Record<string, unknown> : {};
  const useStart = toggles.availableFrom !== false;
  const useEnd = toggles.availableUntil !== false;
  const startAt = useStart ? dateTime(draft.availableFromDate ?? draft.availableFrom, draft.availableFromTime) : null;
  const endAt = useEnd ? dateTime(draft.availableUntilDate ?? draft.availableUntil, draft.availableUntilTime) : null;
  const attemptsRaw = storedJson(record.id, record.typeCode === "fill-in-the-blanks" ? "fillViewerAttempts" : "viewerAttempts");
  const attempts = Array.isArray(attemptsRaw) ? attemptsRaw.filter(a => a && typeof a === "object") as LearnerAttempt[] : [];
  const taken = Math.max(attempts.length, Number(record.attemptCount) || 0);
  const adapter = getAssessmentAdapter(record.typeCode);
  const evaluationRaw = storedJson(record.id, adapter?.draftKeys.evaluation ?? "mcqAssessmentEvaluationDraft");
  const legacyAiRaw = adapter?.questionMode === "ai-interview" ? storedJson(record.id, "mcqAssessmentEvaluationDraft") : null;
  const legacyAi = legacyAiRaw && typeof legacyAiRaw === "object" && !Array.isArray(legacyAiRaw) ? legacyAiRaw as Draft : {};
  const evaluation = { ...legacyAi, ...(evaluationRaw && typeof evaluationRaw === "object" && !Array.isArray(evaluationRaw) ? evaluationRaw as Draft : {}) };
  const dropdown = evaluation.dropdownSettings && typeof evaluation.dropdownSettings === "object" && !Array.isArray(evaluation.dropdownSettings) ? evaluation.dropdownSettings as Draft : {};
  const limitValue = [draft.attempts, draft.allowedAttempts, draft.attemptsAllowed, draft.maxAttempts, draft.numberOfAttempts, dropdown.maximumAttempts, evaluation.maxAttempts, evaluation.maximumAttempts, evaluation.attemptsAllowed].find(value => value !== undefined && value !== null && String(value).trim() !== "");
  const maxAttempts = positiveNumber(limitValue);
  const attemptLimitLabel = maxAttempts !== null ? String(maxAttempts) : /^unlimited$/i.test(stringValue(limitValue)) ? "Unlimited" : "Not specified";
  const duration = positiveNumber(draft.duration)
    ?? positiveNumber(stringValue(draft.timeLimit).match(/\d+/)?.[0]);
  const score = stringValue(draft.passingScore || draft.passingMarks || (adapter?.questionMode === "ai-interview" ? evaluation.passingScore : ""));
  const negativeMarking = draft.negativeMarking === false ? "No" : stringValue(draft.negativeMarkingValue) || "Not specified";
  const scheduled = record.status === "Scheduled";
  const completed = Boolean((endAt && now > endAt) || (maxAttempts !== null && taken >= maxAttempts));
  const upcoming = Boolean(scheduled || (startAt && now < startAt));
  const status: LearnerStatus = completed ? "Completed" : upcoming ? "Upcoming" : "Live";
  let schedule = "No availability window set";
  if (startAt && endAt) schedule = `${shortDate(startAt)}, ${clock(startAt)} — ${shortDate(endAt)}, ${clock(endAt)}`;
  else if (startAt) schedule = `Opens ${shortDate(startAt)}, ${clock(startAt)}`;
  else if (endAt) schedule = `Closes ${shortDate(endAt)}, ${clock(endAt)}`;
  return {
    record, status, course: stringValue(draft.course) || record.course || "Course not specified",
    module: stringValue(draft.module) || stringValue(draft.moduleUnit),
    totalQuestions: Number(record.questions) || positiveNumber(draft.questionCount) || 0,
    totalMarks: Number(record.marks) || positiveNumber(draft.totalMarks) || 0,
    duration, passingScore: score ? score.includes("%") ? score : `${score}%` : "Not specified",
    negativeMarking, maxAttempts, attemptLimitLabel, attemptsUsed:taken, attempts, startAt, endAt, schedule,
    mode: "Online" + (duration ? ", timed" : ""), canStart: status === "Live" && record.status === "Published",
  };
}
export function learnerAssessmentsForTenant(records: StoredAssessment[], tenantId: string): LearnerAssessment[] {
  return records
    .filter(record => (record.tenantId || "north") === tenantId && (record.status === "Published" || record.status === "Scheduled"))
    .map(record => learnerAssessmentData(record))
    .sort((a,b) => {
      const order = {Live:0,Upcoming:1,Completed:2};
      return order[a.status] - order[b.status] || (a.endAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.endAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
    });
}

export function maySubmitCurrentAttempt(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("preview") === "true") return true;
  const record = getAssessment(getActiveAssessmentId() || "");
  if (!record || record.status !== "Published") return false;
  const data = learnerAssessmentData(record);
  return data.maxAttempts === null || data.attemptsUsed < data.maxAttempts;
}

export function nextAttemptCount(historyLength: number = 0): number {
  const record = getAssessment(getActiveAssessmentId() || "");
  return Math.max(historyLength, (Number(record?.attemptCount) || 0) + 1);
}
