"use client";
import WizardStepLink from "@/modules/assessments/components/common/WizardStepLink";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {beginAssessment} from "@/modules/assessments/storage/assessment-storage";
import {getAssessmentTypes,findAssessmentTypeByLabel,getAssessmentTypeGroups,createTypes} from "@/modules/assessments/config/assessment-types";
import {hasAssessmentWorkflow} from "@/modules/assessments/config/component-registry";

export default function CreateStep({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [openType, setOpenType] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 16, left: 16 });
  const [selectedSubtype, setSelectedSubtype] = useState<Record<string, string>>({});
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const startingRef = useRef(false);
  const [welcomeName, setWelcomeName] = useState("there");
  const [nextNotice, setNextNotice] = useState(false);

  useEffect(() => {
    // Detect a displayed name in an imported header. Never render another header.
    const findName = () => {
      const candidates = [
        '.topHeader .topUserName',
        '[data-header-name]', '[data-user-name]', '.header-user-name',
        '.profile-name', '.user-name', '.userName', '.headerProfileName',
        '.user-info h3', 'header .profile-info strong', 'header .user-info strong'
      ];
      for (const selector of candidates) {
        const node = document.querySelector(selector);
        const name = node?.textContent?.trim();
        if (name) { setWelcomeName(name.split(/\s+/)[0]); return; }
      }
    };
    findName();
    const observer = new MutationObserver(findName);
    const header = document.querySelector('header');
    if (header) observer.observe(header, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!openType) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenType(null); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [openType]);

  // Anchor the popup to the clicked card, including while the page scrolls.
  const updatePopupPosition = (button: HTMLButtonElement) => {
    const card = button.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const mobile = window.innerWidth <= 700;
    const width = mobile ? Math.min(290, window.innerWidth - margin * 2) : 280;
    let left = card.right + gap;
    if (left + width > window.innerWidth - margin) left = card.left - width - gap;
    if (mobile || left < margin) {
      left = Math.max(margin, Math.min(card.left, window.innerWidth - width - margin));
    }
    // Never shift the popup upward to a different row. Limit its height instead.
    const top = Math.max(margin, card.top);
    setPopupPosition({ top, left });
  };

  const showTypePopup = (title: string, button: HTMLButtonElement) => {
    if (openType === title) { setOpenType(null); activeCardRef.current = null; return; }
    activeCardRef.current = button;
    updatePopupPosition(button);
    setOpenType(title);
    setNextNotice(false);
  };

  useEffect(() => {
    if (!openType) return;
    const followCard = () => {
      if (activeCardRef.current?.isConnected) updatePopupPosition(activeCardRef.current);
      else setOpenType(null);
    };
    window.addEventListener("scroll", followCard, true);
    window.addEventListener("resize", followCard);
    return () => {
      window.removeEventListener("scroll", followCard, true);
      window.removeEventListener("resize", followCard);
    };
  }, [openType]);

  useEffect(() => {
    if (!openType) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".asm-subtype-panel") && !target.closest(".asm-type-card")) setOpenType(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openType]);

  const openTypeIndex = createTypes.findIndex(item => item.title === openType);
  const popupItems = openTypeIndex >= 0 ? Array.from(new Set([...getAssessmentTypeGroups()[openTypeIndex].items,...getAssessmentTypes().filter(t=>t.category===openType).map(t=>t.label)])) : [];

  const shown = createTypes.filter(item =>
    (item.title + " " + item.subtitle).toLowerCase().includes(search.toLowerCase())
  );

  const startAssessment = (label: string | undefined) => {
    const configured = label ? findAssessmentTypeByLabel(label) : null;
    if (!configured?.implemented || !hasAssessmentWorkflow(configured.code)) return false;
    if (startingRef.current) return true;
    beginAssessment(configured.code, configured.label);
    startingRef.current = true;
    sessionStorage.removeItem("assessment-editing-id");
    router.push("/assessments/create/details");
    // The selector can be restored from the router cache when the user goes back.
    // Do not let a previous click permanently block a new selection.
    window.setTimeout(() => { startingRef.current = false; }, 1000);
    return true;
  };

  return (
    <main className="assessment-page asm-create-page">
      <div className="asm-create-top">
        <div className="asm-create-progress-area">
          <div className="asm-breadcrumb">
            <button type="button" className="asm-breadcrumb-parent" onClick={onCancel}>Assessment</button>
            <span className="asm-breadcrumb-divider" aria-hidden="true">»</span>
            <span className="asm-breadcrumb-current">Create Assessment</span>
          </div>
          <ol className="asm-wizard" aria-label="Assessment creation steps">
            {(["Type", "Details", "Content", "Evaluation", "Review"] as const).map((label, index) => (
              <li key={label} className={`asm-wizard-step ${index === 0 ? "asm-wizard-step--active" : ""}`}><WizardStepLink index={index} current={0}/>
                <span className="asm-wizard-number">{index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="asm-welcome" role="status">
          <div className="asm-welcome-title"><img className="asm-welcome-wave" src="/assets/assessmenticons/wavinghand.svg" alt="" width={30} height={30} /><strong>Welcome Back, {welcomeName}!</strong></div>
          <span>Create Assessments, Measure Real Learning</span>
        </div>
      </div>

      <section className="asm-type-section" aria-label="Select assessment type">
        <div className="asm-type-section-header">
          <div className="asm-type-copy">
            <h1>Assessment Type</h1>
            <p>Choose How You Want To Assess Learners</p>
          </div>
          <label className="asm-create-search">
            <img src="/assets/assessmenticons/search-02.svg" alt="" width={20} height={20} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Assessment Type" aria-label="Search Assessment Type" />
          </label>
        </div>
        <div className="asm-type-grid">
          {shown.map(item => (
            <button key={item.title} type="button"
              className={`asm-type-card asm-type-card--${item.tone} ${openType === item.title ? "asm-type-card--selected" : ""}`}
              aria-expanded={openType === item.title}
              onClick={(event) => showTypePopup(item.title, event.currentTarget)}>
              <span className="asm-type-title">{item.title}</span>
              <span className="asm-type-subtitle">{item.subtitle}</span>
              <span className="asm-type-bottom"><strong>{String(item.count).padStart(2, "0")} Types</strong>
                <img className="asm-type-arrow" src="/assets/assessmenticons/arrowupright.svg" width={24} height={24} alt="" />
              </span>
            </button>
          ))}
          {shown.length === 0 && <div className="asm-types-empty">No assessment types match your search.</div>}
        </div>
        {openType && (
          <div className="asm-subtype-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenType(null); }}>
            <div className={`asm-subtype-panel asm-type-card--${createTypes.find(item => item.title === openType)?.tone ?? "academic"}`} style={{ top: popupPosition.top, left: popupPosition.left, maxHeight: `min(365px, calc(100dvh - ${Math.max(12, popupPosition.top)}px - 12px))` }} role="dialog" aria-modal="true" aria-label={openType}>
              <div className="asm-subtype-header">
                <h2>{openType}</h2>
                <button type="button" className="asm-subtype-close" onClick={() => setOpenType(null)} aria-label="Close assessment types">×</button>
              </div>
              <div className="asm-subtype-options" role="radiogroup" aria-label={`${openType} types`}>
                {popupItems.map((item) => (
                  <button type="button" key={item} className={`asm-subtype-option ${selectedSubtype[openType] === item ? "is-selected" : ""}`}
                    role="radio" aria-checked={selectedSubtype[openType] === item}
                    onClick={() => {
                      setSelectedSubtype(prev => ({ ...prev, [openType]: item }));
                      setSelected(openType);
                      setOpenType(null);
                      setNextNotice(!startAssessment(item));
                    }}>
                    <span className={`asm-choice-circle ${selectedSubtype[openType] === item ? "is-checked" : ""}`} aria-hidden="true" />
                    <span>{item === "Multiple Choice Question (MCQ)" ? "MCQ" : item}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="asm-create-footer">
        {nextNotice && <span role="status" className="asm-next-note asmValidationError">{selected ? "This assessment type is not available yet." : "Choose an assessment type first."}</span>}
        <button type="button" className="asm-create-footer-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="asm-create-footer-button asm-create-footer-button--continue" onClick={() => {
           setOpenType(null);
           setNextNotice(!startAssessment(selectedSubtype[selected]));
         }}>Continue</button>
      </div>
    </main>
  );
}


