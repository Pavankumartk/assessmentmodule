"use client";
import {demoDashboardPath} from "@/modules/assessments/auth/demo-auth";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {useRouter} from "next/navigation";
import {resultPath} from "@/modules/assessments/storage/assessment-storage";
import type {ReleasePolicy} from "./result-release";
import "./text-submit-success.css";
const ICONS="/assets/viewericons/";
type Props = {title:string;scorePercent:number|null;pendingCount:number;passingScore:string;release:ReleasePolicy;isRetry?:boolean;onClose:()=>void;onBack?:()=>void;backLabel?:string;onViewResult?:()=>void};
export default function TextSubmitSuccess({title,scorePercent,pendingCount,passingScore,release,isRetry=false,onClose,onBack,backLabel="Back to Dashboard",onViewResult}:Props) {
 const router=useRouter();
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 if (!mounted) return null;
 const threshold=Number.parseFloat(passingScore)||60;
 const passed=scorePercent!==null && scorePercent>=threshold;
 const resultAvailable=release.mode==="immediate";
 const popup=<div className="viewerSuccessOverlay" role="presentation">
  <section className={`viewerSuccessDialog viewerSuccessDialog--${release.mode}`} role="dialog" aria-modal="true" aria-labelledby="textSubmitSuccessTitle">
   <button type="button" className="viewerSuccessClose" aria-label="Close" onClick={onClose}><img src={`${ICONS}multiplication-sign-square.svg`} alt="" width={16} height={16}/></button>
   <div className="viewerSuccessArt"><img src={`${ICONS}blast.png`} alt="" aria-hidden="true"/><img className="viewerSuccessCheck" src={`${ICONS}checkmark-circle.svg`} alt=""/></div>
   <h2 id="textSubmitSuccessTitle">Assessment Submitted</h2><h3>{title}</h3>
   <p>{isRetry ? "Your retry has been submitted. Your original assessment remains unchanged. " : ""}{release.message}</p>
   {resultAvailable ? <div className="viewerSuccessStats">
    <div><img className="viewerSuccessStatIcon" src={`${ICONS}award.svg`} alt=""/><span>Score<strong>{release.showScore && scorePercent!==null ? `${scorePercent}%` : pendingCount ? "Pending" : "Hidden"}</strong></span></div>
    <div><img className="viewerSuccessStatIcon" src={`${ICONS}checkmark-badge.svg`} alt=""/><span>Result<strong>{pendingCount ? "Awaiting grading" : release.showPassFail ? (passed ? "Passed" : "Failed") : "Submitted"}</strong></span></div>
   </div> : <div className={`viewerSuccessReleaseCard viewerSuccessReleaseCard--${release.mode}`}>
    <img src={`${ICONS}${release.mode==="scheduled" ? "calendarb.svg" : release.mode==="manual" ? "userb.svg" : "eye-off.svg"}`} alt="" width={40} height={40}/>
    <span className="viewerSuccessReleaseInfo"><strong>{release.mode==="scheduled" ? "Result Available" : "Status"}</strong><small>{release.mode==="scheduled" ? release.releaseDateLabel : release.mode==="manual" ? "Awaiting result Release" : "Submitted"}</small></span>
   </div>}
   <div className="viewerSuccessActions"><button type="button" onClick={()=>onBack ? onBack() : router.push(demoDashboardPath())}>{backLabel}</button>{release.mode!=="never" && <button type="button" disabled={!resultAvailable} onClick={()=>{if(resultAvailable) { if(onViewResult) onViewResult(); else router.push(resultPath()); }}}>View Result</button>}</div>
  </section>
 </div>;
 // Portal to the root shell instead of the scroll panel so both success and confirmation dialogs stay visible.
 return createPortal(popup,document.querySelector(".viewerAppShell")||document.body);
}
