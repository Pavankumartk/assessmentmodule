
"use client";
import { quantumStorage as localStorage, quantumSessionStorage as sessionStorage } from "./quantum-storage";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./quantum-champs.css";

type Team = {
  id: number;
  name: string;
  icon: string;
  tagline: string;
  colour: string;
  batch: string;
  members: string;
  accessCode: string;
  learners: string[];
};
type FormState = Record<string, string>;
const steps = ["Type", "Details", "Content", "Evaluation", "Review"];
const sectionTitles = ["Basic Information", "Game Setup and Rounds", "Teams", "XP, Ranks and Lifelines", "Timing, Access & Audience"];

// Exact dropdown labels supplied for this page.
const LANGUAGE_OPTIONS = [
  "English (en)", "Spanish (es)", "Chinese – Simplified (zh)", "Chinese – Traditional (zh)",
  "Hindi (hi)", "Arabic (ar)", "Portuguese (pt)", "Bengali (bn)", "Russian (ru)",
  "Japanese (ja)", "Punjabi (pa)", "German (de)", "Javanese (jv)", "Korean (ko)",
  "French (fr)", "Telugu (te)", "Marathi (mr)", "Turkish (tr)", "Tamil (ta)",
  "Vietnamese (vi)", "Urdu (ur)", "Italian (it)", "Persian (fa)", "Gujarati (gu)",
  "Bhojpuri (bho)", "Kannada (kn)", "Polish (pl)", "Malayalam (ml)", "Odia (or)",
  "Ukrainian (uk)", "Malay (ms)", "Thai (th)", "Dutch (nl)", "Romanian (ro)",
  "Swahili (sw)", "Greek (el)", "Czech (cs)", "Hungarian (hu)", "Swedish (sv)",
  "Hebrew (he)", "Finnish (fi)", "Norwegian (no)", "Danish (da)", "Slovak (sk)",
  "Bulgarian (bg)", "Serbian (sr)", "Croatian (hr)", "Nepali (ne)", "Sinhala (si)",
  "Assamese (as)", "Khmer (km)", "Lao (lo)", "Myanmar (my)", "Amharic (am)",
  "Armenian (hy)", "Azerbaijani (az)", "Georgian (ka)", "Kazakh (kk)", "Uzbek (uz)",
  "Mongolian (mn)", "Albanian (sq)", "Lithuanian (lt)", "Latvian (lv)", "Estonian (et)",
  "Slovenian (sl)", "Icelandic (is)", "Irish (ga)", "Welsh (cy)", "Macedonian (mk)",
  "Bosnian (bs)", "Maltese (mt)", "Afrikaans (af)", "Zulu (zu)", "Xhosa (xh)",
  "Filipino (fil)", "Indonesian (id)",
];
const AUDIENCE_OPTIONS = [
  "All Enrolled Learners", "Selected Learners", "Selected Teams", "Specific Batch / Cohort",
  "Specific Department", "Specific Role", "Custom Group",
];
const MEMBER_OPTIONS = ["Auto-Split Learners", "Choose Manually"];
const COLOUR_OPTIONS = [
  "🟣🟢 Purple–Teal", "🔴💗 Red–Pink", "🔵🟣 Blue–Purple", "🟠💗 Orange–Pink",
  "🟢🔵 Green–Blue", "🟡🟠 Yellow–Orange", "🩵🟣 Cyan–Purple", "💗🟣 Pink–Violet",
  "🔵🩵 Blue–Cyan", "🟢🩵 Green–Cyan", "🟠🔴 Orange–Red", "🟣🔵 Violet–Blue",
  "💗🟠 Pink–Orange", "🟡🟢 Yellow–Green", "🔴🟣 Red–Violet", "🩵🟢 Cyan–Green",
  "🔵🟢 Blue–Green", "🟠🟣 Orange–Purple", "💗🔵 Pink–Blue", "🟡🔴 Gold–Red",
  "🟢🟡 Lime–Yellow", "🩵🟦 Aqua–Blue", "🟣💗 Purple–Pink", "🔴🟠 Crimson–Orange",
  "🟦🟢 Indigo–Green", "🟪🩵 Plum–Aqua", "🟠🟡 Amber–Gold", "💗🔴 Rose–Crimson",
  "🟢🟣 Emerald–Violet", "🔵🟠 Azure–Orange",
];
const RANK_OPTIONS = [
  "Spark, Boost, Elite, Titan", "Rookie, Skilled, Expert, Master", "Scout, Ranger, Hero, Legend",
  "Starter, Challenger, Pro, Champion", "Bronze, Silver, Gold, Platinum", "Seed, Sprout, Bloom, Apex",
  "Pulse, Surge, Force, Power", "Ignite, Blaze, Inferno, Nova", "Byte, Code, Logic, Quantum",
  "Learner, Thinker, Solver, Genius", "Scout, Striker, Warrior, Titan",
  "Rookie, Raider, Slayer, Legend", "Spark, Flash, Bolt, Thunder", "Core, Prime, Ultra, Apex",
  "Base, Rise, Peak, Summit", "Questor, Seeker, Master, Champion", "Pilot, Ace, Pro, Elite",
  "Starter, Rising, Elite, Supreme", "Thinker, Tactician, Strategist, Mastermind",
  "Explorer, Adventurer, Conqueror, Legend", "Alpha, Beta, Gamma, Omega",
  "Pulse, Spark, Surge, Nova", "Rookie, Builder, Leader, Titan", "Flash, Fury, Force, Phoenix",
  "Novice, Adept, Expert, Grandmaster", "Climber, Runner, Racer, Champion",
  "Awaken, Evolve, Ascend, Transcend", "Logic, Insight, Mastery, Genius",
  "Quest, Strike, Victory, Glory", "Neo, Prime, Apex, Quantum",
];
const TEAM_TAGLINE_OPTIONS = [
  "Think Fast, Play Smart, Win Big", "Outsmart, Outplay, Outscore", "Think, Strike, Conquer",
  "Challenge, Compete, Conquer", "Play Smart, Score High, Rise Up", "Think Sharp, Move Fast, Win",
  "Answer, Attack, Advance", "Compete, Conquer, Celebrate", "Learn, Play, Dominate",
  "Think Big, Play Bold, Win", "Power Up, Level Up, Win", "Question, Challenge, Conquer",
  "Think Quick, Score Big, Rise", "Play Hard, Score More, Rise", "Brain Up, Game On, Win",
  "Think Smart, Strike Fast, Score", "Learn Fast, Play Smart, Win", "Challenge More, Score More, Rise",
  "Play Bold, Think Sharp, Win", "Answer Fast, Earn XP, Level Up", "Think, Play, Level Up",
  "Test, Tackle, Triumph", "Focus, Fight, Finish", "Think Ahead, Play Ahead, Win",
  "Gear Up, Power Up, Conquer", "Question It, Crack It, Win", "Play Smart, Earn XP, Rise",
  "Think Fast, Score Fast, Rise", "Compete Smart, Score Big, Conquer", "Brain Power, Game Power, Victory",
];
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const validateForm = (form: FormState, teams: Team[], fullQuest: boolean, quickTest: boolean, today: string) => {
  const errors: Record<string, string> = {};
  const required = (key: string, label: string) => {
    if (!form[key]?.trim()) errors[key] = `${label} is required.`;
  };
  required("assessmentName", "Assessment name");
  if (form.assessmentName?.trim() && form.assessmentName.trim().length < 3) errors.assessmentName = "Enter at least 3 characters.";
  if (form.assessmentName?.trim().length > 100) errors.assessmentName = "Maximum 100 characters allowed.";
  if (form.assessmentCode?.trim() && !/^[a-zA-Z0-9_-]{3,30}$/.test(form.assessmentCode.trim())) errors.assessmentCode = "Use 3–30 letters, numbers, hyphens or underscores.";
  for (const [key, label] of Object.entries({assessmentType:"Assessment type",course:"Course",language:"Language",module:"Module / Unit",tags:"Category / tags",description:"Description / instructions",questionsPerRound:"Questions per round",rounds:"Number of rounds",topic:"Topic",tagline:"Tagline",xpToWin:"XP to win",rankNames:"Rank names",lifelinesPerTeam:"Lifelines per team",timer:"Default timer",audience:"Who can play"})) required(key,label);
  if (form.tags?.trim() && form.tags.trim().length < 2) errors.tags = "Enter a meaningful category or tag.";
  if (form.description && form.description.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").trim().length < 10) errors.description = "Enter at least 10 characters of instructions.";
  if (!fullQuest && !quickTest) errors.gameMode = "Enable at least one game mode.";
  for (const [key,label] of [["questionsPerRound","Questions per round"],["rounds","Number of rounds"],["xpToWin","XP to win"],["lifelinesPerTeam","Lifelines per team"]]) {
    if (form[key] && (!/^\d+$/.test(form[key]) || Number(form[key]) < 1)) errors[key] = `${label} must be a positive whole number.`;
  }
  if (form.availableFrom && today && form.availableFrom < today) errors.availableFrom = "Start date cannot be in the past.";
  if (form.availableUntil && today && form.availableUntil < today) errors.availableUntil = "End date cannot be in the past.";
  if (form.availableFrom && form.availableUntil && form.availableUntil < form.availableFrom) errors.availableUntil = "End date must be on or after the start date.";
  const rankKeys = ["sparkXP","boostXP","eliteXP","titanXP"];
  rankKeys.forEach((key,index) => {
    if (!form[key]) errors[key] = "Select the required XP.";
    else if (!/^\d+$/.test(form[key])) errors[key] = "Enter a valid XP value.";
    else if (index && form[rankKeys[index-1]] && Number(form[key]) <= Number(form[rankKeys[index-1]])) errors[key] = "XP must increase at each rank.";
    if (form[key] && form.xpToWin && Number(form[key]) > Number(form.xpToWin)) errors[key] = "Rank XP cannot exceed XP to win.";
  });
  if (form.titanXP && form.xpToWin && Number(form.titanXP) !== Number(form.xpToWin)) errors.titanXP = "Final rank XP must equal XP to win.";
  teams.forEach(team => {
    const prefix = `team-${team.id}-`;
    if (!team.name.trim()) errors[`${prefix}name`] = "Team name is required.";
    else if (team.name.trim().length < 2) errors[`${prefix}name`] = "Enter at least 2 characters.";
    else if (teams.some(other => other.id !== team.id && other.name.trim().toLowerCase() === team.name.trim().toLowerCase())) errors[`${prefix}name`] = "Team names must be unique.";
    if (!team.tagline) errors[`${prefix}tagline`] = "Choose a team tagline.";
    if (!team.colour) errors[`${prefix}colour`] = "Choose a team colour.";
    if (!team.batch) errors[`${prefix}batch`] = "Choose a batch.";
    if (!team.members) errors[`${prefix}members`] = "Choose a member assignment method.";
    if (!team.accessCode.trim()) errors[`${prefix}accessCode`] = "Enter or generate an access code.";
    else if (!/^[A-Za-z0-9-]{4,30}$/.test(team.accessCode.trim())) errors[`${prefix}accessCode`] = "Use 4–30 letters, numbers or hyphens.";
    else if (teams.some(other => other.id !== team.id && other.accessCode.trim().toLowerCase() === team.accessCode.trim().toLowerCase())) errors[`${prefix}accessCode`] = "Access codes must be unique.";
  });
  return errors;
};

const initialForm: FormState = {
  assessmentName:"",assessmentCode:"",assessmentType:"",course:"",language:"",module:"",tags:"",description:"",
  questionsPerRound:"",rounds:"",topic:"",tagline:"",xpToWin:"",rankNames:"",
  sparkXP:"",boostXP:"",eliteXP:"",titanXP:"",lifelinesPerTeam:"",timer:"",
  availableFrom:"",availableUntil:"",audience:"",
};

const initialTeams: Team[] = [
  {id:1,name:"TEAM NOVA",icon:"/quantum-champs/Assessment_icon/Vector-1.svg",tagline:"",colour:"",batch:"",members:"",accessCode:"",learners:[]},
  {id:2,name:"TEAM BLAZE",icon:"/quantum-champs/Assessment_icon/Vector.svg",tagline:"",colour:"",batch:"",members:"",accessCode:"",learners:[]},
];

const TOPIC_OPTIONS = [
  "AI Basics · Automation · GenAI",
  "GenAI · LLMs · AI Content",
  "Prompting · AI Tools · Optimization",
  "Prompting, Machine learning, Responsible AI",
  "Ethics · Bias · AI Safety",
  "AI Strategy · Productivity · Automation",
  "AI Strategy · Decision Making · Innovation",
  "Data Analytics · ML · Insights",
  "AI Agents · Automation · Workflows",
  "Image AI · Detection · Recognition",
  "NLP · Text AI · Language Models",
  "AI Security · Privacy · Risk",
  "Governance · Compliance · Risk",
  "Copilots · Automation · Efficiency",
  "LLMs · RAG · AI Agents",
  "Ideation · Prototyping · Transformation",
];

function SelectField({ label, value, options, onChange, error }: { label: string; value: string; options: string[]; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const entries = options.includes(value) || !value ? options : [value, ...options];
  return <div className="qc-field qc-select-field" ref={root}>
    <span>{label}</span>
    <div className="qc-select-root">
      <button type="button" className={`qc-select-trigger ${open ? "qc-select-expanded" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-invalid={Boolean(error)} onClick={() => setOpen(v => !v)}>
        <span>{value || "Select"}</span><span className={`qc-select-chevron ${open ? "qc-select-chevron-up" : ""}`} aria-hidden="true" />
      </button>
      {open && <div className="qc-select-menu" role="listbox" aria-label={label}>
        {entries.map(option => <button type="button" role="option" aria-selected={option === value} className={`qc-select-option ${option === value ? "qc-select-selected" : ""}`} key={option} onClick={() => { onChange(option); setOpen(false); }}>
          <span className="qc-radio-indicator" aria-hidden="true"><span /></span><span>{option}</span>
        </button>)}
      </div>}
    </div>
    {error && <small role="alert" className="qc-input-error">{error}</small>}
  </div>;
}

function CalendarField({ label, value, min, onChange, error }: { label: string; value: string; min?: string; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(2026);
  const root = useRef<HTMLDivElement>(null);
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const openCalendar = () => {
    const base = value || min;
    const date = base ? new Date(`${base}T12:00:00`) : new Date();
    setMonth(date.getMonth()); setYear(date.getFullYear()); setOpen(v => !v);
  };
  const move = (offset: number) => { const date = new Date(year, month + offset, 1); setMonth(date.getMonth()); setYear(date.getFullYear()); };
  const y = month < 2 ? year - 1 : year;
  const m = month < 2 ? month + 10 : month - 2;
  const firstDay = (1 + y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + Math.floor(31 * m / 12)) % 7;
  const days = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  const cells = Array.from({length: Math.ceil((firstDay + days) / 7) * 7}, (_, i) => i - firstDay + 1);
  return <div className="qc-field qc-calendar-field" ref={root}>
    <span>{label}</span>
    <div className="qc-calendar-root">
      <button type="button" className="qc-calendar-trigger" onClick={openCalendar} aria-expanded={open} aria-haspopup="dialog" aria-invalid={Boolean(error)}>
        <span>{value ? `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}` : "Select date"}</span>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
      </button>
      {open && <div className="qc-calendar-popup" role="dialog" aria-label={`${label} calendar`}>
        <div className="qc-calendar-header"><button type="button" onClick={() => move(-1)} aria-label="Previous month">‹</button><strong>{["January","February","March","April","May","June","July","August","September","October","November","December"][month]} {year}</strong><button type="button" onClick={() => move(1)} aria-label="Next month">›</button></div>
        <div className="qc-calendar-days">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <span key={d} className="qc-calendar-weekday">{d}</span>)}{cells.map((day, i) => day < 1 || day > days ? <span key={i} /> : <button type="button" key={i} disabled={Boolean(min && iso(year,month,day) < min)} className={iso(year,month,day) === value ? "qc-calendar-active" : ""} onClick={() => {onChange(iso(year,month,day));setOpen(false);}}>{day}</button>)}</div>
        <div className="qc-calendar-footer"><button type="button" onClick={() => {onChange("");setOpen(false);}}>Clear</button><button type="button" onClick={() => { const now = new Date(); const selected = iso(now.getFullYear(),now.getMonth(),now.getDate()); if (!min || selected >= min) {onChange(selected);setOpen(false);} }}>Today</button></div>
      </div>}
    </div>
    {error && <small role="alert" className="qc-input-error">{error}</small>}
  </div>;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`qc-switch ${checked ? "qc-switch-on" : ""}`}><span className="qc-switch-text">{checked ? "ON" : "OFF"}</span><span className="qc-switch-knob" /></button>;
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="qc-toggle-row"><span>{label}</span><Switch label={label} checked={checked} onChange={onChange} /></div>;
}
function Section({ index, title, open, toggle, children }: { index: number; title: string; open: boolean; toggle: () => void; children: React.ReactNode }) {
  return <section className={`qc-accordion ${open ? "qc-accordion-open" : ""}`}><button type="button" className="qc-accordion-trigger" aria-expanded={open} onClick={toggle}><span>{index + 1}. {title}</span><Image src="/assets/assessmenticons/arrow-down-01.svg" width={20} height={20} alt="" className={`qc-chevron ${open ? "qc-chevron-open" : ""}`} unoptimized /></button>{open && <div className="qc-accordion-content">{children}</div>}</section>;
}

export default function QuantumChampsPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [openSections, setOpenSections] = useState<number[]>([]);
  const [fullQuest, setFullQuest] = useState(false);
  const [quickTest, setQuickTest] = useState(false);
  const [showTeamNames, setShowTeamNames] = useState(false);
  const [notifyLearners, setNotifyLearners] = useState(false);
  const [lifelines, setLifelines] = useState([false, false, false, false]);
  const [message, setMessage] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [today, setToday] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const errors = validateForm(form, teams, fullQuest, quickTest, today);
  const errorFor = (key: string) => (showErrors || touched[key]) ? errors[key] : undefined;
  const markTouched = (key: string) => setTouched(previous => ({...previous, [key]: true}));
  const update = (key: string, value: string) => { markTouched(key); setForm(previous => ({ ...previous, [key]: value })); };
  const updateTeam = (id: number, key: keyof Team, value: string) => { markTouched(`team-${id}-${key}`); setTeams(previous => previous.map(team => team.id === id ? { ...team, [key]: value } : team)); };
  const toggleSection = (index: number) => setOpenSections(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index]);
  const makeCode = (name: string) => `QC7-${name.replace(/^TEAM\s+/i, "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const addTeam = () => setTeams(previous => previous.length >= 8 ? previous : [...previous, { id: Date.now(), name: "", icon: "/quantum-champs/Assessment_icon/Vector-1.svg", tagline: "", colour: "", batch: "", members: "", accessCode: "", learners: [] }]);
  const field = (label: string, key: string, placeholder = "") => <label className="qc-field"><span>{label}</span><input value={form[key] ?? ""} placeholder={placeholder} maxLength={key === "assessmentName" ? 100 : key === "assessmentCode" ? 30 : 250} aria-invalid={Boolean(errorFor(key))} onChange={e => update(key, e.target.value)} />{errorFor(key) && <small role="alert" className="qc-input-error">{errorFor(key)}</small>}</label>;
  const select = (label: string, key: string, options: string[]) => <SelectField label={label} value={form[key] ?? ""} options={options} error={errorFor(key)} onChange={value => update(key, value)} />;
  const currentDetails = () => ({
    ...form,
    description: editorRef.current?.innerHTML ?? form.description,
    teams, fullQuest, quickTest, showTeamNames, notifyLearners, lifelines,
  });
  const save = () => {
    if (!loaded) { setMessage("Please wait for the form to load."); return false; }
    const details = currentDetails();
const issues = validateForm(
  { ...form, description: details.description },
  teams,
  fullQuest,
  quickTest,
  today
);    if (Object.keys(issues).length) {
      setShowErrors(true);
      setOpenSections([0, 1, 2, 3, 4]);
      setMessage("Please complete all required fields and correct the highlighted errors before saving.");
      return false;
    }
    try {
      // Generate the permanent tracking ID only on the first successful Save.
      let id = assessmentId;
      if (!id) {
        for (let attempt = 0; !id && attempt < 10; attempt += 1) {
          let suffix = "";
          try { suffix = globalThis.crypto?.randomUUID?.() || ""; } catch { /* Older or non-secure browser context. */ }
          if (!suffix) suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${attempt}`;
          const candidate = `QC-${suffix}`;
          if (!localStorage.getItem(`quantumChamps:${candidate}`)) id = candidate;
        }
        if (!id) throw new Error("Could not generate a unique assessment ID.");
      }
      const saved = assessmentId ? localStorage.getItem(`quantumChamps:${id}`) : null;
      const previous: unknown = saved ? JSON.parse(saved) : null;
      const existing = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {};
      const draft = { ...existing, ...details, assessmentCode: form.assessmentCode.trim() || id, assessmentId: id, status: "details_saved" };
      const previousId = localStorage.getItem("quantumChampsCurrentId");
      localStorage.setItem("quantumChampsCurrentId", id);
      try {
        localStorage.setItem(`quantumChamps:${id}`, JSON.stringify(draft));
      } catch (error) {
        // Restore the previous selection if the actual assessment record could not be saved.
        try {
          if (localStorage.getItem("quantumChampsCurrentId") === id) {
            if (previousId === null) localStorage.removeItem("quantumChampsCurrentId");
            else localStorage.setItem("quantumChampsCurrentId", previousId);
          }
        } catch { /* Keep the original save error. */ }
        throw error;
      }
      // These are compatibility copies; the saved assessment above is authoritative.
      try { localStorage.setItem("quantumChampsDraft", JSON.stringify(draft)); } catch { /* A full backup must not turn a successful save into a failure. */ }
      try { sessionStorage.setItem("quantumChampsDraft", JSON.stringify(draft)); } catch { /* Review can use the saved assessment record. */ }
      setAssessmentId(id);
      setSavedSnapshot(JSON.stringify(details));
      setMessage(`Assessment saved successfully. Tracking ID: ${id}`);
      return true;
    } catch (error) {
      console.error("Unable to save Quantum Champs assessment details:", error);
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      setMessage(name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED"
        ? "Browser storage is full. Back up existing drafts and free storage before saving this assessment."
        : name === "SyntaxError"
          ? "The saved assessment could not be read. Its existing data has not been replaced."
          : "Could not save assessment details. Check browser storage permissions and try again.");
      return false;
    }
  };
  const continuePage = () => {
    if (!loaded) { setMessage("Please wait for the form to load."); return; }
    if (!savedSnapshot || savedSnapshot !== JSON.stringify(currentDetails())) {
      setMessage("Please click Save first. After saving the completed assessment, click Continue.");
      return;
    }
    router.push("/quantum-champs/QC_Content");
  };
  useEffect(() => { setToday(todayLocal()); }, []);
  useEffect(() => {
    try {
      const id = localStorage.getItem("quantumChampsCurrentId");
      const params = new URLSearchParams(window.location.search);
      const resumeDraft = params.get("resume") === "1" && params.get("new") !== "1";
      const saved = resumeDraft ? ((id && localStorage.getItem(`quantumChamps:${id}`)) || localStorage.getItem("quantumChampsDraft") || sessionStorage.getItem("quantumChampsDraft")) : null;
      if (saved) {
        const data = JSON.parse(saved);
        const restoredForm: FormState = Object.fromEntries(Object.keys(initialForm).map(key => [key, key === "language" && data[key] === "English" ? "English (en)" : (data[key] ?? "")]));
        const restoredTeams = Array.isArray(data.teams) ? data.teams : initialTeams;
        const restoredFullQuest = Boolean(data.fullQuest);
        const restoredQuickTest = Boolean(data.quickTest);
        const restoredShowTeamNames = Boolean(data.showTeamNames);
        const restoredNotifyLearners = Boolean(data.notifyLearners);
        const restoredLifelines = Array.isArray(data.lifelines) ? data.lifelines : [false, false, false, false];
        setForm(restoredForm);
        setTeams(restoredTeams);
        setFullQuest(restoredFullQuest);
        setQuickTest(restoredQuickTest);
        setShowTeamNames(restoredShowTeamNames);
        setNotifyLearners(restoredNotifyLearners);
        setLifelines(restoredLifelines);
        if (editorRef.current) editorRef.current.innerHTML = data.description || "";
        setAssessmentId(data.assessmentId || id || "");
        // Match the same editable values used by currentDetails() when checking for changes.
        setSavedSnapshot(JSON.stringify({ ...restoredForm, description: data.description || "", teams: restoredTeams, fullQuest: restoredFullQuest, quickTest: restoredQuickTest, showTeamNames: restoredShowTeamNames, notifyLearners: restoredNotifyLearners, lifelines: restoredLifelines }));
      } else {
        setForm({ ...initialForm });
        setTeams(initialTeams.map(t => ({ ...t, learners: [] })));
        setAssessmentId("");
        setSavedSnapshot("");
        if (editorRef.current) editorRef.current.innerHTML = "";
      }
    } catch { setAssessmentId(""); setSavedSnapshot(""); }
    setLoaded(true);
  }, []);
  const editorCommand = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); update("description", editorRef.current?.innerHTML || ""); };
  return <main className="superAdminPage institutionAdminPage qc-app-shell"><div className="dashboardLayout qc-dashboard"><Sidebar /><section className="mainContent qc-main"><div className="qc-header"><Header /></div><div className="institutionScrollArea qc-scroll"><div className="pageContent institutionPageContent qc-page">
    <nav className="qc-breadcrumb"><Link href="/assessments">Assessment</Link><span>»</span><Link href="/assessments/create">Create Assessment</Link></nav>
    <ol className="qc-wizard">{steps.map((step, index) => <li key={step} className={`qc-wizard-step ${index === 0 ? "qc-completed" : ""} ${index === 1 ? "qc-active" : ""}`}><span className="qc-step-number">{index + 1}</span><span>{step}</span></li>)}</ol>
    <header className="qc-title"><h1>Assessment Details (Quantum Champ)</h1><p>Provide The Essential Details And Settings For Your Game.</p></header>
    <div className="qc-accordion-list">
      <Section index={0} title={sectionTitles[0]} open={openSections.includes(0)} toggle={() => toggleSection(0)}><div className="qc-basic-fields">
        <div className="qc-basic-name">{field("Assessment Name", "assessmentName", "Enter assessment name")}</div><div className="qc-basic-code">{field("Assessment Code", "assessmentCode", "Enter assessment code (optional). Auto-generated if left blank")}</div>
        <div className="qc-basic-type">{select("Assessment Type", "assessmentType", ["Quantum Champ", "Quiz Battle", "Team Challenge"])}</div><div className="qc-basic-course">{select("Course", "course", ["Artificial Intelligence", "Machine Learning", "Computer Science"])}</div><div className="qc-basic-language">{select("Language", "language", LANGUAGE_OPTIONS)}</div>
        <div className="qc-basic-module">{select("Module/ Unit", "module", ["Module 3 - AI Fundamentals", "Module 1 - Introduction to AI", "Module 2 - Machine Learning", "Module 4 - Neural Networks"])}</div><div className="qc-basic-tags">{field("Category / tags", "tags")}</div>
        <div className="qc-basic-description"><label className="qc-field"><span>Description / Instructions</span></label><div className="qc-rich-editor"><div className="qc-rich-toolbar" role="toolbar" aria-label="Description formatting"><button type="button" onClick={() => editorCommand("undo")}>↶</button><button type="button" onClick={() => editorCommand("redo")}>↷</button><select aria-label="Font" onChange={e => editorCommand("fontName", e.target.value)}><option>Arial</option><option>Georgia</option><option>Verdana</option></select><select aria-label="Font size" defaultValue="3" onChange={e => editorCommand("fontSize", e.target.value)}><option value="2">12</option><option value="3">16</option><option value="4">18</option></select><button type="button" onClick={() => editorCommand("bold")}><b>B</b></button><button type="button" onClick={() => editorCommand("italic")}><i>I</i></button><button type="button" onClick={() => editorCommand("underline")}><u>U</u></button><button type="button" onClick={() => editorCommand("foreColor", "#2D4CC8")}>A</button><button type="button" onClick={() => editorCommand("insertUnorderedList")}>☷</button><button type="button" onClick={() => editorCommand("insertOrderedList")}>≡</button><button type="button" onClick={() => editorCommand("createLink", prompt("Enter URL") || "")}>🔗</button><button type="button" onClick={() => editorCommand("removeFormat")}>⌫</button></div><div className="qc-rich-content" ref={editorRef} contentEditable suppressContentEditableWarning onInput={e => update("description", e.currentTarget.innerHTML)} onBlur={() => markTouched("description")}></div>{errorFor("description") && <small role="alert" className="qc-input-error">{errorFor("description")}</small>}</div></div>
      </div></Section>
      <Section index={1} title={sectionTitles[1]} open={openSections.includes(1)} toggle={() => toggleSection(1)}><div className="qc-game-setup"><label className="qc-field-heading">Game mode offered</label><div className="qc-game-modes"><ToggleRow label="Full Quest (Round 1 + 2)" checked={fullQuest} onChange={setFullQuest} /><ToggleRow label="Quick Test : Round 2 only" checked={quickTest} onChange={setQuickTest} /></div>{errorFor("gameMode") && <small role="alert" style={{color:"#b42318"}}>{errorFor("gameMode")}</small>}<div className="qc-game-grid">{select("Question Per Round", "questionsPerRound", Array.from({ length: 30 }, (_, i) => String(i + 1)))}{select("Number of Round", "rounds", ["1", "2", "3", "4", "5"])}{select("Topic Tab on intro", "topic", TOPIC_OPTIONS)}{select("Tagline", "tagline", ["Outsmart, Outscore, Out Level", "Rise and Shine", "Think Fast, Win Big"])}</div></div></Section>
      <Section index={2} title={sectionTitles[2]} open={openSections.includes(2)} toggle={() => toggleSection(2)}><div className="qc-teams-top"><button type="button" className="qc-pill-button" disabled={teams.length <= 2} onClick={() => setTeams(previous => previous.slice(0, -1))}>Remove Team</button></div><div className="qc-team-grid">{teams.map(team => <article className="qc-team-card" key={team.id}><div className="qc-team-heading"><span className="qc-team-emblem"><span style={{position:"relative",display:"inline-flex",width:22,height:22}}><Image src={team.icon || "/quantum-champs/Assessment_icon/Vector-1.svg"} alt={`${team.name} icon`} width={22} height={22} unoptimized />{team.icon === "/quantum-champs/Assessment_icon/Vector-1.svg" && <Image src="/quantum-champs/Assessment_icon/sun-medium.svg" alt="" width={14} height={14} unoptimized style={{position:"absolute",top:4,left:4}} />}</span></span><input aria-label="Team name" value={team.name} aria-invalid={Boolean(errorFor(`team-${team.id}-name`))} onChange={e => updateTeam(team.id, "name", e.target.value)} /><span>✎</span></div>{errorFor(`team-${team.id}-name`) && <small role="alert" className="qc-input-error">{errorFor(`team-${team.id}-name`)}</small>}<SelectField label="Tagline" value={team.tagline} options={TEAM_TAGLINE_OPTIONS} error={errorFor(`team-${team.id}-tagline`)} onChange={value => updateTeam(team.id, "tagline", value)} /><SelectField label="Colour" value={team.colour} options={COLOUR_OPTIONS} error={errorFor(`team-${team.id}-colour`)} onChange={value => updateTeam(team.id, "colour", value)} /><SelectField label="Batch" value={team.batch} options={["2026 - Batch A", "2026 - Batch B", "2026 - Batch C"]} error={errorFor(`team-${team.id}-batch`)} onChange={value => updateTeam(team.id, "batch", value)} /><SelectField label="Members" value={team.members} options={MEMBER_OPTIONS} error={errorFor(`team-${team.id}-members`)} onChange={value => updateTeam(team.id, "members", value)} /><div className="qc-member-count"><b>{team.learners.length}</b> Members selected</div><div className="qc-member-chips">{team.learners.map((learner, i) => <button type="button" key={`${learner}-${i}`} onClick={() => setTeams(previous => previous.map(t => t.id === team.id ? { ...t, learners: t.learners.filter((_, index) => index !== i) } : t))}>{learner} ×</button>)}<button type="button" onClick={() => { const learner = prompt("Learner name"); if (learner?.trim()) setTeams(previous => previous.map(t => t.id === team.id ? { ...t, learners: [...t.learners, learner.trim()] } : t)); }}>+ Add learner</button></div><label className="qc-field"><span>Access Code</span></label><div className="qc-access-code"><input aria-label={`${team.name} access code`} value={team.accessCode} aria-invalid={Boolean(errorFor(`team-${team.id}-accessCode`))} onChange={e => updateTeam(team.id, "accessCode", e.target.value)} /><button type="button" onClick={() => navigator.clipboard.writeText(team.accessCode)}>Copy</button><button type="button" onClick={() => updateTeam(team.id, "accessCode", makeCode(team.name))}>New Code</button></div>{errorFor(`team-${team.id}-accessCode`) && <small role="alert" className="qc-input-error">{errorFor(`team-${team.id}-accessCode`)}</small>}</article>)}</div><div className="qc-team-visibility"><ToggleRow label="Team Name Visible On Winner Screen" checked={showTeamNames} onChange={setShowTeamNames} /></div><div className="qc-add-match"><button type="button" className="qc-pill-button" onClick={addTeam} disabled={teams.length >= 8}>＋ Add Match</button><span>Up to 4 matches (8 teams)</span></div></Section>
      <Section index={3} title={sectionTitles[3]} open={openSections.includes(3)} toggle={() => toggleSection(3)}><div className="qc-xp-grid"><div className="qc-xp-panel">{select("XP TO WIN", "xpToWin", ["5000", "10000", "15000", "20000"])}{select("RANK NAME", "rankNames", RANK_OPTIONS)}<div className="qc-rank-ladder"><div className="qc-field-heading">RANK LADDER (XP NEEDED)</div>{[["AI Spark", "sparkXP"], ["AI Boost", "boostXP"], ["AI Elite", "eliteXP"], ["AI Titan", "titanXP"]].map(([label, key]) => <div className="qc-rank-row" key={key}><span>{label}</span><select value={form[key] ?? ""} aria-invalid={Boolean(errorFor(key))} onChange={e => update(key, e.target.value)}><option value="" disabled>Select XP</option>{["0", "500", "1000", "2000", "3000", "4000", "5000", "6000", "7000", "8000", "9000", "10000", "15000", "20000"].map(xp => <option key={xp}>{xp}</option>)}</select>{errorFor(key) && <small role="alert" className="qc-input-error">{errorFor(key)}</small>}</div>)}</div></div><div className="qc-xp-panel">{select("LIFELINES PER TEAM", "lifelinesPerTeam", ["1", "2", "3", "4"])}{["30s Blitz – adds 30 seconds", "60s Boost – adds 60 seconds", "50:50 Split – removes 2 options / locks 2 pictures", "Each lifeline usable once per team"].map((label, index) => <ToggleRow key={label} label={label} checked={lifelines[index]} onChange={value => setLifelines(previous => previous.map((old, i) => i === index ? value : old))} />)}</div></div></Section>
      <Section index={4} title={sectionTitles[4]} open={openSections.includes(4)} toggle={() => toggleSection(4)}><div className="qc-timing-grid">{select("Default timer per question (sec)", "timer", ["N/A", "15", "30", "45", "60", "90", "120"])}<CalendarField label="Available from" value={form.availableFrom} min={today || undefined} onChange={value => update("availableFrom", value)} error={errorFor("availableFrom")} /><CalendarField label="Available Until" value={form.availableUntil} min={form.availableFrom || today || undefined} onChange={value => update("availableUntil", value)} error={errorFor("availableUntil")} />{select("Who can Play", "audience", AUDIENCE_OPTIONS)}</div><div className="qc-notification"><ToggleRow label="Notify learners when Published" checked={notifyLearners} onChange={setNotifyLearners} /></div></Section>
    </div>{message && <p className="qc-message" role="status">{message}</p>}<footer className="qc-footer"><button type="button" className="qc-footer-button" onClick={() => router.push("/assessments")}>Back</button><div className="qc-footer-actions"><button type="button" className="qc-footer-button" onClick={save}>Save</button><button type="button" className="qc-footer-button qc-continue" onClick={continuePage} disabled={!loaded}>Continue</button></div></footer>
  </div></div></section></div></main>;
}
