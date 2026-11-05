"use client";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import "./scratch.css";

type Mode = "draw" | "notes";
type Tool = "pen" | "highlighter" | "eraser";
type Pad = { id: string; question: number; title: string; mode: Mode; notes: string; image: string; updated: string };
type Question = { text?: string };
const STORE = "viewerScratchPads";
const ICONS = "/assets/viewericons/";
const COLORS = ["#2D4CC8", "#2F3547", "#C05512", "#2A7308", "#C51F3A", "#760078"];
const BRUSHES = [{ value: 2, label: "Fine (2 px)" }, { value: 4, label: "Medium (4 px)" }, { value: 8, label: "Thick (8 px)" }, { value: 14, label: "Extra thick (14 px)" }];
function Icon({ name, size = 18 }: { name: string; size?: number }) { return <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" />; }

function Menu<T extends string | number>({ label, value, options, onChange, className = "" }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); }; const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]);
  const selected = options.find(o => o.value === value)?.label || "Select";
  return <div className={`scratchMenuField ${className}`} ref={root}><label>{label}</label><button type="button" className="scratchMenuTrigger" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(v => !v)}><span>{selected}</span><Icon name="arrow-down.svg" size={24} /></button>{open && <div className="scratchMenuList" role="listbox" aria-label={label}>{options.map(option => <button type="button" role="option" aria-selected={option.value === value} key={String(option.value)} className={option.value === value ? "selected" : ""} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}</div>;
}

export default function ScratchPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const previous = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const drawByQuestion = useRef<Record<number, string>>({});
  const notesByQuestion = useRef<Record<number, string>>({});
  const questionRef = useRef(2);
  const [question, setQuestion] = useState(2);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [mode, setMode] = useState<Mode>("draw");
  const [paper, setPaper] = useState<"plain" | "grid" | "ruled">("plain");
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const sheetDrag = useRef<{ startY: number; startHeight: number } | null>(null);
  const resizeSnapshot = useRef<HTMLCanvasElement | null>(null);
  const [brush, setBrush] = useState(4);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<Pad[]>([]);
  const [filter, setFilter] = useState<"all" | "draw" | "notes">("all");
  const [status, setStatus] = useState("Not saved yet");
  const [ready, setReady] = useState(false);
  const questionText = questions[question - 1]?.text || (question === 2 ? "Which data structure follows the LIFO Principle?" : "Select or work on this question.");

  useEffect(() => {
    try {
      const draft = JSON.parse(assessmentStorage.getItem("oneWordContentDraft") || assessmentStorage.getItem("oneWordPreviewDraft") || assessmentStorage.getItem("mcqContentDraft") || "{}");
      const assessment = JSON.parse(assessmentStorage.getItem("oneWordAssessmentDraft") || assessmentStorage.getItem("mcqAssessmentDraft") || "{}");
      const list = Array.isArray(draft.questions) ? draft.questions : [];
      const count = list.length || Number(assessment.questionCount) || 20;
      setQuestions(list); setQuestionCount(Math.max(1, Math.min(300, count)));
      const index = Number(assessmentStorage.getItem("viewerCurrentQuestion") ?? "1");
      const start = Number.isFinite(index) ? Math.min(Math.max(1, count), Math.max(1, index + 1)) : 2;
      setQuestion(start); questionRef.current = start;
      const stored = JSON.parse(assessmentStorage.getItem(STORE) || "[]") as Pad[];
      if (Array.isArray(stored)) { setSaved(stored); for (const pad of stored) { if (pad.image) drawByQuestion.current[pad.question] = pad.image; notesByQuestion.current[pad.question] = pad.notes || ""; } const matching = stored.find(p => p.question === start); if (matching) { setNotes(matching.notes || ""); setMode(matching.mode); setStatus("Saved"); } }
    } catch { /* Use the provided reference values if no saved assessment exists. */ }
    setReady(true);
  }, []);

  // Drag the line below the paper to resize vertically; pen input stays on the canvas.
  const resizeSheetDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.width && canvas.height) {
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      resizeSnapshot.current = snapshot;
    }
    sheetDrag.current = {
      startY: event.clientY,
      startHeight: paperRef.current?.getBoundingClientRect().height || 380,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const resizeSheetMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sheetDrag.current) return;
    const next = sheetDrag.current.startHeight + event.clientY - sheetDrag.current.startY;
    setSheetHeight(Math.max(180, Math.min(2400, Math.round(next))));
  };
  const resizeSheetEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    sheetDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // The latest canvas is now the source for subsequent drawing and resizing.
    resizeSnapshot.current = null;
  };
  const resizeSheetWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const currentHeight = paperRef.current?.getBoundingClientRect().height || 380;
    const delta = (event.shiftKey ? 100 : 30) * (event.key === "ArrowDown" ? 1 : -1);
    setSheetHeight(Math.max(180, Math.min(2400, Math.round(currentHeight + delta))));
  };
  const imageData = useCallback(() => canvasRef.current?.toDataURL("image/png") || "", []);
  const paintImage = useCallback((data: string) => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const image = new Image(); image.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); }; image.src = data;
  }, []);
  useEffect(() => {
    if (!ready) return;
    const paper = paperRef.current; const canvas = canvasRef.current; if (!paper || !canvas) return;
    const resize = () => {
      const rect = paper.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.getBoundingClientRect().width * dpr);
      const height = Math.round(canvas.getBoundingClientRect().height * dpr);
      if (canvas.width === width && canvas.height === height) return;
      const previous = resizeSnapshot.current || document.createElement("canvas");
      if (!resizeSnapshot.current && canvas.width && canvas.height) {
        previous.width = canvas.width; previous.height = canvas.height;
        previous.getContext("2d")?.drawImage(canvas, 0, 0);
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        if (previous.width && previous.height) ctx.drawImage(previous, 0, 0);
        else if (drawByQuestion.current[questionRef.current]) paintImage(drawByQuestion.current[questionRef.current]);
      }
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(paper); return () => observer.disconnect();
  }, [ready, imageData, paintImage]);
  const switchQuestion = (value: number) => {
    drawByQuestion.current[questionRef.current] = imageData(); notesByQuestion.current[questionRef.current] = notes;
    questionRef.current = value; setQuestion(value); setNotes(notesByQuestion.current[value] || ""); undoStack.current = []; redoStack.current = [];
    const match = saved.find(p => p.question === value); if (match) { setMode(match.mode); setStatus("Saved"); } else setStatus("Not saved yet");
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (canvas && ctx) { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); } if (drawByQuestion.current[value]) paintImage(drawByQuestion.current[value]);
  };
  const remember = () => { const snap = imageData(); if (snap) { undoStack.current.push(snap); if (undoStack.current.length > 40) undoStack.current.shift(); redoStack.current = []; } };
  const position = (event: ReactPointerEvent<HTMLCanvasElement>) => { const r = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - r.left) * event.currentTarget.width / r.width, y: (event.clientY - r.top) * event.currentTarget.height / r.height }; };
  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (mode !== "draw") return; resizeSnapshot.current = null; remember(); drawing.current = true; previous.current = position(event); event.currentTarget.setPointerCapture(event.pointerId); setStatus("Unsaved changes"); const ctx = event.currentTarget.getContext("2d"); if (ctx && previous.current) { ctx.beginPath(); ctx.arc(previous.current.x, previous.current.y, Math.max(1, brush / 2), 0, Math.PI * 2); ctx.fillStyle = tool === "eraser" ? "#FFFFFF" : color; ctx.globalAlpha = tool === "highlighter" ? .3 : 1; ctx.fill(); ctx.globalAlpha = 1; } };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (!drawing.current || !previous.current) return; const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!ctx || !canvas) return; const next = position(event); const scale = canvas.width / Math.max(1, canvas.getBoundingClientRect().width); ctx.beginPath(); ctx.moveTo(previous.current.x, previous.current.y); ctx.lineTo(next.x, next.y); ctx.lineWidth = (tool === "eraser" ? 24 : tool === "highlighter" ? brush * 3 : brush) * scale; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = tool === "highlighter" ? .3 : 1; ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color; ctx.stroke(); ctx.globalAlpha = 1; previous.current = next; };
  const up = () => { drawing.current = false; previous.current = null; drawByQuestion.current[questionRef.current] = imageData(); };
  const undo = () => { const item = undoStack.current.pop(); if (item) { redoStack.current.push(imageData()); paintImage(item); setStatus("Unsaved changes"); } };
  const redo = () => { const item = redoStack.current.pop(); if (item) { undoStack.current.push(imageData()); paintImage(item); setStatus("Unsaved changes"); } };
  const clear = () => { remember(); const c = canvasRef.current; const ctx = c?.getContext("2d"); if (c && ctx) { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, c.width, c.height); } drawByQuestion.current[question] = ""; setNotes(""); notesByQuestion.current[question] = ""; setStatus("Unsaved changes"); };
  const save = () => { const item: Pad = { id: `q-${question}`, question, title: questionText, mode, notes, image: imageData(), updated: new Date().toLocaleString() }; const next = [item, ...saved.filter(p => p.id !== item.id)]; try { assessmentStorage.setItem(STORE, JSON.stringify(next)); setSaved(next); drawByQuestion.current[question] = item.image; notesByQuestion.current[question] = notes; setStatus("Saved"); } catch { setStatus("Unable to save: storage is full"); } };
  const loadPad = (pad: Pad) => { switchQuestion(pad.question); setMode(pad.mode); setNotes(pad.notes); if (pad.image) paintImage(pad.image); setStatus("Saved"); };
  const download = () => { const c = canvasRef.current; if (!c) return; const output = document.createElement("canvas"); output.width = c.width; output.height = c.height + (notes.trim() ? 240 : 0); const ctx = output.getContext("2d"); if (!ctx) return; ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, output.width, output.height); ctx.drawImage(c, 0, 0); if (notes.trim()) { ctx.fillStyle = "#2F3547"; ctx.font = "26px Segoe UI"; notes.split("\n").slice(0, 6).forEach((line, i) => ctx.fillText(line.slice(0, 90), 24, c.height + 39 + i * 32)); } const anchor = document.createElement("a"); anchor.href = output.toDataURL("image/png"); anchor.download = `scratch-pad-question-${question}.png`; anchor.click(); };
  const back = () => { drawByQuestion.current[question] = imageData(); notesByQuestion.current[question] = notes; assessmentStorage.setItem("viewerCurrentQuestion", String(question - 1)); router.push(viewerPath()); };
  const switchTool = (path: string) => {
    try { assessmentStorage.setItem("viewerCurrentQuestion", String(question - 1)); } catch {}
    router.push(path);
  };
  const filteredPads = saved.filter(p => filter === "all" || p.mode === filter);

  return <main className="scratchAppShell"><div className="scratchScroll"><div className="scratchGrid"><section className="scratchWorkspace"><div className="scratchTop"><div><h1>Scratch Pad</h1><p>Work out answers here. Your notes stay private and are saved for each question.</p></div><span className={status === "Saved" ? "scratchStatus saved" : "scratchStatus"}>{status}</span></div><div className="scratchQuestion"><strong>Question {question}</strong><span>· {questionText}</span></div><div className="scratchControls"><Menu label="Question" value={question} options={Array.from({ length: questionCount }, (_, i) => ({ value: i + 1, label: `Question ${i + 1}` }))} onChange={switchQuestion} className="scratchQuestionMenu"/><Menu<"plain" | "grid" | "ruled"> label="Paper" value={paper} options={[{ value: "plain", label: "Plain" }, { value: "grid", label: "Grid" }, { value: "ruled", label: "Ruled" }]} onChange={v => setPaper(v)} /><Menu<number> label="Brush size" value={brush} options={BRUSHES} onChange={setBrush}/></div><div className="scratchTabs"><button type="button" className={mode === "draw" ? "active" : ""} onClick={() => setMode("draw")}>Draw</button><button type="button" className={mode === "notes" ? "active" : ""} onClick={() => setMode("notes")}>Type notes</button></div>{mode === "draw" && <div className="scratchToolbar"><button type="button" className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}><Icon name="pen.svg"/>Pen</button><button type="button" className={tool === "highlighter" ? "active" : ""} onClick={() => setTool("highlighter")}><svg className="scratchInlineIcon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 11 4 4"/><path d="M4 20h7"/><path d="m13 15 7-7a2.12 2.12 0 0 0-3-3l-7 7-2 5 5-2Z"/><path d="m3 21 5-5"/></svg>Highlighter</button><button type="button" className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}><svg className="scratchInlineIcon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m20 20-8.5-8.5"/><path d="M20.1 15.9a2.8 2.8 0 0 0 0-4L13 4.8a2.8 2.8 0 0 0-4 0L3.9 9.9a2.8 2.8 0 0 0 0 4L10 20h10"/><path d="M10 20H4"/></svg>Eraser</button><div className="scratchColors">{COLORS.map(c => <button type="button" key={c} className={color === c ? "chosen" : ""} style={{ backgroundColor: c }} aria-label={`Select color ${c}`} onClick={() => { setColor(c); setTool("pen"); }}/>)}</div><button type="button" onClick={undo}><Icon name="undo.svg"/>Undo</button><button type="button" onClick={redo}><Icon name="redo.svg"/>Redo</button><button type="button" onClick={clear}><Icon name="cancel.svg"/>Clear</button></div>}<div className={`scratchPaper ${paper} ${mode === "notes" ? "is-notes" : ""}`} ref={paperRef} style={sheetHeight === null ? undefined : { height: `${sheetHeight}px` }}><canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: "none", pointerEvents: mode === "draw" ? "auto" : "none" }} aria-label="Scratch Pad drawing canvas" />{mode === "notes" && <textarea value={notes} onChange={e => { setNotes(e.target.value); notesByQuestion.current[question] = e.target.value; setStatus("Unsaved changes"); }} placeholder="Type your working here..." aria-label="Typed notes"/>}<button type="button" className="scratchResizeHandle" aria-label="Drag bottom edge to make the sheet longer or shorter" title="Drag up or down to resize the sheet" onPointerDown={resizeSheetDown} onPointerMove={resizeSheetMove} onPointerUp={resizeSheetEnd} onPointerCancel={resizeSheetEnd} onKeyDown={resizeSheetWithKeyboard}><span className="scratchResizeLine"/></button></div><div className="scratchFooter"><button type="button" onClick={back}><Icon name="arrowleft.svg"/>Back to Question</button><div><button type="button" onClick={download}><Icon name="download.svg"/>Download PNG</button><button type="button" className="scratchSave" onClick={save}>Save</button></div></div></section><aside className="scratchAside"><h2>My Scratch Pads</h2><p>{saved.length} of {questionCount} questions saved</p><Menu<"all" | "draw" | "notes"> label="Show" value={filter} options={[{ value: "all", label: "All saved pads" }, { value: "draw", label: "With drawing" }, { value: "notes", label: "With typed notes" }]} onChange={setFilter}/><div className="scratchSavedList">{filteredPads.length ? filteredPads.map(p => <button key={p.id} type="button" onClick={() => loadPad(p)}><strong>Question {p.question}</strong><span>{p.mode === "notes" ? "Typed notes" : "Drawing"}</span></button>) : <p className="scratchEmpty">No saved scratch pads yet.<br/>Draw or type, then select Save<br/>to see it here.</p>}</div><h2 className="scratchToolsTitle">Tools</h2><div className="scratchToolLinks"><button type="button" className="teal"><Icon name="sticky-note.svg"/>Scratch Pad <Icon name="arrowupright.svg" size={16}/></button><button type="button" className="purple" onClick={() => switchTool(`${viewerPath()}/calculator`)}><Icon name="calculator.svg"/>Calculator <Icon name="arrowup.svg" size={16}/></button><button type="button" className="green" onClick={() => switchTool(`${viewerPath()}/formulasheet`)}><Icon name="sigma.svg"/>Formula Sheet <Icon name="arrowupg.svg" size={16}/></button></div></aside></div></div></main>;
}
