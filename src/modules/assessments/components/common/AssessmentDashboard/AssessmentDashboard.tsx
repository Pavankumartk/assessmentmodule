"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import "./assessment.css";
import {useAssessments} from "@/modules/assessments/hooks/useAssessment";
import {duplicateAssessment,deleteAssessment,setActiveAssessmentId} from "@/modules/assessments/storage/assessment-storage";
import {typeGroups,getAssessmentTypeGroups} from "@/modules/assessments/config/assessment-types";
import {getDemoSession} from "@/modules/assessments/auth/demo-auth";
import CreateStep from "../steps/CreateStep/CreateStep";
import PortalShell from "../PortalShell";

// Match these filenames to the files already in public/assets/assessmenticons.

// No icon library is used in this page.

const ICON_ROOT = "/assets/assessmenticons/";

const icons = {

  plus: `${ICON_ROOT}plus.svg`,

  search: `${ICON_ROOT}search-02.svg`,

  down: `${ICON_ROOT}arrow-down-01.svg`,

  sort: `${ICON_ROOT}sorting-01.svg`,

  actions: `${ICON_ROOT}more-vertical.svg`,

  previous: `${ICON_ROOT}arrowleft.svg`,

  next: `${ICON_ROOT}arrowright.svg`,

};

type AssessmentStatus = "Published" | "Draft" | "Closing soon" | "Scheduled";

type Assessment = {

  id: string;
  createdAt: string;

  title: string;

  type: string;

  course: string;

  questions: number;

  marks: number;

  status: AssessmentStatus;

  window: string | null;

  attempts: string;

  grading: string;

  submissions: string;

};

type FilterName = "course" | "type" | "status" | "sort";

type OptionGroup = { heading: string; items: string[] };

const courseGroups: OptionGroup[] = [

  { heading: "By Category", items: ["Academic", "Corporate Training", "Professional Development", "Compliance", "Technical", "Soft Skills", "Language Learning", "Certification", "Vocational / Skills Training", "Continuing Education"] },

  { heading: "Courses", items: ["Java Development", "Python Programming", "Data Structures & Algorithms", "Artificial Intelligence", "Machine Learning", "Cybersecurity", "Cloud Computing", "Project Management", "Leadership & Management", "Employee Onboarding", "Workplace Safety", "Communication Skills"] },

  { heading: "By Program", items: ["Undergraduate", "Postgraduate", "Diploma", "Certificate", "Professional Certification", "Employee Training"] },

  { heading: "By Organization", items: ["All Organizations", "Organization A", "Organization B", "Organization C"] },

];

const simpleOptions: Record<"status" | "sort", string[]> = {

  status: ["All Status", "Draft", "Scheduled", "Published", "Active", "Closed", "Archived", "Cancelled"],

  sort: ["Default", "Assessment A-Z", "Assessment Z-A", "Newest First", "Oldest First"],

};

