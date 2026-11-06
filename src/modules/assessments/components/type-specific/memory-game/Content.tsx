"use client";
import { AIToolbarEditor } from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Content";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import { assessmentStorage, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
import { makePair, makeQuestion, memoryErrors, isMemoryComplete, readMemoryQuestions, type MemoryPair, type MemoryQuestion } from "./model";
import MemoryGamePreview from "./Preview";
import "./memory-game.css";

// ICON PATHS: change filenames here, or replace those SVGs in public/assets/assessmenticons/.
// No extra icons folder is created. Card images are controlled by the ImageSlot fields below.
const ICON_ROOT = "/assets/assessmenticons/";
const MEMORY_ICONS = {
  breadcrumb: "arrowrightdouble.svg", chevron: "arrow-down-01.svg", sparkles: "ai-sparkles.svg",
  add: "plus.svg", previous: "arrowleft.svg", next: "arrowright.svg", image: "image.svg",
  upload: "upload.svg", edit: "edit.svg", question: "view.svg", cards: "adjust-position.svg",
  grading: "clipboard-list.svg", feedback: "message-02.svg", explanation: "info.svg", hint: "idea.svg",
  remove: "cancel-circle.svg", undo: "undo-02.svg", redo: "refresh-04.svg"
} as const;

type IconName = keyof typeof MEMORY_ICONS;
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <img src={`${ICON_ROOT}${MEMORY_ICONS[name]}`} width={size} height={size} alt="" aria-hidden="true" />;
}
const categories = ["AI", "Machine Learning", "Computer Science", "Programming", "Mathematics", "Science", "General Knowledge", "Other"];
const blooms = ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"];

function MemorySelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const close = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setExpanded(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [expanded]);
  return <div className="memDropdown" ref={wrapper}>
    <button type="button" aria-label={label} aria-expanded={expanded} aria-haspopup="listbox" className="memDropdownTrigger" onClick={() => setExpanded(x => !x)}>
      <span>{value || `Select ${label.toLowerCase()}`}</span><Icon name="chevron" size={18} />
    </button>
    {expanded && <div className="memDropdownMenu" role="listbox" aria-label={label}>
      {options.map(option => <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setExpanded(false); }}>{option}</button>)}
    </div>}
  </div>;
}

function MemoryToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`memNewToggle ${checked ? "active" : ""}`} onClick={() => onChange(!checked)}>
    <span>{checked ? "ON" : "OFF"}</span><i aria-hidden="true" />
  </button>;
}

function MemoryAccordion({ title, icon, open, onChange, children, count }: { title: string; icon: IconName; open: boolean; onChange: () => void; children: ReactNode; count?: string }) {
  return <section className="memNewAccordion">
    <button type="button" className="memNewAccordionHead" aria-expanded={open} onClick={onChange}>
      <span className="memNewAccordionTitle"><span className="memNewCircle"><Icon name={icon} size={19} /></span>{title}</span>
      <span className="memNewAccordionRight">{count && !/^\d+\s*\/\s*\d+/.test(count) && <small>{count}</small>}<span className={`memNewChevron ${open ? "up" : ""}`}><Icon name="chevron" size={20} /></span></span>
    </button>
    {open && <div className="memNewAccordionBody">{children}</div>}
  </section>;
}

function MemoryTextEditor({ label, value, onChange, placeholder, maxLength = 250, accent, editorKey, html, onHtmlChange, onError }: {
  label?: string; value: string; onChange: (s: string) => void; placeholder: string; maxLength?: number; accent?: string;
  editorKey: string; html?: string; onHtmlChange: (html: string) => void; onError: (message: string) => void;
}) {
  const plainAsHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
  return <div className="memNewEditor" style={{ color: accent || "#374151" }}>
    {label && <div className="memNewEditorLabel"><strong>{label}</strong></div>}
    <AIToolbarEditor key={editorKey} value={html ?? plainAsHtml(value)} questionNumber={0} showQuestionPrefix={false} maxChars={maxLength}
      editorLabel={label || placeholder} placeholder={placeholder} onError={onError}
      onChange={onHtmlChange} onTextChange={onChange}/>
  </div>;
}

