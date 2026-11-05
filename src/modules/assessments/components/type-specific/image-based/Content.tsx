"use client";
import { AssessmentEditorDropdown } from "@/modules/assessments/components/common/steps/DetailsStep/DetailsStep";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, X, Image as ImageIcon, Settings2, ClipboardList, MessageCircleMore, Check, Sparkles, Undo2, Redo2, Bold, Italic, Underline, Grid2X2, Upload } from "lucide-react";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import { assessmentStorage, updateAssessment } from "@/modules/assessments/storage/assessment-storage";
import { imageDetails, imageCorrectIndices, imageQuestionStarted, imageQuestionValid, newImageQuestion, IMAGE_CONTENT_KEY, type ImageDraft, type ImageQuestion, type ImageMatchPair, type ImageSubtype, type ImageLabelPin, type ImageDropdownSpot, type ImageDropdownChoice, newImageMatchPair, newLabelPin, newDropdownSpot, newDropdownChoice, newSequenceStep, type ImageSequenceStep, newSortingItem, type ImageSortingItem } from "./image-based-data";
import "./image-based.css";

type Section = "Question and Image" | "Answer Options" | "Question" | "Picture and matching text" | "Image Labelling" | "Labels" | "Dropdowns on the Picture" | "Drag Items" | "Groups and Items" | "Grading Method" | "Feedback" | "Model Answer and Grader Information";
const SECTIONS: Section[] = ["Question and Image", "Answer Options", "Grading Method", "Feedback"];
// Use the project's existing assessmenticons; no third-party icons for Image Labeling.
function LabelAsset({file,size=20,className=""}:{file:string;size?:number;className?:string}){
  return <img className={`ibqAssetIcon ${className}`} src={`/assets/assessmenticons/${file}`} width={size} height={size} alt="" aria-hidden="true" draggable={false}/>;
}
const LABEL_SECTION_ASSETS: Partial<Record<Section,string>> = {
  "Question and Image":"image-02.svg",
  "Labels":"tag-01.svg",
  "Drag Items":"chart-02.svg",
  "Grading Method":"clipboard-check.svg",
  "Model Answer and Grader Information":"message-circle-more.svg",
};
const iconMap = { "Question and Image": Grid2X2, "Answer Options": ClipboardList, "Question": Grid2X2, "Picture and matching text": Settings2, "Image Labelling": ImageIcon, "Labels": ClipboardList, "Dropdowns on the Picture": Settings2, "Drag Items": ClipboardList, "Groups and Items": Settings2, "Model Answer and Grader Information": ClipboardList, "Grading Method": ClipboardList, "Feedback": MessageCircleMore };
const cap = (value: string, maximum = 250) => value.slice(0, maximum);
const label = (n: number) => String.fromCharCode(65 + n);

function UploadImage({ value, onChange, title, compact=false, fallback="", matching=false, sequencing=false, sequenceIndex=0, galleryMode=false }: { value: string; onChange: (data: string) => void; title: string; compact?: boolean; fallback?: string; matching?: boolean; sequencing?: boolean; sequenceIndex?: number; galleryMode?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error,setError] = useState("");
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > 8_000_000) {
      setError("Choose an image smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Unable to read this image.");
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const img = new window.Image();
      img.onerror = () => setError("Unable to process this image.");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
        let scale = Math.min(1, 1000 / Math.max(1, maxSide));
        let result = "";
        for (let attempt = 0; attempt < 4; attempt += 1) {
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) { setError("Image processing is unavailable."); return; }
          context.fillStyle = "#FFFFFF";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL("image/jpeg", 0.70);
          if (result.length <= 180_000) break;
          scale *= 0.72;
        }
        if (result.length > 180_000) {setError("The image is too large to store in the assessment draft.");return;}
        onChange(result);
        setError("");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  return <div className={`ibqImagePicker ${compact ? "ibqCompactImage" : ""}`}>
    {sequencing ? <div className="ibqSequenceImageFrame">
      {value && <button className="ibqSequenceImageThumb" type="button" title={`Replace ${title}`} aria-label={`Replace ${title}`} onClick={()=>input.current?.click()}>
        <img src={value} alt={title}/>
      </button>}
      <button className="ibqSequenceImageReplace" type="button" title={value?`Change ${title}`:`Upload ${title}`} aria-label={value?`Change ${title}`:`Upload ${title}`} onClick={()=>input.current?.click()}><Upload size={28} strokeWidth={1.7} aria-hidden="true"/></button>
    </div> : matching ? <div className="ibqMatchUploadBox">
      <button type="button" className="ibqMatchThumbnail" aria-label={`Choose ${title}`} onClick={()=>input.current?.click()}>
        {value ? <img src={value} alt={title}/> : fallback ? <><ImageIcon size={28}/><img className="ibqMatchAsset" src={fallback} alt="" onError={event=>{event.currentTarget.style.display="none"}}/></> : <ImageIcon size={28}/>}
      </button>
      <button type="button" className="ibqMatchUploadIcon" aria-label={`Upload ${title}`} onClick={()=>input.current?.click()}><Upload size={22}/></button>
    </div> : value && !galleryMode ? <div className="ibqImagePreview"><img src={value} alt={title}/><button type="button" aria-label={`Remove ${title}`} onClick={()=>onChange("")}><X size={18}/></button></div> : <button className="ibqUpload" type="button" title={`Upload ${title}`} onClick={()=>input.current?.click()}>{fallback&&compact?<><ImageIcon size={compact?18:22}/><img src={fallback} alt="" onError={event=>{event.currentTarget.style.display="none"}}/></>:<ImageIcon size={compact?18:22}/>}<span>{compact?"Choose image":<><Upload size={20}/> Upload Image</>}</span>{!compact&&<small>PNG, JPG or WebP · Max 8 MB</small>}</button>}
    <input type="file" ref={input} hidden accept="image/*" onChange={change} />
    {error && <span className="ibqError" role="alert">{error}</span>}
  </div>;
}

/** Sorting-only dropdown: stays inside its row, unlike a native OS select popup. */
function SortingGroupPicker({value,groups,onChange,title}:{value:string;groups:string[];onChange:(group:string)=>void;title:string}) {
  const [open,setOpen]=useState(false);
  return <div className={`ibqSortingGroupWrap ${open?"is-open":""}`} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}} onKeyDown={event=>{if(event.key==="Escape")setOpen(false);}}>
    <button type="button" className="ibqSortingGroupTrigger" aria-label={title} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(previous=>!previous)}>
      <span>{value||"Choose Group"}</span><LabelAsset file="arrow-down-01.svg" size={24} className={open?"ibqRotated":""}/>
    </button>
    {open&&<div className="ibqSortingGroupMenu" role="listbox" aria-label={title}>
      {groups.map((group,i)=><button type="button" role="option" key={i} aria-selected={value===group} className={`ibqSortingGroupOption ${value===group?"is-selected":""}`} onClick={()=>{onChange(group);setOpen(false);}}>{group}</button>)}
    </div>}
  </div>;
}

/** Shared Image-Based question-sidebar picker: Figma inset field and raised menu,
 *  rather than the operating system's unstyled native select popup. */
