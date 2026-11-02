"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Header from "@/modules/assessments/components/common/header/Header";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import { assessmentStorage, getActiveAssessmentId } from "@/modules/assessments/storage/assessment-storage";
import "./viewai.css";

const ICONS = "/assets/aiicons/";
const PREFLIGHT_KEY = "aiInterviewPreflight";
const CONTENT_KEY = "aiContentDraft";
const SESSION_KEY = "aiInterviewSession";
const RESULT_KEY = "aiInterviewResult";
const scopedKey = (name: string) => {
  const id = getActiveAssessmentId() || (typeof window !== "undefined" ? window.location.pathname.match(/\/assessments\/([^/]+)\/viewer/)?.[1] : "") || "preview";
  return `${name}:${id}`;
};
const EVALUATION_KEY = "aiEvaluationDraft";

type CheckName = "microphone" | "camera" | "noise";
type CheckState = "Pending" | "Testing" | "Passed" | "Failed";
type CheckMap = Record<CheckName, CheckState>;
type CameraOption = { deviceId: string; label: string };
type InterviewInfo = { title: string; role: string; duration: number; language: string; questionCount: number; questions: string[] };
type ResultsEvaluation = { passingScore?: number; weights?: Record<string, number>; showFeedback?: boolean };
const RESULT_CRITERIA = [
  { id: "accuracy", title: "Content Accuracy", color: "#67096E", example: 83 },
  { id: "understanding", title: "Depth of understanding", color: "#2D4CC8", example: 73 },
  { id: "communication", title: "Communication clarity", color: "#E01E5A", example: 81 },
  { id: "confidence", title: "Confidence and fluency", color: "#2A7308", example: 76 },
  { id: "relevance", title: "Relevance to question", color: "#63560B", example: 84 },
] as const;
const DEFAULT_RESULT_WEIGHTS: Record<string, number> = { accuracy: 35, understanding: 25, communication: 20, confidence: 10, relevance: 10 };
// These are example rubric scores ONLY. They are not inferred from speech or graded by AI.
function readEvaluationSettings(): ResultsEvaluation {
  try {
    const raw = assessmentStorage.getItem(EVALUATION_KEY) || assessmentStorage.getItem("mcqAssessmentEvaluationDraft") || sessionStorage.getItem(EVALUATION_KEY);
    if (raw) return JSON.parse(raw) as ResultsEvaluation;
  } catch { /* Use reference defaults when evaluation settings are absent. */ }
  return {};
}

type BrowserSpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type BrowserSpeechRecognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<BrowserSpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechBrowser = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const FALLBACK_QUESTIONS = [
  "Tell me about yourself and why you applied for this role.",
  "Describe a project where you solved a hard problem under a tight deadline.",
  "How do you handle a disagreement with a teammate?",
  "Describe a time when you had to learn something new quickly.",
  "Where do you see yourself in three years?",
];
const DEFAULT_INFO: InterviewInfo = {
  title: "AI Interview", role: "Software Engineer", duration: 20,
  language: "English (India)", questionCount: 5, questions: FALLBACK_QUESTIONS,
};
const CHECK_CONFIG: { id: CheckName; title: string; description: string; icon: string; color: string }[] = [
  { id: "microphone", title: "Microphone Check", description: "Speak normally while the meter moves", icon: "mic-vocal.svg", color: "purple" },
  { id: "camera", title: "Camera check", description: "Keep your face clearly visible", icon: "camera-01.svg", color: "pink" },
  { id: "noise", title: "Background noise (limit 55 dB)", description: "Stay silent for 3 seconds", icon: "volume-off.svg", color: "blue" },
];