function FilterDropdown({ name, label, value, onChange, icon, open, onToggle, onClose }: {

  name: FilterName;

  label: string;

  value: string;

  onChange: (value: string) => void;

  icon: string;

  open: boolean;

  onToggle: () => void;

  onClose: () => void;

}) {

  const [typed, setTyped] = useState("");

  const [expanded, setExpanded] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const searchable = name === "course" || name === "type";

  const groups = name === "course" ? courseGroups : getAssessmentTypeGroups();

  useEffect(() => {

    if (!open) {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
      setTyped(""); setExpanded([]); return;
    }

    const handleOutside = (event: PointerEvent) => {

      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();

    };

    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };

    const handleFocus = (event: FocusEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    };

    const menu = menuRef.current;
    const handleWheel = (event: WheelEvent) => {
      if (!menu || !event.deltaY) return;
      let element = event.target instanceof Element ? event.target : null;
      while (element && menu.contains(element)) {
        if (element instanceof HTMLElement) {
          const overflow = window.getComputedStyle(element).overflowY;
          const canScroll = /auto|scroll/.test(overflow) && element.scrollHeight > element.clientHeight;
          if (canScroll && ((event.deltaY < 0 && element.scrollTop > 0) ||
              (event.deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1))) return;
        }
        element = element.parentElement;
      }
      event.preventDefault();
    };

    document.addEventListener("pointerdown", handleOutside);

    document.addEventListener("keydown", handleEscape);

    document.addEventListener("focusin", handleFocus);
    menu?.addEventListener("wheel", handleWheel, { passive: false });

    return () => {

      document.removeEventListener("pointerdown", handleOutside);

      document.removeEventListener("keydown", handleEscape);

      document.removeEventListener("focusin", handleFocus);
      menu?.removeEventListener("wheel", handleWheel);

    };

  }, [open, onClose]);

  const select = (option: string) => { onChange(option); onClose(); };

  const isAll = name === "course" ? "All Courses" : "All Types";

  const shownGroups = searchable ? groups.map(group => ({

    ...group,

    items: group.heading.toLowerCase().includes(typed.toLowerCase()) ? group.items : group.items.filter(item => item.toLowerCase().includes(typed.toLowerCase())),

  })).filter(group => !typed || group.heading.toLowerCase().includes(typed.toLowerCase()) || group.items.length > 0) : [];

  return (

    <div className={`asm-filter asm-filter--${name}`} ref={rootRef}
      onPointerEnter={() => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }}
      onPointerLeave={event => {
        if (!open || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(onClose, 300);
      }}>

      <button className="asm-filter-trigger" type="button" aria-expanded={open} aria-label={label} onClick={onToggle}>

        <span>{value || label}</span>

        <img src={icon} alt="" width={20} height={20} />

      </button>

      {open && <div className="asm-filter-menu" ref={menuRef}>

        {searchable ? <>

          <label className="asm-dropdown-search">

            <img src="/assets/assessmenticons/search-02.svg" alt="" width={18} height={18} />

            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder={name === "course" ? "Search courses..." : "Search assessment types..."} aria-label={`Search ${label}`} />

          </label>

          <div className="asm-filter-options">

            <button type="button" className="asm-filter-option" onClick={() => select(isAll)}>

              <span className={`asm-choice-circle ${!value || value === isAll ? "is-checked" : ""}`} aria-hidden="true" />{isAll}

            </button>

            {shownGroups.map(group => {

              const expandedNow = typed.length > 0 || expanded.includes(group.heading);

              return <div className="asm-filter-group" key={group.heading}>

                <button type="button" className="asm-filter-group-heading" aria-expanded={expandedNow} onClick={() => setExpanded(prev => prev.includes(group.heading) ? prev.filter(x => x !== group.heading) : [...prev, group.heading])}>

                  <span>{group.heading}</span><span className={`asm-group-chevron ${expandedNow ? "is-open" : ""}`} aria-hidden="true" />

                </button>

                {expandedNow && <div className="asm-filter-group-items">

                  {(typed && group.heading.toLowerCase().includes(typed.toLowerCase()) ? group.items : group.items).map(item => <button key={item} type="button" className="asm-filter-option" onClick={() => select(item)}>

                    <span className={`asm-choice-circle ${value === item ? "is-checked" : ""}`} aria-hidden="true" />{item}

                  </button>)}

                </div>}

              </div>;

            })}

            {!shownGroups.length && <div className="asm-no-options">No matching options</div>}

          </div>

        </> : <div className="asm-filter-options asm-filter-options--simple">

          {simpleOptions[name as "status" | "sort"].map(option => <button key={option} type="button" className="asm-filter-option" onClick={() => select(option)}>

            <span className={`asm-choice-circle ${value === option || (!value && option === simpleOptions[name as "status" | "sort"][0]) ? "is-checked" : ""}`} aria-hidden="true" />{option}

          </button>)}

        </div>}

      </div>}

    </div>

  );

}

