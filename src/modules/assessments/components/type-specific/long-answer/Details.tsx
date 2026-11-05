"use client";
import AssessmentRichToolbar from "@/modules/assessments/components/common/AssessmentRichToolbar";
import { applyAssessmentFont } from "@/modules/assessments/components/common/assessment-editor-font";
import {validateCompleteDetails, detailsFieldSections, type DetailsFieldErrors} from "@/modules/assessments/validation/details-full-validation";
import { ASSESSMENT_DEPARTMENTS, ASSESSMENT_PROGRAMS, getCourseModuleGroups } from "@/modules/assessments/config/assessment-types";
import { AssessmentEditorDropdown } from "@/modules/assessments/components/common/steps/DetailsStep/DetailsStep";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import "./details.css";
import "@/modules/assessments/validation/details-validation.css";

const sections = [
  { title: "Basic Information", fields: [
    { label: "Assessment Title", name: "assessmentTitle", type: "text", placeholder: "Enter assessment title" },
    { label: "Description", name: "description", type: "textarea", placeholder: "Enter assessment description" },
    { label: "Instructions", name: "instructions", type: "textarea", placeholder: "Enter instructions for learners" },
  ] },
  { title: "Scoring & Grading", fields: [
    { label: "Total Marks", name: "totalMarks", type: "number", placeholder: "Enter total marks" },
    { label: "Passing Marks", name: "passingMarks", type: "number", placeholder: "Enter passing marks" },
    { label: "Grading Method", name: "gradingMethod", type: "select", placeholder: "Select grading method", options: ["Auto Graded", "Manual Grading", "Combined"] },
  ] },
  { title: "Timing & Availability", fields: [
    { label: "Duration (minutes)", name: "duration", type: "number", placeholder: "Enter duration" },
    { label: "Available From", name: "availableFrom", type: "datetime-local", placeholder: "" },
    { label: "Available Until", name: "availableUntil", type: "datetime-local", placeholder: "" },
  ] },
  { title: "Attempts & Access", fields: [
    { label: "Allowed Attempts", name: "attempts", type: "number", placeholder: "Enter allowed attempts" },
    { label: "Access", name: "access", type: "select", placeholder: "Select access", options: ["Enrolled Learners", "Assigned Learners", "All Learners"] },
  ] },
  { title: "Audience", fields: [
    { label: "Assign To", name: "audience", type: "select", placeholder: "Select audience", options: ["All Learners", "Selected Course", "Selected Batch", "Selected Group"] },
  ] },
] as const;

type FormData = Record<string, string>;


// Neumorphic date picker: day, month and year selectors are part of the same control.
function MCQCalendar({ label, value, disabled, onChange, minDate }: {
  label: string; value: string; disabled: boolean; onChange: (date: string) => void; minDate?: string;
}) {
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (disabled) setVisible(false); }, [disabled]);
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const [month, setMonth] = useState(initial.getMonth());
  const [year, setYear] = useState(initial.getFullYear());
  const root = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 420, maxHeight: 420 });
  const positionPopup = useCallback(() => {
    if (!root.current) return;
    const r = root.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(420, viewportWidth - 24);
    const height = Math.min(400, viewportHeight - 24);
    const left = Math.max(12, Math.min(r.left, viewportWidth - width - 12));
    const below = viewportHeight - r.bottom - 12;
    const above = r.top - 12;
    const openBelow = below >= height || below >= above;
    const maxHeight = Math.max(130, Math.min(height, openBelow ? below - 8 : above - 8));
    const top = openBelow ? r.bottom + 8 : Math.max(8, r.top - maxHeight - 8);
    setPosition({ top, left, width, maxHeight });
  }, []);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const yearStart = Math.floor(year / 12) * 12;
  const todayDate = (() => {const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");})();
  const minimumDate = minDate && minDate > todayDate ? minDate : todayDate;
  const formatDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4) : iso;
  useEffect(() => {
    if (!visible) return;
    positionPopup();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !popupRef.current?.contains(target)) setVisible(false);
    };
    const reposition = () => positionPopup();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setVisible(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [visible, positionPopup]);
  const shift = (delta: number) => {
    if (mode === "years") setYear(y => y + delta * 12);
    else { const next = new Date(year, month + delta, 1); setMonth(next.getMonth()); setYear(next.getFullYear()); }
  };
  const offset = new Date(year, month, 1).getDay();
  const days = Array.from({ length: 35 + (offset + new Date(year, month + 1, 0).getDate() > 35 ? 7 : 0) }, (_, i) => new Date(year, month, i - offset + 1));
  return <div className="mcqCalendarRoot" ref={root}>
    <button type="button" className="mcqCalendarInput" disabled={disabled} aria-label={label} aria-expanded={visible}
      onClick={() => { if (!visible && (value || minDate)) { const date = new Date(`${value || minDate}T12:00:00`); if (Number.isFinite(date.getTime())) { setMonth(date.getMonth()); setYear(date.getFullYear()); } } setVisible(v => !v); setMode("days"); }}>
      <span>{value ? formatDate(value) : label}</span><svg className="mcqCalendarGlyph" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.5 3.5v4M16.5 3.5v4M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8.5 13.5h2M13.5 13.5h2M8.5 17h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
    {visible && typeof document !== "undefined" && createPortal(
      <div ref={popupRef} className="mcqCalendarPopup" role="dialog" aria-label={`${label} calendar`}
        style={{ position: "fixed", top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight, zIndex: 99999 }}>
      <div className="mcqCalendarTop">
        <button type="button" className="mcqCalendarNav" aria-label="Previous" onClick={() => shift(-1)}><Image src="/assets/assessmenticons/arrowleft.svg" alt="" width={18} height={18} unoptimized /></button>
        <button type="button" className="mcqCalendarChoose" onClick={() => setMode(mode === "months" ? "days" : "months")}>{months[month]} <Image src="/assets/assessmenticons/arrow-down-01.svg" width={18} height={18} alt="" unoptimized /></button>
        <button type="button" className="mcqCalendarChoose mcqCalendarYearButton" onClick={() => setMode(mode === "years" ? "days" : "years")}>{year} <Image src="/assets/assessmenticons/arrow-down-01.svg" width={18} height={18} alt="" unoptimized /></button>
        <button type="button" className="mcqCalendarNav" aria-label="Next" onClick={() => shift(1)}><Image src="/assets/assessmenticons/arrowright.svg" alt="" width={18} height={18} unoptimized /></button>
      </div>
      {mode === "days" && <><div className="mcqCalendarWeek">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(day => <span key={day}>{day}</span>)}</div>
        <div className="mcqCalendarDays">{days.map((day, i) => {
          const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
          return <button key={i} type="button" disabled={iso < minimumDate} className={`${day.getMonth() !== month ? "mcqCalendarMuted " : ""}${value === iso ? "mcqCalendarSelected" : ""}`} onClick={() => { onChange(iso); setVisible(false); }}>{day.getDate()}</button>;
        })}</div></>}
      {mode === "months" && <div className="mcqCalendarMonths">{months.map((name,i) => <button key={name} className={i === month ? "mcqCalendarSelected" : ""} type="button" disabled={`${year}-${String(i+1).padStart(2,"0")}-31` < minimumDate} onClick={() => { setMonth(i); setMode("days"); }}>{name}</button>)}</div>}
      {mode === "years" && <><div className="mcqCalendarYearNav"><button type="button" aria-label="Previous years" onClick={() => setYear(y => y - 12)}><Image src="/assets/assessmenticons/arrowleft.svg" alt="" width={18} height={18} unoptimized /></button><strong>{yearStart} - {yearStart + 11}</strong><button type="button" aria-label="Next years" onClick={() => setYear(y => y + 12)}><Image src="/assets/assessmenticons/arrowright.svg" alt="" width={18} height={18} unoptimized /></button></div><div className="mcqCalendarYears">{Array.from({length:12},(_,i) => yearStart+i).map(y => <button type="button" className={y===year ? "mcqCalendarSelected" : ""} key={y} disabled={y < Number(minimumDate.slice(0,4))} onClick={() => { setYear(y); setMode("days"); }}>{y}</button>)}</div></>}
    </div>, document.body)}
  </div>;
}