function MemoryImageSlot({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editPath, setEditPath] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const acceptFile = (file?: File) => {
    if (!file) return;
    if (file.size > 450_000) { setError("Choose an image under 450 KB for local storage."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { onChange(reader.result); setError(""); } };
    reader.readAsDataURL(file);
  };
  return <div className="memNewImageSlot">
    <span className="memNewImageName">{label}</span>
    <span className="memNewImagePreview">{value ? <img src={value} alt={`${label} preview`} /> : <Icon name="image" size={20} />}</span>
    <button type="button" title={`Set ${label} image URL`} aria-label={`Set ${label} image URL`} onClick={() => setEditPath(v => !v)}><Icon name="edit" size={18} /></button>
    <button type="button" title={`Upload ${label} image`} aria-label={`Upload ${label} image`} onClick={() => fileInput.current?.click()}><Icon name="upload" size={18} /></button>
    <input ref={fileInput} type="file" accept="image/*" hidden onChange={event => acceptFile(event.target.files?.[0])} />
    {editPath && <input className="memNewImagePath" aria-label={`${label} image path`} value={value.startsWith("data:") ? "" : value} placeholder="/assets/assessmenticons/your-image.svg" onChange={event => onChange(event.target.value)} />}
    {error && <small className="memError">{error}</small>}
  </div>;
}

function getDraft(key: string): Record<string, unknown> {
  try { return JSON.parse(assessmentStorage.getItem(key) || "{}") as Record<string, unknown>; } catch { return {}; }
}
function positive(value: unknown, fallback: number) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }

