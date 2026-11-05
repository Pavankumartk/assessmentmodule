"use client";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./formulasheet.css";

type Subject = "Mathematics" | "Statistics" | "Machine Learning" | "Computer Science";
type Formula = { id: number; subject: Subject; topic: string; name: string; expression: string; description: string };
type Pad = { id: string; question: number; title: string; mode: "draw" | "notes"; notes: string; image: string; updated: string };
const ICONS = "/assets/viewericons/";
const SUBJECTS = ["All subjects", "Mathematics", "Statistics", "Machine Learning", "Computer Science"];
const FORMULAS: Formula[] = [
  {id:1,subject:"Mathematics",topic:"Algebra",name:"Quadratic formula",expression:"x = (−b ± √(b² − 4ac)) / 2a",description:"Roots of ax² + bx + c = 0"},
  {id:2,subject:"Mathematics",topic:"Algebra",name:"Difference of squares",expression:"a² − b² = (a + b)(a − b)",description:"Factorising"},
  {id:3,subject:"Mathematics",topic:"Algebra",name:"Logarithm product rule",expression:"log(xy) = log x + log y",description:"Also log(x/y) = log x − log y"},
  {id:4,subject:"Mathematics",topic:"Calculus",name:"Power rule",expression:"d/dx (xⁿ) = nxⁿ⁻¹",description:"Derivative of a power"},
  {id:5,subject:"Mathematics",topic:"Calculus",name:"Chain rule",expression:"dy/dx = (dy/du)·(du/dx)",description:"Composite functions"},
  {id:6,subject:"Mathematics",topic:"Calculus",name:"Integration by parts",expression:"∫u dv = uv − ∫v du",description:"Product of functions"},
  {id:7,subject:"Mathematics",topic:"Linear Algebra",name:"Dot product",expression:"a·b = Σ aᵢbᵢ = |a||b|cos θ",description:"Similarity of vectors"},
  {id:8,subject:"Mathematics",topic:"Linear Algebra",name:"Matrix multiplication",expression:"(AB)ᵢⱼ = Σₖ Aᵢₖ Bₖⱼ",description:"Columns of A must equal rows of B"},
  {id:9,subject:"Mathematics",topic:"Linear Algebra",name:"Eigenvalue equation",expression:"Av = λv",description:"v is an eigenvector of A"},
  {id:10,subject:"Statistics",topic:"Descriptive",name:"Mean",expression:"μ = Σx / n",description:"Average of n values"},
  {id:11,subject:"Statistics",topic:"Descriptive",name:"Variance",expression:"σ² = Σ(x − μ)² / n",description:"Spread around the mean"},
  {id:12,subject:"Statistics",topic:"Descriptive",name:"Standard deviation",expression:"σ = √σ²",description:"Same unit as the data"},
  {id:13,subject:"Statistics",topic:"Probability",name:"Bayes’ theorem",expression:"P(A|B) = P(B|A)·P(A) / P(B)",description:"Updating a belief with evidence"},
  {id:14,subject:"Statistics",topic:"Probability",name:"Conditional probability",expression:"P(A|B) = P(A∩B) / P(B)",description:"Given that B has occurred"},
  {id:15,subject:"Statistics",topic:"Probability",name:"Expected value",expression:"E[X] = Σ x·P(x)",description:"Long-run average"},
  {id:16,subject:"Machine Learning",topic:"Regression",name:"Linear model",expression:"ŷ = wx + b",description:"Weight w and bias b"},
  {id:17,subject:"Machine Learning",topic:"Regression",name:"Mean squared error",expression:"MSE = (1/n) Σ(yᵢ − ŷᵢ)²",description:"Regression loss"},
  {id:18,subject:"Machine Learning",topic:"Regression",name:"Gradient descent",expression:"θ := θ − α·∇J(θ)",description:"α is the learning rate"},
  {id:19,subject:"Machine Learning",topic:"Classification",name:"Sigmoid",expression:"σ(z) = 1 / (1 + e⁻ᶻ)",description:"Maps any value to 0–1"},
  {id:20,subject:"Machine Learning",topic:"Classification",name:"Accuracy",expression:"(TP + TN) / (TP + TN + FP + FN)",description:"Share of correct predictions"},
  {id:21,subject:"Machine Learning",topic:"Classification",name:"Precision",expression:"TP / (TP + FP)",description:"Correct among predicted positives"},
  {id:22,subject:"Machine Learning",topic:"Classification",name:"Recall",expression:"TP / (TP + FN)",description:"Found among actual positives"},
  {id:23,subject:"Machine Learning",topic:"Classification",name:"F1 score",expression:"F1 = 2·P·R / (P + R)",description:"Balance of precision and recall"},
  {id:24,subject:"Machine Learning",topic:"Classification",name:"Entropy",expression:"H = −Σ p·log₂ p",description:"Impurity in decision trees"},
  {id:25,subject:"Computer Science",topic:"Data Structures",name:"Stack (LIFO)",expression:"push, pop, peek → O(1)",description:"Last in, first out"},
  {id:26,subject:"Computer Science",topic:"Data Structures",name:"Queue (FIFO)",expression:"enqueue, dequeue → O(1)",description:"First in, first out"},
  {id:27,subject:"Computer Science",topic:"Data Structures",name:"Binary search",expression:"O(log n)",description:"Needs sorted data"},
  {id:28,subject:"Computer Science",topic:"Algorithms",name:"Bubble sort",expression:"O(n²)",description:"Simple, slow on large data"},
  {id:29,subject:"Computer Science",topic:"Algorithms",name:"Merge sort",expression:"O(n log n)",description:"Divide and conquer"},
  {id:30,subject:"Computer Science",topic:"Algorithms",name:"BFS / DFS",expression:"O(V + E)",description:"Graph traversal"},
];

