"use client";
import { quantumStorage as localStorage, quantumSessionStorage as sessionStorage } from "../quantum-storage";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Undo2, Redo2, ChevronDown, ChevronRight, GripVertical,
    Pencil, Highlighter, Eraser, MoreHorizontal, Sparkles,
    CircleHelp, CircleDotDashed, Zap, Trophy, UsersRound,
    Plus, ImagePlus, Lightbulb, Info, Eye, RotateCcw,
    Bold, Italic, Underline, Orbit, ClipboardList, Bot, Database,
} from "lucide-react";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./qc_create_question.css";
type IconProps = {
    name: string;
    size?: number;
    className?: string;
};

/** Displays the project’s existing SVG assets from public/assets/assessmenticons. */
function Icon({ name, size = 18, className = "" }: IconProps) {
    return (
        <img
            src={`/assets/assessmenticons/${name}`}
            alt=""
            width={size}
            height={size}
            className={className}
            aria-hidden="true"
            draggable={false}
        />
    );
}

type Kind = "MCQ (Text answers)" | "Arrange the Answers" | "Hidden Answer tiles" | "Audio Question (Verbal Response)";
type Answer = {
    text: string;
    correct: boolean;
    feedback: string;
    fact: string;
    image?: string;
};
type Question = {
    type: Kind;
    text: string;
    answers: Answer[];
    xp: number;
    timer: string;
    difficulty: string;
    category: string;
    bloom: string;
    tags: string[];
    mandatory: boolean;
    lifeline: boolean;
    partial: boolean;
    answerCount: number;
    minAnswers: number;
    xpPerAnswer: number;
    sameImages: boolean;
    hint: boolean;
    hintXP: string;
    hintPercent: number;
    boosterCount: number;
    boosterTitle: string;
    boosterCaption: string;
    didYouKnow: string;
    feedback: string;
    audioBanner: string;
    audioBoxTitle: string;
    audioHelper: string;
    audioSubmit: string;
    maxRecording: string;
    minRecording: string;
    language: string;
    playResponse: boolean;
    reRecord: boolean;
    transcript: boolean;
    reRecordLimit: string;
    marking: "AI" | "Host";
    modelAnswer: string;
    audioName: string;
    audioUrl: string;
    hostAudioName: string;
};
const kinds: Kind[] = ["MCQ (Text answers)", "Arrange the Answers", "Hidden Answer tiles", "Audio Question (Verbal Response)"];
const makeAnswer = (): Answer => ({
    text: "",
    correct: false,
    feedback: "",
    fact: "",
});