function Asset({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const [missing, setMissing] = useState(false);
  return missing ? <span aria-hidden="true" className="viewaiMissingIcon" />
    : <img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true" className={className} onError={() => setMissing(true)} />;
}
function SuccessIcon() {
  return <Asset name="checkmark-badge.svg" size={15} />;
}
function wordsFromHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ").trim();
  const el = document.createElement("div");
  el.textContent = "";
  el.innerHTML = html;
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}
function readInfo(): InterviewInfo {
  const info = { ...DEFAULT_INFO, questions: [] as string[] };
  try {
    const raw = assessmentStorage.getItem(CONTENT_KEY) || sessionStorage.getItem(CONTENT_KEY);
    if (raw) {
      const content = JSON.parse(raw) as Record<string, unknown>;
      if (typeof content.targetRole === "string" && content.targetRole.trim()) info.role = content.targetRole.trim();
      if (Array.isArray(content.questions)) {
        const saved = content.questions.map((item: unknown) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object" && "html" in item && typeof item.html === "string") return wordsFromHtml(item.html);
          return "";
        }).filter((item: string) => item.length > 0);
        if (saved.length) info.questions = saved;
      }
      const count = Number(content.questionCount);
      if (Number.isInteger(count) && count > 0 && count <= 100) info.questionCount = count;
    }
    const configRaw = assessmentStorage.getItem("aiInterviewViewerConfig") || sessionStorage.getItem("aiInterviewViewerConfig");
    if (configRaw) {
      const config = JSON.parse(configRaw) as Record<string, unknown>;
      if (typeof config.title === "string" && config.title.trim()) info.title = config.title.trim();
      else if (typeof config.assessmentName === "string" && config.assessmentName.trim()) info.title = config.assessmentName.trim();
      if (typeof config.targetRole === "string" && config.targetRole.trim()) info.role = config.targetRole.trim();
      if (typeof config.language === "string" && config.language.trim()) info.language = config.language.trim();
      const minutes = Number(config.durationMinutes ?? config.duration);
      if (Number.isFinite(minutes) && minutes > 0 && minutes <= 240) info.duration = Math.round(minutes);
    }
  } catch { /* Use displayed defaults if the creator's storage isn't present. */ }
  info.questions = info.questions.slice(0, Math.min(info.questionCount, 100));
  info.questionCount = info.questions.length;
  return info;
}
function cameraFailureMessage(error: unknown): string {
  const err = error as { name?: string; message?: string } | null;
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Camera blocked. In Chrome, open the site settings next to localhost:3000 and allow Camera. On Mac, check System Settings → Privacy & Security → Camera → Chrome, then retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Chrome could not find a usable camera. Check the detected camera list below, Chrome camera permissions, and macOS Camera access, then retry.";
    case "NotReadableError":
    case "TrackStartError":
      return "Camera is in use or unavailable. Close Zoom/Meet/other camera apps, then retry.";
    case "OverconstrainedError":
      return "This camera does not support the requested settings. Retest to use the default camera.";
    case "AbortError":
      return "Camera startup was interrupted. Retry the Camera check.";
    default:
      return err?.message?.trim() || "Camera could not start. Check Chrome camera access and retry.";
  }
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={value} className={`viewaiToggle${value ? " viewaiToggleOn" : ""}`} onClick={() => onChange(!value)}>
    <span className="viewaiToggleTrack"><span className="viewaiToggleLabel">{value ? "ON" : "OFF"}</span></span>
    <span className="viewaiToggleKnob" aria-hidden="true" />
  </button>;
}
function Waveform({ active, level = 40, phase = 0, large = false }: { active: boolean; level?: number; phase?: number; large?: boolean }) {
  return <div className={`viewaiWave${large ? " viewaiWaveLarge" : ""}${active ? " viewaiWaveLive" : ""}`} aria-label={active ? "Audio activity" : undefined} aria-hidden="true">
    {Array.from({ length: large ? 28 : 24 }, (_, index) => {
      const shape = 0.35 + 0.65 * Math.abs(Math.sin(index * 1.13 + phase * 0.68));
      const height = active ? Math.max(4, Math.round(4 + shape * Math.max(18, level) * (large ? .33 : .25))) : 9 + Math.round(shape * 7);
      return <span key={index} style={{ height: `${Math.min(large ? 29 : 27, height)}px` }} />;
    })}
  </div>;
}
function formatTime(seconds: number): [string, string, string] {
  const n = Math.max(0, Math.floor(seconds));
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60].map(value => String(value).padStart(2, "0")) as [string, string, string];
}
function Clock({ seconds }: { seconds: number }) {
  const parts = formatTime(seconds);
  return <div className="viewaiClock" role="timer" aria-label={`Time remaining ${parts.join(":")}`}>
    {parts.map((group, i) => <span className="viewaiClockSegment" key={i}>
      {i > 0 && <span className="viewaiClockColon">:</span>}
      {group.split("").map((digit, j) => <span className="viewaiClockDigit" key={j}>{digit}</span>)}
    </span>)}
  </div>;
}

