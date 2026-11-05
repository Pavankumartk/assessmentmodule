export type MemoryPair = { id: string; left: string; right: string; leftImage?: string; rightImage?: string };
export type MemoryQuestion = {
  id: string; type: "Memory Game"; text: string; image: string; pairs: MemoryPair[];
  points: string; difficulty: string; category: string; bloom: string; mandatory: boolean; tags: string[];
  shuffle: boolean; showCardsSeconds: string; grading: "All or Nothing" | "Partial Credit";
  feedbackFull: string; feedbackPartial: string; feedbackZero: string; explanation: string; hint: string;
  // Optional Memory Game-only settings; older saved drafts remain compatible.
  columns?: string; cardBackColor?: string; flipBackDelay?: string; timeLimit?: string;
  maximumMoves?: string; showMoveCounter?: boolean; showTimer?: boolean;
  clicksCountWrong?: boolean; minimumScoreZero?: boolean; showHintBefore?: boolean; allowHintRequest?: boolean;
  negativeMarking?: string;
};
export const makePair = (n: number): MemoryPair => ({
  id: `pair-${n}-${Math.random().toString(36).slice(2, 8)}`, left: "", right: "", leftImage: "", rightImage: ""
});
export const makeQuestion = (marks = 1): MemoryQuestion => ({
  id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: "Memory Game",
  text: "", image: "", pairs: [makePair(1), makePair(2)], points: String(marks),
  difficulty: "", category: "", bloom: "", mandatory: true, tags: [],
  shuffle: true, showCardsSeconds: "2", grading: "All or Nothing",
  feedbackFull: "", feedbackPartial: "", feedbackZero: "", explanation: "", hint: "",
  columns: "Auto", cardBackColor: "Blue", flipBackDelay: "1000", timeLimit: "0",
  maximumMoves: "0", showMoveCounter: true, showTimer: true,
  clicksCountWrong: true, minimumScoreZero: true, showHintBefore: true, allowHintRequest: false,
  negativeMarking: "NA"
});
export const memoryErrors = (q: MemoryQuestion): string[] => {
  const issues: string[] = [];
  if (!q.text.trim()) issues.push("Write the question or game instruction.");
  if (q.text.length > 250) issues.push("Question text cannot exceed 250 characters.");
  if (q.pairs.length < 2) issues.push("Add at least two pairs of game cards.");
  if (q.pairs.some(p => !p.left.trim() && !p.leftImage)) issues.push("Enter text or an image for each first card.");
  if (q.pairs.some(p => !p.right.trim() && !p.rightImage)) issues.push("Enter text or an image for each matching card.");
  if (!(Number(q.points) > 0)) issues.push("Points must be greater than zero.");
  if (!q.difficulty) issues.push("Select a difficulty.");
  if (!q.category) issues.push("Select a category.");
  if (!q.bloom) issues.push("Select Bloom's Taxonomy.");
  return issues;
};
export const isMemoryComplete = (q: MemoryQuestion) => memoryErrors(q).length === 0;
export function readMemoryQuestions(raw: unknown): MemoryQuestion[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];
  return list.filter(v => v && typeof v === "object").map(v => {
    const q = v as Partial<MemoryQuestion>;
    return { ...makeQuestion(), ...q, pairs: Array.isArray(q.pairs) ? q.pairs : [], tags: Array.isArray(q.tags) ? q.tags : [] };
  });
}