function AssessmentContent({initialScreen = "list"}:{initialScreen?:"list"|"create"}) {
  const router=useRouter();
  const stored=useAssessments();
  const [tenantId,setTenantId]=useState<string|null>(null);
  useEffect(()=>{setTenantId(getDemoSession()?.tenantId||null);},[]);
  const assessments:Assessment[]=stored.filter(item=>tenantId!==null && (item.tenantId||"north")===tenantId).map(item=>({
    id:item.id,createdAt:item.createdAt,title:item.title,type:item.typeCode.toUpperCase(),course:item.course,
    questions:item.questions,marks:item.marks,status:item.status,window:null,
    attempts:item.attemptCount?`${item.attemptCount} Attempts`:"—",grading:item.status==="Published"?"Auto-graded":"Not Graded",submissions:item.attemptCount?`${item.attemptCount} Submitted`:"—"
  }));
  const kpis=[
    {label:"Total Assessment",value:String(assessments.length).padStart(2,"0"),color:"total"},
    {label:"Draft",value:String(assessments.filter(a=>a.status==="Draft").length).padStart(2,"0"),color:"draft"},
    {label:"Published",value:String(assessments.filter(a=>a.status==="Published").length).padStart(2,"0"),color:"published"},
    {label:"To be Graded",value:"00",color:"grading"},
    {label:"Closing Soon",value:"00",color:"closing"}
  ];

  const [query, setQuery] = useState("");

  const [course, setCourse] = useState("");

  const [type, setType] = useState("");

  const [status, setStatus] = useState("");

  const [sort, setSort] = useState("");

  const [page, setPage] = useState(1);

  const [viewAll, setViewAll] = useState(false);

  const [openAction, setOpenAction] = useState<string | null>(null);
  const actionLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (actionLeaveTimer.current) clearTimeout(actionLeaveTimer.current); }, []);
  useEffect(()=>{
    if (!openAction) return;
    const close=(event:PointerEvent)=>{if (!(event.target as HTMLElement)?.closest?.(".asm-action-cell")) setOpenAction(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpenAction(null);};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};
  },[openAction]);

  const [notice, setNotice] = useState("");
  const [screen, setScreen] = useState<"list" | "create">(initialScreen);

  const [openFilter, setOpenFilter] = useState<FilterName | null>(null);

  const pageSize = 6;

  const results = useMemo(() => {

    const filtered = assessments.filter((item) =>

      item.title.toLowerCase().includes(query.toLowerCase()) &&

      (!course || course === "All Courses" || item.course === course) &&

      (!type || type === "All Types" || item.type === type || (type === "Multiple Choice Question (MCQ)" && item.type === "MCQ") || (type === "True / False" && item.type === "T/F") || (type === "Quick Quiz" && item.type === "Quiz")) &&

      (!status || status === "All Status" || item.status === status || (status === "Active" && item.status === "Published") || (status === "Closed" && item.status === "Closing soon"))

    );

    if (sort === "Assessment A-Z") filtered.sort((a, b) => a.title.localeCompare(b.title));

    if (sort === "Assessment Z-A") filtered.sort((a, b) => b.title.localeCompare(a.title));

    if (sort === "Newest First") filtered.sort((a, b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));

    if (sort === "Oldest First") filtered.sort((a, b) => Date.parse(a.createdAt)-Date.parse(b.createdAt));

    return filtered;

  }, [query, course, type, status, sort, stored, tenantId]);

  const maxPage = Math.max(1, Math.ceil(results.length / pageSize));

  const currentPage = Math.min(page, maxPage);

  const shown = viewAll ? results : results.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const changeFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };

  if (screen === "create") {
    return <CreateStep onCancel={() => { setScreen("list"); router.push("/assessments"); }} />;
  }

  return (

    <main className="assessment-page">

      <div className="asm-heading-row">

        <div className="asm-heading">

          <h1>Assessments</h1>

          <p>Create, Schedule &amp; Manage Assessments</p>

        </div>

        <div style={{display:"flex",alignItems:"center",gap:14}}><button type="button" className="asm-create" onClick={() => { setScreen("create"); setOpenFilter(null); router.push("/assessments/create"); }}>

          <img src="/assets/assessmenticons/plus.svg" width={20} height={20} alt="" />

          <span>Create</span>

        </button></div>

      </div>

      <section className="asm-kpis" aria-label="Assessment overview">

        {kpis.map((card) => (

          <div className="asm-kpi" key={card.label}>

            <div className="asm-kpi-label">{card.label}</div>

            <strong className={`asm-kpi-value asm-kpi-value--${card.color}`}>{card.value}</strong>

          </div>

        ))}

      </section>

      <section className="asm-filters" aria-label="Assessment search and filters">

        <label className="asm-search">

          <input

            type="search"

            value={query}

            onChange={(event) => { setQuery(event.target.value); setPage(1); }}

            placeholder="Search assessment name..."

            aria-label="Search assessment name"

          />

          <img src={icons.search} width={20} height={20} alt="" />

        </label>

        <FilterDropdown name="course" label="Courses" value={course} onChange={changeFilter(setCourse)} icon={icons.down} open={openFilter === "course"} onToggle={() => setOpenFilter(openFilter === "course" ? null : "course")} onClose={() => setOpenFilter(null)} />

        <FilterDropdown name="type" label="Type" value={type} onChange={changeFilter(setType)} icon={icons.down} open={openFilter === "type"} onToggle={() => setOpenFilter(openFilter === "type" ? null : "type")} onClose={() => setOpenFilter(null)} />

        <FilterDropdown name="status" label="Status" value={status} onChange={changeFilter(setStatus)} icon={icons.down} open={openFilter === "status"} onToggle={() => setOpenFilter(openFilter === "status" ? null : "status")} onClose={() => setOpenFilter(null)} />

        <FilterDropdown name="sort" label="Sort By" value={sort} onChange={changeFilter(setSort)} icon={icons.sort} open={openFilter === "sort"} onToggle={() => setOpenFilter(openFilter === "sort" ? null : "sort")} onClose={() => setOpenFilter(null)} />

      </section>

      <section className="asm-recent" aria-label="Recent assessments">

        <div className="asm-recent-header">

          <h2>Recent Assessment</h2>

          <button className="asm-view-all" type="button" onClick={() => { setViewAll(!viewAll); setOpenAction(null); }}>

            {viewAll ? "View less" : "View all"}

          </button>

        </div>

        <div className="asm-table-scroll">

          <table className="asm-table">

            <colgroup>

              <col className="asm-col-assessment" />

              <col className="asm-col-status" />

              <col className="asm-col-window" />

              <col className="asm-col-attempts" />

              <col className="asm-col-grading" />

              <col className="asm-col-submissions" />

              <col className="asm-col-actions" />

            </colgroup>

            <thead><tr>

              <th>Assessment</th>

              <th>Status</th><th>Window</th><th>Attempts</th><th>Grading</th><th>Submissions</th><th>Actions</th>

            </tr></thead>

            <tbody>

              {shown.map((item) => (

                <tr key={item.id}>

                  <td><div className="asm-assessment-name">{item.title}</div><div className="asm-assessment-meta">{item.type} | {item.questions} Questions | {item.marks} Marks</div></td>

                  <td><span className={`asm-status asm-status--${item.status.toLowerCase().replaceAll(" ", "-")}`}><i />{item.status}</span></td>

                  <td>{item.window ? <div className="asm-window"><div>Opens: {item.window}</div><div>Closes: Sep 16, 23:00</div></div> : "Not Scheduled"}</td>

                  <td>{item.attempts}</td><td>{item.grading}</td><td>{item.submissions}</td>

                  <td className="asm-action-cell">

                    <div className="asm-action-control"
                      onPointerEnter={() => { if (actionLeaveTimer.current) clearTimeout(actionLeaveTimer.current); actionLeaveTimer.current = null; }}
                      onPointerLeave={event => {
                        if (openAction !== item.id || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
                        if (actionLeaveTimer.current) clearTimeout(actionLeaveTimer.current);
                        actionLeaveTimer.current = setTimeout(() => setOpenAction(current => current === item.id ? null : current), 300);
                      }}>

                    <button className="asm-action-button" type="button" aria-label={`Actions for ${item.title}`} aria-expanded={openAction === item.id} onClick={() => setOpenAction(openAction === item.id ? null : item.id)}>

                      <img src={icons.actions} width={20} height={20} alt="" />

                    </button>

                    {openAction === item.id && <div className="asm-action-menu">

                      {(["View details", "Edit assessment", "Duplicate", "Delete"] as string[]).map(action => <button key={action} type="button" onClick={() => {
                      setOpenAction(null);
                      if(action === "Duplicate") { duplicateAssessment(item.id); setNotice(`Duplicated ${item.title}`); return; }
                      if(action === "Delete") {
                        if(window.confirm(`Delete assessment "${item.title}"? This cannot be undone.`)) {
                          if(deleteAssessment(item.id)) setNotice(`Deleted ${item.title}`);
                          else setNotice("Unable to delete this assessment.");
                        }
                        return;
                      }
                      setActiveAssessmentId(item.id);
                      if(action === "View details") {router.push(`/assessments/${encodeURIComponent(item.id)}/details`);return;}
                      sessionStorage.setItem("assessment-editing-id",item.id);
                      router.push(`/assessments/${encodeURIComponent(item.id)}/edit`);
                    }}>{action}</button>)}

                    </div>}

                    </div>

                  </td>

                </tr>

              ))}

              {!shown.length && <tr><td className="asm-empty" colSpan={7}>No assessments found</td></tr>}

            </tbody>

          </table>

        </div>

      </section>

      <footer className="asm-footer">

        <span>Showing {results.length ? String(viewAll ? 1 : (currentPage - 1) * pageSize + 1).padStart(2, "0") : "00"} to {String(viewAll ? results.length : Math.min(currentPage * pageSize, results.length)).padStart(2, "0")} of {results.length}</span>

        {!viewAll && <nav className="asm-pagination" aria-label="Assessment pagination">

          <button type="button" disabled={currentPage === 1} aria-label="Previous page" onClick={() => setPage(Math.max(1, currentPage - 1))}><img src={icons.previous} width={19} height={19} alt="" /></button>

          <span className="asm-current-page">{currentPage}</span>

          <button type="button" disabled={currentPage >= maxPage} aria-label="Next page" onClick={() => setPage(Math.min(maxPage, currentPage + 1))}><img src={icons.next} width={19} height={19} alt="" /></button>

        </nav>}

      </footer>

      {notice && <div className="asm-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}

    </main>

  );

}


// Create Assessment is intentionally page-only. The application header and sidebar
// remain the responsibility of the parent layout.
// The shell follows the same Header / Sidebar imports and nesting
// used by the supplied reference page. Assessment features remain unchanged.
export default function AssessmentPage({initialScreen="list"}:{initialScreen?:"list"|"create"}) {
  return <PortalShell><AssessmentContent initialScreen={initialScreen}/></PortalShell>;
}
