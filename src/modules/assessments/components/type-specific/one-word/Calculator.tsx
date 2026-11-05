"use client";
import { assessmentStorage, updateAssessment, publishAssessment, viewerPath, resultPath } from "@/modules/assessments/storage/assessment-storage";



import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import "./calculator.css";



type Mode = "standard" | "scientific" | "converter";

type Category = "Length" | "Mass" | "Temperature" | "Area" | "Volume" | "Speed" | "Time" | "Data";

type SavedPad = { id: string; question: number; mode: "draw" | "notes"; updated?: string };

const ASSETS = "/assets/viewericons/";

const CATEGORIES: Category[] = ["Length", "Mass", "Temperature", "Area", "Volume", "Speed", "Time", "Data"];

const UNITS: Record<Category, { name: string; factor: number }[]> = {

  Length: [{name:"km",factor:1000},{name:"mi",factor:1609.344},{name:"m",factor:1},{name:"cm",factor:.01},{name:"mm",factor:.001},{name:"ft",factor:.3048},{name:"in",factor:.0254},{name:"yd",factor:.9144}],

  Mass: [{name:"kg",factor:1},{name:"g",factor:.001},{name:"mg",factor:.000001},{name:"lb",factor:.45359237},{name:"oz",factor:.028349523125},{name:"t",factor:1000}],

  Temperature: [{name:"°C",factor:1},{name:"°F",factor:1},{name:"K",factor:1}],

  Area: [{name:"m²",factor:1},{name:"km²",factor:1e6},{name:"ft²",factor:.09290304},{name:"mi²",factor:2589988.110336},{name:"acre",factor:4046.8564224},{name:"ha",factor:10000}],

  Volume: [{name:"L",factor:1},{name:"mL",factor:.001},{name:"m³",factor:1000},{name:"US gal",factor:3.785411784},{name:"US fl oz",factor:.0295735295625}],

  Speed: [{name:"km/h",factor:1/3.6},{name:"m/s",factor:1},{name:"mph",factor:.44704},{name:"kn",factor:.5144444444}],

  Time: [{name:"s",factor:1},{name:"min",factor:60},{name:"h",factor:3600},{name:"day",factor:86400},{name:"week",factor:604800}],

  Data: [{name:"B",factor:1},{name:"KB",factor:1000},{name:"MB",factor:1e6},{name:"GB",factor:1e9},{name:"TB",factor:1e12},{name:"KiB",factor:1024},{name:"MiB",factor:1048576},{name:"GiB",factor:1073741824}]

};

function conversion(value: number, category: Category, from: string, to: string): number {

  if (category === "Temperature") {

    const c = from === "°C" ? value : from === "°F" ? (value - 32) * 5 / 9 : value - 273.15;

    return to === "°C" ? c : to === "°F" ? c * 9 / 5 + 32 : c + 273.15;

  }

  const first = UNITS[category].find(u => u.name === from)?.factor ?? 1;

  const second = UNITS[category].find(u => u.name === to)?.factor ?? 1;

  return value * first / second;

}

function nice(n: number) { return Number.isFinite(n) ? Number(n.toPrecision(11)).toString() : "Error"; }

function SvgIcon({ name, size = 18 }: { name: string; size?: number }) { return <img src={`${ASSETS}${name}`} width={size} height={size} alt="" aria-hidden="true" />; }



type SelectOption = { value: string; label: string };

function NeumoSelect({value,options,onChange,label}:{value:string;options:SelectOption[];onChange:(value:string)=>void;label:string}) {

  const [open,setOpen]=useState(false);

  const ref=useRef<HTMLDivElement>(null);

  useEffect(()=>{

    if(!open)return;

    const dismiss=(event:MouseEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false);};

    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};

    document.addEventListener("pointerdown",dismiss);

    document.addEventListener("keydown",escape);

    return ()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};

  },[open]);

  return <div className="calcCustomSelect" ref={ref}>

    <button type="button" className="calcSelectTrigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>{options.find(o=>o.value===value)?.label||value}</span><span className={`calcChevron ${open?"isOpen":""}`} aria-hidden="true" /></button>

    {open&&<div className="calcSelectOptions" role="listbox" aria-label={label}>

      {options.map(o=><button type="button" key={o.value} role="option" aria-selected={value===o.value} className={value===o.value?"isChosen":""} onClick={()=>{onChange(o.value);setOpen(false);}}>{o.label}</button>)}

    </div>}

  </div>;

}