function AsideNeumorphicSelect({id,value,options,onChange,title}:{id:string;value:string;options:string[];onChange:(next:string)=>void;title:string}){
  const [expanded,setExpanded]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!expanded)return;
    const dismiss=(event:PointerEvent)=>{
      if(root.current && !root.current.contains(event.target as Node))setExpanded(false);
    };
    document.addEventListener("pointerdown",dismiss);
    return ()=>document.removeEventListener("pointerdown",dismiss);
  },[expanded]);
  return <div ref={root} className={`ibqAsidePick ${expanded?"is-open":""}`}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setExpanded(false);}}
    onKeyDown={event=>{if(event.key==="Escape"){setExpanded(false);event.stopPropagation();}}}>
    <button type="button" id={id} className="ibqAsidePickTrigger"
      aria-label={title} aria-haspopup="listbox" aria-expanded={expanded}
      aria-controls={`${id}-menu`} onClick={()=>setExpanded(v=>!v)}>
      <span>{value}</span><LabelAsset file="arrow-down-01.svg" size={20} className={expanded?"ibqRotated":""}/>
    </button>
    {expanded&&<div id={`${id}-menu`} className="ibqAsidePickMenu" role="listbox" aria-label={title}>
      {options.map(option=><button key={option} type="button" role="option" aria-selected={option===value}
        className={`ibqAsidePickOption ${option===value?"is-selected":""}`}
        onClick={()=>{onChange(option);setExpanded(false);}}>{option}</button>)}
    </div>}
  </div>;
}

/** Small rich-text control. The stored value stays plain text for the existing viewer and result screens. */
function RichEditor({ value, onChange, label: ariaLabel, rows=3, placeholder="", tone="" }: {
  value: string; onChange:(value:string)=>void; label:string; rows?:number; placeholder?:string; tone?:string;
}) {
  const ref=useRef<HTMLDivElement>(null);
  const history=useRef<string[]>([value]);
  const position=useRef(0);
  const [family,setFamily]=useState("Arial");
  const [size,setSize]=useState("16");
  const [more,setMore]=useState(false);
  useEffect(()=>{
    if(ref.current && ref.current.innerText !== value){ref.current.innerText=value;history.current=[value];position.current=0;}
  },[value]);
  const setText=(next:string)=>{
    const trimmed=cap(next,250);
    if(trimmed!==history.current[position.current]){
      history.current=history.current.slice(0,position.current+1);
      history.current.push(trimmed);position.current=history.current.length-1;
    }
    onChange(trimmed);
    if(next.length>250 && ref.current) ref.current.innerText=trimmed;
  };
  const undo=(delta:number)=>{
    position.current=Math.min(Math.max(0,position.current+delta),history.current.length-1);
    const next=history.current[position.current];
    if(ref.current)ref.current.innerText=next;
    onChange(next);
  };
  const command=(name:string,arg?:string)=>{
    ref.current?.focus();
    document.execCommand(name,false,arg);
    setText(ref.current?.innerText || "");
  };
  return <div className={`ibqRich ${tone}`}>
    <div className="ibqRichToolbar" aria-label={`${ariaLabel} formatting tools`}>
      <button type="button" onClick={()=>undo(-1)} title="Undo" aria-label="Undo"><Undo2 size={16}/></button>
      <button type="button" onClick={()=>undo(1)} title="Redo" aria-label="Redo"><Redo2 size={16}/></button>
      <AssessmentEditorDropdown className="mcqEditorFont" label="Font" value={family} options={["Arial", "Segoe UI", "Inter"]} onChange={setFamily} />
      <AssessmentEditorDropdown className="mcqEditorSize" label="Font size" value={size} options={["12", "14", "16", "18", "20"]} onChange={setSize} />
      <button type="button" onClick={()=>command("bold")} title="Bold" aria-label="Bold"><Bold size={16}/></button>
      <button type="button" onClick={()=>command("italic")} title="Italic" aria-label="Italic"><Italic size={16}/></button>
      <button type="button" onClick={()=>command("underline")} title="Underline" aria-label="Underline"><Underline size={16}/></button>
      <button type="button" onClick={()=>command("foreColor","#2D4CC8")} title="Blue text" aria-label="Blue text"><span className="ibqLetterColor">A</span></button>
      <button type="button" onClick={()=>command("insertUnorderedList")} title="Bulleted list" aria-label="Bulleted list"><ClipboardList size={16}/></button>
      <button className="ibqMoreToolbar" type="button" onClick={()=>setMore(x=>!x)} title="More tools" aria-label="More tools">•••</button>
      {more&&<button type="button" onClick={()=>command("removeFormat")} title="Clear formatting">Clear</button>}
    </div>
    <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={ariaLabel} aria-multiline="true"
      data-placeholder={placeholder} className="ibqRichInput" style={{minHeight:rows*24+29,fontFamily:family,fontSize:`${size}px`}}
      onInput={e=>setText(e.currentTarget.innerText)} />
    <small className="assessmentEditorCounter" aria-live="polite">{value.length}/250</small>
  </div>;
}

function Toggle({value,onChange,title}:{value:boolean;onChange:(v:boolean)=>void;title:string}){
  return <button type="button" title={title} aria-label={title} role="switch" aria-checked={value} onClick={()=>onChange(!value)}
    className={`ibqSwitch ${value?"is-on":""}`}><span>{value?"ON":"OFF"}</span><i/></button>;
}
function GalleryThumb({src,selected,onSelect,index}:{src:string;selected:boolean;onSelect:()=>void;index:number}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return <button type="button" className={`ibqGalleryThumb ${selected?"selected":""}`} onClick={onSelect}
    title={src?`Select image ${index+1}`:`Image ${index+1} — upload using Upload Image below`}
    aria-label={src?`Select uploaded image ${index+1}`:`Empty image slot ${index+1}`}>
    {src&&!failed?<img alt={`Uploaded image ${index+1}`} src={src} onError={()=>setFailed(true)}/>:<><ImageIcon size={27}/><small>Image {index+1}</small></>}
  </button>;
}

