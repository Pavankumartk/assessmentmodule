"use client";
import Link from "next/link";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {getDemoSession} from "@/modules/assessments/auth/demo-auth";
import {assessmentStorage,updateAssessment,getActiveAssessmentId} from "@/modules/assessments/storage/assessment-storage";
import Sidebar from "@/modules/assessments/components/common/sidebar/page";
import Header from "@/modules/assessments/components/common/header/Header";
import LongAnswerPreview from "./Preview";
import {MCQRichEditor} from "@/modules/assessments/components/common/steps/ContentStep/ContentStep";
import Select from "./LongAnswerSelect";
import {blooms,categories,loadLongDraft,newCriterion,newId,newLevel,newLongQuestion,validLongQuestion,type LongQuestion,type RubricCriterion} from "./long-answer-data";
import "./long-answer.css";

const ICONS="/assets/assessmenticons/";
const Asset=({name,size=19}:{name:string;size?:number})=><img src={`${ICONS}${name}`} width={size} height={size} alt="" aria-hidden="true"/>;
const num=(value:unknown,fallback:number)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:fallback;};
const questionReady=(q:LongQuestion)=>validLongQuestion(q).length===0 && (q.gradingMethod!=="Custom" || (!q.criteria.some(c=>!c.levels[0]?.points || !Number.isFinite(Number(c.levels[0].points)) || Number(c.levels[0].points)<0) && Math.abs(q.criteria.reduce((sum,c)=>sum+Number(c.levels[0]?.points||0),0)-Number(q.points))<=0.001));
function Toggle({value,onChange,label}:{value:boolean;onChange:(v:boolean)=>void;label:string}){return <button className={`la-toggle ${value?"is-on":""}`} type="button" role="switch" aria-checked={value} aria-label={label} onClick={()=>onChange(!value)}><span>{value?"ON":"OFF"}</span><i/></button>;}
function Collapse({title,open,onClick,children,sub,icon="editbig.svg"}:{title:string;open:boolean;onClick:()=>void;children:React.ReactNode;sub?:string;icon?:string}){return <section className="la-collapse"><button type="button" className="la-collapse-head" aria-expanded={open} onClick={onClick}><span className="la-collapse-label"><span className="la-icon-round"><Asset name={icon}/></span><strong>{title}</strong></span><span className="la-collapse-end">{sub&&!/^\d+\s*\/\s*\d+/.test(sub)&&<small>{sub}</small>}<span className={`la-collapse-chevron ${open?"is-expanded":""}`}><Asset name="arrow-down-01.svg" size={20}/></span></span></button>{open&&<div className="la-collapse-body">{children}</div>}</section>;}
type RichContextValue = {questionId:string; html:Record<string,string>; save:(id:string,html:string)=>void; onError:(message:string)=>void};
const RichContext=createContext<RichContextValue>({questionId:"",html:{},save:()=>{},onError:()=>{}});
function RichField({value,onChange,placeholder="",maxLength,id}:{value:string;onChange:(v:string)=>void;placeholder?:string;rows?:number;maxLength?:number;id:string}){
 const context=useContext(RichContext);
 return <div className="la-rich mcqcBuilder"><MCQRichEditor extendedToolbar key={context.questionId+":"+id} editorId={id} value={value} html={context.html[id]} maxLength={maxLength} onChange={onChange} onHtmlChange={html=>context.save(id,html)} placeholder={placeholder} onError={context.onError}/></div>;
}
function EditRich({label,value,onChange,placeholder,rows=3,max=250,id,tone}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;rows?:number;max?:number;id:string;tone?:"full"|"partial"|"zero"}){return <div className={`la-field ${tone ? `la-feedback--${tone}` : ""}`}><label htmlFor={id}>{label}</label><RichField id={id} value={value} onChange={onChange} maxLength={max} rows={rows} placeholder={placeholder}/></div>;}
const settingsButtons=[{key:"rubricTotalPoints",label:"Use rubric total as question points"},{key:"rubricLearnerView",label:"Allow learners to preview the rubric"},{key:"rubricCriterionDescription",label:"Show criterion descriptions to learners"},{key:"rubricPointsVisible",label:"Show points per level to learners"},{key:"rubricGraderComments",label:"Allow grader to add comment per criterion"},{key:"rubricCriterionScore",label:"Calculate grade with a minimum score of 0"},{key:"rubricHideUntilGraded",label:"Hide level scores while grading"}] as const;
export default function LongAnswerContent(){
 const router=useRouter();
 const [questions,setQuestions]=useState<LongQuestion[]>([]);
 const [active,setActive]=useState(0);
 const [expected,setExpected]=useState(1);
 const [minutes,setMinutes]=useState("60");
 const [passing,setPassing]=useState("60");
 const [isPreview,setIsPreview]=useState(false);
 const [expanded,setExpanded]=useState<string[]>(["answer","placeholder","model","rubric","criterion-0","feedback","explanation","hint"]);
 const [tag,setTag]=useState("");
 const [addingTag,setAddingTag]=useState(false);
 const [welcomeName,setWelcomeName]=useState("Creator");
 const [error,setError]=useState("");
 const [loaded,setLoaded]=useState(false);
 const [continuing,setContinuing]=useState(false);
 const continueTimer=useRef<number|null>(null);
 useEffect(()=>()=>{if(continueTimer.current)window.clearTimeout(continueTimer.current);},[]);
 const scrollRef=useRef<HTMLDivElement>(null);
 const numberScrollRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!loaded||isPreview)return;
  const container=numberScrollRef.current;
  const selected=container?.querySelector<HTMLButtonElement>('[aria-current="step"]');
  if(!container||!selected)return;
  const area=container.getBoundingClientRect(), item=selected.getBoundingClientRect();
  if(item.left<area.left)container.scrollLeft-=area.left-item.left;
  else if(item.right>area.right)container.scrollLeft+=item.right-area.right;
 },[active,loaded,isPreview,questions.length]);
 useEffect(()=>{
  const user=getDemoSession();
  if(user?.displayName?.trim())setWelcomeName(user.displayName.trim().split(/\s+/)[0]);
  try {
   const details=JSON.parse(assessmentStorage.getItem("longAnswerAssessmentDraft")||"{}") as Record<string,unknown>;
   const count=Math.max(1,Math.min(100,num(details.questionCount??assessmentStorage.getItem("longAnswerQuestionCount"),1)));
   const marks=num(details.totalMarks,count);const each=num(details.marksPerQuestion,marks/count);
   const draft=loadLongDraft(assessmentStorage.getItem("longAnswerContentDraft"));
   setExpected(count);setMinutes(String(details.duration||details.timeLimit||"—"));setPassing(String(details.passingScore||details.passingMarks||"—"));
   setQuestions(Array.from({length:count},(_,i)=>draft.questions[i]??newLongQuestion()));
   setActive(Math.max(0,Math.min(draft.active??0,count-1)));
  }catch{setQuestions([newLongQuestion()]);}
  setLoaded(true);
  // The form is a nested scroller; a previous Results/Preview position must not carry over.
  requestAnimationFrame(()=>{if(scrollRef.current)scrollRef.current.scrollTop=0;});
 },[]);
 // Always show the Content/Preview page from its heading when entering this route.
 // This affects only the Long Answer scroll pane, not other assessment pages.
 useEffect(()=>{
  if(!loaded)return;
  const pane=scrollRef.current;
  if(pane)pane.scrollTop=0;
 },[loaded,isPreview]);
 const item=questions[active]??newLongQuestion();
 const setQ=useCallback((changes:Partial<LongQuestion>)=>setQuestions(prev=>prev.map((q,i)=>i===active?{...q,...changes}:q)),[active]);
 const isOpen=(name:string)=>expanded.includes(name);
 const toggle=(name:string)=>setExpanded(old=>old.includes(name)?old.filter(v=>v!==name):[...old,name]);
 const updateCriterion=(index:number,changes:Partial<RubricCriterion>)=>setQ({criteria:item.criteria.map((c,i)=>i===index?{...c,...changes}:c),scoreOverrides:{}});
 const save=(enforce=true)=>{
  const count=questions.length;
  if(enforce){
   const problematic=questions.findIndex(q=>!questionReady(q));
   if(problematic>=0){setActive(problematic);setIsPreview(false);setError(`Question ${problematic+1}: ${validLongQuestion(questions[problematic])[0] || "Criterion marks must be valid and total the question points."}`);return false;}
  }
  try{
   assessmentStorage.setItem("longAnswerContentDraft",JSON.stringify({questions,active}));
   const total=questions.reduce((n,q)=>n+(Number(q.points)||0),0);
   if(enforce) updateAssessment({questions:count,marks:total});
   setError("");return true;
  }catch{setError("Unable to save questions to browser storage.");return false;}
 };
 // Draft persistence follows the same per-assessment localStorage used by the existing five Creator steps.
 useEffect(()=>{if(!loaded||!questions.length)return;try{assessmentStorage.setItem("longAnswerContentDraft",JSON.stringify({questions,active}));}catch{/* Storage errors appear when saving */}},[questions,active,loaded]);
 const preview=()=>{if(save(false)){setIsPreview(true);scrollRef.current?.scrollTo({top:0});}};
 const proceed=()=>{if(continuing||!save())return;setContinuing(true);continueTimer.current=window.setTimeout(()=>{setContinuing(false);router.push("/assessments/create/evaluation");},3000);};
 const answerText=(field:keyof LongQuestion,value:string)=>setQ({[field]:value} as Partial<LongQuestion>);
 const questionNavigation=(next:number)=>{setActive(Math.max(0,Math.min(questions.length-1,next)));setError("");};
 const updateQuestionList=(next:LongQuestion[], nextActive:number)=>{
  const oldDetails=assessmentStorage.getItem("longAnswerAssessmentDraft"),oldCount=assessmentStorage.getItem("longAnswerQuestionCount"),oldContent=assessmentStorage.getItem("longAnswerContentDraft");
  try{
   const details=JSON.parse(oldDetails||"{}");
   const fixed=details.markingScheme!=="Weighted questions"&&details.markingScheme!=="Custom marking";
   const each=Number(details.marksPerQuestion)||1;
   const total=Number((fixed ? next.length*each : next.reduce((sum,q)=>sum+(Number(q.points)||0),0)).toFixed(6));
   if(total<=0)throw new Error("The remaining marks must be greater than zero.");
   assessmentStorage.setItem("longAnswerAssessmentDraft",JSON.stringify({...details,questionCount:String(next.length),totalMarks:String(total)}));
   assessmentStorage.setItem("longAnswerQuestionCount",String(next.length));
   assessmentStorage.setItem("longAnswerContentDraft",JSON.stringify({questions:next,active:nextActive}));
   updateAssessment({questions:next.length,marks:total});
   setQuestions(next);setExpected(next.length);setActive(nextActive);setError("");
  }catch{
   for(const [key,value] of [["longAnswerAssessmentDraft",oldDetails],["longAnswerQuestionCount",oldCount],["longAnswerContentDraft",oldContent]] as const){try{if(value===null)assessmentStorage.removeItem(key);else assessmentStorage.setItem(key,value);}catch{}}
   setError("Unable to update the question count and marks. Check the question marks and try again.");
  }
 };
 const addQuestion=()=>{try{const details=JSON.parse(assessmentStorage.getItem("longAnswerAssessmentDraft")||"{}");updateQuestionList([...questions,newLongQuestion()],questions.length);}catch{setError("Unable to add a question.");}};
 const removeQuestion=()=>{if(questions.length<=1||!window.confirm(`Remove question ${active+1}? The question count and total marks will decrease.`))return;const next=questions.filter((_,i)=>i!==active);updateQuestionList(next,Math.min(active,next.length-1));};
 if(!loaded)return null;
 return <main className="la-app"><div className="la-layout"><Sidebar/><section className="la-main"><Header/><div className="la-scroll" ref={scrollRef}><div className="la-page">
  {isPreview?<LongAnswerPreview questions={questions} onBack={()=>{setIsPreview(false);scrollRef.current?.scrollTo({top:0});}} onEdit={index=>{setActive(index);setIsPreview(false);scrollRef.current?.scrollTo({top:0});}} onSaveAndContinue={proceed} saving={continuing}/>:
  <><nav className="la-breadcrumb"><Link href="/assessments">Assessment</Link><Asset name="arrowrightdouble.svg" size={20}/><Link href="/assessments/create/details">Create Assessment</Link><Asset name="arrowrightdouble.svg" size={20}/><strong>Create Questions</strong></nav>
  <div className="la-welcome"><strong>✧ Let's Get Started! {welcomeName}?</strong><span>Let's Build A Great Question.</span></div>
  <div className="la-body"><div className="la-builder">
   <div className="la-question-heading"><strong>Question {active+1} of {expected}</strong><button type="button" className="la-remove-question" aria-label={`Remove question ${active+1}`} title={questions.length<=1 ? "At least one question is required" : "Remove this question"} disabled={questions.length<=1} onClick={removeQuestion}>Remove Question</button></div>
   <div className="mcqcBuilder la-mcq-navigation"><nav className={`mcqcNumberNavigation ${questions.length<=7 ? "mcqcFewQuestions" : "mcqcManyQuestions"}`} aria-label="Select a long answer question">
    <button type="button" className="mcqcRoundNav" aria-label="Previous question" disabled={active===0} onClick={()=>questionNavigation(active-1)}><Asset name="arrowleft.svg" size={20}/></button>
    <div className="mcqcNumberScroller"><div ref={numberScrollRef} className="mcqcQuestionNumbers" aria-label="Question numbers">{questions.map((q,index)=>{const done=questionReady(q);const status=done?"is-complete":index===active?"is-active":"is-empty";return <button type="button" key={q.id} className={`mcqcQuestionNumber ${status}`} aria-label={`Question ${index+1}, ${done ? "complete" : "incomplete"}`} aria-current={index===active?"step":undefined} onClick={()=>questionNavigation(index)}><span className="mcqcNumberValue">{index+1}</span><span className={`mcqcNumberStatus ${done ? "is-done" : "is-pending"}`} aria-hidden="true">{done?"✓":""}</span><small>LA</small></button>;})}</div></div>
    <button type="button" className="mcqcRoundNav" aria-label="Next question" disabled={active>=questions.length-1} onClick={()=>questionNavigation(active+1)}><Asset name="arrowright.svg" size={20}/></button>
   </nav><div className="mcqcQuestionProgress" role="progressbar" aria-label="Questions completed" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={questions.filter(questionReady).length}><span style={{width:`${questions.length ? Math.max(4,questions.filter(questionReady).length/questions.length*100) : 0}%`}}/></div></div>
   <RichContext.Provider value={{questionId:item.id,html:item.editorHtml||{},save:(id,html)=>setQ({editorHtml:{...(item.editorHtml||{}),[id]:html}}),onError:setError}}><section className="la-question-area"><div className="la-field"><label>Question Type</label><div className="la-inset la-type">Long Answer</div></div>
    <EditRich id="la-question" label="Write Your Question" value={item.text} onChange={v=>answerText("text",v)} placeholder="Write your question here..." max={250}/>
    <div className="la-field la-answer-settings-label"><label>Answer Settings</label></div>
    <Collapse title="Answer Box, Model Answer, Rubrics, Feedback and Hint" open={isOpen("answer")} onClick={()=>toggle("answer")}>
     <Collapse title="Answer Box Placeholder" open={isOpen("placeholder")} onClick={()=>toggle("placeholder") } sub={[item.responseFormat,item.inputBoxLines ? `${item.inputBoxLines} lines` : ""].filter(Boolean).join(" · ")}>
       <RichField id="la-answer-placeholder" value={item.answerPlaceholder} onChange={v=>setQ({answerPlaceholder:v})} placeholder="Enter the placeholder shown to learners..." rows={2}/>
       <div className="la-fieldgrid"><div className="la-field"><label>Response Format</label><Select placeholder="Select response format" value={item.responseFormat} options={["Plain Text","Rich Text"]} onChange={v=>setQ({responseFormat:v as LongQuestion["responseFormat"]})}/></div><div className="la-field"><label>Input box size (lines)</label><Select placeholder="Select input box size" value={item.inputBoxLines} options={["3","5","8","10","15","20"]} onChange={v=>setQ({inputBoxLines:v})}/></div><div className="la-field"><label>Minimum Words</label><input className="la-input" type="number" min="0" placeholder="Enter minimum words" value={item.minWords} onChange={e=>answerText("minWords",e.target.value)}/></div><div className="la-field"><label>Maximum Words</label><input className="la-input" type="number" min="1" placeholder="Enter maximum words" value={item.maxWords} onChange={e=>answerText("maxWords",e.target.value)}/></div><div className="la-field"><label>Maximum Characters</label><input className="la-input" type="number" min="1" placeholder="Enter maximum characters" value={item.maxCharacters} onChange={e=>answerText("maxCharacters",e.target.value)}/></div></div>
       <div className="la-switchrow">Response Required<Toggle label="Response required" value={item.responseRequired} onChange={v=>setQ({responseRequired:v})}/></div>
     </Collapse>
     <Collapse title="Model Answer and Grader Information" open={isOpen("model")} onClick={()=>toggle("model")} sub="Not shown to learners"><EditRich id="la-model" label="Model Answer" value={item.modelAnswer} onChange={v=>answerText("modelAnswer",v)} placeholder="Enter the model answer..." max={5000} rows={3}/><EditRich id="la-grader" label="Information for Graders" value={item.graderInfo} onChange={v=>answerText("graderInfo",v)} placeholder="Enter information for graders..." max={5000} rows={3}/></Collapse>
     <Collapse title="Grading Method and Rubrics" icon="target.svg" sub="Not shown to learners" open={isOpen("rubric")} onClick={()=>toggle("rubric")}>
       <div className="la-fieldgrid"><div className="la-field"><label>Grading Method</label><Select placeholder="Select grading method" value={item.gradingMethod ?? ""} options={["Equal Marks","Custom"]} onChange={v=>setQ({gradingMethod:v as "Equal Marks"|"Custom",scoreOverrides:{}})}/></div><div className="la-field"><label>Points (total for Question)</label><input className="la-input" type="number" min="0" step="0.5" placeholder="Enter question points" value={item.points} onChange={e=>setQ({points:e.target.value,scoreOverrides:{}})}/></div><div className="la-field"><label>Negative Marking</label><Select placeholder="Select negative marking" value={item.negativeMarking ?? ""} options={["NA","0","0.25","0.5","1"]} onChange={v=>setQ({negativeMarking:v,scoreOverrides:{}})}/></div></div>
       <div className="la-criteria">{item.criteria.map((criterion,i)=><section key={criterion.id} className="la-criterion">
        <div className="la-field"><label htmlFor={`la-criterion-${criterion.id}`}>Criterion {i+1}</label><input id={`la-criterion-${criterion.id}`} className="la-input" value={criterion.title} onChange={e=>updateCriterion(i,{title:e.target.value})} placeholder="Enter criterion"/></div>
        <EditRich id={`la-criterion-description-${criterion.id}`} label="Description" value={criterion.description} onChange={description=>updateCriterion(i,{description})} placeholder="Enter criterion description..." max={250}/>
        <div className="la-levelgrid">{criterion.levels.map((level,j)=><article className="la-level" key={level.id}>
         <div className="la-level-heading"><strong>Level {j+1}</strong><button type="button" aria-label={`Remove level ${j+1} from criterion ${i+1}`} disabled={criterion.levels.length<=1} onClick={()=>{if(criterion.levels.length>1&&window.confirm(`Remove level ${j+1}?`))updateCriterion(i,{levels:criterion.levels.filter(l=>l.id!==level.id)});}}><Asset name="cancel-circle.svg" size={18}/></button></div>
         <div className="la-field"><label>Title</label><Select ariaLabel={`Criterion ${i+1} level ${j+1} title`} placeholder="Select title" value={level.title} options={["Excellent","Good","Fair","Poor"]} onChange={title=>updateCriterion(i,{levels:criterion.levels.map(l=>l.id===level.id?{...l,title}:l)})}/></div>
         <div className="la-field"><label htmlFor={`la-level-points-${level.id}`}>Points</label><input id={`la-level-points-${level.id}`} className="la-input" type="number" min="0" step="0.5" placeholder="Enter points" value={level.points} onChange={e=>updateCriterion(i,{levels:criterion.levels.map(l=>l.id===level.id?{...l,points:e.target.value}:l)})}/></div>
         <div className="la-field"><label htmlFor={`la-level-description-${level.id}`}>Description</label><textarea id={`la-level-description-${level.id}`} className="la-input" maxLength={250} placeholder="Enter description" value={level.description} onChange={e=>updateCriterion(i,{levels:criterion.levels.map(l=>l.id===level.id?{...l,description:e.target.value}:l)})}/></div>
        </article>)}</div>
        <div className="la-criterion-buttons"><button type="button" onClick={()=>updateCriterion(i,{levels:[...criterion.levels,newLevel(criterion.levels.length)]})}><Asset name="plus.svg" size={16}/> Add Level</button><button type="button" disabled={item.criteria.length<=1} onClick={()=>{if(item.criteria.length>1&&window.confirm(`Remove criterion ${i+1}?`))setQ({criteria:item.criteria.filter(c=>c.id!==criterion.id),scoreOverrides:{}});}}>Remove Criterion</button></div>
       </section>)}<button className="la-add-criterion" type="button" onClick={()=>setQ({criteria:[...item.criteria,newCriterion()],scoreOverrides:{}})}><Asset name="plus.svg" size={18}/> Add Criterion</button></div>
       <div className="la-switchrow">Partial Credit<Toggle label="Partial Credit" value={item.partialCredit ?? true} onChange={v=>setQ({partialCredit:v,scoreOverrides:{}})}/></div>
       <div className="la-rubric-total">Total criterion marks <strong>{(item.gradingMethod ?? "Equal Marks")==="Equal Marks"?Number(item.points||0).toFixed(2):item.criteria.reduce((sum,c)=>sum+(Number(c.levels[0]?.points)||0),0).toFixed(2)} / {item.points || "0"}</strong></div>
       <details className="la-score-simulator"><summary>Score Simulator - Outcome per Criteria</summary>       <div className="la-field"><label>Score Simulator - Outcome per Criteria</label>{Array.from({length:item.criteria.length+1},(_,i)=>item.criteria.length-i).map(correct=>{const points=Number(item.points)||0;const penalty=Number(item.negativeMarking)||0;const customMarks=item.criteria.slice(0,correct).reduce((sum,c)=>sum+(Number(c.levels[0]?.points)||0),0);const base=(item.partialCredit??true)?(item.gradingMethod==="Custom"?customMarks:points*correct/Math.max(item.criteria.length,1)):(correct===item.criteria.length?points:0);const calculated=base-penalty*(item.criteria.length-correct);const result=(item.minimumZero??true)?Math.max(0,calculated):calculated;return <label key={correct}>{correct} correct, {item.criteria.length-correct} wrong<input className="la-input" type="number" step="0.5" placeholder="Enter score" value={item.scoreOverrides?.[String(correct)]??""} onChange={e=>setQ({scoreOverrides:{...item.scoreOverrides,[String(correct)]:e.target.value}})}/></label>;})}</div></details>
       <div className="la-rubric-options"><h3>Rubric Options</h3>{settingsButtons.map(setting=><div className="la-switchrow" key={setting.key}><span>{setting.label}</span><Toggle label={setting.label} value={item[setting.key]} onChange={value=>setQ(setting.key==="rubricCriterionScore" ? {rubricCriterionScore:value,minimumZero:value,scoreOverrides:{}} : {[setting.key]:value})}/></div>)}</div>
     </Collapse>
     <Collapse title="Feedback" icon="message-02.svg" open={isOpen("feedback")} onClick={()=>toggle("feedback") } sub="Full, Partial and Zero Marks"><EditRich id="la-feedback-full" tone="full" label="Full Marks" value={item.feedbackFull} onChange={v=>answerText("feedbackFull",v)} placeholder="Enter full marks feedback..." max={2000}/><EditRich id="la-feedback-partial" tone="partial" label="Partial Marks" value={item.feedbackPartial} onChange={v=>answerText("feedbackPartial",v)} placeholder="Enter partial marks feedback..." max={2000}/><EditRich id="la-feedback-zero" tone="zero" label="Zero Marks" value={item.feedbackZero} onChange={v=>answerText("feedbackZero",v)} placeholder="Enter zero marks feedback..." max={2000}/></Collapse>
     <Collapse title="Explanation" icon="assignments.svg" open={isOpen("explanation")} onClick={()=>toggle("explanation")} sub={`${item.explanation.length}/250`}><RichField id="la-explanation" value={item.explanation} onChange={v=>answerText("explanation",v)} placeholder="Enter an explanation..." maxLength={250}/></Collapse>
     <Collapse title="Hint" icon="idea.svg" open={isOpen("hint")} onClick={()=>toggle("hint")} sub={`${item.hint.length}/250`}><RichField id="la-hint" value={item.hint} onChange={v=>answerText("hint",v)} placeholder="Enter a hint..." maxLength={250}/><label className="la-checkbox"><input type="checkbox" checked={item.hintBefore} onChange={e=>setQ({hintBefore:e.target.checked})}/>Show hint before answering</label><label className="la-checkbox"><input type="checkbox" checked={item.hintOnRequest} onChange={e=>setQ({hintOnRequest:e.target.checked})}/>Allow learner to request hint</label></Collapse>
    </Collapse>
   </section></RichContext.Provider>
  </div>
  <aside className="la-aside"><section className="la-aside-section"><h2>Question Settings</h2><div className="la-field"><label htmlFor="la-points">Points</label><input id="la-points" className="la-input" placeholder="Enter points" type="number" min="0.5" step="0.5" value={item.points} onChange={e=>answerText("points",e.target.value)}/></div><div className="la-field"><label>Difficulty</label><Select placeholder="Select difficulty" value={item.difficulty} options={["Easy","Medium","Hard"]} onChange={v=>setQ({difficulty:v})}/></div><div className="la-field"><label>Category</label><Select placeholder="Select category" value={item.category} options={categories} onChange={v=>setQ({category:v})}/></div><div className="la-field"><label>Bloom’s Taxonomy</label><Select placeholder="Select Bloom’s level" value={item.bloom} options={blooms} onChange={v=>setQ({bloom:v})}/></div><div className="la-field"><label>Tag</label><div className="la-tags"><button className="la-add-tag" type="button" onClick={()=>{if(!addingTag){setAddingTag(true);return;}if(tag.trim()&&!item.tags.includes(tag.trim()))setQ({tags:[...item.tags,tag.trim()]});if(tag.trim()){setTag("");setAddingTag(false);}}}><Asset name="plus.svg" size={16}/> {addingTag ? "Add" : "Add Tag"}</button>{addingTag&&<input autoFocus className="la-input" aria-label="New tag" value={tag} onChange={e=>setTag(e.target.value)} placeholder="Enter a tag" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(tag.trim()&&!item.tags.includes(tag.trim()))setQ({tags:[...item.tags,tag.trim()]});if(tag.trim()){setTag("");setAddingTag(false);}}}}/>}</div>{item.tags.map(value=><button key={value} type="button" className="la-tag" onClick={()=>setQ({tags:item.tags.filter(t=>t!==value)})}>{value} ×</button>)}</div><div className="la-switchrow">Mandatory<Toggle label="Mandatory" value={item.mandatory} onChange={v=>setQ({mandatory:v})}/></div><small>This Question is Mandatory</small></section></aside>
  </div>
  {error&&<p role="alert" className="la-error">{error}</p>}
  <div className="la-page-footer"><button type="button" className="la-footer-back" onClick={()=>router.push("/assessments/create/details")}>Back</button><button type="button" className="la-footer-preview" onClick={preview}>Preview Questions</button><div className="la-footer-right">{continuing&&<span className="la-save-notice" role="status">Successfully saved</span>}<button type="button" className="la-green" disabled={continuing} onClick={proceed}>Save &amp; Continue</button></div></div></>}
 </div></div></section></div></main>;
}
