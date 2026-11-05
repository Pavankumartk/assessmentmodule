"use client";
import {Suspense,useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import PortalShell from "@/modules/assessments/components/common/PortalShell";
import {getAssessment,getActiveAssessmentId,type StoredAssessment} from "@/modules/assessments/storage/assessment-storage";
import {getDemoSession} from "@/modules/assessments/auth/demo-auth";
function AssessmentDetailsReadOnlyContent(){
 const {assessmentId}=useParams<{assessmentId:string}>();const router=useRouter();
 const [record,setRecord]=useState<StoredAssessment|null>(null);
 useEffect(()=>{const session=getDemoSession(),assessment=getAssessment(assessmentId);
 if(!session || session.role!=="admin" || !assessment || (assessment.tenantId||"north")!==session.tenantId){router.replace("/assessments");return;}setRecord(assessment);},[assessmentId,router]);
 return <PortalShell><div className="portalScreen"><div className="portalPageHeading"><h1>Assessment Details</h1><p>Read-only assessment information</p></div>{record && <div style={{background:"#DFE6E9",boxShadow:"-4px -4px 8px #fff,4px 4px 8px #C4C4C4",borderRadius:8,padding:24,display:"grid",gap:16,maxWidth:760}}>{([ ["Name",record.title], ["Type",record.typeLabel], ["Course",record.course||"Not selected"], ["Questions",String(record.questions)], ["Total Marks",String(record.marks)], ["Status",record.status], ["Created",new Date(record.createdAt).toLocaleString()] ] as const).map(([name,value])=><div key={name} style={{display:"flex",justifyContent:"space-between",gap:24}}><strong>{name}</strong><span>{value}</span></div>)}</div>}<button type="button" onClick={()=>router.push("/assessments")} style={{marginTop:20,padding:"10px 24px",border:0,borderRadius:8,background:"#DFE6E9",boxShadow:"-2px -2px 4px #fff,2px 2px 4px #C4C4C4",cursor:"pointer"}}>Back to Assessments</button></div></PortalShell>;
}

export default function AssessmentDetailsReadOnly(){
 return <Suspense fallback={null}><AssessmentDetailsReadOnlyContent /></Suspense>;
}