// Reference dropdowns: exact label groups with the existing neumorphic radio style.
const assessmentNames = [
  "Introduction to Artificial Intelligence", "AI Fundamentals", "Artificial Intelligence Basics",
  "AI Concepts & Principles", "Introduction to Machine Learning", "Machine Learning Fundamentals",
  "Neural Networks Basics", "Deep Learning Fundamentals", "Generative AI Essentials",
  "Prompt Engineering Basics", "AI Ethics & Responsible AI", "AI Applications & Use Cases",
  "AI Knowledge Check", "AI Fundamentals Quiz", "Artificial Intelligence Final Assessment",
];
const assessmentTypeGroups = [
  { heading: "Academic assessment", items: ["Multiple Choice Question (MCQ)", "Multiple Response", "True / False", "Fill in the Blank", "One-Word Answer", "Long Answer", "Numeric Response", "Formula Response", "Matrix Question", "Assertion & Reason", "Ranking Question", "Quick Quiz", "Timed Quiz", "Scenario Quiz"] },
  { heading: "Interactive Assessments", items: ["Drag & Drop", "Match the Following", "Sequence & Order", "Connect the Dots", "Clickable Hotspot", "Interactive Diagram", "Interactive Concept Map", "Puzzle Challenge", "Memory Game", "Interactive Story"] },
  { heading: "Multimedia Assessments", items: ["Image-Based Assessment", "Audio-Based Assessment", "Video-Based Assessment", "Visual Identification", "Video Response", "Audio Response", "Screen Recording Task", "Media Annotation"] },
  { heading: "Application & Practical Assessments", items: ["Case Study", "Problem-Solving Challenge", "Assignment", "Project Assessment", "Research Task", "Practical Task", "Lab Assessment", "Simulation Assessment", "Design Review", "Presentation Assessment", "Role-Play Assessment", "Oral Viva", "Product Demonstration"] },
  { heading: "Portfolio Assessments", items: ["Portfolio Assessment", "Project Showcase", "Code Portfolio", "Design Portfolio", "Research Portfolio"] },
  { heading: "Collaborative Assessments", items: ["Peer Assessment", "Self Assessment", "Group Project Assessment", "Team Challenge", "Discussion Assessment", "Debate Assessment", "Peer Review", "Collaborative Task"] },
  { heading: "Gamified Challenges", items: ["Quiz Battle", "Team Battle", "Tournament", "Daily Challenge", "Weekly Challenge", "Skill Sprint", "Boss Battle", "Mission Challenge", "Escape Room", "Mystery Challenge"] },
  { heading: "AI-Powered Assessments", items: ["AI Interview", "AI Viva", "Adaptive Assessment", "AI Mentor Challenge", "AI Competency Assessment", "AI Skill Gap Assessment"] },
  { heading: "Certification & Professional Assessments", items: ["Online Exam", "Mock Exam", "Skill Evaluation", "Competency Assessment", "Certification Assessment", "Certification Renewal Assessment", "Professional Readiness Assessment", "Compliance Assessment", "Safety Assessment", "Product Knowledge Assessment", "Sales Competency Assessment"] },
  { heading: "Career & Behavioral Assessments", items: ["Communication Assessment", "Soft Skills Assessment", "Leadership Assessment", "Situational Judgment Test", "Interview Readiness Assessment", "Industry Simulation", "Client Project Assessment", "Startup Challenge", "Product Design Challenge", "Consulting Challenge"] },
];
const courseDropdownGroups = [
  { heading: "By Category", items: ["Academic", "Corporate Training", "Professional Development", "Compliance", "Technical", "Soft Skills", "Language Learning", "Certification", "Vocational / Skills Training", "Continuing Education"] },
  { heading: "Courses", items: ["Java Development", "Python Programming", "Data Structures & Algorithms", "Artificial Intelligence", "Machine Learning", "Cybersecurity", "Cloud Computing", "Project Management", "Leadership & Management", "Employee Onboarding", "Workplace Safety", "Communication Skills"] },
  { heading: "By Program", items: ["Undergraduate", "Postgraduate", "Diploma", "Certificate", "Professional Certification", "Employee Training"] },
  { heading: "By Organization", items: ["All Organizations", "Organization A", "Organization B", "Organization C"] },
];
type MCQDropdownKind = "assessmentName" | "assessmentType" | "course" | "module" | "simple";
function MCQReferenceDropdown({ label, kind, value, onChange, wide = false, options = [], disabled = false, compact = false, hideLabel = false, course = "", error }: {
  label: string; kind: MCQDropdownKind; value: string;
  onChange: (value: string) => void; wide?: boolean; options?: string[]; disabled?: boolean; compact?: boolean; hideLabel?: boolean; course?: string; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(kind === "course" ? ["Courses"] : kind === "assessmentType" ? ["Academic assessment"] : kind === "module" ? [] : []);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);
  const groups = kind === "assessmentType" ? assessmentTypeGroups : kind === "course" ? courseDropdownGroups.filter(group => group.heading === "Courses") : getCourseModuleGroups(course);
  const single = kind === "assessmentName" || kind === "simple";
  const customAudience = kind === "simple" && /^(Department|Program)(?:\s*\*)?$/.test(label);
  const singleItems = kind === "simple" ? options : assessmentNames;
  const display = value ? (kind === "assessmentType" && value === "Multiple Choice Question (MCQ)" ? "MCQ" : value) : `Select ${label.replace(/\s*\*$/, "").toLowerCase()}`;
  const selected = (item: string) => value === item || (kind === "assessmentType" && (value === "Long Answer / Essay" && item === "Long Answer"));
  const choose = (item: string) => { onChange(item); setOpen(false); setQuery(""); };
  const matches = (item: string) => item.toLowerCase().includes(query.toLowerCase());
  return (
    <div className={`${hideLabel ? "" : "mcqField"} ${wide ? "mcqFieldWide" : ""} mcqReferenceField ${compact ? "mcqReferenceCompact" : ""}`} ref={ref} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (ref.current && !ref.current.matches(":hover")) setOpen(false); }, 300); }}>
      {!hideLabel && <span>{label}</span>}
      <button type="button" disabled={disabled} className={`mcqReferenceTrigger ${error ? "mcqDetailsInvalid" : ""}`} aria-label={label} aria-invalid={Boolean(error)} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span>{display || `Select ${label.replace(/\s*\*$/, "").toLowerCase()}`}</span><Image src="/assets/assessmenticons/arrow-down-01.svg" width={20} height={20} alt="" unoptimized />
      </button>
      {open && !disabled && <div className="mcqReferenceMenu" role="group" aria-label={`${label} options`}>
        {kind === "course" && <div className="mcqReferenceMenuTitle">All Courses</div>}
        {(kind === "course" || kind === "assessmentName" || kind === "assessmentType" || kind === "module" || customAudience) &&
          <label className="mcqReferenceSearch"><Image src="/assets/assessmenticons/search-02.svg" width={17} height={17} alt="" unoptimized />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={kind === "course" ? "Search courses..." : kind === "assessmentType" ? "Search assessment types..." : kind === "module" ? "Search modules and units..." : customAudience ? "Search or enter an option..." : "Search assessment name..."} aria-label={`Search ${label}`} />
          </label>}
        {single ? singleItems.filter(matches).map(item => (
          <button type="button" key={item} className="mcqReferenceOption" role="radio" aria-checked={selected(item)} onClick={() => choose(item)}>
            <span className={`mcqReferenceRadio ${selected(item) ? "is-selected" : ""}`} aria-hidden="true" /><span>{item}</span>
          </button>
        )) : groups.map(group => {
          const filtered = group.items.filter(matches);
          if (query && !filtered.length && !matches(group.heading)) return null;
          const expanded = !!query || expandedGroups.includes(group.heading);
          return <div className="mcqReferenceGroup" key={group.heading}>
            {<button type="button" className="mcqReferenceHeading mcqReferenceHeadingButton" aria-expanded={expanded}
                onClick={() => setExpandedGroups(old => old.includes(group.heading) ? old.filter(g => g !== group.heading) : [...old, group.heading])}>
              {group.heading}<Image src="/assets/assessmenticons/arrow-down-01.svg" width={18} height={18} alt="" className={expanded ? "mcqReferenceArrowOpen" : ""} unoptimized />
            </button>}
            {expanded && (filtered.length ? filtered : (matches(group.heading) ? group.items : [])).map(item => (
              <button type="button" key={item} className="mcqReferenceOption" role="radio" aria-checked={selected(item)} onClick={() => choose(item)}>
                <span className={`mcqReferenceRadio ${selected(item) ? "is-selected" : ""}`} aria-hidden="true" /><span>{item}</span>
              </button>
            ))}
          </div>;
        })}
        {(kind === "assessmentName" || customAudience) && query.trim() && !singleItems.some(name => name.toLowerCase() === query.trim().toLowerCase()) && <button type="button" className="mcqReferenceOption" onClick={() => choose(query.trim())}>Use “{query.trim()}”</button>}
        {kind === "module" && groups.length === 0 && <p className="mcqReferenceEmpty">{course ? "No modules are available for this course." : "Select a course first."}</p>}
      </div>}
      {error && <p className="mcqDetailsError" role="alert">{error}</p>}
    </div>
  );
}