function NeumoDropdown({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape);};},[open]);
  return <div className="formulaSelect" ref={root}><label>{label}</label><button type="button" className="formulaSelectTrigger" aria-expanded={open} aria-label={label} onClick={()=>setOpen(v=>!v)}><span>{value}</span><img src={`${ICONS}arrow-down.svg`} alt="" width={24} height={24}/></button>{open&&<div className="formulaSelectMenu" role="listbox" aria-label={label}>{options.map(option=><button key={option} type="button" role="option" aria-selected={value===option} className={value===option?"selected":""} onClick={()=>{onChange(option);setOpen(false);}}>{option}</button>)}</div>}</div>;
}
export default function FormulaPage(){
  const router=useRouter();
  const [subject,setSubject]=useState("All subjects");const [topic,setTopic]=useState("All topics");const [search,setSearch]=useState("");const [starOnly,setStarOnly]=useState(false);
  const [stars,setStars]=useState<number[]>([]);const [saved,setSaved]=useState<Pad[]>([]);const [savedFilter,setSavedFilter]=useState("With typed notes");const [question,setQuestion]=useState(2);const [totalQuestions,setTotalQuestions]=useState(20);const [copied,setCopied]=useState<number|null>(null);
  useEffect(()=>{try{const a=JSON.parse(assessmentStorage.getItem("viewerFormulaStars")||"[]");if(Array.isArray(a))setStars(a.filter((n):n is number=>typeof n==="number"));const pads=JSON.parse(assessmentStorage.getItem("viewerScratchPads")||"[]");if(Array.isArray(pads))setSaved(pads);const content=JSON.parse(assessmentStorage.getItem("oneWordContentDraft")||assessmentStorage.getItem("oneWordPreviewDraft")||assessmentStorage.getItem("mcqContentDraft")||"{}");const draft=JSON.parse(assessmentStorage.getItem("oneWordAssessmentDraft")||assessmentStorage.getItem("mcqAssessmentDraft")||"{}");const count=Array.isArray(content.questions)&&content.questions.length?content.questions.length:Number(draft.questionCount)||20;setTotalQuestions(count);const previous = assessmentStorage.getItem("viewerScratchReturnState");const previousState = previous ? JSON.parse(previous) as {current?:number} : null;const index = Number(assessmentStorage.getItem("viewerCurrentQuestion") ?? (typeof previousState?.current === "number" ? previousState.current : 0));setQuestion(Math.max(1,(Number.isFinite(index)?index:0)+1));}catch{}},[]);
  const topics=useMemo(()=>["All topics",...new Set(FORMULAS.filter(f=>subject==="All subjects"||f.subject===subject).map(f=>f.topic))],[subject]);
  const visible=useMemo(()=>FORMULAS.filter(f=>(subject==="All subjects"||f.subject===subject)&&(topic==="All topics"||f.topic===topic)&&(!starOnly||stars.includes(f.id))&&`${f.name} ${f.topic} ${f.expression} ${f.description} ${f.subject}`.toLowerCase().includes(search.trim().toLowerCase())),[subject,topic,search,starOnly,stars]);
  const toggleStar=(id:number)=>setStars(old=>{const next=old.includes(id)?old.filter(n=>n!==id):[...old,id];try{assessmentStorage.setItem("viewerFormulaStars",JSON.stringify(next));}catch{}return next;});
  const copyFormula=async(f:Formula)=>{try{await navigator.clipboard.writeText(f.expression);setCopied(f.id);}catch{const area=document.createElement("textarea");area.value=f.expression;document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();setCopied(f.id);}window.setTimeout(()=>setCopied(id=>id===f.id?null:id),1500);};
  const filteredPads=saved.filter(p=>savedFilter==="All saved pads"||(savedFilter==="With drawing"?p.mode==="draw":p.mode==="notes"));
  const openTool=(path:"/scratch"|"/calculator", padQuestion?:number)=>{
    try { assessmentStorage.setItem("viewerCurrentQuestion",String(Math.max(0,(padQuestion ?? question)-1))); } catch {}
    router.push(`${viewerPath()}${path}`);
  };
  return <main className="formulaApp"><div className="formulaLayout"><section className="formulaWorkspace"><header className="formulaTop"><div><h1>Formula Sheet</h1><p>Quick reference for this assessment. Choose a subject and topic, search, or star formulas to keep them handy.</p></div><span>{visible.length} formulas</span></header><div className="formulaFilters"><NeumoDropdown label="Subject" value={subject} options={SUBJECTS} onChange={v=>{setSubject(v);setTopic("All topics");}}/><NeumoDropdown label="Topic" value={topic} options={topics} onChange={setTopic}/><label className="formulaSearch"><span>Search</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search formulas, e.g. Bayes"/></label><button type="button" className={`formulaStarFilter ${starOnly?"active":""}`} onClick={()=>setStarOnly(v=>!v)}><span className="formulaStarSymbol" aria-hidden="true">{starOnly ? "★" : "☆"}</span> Starred only</button></div><div className="formulaCards">{visible.map(f=><article className="formulaCard" key={f.id}><div className="formulaCardTop"><span className="formulaTopic">{f.topic}</span><button type="button" className={`formulaStar ${stars.includes(f.id)?"isStarred":""}`} onClick={()=>toggleStar(f.id)} aria-label={`${stars.includes(f.id)?"Unstar":"Star"} ${f.name}`} aria-pressed={stars.includes(f.id)}><span className="formulaStarSymbol" aria-hidden="true">{stars.includes(f.id) ? "★" : "☆"}</span></button></div><h2>{f.name}</h2><div className="formulaExpression">{f.expression}</div><p>{f.description} · {f.subject}</p><button type="button" className="formulaCopy" onClick={()=>void copyFormula(f)}>{copied===f.id?"Copied!":"Copy"}</button></article>)}</div>{visible.length===0&&<p className="formulaNoResults">No formulas match your filters.</p>}<footer className="formulaFooter"><button type="button" onClick={()=>{try{assessmentStorage.setItem("viewerCurrentQuestion",String(question-1));}catch{}router.push(viewerPath());}}><img src={`${ICONS}arrowleft.svg`} alt="" width={18} height={18}/>Back to Question</button><span>Copy a formula and paste it into your Scratch Pad notes.</span></footer></section><aside className="formulaAside"><h2>My Scratch Pads</h2><p>{saved.length} of {totalQuestions} questions saved</p><NeumoDropdown label="Show" value={savedFilter} options={["All saved pads","With drawing","With typed notes"]} onChange={setSavedFilter}/><div className="formulaSaved">{filteredPads.length?filteredPads.map(p=><button type="button" key={p.id} onClick={()=>openTool("/scratch",p.question)}><strong>Question {p.question}</strong><span>{p.updated}</span></button>):<p>No saved scratch pads yet.<br/>Draw or type, then select Save<br/>to see it here.</p>}</div><h2 className="formulaToolsHeading">Tools</h2><div className="formulaTools"><button type="button" onClick={()=>openTool("/scratch")}>Scratch Pad<img src={`${ICONS}arrowupright.svg`} alt="" width={18} height={18}/></button><button type="button" onClick={()=>openTool("/calculator")}>Calculator<img src={`${ICONS}arrowup.svg`} alt="" width={18} height={18}/></button><button type="button" onClick={()=>{setSubject("All subjects");setTopic("All topics");setSearch("");setStarOnly(false);}}>Formula Sheet<img src={`${ICONS}arrowupg.svg`} alt="" width={18} height={18}/></button></div></aside></div></main>;
}
