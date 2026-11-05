/** Evaluation-driven visibility for a learner's submission. Browser storage is scoped to assessmentId. */
import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";
import type { TextMode } from "./text-assessment-result";

export type ReleaseMode = "immediate" | "scheduled" | "manual" | "never";
export type ReleasePolicy = {
  mode: ReleaseMode;
  releaseDateLabel: string;
  showScore: boolean;
  showPassFail: boolean;
  showCorrectAnswers: boolean;
  showExplanation: boolean;
  message: string;
};
type Settings = Record<string, unknown>;
function read(key: string, assessmentId?: string): Settings {
  try { const raw = assessmentId && typeof window !== "undefined" ? localStorage.getItem(`neurolxp.assessments.draft.v1.${assessmentId}.${key}`) : assessmentStorage.getItem(key); const parsed: unknown = JSON.parse(raw || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Settings : {}; }
  catch { return {}; }
}
function truthy(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  return !["false", "off", "no", "0", "never", "disabled"].includes(String(value).trim().toLowerCase());
}
function pick(data: Settings, ...keys: string[]): unknown {
  const nested = data.dropdownSettings;
  const dropdown = nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Settings : {};
  for (const key of keys) {
    const value = dropdown[key] ?? data[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
function formatDate(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(parsed);
}
/** The evaluation's explicit release choice wins over inferred grading status.
 *  "Manually" and "After Grading" stay blocked until an actual release workflow exists.
 *  "After Closing" stays blocked unless a real closing timestamp was saved.
 */
export function getTextResultRelease(type: TextMode | "fill-in-the-blanks", pendingCount = 0, now = Date.now(), assessmentId?: string): ReleasePolicy {
  const common = read("mcqAssessmentEvaluationDraft", assessmentId);
  const specific = type === "one-word"
    ? {...read("oneWordEvaluationDraft", assessmentId), ...read("neurolxp-one-word-evaluation", assessmentId)}
    : type === "fill-in-the-blanks" ? read("fillBlanksEvaluationDraft", assessmentId) : type === "long-answer" ? read("longAnswerEvaluationDraft", assessmentId) : read("shortAnswerEvaluationDraft", assessmentId);
  const data = {...common, ...specific};
  const choice = String(pick(data, "resultAvailable", "reviewAvailability", "resultAvailability", "resultReleaseMode") ?? "Immediately").trim().toLowerCase();
  const enabled = truthy(pick(data, "showResult", "showResults", "resultAfter", "showResultAfterSubmission"), true);
  let mode: ReleaseMode = "immediate";
  if (!enabled || /never|not available/.test(choice)) mode = "never";
  else if (/scheduled|after clos|later/.test(choice)) mode = "scheduled";
  else if (/manual|after grad|after moderat|instructor/.test(choice)) mode = "manual";
  const closing = pick(data, "scheduledReleaseAt", "resultAvailableAt", "resultReleaseDate", "scheduledReleaseDate", "releaseDate", "closingDate", "endDate", "closeDate");
  const time = pick(data, "resultReleaseTime", "scheduledReleaseTime", "releaseTime", "closingTime");
  const when = closing ? `${String(closing)}${time && /^\d{4}-\d{2}-\d{2}$/.test(String(closing)) ? `T${time}` : ""}` : "";
  const stamp = when ? new Date(when).getTime() : Number.NaN;
  if (mode === "scheduled" && Number.isFinite(stamp) && now >= stamp) mode = "immediate";
  const marksSetting = String(pick(data,"releaseMarks") ?? "Immediately").toLowerCase();
  const marksAllowed = !(/manual|moderat/.test(marksSetting) || (/after grad/.test(marksSetting) && pendingCount > 0));
  const showScore = mode === "immediate" && truthy(pick(data,"showScore"),true) && marksAllowed && pendingCount === 0;
  const showPassFail = mode === "immediate" && truthy(pick(data,"showPassFail","passFail"),true) && pendingCount === 0 && marksAllowed;
  const feedbackTiming = String(pick(data,"feedbackTiming") ?? "After").toLowerCase();
  const feedbackAllowed = !/never/.test(feedbackTiming) && (!/after clos/.test(feedbackTiming) || (Number.isFinite(stamp) && now >= stamp));
  const showCorrectAnswers = mode === "immediate" && truthy(pick(data,"showCorrectAnswers","correctAnswers"),true) && feedbackAllowed;
  const showExplanation = showCorrectAnswers && truthy(pick(data,"showExplanation","explanation"),true) && truthy(pick(data,"showAnswerFeedback","answerFeedback"),true);
  const releaseDateLabel = when ? formatDate(when) : "Release date to be announced";
  const message = mode === "immediate"
    ? pendingCount > 0 ? "Your assessment has been submitted. Some answers are awaiting grading." : "Your assessment has been submitted. Your result is available now."
    : mode === "scheduled" ? "Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time."
    : mode === "manual" ? "Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result."
    : "Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing.";
  return {mode, releaseDateLabel, showScore, showPassFail, showCorrectAnswers, showExplanation, message};
}