const unitOptions=(category:Category):SelectOption[]=>UNITS[category].map(u=>({value:u.name,label:u.name}));



export default function CalculatorPage() {

  const router = useRouter();

  const [mode, setMode] = useState<Mode>("standard");

  const [display, setDisplay] = useState("0");

  const [expression, setExpression] = useState("");

  const [memory, setMemory] = useState(0);

  const [angle, setAngle] = useState<"Degrees" | "Radians">("Degrees");

  const [category, setCategory] = useState<Category>("Length");

  const [from, setFrom] = useState("km");

  const [to, setTo] = useState("mi");

  const [input, setInput] = useState("1");

  const [saved, setSaved] = useState<SavedPad[]>([]);

  const [filter, setFilter] = useState("all");

  const [question, setQuestion] = useState(2);

  const [count, setCount] = useState(20);

  const [message, setMessage] = useState("");

  useEffect(() => {

    try {

      const raw = JSON.parse(assessmentStorage.getItem("oneWordContentDraft") || assessmentStorage.getItem("oneWordPreviewDraft") || assessmentStorage.getItem("mcqContentDraft") || "{}") as { questions?: unknown[] };

      const assessment = JSON.parse(assessmentStorage.getItem("oneWordAssessmentDraft") || assessmentStorage.getItem("mcqAssessmentDraft") || "{}") as { questionCount?: number | string };

      const n = Array.isArray(raw.questions) && raw.questions.length ? raw.questions.length : Number(assessment.questionCount) || 20;

      setCount(n);

      setQuestion((Number(assessmentStorage.getItem("viewerCurrentQuestion")) || 0) + 1);

      const items: SavedPad[] = JSON.parse(assessmentStorage.getItem("viewerScratchPads") || "[]");

      if (Array.isArray(items)) setSaved(items);

    } catch { /* Use reference data when drafts are unavailable. */ }

  }, []);

  const filtered = saved.filter(p => filter === "all" || p.mode === filter);

  const output = useMemo(() => {

    const n = Number(input);

    return input.trim() && Number.isFinite(n) ? nice(conversion(n, category, from, to)) : "";

  }, [input, category, from, to]);

  const formatExpression = (s: string) => s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");

  const evaluate = (s: string): number => {

    const clean = formatExpression(s).replace(/π/g, String(Math.PI)).replace(/\be\b/g, String(Math.E));

    if (!/^[0-9+*\/().%\s-]+$/.test(clean)) throw new Error("Invalid expression");

    // Expression is restricted to arithmetic, not arbitrary JavaScript.

    const tokens = clean.match(/(?:\d*\.\d+|\d+\.?\d*|[()+*\/%-])/g) || [];

    let pos = 0;

    const primary = (): number => {

      const token = tokens[pos++];

      if (token === "+") return primary();

      if (token === "-") return -primary();

      if (token === "(") { const x = addition(); if (tokens[pos++] !== ")") throw Error("Missing parenthesis"); return x; }

      if (!token || Number.isNaN(Number(token))) throw Error("Invalid number");

      return Number(token);

    };

    const mult = (): number => {

      let x = primary();

      while (["*", "/", "%"].includes(tokens[pos])) { const op = tokens[pos++]; const y = primary(); x = op === "*" ? x * y : op === "/" ? x / y : x % y; }

      return x;

    };

    const addition = (): number => { let x = mult(); while (["+", "-"].includes(tokens[pos])) { const op = tokens[pos++]; x = op === "+" ? x + mult() : x - mult(); } return x; };

    const result = addition();

    if (pos !== tokens.length || !Number.isFinite(result)) throw Error("Invalid result");

    return result;

  };

  const act = (key: string) => {

    setMessage("");

    if (key === "AC") { setDisplay("0"); setExpression(""); return; }

    if (key === "⌫") { setDisplay(x => x.length > 1 ? x.slice(0, -1) : "0"); return; }

    if (key === "=") {

      try { const result = nice(evaluate(expression + display)); setDisplay(result); setExpression(""); }

      catch { setDisplay("Error"); setExpression(""); }

      return;

    }

    if (["+", "−", "×", "÷"].includes(key)) { setExpression(expression + (display === "Error" ? "0" : display) + key); setDisplay("0"); return; }

    if (key === "±") { setDisplay(x => x.startsWith("-") ? x.slice(1) : x === "0" ? "0" : "-" + x); return; }

    if (key === "%") { setDisplay(x => nice(Number(x) / 100)); return; }

    if (key === ".") { setDisplay(x => x.includes(".") ? x : x + "."); return; }

    setDisplay(x => x === "0" || x === "Error" ? key : x + key);

  };

  const scientific = (key: string) => {

    try {

      const x = Number(display), rad = angle === "Degrees" ? x * Math.PI / 180 : x;

      if (!Number.isFinite(x)) throw Error("Invalid input");

      const asin = (v: number) => angle === "Degrees" ? v * 180 / Math.PI : v;

      let y = x;

      if (key === "sin") y = Math.sin(rad);

      else if (key === "cos") y = Math.cos(rad);

      else if (key === "tan") y = Math.tan(rad);

      else if (key === "sin⁻¹") y = asin(Math.asin(x));

      else if (key === "cos⁻¹") y = asin(Math.acos(x));

      else if (key === "tan⁻¹") y = asin(Math.atan(x));

      else if (key === "ln") y = Math.log(x);

      else if (key === "log") y = Math.log10(x);

      else if (key === "√") y = Math.sqrt(x);

      else if (key === "x²") y = x * x;

      else if (key === "xʸ") { setExpression(`${display}^`); setDisplay("0"); return; }

      else if (key === "π") y = Math.PI;

      else if (key === "e") y = Math.E;

      else if (key === "|x|") y = Math.abs(x);

      else if (key === "1/x") y = 1 / x;

      else if (key === "n!") { if (!Number.isInteger(x) || x < 0 || x > 170) throw Error("Invalid factorial"); y = Array.from({length:x}, (_, i) => i + 1).reduce((a,b)=>a*b,1); }

      else if (key === "(") {setExpression(e=>e+"(");return;}

      else if (key === ")") {setExpression(e=>e+display+")");setDisplay("0");return;}

      else {act(key);return;}

      setDisplay(nice(y));

    } catch { setDisplay("Error"); }

  };

  const press = (key: string) => {

    if (expression.endsWith("^") && key === "=") {

      const base = Number(expression.slice(0,-1)); setDisplay(nice(Math.pow(base,Number(display)))); setExpression(""); return;

    }

    if (mode === "scientific" && !["AC","⌫","%","÷","×","−","+","±",".","=","0","1","2","3","4","5","6","7","8","9"].includes(key)) scientific(key);

    else act(key);

  };

  const standardKeys = ["AC","⌫","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","±","0",".","="];

  const scientificKeys = ["sin","cos","tan","(",")","sin⁻¹","cos⁻¹","tan⁻¹","⌫","AC","ln","log","√","x²","xʸ","π","e","|x|","n!","1/x","7","8","9","÷","%","4","5","6","×","±","1","2","3","−","+","0",".","="];

  const handleCategory = (v: Category) => { setCategory(v); setFrom(UNITS[v][0].name); setTo(UNITS[v][1].name); };

  const back = () => router.push(viewerPath());

  const tools = [{name:"Scratch Pad",icon:"sticky-note.svg",arrow:"arrowupright.svg",cls:"teal",path:`${viewerPath()}/scratch`},{name:"Calculator",icon:"calculator.svg",arrow:"arrowup.svg",cls:"purple",path:`${viewerPath()}/calculator`},{name:"Formula Sheet",icon:"sigma.svg",arrow:"arrowupg.svg",cls:"green",path:`${viewerPath()}/formulasheet`}];

  return <main className="calcShell"><div className="calcGrid"><section className="calcWorkspace"><div className="calcHeading"><h1>Calculator</h1><p>Use the standard or scientific calculator, or convert units. Nothing you enter here is submitted with your answers.</p></div><div className="calcTabs" role="tablist" aria-label="Calculator modes">{(["standard","scientific","converter"] as Mode[]).map(item=><button type="button" role="tab" aria-selected={mode===item} className={mode===item?"active":""} key={item} onClick={()=>setMode(item)}>{item==="converter"?"Unit converter":item[0].toUpperCase()+item.slice(1)}</button>)}</div>

  {mode === "converter" ? <div className="calcConvert"><label className="calcField">Category<NeumoSelect value={category} label="Category" options={CATEGORIES.map(c=>({value:c,label:c}))} onChange={v=>handleCategory(v as Category)}/></label><div className="calcConvertCard"><label className="calcField">From<NeumoSelect value={from} label="From unit" options={unitOptions(category)} onChange={setFrom}/></label><input aria-label="Value to convert" type="number" value={input} onChange={e=>setInput(e.target.value)} /></div><button type="button" aria-label="Swap units" className="calcSwap" onClick={()=>{setFrom(to);setTo(from);}}><span className="calcSwapSymbol" aria-hidden="true">⇅</span></button><div className="calcConvertCard"><label className="calcField">To<NeumoSelect value={to} label="To unit" options={unitOptions(category)} onChange={setTo}/></label><output className="calcConverted">{output || "—"}</output></div><p className="calcConversionCaption">{input || "0"} {from} = {output || "—"} {to}</p><button className="calcCopy" type="button" onClick={()=>{if(output)navigator.clipboard?.writeText(output).then(()=>setMessage("Result copied")).catch(()=>setMessage("Unable to copy"));}}>Copy result</button>{message&&<p className="calcMessage" role="status">{message}</p>}</div> : <div className={`calcCalculator ${mode === "scientific"?"calcScientific":""}`}>{mode==="scientific"&&<div className="calcScientificOptions"><label>Angle<NeumoSelect value={angle} label="Angle" options={[{value:"Degrees",label:"Degrees"},{value:"Radians",label:"Radians"}]} onChange={v=>setAngle(v as "Degrees"|"Radians")}/></label>{["MC","MR","M+","M−"].map(k=><button key={k} onClick={()=>{if(k==="MC")setMemory(0);else if(k==="MR")setDisplay(String(memory));else setMemory(m=>m+(k==="M+"?1:-1)*Number(display));}}>{k}</button>)}</div>}<div className="calcScreen"><small>{expression || " "}</small><output>{display}</output></div><div className={`calcKeys ${mode==="scientific"?"fiveCols":""}`}>{(mode==="scientific"?scientificKeys:standardKeys).map((k,i)=><button key={`${k}-${i}`} type="button" className={`${k==="="?"equals":""} ${["AC","⌫"].includes(k)?"warning":""} ${["÷","×","−","+","%"].includes(k)?"operator":""}`} onClick={()=>press(k)}>{k==="⌫"?<span className="calcBackspaceSymbol" aria-hidden="true">⌫</span>:k}</button>)}</div></div>}

  <div className="calcFooter"><button type="button" onClick={back}><SvgIcon name="arrowleft.svg" size={17}/>Back to Question</button></div></section><aside className="calcAside"><h2>My Scratch Pads</h2><p>{saved.length} of {count} questions saved</p><label>Show<NeumoSelect value={filter} label="Show saved pads" options={[{value:"all",label:"All saved pads"},{value:"draw",label:"With drawing"},{value:"notes",label:"With typed notes"}]} onChange={setFilter}/></label><div className="calcPads">{filtered.length?filtered.map(p=><button key={p.id} onClick={()=>{try{assessmentStorage.setItem("viewerCurrentQuestion",String(Math.max(0,p.question-1)));}catch{}router.push(`${viewerPath()}/scratch`);}}>Question {p.question}<span>{p.mode==="notes"?"Typed notes":"Drawing"}</span></button>):<p className="calcEmpty">No saved scratch pads yet.<br/>Draw or type, then select Save<br/>to see it here.</p>}</div><h2 className="calcToolsTitle">Tools</h2><div className="calcTools">{tools.map(t=><button key={t.name} className={t.cls} onClick={()=>router.push(t.path)}><SvgIcon name={t.icon} size={18}/>{t.name}<SvgIcon name={t.arrow} size={16}/></button>)}</div></aside></div></main>;

}
