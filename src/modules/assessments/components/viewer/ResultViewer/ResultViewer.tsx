"use client";
import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";

import { assessmentStorage, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import "./viewresult.css";
import {releaseForAssessment, readAssessmentResult} from "../assessment-result-bridge";
import {getActiveAssessmentId,getAssessment} from "@/modules/assessments/storage/assessment-storage";
import {learnerAssessmentData} from "@/modules/assessments/components/learner/learner-assessment-data";

const ICONS = "/assets/viewericons/";

type ResultQuestion = {
  text: string;
  sourceIndex?: number;
  options: string[];
  correct: number;
  selected: number | null;
  answerText?: string | null;
  expectedAnswer?: string;
  questionType?: "mcq" | "short-answer" | "one-word";
  gradingStatus?: "correct" | "incorrect" | "pending" | "unanswered";
  points: number;
  hint?: string;
  explanation?: string;
  optionExplanations?: string[];
  topic?: string;
  bloom?: string;
  skill?: string;
  difficulty?: string;
  flagged?: boolean;
};
type ReviewFilter = "all" | "correct" | "incorrect" | "pending" | "unanswered" | "flagged";
type RevisionSort = "question-asc" | "question-desc" | "topic-asc" | "topic-desc" | "status-asc" | "status-desc";
const REVISION_PAGE_SIZE = 5;
type ReviewStatus = "correct" | "incorrect" | "pending" | "unanswered";
const getReviewStatus = (q:ResultQuestion):ReviewStatus => q.gradingStatus || (q.selected === null || q.selected === undefined ? "unanswered" : q.correct >= 0 && q.selected === q.correct ? "correct" : "incorrect");
const exampleQuestion: ResultQuestion = {
  text: "Which Of The Following Data Structure Follows The LIFO (Last In, First Out) Principle?",
  options: ["Stack", "Queue", "Array", "Linked List"], correct: 0, selected: 0, points: 1,
  topic: "Data Structure", bloom: "Understand", skill: "LIFO / Stack Operations", difficulty: "Easy",
  hint: "A Stack is a linear data structure that follows the LIFO (Last in, First Out) Principle. The last element added to the stack is the first one to be removed.",
  explanation: "A Stack is a linear data structure that follows the LIFO (Last in, First Out) Principle. The last element added to the stack is the first one to be removed.",
  optionExplanations: ["Follows LIFO", "Follows FIFO", "Does not inherently follow LIFO", "Can support different access patterns"],
};
const previewReviewQuestions: ResultQuestion[] = Array.from({length:20},(_,i) => {
  if (i === 0) return exampleQuestion;
  const demos = [
    { text:"Which type of learning uses labeled training data?", topic:"AI Basics", options:["Supervised learning","Unsupervised learning","Reinforcement learning","None of these"], correct:0 },
    { text:"What is the purpose of a training dataset?", topic:"ML", options:["Train a model","Store passwords","Host a web page","Encrypt a file"], correct:0 },
    { text:"Which algorithm is commonly used for classification?", topic:"Algorithms", options:["Decision tree","Sorting algorithm","Binary search","Compression"], correct:0 },
  ];
  const d = demos[(i - 1) % demos.length];
  const selected = [2, 18].includes(i) ? 1 : [14, 17].includes(i) ? null : 0;
  return {...d, selected, flagged: i === 12 || i === 14, points:1, bloom:"Understand", skill:"Concepts", difficulty:"Easy", explanation:"The correct answer is " + d.options[d.correct] + "."};
});

type SavedResult = {
  title?: string;
  questions?: ResultQuestion[];
  assessmentType?: "mcq" | "short-answer" | "one-word";
  pendingCount?: number;
  scorePercent?: number | null;
  totalQuestions?: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  unanswered?: number;
  totalMarks?: number;
  earnedMarks?: number;
  totalSeconds?: number;
  usedSeconds?: number;
  switchingCorrectToIncorrect?: number;
  switchingIncorrectToCorrect?: number;
  questionSeconds?: Record<string, number>;
  percentileRank?: string;
  retryAttemptsUsed?: number;
  retryAttemptsAllowed?: number;
  retryDurationMinutes?: number;
  flaggedQuestionIndexes?: number[];
  flagged?: number[];
};

const preview = {
  title: "Introduction to Artificial Intelligence",
  total: 30, correct: 21, incorrect: 9, unanswered: 0,
  score: 82, accuracy: 80, rank: "78th", usedSeconds: 2538, totalSeconds: 3600,
  incorrectSwitches: 1, correctedSwitches: 2,
};

// All icons load from public/assets/viewericons/. If an SVG is not present yet,
// render a lightweight fallback inside the same img (never a missing/broken icon).
function fallbackIcon(name: string): string {
  const icon = name.toLowerCase();
  let stroke = "#2F3547";
  let drawing = '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>';
  if (icon.includes("flag")) { stroke = "#CB5F14"; drawing = '<path d="M5 21V3m0 1c5-3 9 3 14 0v11c-5 3-9-3-14 0"/>'; }
  else if (icon.includes("cross") || icon.includes("cancel") || icon.includes("wrong") || icon.includes("remove") || icon.includes("close")) { stroke = "#A91E2C"; drawing = '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'; }
  else if (icon.includes("check")) { stroke = "#2A7308"; drawing = '<circle cx="12" cy="12" r="9"/><path d="m7 12 3.5 3.5 6.5-7"/>'; }
  else if (icon.includes("minus") || icon.includes("unanswered")) { stroke = "#67096E"; drawing = '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'; }
  else if (icon.includes("bookmark")) { stroke = "#2D4CC8"; drawing = '<path d="M6 3h12v18l-6-4-6 4V3z"/>'; }
  else if (icon.includes("arrow-right-double")) drawing = '<path d="m5 6 6 6-6 6m7-12 6 6-6 6"/>';
  else if (icon.includes("arrowleft") || icon.includes("arrow-left")) drawing = '<path d="m14 5-7 7 7 7M7 12h13"/>';
  else if (icon.includes("arrow-down")) drawing = '<path d="m5 9 7 7 7-7"/>';
  else if (icon.includes("arrowup") && icon.includes("right")) drawing = '<path d="M6 18 18 6M8 6h10v10"/>';
  else if (icon.includes("arrowright") || icon.includes("arrow-right")) drawing = '<path d="m10 5 7 7-7 7M4 12h13"/>';
  else if (icon.includes("search")) drawing = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>';
  else if (icon.includes("refresh")) { stroke = "#2D4CC8"; drawing = '<path d="M20 9a8 8 0 0 0-14-3L4 8m0-5v5h5M4 15a8 8 0 0 0 14 3l2-2m0 5v-5h-5"/>'; }
  else if (icon.includes("document")) { stroke = "#2D4CC8"; drawing = '<path d="M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7"/>'; }
  else if (icon.includes("user")) { stroke = "#2D4CC8"; drawing = '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-9 16-9 16 0"/>'; }
  else if (icon.includes("idea")) { stroke = "#A68E28"; drawing = '<path d="M9 17h6m-5 3h4M9 14c-5-5-2-11 3-11s8 6 3 11l-1 3h-4z"/>'; }
  else if (icon.includes("information") || icon.includes("alert")) { stroke = "#CB5F14"; drawing = '<circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/>'; }
  else if (icon.includes("brain")) { stroke = "#2A7308"; drawing = '<path d="M12 5c-3-4-9-1-7 3-4 2-3 8 1 9 1 4 6 4 6 0V5zm0 0c3-4 9-1 7 3 4 2 3 8-1 9-1 4-6 4-6 0"/>'; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function ResultIcon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  return <img key={name} className={className} src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" onError={event => {
    const img = event.currentTarget;
    if (img.dataset.fallback !== "true") { img.dataset.fallback = "true"; img.src = fallbackIcon(name); }
  }} />;
}

function timeLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function dataCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

type RetryEligibility = { canStart: boolean; attemptsUsed: number; maxAttempts: number | null; retryAttemptsUsed: number; retryAttemptsAllowed: number | null };
function retryCount(value: unknown, fallback: number): number {
  const count = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
}
function readRetryEligibility(): RetryEligibility | null {
  const id = getActiveAssessmentId();
  const record = id ? getAssessment(id) : undefined;
  if (!record) return null;
  const assessment = learnerAssessmentData(record);
  const result = readAssessmentResult() as SavedResult | null;
  const allowed = retryCount(result?.retryAttemptsAllowed, -1);
  return { canStart: assessment.canStart, attemptsUsed: assessment.attemptsUsed, maxAttempts: assessment.maxAttempts,
    retryAttemptsUsed: retryCount(result?.retryAttemptsUsed, 1), retryAttemptsAllowed: allowed < 0 ? null : allowed };
}
function retryAvailable(eligibility: RetryEligibility | null, used = 0): boolean {
  if (!eligibility?.canStart) return false;
  const retriesUsed = Math.max(used, eligibility.retryAttemptsUsed);
  return (eligibility.maxAttempts === null || Math.max(eligibility.attemptsUsed, retriesUsed) < eligibility.maxAttempts) &&
    (eligibility.retryAttemptsAllowed === null || retriesUsed < eligibility.retryAttemptsAllowed);
}

