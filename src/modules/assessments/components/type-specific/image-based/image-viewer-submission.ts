import {maySubmitCurrentAttempt,nextAttemptCount} from "@/modules/assessments/components/learner/learner-assessment-data";
/** Shared MCQ-compatible result and retry storage for the four supplied Image-Based viewers. */
import { assessmentStorage, getActiveAssessmentId, getAssessment, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
import type { ReleasePolicy } from "@/modules/assessments/components/viewer/result-release";

export type ImageViewerSubtype = "multiple-choice" | "image-matching" | "image-sequencing" | "image-sorting" | "image-labeling" | "image-dropdown";
export type ImageViewerResultQuestion = {
  id: string;
  text: string;
  options: string[];
  correct: number;
  selected: number | null;
  points: number;
  earnedMarks: number;
  hint?: string;
  bloom?: string;
  flagged?: boolean;
  explanation?: string;
};

function record(key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(assessmentStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}
function setting(data: Record<string, unknown>, ...keys: string[]) {
  const nested = data.dropdownSettings;
  const menu = nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Record<string, unknown> : {};
  for (const key of keys) {
    const value = menu[key] ?? data[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
function enabled(value: unknown, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  return !["off", "false", "no", "0", "never", "disabled"].includes(String(value).trim().toLowerCase());
}
/** Image-Based creator Evaluation uses the same availability fields as MCQ Evaluation. */
export function imageViewerRelease(): ReleasePolicy {
  const data = { ...record("mcqAssessmentEvaluationDraft"), ...record("imageBasedAssessmentEvaluationDraft"), ...record("imageBasedEvaluationDraft") };
  const raw = String(setting(data, "reviewAvailability", "resultAvailable", "resultAvailability", "resultReleaseMode", "releaseMode") ?? "Immediately").toLowerCase();
  const visible = enabled(setting(data, "resultAfter", "showResult", "showResults", "showResultAfterSubmission"));
  let mode: ReleasePolicy["mode"] = "immediate";
  if (!visible || /never|not available/.test(raw)) mode = "never";
  else if (/schedul|after clos|later/.test(raw)) mode = "scheduled";
  else if (/manual|after grad|after moderat|instructor/.test(raw)) mode = "manual";
  const date = setting(data, "resultReleaseDate", "scheduledReleaseDate", "resultAvailableDate", "releaseDate", "scheduledDate", "resultDate", "resultAvailableAt", "scheduledReleaseAt", "releaseAt");
  const time = setting(data, "resultReleaseTime", "scheduledReleaseTime", "resultAvailableTime", "releaseTime", "scheduledTime", "resultTime");
  const stamp = date ? `${String(date)}${time && /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? `T${String(time)}` : ""}` : "";
  const releaseTimestamp = Date.parse(stamp);
  if (mode === "scheduled" && Number.isFinite(releaseTimestamp) && releaseTimestamp <= Date.now()) mode = "immediate";
  const releaseDateLabel = stamp ? (Number.isFinite(releaseTimestamp) ? new Intl.DateTimeFormat("en-GB", {dateStyle:"medium",timeStyle:"short"}).format(new Date(releaseTimestamp)) : stamp) : "Release date to be announced";
  const showScore = mode === "immediate" && enabled(setting(data, "showScore"));
  const showPassFail = mode === "immediate" && enabled(setting(data, "showPassFail", "passFail"));
  const showCorrectAnswers = mode === "immediate" && enabled(setting(data, "showCorrectAnswers", "correctAnswers"));
  const showExplanation = showCorrectAnswers && enabled(setting(data, "showExplanation", "explanation"));
  const message = mode === "immediate" ? "Your assessment has been submitted. Your result is available now."
    : mode === "scheduled" ? "Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time."
    : mode === "manual" ? "Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result."
    : "Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing.";
  return { mode, releaseDateLabel, showScore, showPassFail, showCorrectAnswers, showExplanation, message };
}

export function imageViewerPassingScore(): string {
  const data = { ...record("mcqAssessmentEvaluationDraft"), ...record("imageBasedAssessmentEvaluationDraft"), ...record("imageBasedEvaluationDraft") };
  const number = Number.parseFloat(String(setting(data, "passingScore", "passingPercentage", "minimumPassingScore") ?? "60"));
  return `${Number.isFinite(number) && number >= 0 && number <= 100 ? number : 60}%`;
}

export function isImageViewerRetry(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("retry") === "wrong";
}
/** The existing Results page puts incorrect original result questions into viewerRetryQuestions. */
export function applyImageViewerRetry<T extends {id:string}>(questions: T[], subtype: ImageViewerSubtype, durationSeconds: number): { questions: T[]; durationSeconds: number } {
  if (!isImageViewerRetry()) return { questions, durationSeconds };
  let wrong: Array<{id?:unknown;imageSubtype?:unknown}> = [];
  try { const raw:unknown = JSON.parse(assessmentStorage.getItem("viewerRetryQuestions") || "[]"); if (Array.isArray(raw)) wrong = raw; } catch { /* Invalid previous retry; do not replace creator data. */ }
  const ids = new Set(wrong.filter(q => q?.imageSubtype === subtype && typeof q.id === "string").map(q => q.id as string));
  const filtered = questions.filter(q => ids.has(q.id));
  const minutes = Number(assessmentStorage.getItem("viewerRetryDurationMinutes"));
  return { questions: filtered, durationSeconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : durationSeconds };
}

/** Persist results in the SAME shape/assessment-scoped key as the original MCQ Results and Retry pages. */
export function saveImageViewerSubmission(input: {
  title: string;
  subtype: ImageViewerSubtype;
  questions: ImageViewerResultQuestion[];
  durationSeconds: number;
  secondsRemaining: number;
  retry: boolean;
}): boolean {
  if (!maySubmitCurrentAttempt()) return false;
  const totalMarks = input.questions.reduce((sum,q) => sum + q.points, 0);
  const earnedMarks = input.questions.reduce((sum,q) => sum + q.earnedMarks, 0);
  const formatted = input.questions.map(q => ({
    ...q,
    imageSubtype: input.subtype,
    correct: q.correct,
    selected: q.selected,
    gradingStatus: q.selected === null ? "unanswered" : q.selected === q.correct ? "correct" : "incorrect",
    topic: q.bloom || "Image-Based",
  }));
  const correctAnswers = formatted.filter(q => q.gradingStatus === "correct").length;
  const incorrectAnswers = formatted.filter(q => q.gradingStatus === "incorrect").length;
  const unanswered = formatted.length - correctAnswers - incorrectAnswers;
  const previous = record("viewerAssessmentResult");
  const result = {
    attemptId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
    title: input.title,
    assessmentType: "image-based",
    imageSubtype: input.subtype,
    questions: formatted,
    totalQuestions: formatted.length,
    correctAnswers, incorrectAnswers, unanswered,
    totalMarks, earnedMarks,
    scorePercent: totalMarks ? Math.round(earnedMarks / totalMarks * 100) : 0,
    totalSeconds: input.durationSeconds,
    usedSeconds: Math.max(0, input.durationSeconds - input.secondsRemaining),
    flaggedQuestionIndexes: formatted.flatMap((q,index) => q.flagged ? [index] : []),
    retryAttemptsUsed: input.retry ? Number(previous.retryAttemptsUsed) || 2 : 1,
    retryAttemptsAllowed: Number(previous.retryAttemptsAllowed) || 2,
    retryDurationMinutes: Number(previous.retryDurationMinutes) || 15,
    submittedAt: new Date().toISOString(),
  };
  try {
    if (input.retry) {
      // A retry must not overwrite the original test's score (MCQ behavior).
      assessmentStorage.setItem("viewerRetryResult", JSON.stringify(result));
    } else {
      assessmentStorage.setItem("viewerAssessmentResult", JSON.stringify(result));
    }
    {
      const stored = assessmentStorage.getItem("viewerAttempts");
      let attempts: unknown = [];
      try { attempts = JSON.parse(stored || "[]"); } catch { /* Empty previous attempts. */ }
      const next = [...(Array.isArray(attempts) ? attempts : []), result];
      assessmentStorage.setItem("viewerAttempts", JSON.stringify(next));
      assessmentStorage.setItem("viewerAttemptDraft", JSON.stringify({finished:true}));
      const id = getActiveAssessmentId();
      const assessment = id ? getAssessment(id) : undefined;
      if (assessment) updateAssessment({attemptCount: nextAttemptCount(next.length)});
    }
    return true;
  } catch { return false; }
}
