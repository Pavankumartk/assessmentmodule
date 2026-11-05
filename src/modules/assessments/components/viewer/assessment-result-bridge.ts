/**
 * Read the existing assessment result page's canonical data shape. Legacy creators
 * saved submissions under subtype-specific keys; adapt those results without
 * altering the Result page layout or overwriting an original attempt.
 */
import { assessmentStorage, getActiveAssessmentId, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import { getTextResultRelease, type ReleasePolicy } from "./result-release";

type Data = Record<string, unknown>;
const asData = (value: unknown): Data | null => value && typeof value === "object" && !Array.isArray(value) ? value as Data : null;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const n = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : fallback;
};
const str = (value: unknown, fallback = "") => typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
const text = (value: unknown) => str(asData(value)?.text ?? asData(value)?.label ?? value);
function read(key: string, assessmentId?: string): Data | null {
  try { const raw=assessmentId && typeof window !== "undefined" ? localStorage.getItem(`neurolxp.assessments.draft.v1.${assessmentId}.${key}`) : assessmentStorage.getItem(key); return asData(JSON.parse(raw || "null")); } catch { return null; }
}
function truthy(value: unknown, fallback = true): boolean {
  return value === undefined || value === null || value === "" ? fallback : !["false", "no", "off", "0", "never", "disabled"].includes(String(value).toLowerCase());
}
function fromSettings(draft: Data, ...keys: string[]) {
  const nested = asData(draft.dropdownSettings) || {};
  for (const key of keys) {
    const value = nested[key] ?? draft[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}
export function releaseForAssessment(typeCode: string, pending = 0, assessmentId?: string): ReleasePolicy {
  if (typeCode === "one-word" || typeCode === "short-answer" || typeCode === "long-answer" || typeCode === "fill-in-the-blanks") return getTextResultRelease(typeCode, pending, Date.now(), assessmentId);
  const key: Record<string, string[]> = {
    mcq: ["mcqAssessmentEvaluationDraft"],
    "image-based": ["mcqAssessmentEvaluationDraft", "imageBasedEvaluationDraft", "imageBasedAssessmentEvaluationDraft"],
    "match-the-following": ["mcqAssessmentEvaluationDraft", "matchFollowingEvaluationDraft"],
    "fill-in-the-blanks": ["fillBlanksEvaluationDraft"],
    "true-false": ["trueFalseEvaluationDraft"],
    "long-answer": ["longAnswerEvaluationDraft"],
    "drag-and-drop": ["dragDropEvaluationDraft"],
    "memory-game": ["memoryGameEvaluationDraft"],
  };
  const draft = (key[typeCode] || ["mcqAssessmentEvaluationDraft"]).reduce<Data>((previous, name) => ({ ...previous, ...(read(name, assessmentId) || {}) }), read("mcqAssessmentEvaluationDraft", assessmentId) || {});
  const option = str(fromSettings(draft, "resultAvailable", "reviewAvailability", "resultAvailability", "resultReleaseMode", "releaseMode"), "Immediately").toLowerCase();
  const visible = truthy(fromSettings(draft, "showResults", "showResult", "resultAfter", "showResultAfterSubmission"));
  let mode: ReleasePolicy["mode"] = "immediate";
  if (!visible || /never|not available/.test(option)) mode = "never";
  else if (/manual|instructor|after grad|after moderat/.test(option)) mode = "manual";
  else if (/schedul|after clos|later/.test(option)) mode = "scheduled";
  const date = fromSettings(draft, "scheduledReleaseAt", "resultAvailableAt", "resultReleaseDate", "scheduledReleaseDate", "releaseDate", "closingDate");
  const time = fromSettings(draft, "resultReleaseTime", "scheduledReleaseTime", "releaseTime");
  const when = date ? `${String(date)}${time && /^\d{4}-\d\d-\d\d$/.test(String(date)) ? `T${String(time)}` : ""}` : "";
  const stamp = when ? new Date(when).getTime() : Number.NaN;
  if (mode === "scheduled" && Number.isFinite(stamp) && Date.now() >= stamp) mode = "immediate";
  const showScore = mode === "immediate" && pending === 0 && truthy(fromSettings(draft, "showScore"));
  const showPassFail = showScore && truthy(fromSettings(draft, "showPassFail", "passFail"));
  const showCorrectAnswers = mode === "immediate" && truthy(fromSettings(draft, "showCorrectAnswers"));
  const showExplanation = showCorrectAnswers && truthy(fromSettings(draft, "showExplanation", "showAnswerFeedback"));
  const releaseDateLabel = Number.isFinite(stamp) ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(stamp)) : when || "Release date to be announced";
  const message = mode === "immediate" ? pending ? "Your assessment was submitted. Some answers are awaiting grading." : "Your assessment has been submitted. Your result is available now."
    : mode === "scheduled" ? "Your Assessment Has Been Submitted Successfully. Your Result Will Be Released At The Scheduled Time."
    : mode === "manual" ? "Your Assessment Has Been Submitted Successfully. Your Instructor Will Review And Release Your Result."
    : "Your Assessment Has Been Submitted Successfully. Your Result Is Not Available For Student Viewing.";
  return { mode, releaseDateLabel, showScore, showPassFail, showCorrectAnswers, showExplanation, message };
}

type StandardQuestion = {
  id?: string; sourceIndex?: number; text: string; options: string[]; correct: number; selected: number | null;
  questionType?: "short-answer"; answerText?: string; expectedAnswer?: string; gradingStatus: "correct" | "incorrect" | "unanswered" | "pending";
  points: number; flagged?: boolean; hint?: string; explanation?: string;
};
function finish(type: string, original: Data, questions: StandardQuestion[]): Data {
  const correct = questions.filter(q => q.gradingStatus === "correct").length;
  const incorrect = questions.filter(q => q.gradingStatus === "incorrect").length;
  const unanswered = questions.filter(q => q.gradingStatus === "unanswered").length;
  const pending = questions.filter(q => q.gradingStatus === "pending").length;
  const totalMarks = n(original.totalMarks, questions.reduce((s, q) => s + q.points, 0));
  // Preserve a subtype's own partial-credit calculation when provided.
  const earnedMarks = n(original.earnedMarks ?? original.score, questions.filter(q => q.gradingStatus === "correct").reduce((s, q) => s + q.points, 0));
  const active = getActiveAssessmentId();
  const title = str(original.title, active ? getAssessment(active)?.title || "Assessment" : "Assessment");
  return {
    assessmentType: type, title, questions, totalQuestions: questions.length, correctAnswers: correct,
    incorrectAnswers: incorrect, unanswered, pendingCount: pending, totalMarks, earnedMarks,
    scorePercent: pending ? null : n(original.scorePercent, totalMarks ? Math.round(earnedMarks / totalMarks * 100) : 0),
    flaggedQuestionIndexes: list(original.flaggedQuestionIndexes ?? original.flagged).map(v => n(v, -1)).filter(i => i >= 0),
    totalSeconds: n(original.totalSeconds, 3600), usedSeconds: n(original.usedSeconds, 0),
    retryAttemptsUsed: n(original.retryAttemptsUsed, 1), retryAttemptsAllowed: n(original.retryAttemptsAllowed, 2),
    retryDurationMinutes: n(original.retryDurationMinutes, 15), submittedAt: original.submittedAt,
  };
}
/** Returns only real saved attempts—never an invented demo result. */
export function readAssessmentResult(): Data | null {
  const canonical = read("viewerAssessmentResult");
  if (canonical && Array.isArray(canonical.questions) && canonical.questions.length) return canonical;
  const type = getAssessment(getActiveAssessmentId() || "")?.typeCode || "mcq";
  const alternatives: Record<string, string[]> = {
    "fill-in-the-blanks": ["fillBlanksViewerResult"],
    "match-the-following": ["matchFollowingViewerResult"],
    "image-based": ["imageBasedViewerResult"],
    "true-false": ["trueFalseViewerResult"],
    "memory-game": ["memoryGameViewerResult"],
    "drag-and-drop": ["dragDropViewerResult"],
    "long-answer": ["longAnswerViewerResult"],
    "short-answer": ["shortAnswerViewerResult"],
    "one-word": ["oneWordViewerResult"],
  };
  for (const key of alternatives[type] || []) {
    const saved = read(key);
    if (!saved) continue;
    const rawQuestions = list(saved.questions);
    if (rawQuestions.length && (type === "long-answer" || type === "short-answer" || type === "one-word")) {
      // These text viewers already save a canonical result shape.
      return saved;
    }
    if (type === "fill-in-the-blanks" && rawQuestions.length) {
      const answers = asData(saved.answers) || {};
      const entries: StandardQuestion[] = rawQuestions.map((raw, index) => {
        const q = asData(raw) || {};
        const right = list(q.blankCorrect).map(v => n(v, -1));
        const opts = list(q.options).map(text);
        const chosen = list(answers[index]);
        const answered = right.length > 0 && right.every((_, i) => n(chosen[i], -1) >= 0);
        const correct = answered && right.every((v, i) => v === n(chosen[i], -1));
        const yourText = chosen.map((v,i) => `Blank ${i + 1}: ${opts[n(v, -1)] || "Unanswered"}`).join("; ");
        const expected = right.map((v,i) => `Blank ${i + 1}: ${opts[v] || "—"}`).join("; ");
        return { sourceIndex: index, text: text(q.text), options: [], correct: -1, selected: null,
          questionType: "short-answer", answerText: yourText || "Not answered", expectedAnswer: expected,
          gradingStatus: !answered ? "unanswered" : correct ? "correct" : "incorrect", points: n(q.points, 1),
          flagged: list(saved.flagged).includes(index), hint: str(q.hint), explanation: str(q.explanation) };
      });
      return finish(type, saved, entries);
    }
    if (type === "match-the-following" && rawQuestions.length) {
      const entries: StandardQuestion[] = rawQuestions.map((raw, index) => {
        const q = asData(raw) || {};
        const expected = list(q.correct).map(v => n(v, -1));
        const selected = list(q.selected).map(v => n(v, -1));
        const terms = list(q.terms).map(text);
        const opts = list(q.options).map(text);
        const answered = expected.length > 0 && selected.length >= expected.length && selected.every(v => v >= 0);
        const correct = answered && expected.every((v, i) => v === selected[i]);
        return { sourceIndex: index, text: text(q.text), options: [], correct: -1, selected: null,
          questionType: "short-answer", answerText: terms.map((v,i) => `${v}: ${opts[selected[i]] || "Unanswered"}`).join("; "),
          expectedAnswer: terms.map((v,i) => `${v}: ${opts[expected[i]] || "—"}`).join("; "),
          gradingStatus: !answered ? "unanswered" : correct ? "correct" : "incorrect", points: n(q.points, 1),
          flagged: list(saved.flagged).includes(index), hint: str(q.hint), explanation: str(q.explanation) };
      });
      return finish(type, saved, entries);
    }
    if (type === "image-based") {
      const creator = read("imageBasedContentDraft") || {};
      const originals = list(creator.questions);
      if (!originals.length) continue;
      const answers = asData(saved.answers) || {};
      const entries: StandardQuestion[] = originals.map((raw, index) => {
        const q = asData(raw) || {};
        const options = list(q.options).map(text);
        const correct = n(q.correct, -1);
        const selection = answers[str(q.id)] ?? answers[index];
        const selected = Array.isArray(selection) ? n(selection[0], -1) : selection == null ? -1 : n(selection, -1);
        const status = selected < 0 ? "unanswered" : selected === correct ? "correct" : "incorrect";
        return { id: str(q.id), sourceIndex: index, text: text(q.text), options, correct, selected: selected < 0 ? null : selected,
          gradingStatus: status, points: n(q.points, 1), hint: str(q.hint), explanation: str(q.explanation) };
      });
      return finish(type, { ...saved, totalMarks: saved.maxScore ?? saved.totalMarks, earnedMarks: saved.score ?? saved.earnedMarks }, entries);
    }
    if (rawQuestions.length) return saved;
  }
  return null;
}