export default function AIInterviewPreparationPage() {
  const [info, setInfo] = useState<InterviewInfo>(DEFAULT_INFO);
  const [checks, setChecks] = useState<CheckMap>({ microphone: "Pending", camera: "Pending", noise: "Pending" });
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraDiagnostics, setCameraDiagnostics] = useState("");
  const [cameraDevices, setCameraDevices] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [voiceFlag, setVoiceFlag] = useState(true);
  const [tabFlag, setTabFlag] = useState(true);
  const [accepted, setAccepted] = useState(true);
  const [notice, setNotice] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [phase, setPhase] = useState(0);
  const [screen, setScreen] = useState<"instructions" | "preflight" | "interview" | "success" | "result">("instructions");
  const [instructionAccepted, setInstructionAccepted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [finished, setFinished] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [evaluation, setEvaluation] = useState<ResultsEvaluation>({});
  const appElement = useRef<HTMLDivElement>(null);
  const sidebarElement = useRef<HTMLElement>(null);
  const cameraElement = useRef<HTMLVideoElement>(null);
  const cameraRequest = useRef(0);
  const cameraStream = useRef<MediaStream | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const recognition = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const wantsListening = useRef(false);
  const restartListeningTimer = useRef<number | null>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const questionVoiceTimer = useRef<number | null>(null);
  const questionVoiceFallback = useRef<number | null>(null);
  const questionVoiceToken = useRef(0);
  const isMounted = useRef(false);
  const blurGuard = useRef(0);
  const busy = Object.values(checks).some(value => value === "Testing");
  const answered = Object.values(answers).filter(value => value.trim()).length;
  const progress = info.questionCount ? Math.round(answered / info.questionCount * 100) : 0;
  const secondsRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : info.duration * 60;

  // Keep the same responsive, collapsible shared Sidebar used in the other assessments.
  useEffect(() => {
    const shell = appElement.current;
    const aside = sidebarElement.current;
    if (!shell || !aside) return;
    let frame = 0;
    const measure = () => {
      const origin = aside.getBoundingClientRect();
      const nodes = [aside.firstElementChild, ...aside.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']")];
      const widths = nodes.flatMap(node => {
        if (!(node instanceof HTMLElement)) return [];
        const rect = node.getBoundingClientRect();
        if (rect.width < 64 || rect.width > 360 || Math.abs(rect.left - origin.left) > 25) return [];
        return [rect.width];
      });
      const width = Math.max(0, ...widths);
      if (width >= 64) shell.style.setProperty("--viewai-sidebar-width", Math.round(width) + "px");
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    if (typeof ResizeObserver === "undefined") { measure(); return; }
    const resize = new ResizeObserver(schedule);
    resize.observe(aside);
    if (aside.firstElementChild) resize.observe(aside.firstElementChild);
    const mutation = new MutationObserver(schedule);
    mutation.observe(aside, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "aria-expanded", "data-state"] });
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener("resize", schedule); };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    setInfo(readInfo());
    setEvaluation(readEvaluationSettings());
    let restored: string | null = null;
    try { restored = sessionStorage.getItem(scopedKey(SESSION_KEY)); } catch { /* Storage can be disabled. */ }
    if (restored) {
      try {
        const saved = JSON.parse(restored) as { answers?: Record<number, string>; current?: number; expiresAt?: number; finished?: boolean; tabSwitches?: number };
        if (saved.answers && typeof saved.answers === "object") setAnswers(saved.answers);
        if (Number.isInteger(saved.current) && Number(saved.current) >= 0) setCurrent(Number(saved.current));
        if (typeof saved.expiresAt === "number" && saved.expiresAt > 0) setExpiresAt(saved.expiresAt);
        if (saved.finished) { setFinished(true); setScreen("result"); }
        if (Number.isInteger(saved.tabSwitches)) setTabSwitches(saved.tabSwitches || 0);
        if (saved.expiresAt && !saved.finished) setScreen("interview");
      } catch { /* Ignore invalid prior session. */ }
    }
    return () => {
      isMounted.current = false;
      wantsListening.current = false;
      recognition.current?.abort();
      if (restartListeningTimer.current !== null) window.clearTimeout(restartListeningTimer.current);
      if (questionVoiceTimer.current !== null) window.clearTimeout(questionVoiceTimer.current);
      if (questionVoiceFallback.current !== null) window.clearTimeout(questionVoiceFallback.current);
      window.speechSynthesis?.cancel();
      cameraRequest.current += 1;
      cameraStream.current?.getTracks().forEach(track => track.stop());
      audioStream.current?.getTracks().forEach(track => track.stop());
      if (audioContext.current) void audioContext.current.close().catch(() => {});
    };
  }, []);

  // Available video input devices. Camera selection remains controlled by Chrome/macOS.
  const scanCameraDevices = useCallback(async (): Promise<CameraOption[] | null> => {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    try {
      const found = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === "videoinput")
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || ("Camera " + (index + 1)) }));
      if (isMounted.current) setCameraDevices(found);
      return found;
    } catch { return null; }
  }, []);

  useEffect(() => {
    void scanCameraDevices();
    const changed = () => { void scanCameraDevices(); };
    navigator.mediaDevices?.addEventListener?.("devicechange", changed);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", changed);
  }, [scanCameraDevices]);

  useEffect(() => {
    if (cameraElement.current) {
      cameraElement.current.srcObject = cameraStream.current;
      if (cameraOn) void cameraElement.current.play().catch(() => {});
    }
  }, [cameraOn, screen]);

  useEffect(() => {
    if (screen !== "interview" || finished) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [screen, finished]);

  useEffect(() => {
    if (screen !== "interview") return;
    try { sessionStorage.setItem(scopedKey(SESSION_KEY), JSON.stringify({ current, answers, expiresAt, finished, tabSwitches })); }
    catch { /* Keep working if browser storage is restricted. */ }
  }, [screen, current, answers, expiresAt, finished, tabSwitches]);

  const stopSpeech = useCallback(() => {
    wantsListening.current = false;
    if (restartListeningTimer.current !== null) {
      window.clearTimeout(restartListeningTimer.current);
      restartListeningTimer.current = null;
    }
    const instance = recognition.current;
    recognition.current = null;
    if (instance) {
      instance.onend = null;
      instance.onresult = null;
      instance.onerror = null;
      try { instance.stop(); } catch { /* Already stopped. */ }
    }
    setListening(false);
  }, []);
  const cancelQuestionVoice = useCallback(() => {
    questionVoiceToken.current += 1;
    if (questionVoiceTimer.current !== null) window.clearTimeout(questionVoiceTimer.current);
    if (questionVoiceFallback.current !== null) window.clearTimeout(questionVoiceFallback.current);
    questionVoiceTimer.current = null;
    questionVoiceFallback.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (screen !== "interview" || finished || !tabFlag) return;
    const recordSwitch = () => {
      if (Date.now() - blurGuard.current < 900) return;
      blurGuard.current = Date.now();
      setTabSwitches(value => value + 1);
    };
    const visibility = () => { if (document.hidden) recordSwitch(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", recordSwitch);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", recordSwitch); };
  }, [screen, finished, tabFlag]);

  const setCheck = useCallback((id: CheckName, value: CheckState) => {
    if (isMounted.current) setChecks(previous => ({ ...previous, [id]: value }));
  }, []);
  const turnCameraOff = useCallback(() => {
    cameraRequest.current += 1;
    setCameraError("");
    setCameraDiagnostics("");
    cameraStream.current?.getTracks().forEach(track => track.stop());
    cameraStream.current = null;
    if (cameraElement.current) cameraElement.current.srcObject = null;
    setCameraOn(false);
    setCheck("camera", "Pending");
  }, [setCheck]);

  const finishInterview = useCallback((latestAnswers?: Record<number, string>) => {
    cancelQuestionVoice();
    stopSpeech();
    turnCameraOff();
    const finalAnswers = latestAnswers ?? answers;
    setAnswers(finalAnswers);
    setFinished(true);
    setScreen("success");
    setNotice("");
    try {
      sessionStorage.setItem(scopedKey(SESSION_KEY), JSON.stringify({ current, answers: finalAnswers, expiresAt, finished: true, tabSwitches }));
      sessionStorage.setItem(scopedKey(RESULT_KEY), JSON.stringify({ title: info.title, role: info.role, questions: info.questions, answers: finalAnswers, tabSwitches, completedAt: new Date().toISOString(), scoringMode: "example-only" }));
    } catch { /* Local storage can be unavailable. */ }
  }, [cancelQuestionVoice, stopSpeech, turnCameraOff, current, expiresAt, info, answers, tabSwitches]);

  useEffect(() => {
    if (screen === "interview" && !finished && expiresAt && secondsRemaining === 0) finishInterview();
  }, [screen, finished, expiresAt, secondsRemaining, finishInterview]);

  useEffect(() => {
    if (!busy && !listening) return;
    const interval = window.setInterval(() => setPhase(previous => previous + 1), 100);
    return () => clearInterval(interval);
  }, [busy, listening]);

  const turnCameraOn = useCallback(async (): Promise<boolean> => {
    const attempt = ++cameraRequest.current;
    setCameraError("");
    setCameraDiagnostics("");
    let acquired: MediaStream | null = null;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires HTTPS or localhost. Open the assessment on http://localhost:3000 and retry.");
      }
      let stream = cameraStream.current;
      if (!stream?.getVideoTracks().some(track => track.readyState === "live")) {
        // Use the browser default FIRST. A facingMode constraint can fail on desktop webcams.
        // If a particular detected camera was selected, try it once before the default.
        const requests: MediaStreamConstraints[] = selectedCameraId
          ? [{ video: { deviceId: { exact: selectedCameraId } }, audio: false }, { video: true, audio: false }]
          : [{ video: true, audio: false }];
        let lastError: unknown = null;
        for (const constraints of requests) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            acquired = stream;
            break;
          } catch (error) {
            lastError = error;
            const name = (error as { name?: string } | null)?.name;
            // A denied permission or busy/unreadable camera cannot be fixed by more requests.
            if (name !== "NotFoundError" && name !== "DevicesNotFoundError" && name !== "OverconstrainedError") throw error;
          }
        }
        if (!stream) throw lastError ?? new Error("Chrome could not open a camera.");
      }
      if (!isMounted.current || attempt !== cameraRequest.current) {
        acquired?.getTracks().forEach(track => track.stop());
        return false;
      }
      const video = cameraElement.current;
      if (!video || !stream) throw new Error("Camera preview is not available. Please retry.");
      cameraStream.current = stream;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!video.videoWidth) {
        await new Promise<void>((resolve, reject) => {
          let completed = false;
          const done = (ok: boolean) => {
            if (completed) return;
            completed = true;
            window.clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", loaded);
            video.removeEventListener("loadeddata", loaded);
            video.removeEventListener("error", failed);
            ok ? resolve() : reject(new Error("Camera permission was granted, but Chrome did not receive video frames. Close other camera apps and retry."));
          };
          const loaded = () => { if (video.videoWidth > 0) done(true); };
          const failed = () => done(false);
          const timeout = window.setTimeout(() => done(video.videoWidth > 0), 5000);
          video.addEventListener("loadedmetadata", loaded);
          video.addEventListener("loadeddata", loaded);
          video.addEventListener("error", failed);
          if (video.videoWidth > 0) done(true);
        });
      }
      if (!isMounted.current || attempt !== cameraRequest.current) return false;
      if (!stream.getVideoTracks().some(track => track.readyState === "live") || video.videoWidth <= 0) {
        throw new Error("Chrome opened a camera but did not receive a live video preview. Retry the camera check.");
      }
      setCameraOn(true);
      setNotice("");
      await scanCameraDevices();
      return true;
    } catch (error) {
      if (attempt !== cameraRequest.current) { acquired?.getTracks().forEach(track => track.stop()); return false; }
      acquired?.getTracks().forEach(track => track.stop());
      cameraStream.current?.getTracks().forEach(track => track.stop());
      cameraStream.current = null;
      if (cameraElement.current) cameraElement.current.srcObject = null;
      setCameraOn(false);
      const found = await scanCameraDevices();
      if (attempt !== cameraRequest.current || !isMounted.current) return false;
      const name = (error as { name?: string } | null)?.name || "CameraError";
      setCameraDiagnostics(found === null
        ? `Browser error: ${name}. Chrome could not list camera devices.`
        : `Browser error: ${name}. Chrome detects ${found.length} camera${found.length === 1 ? "" : "s"}${found.length ? ` (${found.map(item => item.label).join(", ")})` : ""}.`);
      const message = cameraFailureMessage(error);
      setCameraError(message);
      setNotice(message);
      return false;
    }
  }, [selectedCameraId, scanCameraDevices]);
  const checkCamera = async () => {
    if (busy) return;
    setCheck("camera", "Testing");
    setNotice("");
    const good = await turnCameraOn();
    if (!isMounted.current) return;
    setCheck("camera", good ? "Passed" : "Failed");
    if (good) setNotice("Camera preview is running. Please confirm that your face is visible.");
  };
  const runAudioCheck = async (kind: "microphone" | "noise") => {
    if (busy) return;
    setCheck(kind, "Testing");
    setMicLevel(0);
    setNotice("");
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone requires HTTPS or localhost.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false }, video: false });
      audioStream.current = stream;
      context = new AudioContext();
      audioContext.current = context;
      if (context.state === "suspended") await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const start = performance.now();
      let peak = 0, total = 0, count = 0;
      await new Promise<void>(resolve => {
        const sample = () => {
          if (!isMounted.current) { resolve(); return; }
          analyser.getFloatTimeDomainData(samples);
          let squares = 0;
          for (const point of samples) squares += point * point;
          const rms = Math.sqrt(squares / samples.length);
          peak = Math.max(peak, rms);
          total += rms; count++;
          setMicLevel(Math.min(100, Math.round(rms * 1400)));
          if (performance.now() - start >= 3000) resolve();
          else window.setTimeout(sample, 75);
        };
        sample();
      });
      if (!isMounted.current) return;
      const dbfs = 20 * Math.log10(Math.max(total / Math.max(count, 1), .000001));
      if (kind === "microphone") {
        const passed = peak >= .008;
        setCheck(kind, passed ? "Passed" : "Failed");
        setNotice(passed ? "Voice detected by your microphone." : "No clear voice detected. Speak normally and select Retest.");
      } else {
        const passed = dbfs <= -35;
        setCheck(kind, passed ? "Passed" : "Failed");
        setNotice(passed ? "Background microphone signal is low. This is a relative noise check, not a calibrated 55 dB reading." : "Background microphone signal is high. Find a quieter place and select Retest.");
      }
    } catch (error) {
      setCheck(kind, "Failed");
      setNotice(error instanceof Error ? error.message : "Microphone permission denied or device unavailable.");
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      if (audioStream.current === stream) audioStream.current = null;
      if (context) await context.close().catch(() => {});
      if (audioContext.current === context) audioContext.current = null;
        if (isMounted.current) setMicLevel(0);
    }
  };

  const startListening = useCallback(() => {
    if (finished || !isMounted.current) return;
    stopSpeech();
    wantsListening.current = true;
    const browser = window as SpeechBrowser;
    const Ctor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Ctor) {
      wantsListening.current = false;
      setSpeechAvailable(false);
      setListening(false);
      setNotice("Speech recognition isn't supported by this browser. Type your answer in Live Transcript instead.");
      return;
    }
    const instance = new Ctor();
    recognition.current = instance;
    instance.lang = "en-IN";
    instance.continuous = true;
    instance.interimResults = true;
    const existing = transcriptRef.current.trim();
    instance.onresult = event => {
      if (recognition.current !== instance) return;
      let final = "", interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      const next = [existing, final.trim(), interim.trim()].filter(Boolean).join(" ");
      transcriptRef.current = next;
      setTranscript(next);
    };
    instance.onerror = event => {
      if (recognition.current !== instance) return;
      if (["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(event.error)) {
        wantsListening.current = false;
        setNotice(`Speech recognition: ${event.error}. You can type your answer if needed.`);
      }
    };
    instance.onend = () => {
      if (recognition.current !== instance) return;
      recognition.current = null;
      setListening(false);
      // Some browsers end recognition during pauses even with continuous=true.
      if (wantsListening.current && isMounted.current) {
        restartListeningTimer.current = window.setTimeout(() => {
          restartListeningTimer.current = null;
          if (wantsListening.current && isMounted.current) startListeningRef.current();
        }, 350);
      }
    };
    try { instance.start(); setListening(true); setNotice(""); }
    catch { recognition.current = null; wantsListening.current = false; setListening(false); setNotice("Unable to start speech recognition. Please type your answer."); }
  }, [finished, stopSpeech]);
  startListeningRef.current = startListening;

  const speakQuestion = useCallback((delayMs = 1000) => {
    // Repeat and initial question use the same speech path. The learner's transcript remains intact.
    stopSpeech();
    cancelQuestionVoice();
    setListening(false);
    const token = questionVoiceToken.current;
    questionVoiceTimer.current = window.setTimeout(() => {
      questionVoiceTimer.current = null;
      if (token !== questionVoiceToken.current || !isMounted.current) return;
      const text = info.questions[current] || "";
      if (!text || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
        setNotice("Question speech is unavailable in this browser. You can still answer aloud.");
        startListeningRef.current();
        return;
      }
      let resumed = false;
      const resumeAnswer = () => {
        if (resumed || token !== questionVoiceToken.current || !isMounted.current) return;
        resumed = true;
        if (questionVoiceFallback.current !== null) window.clearTimeout(questionVoiceFallback.current);
        questionVoiceFallback.current = null;
        startListeningRef.current();
      };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 1;
      utterance.onend = resumeAnswer;
      utterance.onerror = resumeAnswer;
      try {
        window.speechSynthesis.speak(utterance);
        const words = text.trim().split(/\s+/).length;
        questionVoiceFallback.current = window.setTimeout(resumeAnswer, Math.min(45000, Math.max(9000, words * 450 + 3500)));
      } catch { resumeAnswer(); }
    }, delayMs);
  }, [current, info.questions, stopSpeech, cancelQuestionVoice]);

  useEffect(() => {
    if (screen !== "interview" || finished) return;
    speakQuestion(1000);
    return () => cancelQuestionVoice();
  }, [screen, current, finished, speakQuestion, cancelQuestionVoice]);

  const startInterview = () => {
    const unpassed = CHECK_CONFIG.filter(item => checks[item.id] !== "Passed").map(item => item.title);
    if (unpassed.length) { setNotice(`Complete these checks first: ${unpassed.join(", ")}.`); return; }
    if (!cameraOn) { setNotice("Turn on your camera before starting."); return; }
    if (!accepted) { setNotice("Accept the proctoring rules before starting."); return; }
    const time = Date.now();
    blurGuard.current = time;
    setNow(time);
    setExpiresAt(time + info.duration * 60 * 1000);
    setScreen("interview");
    setCurrent(0); setAnswers({}); setTranscript(""); transcriptRef.current = ""; setFinished(false);
    try { sessionStorage.setItem(scopedKey(PREFLIGHT_KEY), JSON.stringify({ info, checks, voiceFlag, tabFlag, accepted, checkedAt: new Date().toISOString() })); }
    catch { /* UI remains usable. */ }
    // The question speaks once after one second; listening begins when the reading ends.
    // Live AI examiner/backend integration remains on hold.
  };
  const repeatQuestion = () => {
    if (finished) return;
    // Replay THIS question, then resume capturing the answer. Keep existing transcript.
    speakQuestion(150);
  };
  const submitAnswer = () => {
    if (finished) return;
    const answer = transcript.trim();
    if (!answer) { setNotice("Please speak or type an answer before submitting."); return; }
    stopSpeech();
    cancelQuestionVoice();
    const updated = { ...answers, [current]: answer };
    setAnswers(updated);
    try { sessionStorage.setItem(scopedKey(SESSION_KEY), JSON.stringify({ current: Math.min(current + 1, info.questionCount - 1), answers: updated, expiresAt, finished: false, tabSwitches })); }
    catch { /* No interruption to the interview. */ }
    setTranscript(""); transcriptRef.current = "";
    setNotice("");
    if (current >= info.questionCount - 1) {
      setShowSubmitConfirm(true);
      setTranscript(answer); transcriptRef.current = answer;
    } else {
      setCurrent(current + 1); // The question-change effect starts voice after one second.
    }
  };

  const restartInterview = () => {
    cancelQuestionVoice();
    stopSpeech();
    turnCameraOff();
    setScreen("instructions");
    setInstructionAccepted(false); setShowSubmitConfirm(false);
    setFinished(false);
    setChecks({ microphone: "Pending", camera: "Pending", noise: "Pending" });
    setCurrent(0);
    setAnswers({});
    setTranscript(""); transcriptRef.current = "";
    setExpiresAt(0); setNow(0); setTabSwitches(0); setNotice("");
    setEvaluation(readEvaluationSettings());
    try { sessionStorage.removeItem(scopedKey(SESSION_KEY)); sessionStorage.removeItem(scopedKey(RESULT_KEY)); }
    catch { /* Restart remains available without storage. */ }
  };
  const minimumScore = Number.isFinite(evaluation.passingScore) ? Math.max(0, Math.min(100, evaluation.passingScore!)) : 60;
  // Preview only: sample values, not calculated from the student's answers.
  const weights = { ...DEFAULT_RESULT_WEIGHTS, ...evaluation.weights };
  const weightTotal = RESULT_CRITERIA.reduce((sum, item) => sum + (Number(weights[item.id]) || 0), 0);
  const previewScore = weightTotal > 0 ? Math.round(RESULT_CRITERIA.reduce((sum, item) => sum + item.example * (Number(weights[item.id]) || 0), 0) / weightTotal) : 0;

  return <div className="viewaiApp" ref={appElement}><aside className="viewaiSidebar" ref={sidebarElement}><Sidebar /></aside><div className="viewaiViewerContent"><main className="viewaiPage"><div className="viewaiShell">
    <div className="viewaiHeader"><Header /></div>
    <div className="viewaiScrollable">
      <div className="viewaiTopRow">
        <nav className="viewaiBreadcrumb" aria-label="Breadcrumb"><span>Dashboard</span><Asset name="arrow-right-double.svg" size={20}/><span>Assessment</span><Asset name="arrow-right-double.svg" size={20}/><strong>{info.title}</strong></nav>
        {screen === "interview" && <div className="viewaiTopStats"><span className="viewaiTabCounter"><Asset name="alert-01.svg" size={24}/>Tab Switches :{tabSwitches}</span><Clock seconds={secondsRemaining}/></div>}
      </div>
      {screen === "success" ? <section className="viewaiResults viewaiSuccess" aria-label="Submission complete"><div className="viewaiResultsIntro"><h1>Assessment Submitted Successfully</h1><p>Your answers have been saved. This assessment is awaiting evaluation.</p><button type="button" className="viewaiResultRestart" onClick={() => setScreen("result")}>View Results</button></div></section> : screen === "result" ? <section className="viewaiResults" aria-label="Interview results">
        <div className="viewaiResultsIntro">
          <div className="viewaiConfetti" aria-hidden="true"><img src={`${ICONS}blast.png`} alt="" onError={event => { event.currentTarget.style.visibility = "hidden"; }} /></div>
          <h1>Session Complete</h1>
          <strong className="viewaiResultsScore">Pending</strong>
          <span className="viewaiResultsOutcome">Awaiting evaluator feedback · Passing mark {minimumScore}%</span>
          <p className="viewaiDemoNote">Example rubric ({previewScore}%) — not your grade. AI grading is not connected yet.</p>
        </div>
        <div className="viewaiResultsRubrics">{RESULT_CRITERIA.map(item => <div className="viewaiResultRubric" key={item.id} style={{ "--result-color": item.color } as CSSProperties}>
          <strong>{item.title}</strong><div className="viewaiResultBarRow"><span className="viewaiResultBar"><span style={{ width: `${item.example}%` }}/></span><b>{item.example}%</b></div>
        </div>)}</div>
        <div className="viewaiResultFeedback"><h2>AI Feedback</h2><p>AI feedback will be available when the scoring service is connected. The rubric percentages above are sample values for layout preview only.</p></div>
        <div className="viewaiResultFlag">Proctoring : {tabSwitches} Tab switch event{tabSwitches === 1 ? "" : "s"} Flagged</div>
        <section className="viewaiResultTranscript"><h2>Your Transcript</h2>{info.questions.map((question, index) => <article className="viewaiResultAnswer" key={index}><strong>Q{index + 1}- {question}</strong><p>{answers[index]?.trim() || "No answer recorded."}</p></article>)}</section>
        <button type="button" className="viewaiResultRestart" onClick={restartInterview}>Restart</button>
      </section> : <div className="viewaiColumns">
        <section className="viewaiOverview" aria-label="Interview overview">
          <h1>{info.role} Mock Interview</h1>
          <p className="viewaiMeta">{info.duration} Minutes <span>|</span> {info.language} <span>|</span> {info.questionCount} Questions</p>
          <div className="viewaiCameraPanel"><div className="viewaiCameraOval">
            <video ref={cameraElement} autoPlay playsInline muted className={cameraOn ? "viewaiCameraVideo" : "viewaiHiddenVideo"} aria-label="Your camera preview"/>
            {!cameraOn && <span>Run the camera to see yourself here</span>}
          </div>
          <button className="viewaiCameraButton" type="button" disabled={checks.camera === "Testing"} onClick={() => cameraOn ? turnCameraOff() : void checkCamera()}>
            Camera {checks.camera === "Testing" ? "Starting" : cameraOn ? "On" : "Off"}
          </button>
          {(cameraDevices.length > 0 || cameraError) && <div className="viewaiCameraControls">
            {cameraDevices.length > 0 && <label htmlFor="viewaiCameraChoice">Camera source
              <select id="viewaiCameraChoice" value={selectedCameraId} onChange={event => {
                setSelectedCameraId(event.target.value);
                if (cameraOn) turnCameraOff();
              }}><option value="">Default camera</option>{cameraDevices.filter(device => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || ("Camera " + (index + 1))}</option>)}</select>
            </label>}
            <button className="viewaiDetectCamera" type="button" onClick={() => { void scanCameraDevices().then(found => {
              if (found === null) setCameraDiagnostics("Chrome did not allow camera device detection. Check site settings.");
              else setCameraDiagnostics("Chrome detects " + found.length + " camera" + (found.length === 1 ? "" : "s") + ".");
            }); }}>Refresh camera list</button>
          </div>}
          {cameraError && <p className="viewaiCameraError" role="alert">{cameraError}</p>}
          {cameraDiagnostics && <p className="viewaiCameraDiagnostics" role="status">{cameraDiagnostics}</p>}
        </div>
        </section>
        {screen === "instructions" ? <section className="viewaiChecks viewaiInstructions" aria-labelledby="aiInstructionsHeading"><h2 id="aiInstructionsHeading">Assessment Instructions</h2><div className="viewaiInfoBanner">Read all instructions before beginning the assessment.</div><ul className="viewaiInstructionsList"><li>Complete the camera, microphone and background-noise checks before you start.</li><li>Answer each question clearly. You may also type your response.</li><li>Keep the interview tab open. Tab switching may be recorded.</li><li>Submit each answer to move to the next question.</li><li>Once the final answer is submitted, the attempt is complete.</li></ul><label className="viewaiInstructionCheckbox"><input type="checkbox" checked={instructionAccepted} onChange={event => setInstructionAccepted(event.target.checked)}/> I have read and understood the assessment instructions.</label><div className="viewaiStartRow"><button type="button" className="viewaiStartButton" disabled={!instructionAccepted || !info.questions.length} onClick={() => setScreen("preflight")}>Continue to System Check</button></div>{!info.questions.length && <p role="alert">No saved AI assessment questions were found. Ask the creator to publish the questions before starting.</p>}</section> : screen === "preflight" ? <section className="viewaiChecks" aria-labelledby="viewaiChecksHeading">
          <div className="viewaiInfoBanner"><Asset name="info.svg" size={24}/><span>Speak clearly. You may ask the examiner to repeat a question.</span></div>
          <h2 id="viewaiChecksHeading">System Check before you begin</h2>
          <div className="viewaiCheckList">
            {CHECK_CONFIG.map(check => <div className="viewaiCheckRow" key={check.id}>
              <div className="viewaiCheckDescription"><span className={`viewaiCheckIcon viewaiColor-${check.color}`}><Asset name={check.icon} size={24}/></span>
                <div><strong className={`viewaiColor-${check.color}`}>{check.title}</strong><small>{check.description}</small></div></div>
              <div className="viewaiCheckActions">
                {checks[check.id] === "Testing" && <Waveform active level={check.id === "camera" ? 50 : micLevel} phase={phase}/>}
                <span className={`viewaiCheckStatus viewaiStatus-${checks[check.id].toLowerCase()}`} role="status">
                  {checks[check.id] === "Passed" && <SuccessIcon/>}{checks[check.id]}
                </span>
                <button type="button" className="viewaiTestButton" disabled={busy} onClick={() => check.id === "camera" ? void checkCamera() : void runAudioCheck(check.id)}>
                  {checks[check.id] === "Testing" ? "Testing" : checks[check.id] === "Pending" ? "Test" : "Retest"}
                </button>
              </div>
            </div>)}
          </div>
          <div className="viewaiSettingsRow"><div className="viewaiSetting"><span>Flag voice changes or pauses</span><Toggle label="Flag voice changes or pauses" value={voiceFlag} onChange={setVoiceFlag}/></div>
            <div className="viewaiSetting"><span>Tab / window Switch</span><Toggle label="Tab or window switch monitoring" value={tabFlag} onChange={setTabFlag}/></div></div>
          <div className="viewaiSetting viewaiAgreement"><span>I understand and accept the proctoring rules</span><Toggle label="Accept proctoring rules" value={accepted} onChange={setAccepted}/></div>
          <div className="viewaiStartRow"><button type="button" className="viewaiStartButton" disabled={busy} onClick={startInterview}><span>Start Interview</span></button></div>
          {notice && <p className="viewaiNotice" role="status">{notice}</p>}
        </section> : <section className="viewaiInterview" aria-label="AI interview session">
          <div className="viewaiProgress"><strong>{Math.min(current + 1, info.questionCount)}/{String(info.questionCount).padStart(2, "0")}</strong><div className="viewaiProgressLine"><span style={{width:`${Math.max(.5,progress)}%`}}/></div><strong className="viewaiPercent">{progress}%</strong></div>
          {!finished && <>
            <div className="viewaiListening"><div className="viewaiHeadsetRing"><div className="viewaiHeadsetInner"><Asset name="headphones.svg" size={24}/></div></div><Waveform active={listening} level={listening ? 72 : 23} phase={phase} large/><p>{listening ? "Listening - Answer Out Loud" : speechAvailable ? "Microphone paused - Answer Out Loud" : "Type Your Answer Below"}</p></div>
            <div className="viewaiQuestion">{current + 1}. {info.questions[current]}</div>
            <div className="viewaiTranscript"><label htmlFor="viewaiTranscript">Live Transcript</label><textarea id="viewaiTranscript" value={transcript} onChange={event => { setTranscript(event.target.value); transcriptRef.current = event.target.value; }} placeholder="Your spoken words will appear here. You can also type or correct the text." rows={3}/></div>
            <div className="viewaiAnswerActions"><button type="button" className="viewaiRepeat" onClick={repeatQuestion}><Asset name="reload.svg" size={24}/>Repeat</button>
              <button type="button" className={`viewaiStop${listening ? " viewaiStopListening" : " viewaiStopPaused"}`} title={listening ? "Pause microphone" : "Resume microphone"} aria-label={listening ? "Pause microphone" : "Resume microphone"} aria-pressed={listening} onClick={() => listening ? (cancelQuestionVoice(), stopSpeech()) : (cancelQuestionVoice(), startListening())}>{listening ? <span className="viewaiStopSquare" aria-hidden="true" /> : <Asset name="mic-vocal.svg" size={24}/>}</button>
              <button type="button" className="viewaiSubmit" onClick={submitAnswer}>Submit Answer</button></div>
          </>}
          {notice && <p className="viewaiNotice" role="status">{notice}</p>}
        </section>}
      </div>}
    </div>
    {showSubmitConfirm && <div className="viewaiModalBackdrop" role="presentation"><div className="viewaiModal" role="dialog" aria-modal="true" aria-labelledby="aiSubmitHeading"><h2 id="aiSubmitHeading">Submit Assessment?</h2><p>Submitting the final response completes this attempt. You cannot change your answers afterwards.</p><div className="viewaiModalActions"><button type="button" onClick={() => setShowSubmitConfirm(false)}>Cancel</button><button type="button" onClick={() => { setShowSubmitConfirm(false); finishInterview({...answers, [current]: transcript.trim()}); }}>Submit Assessment</button></div></div></div>}
  </div></main></div></div>;
}
