import { assessmentStorage } from "@/modules/assessments/storage/assessment-storage";

export const IMAGE_CONTENT_KEY = "imageBasedContentDraft";
export const IMAGE_RESULT_KEY = "imageBasedViewerResult";
export type ImageMatchPair = { text: string; image: string };
export type ImageSubtype = "multiple-choice" | "image-matching" | "image-labeling" | "image-dropdown" | "image-sequencing" | "image-sorting";
export type ImageSortingItem = { id:string; image:string; text:string; group:string };
export const newSortingItem = ():ImageSortingItem => ({ id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, image:"", text:"", group:"" });
export type ImageSequenceStep = { id: string; image: string; text: string };
export const newSequenceStep = (): ImageSequenceStep => ({ id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, image: "", text: "" });
export type ImageDropdownChoice = { id: string; text: string; correct: boolean };
export type ImageDropdownSpot = { id: string; x: number; y: number; choices: ImageDropdownChoice[] };
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
export const newDropdownChoice = (text = "", correct = false): ImageDropdownChoice => ({ id: makeId(), text, correct });
export const newDropdownSpot = (x: number, y: number): ImageDropdownSpot => ({ id: makeId(), x, y, choices: [newDropdownChoice(), newDropdownChoice()] });
/** Percentage coordinates keep pin positions correct when the diagram resizes. */
export type ImageLabelPin = { id: string; label: string; x: number; y: number };
export const newLabelPin = (x: number, y: number): ImageLabelPin => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  label: "", x, y,
});
export type ImageOption = { text: string; image: string; explanation?: string };
export type ImageQuestion = {
  id: string; text: string; image: string; options: ImageOption[]; correct: number;
  galleryImages?: string[]; // Image-Based MCQ: 4 uploaded image slots; image remains the selected picture.
  points: number; difficulty: string; category: string; bloom: string;
  tags: string[]; mandatory: boolean; grading: string;
  feedback: string; hint: string; explanation: string;
  allowMultiple?: boolean; correctAnswers?: number[]; shuffleOptions?: boolean;
  gradingMethod?: string; negativeMarking?: number; minimumZero?: boolean;
  feedbackFull?: string; feedbackPartial?: string; feedbackZero?: string;
  showHintBefore?: boolean; allowHintRequest?: boolean;
  subtype?: ImageSubtype; matchPairs?: ImageMatchPair[]; matchExtras?: string[]; shuffleTexts?: boolean;
  labelPins?: ImageLabelPin[]; labelExtras?: string[]; shuffleLabels?: boolean;
  dropdownSpots?: ImageDropdownSpot[]; shuffleDropdowns?: boolean;
  sequenceSteps?: ImageSequenceStep[]; shuffleSteps?: boolean;
  sortingItems?: ImageSortingItem[]; sortingGroups?: string[]; shuffleSorting?: boolean;
};
export type ImageDraft = { questions: ImageQuestion[]; active: number; savedAt?: string };
export const newImageQuestion = (): ImageQuestion => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
  text: "", image: "", options: Array.from({ length: 4 }, () => ({ text: "", image: "" })),
  correct: -1, points: (() => {const d=imageDetails(); const average=d.totalMarks/d.count;return Number.isInteger(average) && average>0 ? average : 1;})(), difficulty: "", category: "", bloom: "",
  tags: [], mandatory: true, grading: "Automatic", feedback: "", hint: "", explanation: "",
  allowMultiple: false, correctAnswers: [], shuffleOptions: true, gradingMethod: "Partial credit - equal marks",
  negativeMarking: 0, minimumZero: true, feedbackFull: "", feedbackPartial: "", feedbackZero: "",
  showHintBefore: true, allowHintRequest: false, subtype: "multiple-choice",
});
export const newImageMatchPair = (): ImageMatchPair => ({ text: "", image: "" });
export function imageCorrectIndices(q: ImageQuestion): number[] {
  if (q.allowMultiple) return [...new Set((q.correctAnswers?.length ? q.correctAnswers : q.correct >= 0 ? [q.correct] : []).filter(n => Number.isInteger(n) && n >= 0 && n < q.options.length))];
  return q.correct >= 0 && q.correct < q.options.length ? [q.correct] : [];
}
export function imageQuestionValid(q: ImageQuestion): boolean {
  if (q.subtype === "image-sorting") {
    if (!q.text?.trim() || !Number.isFinite(q.points) || q.points <= 0) return false;
    const groups=q.sortingGroups||["Hardware","Software"];
    if (groups.length < 2 || groups.length>4 || groups.some(g=>!g.trim())) return false;
    if (new Set(groups.map(g=>g.trim().toLowerCase())).size!==groups.length) return false;
    const items=q.sortingItems||[];
    if (items.length < 2 || items.length>6) return false;
    if (!items.every(item=>item.id && item.image && item.text?.trim() && groups.includes(item.group))) return false;
    return new Set(items.map(item=>item.id)).size===items.length && new Set(items.map(item=>item.text.trim().toLowerCase())).size===items.length;
  }
  if (q.subtype === "image-sequencing") {
    if (!q.text?.trim() || !Number.isFinite(q.points) || q.points <= 0) return false;
    const steps = q.sequenceSteps || [];
    if (steps.length < 2 || steps.length > 6) return false;
    if (!steps.every(step => step.id && step.text?.trim() && step.image)) return false;
    const ids = steps.map(step=>step.id);
    const names = steps.map(step=>step.text.trim().toLowerCase());
    return new Set(ids).size === steps.length && new Set(names).size === steps.length;
  }
  if (q.subtype === "image-dropdown") {
    if (!q.text?.trim() || !q.image || !Number.isFinite(q.points) || q.points <= 0) return false;
    const spots = q.dropdownSpots || [];
    if (spots.length < 1 || spots.length > 5) return false;
    const ids = spots.map(spot => spot.id);
    if (new Set(ids).size !== ids.length) return false;
    return spots.every(spot => {
      if (![spot.x, spot.y].every(Number.isFinite) || spot.x < 0 || spot.x > 100 || spot.y < 0 || spot.y > 100) return false;
      if (!Array.isArray(spot.choices) || spot.choices.length < 2 || spot.choices.length > 6) return false;
      if (spot.choices.filter(choice => choice.correct).length !== 1 || spot.choices.some(choice => !choice.text?.trim())) return false;
      const words = spot.choices.map(choice => choice.text.trim().toLowerCase());
      return new Set(words).size === words.length;
    });
  }
  if (q.subtype === "image-labeling") {
    if (!q.text?.trim() || !q.image || !Number.isFinite(q.points) || q.points <= 0) return false;
    const pins = q.labelPins || [];
    if (pins.length < 2 || pins.length > 6) return false;
    if (!pins.every(pin => pin.label?.trim() && Number.isFinite(pin.x) && Number.isFinite(pin.y) && pin.x >= 0 && pin.x <= 100 && pin.y >= 0 && pin.y <= 100)) return false;
    if ((q.labelExtras || []).length > 6 || (q.labelExtras || []).some(s => !s.trim())) return false;
    const labels = [...pins.map(pin => pin.label.trim().toLocaleLowerCase()), ...(q.labelExtras || []).map(s => s.trim().toLocaleLowerCase())];
    return new Set(labels).size === labels.length;
  }
  if (q.subtype === "image-matching") {
    if (!q.text?.trim() || !Number.isFinite(q.points) || q.points <= 0) return false;
    const rows = q.matchPairs || [];
    if (rows.length < 2 || rows.length > 6) return false;
    if (!rows.every(row => !!row.text.trim() && !!row.image)) return false;
    const labels = [...rows.map(row => row.text.trim().toLowerCase()), ...(q.matchExtras || []).filter(Boolean).map(t => t.trim().toLowerCase())];
    return new Set(labels).size === labels.length;
  }
  if (!q.text?.trim() || !q.image || !Array.isArray(q.options) || q.points <= 0) return false;
  const completed = q.options.map((o,i) => o.text?.trim() || o.image ? i : -1).filter(i => i >= 0);
  if (completed.length < 2) return false;
  const selected = imageCorrectIndices(q);
  return selected.length > 0 && selected.every(i => completed.includes(i));
}
export function imageGrade(q: ImageQuestion, response: number[]): number {
  const correct = imageCorrectIndices(q);
  if (!correct.length) return 0;
  const selected = [...new Set(response)];
  if (!selected.length) return 0;
  if (selected.length === correct.length && selected.every(i => correct.includes(i))) return q.points;
  if (q.allowMultiple && q.gradingMethod?.startsWith("Partial credit")) {
    const rightCount = selected.filter(i => correct.includes(i)).length;
    const wrongCount=selected.length-rightCount;
    const penalty=Number(q.negativeMarking)||0;
    const tentative=rightCount ? q.points*(rightCount-wrongCount)/correct.length : -penalty;
    return q.minimumZero === false ? tentative : Math.max(0,tentative);
  }
  const penalty = Number(q.negativeMarking) || 0;
  return q.minimumZero === false ? -penalty : Math.max(0, -penalty);
}
export function imageQuestionStarted(q: ImageQuestion): boolean {
  if (q.subtype === "image-sorting") return Boolean(q.text?.trim() || q.sortingItems?.some(item=>item.text?.trim() || item.image || item.group));
  if (q.subtype === "image-sequencing") return Boolean(q.text?.trim() || q.image || q.sequenceSteps?.some(step => step.text?.trim() || step.image));
  if (q.subtype === "image-dropdown") return Boolean(q.text?.trim() || q.image || q.dropdownSpots?.length);
  if (q.subtype === "image-labeling") return Boolean(q.text?.trim() || q.image || q.labelPins?.length || q.labelExtras?.some(Boolean));
  if (q.subtype === "image-matching") return Boolean(q.text.trim() || q.matchPairs?.some(x => x.text.trim() || x.image) || q.matchExtras?.some(Boolean));
  return Boolean(q.text.trim() || q.image || q.options.some(x => x.text.trim() || x.image));
}
export function readImageDraft(): ImageDraft {
  try {
    const raw = assessmentStorage.getItem(IMAGE_CONTENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ImageDraft>;
      if (Array.isArray(parsed.questions)) return { questions: parsed.questions, active: Number(parsed.active) || 0 };
    }
  } catch { /* Keep a clean draft if browser storage is unavailable. */ }
  return { questions: [newImageQuestion()], active: 0 };
}
export function imageDetails(): { count: number; totalMarks: number; title: string; course: string; passingScore: number } {
  let details: Record<string, unknown> = {};
  try { details = JSON.parse(assessmentStorage.getItem("mcqAssessmentDraft") || "{}"); } catch { /* default */ }
  const int = (value: unknown, fallback: number) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback; };
  return {
    count: int(details.questionCount ?? assessmentStorage.getItem("mcqQuestionCount"), 20),
    totalMarks: int(details.totalMarks, 40),
    title: String(details.assessmentTitle || details.title || "Image-Based Assessment"),
    course: String(details.course || details.courseName || ""),
    passingScore: int(details.passingScore ?? details.passingMarks, 60),
  };
}

export const IMAGE_ANSWERS_KEY = "imageBasedViewerAnswers";
export type ImageResult = {
  assessmentId: string;
  answers: Record<string, number | number[]>;
  score: number;
  maxScore: number;
  correctCount: number;
  questionCount: number;
  submittedAt: string;
};