export default function ViewResultPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isDetailedReview, setIsDetailedReview] = useState(false);
  const [isRevisionFolder, setIsRevisionFolder] = useState(false);
  const [reviewOrigin, setReviewOrigin] = useState<"results" | "revision">("results");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [flaggedIndexes, setFlaggedIndexes] = useState<number[]>([]);
  const [bookmarkedIndexes, setBookmarkedIndexes] = useState<number[]>([]);
  const [reviewedIndexes, setReviewedIndexes] = useState<number[]>([]);
  const [revisionSearch, setRevisionSearch] = useState("");
  const [revisionPage, setRevisionPage] = useState(0);
  const [revisionSort, setRevisionSort] = useState<RevisionSort>("question-asc");
  const [isRetry, setIsRetry] = useState(false);
  const [retryNotice, setRetryNotice] = useState("");
  const [retryEligibility, setRetryEligibility] = useState<RetryEligibility | null>(null);
  useEffect(() => {
    const refresh = () => setRetryEligibility(readRetryEligibility());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("neurolxp-assessments-changed", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("neurolxp-assessments-changed", refresh); };
  }, []);

  useEffect(() => {
    try { const parsed = readAssessmentResult(); if (parsed) setSaved(parsed as SavedResult); } catch { /* Show no submission rather than an invented result. */ }
    setLoaded(true);
  }, []);

  const title = saved?.title || preview.title;
  const questions = Array.isArray(saved?.questions) ? saved.questions : [];
  const total = dataCount(saved?.totalQuestions, preview.total);
  const correct = dataCount(saved?.correctAnswers, preview.correct);
  const incorrect = dataCount(saved?.incorrectAnswers, preview.incorrect);
  const unanswered = dataCount(saved?.unanswered, preview.unanswered);
  const pending = saved?.pendingCount ?? (saved?.questions || []).filter(q=>getReviewStatus(q)==="pending").length;
  const activeId = getActiveAssessmentId();
  const activeType = activeId ? getAssessment(activeId)?.typeCode || "mcq" : "mcq";
  const release = saved ? releaseForAssessment(activeType,pending) : null;
  const scoreHidden = Boolean(release && !release.showScore);
  const answersHidden = Boolean(release && !release.showCorrectAnswers);
  const scorePending = Boolean(saved && (saved.scorePercent === null || pending > 0));
  const score = scorePending || scoreHidden ? 0 : Math.max(0,Math.min(100,dataCount(saved?.scorePercent,preview.score)));
  const accuracy = saved ? (total ? Math.round(correct / total * 100) : 0) : preview.accuracy;
  const usedSeconds = dataCount(saved?.usedSeconds, preview.usedSeconds);
  const totalSeconds = dataCount(saved?.totalSeconds, preview.totalSeconds);
  const averageSeconds = saved ? Math.round(usedSeconds / Math.max(1, total - unanswered)) : 126;
  const rank = saved?.percentileRank || (saved ? "—" : preview.rank);
  const wrongSwitches = dataCount(saved?.switchingCorrectToIncorrect, preview.incorrectSwitches);
  const fixedSwitches = dataCount(saved?.switchingIncorrectToCorrect, preview.correctedSwitches);
  const slowest = saved?.questionSeconds ? Object.entries(saved.questionSeconds)
    .filter((item): item is [string, number] => typeof item[1] === "number" && Number.isFinite(item[1]))
    .sort((a, b) => b[1] - a[1])[0] : undefined;
  const timeWarning = saved ? slowest && slowest[1] >= 300
    ? `Q${Number(slowest[0]) + 1} - Spent ${Math.floor(slowest[1] / 60)} minutes ${slowest[1] % 60} seconds`
    : "No question exceeded 5 minutes"
    : "Q12 - Spent 6 minutes 20 seconds";
  const wrongQuestions = questions.filter(q => getReviewStatus(q) === "incorrect");
  const totalWrong = saved ? wrongQuestions.length : 9;
  const assessmentRecord = activeId ? getAssessment(activeId) : undefined;
  const assessmentLimits = assessmentRecord ? learnerAssessmentData(assessmentRecord) : null;
  const retryUsed = Math.max(retryCount(saved?.retryAttemptsUsed, 1), retryEligibility?.retryAttemptsUsed ?? 0);
  const retryAllowed = retryEligibility?.retryAttemptsAllowed ?? retryEligibility?.maxAttempts ?? null;
  const canRetry = retryAvailable(retryEligibility, retryUsed);
  const retryDuration = saved?.retryDurationMinutes ?? 15;
  const retryInstructions = [
    "Only Your incorrect questions are included",
    "Your original assessment score will not change",
    "You can review feedback after each answer",
    "Your retry progress will be saved",
  ];

  // Use the actual submitted questions when available. Reference questions are shown only
  // before an assessment has been submitted, so the Figma screens can be previewed.
  const reviewQuestions = saved ? questions : previewReviewQuestions;
  const flaggedQuestionIndexes = flaggedIndexes;
  const flagKey = `viewerReviewFlags:${title}`;
  const bookmarkKey = `viewerRevisionBookmarks:${title}`;
  const reviewedKey = `viewerRevisionReviewed:${title}`;

  useEffect(() => {
    if (!loaded) return;
    const read = (key: string): number[] | null => {
      try {
        const raw = assessmentStorage.getItem(key);
        if (raw === null) return null;
        const value: unknown = JSON.parse(raw);
        return Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n) && n >= 0) : [];
      } catch { return []; }
    };
    const sourceFlags = (saved?.flaggedQuestionIndexes ?? saved?.flagged);
    const initialFlags = Array.isArray(sourceFlags) ? sourceFlags : reviewQuestions.flatMap((q, i) => q.flagged ? [i] : []);
    setFlaggedIndexes((read(flagKey) ?? initialFlags).filter(i => i < reviewQuestions.length));
    // The preview revision list remains usable before any actual submission.
    setBookmarkedIndexes((read(bookmarkKey) ?? (saved ? [] : [0,1,2,3,4,5,6,7,8,9])).filter(i => i < reviewQuestions.length));
    setReviewedIndexes((read(reviewedKey) ?? []).filter(i => i < reviewQuestions.length));
  }, [loaded, title, saved]);

  const toggleReviewFlag = (index: number) => {
    const next = flaggedIndexes.includes(index) ? flaggedIndexes.filter(i => i !== index) : [...flaggedIndexes, index];
    setFlaggedIndexes(next);
    try { assessmentStorage.setItem(flagKey, JSON.stringify(next)); } catch {}
    if (reviewFilter === "flagged" && !next.includes(index)) setReviewFilter("all");
  };
  const toggleBookmark = (index: number) => {
    const next = bookmarkedIndexes.includes(index) ? bookmarkedIndexes.filter(i => i !== index) : [...bookmarkedIndexes, index];
    setBookmarkedIndexes(next);
    try { assessmentStorage.setItem(bookmarkKey, JSON.stringify(next)); } catch {}
  };
  const markReviewed = (index: number) => {
    const next = reviewedIndexes.includes(index) ? reviewedIndexes : [...reviewedIndexes, index];
    setReviewedIndexes(next);
    try { assessmentStorage.setItem(reviewedKey, JSON.stringify(next)); } catch {}
  };
  const openReview = (index = 0, fromRevision = false) => {
    setReviewFilter("all");
    setActiveQuestion(index);
    setReviewOrigin(fromRevision ? "revision" : "results");
    if (fromRevision) markReviewed(index);
    setIsRevisionFolder(false);
    setIsRetry(false);
    setIsDetailedReview(true);
    scrollRef.current?.scrollTo(0, 0);
  };
  const backFromDetail = () => {
    setIsDetailedReview(false);
    if (reviewOrigin === "revision") setIsRevisionFolder(true);
    scrollRef.current?.scrollTo(0, 0);
  };
  const selectReviewFilter = (filter: ReviewFilter) => {
    setReviewFilter(filter);
    const first = reviewQuestions.findIndex((q, i) => filter === "all" || (filter === "flagged" ? flaggedQuestionIndexes.includes(i) : getReviewStatus(q) === filter));
    if (first >= 0) setActiveQuestion(first);
  };
  const filteredReviewIndexes = reviewQuestions.flatMap((q, i) => reviewFilter === "all" || (reviewFilter === "flagged" ? flaggedQuestionIndexes.includes(i) : getReviewStatus(q) === reviewFilter) ? [i] : []);
  const visibleRevisions = bookmarkedIndexes
    .filter(index => reviewQuestions[index])
    .map(index => ({ index, q: reviewQuestions[index] }))
    .filter(({q, index}) => `${q.text} ${q.topic || ""} Q${String(index+1).padStart(2,"0")}`.toLowerCase().includes(revisionSearch.trim().toLowerCase()))
    .sort((a,b) => {
      const [key,dir] = revisionSort.split("-");
      const sign = dir === "desc" ? -1 : 1;
      if (key === "topic") return sign * (a.q.topic || "").localeCompare(b.q.topic || "");
      if (key === "status") return sign * Number(reviewedIndexes.includes(a.index) === false) - sign * Number(reviewedIndexes.includes(b.index) === false);
      return sign * (a.index - b.index);
    });
  const effectiveRevisionPage = Math.min(revisionPage, Math.max(0, Math.ceil(visibleRevisions.length / REVISION_PAGE_SIZE) - 1));
  const pagedRevisions = visibleRevisions.slice(effectiveRevisionPage * REVISION_PAGE_SIZE,(effectiveRevisionPage + 1) * REVISION_PAGE_SIZE);

  const startRetry = () => {
    const latest = readRetryEligibility();
    const used = Math.max(retryUsed, latest?.retryAttemptsUsed ?? 0);
    if (!retryAvailable(latest, used)) {
      setRetryNotice("The allowed retry attempts have been used or this assessment is closed.");
      setRetryEligibility(latest);
      return;
    }
    if (!wrongQuestions.length) {
      setRetryNotice("No graded incorrect questions were found for retry.");
      return;
    }
    try {
      assessmentStorage.setItem("viewerRetryQuestions", JSON.stringify(wrongQuestions));
      // Existing Fill-in-the-Blanks and Match viewers need the original question
      // indexes (their creator arrays are not MCQ-style result question objects).
      const sourceIndexes = wrongQuestions.map(q => q.sourceIndex ?? questions.indexOf(q)).filter((v): v is number => Number.isInteger(v) && Number(v) >= 0);
      if (activeType === "fill-in-the-blanks") assessmentStorage.setItem("fillBlanksRetryIndexes", JSON.stringify(sourceIndexes));
      if (activeType === "match-the-following") assessmentStorage.setItem("matchFollowingRetryIndexes", JSON.stringify(sourceIndexes));
      if (activeType === "memory-game") assessmentStorage.setItem("memoryGameRetryIndexes", JSON.stringify(sourceIndexes));
      assessmentStorage.setItem("viewerRetryDurationMinutes", String(retryDuration));
      assessmentStorage.setItem("viewerAssessmentResult", JSON.stringify({ ...saved, retryAttemptsUsed: used + 1 }));
      router.push(`${viewerPath()}?retry=wrong`);
    } catch {
      setRetryNotice("Unable to start the retry. Please allow browser storage and try again.");
    }
  };

  return (
    <main className="superAdminPage institutionAdminPage vrAppShell">
      <div className="dashboardLayout vrLayout">
        <Sidebar />
        <section className="mainContent vrMain">
          <div className="vrHeader"><Header /></div>
          <div className="institutionScrollArea vrScroll" ref={scrollRef}>
            <div className="pageContent institutionPageContent vrContent">
              {loaded && !saved ? (
                <div className="vrResultReleaseNotice" role="status"><h1>No submission found</h1><p>Complete this assessment to see your result.</p><button type="button" onClick={() => router.push(demoDashboardPath())}>Back to Dashboard</button></div>
              ) : loaded && saved && release && release.mode !== "immediate" ? (
                <div className="vrResultReleaseNotice" role="status">
                  <img src="/assets/viewericons/checkmark-circle.svg" width={52} height={52} alt="" />
                  <h1>Assessment Submitted</h1><p>{release.message}</p>
                  <p>{release.mode === "scheduled" ? `Result Available: ${release.releaseDateLabel}` : release.mode === "manual" ? "Status: Awaiting result Release" : "Status: Submitted"}</p>
                  <button type="button" onClick={() => router.push(demoDashboardPath())}>Back to Dashboard</button>
                </div>
              ) : loaded && saved && answersHidden && (isDetailedReview || isRevisionFolder || isRetry) ? (
                <div className="vrResultReleaseNotice" role="status"><h1>Detailed answers are not available</h1><p>Your instructor has disabled correct-answer review in Evaluation settings.</p><button type="button" onClick={() => {setIsDetailedReview(false);setIsRevisionFolder(false);setIsRetry(false);}}>Back to Results</button></div>
              ) : isDetailedReview ? (
                <div className="vrDetailedPage">
                  <nav className="vrBreadcrumb vrDetailBreadcrumb" aria-label="Breadcrumb">
                    <Link href={demoDashboardPath()}>Dashboard</Link><img src="/assets/viewericons/arrow-right-double.svg" width={20} height={20} alt="" aria-hidden="true" />
                    <Link href="/assessments/list">Assessment</Link><img src="/assets/viewericons/arrow-right-double.svg" width={20} height={20} alt="" aria-hidden="true" />
                    <button type="button" className="vrCrumbReturn" onClick={backFromDetail}>{title}</button><img src="/assets/viewericons/arrow-right-double.svg" width={20} height={20} alt="" aria-hidden="true" />
                    <strong>Detailed Question Review</strong><span className="vrDetailTotal">{reviewQuestions.length} Questions</span>
                  </nav>
                  <div className="vrDetailHeading">
                    <span className="vrDetailTitleIcon"><img src="/assets/viewericons/fileb.svg" width={22} height={22} alt="" aria-hidden="true" /></span>
                    <div><h1>Detailed Question Review <span>({title})</span></h1><p>Review Your Answers, Explanations And Areas For Improvement</p></div>
                  </div>
                  <section className="vrDetailNavigator" aria-label="Question Navigator">
                    <h2>Question Navigator</h2>
                    <div className="vrDetailFilters">
                      {([
                        ["all", "All", reviewQuestions.length],
                        ["correct", "Correct", reviewQuestions.filter(q => getReviewStatus(q) === "correct").length],
                        ["incorrect", "Incorrect", reviewQuestions.filter(q => getReviewStatus(q) === "incorrect").length],
                        ["unanswered", "Unanswered", reviewQuestions.filter(q => getReviewStatus(q) === "unanswered").length],
                        ...(pending ? [["pending", "Pending Grading", reviewQuestions.filter(q => getReviewStatus(q) === "pending").length] as const] : []),
                        ["flagged", "Flagged Questions", reviewQuestions.filter((_, i) => flaggedQuestionIndexes.includes(i)).length]
                      ] as const).map(([filter, label, count]) => <button key={filter} type="button" aria-pressed={reviewFilter === filter} onClick={() => selectReviewFilter(filter)} className={`vrDetailFilter vrDetailFilter--${filter} ${reviewFilter === filter ? "active" : ""}`}><strong>{label}</strong><span>{count}</span></button>)}
                    </div>
                    <div className="vrDetailTiles">
                      {filteredReviewIndexes.map(index => {
                        const status = getReviewStatus(reviewQuestions[index]);
                        return <button key={index} type="button" aria-label={`Question ${index + 1}: ${status}${flaggedQuestionIndexes.includes(index) ? ", flagged" : ""}`} aria-current={activeQuestion === index ? "step" : undefined} className={`vrDetailTile ${activeQuestion === index ? "active" : ""} vrDetailTile--${status}`} onClick={() => setActiveQuestion(index)}>{index + 1}<span className={`vrDetailMiniStatus vrDetailMiniStatus--${flaggedQuestionIndexes.includes(index) ? "flagged" : status}`} aria-hidden="true"><img src={flaggedQuestionIndexes.includes(index) ? "/assets/viewericons/bookmarko.svg" : status === "correct" ? "/assets/viewericons/tick.svg" : status === "incorrect" ? "/assets/viewericons/canceldouble.svg" : "/assets/viewericons/canceldouble.svg"} width={13} height={13} alt="" aria-hidden="true" /></span></button>;
                      })}
                      {!filteredReviewIndexes.length && <p className="vrDetailEmpty">No questions match this filter.</p>}
                    </div>
                  </section>
                  {filteredReviewIndexes.length > 0 && filteredReviewIndexes.includes(activeQuestion) && reviewQuestions[activeQuestion] ? (() => {
                    const q = reviewQuestions[activeQuestion];
                    const status = getReviewStatus(q);
                    const isText = q.questionType === "one-word" || q.questionType === "short-answer";
                    const answer = isText ? (q.answerText?.trim() || "Not answered") : q.selected === null || q.selected < 0 ? "Not answered" : q.options[q.selected] || "Not provided";
                    const rightAnswer = isText ? (q.expectedAnswer?.trim() || "Awaiting grading") : q.options[q.correct] || "Not provided";
                    const isSaved = bookmarkedIndexes.includes(activeQuestion);
                    const activeInFilter = filteredReviewIndexes.indexOf(activeQuestion);
                    const previousIndex = filteredReviewIndexes[activeInFilter - 1];
                    const nextIndex = filteredReviewIndexes[activeInFilter + 1];
                    return <section className="vrDetailQuestionCard" aria-label={`Question ${activeQuestion + 1}`}>
                      <div className="vrDetailQuestionTop">
                        <strong>Question {String(activeQuestion + 1).padStart(2, "0")}/{reviewQuestions.length}</strong>
                        <div className="vrDetailQuestionBadges"><span className={`vrDetailStatusPill vrDetailStatusPill--${status}`}><img src={status === "correct" ? "/assets/viewericons/checkmark-circle.svg" : status === "incorrect" ? "/assets/viewericons/cancel-circle.svg" : "/assets/viewericons/minus-circle.svg"} width={17} height={17} alt="" aria-hidden="true" />{status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : status === "pending" ? "Pending Grading" : "Unanswered"}</span><span className="vrDetailPointPill">{q.questionType === "one-word" ? "One Word" : q.questionType === "short-answer" ? "Short Answer" : "MCQ"} : {q.points || 1} Point{q.points === 1 ? "" : "s"}</span><button type="button" className={`vrDetailFlag ${flaggedQuestionIndexes.includes(activeQuestion) ? "isFlagged" : ""}`} onClick={() => toggleReviewFlag(activeQuestion)} aria-pressed={flaggedQuestionIndexes.includes(activeQuestion)} aria-label={flaggedQuestionIndexes.includes(activeQuestion) ? "Remove review flag" : "Flag this question"} title={flaggedQuestionIndexes.includes(activeQuestion) ? "Remove review flag" : "Flag this question"}><img src="/assets/viewericons/flag.svg" width={19} height={19} alt="" aria-hidden="true" /></button><button type="button" className={`vrDetailBookmark ${isSaved ? "isSaved" : ""}`} onClick={() => toggleBookmark(activeQuestion)} aria-label={isSaved ? "Remove from revision folder" : "Save to revision folder"} title={isSaved ? "Remove from revision folder" : "Save to revision folder"}><img src="/assets/viewericons/bookmark.svg" width={20} height={20} alt="" aria-hidden="true" /></button></div>
                      </div>
                      <p className="vrDetailQuestionText">{q.text || "Question text not available"}</p>
                      <div className="vrDetailAnswers">
                        <div className="vrDetailAnswer"><span className="vrDetailAnswerIcon vrDetailAnswerIcon--user"><img src="/assets/viewericons/userblue.svg" width={17} height={17} alt="" aria-hidden="true" /></span><div><strong>Your Answer</strong><p>{answer}</p></div></div>
                        <div className="vrDetailAnswer"><span className="vrDetailAnswerIcon vrDetailAnswerIcon--correct"><img src="/assets/viewericons/checkmark-circle.svg" width={17} height={17} alt="" aria-hidden="true" /></span><div><strong>{isText && status === "pending" ? "Reference Answer" : "Correct Answer"}</strong><p>{rightAnswer}</p></div></div>
                      </div>
                      {(!release || release.showExplanation) && <div className="vrDetailInfoBox"><div className="vrDetailInfoHead"><span className="vrDetailSmallIcon vrDetailSmallIcon--orange"><img src="/assets/viewericons/brain.svg" width={17} height={17} alt="" aria-hidden="true" /></span><strong>Master Explanation</strong></div><p>{q.explanation || (q.correct >= 0 ? `${rightAnswer} is the correct answer.` : "An explanation was not saved for this question.")}</p></div>}
                      <div className="vrDetailInfoBox"><div className="vrDetailInfoHead"><span className="vrDetailSmallIcon vrDetailSmallIcon--yellow"><img src="/assets/viewericons/idea.svg" width={17} height={17} alt="" aria-hidden="true" /></span><strong>Hints</strong></div><p>{q.hint?.trim() || "No hint was saved for this question."}</p></div>
                      {(!release || release.showExplanation) && <div className="vrDetailInfoBox"><div className="vrDetailInfoHead"><span className="vrDetailSmallIcon vrDetailSmallIcon--purple"><img src="/assets/viewericons/filep.svg" width={17} height={17} alt="" aria-hidden="true" /></span><strong>{isText ? "Answer Review" : "Option Level Justification"}</strong></div><div className="vrDetailTableScroll"><table className="vrDetailJustification"><thead><tr><th>Option</th><th>Result</th><th>Explanation</th></tr></thead><tbody>{q.options.length ? q.options.map((option, i) => <tr key={i}><td>{String.fromCharCode(65 + i)}. {option}</td><td><span className={`vrDetailOptionPill ${i === q.correct ? "isRight" : "isWrong"}`}>{i === q.correct ? "Correct Answer" : "Wrong Answer"}</span></td><td>{q.optionExplanations?.[i] || (i === q.correct ? "Matches the correct answer" : "Does not match the correct answer")}</td></tr>) : <tr><td colSpan={3}>{isText ? (status === "pending" ? "This written response is awaiting grading." : "Written response recorded; no multiple-choice options apply.") : "No answer options saved."}</td></tr>}</tbody></table></div></div>}
                      <div className="vrDetailInfoBox"><div className="vrDetailInfoHead"><span className="vrDetailSmallIcon vrDetailSmallIcon--green"><img src="/assets/viewericons/graduation-cap.svg" width={17} height={17} alt="" aria-hidden="true" /></span><strong>Learning Insights</strong></div><div className="vrDetailTableScroll"><table className="vrDetailInsights"><thead><tr><th>Topic</th><th>Blooms Level</th><th>Skill</th><th>Difficulty</th></tr></thead><tbody><tr><td>{q.topic || "Not specified"}</td><td>{q.bloom || "Not specified"}</td><td>{q.skill || "Not specified"}</td><td>{q.difficulty || "Not specified"}</td></tr></tbody></table></div></div>
                      <div className="vrDetailBottom"><button type="button" onClick={backFromDetail} className="vrDetailBack"><img src="/assets/viewericons/arrowleft.svg" width={19} height={19} alt="" aria-hidden="true" />Back</button><div className="vrDetailPaging"><button type="button" onClick={() => previousIndex !== undefined && setActiveQuestion(previousIndex)} disabled={previousIndex === undefined} className="vrDetailPrevious"><img src="/assets/viewericons/arrowleft.svg" width={19} height={19} alt="" aria-hidden="true" />Previous</button><button type="button" className="vrDetailNext" disabled={nextIndex === undefined} onClick={() => nextIndex !== undefined && setActiveQuestion(nextIndex)}>Next<img src="/assets/viewericons/arrowrightg.svg" width={20} height={20} alt="" aria-hidden="true" /></button></div></div>
                    </section>;
                  })() : filteredReviewIndexes.length > 0 ? <section className="vrDetailNoSelection">Choose a question from the navigator to view its details.</section> : null}
                </div>
              ) : isRevisionFolder ? (
                <div className="vrRevisionPage">
                  <nav className="vrBreadcrumb vrRevisionBreadcrumb" aria-label="Breadcrumb">
                    <Link href={demoDashboardPath()}>Dashboard</Link><ResultIcon name="arrow-right-double.svg" size={20}/>
                    <Link href="/assessments/list">Assessment</Link><ResultIcon name="arrow-right-double.svg" size={20}/>
                    <button type="button" className="vrCrumbReturn" onClick={() => { setIsRevisionFolder(false); scrollRef.current?.scrollTo(0, 0); }}>{title}</button><ResultIcon name="arrow-right-double.svg" size={20}/>
                    <strong>Revision Folder</strong>
                  </nav>
                  <div className="vrRevisionHeading"><h1>Revision Folder</h1><p>Save Questions You Want To Revisit And Review Later.</p></div>
                  <div className="vrRevisionMetrics">
                    <div className="vrRevisionMetric vrRevisionPurple"><strong>Total Saved</strong><span>{bookmarkedIndexes.length}</span></div>
                    <div className="vrRevisionMetric vrRevisionOrange"><strong>Not Reviewed</strong><span>{bookmarkedIndexes.filter(i => !reviewedIndexes.includes(i)).length}</span></div>
                    <div className="vrRevisionMetric vrRevisionGreen"><strong>Reviewed</strong><span>{bookmarkedIndexes.filter(i => reviewedIndexes.includes(i)).length}</span></div>
                  </div>
                  <section className="vrRevisionCard" aria-label="Saved questions">
                    <div className="vrRevisionSearch"><input type="search" aria-label="Search saved questions" placeholder="Search assessment name..." value={revisionSearch} onChange={e => {setRevisionSearch(e.target.value);setRevisionPage(0);}}/><ResultIcon name="search.svg" size={20}/></div>
                    <div className="vrRevisionTableWrap"><table className="vrRevisionTable"><thead><tr><th>No.</th><th><button type="button" onClick={() => setRevisionSort(old => old === "question-asc" ? "question-desc" : "question-asc")}>Saved Questions<ResultIcon name="arrow-down-01.svg" size={17}/></button></th><th><button type="button" onClick={() => setRevisionSort(old => old === "topic-asc" ? "topic-desc" : "topic-asc")}>Topics<ResultIcon name="arrow-down-01.svg" size={17}/></button></th><th><button type="button" onClick={() => setRevisionSort(old => old === "status-asc" ? "status-desc" : "status-asc")}>Status<ResultIcon name="arrow-down-01.svg" size={17}/></button></th><th>Actions</th></tr></thead><tbody>
                      {pagedRevisions.map(({q,index}) => <tr key={index}><td>Q{String(index + 1).padStart(2, "0")}</td><td>{q.text || "Question not available"}</td><td>{q.topic || "General"}</td><td><span className={reviewedIndexes.includes(index) ? "vrRevisionReviewed" : "vrRevisionToReview"}>{reviewedIndexes.includes(index) ? "Reviewed" : "To Review"}</span></td><td><button type="button" className="vrRevisionDetailsLink" onClick={() => openReview(index, true)}>View Details</button></td></tr>)}
                      {!pagedRevisions.length && <tr><td colSpan={5} className="vrRevisionEmpty">{bookmarkedIndexes.length ? "No saved questions match your search." : "No questions saved yet. Use the bookmark icon in Detailed Question Review to save questions."}</td></tr>}
                    </tbody></table></div>
                    <div className="vrRevisionPagination"><span>Showing {visibleRevisions.length ? String(effectiveRevisionPage * REVISION_PAGE_SIZE + 1).padStart(2, "0") : "00"} to {String(Math.min((effectiveRevisionPage + 1) * REVISION_PAGE_SIZE, visibleRevisions.length)).padStart(2, "0")} of {visibleRevisions.length}</span><div><button type="button" aria-label="Previous page" disabled={effectiveRevisionPage === 0} onClick={() => setRevisionPage(p => Math.max(0, p - 1))}><ResultIcon name="arrowleft.svg" size={19}/></button><span className="vrRevisionPageNo" aria-label={`Page ${effectiveRevisionPage + 1} of ${Math.max(1, Math.ceil(visibleRevisions.length / REVISION_PAGE_SIZE))}`}>{effectiveRevisionPage + 1}</span><button type="button" aria-label="Next page" disabled={effectiveRevisionPage >= Math.max(0, Math.ceil(visibleRevisions.length / REVISION_PAGE_SIZE) - 1)} onClick={() => setRevisionPage(p => Math.min(Math.ceil(visibleRevisions.length / REVISION_PAGE_SIZE) - 1, p + 1))}><ResultIcon name="arrowright.svg" size={19}/></button></div></div>
                  </section>
                  <div className="vrRevisionBackRow"><button type="button" className="vrRevisionBack" onClick={() => { setIsRevisionFolder(false); setRevisionSearch(""); setRevisionPage(0); scrollRef.current?.scrollTo(0, 0); }}><ResultIcon name="arrowleft.svg" size={20}/>Back</button></div>
                </div>
              ) : isRetry ? (
                <div className="vrRetryPage">
              <nav className="vrBreadcrumb" aria-label="Breadcrumb">
                <Link href={demoDashboardPath()}>Dashboard</Link><ResultIcon name="arrow-right-double.svg" size={20}/>
                <Link href="/assessments/list">Assessment</Link><ResultIcon name="arrow-right-double.svg" size={20}/>
                <button className="vrCrumbReturn" type="button" onClick={() => setIsRetry(false)}>{title}</button><ResultIcon name="arrow-right-double.svg" size={20}/>
                <strong>Reattempt Wrong Questions</strong>
              </nav>
              <div className="vrRetryTitle">
                <h1>Retry Incorrect Questions</h1>
                <p>Practice The Questions You Answered Incorrectly And Strengthen Your Understanding Before Moving Forward.</p>
              </div>
              <section className="vrRetryCard" aria-label="Retry overview">
                <h2>Your Retry</h2>
                <div className="vrRetryMetrics">
                  <div className="vrRetryMetric vrMetricPurple"><strong>Wrong Questions</strong><span>{String(totalWrong).padStart(2,"0")}</span></div>
                  <div className="vrRetryMetric vrMetricGreen"><strong>Retry Attempts</strong><span>{String(retryUsed).padStart(2,"0")}/{Number.isFinite(retryAllowed) ? retryAllowed : "Unlimited"}</span></div>
                  <div className="vrRetryMetric vrMetricOrange"><strong>Question Remaining</strong><span>{String(totalWrong).padStart(2,"0")}</span></div>
                  <div className="vrRetryMetric vrMetricBlue"><strong>Retry Duration</strong><span>{retryDuration} Min</span></div>
                </div>
                <h2 className="vrWhatsNext">What happens Next ?</h2>
                <div className="vrRetryInstructions">
                  {retryInstructions.map(text => <div className="vrRetryInstruction" key={text}>
                    <span className="vrRetryCheck" aria-hidden="true"/><span>{text}</span>
                  </div>)}
                </div>
                {retryNotice && <p className="vrRetryNotice" role="alert">{retryNotice}</p>}
                <div className="vrRetryActions">
                  <button type="button" className="vrRetryCancel" onClick={() => { setRetryNotice(""); setIsRetry(false); }}>Cancel</button>
                  <button type="button" className="vrRetryStart" disabled={!canRetry} onClick={startRetry}>Start Retry<ResultIcon name="arrowrightg.svg" size={23}/></button>
                </div>
              </section>
                </div>
              ) : (
                <>
              <nav className="vrBreadcrumb" aria-label="Breadcrumb">
                <Link href={demoDashboardPath()}>Dashboard</Link><ResultIcon name="arrow-right-double.svg" size={20} />
                <Link href="/assessments/list">Assessment</Link><ResultIcon name="arrow-right-double.svg" size={20} />
                <strong>{title}</strong>
              </nav>

              <div className="vrCompletedTitle">
                <span className="vrCompletedIcon"><ResultIcon name="checkmark-circle.svg" size={52} /></span>
                <div><h1>Assessment Completed</h1><p>{title}</p></div>
              </div>

              <div className="vrCardGrid">
                <section className="vrCard vrScoreCard" aria-labelledby="vrScoreTitle">
                  <div className="vrScoreSummary">
                    <div className="vrScoreDial" role="img" aria-label={scoreHidden ? "Score hidden by evaluation settings" : scorePending ? "Score awaiting grading" : `Score ${score}%`}>
                      <svg className="vrScoreArc" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                        <circle className="vrScoreTrack" cx="60" cy="60" r="46" />
                        <circle className="vrScoreProgress" cx="60" cy="60" r="46" pathLength="100" strokeDasharray={`${score} ${100 - score}`} />
                      </svg>
                      <div className="vrScoreCenter"><strong>{scoreHidden ? "—" : scorePending ? "—" : `${score}%`}</strong><span>{scoreHidden ? "Hidden" : scorePending ? "Pending" : "Score"}</span></div>
                    </div>
                    <strong className="vrScoreQuestions">{scoreHidden ? "Score not available" : scorePending ? `${pending} Awaiting Grading` : answersHidden ? `${total} Questions` : `${correct}/${total} Questions`}</strong>
                  </div>
                  <div className="vrScoreBreakdown">
                    <h2 id="vrScoreTitle">Score Breakdown</h2>
                    <div className="vrDataTable">
                      {!answersHidden && <><div><span>Correct Answers</span><strong className="vrGreen">{correct}</strong></div>
                      <div><span>Incorrect Answers</span><strong className="vrRed">{incorrect}</strong></div>
                      <div><span>Unanswered</span><strong className="vrBlue">{unanswered}</strong></div></>}
                      {pending > 0 && <div><span>Pending grading</span><strong>{pending}</strong></div>}
                      {!answersHidden && <><div><span>Accuracy Rate</span><strong>{scorePending ? "—" : `${accuracy}%`}</strong></div>
                      <div><span>Percentile Rank</span><strong>{rank}</strong></div></>}
                    </div>
                  </div>
                </section>

                <section className="vrCard vrTimeCard" aria-labelledby="vrTimeTitle">
                  <h2 id="vrTimeTitle">Time Analysis</h2>
                  <div className="vrDataTable vrTimeTable">
                    <div><span>Total Time</span><strong><b className="vrGreen">{timeLabel(usedSeconds)}</b> / {timeLabel(totalSeconds)} Minutes</strong></div>
                    <div><span>Average Per Question</span><strong className="vrPurple">{timeLabel(averageSeconds)}</strong></div>
                  </div>
                  <div className="vrTimeWaster">
                    <span className="vrWarningBadge"><ResultIcon name="alert.svg" size={24} /></span>
                    <div><strong>Time Waster</strong><p>{timeWarning}</p></div>
                  </div>
                </section>

                <section className="vrCard vrInsightsCard" aria-labelledby="vrInsightsTitle">
                  <h2 id="vrInsightsTitle">Cognitive and Behavioral Insights</h2>
                  <h3>Switching Behavior</h3>
                  <div className="vrDataTable vrBehaviorTable">
                    <div><span><span className="vrStatusCircle vrStatusBad">×</span>Changed from Correct to Incorrect</span><strong className="vrRed">{String(wrongSwitches).padStart(2, "0")}</strong></div>
                    <div><span><span className="vrStatusCircle vrStatusGood">✓</span>Changed from Incorrect to Correct</span><strong className="vrGreen">{String(fixedSwitches).padStart(2, "0")}</strong></div>
                  </div>
                </section>

                <section className="vrCard vrActionsCard" aria-labelledby="vrActionsTitle">
                  <h2 id="vrActionsTitle">Quick Actions</h2>
                  {!answersHidden && <button type="button" className="vrActionRow" onClick={() => openReview()}>
                    <ResultIcon name="refresh.svg" size={20}/><span>Detailed Question Review</span><ResultIcon name="arrowupright.svg" size={17}/>
                  </button>}
                  {!answersHidden && <button type="button" className="vrActionRow" onClick={() => { setIsRevisionFolder(true); setIsDetailedReview(false); setRevisionPage(0); scrollRef.current?.scrollTo(0, 0); }}>
                    <ResultIcon name="bookmark.svg" size={20}/><span>Go to Revision Folder</span><ResultIcon name="arrowupright.svg" size={17}/>
                  </button>}
                </section>
              </div>

              {!answersHidden && <div className="vrRetryFooter">
                <button type="button" className="vrPrimaryPill" disabled={!canRetry} title={!canRetry ? "No retry attempts remain or this assessment is closed." : undefined} onClick={() => { const latest = readRetryEligibility(); if (!retryAvailable(latest, retryUsed)) { setRetryEligibility(latest); return; } setRetryNotice(""); setIsRetry(true); }}>
                  <span>Re- Attempt Wrongs Answers</span><ResultIcon name="arrowrightg.svg" size={24}/>
                </button>
              </div>}
              {!loaded && <span className="vrVisuallyHidden" role="status">Loading assessment result</span>}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