export default function MemoryGameContent() {
  const router = useRouter();
  const [questions, setQuestions] = useState<MemoryQuestion[]>([makeQuestion()]);
  const [richHtml, setRichHtml] = useState<Record<string, string>>({});
  const [draftReady, setDraftReady] = useState(false);
  const [active, setActive] = useState(0);
  const [limits, setLimits] = useState({ count: 1, marks: 1, per: 1, duration: "60" });
  const [panelOpen, setPanelOpen] = useState({ question: true, grading: true, feedback: true, explanation: true, hint: true });
  const [preview, setPreview] = useState(false);
  const [validated, setValidated] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { if (notice !== "Saved") return; const timer = window.setTimeout(() => setNotice(""), 3000); return () => window.clearTimeout(timer); }, [notice]);
  const [continuing, setContinuing] = useState(false);
  const continueTimer = useRef<number | null>(null);
  useEffect(() => () => { if (continueTimer.current) window.clearTimeout(continueTimer.current); }, []);
  const [tagText, setTagText] = useState("");
  const [editingTag, setEditingTag] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const details = getDraft("memoryGameAssessmentDraft");
    const config = { count: Math.max(1, Math.min(300, Math.floor(positive(details.questionCount, 1)))), marks: positive(details.totalMarks, 1), per: positive(details.marksPerQuestion, 1), duration: String(details.duration || details.timeLimit || "60") };
    setLimits(config);
    const storedDraft = getDraft("memoryGameContentDraft");
    const existing = readMemoryQuestions(storedDraft);
    if (storedDraft.richHtml && typeof storedDraft.richHtml === "object" && !Array.isArray(storedDraft.richHtml)) {
      setRichHtml(Object.fromEntries(Object.entries(storedDraft.richHtml).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
    }
    if (Number.isInteger(storedDraft.active)) setActive(Math.max(0, Math.min(Math.max(config.count, existing.length)-1, Number(storedDraft.active))));
    setQuestions(Array.from({length:Math.max(config.count,existing.length)},(_,index)=>existing[index] ?? makeQuestion(config.per)));
    setDraftReady(true);
  }, []);
  useEffect(()=>{if(!draftReady)return;try{assessmentStorage.setItem("memoryGameContentDraft",JSON.stringify({ questions, active, richHtml }));}catch{setNotice("Could not save this draft in your browser.");}},[draftReady,questions,active,richHtml]);

  const question = questions[active] || questions[0];
  const memoryEditorProps = (field: string) => { const editorKey = `${question.id}:${field}`; return { editorKey, html: richHtml[editorKey], onHtmlChange: (html: string) => setRichHtml(previous => ({ ...previous, [editorKey]: html })), onError: setNotice }; };
  const completed = useMemo(() => questions.filter(isMemoryComplete).length, [questions]);
  const marks = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const canContinue = questions.length === limits.count && questions.every(isMemoryComplete) && Math.abs(marks - limits.marks) < 0.001;
  const update = (changes: Partial<MemoryQuestion>) => setQuestions(old => old.map((q, i) => i === active ? { ...q, ...changes } : q));
  const editPair = (id: string, changes: Partial<MemoryPair>) => update({ pairs: question.pairs.map(pair => pair.id === id ? { ...pair, ...changes } : pair) });
  const save = (showNotice = true) => {
    assessmentStorage.setItem("memoryGameContentDraft", JSON.stringify({ questions, active, richHtml }));
    updateAssessment({ questions: questions.length, marks });
    if (showNotice) setNotice("Saved");
  };
  const continueToEvaluation = () => {
    if (continuing) return;
    setValidated(true);
    if (!canContinue) {
      setNotice(questions.length > limits.count ? `This draft has ${questions.length} saved questions. Increase the question count in Details to keep them all.` : `Complete all ${limits.count} Memory Game questions and check the total marks equal ${limits.marks}.`);
      return;
    }
    try {
      save(false); setNotice(""); setContinuing(true);
      continueTimer.current = window.setTimeout(() => { setContinuing(false); router.push("/assessments/create/evaluation"); }, 3000);
    } catch { setNotice("Could not save this draft in your browser."); }
  };
  const addQuestion = () => {
    if (questions.length >= limits.count) { setNotice(`Only ${limits.count} question(s) are configured in Details.`); return; }
    setQuestions(old => [...old, makeQuestion(limits.per)]);
    setActive(questions.length);
    setValidated(false);
    setNotice("");
  };
  const choose = (index: number) => { if (index < 0 || index >= questions.length) return; setActive(index); setValidated(false); scroll.current?.scrollTo({ top: 0 }); };
  const switchPanel = (key: keyof typeof panelOpen) => setPanelOpen(old => ({ ...old, [key]: !old[key] }));
  const addTag = () => { if (!tagText.trim()) return; update({ tags: [...new Set([...question.tags, tagText.trim()])] }); setTagText(""); setEditingTag(false); };

  const breadcrumb = <nav className="memNewBreadcrumb" aria-label="Breadcrumb">
    <button type="button" onClick={() => router.push("/assessments")}>Assessment</button><Icon name="breadcrumb" size={20} />
    <button type="button" onClick={() => router.push("/assessments/create")}>Create Assessment</button><Icon name="breadcrumb" size={20} />
    {preview ? <><button type="button" onClick={() => setPreview(false)}>Create Questions</button><Icon name="breadcrumb" size={20} /><strong>Preview Questions</strong></> : <strong>Create Questions</strong>}
  </nav>;

  return <main className="memApp memFigmaApp"><div className="memLayout"><Sidebar />
    <section className="memMain"><Header /><div ref={scroll} className="memScroll"><div className="memWrap memFigmaWrap">
      {preview ? <MemoryGamePreview breadcrumb={breadcrumb} questions={questions} onBack={() => { setPreview(false); scroll.current?.scrollTo({ top: 0 }); }} onEdit={index => { setActive(index); setPreview(false); scroll.current?.scrollTo({ top: 0 }); }} onContinue={continueToEvaluation} notice={notice} saving={continuing} /> : <>
        <div className="memFigmaTop"><div>{breadcrumb}</div><div className="memWelcome"><Icon name="sparkles" size={32} /><div><h2>Let&apos;s Get Started! <span>Institute?</span></h2><p>Let&apos;s Build A Great Question.</p></div></div></div>
        <div className="memFigmaColumns"><div className="memFigmaEditorColumn">
          <section className="memFigmaMainCard">
            <header className="memFigmaQuestionHeader"><div><h1>Question {active + 1} of {limits.count}</h1><p>{limits.count} Question{limits.count === 1 ? "" : "s"} | {limits.marks} Marks</p></div><button type="button" className="memFigmaButton memFigmaButtonBlue" onClick={addQuestion}><Icon name="add" size={21} /> Add</button></header>
            <div className="memFigmaNavigator"><button type="button" className="memFigmaRound" aria-label="Previous question" disabled={active === 0} onClick={() => choose(active - 1)}><Icon name="previous" /></button><div className="memFigmaTiles">{questions.map((q, i) => <button type="button" key={q.id} aria-label={`Question ${i + 1}`} onClick={() => choose(i)} className={`memFigmaTile ${i === active ? "selected" : ""} ${isMemoryComplete(q) ? "done" : ""}`}><strong>{i + 1}</strong><small>MG</small><i /></button>)}</div><button type="button" className="memFigmaRound" aria-label="Next question" disabled={active === questions.length - 1} onClick={() => choose(active + 1)}><Icon name="next" /></button></div>
            <div className="memFigmaProgress"><div style={{ width: `${completed / limits.count * 100}%` }} /></div>
            <div className="memFigmaQuestionBox"><label className="memFigmaField"><span>Question Type</span><div className="memFigmaInset memFigmaReadOnly">Memory Game <Icon name="chevron" /></div></label>
              <MemoryAccordion title="Question and Image" icon="question" open={panelOpen.question} onChange={() => switchPanel("question")}>
                <MemoryTextEditor {...memoryEditorProps("text")} label="Write Your Question" value={question.text} onChange={text => update({ text })} placeholder="Write the matching-pairs question..." />
                <div className="memFigmaSubpanel"><h3>Add pictures to cards</h3><p className="memFigmaMuted">Add text or images to each pair. The matching pair is saved together.</p>
                  <div className="memFigmaCardPairs">{question.pairs.map((pair, index) => <div key={pair.id} className="memFigmaPair"><div className="memFigmaPairHeader"><b>Pair {index + 1}</b><button type="button" disabled={question.pairs.length <= 2} onClick={() => update({ pairs: question.pairs.filter(p => p.id !== pair.id) })}>Remove</button></div>
                    <div className="memFigmaPairInputs"><label>Card A<input value={pair.left} maxLength={250} placeholder="Card text" onChange={e => editPair(pair.id, { left: e.target.value })} /></label><MemoryImageSlot label={`Card A, pair ${index + 1}`} value={pair.leftImage || ""} onChange={leftImage => editPair(pair.id, { leftImage })} /></div>
                    <div className="memFigmaPairInputs"><label>Matching Card B<input value={pair.right} maxLength={250} placeholder="Matching answer" onChange={e => editPair(pair.id, { right: e.target.value })} /></label><MemoryImageSlot label={`Card B, pair ${index + 1}`} value={pair.rightImage || ""} onChange={rightImage => editPair(pair.id, { rightImage })} /></div>
                  </div>)}</div>
                  <div className="memFigmaCenter"><button type="button" className="memFigmaButton memFigmaButtonPink" onClick={() => update({ pairs: [...question.pairs, makePair(question.pairs.length + 1)] })}><Icon name="add" size={16} /> Add Cards</button></div>
                </div>
                <section className="memFigmaSettings"><h3>Game Settings</h3><div className="memFigmaSettingsGrid">
                  <label>Columns<MemorySelect label="Columns" value={question.columns || "Auto"} options={["Auto", "2", "3", "4", "5", "6"]} onChange={columns => update({ columns })} /></label>
                  <label>Card Back Colour<MemorySelect label="Card Back Colour" value={question.cardBackColor || "Blue"} options={["Blue", "Green", "Purple", "Pink", "Grey"]} onChange={cardBackColor => update({ cardBackColor })} /></label>
                  <div className="memFigmaField"><span>Shuffle</span><div className="memFigmaSwitchRow">Shuffle Cards<MemoryToggle label="Shuffle Cards" checked={question.shuffle} onChange={shuffle => update({ shuffle })} /></div></div>
                  <label>Peek At Start (seconds)<MemorySelect label="Peek at start" value={question.showCardsSeconds} options={["0", "1", "2", "3", "5", "10"]} onChange={showCardsSeconds => update({ showCardsSeconds })} /></label>
                  <label>Flip back delay (MS)<MemorySelect label="Flip back delay" value={question.flipBackDelay || "1000"} options={["500", "800", "1000", "1500", "2000"]} onChange={flipBackDelay => update({ flipBackDelay })} /></label>
                  <label>Time Limit (seconds)<input type="number" min="0" value={question.timeLimit || "0"} onChange={e => update({ timeLimit: e.target.value })} /></label>
                  <div className="memFigmaField"><span>Maximum Move</span><div className="memFigmaSwitchRow">Show move Counter<MemoryToggle label="Show move counter" checked={question.showMoveCounter ?? true} onChange={showMoveCounter => update({ showMoveCounter })} /></div></div>
                  <div className="memFigmaField"><span>Timer</span><div className="memFigmaSwitchRow">Show Timer<MemoryToggle label="Show timer" checked={question.showTimer ?? true} onChange={showTimer => update({ showTimer })} /></div></div>
                </div></section>
              </MemoryAccordion>
              <MemoryAccordion title="Grading Method" icon="grading" open={panelOpen.grading} onChange={() => switchPanel("grading")}>
                <div className="memFigmaSettingsGrid memFigmaGradeGrid">
                  <label>Grading Method<MemorySelect label="Grading Method" value={question.grading === "All or Nothing" ? "Equal Marks" : "Partial Credit"} options={["Equal Marks", "Partial Credit"]} onChange={v => update({ grading: v === "Equal Marks" ? "All or Nothing" : "Partial Credit" })} /></label>
                  <label>Points (total for Question)<input type="number" min="0.5" step="0.5" value={question.points} onChange={e => update({ points: e.target.value })} /></label>
                  <label>Negative Marking<MemorySelect label="Negative Marking" value={question.negativeMarking || "NA"} options={["NA", "0", "0.25", "0.5", "1"]} onChange={negativeMarking => update({ negativeMarking })} /></label>
                </div>
                <div className="memFigmaSwitchRow memFigmaWideSetting">Clicks outside every hotspot count as wrong <MemoryToggle label="Clicks outside as wrong" checked={question.clicksCountWrong ?? true} onChange={clicksCountWrong => update({ clicksCountWrong })} /></div>
                <div className="memFigmaSwitchRow memFigmaWideSetting">Calculate grade with a minimum score of 0 <MemoryToggle label="Minimum score zero" checked={question.minimumScoreZero ?? true} onChange={minimumScoreZero => update({ minimumScoreZero })} /></div>
              </MemoryAccordion>
              <MemoryAccordion title="Feedback" icon="feedback" open={panelOpen.feedback} onChange={() => switchPanel("feedback")} count={`${Math.max(question.feedbackFull.length, question.feedbackPartial.length, question.feedbackZero.length)}/250`}>
                <MemoryTextEditor {...memoryEditorProps("feedbackFull")} label="Full Marks" value={question.feedbackFull} onChange={feedbackFull => update({ feedbackFull })} placeholder="Feedback for full marks" accent="#2A7308" />
                <MemoryTextEditor {...memoryEditorProps("feedbackPartial")} label="Partial Marks" value={question.feedbackPartial} onChange={feedbackPartial => update({ feedbackPartial })} placeholder="Feedback for partial marks" accent="#C05512" />
                <MemoryTextEditor {...memoryEditorProps("feedbackZero")} label="Zero Marks" value={question.feedbackZero} onChange={feedbackZero => update({ feedbackZero })} placeholder="Feedback for zero marks" accent="#A91E2C" />
              </MemoryAccordion>
              <MemoryAccordion title="Explanation" icon="explanation" open={panelOpen.explanation} onChange={() => switchPanel("explanation")} count={`${question.explanation.length}/250`}>
                <MemoryTextEditor {...memoryEditorProps("explanation")} value={question.explanation} onChange={explanation => update({ explanation })} placeholder="Explain the correct matching pairs" />
              </MemoryAccordion>
              <MemoryAccordion title="Hint" icon="hint" open={panelOpen.hint} onChange={() => switchPanel("hint")} count={`${question.hint.length}/250`}>
                <MemoryTextEditor {...memoryEditorProps("hint")} value={question.hint} onChange={hint => update({ hint })} placeholder="Enter a hint for learners" />
                <label className="memFigmaCheckbox"><input type="checkbox" checked={question.showHintBefore ?? true} onChange={e => update({ showHintBefore: e.target.checked })} /> Show hint before answering</label>
                <label className="memFigmaCheckbox"><input type="checkbox" checked={question.allowHintRequest ?? false} onChange={e => update({ allowHintRequest: e.target.checked })} /> Allow learner to request hint</label>
              </MemoryAccordion>
            </div>
            {validated && memoryErrors(question).length > 0 && <div className="memErrors" role="alert">{memoryErrors(question).map(error => <p key={error}>{error}</p>)}</div>}
            <div className="memFigmaCenter memFigmaAddQuestions"><button type="button" className="memFigmaButton memFigmaButtonBlue" onClick={addQuestion}><Icon name="add" /> Add Questions</button></div>
          </section>
          <footer className="memFigmaFooter"><button type="button" className="memFigmaButton" disabled={continuing} onClick={() => router.push("/assessments/create/details")}>Back</button><button type="button" className="memFigmaButton" onClick={() => { save(false); setNotice(""); setPreview(true); scroll.current?.scrollTo({ top: 0 }); }}>Preview Questions</button><div><button type="button" className="memFigmaButton" onClick={() => save()}>Save</button>{continuing && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="memFigmaButton memFigmaButtonGreen" disabled={continuing} onClick={continueToEvaluation}>Continue</button></div></footer>
        </div>
        <aside className="memFigmaAside"><h2>Question Settings</h2>
          <label>Points<input type="number" min="0.5" step="0.5" value={question.points} onChange={e => update({ points: e.target.value })} /></label>
          <label>Difficulty<MemorySelect label="Difficulty" value={question.difficulty} options={["Easy", "Medium", "Hard"]} onChange={difficulty => update({ difficulty })} /></label>
          <label>Category<MemorySelect label="Category" value={question.category} options={categories} onChange={category => update({ category })} /></label>
          <label>Bloom&apos;s Taxonomy<MemorySelect label="Bloom's Taxonomy" value={question.bloom} options={blooms} onChange={bloom => update({ bloom })} /></label>
          <div className="memFigmaTags"><strong>Tag</strong><button type="button" onClick={() => setEditingTag(!editingTag)}><Icon name="add" size={16} /> Add Tag</button>
            {editingTag && <div className="memFigmaTagEditor"><input autoFocus aria-label="New tag" value={tagText} onChange={e => setTagText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} /><button type="button" onClick={addTag}>Add</button></div>}
            <div>{question.tags.map(tag => <button type="button" className="memFigmaTag" key={tag} onClick={() => update({ tags: question.tags.filter(t => t !== tag) })}>{tag} ×</button>)}</div>
          </div>
          <div className="memFigmaMandatory">Mandatory<MemoryToggle label="Mandatory question" checked={question.mandatory} onChange={mandatory => update({ mandatory })} /></div><small>This Question is Mandatory</small>
        </aside></div>
        {notice && <p className={notice === "Saved" ? "mcqcSaveSuccessToast" : "memNotice"} role={notice === "Saved" ? "status" : "alert"}>{notice}</p>}
      </>}
    </div></div></section>
  </div></main>;
}