export default function ImageBasedContent() {
  const router=useRouter();
  const [ready,setReady]=useState(false);
  const [questions,setQuestions]=useState<ImageQuestion[]>([newImageQuestion()]);
  const [active,setActive]=useState(0);
  const [count,setCount]=useState(20);
  const [totalMarks,setTotalMarks]=useState(40);
  const [open,setOpen]=useState<Section[]>([]);
  const [extraOpen,setExtraOpen]=useState({explanation:true,hint:true});
  const [tagsOpen,setTagsOpen]=useState(false);
  const [subtypeOpen,setSubtypeOpen]=useState(false);
  const subtypeMenuRef=useRef<HTMLDivElement>(null);
  const [newTag,setNewTag]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);
  const continueTimer=useRef<number|null>(null);
  useEffect(()=>()=>{if(continueTimer.current!==null)window.clearTimeout(continueTimer.current);},[]);
  useEffect(()=>{if(message!=="Successfully saved"||saving)return;const timer=window.setTimeout(()=>setMessage(""),3000);return()=>window.clearTimeout(timer);},[message,saving]);
  const [passingScore,setPassingScore]=useState("60");
  const scroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    try {
      const details=imageDetails();setCount(details.count);setTotalMarks(details.totalMarks);
      try {const evalSettings=JSON.parse(assessmentStorage.getItem("mcqAssessmentEvaluationDraft")||"{}");setPassingScore(String(evalSettings.passingScore||details.passingScore));}catch{setPassingScore(String(details.passingScore));}
      const draft=assessmentStorage.getItem(IMAGE_CONTENT_KEY);
      if(draft){const value=JSON.parse(draft) as ImageDraft; if(Array.isArray(value.questions) && value.questions.length){setQuestions(value.questions);setActive(Math.max(0,Math.min(value.active||0,details.count-1))); const restored=value.questions[Math.max(0,Math.min(value.active||0,details.count-1))]; if(restored?.subtype === "image-labeling") setOpen(["Question and Image","Labels","Grading Method","Model Answer and Grader Information"]);
      if(restored?.subtype === "image-dropdown") setOpen(["Question and Image","Dropdowns on the Picture","Grading Method","Feedback"]);
      if(restored?.subtype === "image-sequencing") setOpen(["Question and Image","Drag Items","Grading Method","Feedback"]);
      if(restored?.subtype === "image-sorting") setOpen(["Question and Image","Groups and Items","Grading Method","Model Answer and Grader Information"]);}}
    }catch{/* Keep editable defaults. */}
    setReady(true);
  },[]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!subtypeMenuRef.current?.contains(event.target as Node))setSubtypeOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setSubtypeOpen(false);};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[]);
  useEffect(()=>{
    const close=()=>{setTagsOpen(false);setSubtypeOpen(false);};
    const container=document.querySelector(".ibqScroll");
    container?.addEventListener("scroll",close,{passive:true});
    window.addEventListener("scroll",close,{passive:true});
    return ()=>{container?.removeEventListener("scroll",close);window.removeEventListener("scroll",close);};
  },[]);
  useEffect(()=>{
    if(!ready) return;
    try {assessmentStorage.setItem(IMAGE_CONTENT_KEY,JSON.stringify({questions,active,savedAt:new Date().toISOString()}));} catch {setMessage("Draft could not be saved. Please use smaller images.");}
  },[questions,active,ready]);
  const question=questions[active] || newImageQuestion();
  const isMatching=question.subtype === "image-matching";
  const isLabeling=question.subtype === "image-labeling";
  const isDropdown=question.subtype === "image-dropdown";
  const isSequencing=question.subtype === "image-sequencing";
  const isSorting=question.subtype === "image-sorting";
  // The four MCQ picture cards are real upload slots, not a fixed stock-image gallery.
  // Older drafts with only `image` still display their existing picture in slot 1.
  const galleryImages: string[] = Array.isArray(question.galleryImages) && question.galleryImages.length
    ? question.galleryImages.slice(0,4)
    : question.image ? [question.image] : [];
  const uploadGalleryImage=(image:string)=>{
    const next=[...galleryImages];
    const empty=Array.from({length:4},(_,i)=>i).find(i=>!next[i]);
    // If all 4 are filled, replace the currently selected picture.
    const slot=empty??Math.max(0,next.indexOf(question.image));
    next[slot]=image;
    update({galleryImages:next,image});
  };
  const sections: Section[] = isSorting ? ["Question and Image", "Groups and Items", "Grading Method", "Model Answer and Grader Information"] : isSequencing ? ["Question and Image", "Drag Items", "Grading Method", "Feedback"] : isDropdown ? ["Question and Image", "Dropdowns on the Picture", "Grading Method", "Feedback"] : isLabeling ? ["Question and Image", "Labels", "Grading Method", "Model Answer and Grader Information"] : isMatching ? ["Question", "Picture and matching text", "Grading Method", "Feedback"] : SECTIONS;
  const pairs: ImageMatchPair[] = question.matchPairs || Array.from({length:4},newImageMatchPair);
  const update=(patch:Partial<ImageQuestion>)=>setQuestions(old=>{const copy=[...old];while(copy.length<=active) copy.push(newImageQuestion());copy[active]={...copy[active],...patch};return copy;});
  const go=(index:number)=>{if(index<0 || index>=count)return;setActive(index);setMessage("");scroll.current?.children[index]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});};
  const add=()=>{if(active>=count-1){setMessage(`Maximum ${count} questions configured in Details.`);return;}go(active+1);};
  const save=(continueToEvaluation=false)=>{
    if(saving)return;
    if(continueToEvaluation){
      const firstIncomplete=Array.from({length:count},(_,i)=>i).find(i=>!questions[i]||!imageQuestionValid(questions[i]));
      if(firstIncomplete!==undefined){go(firstIncomplete);setMessage(`Complete Question ${firstIncomplete+1}: ${questions[firstIncomplete]?.subtype === "image-sorting" ? "write the question, upload 2–6 item images, enter unique text and choose a group for every item." : questions[firstIncomplete]?.subtype === "image-sequencing" ? "enter the question and 2–6 ordered steps, each with an image and unique text." : questions[firstIncomplete]?.subtype === "image-dropdown" ? "upload an image, add up to five dropdowns, and give each dropdown 2–6 unique choices with exactly one correct answer." : questions[firstIncomplete]?.subtype === "image-labeling" ? "upload an image, add 2–6 pins and give every pin a unique label." : questions[firstIncomplete]?.subtype === "image-matching" ? "enter your question and at least two picture/text pairs, including an image for each." : "add a question image, at least two options, and mark the correct answer."}`);return;}
    }
    try {
      assessmentStorage.setItem(IMAGE_CONTENT_KEY,JSON.stringify({questions,active,savedAt:new Date().toISOString()}));
      const valid=questions.filter(imageQuestionValid);updateAssessment({questions:valid.length,marks:valid.reduce((sum,q)=>sum+(Number(q.points)||0),0)});
      setMessage("Successfully saved");
      if(continueToEvaluation){setSaving(true);continueTimer.current=window.setTimeout(()=>{setMessage("");setSaving(false);router.push("/assessments/create/image-based-preview");},3000);}
    } catch {setMessage("Unable to save. Please reduce image sizes.");}
  };
  const toggle=(name:Section)=>setOpen(old=>old.includes(name)?old.filter(x=>x!==name):[...old,name]);
  const complete=questions.filter(imageQuestionValid).length;
  const correctIndices=imageCorrectIndices(question);
  const setCorrect=(index:number,value:boolean)=>{
    if(question.allowMultiple){
      const next=value?[...correctIndices,index]:correctIndices.filter(i=>i!==index);
      update({correctAnswers:[...new Set(next)],correct:next[0]??-1});
    }else update({correct:value?index:-1});
  };
  const removeOption=(i:number)=>{
    const options=question.options.filter((_,j)=>i!==j);
    const selected=correctIndices.filter(n=>n!==i).map(n=>n>i?n-1:n);
    update({options,correct:selected[0]??-1,correctAnswers:selected});
  };
  const option=(i:number,patch:Partial<{text:string;image:string;explanation:string}>)=>update({options:question.options.map((v,j)=>j===i?{...v,...patch}:v)});
  const matchPair=(i:number,patch:Partial<ImageMatchPair>)=>update({matchPairs:pairs.map((v,j)=>i===j?{...v,...patch}:v)});
  const chooseSubtype=(value:ImageSubtype)=>{
    update({subtype:value,
      ...(value === "image-matching" && !question.matchPairs ? {matchPairs:Array.from({length:4},newImageMatchPair),matchExtras:[""],shuffleTexts:true}: {}),
      ...(value === "image-dropdown" && !question.dropdownSpots ? {dropdownSpots:[],shuffleDropdowns:true}: {}),
      ...(value === "image-sequencing" && !question.sequenceSteps ? {sequenceSteps:Array.from({length:5},newSequenceStep),shuffleSteps:true}: {}),
      ...(value === "image-sorting" && !question.sortingItems ? {sortingItems:Array.from({length:4},newSortingItem),sortingGroups:["",""],shuffleSorting:true}: {}),
      ...(value === "image-labeling" && !question.labelPins ? {labelPins:[],labelExtras:[],shuffleLabels:true}: {}),
    });
    setOpen(value === "image-sorting" ? ["Question and Image","Groups and Items","Grading Method","Model Answer and Grader Information"] : value === "image-sequencing" ? ["Question and Image", "Drag Items", "Grading Method", "Feedback"] : value === "image-dropdown" ? ["Question and Image","Dropdowns on the Picture","Grading Method","Feedback"] : value === "image-matching" ? ["Question","Picture and matching text","Grading Method","Feedback"]
      : value === "image-labeling" ? ["Question and Image","Labels","Grading Method","Model Answer and Grader Information"]
      : ["Question and Image","Answer Options","Grading Method","Feedback"]);
  };
  const sortingItems: ImageSortingItem[] = question.sortingItems || [];
  const sortingGroups=question.sortingGroups || ["",""];
  const sortingItem=(id:string, patch:Partial<ImageSortingItem>)=>update({sortingItems:sortingItems.map(item=>item.id===id?{...item,...patch}:item)});
  const editSortingGroup=(index:number,name:string)=>{
    const oldName=sortingGroups[index];
    update({sortingGroups:sortingGroups.map((g,i)=>i===index?name:g),sortingItems:sortingItems.map(item=>item.group===oldName?{...item,group:name}:item)});
  };
  const sequenceSteps: ImageSequenceStep[] = question.sequenceSteps || [];
  const sequenceStep = (id:string,patch:Partial<ImageSequenceStep>) => update({sequenceSteps:sequenceSteps.map(step=>step.id===id?{...step,...patch}:step)});
  const moveSequenceStep = (index:number,direction:-1|1) => {
    const other=index+direction;
    if(other<0||other>=sequenceSteps.length) return;
    const reordered=[...sequenceSteps];
    [reordered[index],reordered[other]]=[reordered[other],reordered[index]];
    update({sequenceSteps:reordered});
  };
  const dropdownSpots: ImageDropdownSpot[] = question.dropdownSpots || [];
  const addDropdownSpot=(x:number,y:number)=>{
    if(dropdownSpots.length>=5){setMessage("Maximum five dropdowns can be placed on one image.");return;}
    update({dropdownSpots:[...dropdownSpots,newDropdownSpot(Math.max(2,Math.min(98,x)),Math.max(4,Math.min(96,y)))]});
    setMessage("");
  };
  const placeDropdown=(event:MouseEvent<HTMLDivElement>)=>{
    if (!question.image) return;
    const box=event.currentTarget.getBoundingClientRect();
    if(!box.width || !box.height)return;
    addDropdownSpot(Math.round((event.clientX-box.left)*10000/box.width)/100,Math.round((event.clientY-box.top)*10000/box.height)/100);
  };
  const updateDropdown=(id:string,patch:Partial<ImageDropdownSpot>)=>update({dropdownSpots:dropdownSpots.map(spot=>spot.id===id?{...spot,...patch}:spot)});
  const updateChoice=(spot:ImageDropdownSpot,choiceId:string,patch:Partial<ImageDropdownChoice>)=>updateDropdown(spot.id,{choices:spot.choices.map(c=>c.id===choiceId?{...c,...patch}:patch.correct?{...c,correct:false}:c)});
  const pins=question.labelPins || [];
  const updatePin=(id:string, patch:Partial<ImageLabelPin>)=>update({labelPins:pins.map(pin=>pin.id===id?{...pin,...patch}:pin)});
  const addPin=(x:number,y:number)=>{
    if(pins.length>=6){setMessage("Maximum 6 label pins per image.");return;}
    update({labelPins:[...pins,newLabelPin(Math.round(x*100)/100,Math.round(y*100)/100)]});
    setMessage("");
  };
  const placePin=(event:MouseEvent<HTMLButtonElement>)=>{
    if(!question.image) return;
    const box=event.currentTarget.getBoundingClientRect();
    if(!box.width || !box.height) return;
    const x=Math.min(96,Math.max(4,100*(event.clientX-box.left)/box.width));
    const y=Math.min(95,Math.max(5,100*(event.clientY-box.top)/box.height));
    addPin(x,y);
  };
  return <main className={`ibqApp ${isLabeling?"ibqApp--labeling":""} ${isDropdown?"ibqApp--dropdown":""} ${isSequencing?"ibqApp--sequencing":""} ${isSorting?"ibqApp--sorting":""} superAdminPage institutionAdminPage`}>
    <div className="dashboardLayout ibqLayout"><Sidebar/><section className="mainContent ibqMain"><div className="ibqHeader"><Header/></div>
    <div className="ibqScroll institutionScrollArea"><div className="ibqPage pageContent institutionPageContent">
      <div className="ibqTop"><nav aria-label="Breadcrumb" className="ibqBreadcrumb"><Link href="/assessments">Assessment</Link><span>»</span><button type="button" onClick={()=>router.push("/assessments/create/details")}>Create Assessment</button><span>»</span><strong>Create Questions</strong></nav><div className="ibqWelcome"><Sparkles size={24}/><div><strong>Let&apos;s Get Started! Antony?</strong><span>Let&apos;s Build A Great Question.</span></div></div></div>
      <><div className="ibqColumns"><div className="ibqPrimary"><section className="ibqCard">
        <div className="ibqCardHead"><div><h1>Question {active+1} of {count}</h1><p>{count} Question | {totalMarks} Marks</p></div><button className="ibqAccentButton" type="button" onClick={add}><Plus size={20}/>Add</button></div>
        <div className="ibqNumberLine"><button className="ibqCircle" aria-label="Previous question" onClick={()=>go(active-1)} disabled={active===0}><ChevronLeft size={20}/></button><div className="ibqNumberScroll" ref={scroll}>{Array.from({length:count},(_,i)=>{const q=questions[i];const done=q&&imageQuestionValid(q);return <button key={i} type="button" onClick={()=>go(i)} className={`ibqNumber ${done?"is-done":active===i?"is-active":""}`} aria-current={active===i?"step":undefined}><b>{i+1}</b><span className={`ibqDot ${done?"is-done":"is-pending"}`} aria-hidden="true">{done?"✓":""}</span><small>{q&&imageQuestionStarted(q)?(q.subtype === "image-matching"?"IM":q.subtype === "image-labeling"?"IL":q.subtype === "image-dropdown"?"ID":q.subtype === "image-sequencing"?"IS":q.subtype === "image-sorting"?"ISO":"MCQ"):""}</small></button>})}</div><button className="ibqCircle" aria-label="Next question" onClick={()=>go(active+1)} disabled={active>=count-1}><ChevronRight size={20}/></button></div>
        <div className="ibqTrack"><span style={{width:`${Math.max(1,complete/count*100)}%`}}/></div>
        <section className="ibqForm"><div className="ibqField"><label>Question Type</label><div className="ibqStaticSelect">Image Based {(isLabeling||isSequencing||isSorting)?<LabelAsset file="arrow-down-01.svg" size={20}/>:<ChevronDown size={20}/>}</div></div><div className="ibqField"><label id="ibqSubtypeLabel">Sub type</label><div className={`ibqSubtypeControl ${subtypeOpen?"is-open":""}`} ref={subtypeMenuRef} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSubtypeOpen(false);}}>
          <button type="button" className="ibqSubtypeTrigger" aria-labelledby="ibqSubtypeLabel ibqSubtypeValue" aria-haspopup="listbox" aria-expanded={subtypeOpen} aria-controls="ibqSubtypeMenu" onClick={()=>setSubtypeOpen(value=>!value)}><span id="ibqSubtypeValue">{isMatching?"Image Matching":isLabeling?"Image Labeling":isDropdown?"Image Dropdown":isSequencing?"Image Sequencing":isSorting?"Image Sorting":"Image-Based Multiple Choice"}</span><LabelAsset file="arrow-down-01.svg" size={20} className={subtypeOpen?"ibqRotated":""}/></button>
          {subtypeOpen&&<div className="ibqSubtypeMenu" role="listbox" aria-label="Image-Based subtype options" id="ibqSubtypeMenu" onKeyDown={event=>{const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="option"]'));const current=items.indexOf(document.activeElement as HTMLButtonElement);if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();items[(current+(event.key==="ArrowDown"?1:items.length-1)+items.length)%items.length]?.focus();}if(event.key==="Home"){event.preventDefault();items[0]?.focus();}if(event.key==="End"){event.preventDefault();items[items.length-1]?.focus();}}}>
            {([['multiple-choice','Image-Based Multiple Choice'],['image-matching','Image Matching'],['image-labeling','Image Labeling'],['image-dropdown','Image Dropdown'],['image-sequencing','Image Sequencing'],['image-sorting','Image Sorting']] as [ImageSubtype,string][]).map(([value,text])=><button key={value} type="button" role="option" aria-selected={question.subtype===value||(value==='multiple-choice'&&!isLabeling&&!isMatching&&!isDropdown&&!isSequencing&&!isSorting)} className={`ibqSubtypeOption ${(question.subtype===value||(value==='multiple-choice'&&!isLabeling&&!isMatching&&!isDropdown&&!isSequencing&&!isSorting))?'is-selected':''}`} onClick={()=>{chooseSubtype(value);setSubtypeOpen(false);}}>{text}{(question.subtype===value||(value==='multiple-choice'&&!isLabeling&&!isMatching&&!isDropdown&&!isSequencing&&!isSorting))&&<LabelAsset file="checkmark-square-02.svg" size={18}/>}</button>)}
          </div>}</div></div>
          {sections.map(name=>{const Icon=iconMap[name];const opened=open.includes(name);return <div className="ibqAccordion" data-section={name} key={name}><button type="button" className="ibqAccordionToggle" aria-expanded={opened} onClick={()=>toggle(name)}><span className="ibqSectionIcon">{isSorting&&name==="Question and Image"?<LabelAsset file="grid-view.svg" size={16}/>:((isLabeling||isDropdown||isSequencing||isSorting)&&LABEL_SECTION_ASSETS[name]?<LabelAsset file={LABEL_SECTION_ASSETS[name]!} size={18}/>:<Icon size={18}/>)}</span><b>{name}</b>{(isLabeling||isSequencing||isSorting)?<LabelAsset file="arrow-down-01.svg" size={20} className={opened?"ibqRotated":""}/>:<ChevronDown className={opened?"ibqRotated":""} size={20}/>}</button>{opened&&<div className="ibqAccordionBody">
          {name==="Question"&&<>
            <label>Write your Question </label>
            <RichEditor label="Write your matching question" rows={3} value={question.text} onChange={text=>update({text})} placeholder="Match each picture with its topic."/>
          </>}
          {name==="Picture and matching text"&&<>
            <p className="ibqMatchHelper">Each row is one correct match</p>
            <div className="ibqMatchColumns"><b>Match Text</b><b>Image</b></div>
            <div className="ibqMatchList">{pairs.map((pair,i)=> <div className="ibqMatchRow" key={i}>
              <input aria-label={`Matching text ${i+1}`} type="text" maxLength={250} value={pair.text} placeholder={["Neural Network","Security","Cloud","Data Analysis"][i]||`Matching text ${i+1}`} onChange={e=>matchPair(i,{text:cap(e.target.value)})}/>
              <div className="ibqMatchImageField"><UploadImage compact matching title={`Matching picture ${i+1}`} value={pair.image} fallback={["/assets/assessmenticons/image-matching-neural-network.svg","/assets/assessmenticons/image-matching-security.svg","/assets/assessmenticons/image-matching-cloud.svg","/assets/assessmenticons/image-matching-database.svg"][i]||""} onChange={image=>matchPair(i,{image})}/></div>
              <button className="ibqMatchRemove" type="button" aria-label={`Remove matching pair ${i+1}`} onClick={()=>update({matchPairs:pairs.filter((_,n)=>n!==i)})}><X size={18}/></button>
            </div>)}</div>
            <div className="ibqMatchAdd"><button className="ibqMatchAddButton" type="button" disabled={pairs.length>=6} onClick={()=>update({matchPairs:[...pairs,newImageMatchPair()]})}><Plus size={20}/><span>Add Pairs</span></button><small>2 to 6 options</small></div>
            <label className="ibqMatchExtraLabel">Extra texts that match no Picture (Optional)</label>
            {(question.matchExtras||[]).map((extra,i)=><div className="ibqMatchExtraRow" key={i}><input type="text" aria-label={`Extra matching text ${i+1}`} maxLength={250} value={extra} placeholder="Printer" onChange={e=>update({matchExtras:(question.matchExtras||[]).map((v,j)=>i===j?cap(e.target.value):v)})}/><button className="ibqMatchRemove" type="button" aria-label={`Remove extra text ${i+1}`} onClick={()=>update({matchExtras:(question.matchExtras||[]).filter((_,j)=>j!==i)})}><X size={18}/></button></div>)}
            <div className="ibqMatchAdd"><button className="ibqMatchAddButton" type="button" disabled={(question.matchExtras||[]).length>=6} onClick={()=>update({matchExtras:[...(question.matchExtras||[]),""]})}><Plus size={20}/><span>Add Extra</span></button><small>0 to 6 options</small></div>
            <label className="ibqMatchShuffle">Shuffle the texts <Toggle title="Shuffle matching texts" value={question.shuffleTexts!==false} onChange={v=>update({shuffleTexts:v})}/></label>
          </>}
          {name==="Groups and Items"&&isSorting&&<>
            <p className="ibqSortingHelp">Sort each image and text into the correct group.</p>
            <div className="ibqSortingGroups">
              <span>Groups</span>
              <div className="ibqSortingGroupNames">{sortingGroups.map((group,i)=><label key={i}>Group {i+1}<input type="text" value={group} aria-label={`Group ${i+1} name`} maxLength={40} onChange={event=>editSortingGroup(i,event.target.value)}/></label>)}</div>
            </div>
            <div className="ibqSortingHead"><b>Image</b><b>Match Text</b><b>Group</b></div>
            <div className="ibqSortingList">{sortingItems.map((item,i)=><div className="ibqSortingRow" key={item.id}>
              <div className="ibqSortingPicture"><UploadImage compact sequencing sequenceIndex={i} value={item.image} title={`Sorting item ${i+1} image`} onChange={image=>sortingItem(item.id,{image})}/></div>
              <input className="ibqSortingText" type="text" value={item.text} aria-label={`Sorting item ${i+1} text`} maxLength={250} placeholder={['Monitor','Keyboard','Web Browser','Text editor','Database'][i]||`Item ${i+1}`} onChange={event=>sortingItem(item.id,{text:cap(event.target.value)})}/>
              <SortingGroupPicker title={`Correct group for item ${i+1}`} value={item.group} groups={sortingGroups} onChange={group=>sortingItem(item.id,{group})}/>
              <button className="ibqSortingRemove" type="button" title={`Remove item ${i+1}`} aria-label={`Remove item ${i+1}`} onClick={()=>update({sortingItems:sortingItems.filter(v=>v.id!==item.id)})}><span className="ibqSortingRemoveCircle"><LabelAsset file="cancel-circle-sequencing.svg" size={22}/></span></button>
            </div>)}</div>
            <div className="ibqSortingAdd"><button type="button" disabled={sortingItems.length>=6} onClick={()=>update({sortingItems:[...sortingItems,newSortingItem()]})}><LabelAsset file="plus-1.svg" size={20}/><span>Add Items</span></button><small>2 to 6 options</small></div>
            <div className="ibqSortingShuffle">Shuffle the Steps for learners <Toggle title="Shuffle the Steps for learners" value={question.shuffleSorting!==false} onChange={shuffleSorting=>update({shuffleSorting})}/></div>
          </>}
          {name==="Drag Items"&&isSequencing&&<>
            <div className="ibqSequenceHelp">Enter them in the correct order</div>
            <div className="ibqSequenceHead"><b>Image</b><b>Match Text</b><b>Order</b></div>
            <div className="ibqSequenceList">
              {sequenceSteps.map((step,i)=><div className="ibqSequenceRow" key={step.id}>
                <div className="ibqSequencePicture"><UploadImage compact sequencing sequenceIndex={i} value={step.image} title={`Step ${i+1} image`} onChange={image=>sequenceStep(step.id,{image})}/></div>
                <input className="ibqSequenceText" type="text" value={step.text} maxLength={250} placeholder={['Collect Data','Clean Data','Train the Model','Evaluate','Deploy'][i]||`Step ${i+1}`} aria-label={`Step ${i+1} text`} onChange={event=>sequenceStep(step.id,{text:cap(event.target.value)})}/>
                <div className="ibqSequenceOrder"><button aria-label={`Move step ${i+1} up`} type="button" disabled={i===0} onClick={()=>moveSequenceStep(i,-1)}><LabelAsset file="arrow-up-big.svg" size={28}/></button><button aria-label={`Move step ${i+1} down`} type="button" disabled={i===sequenceSteps.length-1} onClick={()=>moveSequenceStep(i,1)}><LabelAsset file="arrow-down-big.svg" size={28}/></button></div>
                <button className="ibqSequenceRemove" type="button" title={`Remove step ${i+1}`} aria-label={`Remove step ${i+1}`} onClick={()=>update({sequenceSteps:sequenceSteps.filter(v=>v.id!==step.id)})}><span className="ibqSequenceRemoveCircle"><LabelAsset file="cancel-circle-sequencing.svg" size={22}/></span></button>
              </div>)}
            </div>
            <div className="ibqSequenceAdd"><button type="button" disabled={sequenceSteps.length>=6} onClick={()=>update({sequenceSteps:[...sequenceSteps,newSequenceStep()]})}><Plus size={20}/> Add Items</button><small>2 to 6 options</small></div>
            <div className="ibqSequenceShuffle">Shuffle the Steps for learners <Toggle title="Shuffle the Steps for learners" value={question.shuffleSteps!==false} onChange={shuffleSteps=>update({shuffleSteps})}/></div>
          </>}
          {name==="Dropdowns on the Picture"&&isDropdown&&<>
            <p className="ibqDropdownHelp">Check the image to add a dropdown. You can position up to five dropdowns, then choose the correct answer for each.</p>
            <div className="ibqDropdownCanvasWrap">
              {question.image?<div className="ibqDropdownCanvas" onClick={placeDropdown}>
                <img alt="Uploaded illustration for dropdown questions" src={question.image} draggable={false}/>
                {dropdownSpots.map((spot,i)=><button type="button" aria-label={`Edit dropdown ${i+1}`} className="ibqDropdownPin" key={spot.id} style={{left:`clamp(48px, ${spot.x}%, calc(100% - 48px))`,top:`clamp(18px, ${spot.y}%, calc(100% - 18px))`}} onClick={event=>{event.stopPropagation();document.getElementById(`ibq-dropdown-${spot.id}`)?.scrollIntoView({block:"nearest",behavior:"smooth"});}}>{i+1}. Choose...<LabelAsset file="arrow-down-01.svg" size={17}/></button>)}
              </div>:<div className="ibqDropdownEmpty">Upload your image in Question and Image to add dropdown positions.</div>}
            </div>
            <div className="ibqDropdownEditorList">{dropdownSpots.map((spot,i)=><section key={spot.id} id={`ibq-dropdown-${spot.id}`} className="ibqDropdownEditor" aria-label={`Dropdown ${i+1}`}>
              <div className="ibqDropdownEditorHead"><h3>Dropdown {i+1}</h3><button type="button" className="ibqDropdownRemove" onClick={()=>update({dropdownSpots:dropdownSpots.filter(item=>item.id!==spot.id)})}><LabelAsset file="cancel-circle.svg" size={16}/> Remove</button></div>
              <p className="ibqDropdownInstruction">Select the round button next to the correct choice.</p>
              <div className="ibqDropdownChoices">{spot.choices.map((choice,j)=><div className="ibqDropdownChoice" key={choice.id}>
                <label className="ibqDropdownChoiceRadio" title={`Correct choice ${j+1}`}><input type="radio" name={`ibq-choice-${spot.id}`} checked={!!choice.correct} onChange={()=>updateDropdown(spot.id,{choices:spot.choices.map(c=>({...c,correct:c.id===choice.id}))})}/><span/></label>
                <input aria-label={`Dropdown ${i+1}, choice ${j+1}`} value={choice.text} maxLength={250} placeholder={`Choice ${j+1}`} onChange={e=>updateChoice(spot,choice.id,{text:cap(e.target.value)})}/>
                <button type="button" aria-label={`Remove choice ${j+1}`} className="ibqDropdownRemoveChoice" onClick={()=>updateDropdown(spot.id,{choices:spot.choices.filter(c=>c.id!==choice.id)})}><LabelAsset file="cancel-circle.svg" size={17}/></button>
              </div>)}</div>
              <button type="button" className="ibqDropdownAddChoice" disabled={spot.choices.length>=6} onClick={()=>updateDropdown(spot.id,{choices:[...spot.choices,newDropdownChoice()]})}><LabelAsset file="plus.svg" size={19}/><span>Add Choice</span></button>
              <small className="ibqDropdownChoiceCount">2 to 6 choices for each dropdown</small>
            </section>)}</div>
            <button type="button" className="ibqDropdownAdd" disabled={!question.image||dropdownSpots.length>=5} onClick={()=>addDropdownSpot(20+(dropdownSpots.length%3)*25,30+(dropdownSpots.length%2)*28)}><LabelAsset file="plus.svg" size={20}/> Add Dropdown</button>
            <div className="ibqDropdownShuffle">Shuffle the choices <Toggle title="Shuffle dropdown choices" value={question.shuffleDropdowns!==false} onChange={shuffleDropdowns=>update({shuffleDropdowns})}/></div>
          </>}
          {name==="Labels"&&isLabeling&&<>
            <p className="ibqLabelHelp">Check the image to drop a Pin.</p>
            <div className="ibqLabelCanvas">
              {question.image ? <button className="ibqLabelPinStage" type="button" aria-label="Place a label pin on the image" onClick={placePin}>
                <img src={question.image} alt="Image for labeling" draggable={false}/>
                {pins.map((pin,i)=><span key={pin.id} className="ibqLabelPin" style={{left:`${pin.x}%`,top:`${pin.y}%`}}>{i+1}</span>)}
              </button> : <div className="ibqLabelMissing"><LabelAsset file="image-02.svg" size={34}/><span>Upload an image in Question and Image to position pins.</span></div>}
            </div>
            <p className="ibqLabelHelp">{pins.length} of 6 pins added. Click the image to place a pin, then type its matching label below.</p>
            <div className="ibqLabelColumns"><strong>Pin</strong><strong>Label text</strong></div>
            <div className="ibqLabelList">{pins.map((pin,i)=><div className="ibqLabelRow" key={pin.id}>
              <span className="ibqLabelNumber">{i+1}</span>
              <input type="text" maxLength={250} value={pin.label} aria-label={`Label for pin ${i+1}`} placeholder={`Label ${i+1}`} onChange={event=>updatePin(pin.id,{label:cap(event.target.value)})}/>
              <button type="button" className="ibqMatchRemove" aria-label={`Remove pin ${i+1}`} onClick={()=>update({labelPins:pins.filter(item=>item.id!==pin.id)})}><LabelAsset file="cancel-circle.svg" size={18}/></button>
            </div>)}</div>
            <div className="ibqMatchAdd"><button className="ibqMatchAddButton" type="button" disabled={!question.image||pins.length>=6} onClick={()=>addPin(20+((pins.length*14)%60),20+((pins.length*17)%60))}><LabelAsset file="plus.svg" size={20}/><span>Add options</span></button><small>2 to 6 options</small></div>
            <label className="ibqMatchExtraLabel">Extra labels that marks no pin (Optional)</label>
            {(question.labelExtras||[]).map((extra,i)=><div className="ibqMatchExtraRow" key={i}>
              <input type="text" aria-label={`Extra label ${i+1}`} maxLength={250} value={extra} placeholder="Optimizer" onChange={event=>update({labelExtras:(question.labelExtras||[]).map((value,j)=>i===j?cap(event.target.value):value)})}/>
              <button type="button" className="ibqMatchRemove" aria-label={`Remove extra label ${i+1}`} onClick={()=>update({labelExtras:(question.labelExtras||[]).filter((_,j)=>j!==i)})}><LabelAsset file="cancel-circle.svg" size={18}/></button>
            </div>)}
            <div className="ibqMatchAdd"><button className="ibqMatchAddButton" type="button" disabled={(question.labelExtras||[]).length>=6} onClick={()=>update({labelExtras:[...(question.labelExtras||[]),""]})}><LabelAsset file="plus.svg" size={20}/><span>Add Extra</span></button><small>2 to 6 options</small></div>
            <label className="ibqMatchShuffle">Shuffle the Labels <Toggle title="Shuffle labels" value={question.shuffleLabels!==false} onChange={value=>update({shuffleLabels:value})}/></label>
          </>}
          {name==="Question and Image"&&<>
            <label>Write your Question </label>
            <RichEditor label="Write your Question" rows={3} value={question.text} onChange={text=>update({text})} placeholder="Write your question..." />
            {!isSorting&&<><label>Choose an Image <span className="ibqRequired">*</span></label>
            {!isLabeling&&!isDropdown&&!isSequencing&&!isSorting&&<div className="ibqGallery">{Array.from({length:4},(_,i)=><GalleryThumb key={i} index={i} src={galleryImages[i]||""} selected={!!galleryImages[i]&&question.image===galleryImages[i]} onSelect={()=>{if(galleryImages[i])update({image:galleryImages[i]});}}/>)}</div>}
            <UploadImage title="Image" galleryMode={!isLabeling&&!isDropdown&&!isSequencing&&!isSorting} value={question.image} onChange={image=>{
              if(!isLabeling&&!isDropdown&&!isSequencing&&!isSorting){uploadGalleryImage(image);return;}
              update({image,...(image!==question.image&&isLabeling?{labelPins:[]}:{}),...(image!==question.image&&isDropdown?{dropdownSpots:[]}: {})});
            }}/>
            {question.image&&<div className="ibqSelectedImageNote"><Check size={15}/> Image selected <button type="button" onClick={()=>{
              if(!isLabeling&&!isDropdown&&!isSequencing&&!isSorting){
                const next=galleryImages.filter(src=>src!==question.image);
                update({galleryImages:next,image:next[0]||""});
                return;
              }
              update({image:"",...(isLabeling?{labelPins:[]}: {}),...(isDropdown?{dropdownSpots:[]}: {})});
            }}>Remove</button></div>}</>}
          </>}
          {name==="Answer Options"&&<>
            <p className="ibqHelper">Click on the toggle for correct answer.</p>
            <div className="ibqOptionList">{question.options.map((entry,i)=><div className="ibqOptionCard" key={i}>
              <div className="ibqOptionRow"><span className="ibqOptionIndex">{i+1}</span>
                <input type="text" aria-label={`Option ${i+1}`} maxLength={250} value={entry.text} placeholder={`Enter option ${i+1}`} onChange={e=>option(i,{text:cap(e.target.value)})}/>
                <UploadImage compact title={`option ${i+1}`} value={entry.image} fallback={question.image} onChange={image=>option(i,{image})}/>
                <div className="ibqSwitchHolder"><Toggle value={correctIndices.includes(i)} title={`Mark option ${i+1} correct`} onChange={yes=>setCorrect(i,yes)}/></div>
                <button className="ibqDelete" type="button" title={`Remove option ${i+1}`} aria-label={`Remove option ${i+1}`} onClick={()=>removeOption(i)}><X size={17}/></button>
              </div>
              <textarea aria-label={`Explanation for option ${i+1}`} rows={2} maxLength={250} value={entry.explanation||""} placeholder="Explanation for this option" onChange={e=>option(i,{explanation:cap(e.target.value)})}/>
            </div>)}</div>
            <div className="ibqOptionAdd"><button className="ibqTextButton" type="button" disabled={question.options.length>=6} onClick={()=>update({options:[...question.options,{text:"",image:"",explanation:""}]})}><Plus size={20}/><span>Add Options</span></button><small>2 to 6 options</small></div>
            <div className="ibqOptionToggles"><label>Allow more than one correct answer <Toggle title="Allow multiple correct answers" value={!!question.allowMultiple} onChange={value=>update({allowMultiple:value,correctAnswers:value?correctIndices:[],correct:value?(correctIndices[0]??-1):correctIndices[0]??-1})}/></label><label>Shuffle the Options <Toggle title="Shuffle option order" value={question.shuffleOptions!==false} onChange={value=>update({shuffleOptions:value})}/></label></div>
          </>}
          {name==="Grading Method"&&<>
            <div className="ibqGradingGrid"><label>Grading Method<select value={question.gradingMethod||"Partial credit - equal marks"} onChange={e=>update({gradingMethod:e.target.value})}><option>Partial credit - equal marks</option><option>All or nothing</option></select></label>
            <label>Points (total for Question)<select value={question.points} onChange={e=>update({points:Number(e.target.value)})}>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
            <label>Negative Marking<select value={question.negativeMarking||0} onChange={e=>update({negativeMarking:Number(e.target.value)})}><option value={0}>NA</option><option value={0.25}>0.25</option><option value={0.5}>0.5</option><option value={1}>1</option></select></label></div>
            <label className="ibqGradeFloor">Calculate grade with a minimum score of 0 <Toggle title="Minimum score of zero" value={question.minimumZero!==false} onChange={v=>update({minimumZero:v})}/></label>
          </>}
          {(name==="Feedback"||name==="Model Answer and Grader Information")&&<>
            {name==="Model Answer and Grader Information"&&<p className="ibqLabelHelp">Not shown to Learners</p>}
            <label className="ibqFeedbackLabel is-full">Full Marks </label>
            <RichEditor tone="ibqRichFull" label="Full Marks feedback" rows={3} value={question.feedbackFull??question.feedback??""} onChange={text=>update({feedbackFull:text,feedback:text})} placeholder="Feedback for correct answers"/>
            <label className="ibqFeedbackLabel is-partial">Partial Marks </label>
            <RichEditor tone="ibqRichPartial" label="Partial Marks feedback" rows={3} value={question.feedbackPartial||""} onChange={text=>update({feedbackPartial:text})} placeholder="Feedback for partially correct answers"/>
            <label className="ibqFeedbackLabel is-zero">Zero Marks </label>
            <RichEditor tone="ibqRichZero" label="Zero Marks feedback" rows={3} value={question.feedbackZero||""} onChange={text=>update({feedbackZero:text})} placeholder="Feedback for incorrect answers"/>
            <div className="ibqInnerAccordion"><button type="button" aria-expanded={extraOpen.explanation} onClick={()=>setExtraOpen(p=>({...p,explanation:!p.explanation}))}><span className="ibqSectionIcon"><ClipboardList size={17}/></span><b>Explanation</b>{(isLabeling||isDropdown||isSequencing||isSorting)?<LabelAsset file="arrow-down-01.svg" size={19} className={extraOpen.explanation?"ibqRotated":""}/>:<ChevronDown className={extraOpen.explanation?"ibqRotated":""} size={19}/>}</button>
              {extraOpen.explanation&&<RichEditor label="Explanation" rows={3} value={question.explanation} onChange={text=>update({explanation:text})} placeholder="Explain the correct answer"/>}</div>
            <div className="ibqInnerAccordion"><button type="button" aria-expanded={extraOpen.hint} onClick={()=>setExtraOpen(p=>({...p,hint:!p.hint}))}><span className="ibqSectionIcon"><MessageCircleMore size={17}/></span><b>Hint</b>{(isLabeling||isDropdown||isSequencing||isSorting)?<LabelAsset file="arrow-down-01.svg" size={19} className={extraOpen.hint?"ibqRotated":""}/>:<ChevronDown className={extraOpen.hint?"ibqRotated":""} size={19}/>}</button>
              {extraOpen.hint&&<><RichEditor label="Hint" rows={3} value={question.hint} onChange={text=>update({hint:text})} placeholder="Write a hint"/><label className="ibqHintCheck"><input className="ibqHintNative" type="checkbox" checked={question.showHintBefore!==false} onChange={e=>update({showHintBefore:e.target.checked})}/><span className="ibqHintSquare" aria-hidden="true"/><span>Show hint before answering</span></label><label className="ibqHintCheck"><input className="ibqHintNative" type="checkbox" checked={!!question.allowHintRequest} onChange={e=>update({allowHintRequest:e.target.checked})}/><span className="ibqHintSquare" aria-hidden="true"/><span>Allow learner to request hint</span></label></>}</div>
          </>}
          </div>}</div>})}
        </section>
        <div className="ibqWithinActions"><button className="ibqAccentButton" type="button" onClick={add}><Plus size={20}/>Add Questions</button><div><button className="ibqCircle" type="button" aria-label="Previous question" onClick={()=>go(active-1)} disabled={active===0}><ChevronLeft size={20}/></button><button className="ibqCircle" type="button" aria-label="Next question" onClick={()=>go(active+1)} disabled={active===count-1}><ChevronRight size={20}/></button></div></div>
        </section></div>
        <aside className="ibqAside ibqMcqAside" aria-label="Question settings and assessment summary">
          <section className="ibqAsideCard ibqMcqAsideSection">
            <h2>Question Settings</h2>
            <div className="ibqMcqField"><label htmlFor="ibqPoints">Points</label>
              <div className="ibqMcqPointsControl">
                <input id="ibqPoints" min={1} max={1000} type="number" value={question.points} onChange={e=>update({points:Math.max(1,Math.min(1000,Number(e.target.value)||1))})}/>
                <div className="ibqMcqPointSteppers">
                  <button type="button" aria-label="Increase points" onClick={()=>update({points:Math.min(1000,question.points+1)})}><LabelAsset file="arrow-down-01.svg" size={14} className="ibqMcqArrowUp"/></button>
                  <button type="button" aria-label="Decrease points" onClick={()=>update({points:Math.max(1,question.points-1)})}><LabelAsset file="arrow-down-01.svg" size={14}/></button>
                </div>
              </div>
            </div>
            <div className="ibqMcqField"><label htmlFor="ibqDifficulty">Difficulty</label><AsideNeumorphicSelect id="ibqDifficulty" title="Difficulty" value={question.difficulty} options={["Easy","Medium","Hard"]} onChange={difficulty=>update({difficulty})}/></div>
            <div className="ibqMcqField"><label htmlFor="ibqCategory">Category</label><AsideNeumorphicSelect id="ibqCategory" title="Category" value={question.category} options={["AI","Machine Learning","Deep Learning","Natural Language Processing","Computer Vision","Data Science","Cybersecurity","Cloud Computing","Programming","Database","Web Development","Software Engineering","Computer Networks","Operating Systems","Data Structures & Algorithms","Mathematics","Statistics","Science","General","Technology","Other"]} onChange={category=>update({category})}/></div>
            <div className="ibqMcqField"><label htmlFor="ibqBloom">Bloom’s Taxonomy</label><AsideNeumorphicSelect id="ibqBloom" title="Bloom’s Taxonomy" value={question.bloom} options={["Remember","Create","Evaluate","Analyze","Analyse","Apply","Understand"]} onChange={bloom=>update({bloom})}/></div>
            <div className="ibqMcqField"><label>Tag</label><div className="ibqMcqTagHolder"><button type="button" className="ibqTagAdd" onClick={()=>setTagsOpen(x=>!x)}><LabelAsset file="plus.svg" size={17}/>Add Tag</button></div>
              {tagsOpen&&<div className="ibqTagEntry"><input aria-label="New tag" placeholder="Enter tag" value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(newTag.trim())update({tags:[...question.tags.filter(x=>x!==newTag.trim()),newTag.trim()]});setNewTag("");setTagsOpen(false);}}}/><button type="button" onClick={()=>{if(newTag.trim())update({tags:[...question.tags.filter(x=>x!==newTag.trim()),newTag.trim()]});setNewTag("");setTagsOpen(false);}}>Add</button></div>}
              <div className="ibqTags">{question.tags.map(tag=><span key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={()=>update({tags:question.tags.filter(x=>x!==tag)})}><X size={13}/></button></span>)}</div>
            </div>
            <div className="ibqMandatory"><label>Mandatory</label><Toggle title="Mandatory question" value={question.mandatory} onChange={value=>update({mandatory:value})}/></div>
            <small>This Question is {question.mandatory?"Mandatory":"Optional"}</small>
          </section>
          <section className="ibqAsideCard ibqSummary ibqMcqAsideSection">
            <h2>Assessment Summary</h2>
            <div className="ibqStats"><div><b>{complete}/{count}</b><span>Questions</span></div><div><b>{questions.filter(imageQuestionValid).reduce((n,q)=>n+q.points,0)}</b><span>Marks</span></div><div><b>{(() => {try {const raw=JSON.parse(assessmentStorage.getItem("mcqAssessmentDraft")||"{}");return Math.max(1,Math.round(Number(raw.duration)||60));} catch {return 60;}})()}</b><span>Minutes</span></div></div>
            <p>Marks per Question: {count>0?(totalMarks/count).toFixed(2).replace(/\.00$/,""):"—"}</p>
            <div className="ibqMcqSummaryProgress" aria-label={`${complete} out of ${count} questions completed`}><span style={{width:`${Math.min(100,complete/Math.max(count,1)*100)}%`}}/></div>
            <p>Target is {count} questions · {totalMarks} marks. Add questions to get started.</p>
            <div className="ibqMcqField"><label htmlFor="ibqPass">Passing Score</label><AsideNeumorphicSelect id="ibqPass" title="Passing Score" value={`${passingScore}%`} options={["40%","50%","60%","70%","80%","90%"]} onChange={selected=>{const value=selected.replace("%","");setPassingScore(value);try{const draft=JSON.parse(assessmentStorage.getItem("mcqAssessmentEvaluationDraft")||"{}");assessmentStorage.setItem("mcqAssessmentEvaluationDraft",JSON.stringify({...draft,passingScore:value}));}catch{setMessage("Unable to save the passing score.");}}}/></div>
          </section>
        </aside>
      </div><div className="ibqFooter"><button type="button" onClick={()=>{try{assessmentStorage.setItem(IMAGE_CONTENT_KEY,JSON.stringify({questions,active,savedAt:new Date().toISOString()}));router.push("/assessments/create/image-based-preview");}catch{setMessage("Unable to save the preview. Please reduce image sizes.");}}}>Preview Questions</button><div>{message&&<span className={message === "Successfully saved" ? "mcqcSaveSuccessToast" : "ibqStatus"} role={message === "Successfully saved" ? "status" : "alert"}>{message}</span>}<button type="button" onClick={()=>save(false)}>Save</button><button className="ibqContinue" disabled={saving} type="button" onClick={()=>save(true)}>Continue</button></div></div></>
    </div></div></section></div>
  </main>;
}
