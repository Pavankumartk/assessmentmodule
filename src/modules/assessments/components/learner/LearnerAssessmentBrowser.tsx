"use client";

import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {getDemoSession} from "@/modules/assessments/auth/demo-auth";
import {getAssessment,getAssessments,setActiveAssessmentId,viewerPath,resultPath,assessmentStorage} from "@/modules/assessments/storage/assessment-storage";
import type {LearnerAssessment,LearnerStatus} from "./learner-assessment-data";
import {releaseForAssessment} from "@/modules/assessments/components/viewer/assessment-result-bridge";
import {learnerAssessmentData,learnerAssessmentsForTenant} from "./learner-assessment-data";
import "./learner-assessment.css";

type Filter = "All" | LearnerStatus;
const filters: Filter[] = ["All", "Live", "Upcoming", "Completed"];
const dateText = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short",year:"numeric"}).format(date);
};

export default function LearnerAssessmentBrowser(){
  const router=useRouter();
  const [items,setItems]=useState<LearnerAssessment[]>([]);
  const [chosen,setChosen]=useState<string>("");
  const [filter,setFilter]=useState<Filter>("All");
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const session=getDemoSession();
    if (!session) {router.replace("/login");return;}
    if (session.role!=="learner") {router.replace("/assessments");return;}
    const requested=new URLSearchParams(window.location.search).get("selected");
    const update=()=>{
      const next=learnerAssessmentsForTenant(getAssessments(),session.tenantId);
      setItems(next);
      setChosen(previous=>next.some(item=>item.record.id===previous)?previous:next.some(item=>item.record.id===requested)?requested!:next[0]?.record.id || "");
      setReady(true);
    };
    update();
    const refreshTimer=window.setInterval(update,30000);
    window.addEventListener("storage",update);
    window.addEventListener("neurolxp-assessments-changed",update);
    return ()=>{window.clearInterval(refreshTimer);window.removeEventListener("storage",update);window.removeEventListener("neurolxp-assessments-changed",update);};
  },[router]);
  useEffect(()=>{
    if (!ready) return;
    const scrollArea=document.querySelector<HTMLElement>(".institutionScrollArea");
    if (scrollArea) scrollArea.scrollTop=0;
  },[ready]);
  const selected=items.find(item=>item.record.id===chosen);
  const release=selected ? releaseForAssessment(selected.record.typeCode, Number(selected.attempts.at(-1)?.pendingCount) || 0, selected.record.id) : null;
  const visible=useMemo(()=>items.filter(item=>filter==="All"||item.status===filter),[items,filter]);
  const proceed=()=>{
    if(!selected?.canStart)return;
    const latest=getAssessment(selected.record.id);
    if(!latest || !learnerAssessmentData(latest).canStart) {
      const session=getDemoSession();
      if(session)setItems(learnerAssessmentsForTenant(getAssessments(),session.tenantId));
      return;
    }
    setActiveAssessmentId(selected.record.id);
    if (selected.record.typeCode === "image-based") {
      try { const key=`neurolxp.imageLabeling.viewer.${selected.record.id}`; const state=JSON.parse(sessionStorage.getItem(key)||"null"); if (state?.step === "submitted" || state?.step === "results") sessionStorage.removeItem(key); } catch {}
    }
    if (/^(ai-assessment|ai-interviews)/.test(selected.record.typeCode)) {
      try { const key=`aiInterviewSession:${selected.record.id}`; const state=JSON.parse(sessionStorage.getItem(key)||"null"); if(state?.finished) sessionStorage.removeItem(key); } catch {}
    }
    // Entering from the learner list is always a fresh Instructions entry.
    // Preserve the viewer itself, all Submit dialogs, Results and retry routes.
    if (selected.record.typeCode === "fill-in-the-blanks") {
      assessmentStorage.removeItem("fillBlanksViewerStarted");
    }
    // A completed attempt must not be restored when another attempt is allowed.
    for (const key of ["viewerAttemptDraft", "fillBlanksViewerState", "dragDropViewerState", "matchFollowingViewerState", "connectDotsViewerState", "viewClickHotspotViewerState"]) {
      try { const saved=JSON.parse(assessmentStorage.getItem(key) || "null"); if(saved && (saved.submitted || saved.finished)) assessmentStorage.removeItem(key); } catch { /* Keep malformed or unfinished work untouched. */ }
    }
    const resumeProblem = /^problem-solving/.test(selected.record.typeCode) && selected.attemptsUsed > 0 && !selected.hasActiveAttempt;
    router.push(`${viewerPath(selected.record.id)}?instructions=1${resumeProblem ? "&retry=1" : ""}`);
  };
  if(!ready)return null;
  return <div className="portalScreen learnerAssessmentRoot">
    <nav aria-label="Breadcrumb" className="learnerAssessmentBreadcrumb"><a href="/dashboard">Dashboard</a><span aria-hidden="true">»</span><strong>Assessment</strong></nav>
    <div className="learnerAssessmentHeading"><h1>Assessment</h1><p>Pick an assessment to see its details</p></div>
    <div className="learnerAssessmentFilters" role="group" aria-label="Filter assessments">
      {filters.map(option=><button type="button" key={option} className={option===filter?"selected":""} aria-pressed={option===filter} onClick={()=>{setFilter(option);if(option!=="All"&&selected?.status!==option){const first=items.find(item=>item.status===option);if(first)setChosen(first.record.id);}}}>{option}</button>)}
    </div>
    {items.length===0?<div className="learnerEmptyState"><h2>No assessments available</h2><p>Your institute has not published an assessment for you yet.</p></div>:
    <div className="learnerAssessmentTwoColumn">
      <div className="learnerAssessmentList" aria-label="Assessments">
        {visible.length?visible.map(item=><button type="button" key={item.record.id} className={`learnerAssessmentListCard ${chosen===item.record.id?"is-selected":""}`} aria-pressed={chosen===item.record.id} onClick={()=>setChosen(item.record.id)}>
          <span className="learnerListTitleRow"><strong>{item.record.title}</strong><span className={`learnerStatusBadge is-${item.status.toLowerCase()}`}>{item.status}</span></span>
          <span className="learnerCardSubtitle">{item.course} · {item.record.typeLabel}</span>
          <span className="learnerCardSubtitle">{item.totalQuestions} Qs · {item.totalMarks} marks · {item.duration?`${item.duration} min`:"Untimed"}</span>
        </button>):<div className="learnerEmptyFilter">No {filter.toLowerCase()} assessments.</div>}
      </div>
      <div className="learnerAssessmentDetail">
        {selected? <>
          <section className="learnerDetailCard learnerOverview">
            <div className="learnerDetailTitle"><h2>{selected.record.title}</h2><span className={`learnerStatusBadge is-${selected.status.toLowerCase()}`}>{selected.status}</span></div>
            <p className="learnerCardSubtitle">{selected.course} · {selected.record.typeLabel}{selected.module?` · ${selected.module}`:""}</p>
            <div className="learnerMetricGrid">
              <div><span>Total questions</span><strong>{selected.totalQuestions}</strong></div>
              <div><span>Total marks</span><strong>{selected.totalMarks}</strong></div>
              <div><span>Duration</span><strong>{selected.duration?`${selected.duration} min`:"Untimed"}</strong></div>
              <div><span>Passing score</span><strong>{selected.passingScore}</strong></div>
              <div><span>Negative marking</span><strong>{selected.negativeMarking}</strong></div>
              <div><span>Attempts used</span><strong>{selected.attemptsUsed + (selected.hasActiveAttempt ? 1 : 0)} / {selected.attemptLimitLabel}</strong></div>
            </div>
          </section>
          <section className="learnerDetailCard"><h3>Schedule</h3><div className="learnerScheduleGrid"><div><span>Available window</span><strong>{selected.schedule}</strong></div><div><span>Mode</span><strong>{selected.mode}</strong></div></div></section>
          <section className="learnerDetailCard learnerHistoryCard"><h3>Attempt History</h3><div className="learnerTableScroll"><table className="learnerAttemptsTable"><thead><tr><th>Attempt</th><th>Date</th><th>Score</th><th>Result</th><th>Grade</th></tr></thead><tbody>{selected.attempts.length?selected.attempts.map((attempt,index)=>{
            const policy=releaseForAssessment(selected.record.typeCode,Number(attempt.pendingCount)||0,selected.record.id);
            const waiting=policy.mode!=="immediate";
            const pending=Number(attempt.pendingCount)>0 || attempt.scorePercent === null;
            const score=Number.isFinite(attempt.scorePercent)?Number(attempt.scorePercent):null;
            const threshold=Number.parseFloat(selected.passingScore);
            const grade=policy.showPassFail && score!==null && Number.isFinite(threshold) ? (score>=threshold?"Passed":"Not passed") : "—";
            return <tr key={attempt.attemptId||index}><td>{index+1}</td><td>{dateText(attempt.submittedAt)}</td><td>{waiting ? (policy.mode==="scheduled"?"Scheduled":"Not released") : pending ? "Awaiting grading" : policy.showScore && score!==null ? String(score) + "%" : "—"}</td><td>{waiting ? (policy.mode==="scheduled"?"Scheduled: " + policy.releaseDateLabel:"Not released") : pending ? "Pending review" : "Available"}</td><td>{waiting ? (policy.mode==="scheduled"?"Scheduled":"Not released") : pending ? "Awaiting grading" : grade}</td></tr>;
          }):<tr className="learnerEmptyHistoryRow"><td colSpan={5}><span className="learnerNoAttempts">{selected.hasActiveAttempt?"Attempt in progress":"No attempt yet"}</span></td></tr>}</tbody></table></div>
            {selected.attempts.length>0 && release?.mode !== "never" && <div className="learnerReadyActions"><button type="button" disabled={release?.mode!=="immediate"} onClick={()=>{setActiveAssessmentId(selected.record.id);router.push(resultPath(selected.record.id));}}>View Result</button></div>}
          </section>
          <section className="learnerDetailCard learnerReadyCard"><h3>Ready to Begin</h3><div className="learnerReadyChecks"><p className={selected.canStart?"is-positive":"is-muted"}>{selected.canStart?"Assessment open now":selected.status==="Upcoming"?"Assessment is not open yet":"Assessment is closed or completed"}</p><p className="is-positive">{selected.maxAttempts===null?"Attempts are available":`${Math.max(0,selected.maxAttempts-selected.attemptsUsed-(selected.hasActiveAttempt?1:0))} attempt(s) remaining`}</p><p className="learnerReadyNeutral">Stable internet connection</p><p className="learnerReadyNeutral">Quiet place{selected.duration?`, ${selected.duration} minutes free`:""}</p></div>
            <div className="learnerReadyActions"><button type="button" disabled={!selected.canStart} onClick={proceed}>Proceed to instructions <span aria-hidden="true">→</span></button></div>
            {!selected.canStart&&<p className="learnerUnavailableNote">{selected.status==="Upcoming"?`Available when the assessment opens${selected.startAt?` on ${dateText(selected.startAt.toISOString())}`:""}.`:"This assessment is no longer available to start."}</p>}
          </section>
        </>:<div className="learnerEmptyState"><h2>Select an assessment</h2><p>Choose an assessment from the list to view its details.</p></div>}
      </div>
    </div>}
  </div>;
}