// Keep the original single time field. Show separate HH/MM lists only inside its popup.
function MCQTimePicker({ label, value, onChange, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState({ top: 0, left: 0, width: 218, maxHeight: 240 });
  const [hours = "00", minutes = "00"] = value.split(":");
  const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

  const placePopup = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 24);
    const maxHeight = Math.min(232, Math.max(100, window.innerHeight - 24));
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const showBelow = below >= maxHeight || below >= above;
    const available = Math.max(72, Math.min(maxHeight, (showBelow ? below : above) - 8));
    const top = showBelow ? rect.bottom + 7 : Math.max(8, rect.top - available - 7);
    setPopup({ top, left, width, maxHeight: available });
  }, []);

  useEffect(() => {
    if (!open || disabled) return;
    placePopup();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
    };
  }, [open, disabled, placePopup]);

  return (
    <div className="mcqSeparateTime" ref={rootRef}>
      <button type="button" className="mcqSingleTimeTrigger" aria-label={label}
        aria-expanded={open} disabled={disabled} onClick={() => setOpen(previous => !previous)}>
        <span>{value || label}</span>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 6.5v6l4 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && typeof document !== "undefined" && createPortal(
        <div ref={popupRef} className="mcqTimePopup" role="group" aria-label={`${label} hours and minutes`}
          style={{ position: "fixed", top: popup.top, left: popup.left, width: popup.width, height: popup.maxHeight, maxHeight: popup.maxHeight, zIndex: 99999 }}>
          <div className="mcqTimeColumn">
            <strong>HH</strong>
            <div className="mcqTimeOptions" role="listbox" aria-label={`${label} hours`}>
              {hourOptions.map(hour => <button type="button" role="option" aria-selected={hours === hour}
                className={hours === hour ? "mcqTimeSelected" : ""} key={hour}
                onClick={() => onChange(`${hour}:${minutes}`)}>{hour}</button>)}
            </div>
          </div>
          <div className="mcqTimeColumn">
            <strong>MM</strong>
            <div className="mcqTimeOptions" role="listbox" aria-label={`${label} minutes`}>
              {minuteOptions.map(minute => <button type="button" role="option" aria-selected={minutes === minute}
                className={minutes === minute ? "mcqTimeSelected" : ""} key={minute}
                onClick={() => { onChange(`${hours || "00"}:${minute}`); setOpen(false); }}>{minute}</button>)}
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
}


// Inline learner accommodation manager; stays within the existing MCQ accordion.
type AccommodationRecord = { learner: string; id: string; extraTime: string; accommodation: string };
const LEARNER_DIRECTORY = [
  { name: "Ananya Sharma", id: "S001", section: "Section A", extraTime: "+50%", department: "Computer Science", program: "B.Tech" },
  { name: "Rahul Kumar", id: "S002", section: "Section A", extraTime: "+25%", department: "Computer Science", program: "B.Tech" },
  { name: "Priya Nair", id: "S003", section: "Section A", extraTime: "+60%", department: "Computer Science", program: "B.Tech" },

];
function AccommodationDropdown({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="mcqAddLearnerField mcqAccommodationDropdown" ref={root} onPointerLeave={event => { if (event.pointerType === "mouse") window.setTimeout(() => { if (root.current && !root.current.matches(":hover")) setOpen(false); }, 300); }}>
    <label>{label}</label><button type="button" className="mcqAddLearnerSelect" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{value}</span><Image src="/assets/assessmenticons/arrow-down-01.svg" width={18} height={18} alt="" unoptimized /></button>
    {open && <div className="mcqAddLearnerChoices" role="radiogroup" aria-label={label}>{options.map(option => <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => { onChange(option); setOpen(false); }}><span className={`mcqAddLearnerRadio ${option === value ? "selected" : ""}`} aria-hidden="true" />{option}</button>)}</div>}
  </div>;
}
function AccommodationManager({ rows, setRows, assessmentTitle, duration, totalMarks, batch }: {
  rows: AccommodationRecord[];
  setRows: React.Dispatch<React.SetStateAction<AccommodationRecord[]>>;
  assessmentTitle: string; duration: string; totalMarks: string; batch: string;
}) {
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"extra" | "excluded">("extra");
  const [excludedSelected, setExcludedSelected] = useState<string[]>(() => rows.map(row => row.learner));
  const [excludeReason, setExcludeReason] = useState("Scheduled Conflict");
  const [excludeUntil, setExcludeUntil] = useState("Whole assessment");
  const [excludeNotes, setExcludeNotes] = useState("");
  const [notifyExcluded, setNotifyExcluded] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All section");
  const [show, setShow] = useState("All learners");
  const [department, setDepartment] = useState("All departments");
  const [program, setProgram] = useState("All Program");
  const [selected, setSelected] = useState<string[]>(() => rows.map(row => row.learner));
  const [page, setPage] = useState(0);
  const [extraType, setExtraType] = useState("% of time limit");
  const [extraValue, setExtraValue] = useState("");
  const [accommodation, setAccommodation] = useState("Extended Time");
  const [breakValue, setBreakValue] = useState("");
  const [reason, setReason] = useState("Learning Disability");
  const [validFor, setValidFor] = useState("this assessment only");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [customize, setCustomize] = useState(true);
  const [supportingFile, setSupportingFile] = useState("");
  const activeSelected = tab === "excluded" ? excludedSelected : selected;
  const setActiveSelected = tab === "excluded" ? setExcludedSelected : setSelected;
  const toggleLearner = (name: string) => setActiveSelected(previous => previous.includes(name) ? previous.filter(v => v !== name) : [...previous, name]);
  const clearAll = () => { if (tab === "excluded") setExcludedSelected([]); else { setSelected([]); setRows([]); } };
  const saveLearners = () => {
    setRows(previous => LEARNER_DIRECTORY.filter(l => selected.includes(l.name)).map((l, index) => ({
      learner: l.name,
      id: previous.find(record => record.learner === l.name)?.id || l.id || `S${String(index + 1).padStart(3, "0")}`,
      extraTime: extraType === "% of time limit" ? `+${extraValue || 0}%` : `+${extraValue || 0} min`,
      accommodation
    })));
    setAdding(false);
  };
  const matches = LEARNER_DIRECTORY.filter(l => [l.name, l.id, l.section, activeSelected.includes(l.name) ? (tab === "excluded" ? "Provided" : "Added") : "—", activeSelected.includes(l.name) ? "already added" : "not yet added"].some(value => value.toLowerCase().includes(search.trim().toLowerCase())) && (section === "All section" || section === l.section) && (department === "All departments" || department === l.department || (department === "IT" && l.department === "Information Technology")) && (program === "All Program" || (program === "B.tech CS" && l.program === "B.Tech" && l.department === "Computer Science") || (program === "B.tech IT" && l.program === "B.Tech" && l.department === "Information Technology")) && (show === "All learners" || (show === "already added" ? activeSelected.includes(l.name) : !activeSelected.includes(l.name))));
  const pageCount = Math.max(1, Math.ceil(matches.length / 14));
  const visible = matches.slice(Math.min(page, pageCount - 1) * 14, (Math.min(page, pageCount - 1) + 1) * 14);
  if (!adding) return <div className="mcqAccommodation">
    <div className="mcqAccommodationTop"><label><Image src="/assets/assessmenticons/search-02.svg" alt="" width={18} height={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Learner....." /></label><button type="button" onClick={() => {setSelected(rows.map(r => r.learner));setAdding(true);}}>Add Learners <Image src="/assets/assessmenticons/plus.svg" alt="" width={16} height={16}/></button></div>
    <div className="mcqAccommodationTable" role="table" aria-label="Extra Time Accommodations"><div className="mcqAccommodationHead" role="row"><span role="columnheader">Learner</span><span role="columnheader">ID</span><span role="columnheader">Extra Time</span><span role="columnheader">Accommodation</span><span role="columnheader">Action</span></div>
    {rows.filter(r => [r.learner, r.id, r.extraTime, r.accommodation].some(value => value.toLowerCase().includes(search.toLowerCase()))).map(r => <div className="mcqAccommodationRow" role="row" key={r.learner}><span role="cell" className="mcqLearnerName">{r.learner}</span><span role="cell">{r.id}</span><span role="cell">{r.extraTime}</span><span role="cell">{r.accommodation}</span><span role="cell"><button type="button" className="mcqAccommodationRemove" onClick={() => {setRows(prev => prev.filter(v => v.learner !== r.learner));setSelected(prev => prev.filter(v => v !== r.learner));}}>Remove</button></span></div>)}
    {!rows.some(r => [r.learner, r.id, r.extraTime, r.accommodation].some(value => value.toLowerCase().includes(search.toLowerCase()))) && <p className="mcqAccommodationEmpty">No learners found.</p>}</div>
  </div>;
  return typeof document !== "undefined" ? createPortal(<div className="mcqAddLearnersFullscreen" role="dialog" aria-modal="true" aria-label="Add Learners"><div className="mcqAddLearnersInline">
    <div className="mcqAddLearnersHeader"><button type="button" className="mcqAddLearnersBack" onClick={() => setAdding(false)}><Image src="/assets/assessmenticons/leftlong.svg" width={20} height={20} alt="" unoptimized/>Back</button><h3>Add Learners</h3></div>
    <div className="mcqAddLearnersTabs"><button type="button" className={tab === "extra" ? "selected" : ""} onClick={() => {setTab("extra");setPage(0);setShow("All learners");}}>Extra time /accommodation</button><button type="button" className={tab === "excluded" ? "selected" : ""} onClick={() => {setTab("excluded");setPage(0);setShow("All learners");}}>Excluded Learners</button></div>
    <p className="mcqAddLearnersSubtitle">{assessmentTitle || "Introduction to AI"} · MCQ · {duration || "30"} min · {totalMarks || "40"} marks · {batch || "2026 — Batch A"}</p>
    <div className="mcqAddLearnersColumns"><section className="mcqAddLearnersPanel"><h4>1. Find Learners</h4>
      <div className="mcqAddLearnersFilters"><div className="mcqAddLearnerField"><label htmlFor="mcqLearnerFind">Search</label><div className="mcqAddLearnerSearch"><Image src="/assets/assessmenticons/search-02.svg" width={19} height={19} alt="" unoptimized/><input id="mcqLearnerFind" placeholder="Name or ID " value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /></div></div>
      <AccommodationDropdown label="Section / class" options={["All section","Section A","Section B"]} value={section} onChange={v => {setSection(v);setPage(0);}}/><AccommodationDropdown label="Show" options={["All learners","not yet added","already added"]} value={show} onChange={v => {setShow(v);setPage(0);}}/><AccommodationDropdown label="Department" options={["All departments","Computer Science","IT"]} value={department} onChange={v => {setDepartment(v);setPage(0);}}/><AccommodationDropdown label="Program" options={["All Program","B.tech CS","B.tech IT"]} value={program} onChange={v => {setProgram(v);setPage(0);}}/></div>
      <div className="mcqAddLearnersTableScroll"><table className="mcqAddLearnersTable"><thead><tr><th><input type="checkbox" aria-label="Select visible learners" checked={visible.length>0&&visible.every(l=>activeSelected.includes(l.name))} onChange={e=>setActiveSelected(prev => e.target.checked ? [...new Set([...prev,...visible.map(l=>l.name)])] : prev.filter(name=>!visible.some(l=>l.name===name)))} /></th><th>Learner</th><th>ID</th><th>Section</th><th>Status</th></tr></thead><tbody>{visible.map(l => <tr key={l.name}><td><input type="checkbox" checked={activeSelected.includes(l.name)} aria-label={`Select ${l.name}`} onChange={()=>toggleLearner(l.name)} /></td><td className="mcqAddLearnerLink">{l.name}</td><td>{l.id}</td><td>{l.section}</td><td className={activeSelected.includes(l.name)?(tab === "excluded" ? "mcqLearnerProvided" : "mcqLearnerAdded"):""}>{activeSelected.includes(l.name)?(tab === "excluded" ? "Provided" : "Added"):"—"}</td></tr>)}{!visible.length&&<tr><td colSpan={5}>No learners found.</td></tr>}</tbody></table></div>
      <div className="mcqAddLearnersPagination"><span>Showing {matches.length ? Math.min(page,pageCount-1)*14+1 : 0} to {Math.min((Math.min(page,pageCount-1)+1)*14,matches.length)} of {matches.length}</span><div><button type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} aria-label="Previous page"><Image src="/assets/assessmenticons/arrowleft.svg" width={18} height={18} alt="" unoptimized/></button><strong>{Math.min(page,pageCount-1)+1}</strong><button type="button" disabled={page>=pageCount-1} onClick={()=>setPage(p=>Math.min(pageCount-1,p+1))} aria-label="Next page"><Image src="/assets/assessmenticons/arrowright.svg" width={18} height={18} alt="" unoptimized/></button></div></div>
    </section><section className="mcqAddLearnersPanel"><h4>2. {tab === "excluded" ? "Excluded Learners" : "Set Accommodation"}</h4>
      <div className="mcqAddLearnersSelectedHeading"><strong>Selected Learners ({activeSelected.length})</strong><button type="button" onClick={clearAll}>Clear all</button></div><p className="mcqAddLearnersHelp">{activeSelected.length ? tab === "excluded" ? "added. Tick learners on the left to add more" : "Tick learners on the left to update your selection" : "none yet. Tick learners on the left"}</p>
      <div className="mcqAddLearnerChips">{activeSelected.map(name=><button key={name} type="button" onClick={()=>toggleLearner(name)}>{name}<span aria-hidden="true"><Image src="/assets/assessmenticons/bluecircle.svg" width={14} height={14} alt="" unoptimized/></span></button>)}</div>
      {tab === "excluded" ? <>
      <div className="mcqExcludedSettings">
        <AccommodationDropdown label="Reason" options={["Scheduled Conflict","Learning Disability","Medical","Language Support","Other"]} value={excludeReason} onChange={setExcludeReason}/>
        <AccommodationDropdown label="Exclude Until" options={["Whole assessment","Pick the date","On leave","Other"]} value={excludeUntil} onChange={setExcludeUntil}/>
        {excludeUntil === "Pick the date" && <div className="mcqAddLearnerField"><label htmlFor="mcqExcludeDate">Exclusion date</label><input id="mcqExcludeDate" type="date"/></div>}
        <div className="mcqAddLearnerField"><label htmlFor="mcqExcludeNotes">Notes (Optional)</label><textarea id="mcqExcludeNotes" rows={3} value={excludeNotes} placeholder="Add note here....." onChange={e=>setExcludeNotes(e.target.value)} /></div>
        <p className="mcqAddLearnersInfo">Excluded learners cannot see or start this assessment. An extra-time accommodation is kept but won't apply while they are excluded.</p>
        <div className="mcqAddLearnerToggle"><span>Notify excluded learner</span><button type="button" role="switch" aria-checked={notifyExcluded} onClick={()=>setNotifyExcluded(v=>!v)} className={`mcqSwitch ${notifyExcluded?"mcqSwitchOn":""}`}><span className="mcqSwitchState">{notifyExcluded?"ON":"OFF"}</span><span className="mcqSwitchKnob"/></button></div>
      </div><div className="mcqAddLearnersActions"><button type="button" onClick={()=>setAdding(false)}>Cancel</button><button type="button" className="mcqAddLearnersApply" onClick={()=>setAdding(false)}>Save Excluded Learners</button></div>
      </> : <>
      <div className="mcqAddLearnersSettings"><AccommodationDropdown label="Extra time type" options={["% of time limit","Fixed Time"]} value={extraType} onChange={setExtraType}/><div className="mcqAddLearnerField"><label htmlFor="mcqExtraTimeValue">Extra time {extraType==="Fixed Time"?"(minutes)":"(%)"}</label><input id="mcqExtraTimeValue" type="number" min="0" placeholder="Enter extra time" value={extraValue} onChange={e=>setExtraValue(e.target.value)}/></div>
      <p className="mcqAddLearnersInfo">{extraType === "% of time limit" ? `${duration||"30"} min · ${Math.round(Number(duration||30)*(1+Number(extraValue||0)/100))} min per learner (+ ${Math.round(Number(duration||30)*Number(extraValue||0)/100)} min). applies to every attempt` : `Extra ${extraValue||0} minutes per learner. Applies to every attempt.`}</p>
      <AccommodationDropdown label="Accommodation" options={["Extended Time","Extra Break","Screen reader","Large text","Separate room"]} value={accommodation} onChange={setAccommodation}/><div className="mcqAddLearnerField"><label htmlFor="mcqBreakValue">Extra Break (+5 min)</label><div className="mcqBreakStepper"><input id="mcqBreakValue" type="number" min="0" placeholder="Enter extra break" value={breakValue} onChange={e=>setBreakValue(e.target.value)}/><div className="mcqBreakStepperButtons"><button type="button" aria-label="Increase extra break" onClick={()=>setBreakValue(v=>String((Number(v)||0)+1))}><Image src="/assets/assessmenticons/arrow-down-01.svg" width={14} height={14} alt="" className="mcqBreakArrowUp" unoptimized/></button><button type="button" aria-label="Decrease extra break" onClick={()=>setBreakValue(v=>String(Math.max(0,(Number(v)||0)-1)))}><Image src="/assets/assessmenticons/arrow-down-01.svg" width={14} height={14} alt="" unoptimized/></button></div></div></div>
      <AccommodationDropdown label="Reason" options={["Learning Disability","Medical","Language Support","Other"]} value={reason} onChange={setReason}/><AccommodationDropdown label="Valid for" options={["this assessment only","All Mcq in this course","Language Support","Other"]} value={validFor} onChange={setValidFor}/>
      <div className="mcqAddLearnerField mcqAddLearnerFull"><label htmlFor="mcqExtraNotes">Notes (admins only)</label><textarea id="mcqExtraNotes" rows={3} value={notes} placeholder="Add note here....." onChange={e=>setNotes(e.target.value)} /></div>
      <div className="mcqAddLearnerField mcqAddLearnerFull"><label>Supporting Documents</label><label className="mcqAddLearnerAttach"><input type="file" onChange={e=>setSupportingFile(e.target.files?.[0]?.name||"")}/><span><Image src="/assets/assessmenticons/attachment.svg" width={17} height={17} alt="" unoptimized/>Attach</span><small>{supportingFile || "No file chosen"}</small></label></div>
      <div className="mcqAddLearnerFull mcqAddLearnerToggle"><span>Notify Learners by Emails</span><button type="button" role="switch" aria-checked={notify} onClick={()=>setNotify(v=>!v)} className={`mcqSwitch ${notify?"mcqSwitchOn":""}`}><span className="mcqSwitchState">{notify?"ON":"OFF"}</span><span className="mcqSwitchKnob"/></button></div>
      <div className="mcqAddLearnerFull mcqAddLearnerToggle"><span>Customize each learners</span><button type="button" role="switch" aria-checked={customize} onClick={()=>setCustomize(v=>!v)} className={`mcqSwitch ${customize?"mcqSwitchOn":""}`}><span className="mcqSwitchState">{customize?"ON":"OFF"}</span><span className="mcqSwitchKnob"/></button></div>
      </div><div className="mcqAddLearnersActions"><button type="button" onClick={()=>setAdding(false)}>Cancel</button><button type="button" className="mcqAddLearnersApply" onClick={saveLearners}>Apply to Selected Learners</button></div>
      </>}
    </section></div>
  </div></div>, document.body) : null;
}

export default function MCQDetailsPage() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<number[]>([]);
  const [form, setForm] = useState<FormData>({});
  const [message, setMessage] = useState("");
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); }, []);
  const [fieldErrors, setFieldErrors] = useState<DetailsFieldErrors>({});
  const [invalidSection, setInvalidSection] = useState<number | null>(null);
  const [accommodationRows, setAccommodationRows] = useState<{learner:string;id:string;extraTime:string;accommodation:string}[]>([]);
  const [markingScheme, setMarkingScheme] = useState("");
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [gradeToPass, setGradeToPass] = useState(false);
  const [partialCredit, setPartialCredit] = useState(false);
  const [tagText, setTagText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const addTag = () => {
    const value = tagText.trim();
    if (!value) return;
    setTags(previous => previous.some(tag => tag.toLowerCase() === value.toLowerCase()) ? previous : [...previous, value]);
    setTagText("");
  };
  const [editorFont, setEditorFont] = useState("Arial");
  const [editorSize, setEditorSize] = useState("16");
  const editorRef = useRef<HTMLDivElement>(null);
  const editorSelection = useRef<Range | null>(null);
  // Restore saved rich text only when its accordion becomes visible.
  useEffect(() => {
    if (expanded.includes(0) && editorRef.current && !editorRef.current.innerHTML && form.descriptionInstructions) {
      editorRef.current.innerHTML = form.descriptionInstructions;
    }
  }, [expanded, form.descriptionInstructions]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    timeLimit: false, perQuestionTimer: false, availableFrom: false, availableUntil: false,
    lateSubmission: false, accessCode: false, browserLockdown: false,
    webcamProctoring: false, prerequisite: false, notifyLearners: false,
  });
  useEffect(() => {
    try {
      const saved=JSON.parse(assessmentStorage.getItem("longAnswerAssessmentDraft")||"null");
      if (!saved || typeof saved!=="object") return;
      const {tags:savedTags,markingScheme:savedScheme,negativeMarking:savedNegative,gradeToPass:savedGrade,partialCredit:savedPartial,toggles:savedToggles,accommodationRows:savedAccommodations,...fields}=saved;
      setForm(fields);
      if (Array.isArray(savedTags)) setTags(savedTags);
      if (Array.isArray(savedAccommodations)) setAccommodationRows(savedAccommodations);
      if (typeof savedScheme==="string") setMarkingScheme(savedScheme);
      if (typeof savedNegative==="boolean") setNegativeMarking(savedNegative);
      if (typeof savedGrade==="boolean") setGradeToPass(savedGrade);
      if (typeof savedPartial==="boolean") setPartialCredit(savedPartial);
      if (savedToggles && typeof savedToggles==="object") setToggles(prev=>({...prev,...savedToggles}));
    } catch { /* New assessment stays empty. */ }
  },[]);
  const flip = (key: string) => setToggles(previous => ({ ...previous, [key]: !previous[key] }));


  const update = (name: string, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    if (name === "questionCount" && /^\d+$/.test(value) && Number(value) >= 1) { try { assessmentStorage.setItem("longAnswerQuestionCount", String(Number(value))); } catch {} }
    setMessage("");
    setFieldErrors(previous => { if (!previous[name]) return previous; const next = {...previous}; delete next[name]; return next; });
    setInvalidSection(null);
  };

  const fieldError = (name: string) => fieldErrors[name] ? <p className="mcqDetailsError" role="alert">{fieldErrors[name]}</p> : null;
  const clearFieldErrors = (...names: string[]) => setFieldErrors(previous => {
    if (!names.some(name => previous[name])) return previous;
    const next = { ...previous };
    names.forEach(name => delete next[name]);
    return next;
  });

  const toggleSection = (index: number) => {
    setExpanded((previous) => previous.includes(index) ? [] : [index]);
  };

  const basicField = (label: string, name: string, values: string[], wide = false) => (
    <MCQReferenceDropdown key={name} label={(["language", "passingScore", "gradeCategory", "roundingRule"].includes(name) && !label.includes("*") ? `${label} *` : label)} kind="simple"
      value={form[name] ?? ""} options={values}
      onChange={value => update(name, value)} wide={wide} error={fieldErrors[name]} />
  );

  // A single inset control with stacked up/down buttons; unlike a dropdown,
  // numeric values can be typed or stepped without changing the field layout.
  const numberField = (label: string, name: string, min = 0) => {
    const current = form[name] ?? "";
    const stepValue = (direction: number) => {
      const numeric = current === "" ? 0 : Number(current);
      update(name, String(Math.max(min, (Number.isFinite(numeric) ? numeric : 0) + direction)));
    };
    return (
      <div className="mcqField mcqNumericField" key={name}>
        <label htmlFor={`mcq-${name}`}>{label}{["totalMarks","questionCount","marksPerQuestion","attempts"].includes(name) && <b aria-hidden="true"> *</b>}</label>
        <div className="mcqNumberControl">
          <input
            id={`mcq-${name}`}
            type="number"
            autoComplete="off"
            min={min}
            step="1"
            value={current}
            placeholder={`Enter ${label.toLowerCase()}`}
            onChange={(event) => update(name, event.target.value)}
            aria-label={label}
            aria-invalid={Boolean(fieldErrors[name])}
          />
          <div className="mcqNumberSteppers">
            <button type="button" aria-label={`Increase ${label}`} onClick={() => stepValue(1)}>
              <Image src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={14} height={14} className="mcqStepperUp" unoptimized />
            </button>
            <button type="button" aria-label={`Decrease ${label}`} onClick={() => stepValue(-1)}>
              <Image src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={14} height={14} unoptimized />
            </button>
          </div>
        </div>
        {fieldError(name)}
      </div>
    );
  };

  const toggle = (title: string, enabled: boolean, change: (next: boolean) => void) => (
    <button type="button" className={`mcqSwitch ${enabled ? "mcqSwitchOn" : ""}`} role="switch" aria-checked={enabled} aria-label={title} onClick={() => change(!enabled)}>
      <span className="mcqSwitchState">{enabled ? "ON" : "OFF"}</span><span className="mcqSwitchKnob" />
    </button>
  );

  const selectField = (label: string, name: string, choices: string[], extraClass = "") => (
    <div key={name} className={`mcqField mcqSelectField ${extraClass}`}>
      <MCQReferenceDropdown label={(["timeZone", "attemptCooldown", "gradingMethod", "whoCanTake", "batch", "academicYear", "department", "program", "section"].includes(name) ? `${label} *` : label)} kind="simple"
        value={form[name] ?? ""} options={choices}
        onChange={value => update(name, value)} error={fieldErrors[name]} />
    </div>
  );

  const switchField = (label: string, key: string, defaultValue: string, choices: string[], extraClass = "") => (
    <div key={key} className={`mcqField ${extraClass}`}>
      <span>{label}{toggles[key] && <b aria-hidden="true"> *</b>}</span>
      <div className="mcqSwitchField">
        <MCQReferenceDropdown label={label} kind="simple" compact hideLabel disabled={!toggles[key]}
          value={form[key] ?? ""} options={choices}
          onChange={value => { update(key, value); setToggles(previous => ({...previous, [key]: true})); }} />
        {toggle(label, toggles[key], () => { flip(key); clearFieldErrors(key); })}
      </div>
      {toggles[key] && fieldError(key)}
    </div>
  );

  const rememberEditorSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) editorSelection.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreEditorSelection = () => {
    editorRef.current?.focus();
    if (editorSelection.current && editorRef.current?.contains(editorSelection.current.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(editorSelection.current);
    }
  };
  const runEditorCommand = (command: string, value?: string) => {
    restoreEditorSelection();
    if (command === "fontName" && value) applyAssessmentFont(editorRef.current, value); else document.execCommand(command, false, value);
    rememberEditorSelection();
    update("descriptionInstructions", editorRef.current?.innerHTML ?? "");
  };

  const insertEditorFile = (file: File, image: boolean) => {
    if (file.size > 1024 * 1024) { setMessage("Please choose a file smaller than 1 MB so it can be saved with the assessment."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      restoreEditorSelection();
      if (image) document.execCommand("insertImage", false, reader.result);
      else {
        const selection = window.getSelection();
        if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
        const link = document.createElement("a");
        link.href = reader.result; link.download = file.name; link.textContent = `Attachment: ${file.name}`;
        const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(link); range.setStartAfter(link); range.collapse(true);
        selection.removeAllRanges(); selection.addRange(range);
      }
      rememberEditorSelection();
      update("descriptionInstructions", editorRef.current?.innerHTML ?? "");
    };
    reader.readAsDataURL(file);
  };

  // Add matching SVG files manually inside public/assets/assessmenticons/.
  // Missing images stay hidden instead of displaying a broken-image icon.
  const toolbarIcon = (filename: string, label: string) => (
    <img
      src={`/assets/assessmenticons/${filename}.svg`}
      alt=""
      width={20}
      height={20}
      aria-hidden="true"
      onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
    />
  );

  const editorTool = (label: string, filename: string, command: string) => (
    <button key={label} type="button" title={label} aria-label={label}
      onMouseDown={event => event.preventDefault()} onClick={() => runEditorCommand(command)}>
      {toolbarIcon(filename, label)}
    </button>
  );

  const basicContent = () => (
    <div className="mcqDetailsFields mcqBasicFields">
      <MCQReferenceDropdown label="Assessment Name *" kind="assessmentName" value={form.assessmentName ?? ""} onChange={value => update("assessmentName", value)} error={fieldErrors.assessmentName} wide />
      <MCQReferenceDropdown label="Assessment Type" kind="assessmentType" value="Long Answer / Essay" onChange={() => {}} disabled />
      <MCQReferenceDropdown label="Course *" kind="course" value={form.course ?? ""} onChange={v => { update("course", v); setForm(prev => ({...prev, course:v, module:prev.course === v ? prev.module : ""})); }} error={fieldErrors.course} />
      {basicField("Language *", "language", ["English", "Hindi", "Kannada", "Tamil", "Telugu"])}
      <MCQReferenceDropdown label="Module / Unit *" kind="module" course={form.course ?? ""} value={form.module ?? ""} onChange={value => update("module", value)} error={fieldErrors.module} />
      <div className="mcqField">
        <span>Category / tags</span>
        <div className="mcqTagInput">
          <div className="mcqTags">{tags.map(tag => <button type="button" className="mcqTag" key={tag} title={`Remove ${tag}`} onClick={() => setTags(previous => previous.filter(item => item !== tag))}>{tag}<span aria-hidden="true"> ×</span></button>)}</div>
          <input aria-label="New category tag" placeholder="Enter category or tag" value={tagText} onChange={event => setTagText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} />
          <button type="button" className="mcqAddTag" disabled={!tagText.trim()} onClick={addTag}>Add <Image src="/assets/assessmenticons/plus.svg" alt="" width={16} height={16} unoptimized /></button>
        </div>
      </div>
      <div className="mcqField mcqFieldWide">
        <span>Description / Instructions <b aria-hidden="true">*</b></span>
        <div className="mcqEditor">
          <AssessmentRichToolbar label="Description and instructions" onRemember={rememberEditorSelection} onCommand={(name, value) => { if (name === "fontSize" && value) { runEditorCommand(name, "7"); editorRef.current?.querySelectorAll('font[size="7"]').forEach(node => { node.removeAttribute("size"); (node as HTMLElement).style.fontSize = value + "px"; }); update("descriptionInstructions", editorRef.current?.innerHTML ?? ""); } else runEditorCommand(name, value); }} />
          <div className="mcqEditorBody" ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-invalid={Boolean(fieldErrors.descriptionInstructions)} aria-label="Description and instructions" data-placeholder="Enter assessment description and instructions..." onKeyUp={rememberEditorSelection} onMouseUp={rememberEditorSelection} onBlur={rememberEditorSelection} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); rememberEditorSelection(); update("descriptionInstructions", event.currentTarget.innerHTML); }} onInput={(event) => { rememberEditorSelection(); update("descriptionInstructions", event.currentTarget.innerHTML); }} />
        </div>
        {fieldError("descriptionInstructions")}
      </div>
    </div>
  );

  const scoringContent = () => (
    <div className="mcqDetailsFields mcqScoringFields">
      {numberField("Total Marks", "totalMarks")}
      {numberField("Number of Question", "questionCount")}
      {numberField("Marks per Question", "marksPerQuestion")}
      <div className="mcqField mcqFieldWide">
        <span>Marking Scheme <b aria-hidden="true">*</b></span>
        <div className="mcqMarkingOptions">
          {["Fixed marks per question", "Weighted questions", "Custom marking"].map((option) => (
            <button key={option} type="button" className={`mcqMarkingOption ${markingScheme === option ? "mcqMarkingSelected" : ""}`} onClick={() => { setMarkingScheme(option); update("markingScheme", option); clearFieldErrors("markingScheme"); }}>
              <span className={`mcqChoiceCircle ${markingScheme === option ? "mcqChoiceChecked" : ""}`} aria-hidden="true" />
              <span>{option}</span>
            </button>
          ))}
        </div>
        {fieldError("markingScheme")}
      </div>
      <div className="mcqField"><span>Negative Marking{negativeMarking && <b aria-hidden="true"> *</b>}</span><div className="mcqSwitchField">
        <MCQReferenceDropdown label="Negative Marking" kind="simple" compact hideLabel disabled={!negativeMarking} value={form.negativeMarkingValue ?? ""} options={["-0.25", "-0.5", "-1"]} onChange={value => { update("negativeMarkingValue", value); setNegativeMarking(true); }} />
        {toggle("Negative Marking", negativeMarking, (enabled) => {setNegativeMarking(enabled); clearFieldErrors("negativeMarkingValue");})}
      </div>{negativeMarking && fieldError("negativeMarkingValue")}</div>
      {basicField("Passing Score", "passingScore", ["60%", "50%", "70%", "80%"])}
      <div className="mcqField"><span>Grade to Pass{gradeToPass && <b aria-hidden="true"> *</b>}</span><div className="mcqSwitchField">
        <MCQReferenceDropdown label="Grade to Pass" kind="simple" compact hideLabel disabled={!gradeToPass} value={form.gradeToPass ?? ""} options={["A", "B", "C", "D"]} onChange={value => { update("gradeToPass", value); setGradeToPass(true); }} />
        {toggle("Grade to Pass", gradeToPass, (enabled) => {setGradeToPass(enabled); clearFieldErrors("gradeToPass");})}
      </div>{gradeToPass && fieldError("gradeToPass")}</div>
      {gradeToPass && basicField("Grade category", "gradeCategory", ["A - 90-100%", "B - 75-89%", "C - 60-74%", "D - Below 60%"])}
      {basicField("Rounding Rule", "roundingRule", ["No rounding", "Round to nearest integer", "Round to 2 decimals"])}
    </div>
  );

  const timingContent = () => (
    <div className="mcqDetailsFields mcqTimingFields mcqThreeColumnFields">
      {switchField("Time Limit", "timeLimit", "Duration 30 Minutes", ["Duration 30 Minutes", "Duration 45 Minutes", "Duration 60 Minutes", "No Limit"])}
      {switchField("Per-question Timer", "perQuestionTimer", "Set Time Per Question", ["Set Time Per Question", "30 Seconds", "1 Minute", "2 Minutes"])}
      {selectField("Time Zone", "timeZone", ["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London"])}
      <div className="mcqField mcqDateField"><span>Available from{toggles.availableFrom && <b aria-hidden="true"> *</b>}</span><div className="mcqDateRow">
        <MCQCalendar label="Start Date" value={form.availableFromDate ?? ""} onChange={v => { update("availableFromDate", v); setToggles(previous => ({...previous, availableFrom: true})); }} disabled={!toggles.availableFrom} />
        <MCQTimePicker label="Start Time" value={form.availableFromTime ?? ""} onChange={value => { update("availableFromTime", value); setToggles(previous => ({...previous, availableFrom: true})); }} disabled={!toggles.availableFrom} />
        {toggle("Available from",toggles.availableFrom,() => {flip("availableFrom");clearFieldErrors("availableFromDate", "availableFromTime");})}
      </div>{toggles.availableFrom && <>{fieldError("availableFromDate")}{fieldError("availableFromTime")}</>}</div>
      <div className="mcqField mcqDateField"><span>Available to{toggles.availableUntil && <b aria-hidden="true"> *</b>}</span><div className="mcqDateRow">
        <MCQCalendar label="End Date" minDate={toggles.availableFrom ? form.availableFromDate || undefined : undefined} value={form.availableUntilDate ?? ""} onChange={v => { update("availableUntilDate", v); setToggles(previous => ({...previous, availableUntil: true})); }} disabled={!toggles.availableUntil} />
        <MCQTimePicker label="End Time" value={form.availableUntilTime ?? ""} onChange={value => { update("availableUntilTime", value); setToggles(previous => ({...previous, availableUntil: true})); }} disabled={!toggles.availableUntil} />
        {toggle("Available Until",toggles.availableUntil,() => {flip("availableUntil");clearFieldErrors("availableUntilDate", "availableUntilTime");})}
      </div>{toggles.availableUntil && <>{fieldError("availableUntilDate")}{fieldError("availableUntilTime")}</>}</div>
      {switchField("Late Submission", "lateSubmission", "Select", ["Select", "Grace Period - 10 Min", "Grace Period - 20 Min", "Grace Period - 30 Min", "No Grace Period"], "mcqLateSubmissionField")}
    </div>
  );

  const attemptsContent = () => (
    <div className="mcqDetailsFields mcqScoringFields">
      {numberField("Number of Attempts", "attempts", 1)}
      {selectField("Attempt Cooldown", "attemptCooldown", ["12 Hrs", "6 Hrs", "24 Hrs", "No Cooldown"])}
      {selectField("Grading Method", "gradingMethod", ["Highest Score", "Last Attempt", "Average Score", "First Attempt"])}
      {switchField("Access Code", "accessCode", "A7X9-KP42", ["A7X9-KP42", "Generate New Code"])}
      {switchField("Browser Lockdown", "browserLockdown", "Secure Exam Browser", ["Secure Exam Browser", "Browser Fullscreen", "Disabled"])}
      {switchField("Webcam Proctoring", "webcamProctoring", "Camera Check", ["Camera Check", "Live Proctoring", "Recording Only"])}
      {switchField("Prerequisite", "prerequisite", "Previous Assessment", ["Previous Assessment", "No Prerequisite"])}
      <div className="mcqField mcqFieldWide"><span>Extra Time / Accommodations</span><AccommodationManager rows={accommodationRows} setRows={setAccommodationRows} assessmentTitle={form.assessmentName ?? form.assessmentTitle ?? "Introduction to AI"} duration={form.duration ?? "30"} totalMarks={form.totalMarks ?? "40"} batch={form.batch ?? "2026 — Batch A"}/></div>
    </div>
  );

  const audienceContent = () => (
    <div className="mcqDetailsFields mcqAudienceFields">
      {selectField("Who can take this assessment?", "whoCanTake", ["All enrolled learners", "Assigned Learners", "Selected Learners"])}
      {selectField("Batch / Cohort", "batch", ["All Batches", "2026 — Batch A", "2026 — Batch B"])}
      {selectField("Academic Year", "academicYear", ["2026–2027", "2025–2026", "2027–2028"])}
      {selectField("Department", "department", ASSESSMENT_DEPARTMENTS)}
      {selectField("Program", "program", ASSESSMENT_PROGRAMS)}
      {selectField("Section / Class", "section", ["All Sections", "Section A", "Section B"])}
      {selectField("Excluded Learners", "excludedLearners", ["Add learners", "None"])}
      <div className="mcqField mcqNotifyOnly">
        <div className="mcqSwitchField">
          <span className="mcqNotifyDescription">Notify learners when published</span>
          {toggle("Notify learners when published", toggles.notifyLearners, () => flip("notifyLearners"))}
        </div>
      </div>
    </div>
  );

  const saveAndContinue = () => {
    const selectedForm={...form, assessmentType: "Long Answer"};
    const errors = validateCompleteDetails(form, { markingScheme, negativeMarking, gradeToPass, toggles });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const invalidSections = [...new Set(Object.keys(errors).map(name => detailsFieldSections[name] ?? 0))];
      const first = invalidSections[0];
      setInvalidSection(first);
      setMessage("Please complete the required fields highlighted in red before continuing.");
      setExpanded(previous => [...new Set([...previous, ...invalidSections])]);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() =>
        document.getElementById(`mcq-review-target-${first}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      ));
      return;
    }
    setInvalidSection(null);
    const count = Number(form.questionCount);
    try {
      assessmentStorage.setItem("longAnswerQuestionCount", String(count));
      assessmentStorage.setItem("longAnswerAssessmentDraft", JSON.stringify({ ...selectedForm, tags, markingScheme, negativeMarking, gradeToPass, partialCredit, toggles, accommodationRows }));
      updateAssessment({title:(form.assessmentName||form.assessmentTitle||"").trim(),course:form.course||"",questions:count,marks:Number(form.totalMarks)});
      setMessage("Successfully saved");
      saveTimer.current = window.setTimeout(() => { setMessage(""); router.push("/assessments/create/content"); }, 3000);
    } catch { setMessage("Unable to save the assessment. Please allow browser storage and try again."); }
  };

  return (
    <main className="superAdminPage institutionAdminPage mcqAppShell">
      <div className="dashboardLayout mcqDashboardLayout">
        <Sidebar />
        <section className="mainContent mcqMainContent">
          <div className="mcqHeaderSlot"><Header /></div>
          <div className="institutionScrollArea mcqScrollArea">
            <div className="pageContent institutionPageContent mcqPageContent">
              <div className="mcqBreadcrumb" aria-label="Breadcrumb">
                <Link href="/assessments" className="mcqBreadcrumbParent">Assessment</Link>
                <Image src="/assets/assessmenticons/arrowrightdouble.svg" alt="" width={20} height={20} className="mcqBreadcrumbArrow" unoptimized />
                <Link href="/assessments" className="mcqBreadcrumbCurrent">Create Assessment</Link>
              </div>

              <ol className="mcqWizard" aria-label="Assessment creation steps">
                {(["Type", "Details", "Content", "Evaluation", "Review"] as const).map((label, index) => (
                  <li key={label} className={`mcqWizardStep ${index === 0 ? "mcqWizardCompleted" : index === 1 ? "mcqWizardActive" : ""}`}><WizardStepLink index={index} current={1}/>
                    <span className="mcqWizardNumber"><span>{index + 1}</span></span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>

              <div className="mcqTitleGroup">
                <h1>Assessment Details (Long Answers)</h1>
                <p>Provide The Essential Details And Settings For Your Assessment.</p>
              </div>

              <div className="mcqAccordionList">
                {sections.map((section, index) => {
                  const isOpen = expanded.includes(index);
                  return (
                    <section id={`mcq-review-target-${index}`} className={`mcqAccordion ${isOpen ? "mcqAccordionOpen" : ""}`} key={section.title}>
                      <button type="button" className="mcqAccordionTrigger" onClick={() => toggleSection(index)} aria-expanded={isOpen} aria-controls={`mcq-section-${index}`}>
                        <span>{index + 1}. {section.title}</span>
                        <Image src="/assets/assessmenticons/arrow-down-01.svg" alt="" width={28} height={28} className="mcqAccordionArrow" unoptimized />
                      </button>
                      {isOpen && (
                        <div className="mcqAccordionContent mcqAccordionContentDesigned" id={`mcq-section-${index}`}>
                          {invalidSection === index && message && <p role="alert" style={{ color: "#BC1E2D", fontWeight: 600, margin: "0 0 14px" }}>{message}</p>}
                          {index === 0 ? basicContent() : index === 1 ? scoringContent() : index === 2 ? timingContent() : index === 3 ? attemptsContent() : index === 4 ? audienceContent() : section.fields.map((field) => (
                            <label className="mcqField" key={field.name}>
                              <span>{field.label}</span>
                              {field.type === "textarea" ? (
                                <textarea value={form[field.name] ?? ""} placeholder={field.placeholder} onChange={(event) => update(field.name, event.target.value)} rows={3} />
                              ) : field.type === "select" ? (
                                <select value={form[field.name] ?? ""} onChange={(event) => update(field.name, event.target.value)}>
                                  <option value="">{field.placeholder}</option>
                                  {"options" in field && field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              ) : (
                                <input type={field.type} value={form[field.name] ?? ""} placeholder={field.placeholder} onChange={(event) => update(field.name, event.target.value)} />
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>

              <div className="mcqFooter">
                <button type="button" className="mcqFooterButton" onClick={() => router.push("/assessments")}>Back</button>
                {message && <p className={`mcqFooterInlineMessage ${message === "Successfully saved" ? "mcqFooterSavedPill" : "mcqValidationError"}`} role={message === "Successfully saved" ? "status" : "alert"}>{message}</p>}
                <div className="mcqFooterRight">
                  <button type="button" className="mcqFooterButton mcqContinue mcqSaveContinue" disabled={message === "Successfully saved"} onClick={saveAndContinue}>Save &amp; Continue</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}