const makeMcqAnswers = (): Answer[] => [
    {
        ...makeAnswer(),
        text: "",
        correct: false,
        feedback: "",
    },
    {
        ...makeAnswer(),
        text: "",
    },
    {
        ...makeAnswer(),
        text: "",
    },
    {
        ...makeAnswer(),
        text: "",
    },
];
const makeQuestion = (): Question => ({
    type: kinds[0], text: "", answers: makeMcqAnswers(), xp: 1000, timer: "NA",
    difficulty: "Medium", category: "", bloom: "", tags: [],
    mandatory: true, lifeline: true, partial: true, answerCount: 6, minAnswers: 3, xpPerAnswer: 200,
    sameImages: true, hint: true, hintXP: "Full XP", hintPercent: 50, boosterCount: 4,
    boosterTitle: "Response Boosters", boosterCaption: "Use them to build a stronger response",
    didYouKnow: "Neural networks are inspired by the human brain, using connected nodes to process information and learn from data.",
    feedback: "No Xp this time for your Team", audioBanner: "Situation Question", audioBoxTitle: "Give your verbal Response",
    audioHelper: "Tap the mic and speak now", audioSubmit: "Submit the Response", maxRecording: "30s",
    minRecording: "None", language: "English", playResponse: true, reRecord: true, transcript: true,
    reRecordLimit: "Unlimited", marking: "AI", modelAnswer: "A short ideal answer the host can read out.",
    audioName: "", audioUrl: "", hostAudioName: ""
});
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function Toggle({ checked, onChange }: {
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return <button type="button" className={`qcc-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}><span>{checked ? "ON" : "OFF"}</span><i /></button>;
}
function Field({ title, value, values, onChange, error }: {
    title: string;
    value: string;
    values: string[];
    onChange: (v: string) => void;
    error?: string;
}) {
    return <label className="qcc-field"><span>{title}</span><select value={value} aria-invalid={!!error} onChange={e => onChange(e.target.value)}>{value === "" && <option value="" disabled>Select {title}</option>}{values.map(v => <option key={v} value={v}>{v}</option>)}</select>{error && <small className="qcc-validation-error" role="alert">{error}</small>}</label>;
}
function Editor({ label, value, onChange, placeholder = "", max = 250 }: {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    max?: number;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [size, setSize] = useState("16");
    const [family, setFamily] = useState("Arial");
    const wrap = (a: string, b: string) => {
        const el = ref.current;
        if (!el)
            return;
        const start = el.selectionStart, end = el.selectionEnd;
        onChange(value.slice(0, start) + a + (value.slice(start, end) || "text") + b + value.slice(end));
        el.focus();
    };
    return <div className="qcc-editor-group">{label && <div className="qcc-editor-label"><strong>{label}</strong><small>{value.length}/{max}</small></div>}
    <div className="qcc-rich"><div className="qcc-toolbar">
      <button type="button" title="Undo" onClick={() => ref.current?.focus()}><Undo2 size={16} strokeWidth={1.8} /></button><button type="button" title="Redo" onClick={() => ref.current?.focus()}><Redo2 size={16} strokeWidth={1.8} /></button>
      <select aria-label="Font" value={family} onChange={e => setFamily(e.target.value)}><option>Arial</option><option>Georgia</option><option>Verdana</option></select>
      <select aria-label="Size" value={size} onChange={e => setSize(e.target.value)}>{[14, 16, 18, 20, 24].map(v => <option key={v}>{v}</option>)}</select>
      <button type="button" onClick={() => wrap("**", "**")}><Bold size={15} strokeWidth={1.8} /></button><button type="button" onClick={() => wrap("*", "*")}><Italic size={15} strokeWidth={1.8} /></button><button type="button" onClick={() => wrap("<u>", "</u>")}><Underline size={15} strokeWidth={1.8} /></button>
      <button type="button" onClick={() => ref.current?.focus()}>A <ChevronDown size={12} /></button><button type="button" onClick={() => ref.current?.focus()}><Pencil size={15} /></button><button type="button" onClick={() => ref.current?.focus()}><Highlighter size={15} /></button><button type="button" onClick={() => ref.current?.focus()}><Eraser size={15} /></button><MoreHorizontal size={17} strokeWidth={1.8} />
    </div><textarea ref={ref} maxLength={max} style={{ fontFamily: family, fontSize: `${size}px` }} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}/></div></div>;
}
function SettingToggle({ title, subtitle, value, onChange }: {
    title: string;
    subtitle: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return <div className="qcc-setting-toggle"><div><strong>{title}</strong><small>{subtitle}</small></div><Toggle checked={value} onChange={onChange}/></div>;
}
function validateQuestionLive(question: Question | undefined, round: number, index: number): string[] {
    if (!question) return [`Round ${round}, question ${index + 1}: question is required.`];
    const prefix = `Round ${round}, question ${index + 1}`;
    const errors: string[] = [];
    if (!question.text.trim()) errors.push(`${prefix}: question text is required.`);
    if (!Number.isFinite(question.xp) || question.xp <= 0) errors.push(`${prefix}: XP must be greater than zero.`);
    if (!question.category.trim()) errors.push(`${prefix}: choose a category.`);
    if (!question.bloom.trim()) errors.push(`${prefix}: choose Bloom’s taxonomy.`);
    if (question.type !== kinds[3]) {
        if (question.answers.length < 2) errors.push(`${prefix}: at least two answers are required.`);
        if (question.answers.some(answer => !answer.text.trim())) errors.push(`${prefix}: fill in every answer option.`);
        if (question.type === kinds[0] && question.answers.filter(answer => answer.correct).length !== 1) errors.push(`${prefix}: select exactly one correct answer.`);
        if (question.type === kinds[2] && question.minAnswers > question.answers.length) errors.push(`${prefix}: minimum answers exceed available answers.`);
    } else if (question.marking === "Host" && !question.modelAnswer.trim()) errors.push(`${prefix}: a model answer is required for host marking.`);
    return errors;
}
export default function QCCreateQuestionPage() {
    const router = useRouter();
    const [assessmentId, setAssessmentId] = useState("");
    const [hydrated, setHydrated] = useState(false);
    const [savedSignature, setSavedSignature] = useState("");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [attempted, setAttempted] = useState(false);
    const [persistError, setPersistError] = useState("");
    const [round, setRound] = useState(1);
    const [active, setActive] = useState(0);
    const [roundCount, setRoundCount] = useState(2);
    const [questionsPerRound, setQuestionsPerRound] = useState(9);
    const [xpToWin, setXpToWin] = useState(10000);
    const [questions, setQuestions] = useState<Record<number, Question[]>>({ 1: [makeQuestion()] });
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [preview, setPreview] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [arrangeHint, setArrangeHint] = useState(false);
    const [tagInput, setTagInput] = useState(false);
    const [tag, setTag] = useState("");
    const [notice, setNotice] = useState("");
    const [recording, setRecording] = useState(false);
    const recorder = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<Blob[]>([]);
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const current = questions[round] || [makeQuestion()];
    const currentErrors = attempted ? validateQuestionLive(questions[round]?.[active], round, active) : [];
    const fieldError = (part: string) => currentErrors.find(message => message.includes(part));
    const inlineError = (part: string) => { const message = fieldError(part); return message ? <small className="qcc-validation-error" role="alert">{message.split(": ").slice(1).join(": ")}</small> : null; };
    const q = current[active] || makeQuestion();
    const change = (patch: Partial<Question>) => setQuestions(prev => {
        const list = [...(prev[round] || [makeQuestion()])];
        list[active] = { ...list[active], ...patch };
        return { ...prev, [round]: list };
    });
    const changeAnswer = (i: number, patch: Partial<Answer>) => change({ answers: q.answers.map((a, n) => n === i ? { ...a, ...patch } : a) });
    const toggleOpen = (key: string) => setOpen(p => ({ ...p, [key]: !(p[key] ?? (q.type !== kinds[1] && q.type !== kinds[2])) }));
    const setType = (type: Kind) => {
        if (type === kinds[2] && q.type !== kinds[2]) {
            const labels = [
                "Fairness", "Reliability & Safety", "Privacy & Security",
                "Inclusiveness", "Transparency", "Accountability",
            ];
            change({
                type,
                text: "",
                answers: labels.map((text, i) => ({
                    ...makeAnswer(),
                    text: "",
                    correct: false,
                    feedback: "",
                })),
                answerCount: 6,
            });
        } else if (type === kinds[1] && q.type !== kinds[1]) {
            change({ type, text: "", answerCount: 4, sameImages: false, answers: ["Train the Model", "Test and Improve", "Give an Answer", "Collect Data"].map(() => ({ ...makeAnswer(), text: "" })) });
        } else if (type === kinds[3] && q.type !== kinds[3]) {
            change({
                type,
                text: "",
                audioBanner: "Situation Question",
                boosterTitle: "Response Boosters",
                boosterCaption: "Use them to build a stronger response",
                boosterCount: 4,
                xpPerAnswer: 250,
                minAnswers: 2,
            });
        } else {
            change({ type });
        }
        setOpen({});
        setReveal(false);
    };
    const signature = JSON.stringify({ questions, roundCount, questionsPerRound, xpToWin });
    const isSaved = !!savedSignature && savedSignature === signature;
    const validate = (): string[] => {
        const errors: string[] = [];
        if (!Number.isInteger(roundCount) || roundCount < 1) errors.push("A valid round count is required.");
        if (!Number.isInteger(questionsPerRound) || questionsPerRound < 1) errors.push("Questions per round must be at least 1.");
        if (!Number.isFinite(xpToWin) || xpToWin <= 0) errors.push("XP to win must be greater than zero.");
        for (let r = 1; r <= roundCount; r++) {
            const items = questions[r] || [];
            if (items.length !== questionsPerRound) {
                errors.push(`Round ${r}: add ${questionsPerRound} questions (currently ${items.length}).`);
            }
            items.forEach((question, index) => {
                const prefix = `Round ${r}, question ${index + 1}`;
                if (!question.text.trim()) errors.push(`${prefix}: question text is required.`);
                if (!Number.isFinite(question.xp) || question.xp <= 0) errors.push(`${prefix}: XP must be greater than zero.`);
                if (!question.category.trim()) errors.push(`${prefix}: choose a category.`);
                if (!question.bloom.trim()) errors.push(`${prefix}: choose Bloom’s taxonomy.`);
                if (question.type !== kinds[3]) {
                    if (question.answers.length < 2) errors.push(`${prefix}: at least two answers are required.`);
                    if (question.answers.some(answer => !answer.text.trim())) errors.push(`${prefix}: fill in every answer option.`);
                    if (question.type === kinds[0] && question.answers.filter(answer => answer.correct).length !== 1) errors.push(`${prefix}: select exactly one correct answer.`);
                    if (question.type === kinds[2] && question.minAnswers > question.answers.length) errors.push(`${prefix}: minimum answers exceed available answers.`);
                } else if (question.marking === "Host" && !question.modelAnswer.trim()) {
                    errors.push(`${prefix}: a model answer is required for host marking.`);
                }
            });
        }
        return errors;
    };
    useEffect(() => {
        try {
            const id = localStorage.getItem("quantumChampsCurrentId");
            if (!id || !localStorage.getItem(`quantumChamps:${id}`)) {
                setPersistError("No saved assessment was found. Return to Details and save the assessment first.");
                return;
            }
            setAssessmentId(id);
            const assessment = JSON.parse(localStorage.getItem(`quantumChamps:${id}`) || "{}");
            const stored = assessment.createQuestions || assessment.questionBuilder;
            const draft = assessment.form || assessment.details || assessment;
            const configuredRounds = Number(draft.rounds ?? draft.roundCount);
            const configuredQuestions = Number(draft.questionsPerRound);
            const configuredXp = Number(draft.xpToWin);
            const countRounds = Number.isFinite(configuredRounds) && configuredRounds > 0 ? Math.min(10, Math.floor(configuredRounds)) : 1;
            const countQuestions = Number.isFinite(configuredQuestions) && configuredQuestions > 0 ? Math.floor(configuredQuestions) : 1;
            setRoundCount(countRounds);
            setQuestionsPerRound(countQuestions);
            if (Number.isFinite(configuredXp) && configuredXp > 0) setXpToWin(configuredXp);
            const previousQuestions = stored?.questions && typeof stored.questions === "object" ? stored.questions as Record<number, Question[]> : {};
            const prepared: Record<number, Question[]> = {};
            for (let r = 1; r <= countRounds; r++) {
                const existing = Array.isArray(previousQuestions[r]) ? previousQuestions[r] : [];
                prepared[r] = Array.from({ length: countQuestions }, (_, index) => existing[index] || makeQuestion());
            }
            setQuestions(prepared);
            if (stored?.saved && stored?.signature) setSavedSignature(stored.signature);
        } catch (error) {
            console.error("Failed to restore Quantum Champs questions:", error);
            setPersistError("Unable to restore this assessment. Please return to Details.");
        } finally { setHydrated(true); }
    }, []);
    useEffect(() => {
        if (!hydrated || !assessmentId) return;
        try {
            const key = `quantumChamps:${assessmentId}`;
            const existing = JSON.parse(localStorage.getItem(key) || "{}");
            const previous = existing.createQuestions || {};
            localStorage.setItem(key, JSON.stringify({ ...existing, assessmentId,
                createQuestions: { ...previous, questions, roundCount, questionsPerRound, xpToWin,
                    saved: isSaved, signature: isSaved ? signature : "", updatedAt: new Date().toISOString() }
            }));
        } catch { setPersistError("Could not autosave the question draft. Check available browser storage."); }
    }, [signature, hydrated, assessmentId, isSaved]);
    const focusFirstError = (errors: string[]) => {
        const match = errors.find(message => /^Round \d+, question \d+:/.test(message))?.match(/^Round (\d+), question (\d+):/);
        if (match) {
            const nextRound = Number(match[1]);
            const nextQuestion = Number(match[2]) - 1;
            setRound(nextRound);
            setActive(nextQuestion);
            setOpen({});
        }
        requestAnimationFrame(() => {
            document.querySelector(".qcc-validation-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    };
    const save = () => {
        setAttempted(true);
        if (!assessmentId) { setNotice("Save the Details page first to create an assessment ID."); return false; }
        const errors = validate();
        setValidationErrors(errors);
        if (errors.length) {
            setNotice("");
            focusFirstError(errors);
            return false;
        }
        try {
            const key = `quantumChamps:${assessmentId}`;
            const existing = JSON.parse(localStorage.getItem(key) || "{}");
            localStorage.setItem(key, JSON.stringify({ ...existing, assessmentId,
                createQuestions: { questions, roundCount, questionsPerRound, xpToWin,
                    saved: true, signature, updatedAt: new Date().toISOString() } }));
            try { sessionStorage.setItem("quantumChampsQuestions", JSON.stringify({ assessmentId, questions })); } catch { /* Review can use the saved assessment record. */ }
            setSavedSignature(signature);
            setNotice(`Questions saved successfully. Assessment ID: ${assessmentId}`);
            setPersistError("");
            return true;
        } catch { setNotice("Could not save questions. Check browser storage."); return false; }
    };
    const continueToEvaluation = () => {
        setAttempted(true);
        const errors = validate();
        setValidationErrors(errors);
        if (errors.length) { setNotice(""); focusFirstError(errors); return; }
        if (!isSaved) { setNotice("Please click Save before Continue."); return; }
        router.push("/quantum-champs/QC_Evaluation");
    };
    const backToContent = () => router.push("/quantum-champs/QC_Content");
    const addQuestion = () => { if (current.length >= questionsPerRound) {
        setNotice(`Round ${round} allows ${questionsPerRound} questions.`);
        return;
    } setQuestions(p => ({ ...p, [round]: [...current, makeQuestion()] })); setActive(current.length); setOpen({}); setPreview(false); setNotice(""); };
    const selectRound = (n: number) => { setRound(n); setActive(0); setOpen({}); setPreview(false); setReveal(false); };
    const addAnswer = () => change({ answers: [...q.answers, makeAnswer()] });
    const uploadImage = (i: number, file?: File) => { if (!file)
        return; const reader = new FileReader(); reader.onload = () => changeAnswer(i, { image: String(reader.result) }); reader.readAsDataURL(file); };
    const record = async () => {
        if (recording) {
            recorder.current?.stop();
            setRecording(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const r = new MediaRecorder(stream);
            recordedChunks.current = [];
            r.ondataavailable = e => recordedChunks.current.push(e.data);
            r.onstop = () => { const blob = new Blob(recordedChunks.current, { type: r.mimeType }); setAudioPreview(URL.createObjectURL(blob)); stream.getTracks().forEach(t => t.stop()); };
            recorder.current = r;
            r.start();
            setRecording(true);
        }
        catch {
            setNotice("Microphone access is required to record audio.");
        }
    };
    const audioUpload = (file?: File) => { if (!file)
        return; setAudioPreview(URL.createObjectURL(file)); change({ audioName: file.name }); };
    const total = Object.values(questions).flat().filter(item => item.text.trim()).reduce((s, item) => s + item.xp, 0);
    const answerCard = (a: Answer, i: number) => {
        const key = `answer-${i}`;
        const expanded = open[key] ?? (q.type !== kinds[1] && q.type !== kinds[2]);
        return <div className={`qcc-answer ${q.type === kinds[1] ? "qcc-arrange-answer" : ""}`} key={i}><button type="button" className="qcc-answer-heading" aria-expanded={expanded} onClick={() => toggleOpen(key)}> <span>{q.type === kinds[1] ? <GripVertical size={14} /> : ""}Option {letters[i]}</span><span className={`qcc-chevron ${expanded ? "is-open" : ""}`} aria-hidden="true"/></button>
      {expanded && <div className="qcc-answer-body"><Editor label="Text" value={a.text} onChange={text => changeAnswer(i, { text })} placeholder={`Enter option ${letters[i]}`}/>{attempted && !a.text.trim() && <small className="qcc-validation-error" role="alert">Option {letters[i]} is required.</small>}
        {(q.type === kinds[1] || q.type === kinds[2]) && <div className="qcc-image-upload"><label className="qcc-upload-image"><ImagePlus size={14} /> {a.image ? "Image Uploaded" : "Upload Image"}<input type="file" accept="image/*" onChange={e => uploadImage(i, e.target.files?.[0])}/></label>{a.image && <img className="qcc-answer-image" src={a.image} alt={`Option ${letters[i]}`}/>}</div>}
        {q.type !== kinds[1] && <label className="qcc-checkbox"><input type="checkbox" checked={a.correct} onChange={e => change({ answers: q.answers.map((v, j) => ({ ...v, correct: j === i ? e.target.checked : false })) })}/>Correct Answers</label>}
        <div className="qcc-nested qcc-nested-feedback"><span className="qcc-section-icon"><CircleHelp size={14} /></span><Editor label="Feedback" value={a.feedback} onChange={feedback => changeAnswer(i, { feedback })}/></div>
        <div className="qcc-nested qcc-nested-fact"><span className="qcc-section-icon"><Lightbulb size={14} /></span><Editor label="Did You Know ? (Shown After the Answer)" value={a.fact} onChange={fact => changeAnswer(i, { fact })}/></div>
        {q.answers.length > 2 && <button type="button" className="qcc-remove" onClick={() => change({ answers: q.answers.filter((_, j) => j !== i) })}>Remove option</button>}
      </div>}</div>;
    };
    const answerSettings = () => q.type === kinds[1] || q.type === kinds[2] ? <section className="qcc-section qcc-answer-settings"><h3>Answers Settings</h3><div className="qcc-inset"><div className={`qcc-three ${q.type === kinds[1] ? "qcc-arrange-settings-grid" : ""}`}>
    <Field title="Number of Answers" value={String(q.answerCount)} values={Array.from({ length: 10 }, (_, i) => String(i + 2))} onChange={v => change({ answerCount: Number(v) })}/>
    {q.type !== kinds[1] && <Field title="Team must name at least" value={String(q.minAnswers)} values={Array.from({ length: q.answerCount }, (_, i) => String(i + 1))} onChange={v => change({ minAnswers: Number(v) })}/>}
    <Field title="XP per Correct Answer" value={String(q.xpPerAnswer)} values={["50", "100", "200", "250", "500", "1000"]} onChange={v => change({ xpPerAnswer: Number(v) })}/>
  </div><div className="qcc-compact-toggle"><span>Answer Images</span><SettingToggle title="Apply same images to all Answers" subtitle="" value={q.sameImages} onChange={sameImages => change({ sameImages })}/></div></div></section> : null;
    const hintSettings = () => q.type === kinds[2] ? <section className="qcc-section"><div className="qcc-section-title"><h3>Reveal Hint</h3><small>Shows all the answers</small></div><div className="qcc-inset"><SettingToggle title="Allow Reveal Hint" subtitle="" value={q.hint} onChange={hint => change({ hint })}/><div className="qcc-hint-grid"><Field title="Team has a lifeline" value={q.hintXP} values={["Full XP", "75% XP", "50% XP", "25% XP"]} onChange={hintXP => change({ hintXP })}/><div><strong>Team has a lifeline</strong><div className="qcc-pills">{[25, 50, 75].map(v => <button key={v} type="button" className={q.hintPercent === v ? "active" : ""} onClick={() => change({ hintPercent: v })}>{v}%</button>)}</div></div></div></div></section> : null;
    const partialSettings = () => q.type === kinds[1] ? <section className="qcc-section qcc-arrange-partial"><div className="qcc-section-title"><h3>Partial XP</h3><small>When the order is only partly correct</small></div><div className="qcc-inset"><SettingToggle title="Give Partial XP" subtitle="" value={q.partial} onChange={partial => change({ partial })}/><h4>What the Team Earns</h4><div className="qcc-xp-grid">{[0, 1, 2, 3, 4].map(n => <div key={n}><small>{n} of 4 correct</small><b>{n < 3 ? 0 : n === 3 ? 750 : 1000} XP</b></div>)}</div><small>Need at least 3 correct to earn XP; each correct answer is worth {q.xpPerAnswer} XP</small></div></section> : null;
    const audioSettings = () => q.type === kinds[3] ? <>
    <section className="qcc-section"><h3>Question</h3><div className="qcc-inset"><div className="qcc-two"><Field title="Banner Label" value={q.audioBanner} values={["Situation Question", "Audio Question", "Scenario", "Challenge"]} onChange={audioBanner => change({ audioBanner })}/><Field title="XP for this Question" value={String(q.xp)} values={["250", "500", "1000", "1500", "2000"]} onChange={v => change({ xp: Number(v) })}/></div><p>Question audio - team can listen to the situation (optional)</p><div className="qcc-audio-buttons"><label>＋ Upload Audio<input type="file" accept="audio/*" onChange={e => audioUpload(e.target.files?.[0])}/></label><button type="button" onClick={record}>{recording ? "■ Stop" : "◉ Record"}</button><small>{q.audioName || (audioPreview ? "Audio Recorded" : "No Audio Added")}</small></div>{audioPreview && <audio controls src={audioPreview}/>}</div></section>
    <section className="qcc-section qcc-audio-response-settings"><div className="qcc-section-title"><h3>Audio Response Box</h3><small>What the team uses to answer</small></div><div className="qcc-inset"><div className="qcc-three"><Field title="Box Title" value={q.audioBoxTitle} values={["Give your verbal Response", "Record your answer", "Speak your answer"]} onChange={audioBoxTitle => change({ audioBoxTitle })}/><Field title="Helper Text" value={q.audioHelper} values={["Tap the mic and speak now", "Tap to record", "Speak clearly"]} onChange={audioHelper => change({ audioHelper })}/><Field title="Submit Button" value={q.audioSubmit} values={["Submit the Response", "Submit Response", "Send Answer"]} onChange={audioSubmit => change({ audioSubmit })}/></div><div className="qcc-three"><Field title="Max Recording" value={q.maxRecording} values={["15s", "30s", "60s", "90s", "120s"]} onChange={maxRecording => change({ maxRecording })}/><Field title="Min Recording" value={q.minRecording} values={["None", "5s", "10s", "15s"]} onChange={minRecording => change({ minRecording })}/><Field title="Answer Language" value={q.language} values={["English", "Hindi", "Kannada", "Tamil", "Telugu"]} onChange={language => change({ language })}/></div><div className="qcc-three"><SettingToggle title="Play Response" subtitle="" value={q.playResponse} onChange={playResponse => change({ playResponse })}/><SettingToggle title="Re-Record" subtitle="" value={q.reRecord} onChange={reRecord => change({ reRecord })}/><SettingToggle title="Auto transcript" subtitle="" value={q.transcript} onChange={transcript => change({ transcript })}/></div><Field title="Re-record limit" value={q.reRecordLimit} values={["Unlimited", "1", "2", "3"]} onChange={reRecordLimit => change({ reRecordLimit })}/></div></section>
    <section className="qcc-section qcc-audio-booster-settings"><h3>Response Boosters</h3><div className="qcc-inset"><Editor label="Section Title" value={q.boosterTitle} onChange={boosterTitle => change({ boosterTitle })}/><Editor label="Caption" value={q.boosterCaption} onChange={boosterCaption => change({ boosterCaption })}/><Field title="Number Of Boosters" value={String(q.boosterCount)} values={["2", "3", "4"]} onChange={v => change({ boosterCount: Number(v) })}/><div className="qcc-booster-table">{["Protect|Stop Sharing", "Explain|Explain Risk", "Report|Notify Team", "Prevent|Remove Data"].slice(0, q.boosterCount).map((item, i) => <div key={item}><b>{i + 1}. {item.split("|")[0]}</b><span>{item.split("|")[1]}</span><strong>250 XP</strong></div>)}</div><SettingToggle title="Show booster to teams" subtitle="" value={q.hint} onChange={hint => change({ hint })}/><Editor label="Did you know" value={q.didYouKnow} onChange={didYouKnow => change({ didYouKnow })}/><Editor label="Feedback" value={q.feedback} onChange={feedback => change({ feedback })}/></div></section>
    <section className="qcc-section qcc-audio-marking"><div className="qcc-section-title"><h3>Marking</h3><small>How the Answer earns XP</small></div><div className="qcc-inset"><p>Marked by</p><div className="qcc-pills">{(["AI", "Host"] as const).map(v => <button key={v} className={q.marking === v ? "active" : ""} type="button" onClick={() => change({ marking: v })}>{v}</button>)}</div><div className="qcc-two"><Field title="XP per Booster covered" value={String(q.xpPerAnswer)} values={["100", "200", "250", "500"]} onChange={v => change({ xpPerAnswer: Number(v) })}/><Field title="Pass when team covers at least" value={String(q.minAnswers)} values={["1", "2", "3", "4"]} onChange={v => change({ minAnswers: Number(v) })}/></div><label className="qcc-plain-field">Model Answer text (Host only)<textarea value={q.modelAnswer} onChange={e => change({ modelAnswer: e.target.value })}/></label><p>Model answer - audio (host only, optional)</p><div className="qcc-audio-buttons"><label>＋ Upload Audio<input type="file" accept="audio/*" onChange={e => change({ hostAudioName: e.target.files?.[0]?.name || "" })}/></label><button type="button" onClick={record}>{recording ? "■ Stop" : "◉ Record"}</button><small>{q.hostAudioName || "No Audio Added"}</small></div></div></section>
  </> : null;
    const hiddenTilesPreview = () => {
        const fallbackAnswers = [
            "Fairness",
            "Reliability & Safety",
            "Privacy & Security",
            "Inclusiveness",
            "Transparency",
            "Accountability",
        ];
        const tileCount = Math.max(2, q.answerCount);
        const hasLifeline = q.hint && q.lifeline;

        return (
            <div className="qcc-live qcc-hidden-preview">
                <div className="qcc-hidden-header">
                    <div className="qcc-hidden-round">
                        <span className="qcc-hidden-team">
                            <Icon name="ai-sparkles.svg" size={18} />
                            <span>Team Nova Turn- <b>Round {round}</b></span>
                        </span>
                        <span className="qcc-hidden-counter">
                            Question <b>{active + 1}/{questionsPerRound}</b>
                        </span>
                    </div>
                    <div className="qcc-hidden-switch" role="group" aria-label="Reveal preview state">
                        <button
                            type="button"
                            className={!reveal ? "is-active" : ""}
                            aria-pressed={!reveal}
                            onClick={() => setReveal(false)}
                        >
                            Before Reveal
                        </button>
                        <button
                            type="button"
                            className={reveal ? "is-active" : ""}
                            aria-pressed={reveal}
                            onClick={() => setReveal(true)}
                        >
                            After Reveal
                        </button>
                    </div>
                </div>

                <div className="qcc-hidden-question">
                    {q.text.trim() || "Your Question Appears here"}
                </div>

                <div className={`qcc-hidden-tiles ${reveal ? "is-revealed" : ""}`}>
                    {Array.from({ length: tileCount }, (_, i) => (
                        <div className="qcc-hidden-tile" key={i}>
                            {reveal ? (
                                <>
                                    <span className="qcc-hidden-letter">
                                        {letters[i]?.toLowerCase()}
                                    </span>
                                    <span className="qcc-hidden-answer">
                                        {q.answers[i]?.text.trim() || fallbackAnswers[i] || `Option ${letters[i]}`}
                                    </span>
                                </>
                            ) : (
                                <span className="qcc-hidden-tile-art" aria-label={`Hidden answer ${i + 1}`}>
                                    <svg
                                        className="qcc-hidden-chip"
                                        width="38"
                                        height="38"
                                        viewBox="0 0 48 48"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <rect x="11" y="11" width="26" height="26" rx="7" stroke="#68218D" strokeWidth="2" />
                                        <path d="M18 24c4-1 5-3 6-7 1 4 3 6 7 7-4 1-6 3-7 7-1-4-3-6-6-7Z" stroke="#60219B" strokeWidth="2" strokeLinejoin="round" />
                                        <path d="M16 5v6M24 5v6M32 5v6M16 37v6M24 37v6M32 37v6M5 16h6M5 24h6M5 32h6M37 16h6M37 24h6M37 32h6" stroke="#287F9D" strokeWidth="1.8" strokeLinecap="round" />
                                    </svg>
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    className="qcc-hidden-lifeline-banner"
                    type="button"
                    onClick={() => setReveal(!reveal)}
                    aria-label={reveal ? "Return to hidden answers" : "Reveal answers"}
                >
                    {reveal ? <Lightbulb size={25} strokeWidth={1.8} /> : <Eye size={23} strokeWidth={1.8} />}
                    <span>
                        {reveal
                            ? (hasLifeline ? `lifeline · ${q.hintXP}` : "No lifeline · 50% XP")
                            : "Reveal Hint"}
                    </span>
                </button>

                <div className={`qcc-hidden-lifelines ${reveal && !hasLifeline ? "is-disabled" : ""}`}>
                    <div className="qcc-hidden-lifeline">
                        <span className="qcc-hidden-lifeline-circle">30s</span>
                        <strong>Blitz</strong>
                    </div>
                    <div className="qcc-hidden-lifeline">
                        <span className="qcc-hidden-lifeline-circle">60s</span>
                        <strong>Boost</strong>
                    </div>
                    <div className="qcc-hidden-lifeline">
                        <span className="qcc-hidden-lifeline-circle">50:50</span>
                        <strong>Split</strong>
                    </div>
                </div>
            </div>
        );
    };

    const arrangePreview = () => {
        const defaults = ["Train the Model", "Test and Improve", "Give an Answer", "Collect Data"];
        const stepIcons = [Orbit, ClipboardList, Bot, Database];
        const steps = Array.from({ length: Math.max(2, q.answerCount || 4) }, (_, i) => ({
            title: q.answers[i]?.text?.trim() || defaults[i] || `Step ${i + 1}`,
            number: i + 1,
            IconComponent: stepIcons[i % stepIcons.length],
        }));

        return (
            <div className="qcc-live qcc-arrange-preview">
                <div className="qcc-arrange-question">Your Question Appears here</div>

                <div className="qcc-arrange-steps">
                    {steps.map((step) => (
                        <div className="qcc-arrange-step" key={step.number}>
                            <span className="qcc-arrange-step-number">{step.number}</span>
                            <span className="qcc-arrange-step-content">
                                <span className="qcc-arrange-step-icon" aria-hidden="true">
                                    <step.IconComponent size={36} strokeWidth={1.8} />
                                </span>
                                <span className="qcc-arrange-step-label">{step.title}</span>
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    className="qcc-arrange-reveal"
                    onClick={() => setArrangeHint(value => !value)}
                >
                    <Eye size={24} strokeWidth={1.7} />
                    <span>{arrangeHint ? "Hide Hint" : "Reveal Hint"}</span>
                </button>

                <div className="qcc-arrange-lifelines">
                    <div className="qcc-arrange-lifeline"><span>30s</span><b>Blitz</b></div>
                    <div className="qcc-arrange-lifeline"><span>60s</span><b>Boost</b></div>
                    <div className="qcc-arrange-lifeline"><span>50:50</span><b>Split</b></div>
                </div>
            </div>
        );
    };

    const previewScreen = () => q.type === kinds[2]
        ? hiddenTilesPreview()
        : q.type === kinds[1] ? arrangePreview()
        : q.type === kinds[3] ? (
            <div className="qcc-live qcc-audio-preview">
                <div className="qcc-audio-preview-header">
                    <span className="qcc-audio-preview-team"><Icon name="ai-sparkles.svg" size={17} /> Team Nova Turn- <b>Round {round}</b></span>
                    <span className="qcc-audio-preview-counter">Question <b>{active + 1}/{questionsPerRound}</b></span>
                </div>
                <div className="qcc-audio-preview-question">
                    <strong>{q.audioBanner}</strong>
                    <p>{q.text || "Your Question Appears here"}</p>
                </div>
                <div className="qcc-audio-preview-response">
                    <div className="qcc-audio-preview-mic"><span>♩</span></div>
                    <div className="qcc-audio-preview-copy"><strong>{q.audioBoxTitle.toUpperCase()}</strong><small>{q.audioHelper}</small></div>
                    <div className="qcc-audio-preview-wave" aria-hidden="true">{[8, 15, 9, 21, 13, 8, 19, 11, 16].map((height, index) => <i key={index} style={{ height }} />)}</div>
                    <div className="qcc-audio-preview-actions">
                        <button type="button" onClick={() => audioPreview && new Audio(audioPreview).play()}><span>▷</span> Play response</button>
                        <button type="button" onClick={record}><RotateCcw size={15}/>{recording ? "Stop" : "Re-Record"}</button>
                    </div>
                </div>
                <button className="qcc-audio-preview-submit" type="button" onClick={() => setNotice("Response submitted in preview mode.")}>{q.audioSubmit === "Submit the Response" ? "Submit Response" : q.audioSubmit}</button>
                <div className="qcc-audio-preview-boosters">
                    <div className="qcc-audio-preview-booster-heading"><span className="qcc-audio-preview-rocket">🚀</span><div><strong>{q.boosterTitle}</strong><small>{q.boosterCaption}</small></div></div>
                    <div className="qcc-audio-preview-booster-grid">
                        {[
                            ["Protect", "Stop Sharing"],
                            ["Explain", "Explain Risk"],
                            ["Report", "Notify Team"],
                            ["Prevent", "Remove Data"],
                        ].slice(0, q.boosterCount).map(([name, subtitle], i) => (
                            <div className={`qcc-audio-preview-booster qcc-audio-preview-booster-${i}`} key={name}>
                                <b>{name}</b><small>{subtitle}</small>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ) : <div className="qcc-live"><div className="qcc-live-top"><span>✧ Team Nova Turn- Round {round}</span><b>Question {active + 1}/{questionsPerRound}</b>{q.type === kinds[2] && <div className="qcc-reveal-switch"><button type="button" className={!reveal ? "selected" : ""} onClick={() => setReveal(false)}>Before Reveal</button><button type="button" className={reveal ? "selected" : ""} onClick={() => setReveal(true)}>After Reveal</button></div>}</div><div className="qcc-live-question">{q.text || "Your Question Appears here"}</div><div className={`qcc-live-options ${q.type === kinds[2] ? "tiles" : ""}`}>{Array.from({ length: q.type === kinds[2] ? q.answerCount : q.answers.length }, (_, i) => { const a = q.answers[i]; return <div key={i} className="qcc-live-option">{q.type === kinds[2] && !reveal ? <span className="qcc-tile-symbol">✧</span> : <><b>{letters[i]?.toLowerCase()}</b><span>{a?.text || `Option ${letters[i]}`}</span></>}</div>; })}</div>{q.type === kinds[2] && <button type="button" className="qcc-reveal" onClick={() => setReveal(!reveal)}>◎ &nbsp; {reveal ? "Hide Answers" : "Reveal Hint"}</button>}{q.type === kinds[1] && <button type="button" className="qcc-reveal" onClick={() => setReveal(!reveal)}>◎ &nbsp; {reveal ? "Hide Hint" : "Reveal Hint"}</button>}{(q.type === kinds[1] || q.type === kinds[2]) && <div className="qcc-lifelines"><div><b>30s</b><strong>Blitz</strong></div><div><b>60s</b><strong>Boost</strong></div><div><b>50:50</b><strong>Split</strong></div></div>}</div>;
    return <main className="qcc-shell"><div className="qcc-app"><Sidebar /><section className="qcc-main"><Header /><div className="qcc-scroll"><div className="qcc-page">
<div className="qcc-top">
  <nav className="qcc-breadcrumb" aria-label="Question breadcrumb">
    <button
      type="button"
      className="qcc-back-icon"
      onClick={backToContent}
    >
      <ChevronRight size={17} strokeWidth={2} />
    </button>

    <button
      type="button"
      onClick={() => router.push("/assessments")}
    >
      Assessment
    </button>

    <Icon name="arrowrightdouble.svg" />

    <button
      type="button"
      onClick={backToContent}
    >
      Create Assessment
    </button>

    <Icon name="arrowrightdouble.svg" />

    <strong>Create Questions</strong>
  </nav>

  <div className="qcc-welcome">
    <span className="qcc-welcome-sparkle" aria-hidden="true">
      <Icon name="ai-sparkles.svg" size={30} />
    </span>

    <div>
      <b>Let's Get Started! Antony?</b>
      <small>Let's Build A Great Question.</small>
    </div>
  </div>
</div>    <div className="qcc-intro"><h1>Challenge Details (Quantum Champ)</h1><p>Add Questions To Each Round. Every Question Is Shown On The Game Screen Exactly As Previewed On The Right.</p></div>
    <div className="qcc-columns"><section className="qcc-left"><div className="qcc-rounds">{Array.from({ length: roundCount }, (_, i) => <button type="button" key={i} className={round === i + 1 ? "active" : ""} onClick={() => selectRound(i + 1)}>Round {i + 1}</button>)}</div>
      <div className="qcc-form"><label className="qcc-form-label">Question Type</label><select className="qcc-type" value={q.type} onChange={e => setType(e.target.value as Kind)}>{kinds.map(k => <option key={k}>{k}</option>)}</select><Editor label="Write Your Question" value={q.text} onChange={text => change({ text })} placeholder="Write your question here..."/>{inlineError("question text is required")}
      {audioSettings()}{answerSettings()}
{q.type !== kinds[3] && (
  <section className="qcc-section">
    <h3>
      {q.type === kinds[1] ? "Answer to arrange" : "Available Options"}
    </h3>
    <div className="qcc-answers">
      {q.answers.map(answerCard)}
    </div>
    {inlineError("fill in every answer option")}
    {inlineError("select exactly one correct answer")}
    {inlineError("at least two answers")}
    {inlineError("minimum answers exceed")}
    <button className="qcc-add-options" type="button" onClick={addAnswer}>
      <Plus size={16} /> Add Options
    </button>
  </section>
)}      {partialSettings()}{hintSettings()}
      {(q.type !== kinds[0]) && <section className="qcc-section"><h3>Live game screen Preview</h3>{previewScreen()}</section>}
      {preview && q.type === kinds[0] && <section className="qcc-section"><h3>Preview Questions</h3>{previewScreen()}</section>}
      </div><button className="qcc-add-question" type="button" disabled={current.length >= questionsPerRound} onClick={addQuestion}><Plus size={17} /> Add Questions</button><div className="qcc-question-tabs" data-single={current.length === 1}>{current.map((_, i) => <button key={i} className={active === i ? "active" : ""} onClick={() => { setActive(i); setOpen({}); setReveal(false); }}>{i + 1}</button>)}</div></section>
      <aside className="qcc-right"><section className="qcc-side-settings"><h2>Question Settings</h2><label className="qcc-field"><span>XP for full marks</span><input type="number" min={0} value={q.xp} onChange={e => change({ xp: Number(e.target.value) })}/>{inlineError("XP must be greater than zero")}</label><Field title="Timer(sec)" value={q.timer} values={["NA", "15", "30", "45", "60", "90", "120"]} onChange={timer => change({ timer })}/><Field title="Difficulty" value={q.difficulty} values={["Easy", "Medium", "Hard"]} onChange={difficulty => change({ difficulty })}/><Field title="Category" value={q.category} values={["AI", "Machine Learning", "Data Science", "Programming", "Other"]} onChange={category => change({ category })} error={attempted && !q.category.trim() ? "Choose a category." : undefined}/><Field title="Bloom’s Taxonomy" value={q.bloom} values={["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]} onChange={bloom => change({ bloom })} error={attempted && !q.bloom.trim() ? "Choose Bloom’s taxonomy." : undefined}/>
      <div className="qcc-tags"><strong>Tags</strong><button type="button" onClick={() => setTagInput(!tagInput)}><Plus size={14} /> Add Tag</button>{tagInput && <form onSubmit={e => { e.preventDefault(); if (tag.trim())
        change({ tags: [...q.tags, tag.trim()] }); setTag(""); setTagInput(false); }}><input value={tag} onChange={e => setTag(e.target.value)} placeholder="New tag"/><button type="submit">Add</button></form>}<div>{q.tags.map((t, i) => <button type="button" key={`${t}-${i}`} onClick={() => change({ tags: q.tags.filter((_, j) => i !== j) })}>{t} ×</button>)}</div></div>
      <SettingToggle title="Mandatory" subtitle="This Question is Mandatory" value={q.mandatory} onChange={mandatory => change({ mandatory })}/><SettingToggle title="Lifeline Allowed" subtitle="Get Help with lifeline" value={q.lifeline} onChange={lifeline => change({ lifeline })}/><SettingToggle title="Partial Xp" subtitle="Per correct slot/ point" value={q.partial} onChange={partial => change({ partial })}/></section>
      <section className="qcc-summary">
          <h2>Challenge Summary</h2>
          <div><span><CircleHelp className="qcc-summary-icon questions" size={16} /> Questions</span><b>{questionsPerRound}</b></div>
          <div><span><CircleDotDashed className="qcc-summary-icon rounds" size={16} /> Rounds</span><b>{roundCount}</b></div>
          <div><span><Zap className="qcc-summary-icon xp" size={16} /> Max XP</span><b>{total.toLocaleString()}</b></div>
          <div><span><Trophy className="qcc-summary-icon trophy" size={16} /> Xp to win</span><b>{xpToWin.toLocaleString()}</b></div>
          <div><span><UsersRound className="qcc-summary-icon team" size={16} /> Team</span><b className="qcc-team">Nova, Blaze</b></div>
        </section></aside></div>
      {assessmentId && <p className="qcc-assessment-id">Assessment ID: <strong>{assessmentId}</strong>{isSaved && <span> · Saved</span>}</p>}
      {persistError && <p className="qcc-notice" role="alert">{persistError}</p>}
 
       {notice && <p className="qcc-notice" role="status">{notice}</p>}
      <footer className="qcc-footer"><button type="button" onClick={() => { if (q.type === kinds[0])
        setPreview(!preview);
    else
        backToContent(); }}>{q.type === kinds[0] ? "Preview Questions" : "Back"}</button><div><button type="button" onClick={save}>Save</button><button type="button" className="qcc-continue" onClick={continueToEvaluation}>Continue</button></div></footer>
  </div></div></section></div></main>;
}

