"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2, ChevronDown, ChevronLeft, ChevronUp,
  ClipboardList, Eye, Image as PictureIcon, Pencil, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, XCircle,
} from "lucide-react";
import Sidebar from "../../common/sidebar/page";
import Header from "../../common/header/Header";
import {
  assessmentStorage, getActiveAssessmentId, getAssessment, updateAssessment,
} from "@/modules/assessments/storage/assessment-storage";
import {
  IMAGE_CONTENT_KEY, imageCorrectIndices, imageDetails,
  imageQuestionStarted, imageQuestionValid, readImageDraft,
  type ImageQuestion,
} from "./image-based-data";
import "./image-based.css";
import "./image-based-preview.css";

// Image Labeling uses the same existing assessment icon assets as the creator.
function LabelPreviewAsset({file,size=18}:{file:string;size?:number}){
  return <img className="ibqpAssetIcon" src={`/assets/assessmenticons/${file}`} alt="" width={size} height={size} aria-hidden="true" draggable={false}/>;
}
type Filter = "all" | "complete" | "incomplete";
type Fold = "grading" | "feedback" | "settings";
const CONTENT_URL = "/assessments/create/content";

function asText(value?: string): string {
  return (value || "").trim();
}
function pointLabel(n: number): string {
  return `${n} ${n === 1 ? "Point" : "Points"}`;
}
function DisplaySwitch({ on }: { on: boolean }) {
  return <span className={`ibqpSwitch ${on ? "isOn" : ""}`} aria-label={on ? "On" : "Off"}>
    <span>{on ? "ON" : "OFF"}</span><i />
  </span>;
}
function SectionTitle({ name, icon, open, onClick, count }: {
  name: string; icon: ReactNode; open?: boolean;
  onClick?: () => void; count?: string;
}) {
  return <button type="button" className="ibqpSectionTitle" onClick={onClick} aria-expanded={onClick ? !!open : undefined}>
    <span className="ibqpTitleIcon">{icon}</span><strong>{name}</strong>
    {count && <small>{count}</small>}
    {onClick && (open ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
  </button>;
}
function FeedbackItem({ tone, title, content, icon }: {
  tone: "full" | "partial" | "zero" | "normal"; title: string;
  content?: string; icon: ReactNode;
}) {
  return <div className={`ibqpFeedbackItem ibqpFeedbackItem--${tone}`}>
    <div className="ibqpFeedbackHeading"><span className="ibqpFeedbackIcon">{icon}</span><b>{title}</b></div>
    <div className="ibqpFeedbackText">{asText(content) || "—"}</div>
  </div>;
}

export default function ImageBasedPreviewQuestions() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [questions, setQuestions] = useState<ImageQuestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [learnerMode, setLearnerMode] = useState(false);
  const [chosen, setChosen] = useState<Record<string, number[]>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, Record<number,string>>>({});
  const [labelAnswers, setLabelAnswers] = useState<Record<string,Record<string,string>>>({});
  const [dropdownAnswers,setDropdownAnswers]=useState<Record<string,Record<string,string>>>({});
  const [sequenceOrders,setSequenceOrders]=useState<Record<string,string[]>>({});
  const [sortingAnswers,setSortingAnswers]=useState<Record<string,Record<string,string>>>({});
  const [fold, setFold] = useState<Record<Fold, boolean>>({ grading: true, feedback: true, settings: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); }, []);
  const [details, setDetails] = useState({ count: 20, totalMarks: 40, title: "Image-Based Assessment", course: "", passingScore: 60 });

  useEffect(() => {
    const id = getActiveAssessmentId();
    const assessment = id ? getAssessment(id) : undefined;
    if (!assessment || assessment.typeCode !== "image-based") {
      router.replace("/assessments/create");
      return;
    }
    setDetails(imageDetails());
    setQuestions(readImageDraft().questions);
    setLoaded(true);
  }, [router]);

  const completeCount = questions.filter(imageQuestionValid).length;
  const savedMarks = questions.filter(imageQuestionValid).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const allComplete = completeCount === details.count && questions.slice(0, details.count).every(imageQuestionValid);
  const marksMatch = savedMarks === details.totalMarks;
  const ready = allComplete && marksMatch;
  const entries = useMemo(() => questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => imageQuestionStarted(question))
    .filter(({ question }) => activeFilter === "all" || (activeFilter === "complete" ? imageQuestionValid(question) : !imageQuestionValid(question))),
  [questions, activeFilter]);

  const editQuestion = (index: number) => {
    try {
      const draft = readImageDraft();
      assessmentStorage.setItem(IMAGE_CONTENT_KEY, JSON.stringify({ ...draft, active: index, savedAt: new Date().toISOString() }));
    } catch { /* The current draft is still available to the editor. */ }
    router.push(CONTENT_URL);
  };
  const continueToEvaluation = () => {
    if (saving) return;
    if (!allComplete) {
      setError(`Complete all ${details.count} Image-Based questions before continuing. Currently ${completeCount} are complete.`);
      return;
    }
    if (!marksMatch) {
      setError(`The completed questions total ${savedMarks} marks, but Details requires ${details.totalMarks}. Please correct the question points.`);
      return;
    }
    try {
      const draft = readImageDraft();
      assessmentStorage.setItem(IMAGE_CONTENT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
      updateAssessment({ questions: completeCount, marks: savedMarks });
      setError(""); setSaving(true);
      saveTimer.current = window.setTimeout(() => { setSaving(false); router.push("/assessments/create/evaluation"); }, 3000);
    } catch {
      setError("Could not save the Image-Based assessment. Return to Create Questions and save the draft.");
    }
  };
  const getSequenceOrder = (q:ImageQuestion):string[] => {
    const steps = q.sequenceSteps || [];
    const ids=steps.map(step=>step.id);
    return q.shuffleSteps!==false ? [...ids].reverse() : ids;
  };
  const movePreviewSequence = (q:ImageQuestion,index:number,direction:-1|1) => {
    const current=[...(sequenceOrders[q.id] || getSequenceOrder(q))];
    const dest=index+direction;
    if(dest<0||dest>=current.length)return;
    [current[index],current[dest]]=[current[dest],current[index]];
    setSequenceOrders(previous=>({...previous,[q.id]:current}));
  };
  const chooseOption = (q: ImageQuestion, index: number) => {
    const now = chosen[q.id] || [];
    const next = q.allowMultiple ? (now.includes(index) ? now.filter(n => n !== index) : [...now, index]) : [index];
    setChosen(previous => ({ ...previous, [q.id]: next }));
  };

  if (!loaded) return null;
  return <main className={`ibqApp ibqpApp ${questions.some(q=>q.subtype === "image-labeling")?"ibqpApp--labeling":""} ${questions.some(q=>q.subtype === "image-dropdown")?"ibqpApp--dropdown":""} ${questions.some(q=>q.subtype === "image-sequencing")?"ibqpApp--sequencing":""} ${questions.some(q=>q.subtype === "image-sorting")?"ibqpApp--sorting":""} superAdminPage institutionAdminPage`}>
    <div className="dashboardLayout ibqLayout">
      <Sidebar />
      <section className="mainContent ibqMain">
        <div className="ibqHeader"><Header /></div>
        <div className="ibqScroll institutionScrollArea">
          <div className="ibqpPage pageContent institutionPageContent">
            <nav className="ibqpBreadcrumb" aria-label="Breadcrumb">
              <Link href="/assessments">Assessment</Link><span>»</span>
              <Link href="/assessments/create/details">Create Assessment</Link><span>»</span>
              <Link href={CONTENT_URL}>Create Questions</Link><span>»</span>
              <strong>Preview Questions</strong>
            </nav>

            <div className="ibqpIntro">
              <h1>Preview Questions</h1>
              <p>Review Your Questions Before Savings.</p>
            </div>
            <div className="ibqpTopRow">
              <div className="ibqpSummary">
                <div className="ibqpStat"><b>{details.count}</b><span>Questions</span></div>
                <div className="ibqpStat"><b>{details.totalMarks}</b><span>Marks</span></div>
                <div className="ibqpStat ibqpReady">
                  {ready ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  <span><b>{ready ? "Ready" : "Needs review"}</b><small>{ready ? "All good to continue" : `${completeCount}/${details.count} questions complete`}</small></span>
                </div>
              </div>
              <div className="ibqpActionsTop">
                <label className="ibqpFilter"><span className="sr-only">Filter questions</span>
                  <select value={activeFilter} onChange={event => setActiveFilter(event.target.value as Filter)}>
                    <option value="all">All Questions</option><option value="complete">Complete Questions</option><option value="incomplete">Incomplete Questions</option>
                  </select><ChevronDown size={18} />
                </label>
                <button type="button" className="ibqpLearnerButton" onClick={() => { setLearnerMode(v => !v); setChosen({}); setMatchingAnswers({}); setLabelAnswers({}); setDropdownAnswers({}); setSequenceOrders({});setSortingAnswers({}); }}>
                  <Eye size={20} /> {learnerMode ? "Admin Preview" : "Learner Preview"}
                </button>
              </div>
            </div>

            <div className="ibqpReviewPanel">
              {learnerMode && <div className="ibqpLearnerNotice"><Eye size={18} /> Learner Preview — select an answer to test the learner-facing question. Your selections are not saved.</div>}
              {entries.length === 0 ? <div className="ibqpEmpty">
                <PictureIcon size={32} /><h2>No questions to display</h2>
                <p>{questions.some(imageQuestionStarted) ? "No questions match your filter." : "Create an Image-Based question to see it here."}</p>
                <button type="button" onClick={() => router.push(CONTENT_URL)}>Back to Question</button>
              </div> : entries.map(({ question: q, index }) => {
                const valid = imageQuestionValid(q);
                const selected = chosen[q.id] || [];
                const correct = imageCorrectIndices(q);
                return <article className="ibqpQuestion" key={q.id || index}>
                  {!learnerMode && <div className="ibqpQuestionMeta">
                    <span>Image based : {pointLabel(q.points)}</span>
                    <span>Status : <b className={valid ? "ibqpSuccess" : "ibqpDanger"}>{valid ? "Complete" : "Incomplete"}</b></span>
                    <button type="button" onClick={() => editQuestion(index)}><Pencil size={16} /> Edit</button>
                  </div>}
                  <section className="ibqpQuestionText">
                    <h2>Questions {index + 1}</h2>
                    <p>{asText(q.text) || "Question text is missing"}</p>
                  </section>
                  {q.subtype === "image-sorting" ? <section className="ibqpPanelSection ibqpSortingSection">
                    <SectionTitle name="Drag Items" icon={<LabelPreviewAsset file="chart-02.svg" size={18}/>}/>
                    <div className="ibqpSortingBody">
                      <div className="ibqpSortingList">
                        {(q.shuffleSorting!==false?[...(q.sortingItems||[])].reverse():(q.sortingItems||[])).map((item,i)=><div className="ibqpSortingRow" key={item.id}>
                          <div className="ibqpSortingPicture"><b>{String.fromCharCode(65+i)}.</b><span>{item.image?<img src={item.image} alt={`Sorting item ${i+1}`}/>:<PictureIcon size={22}/>}</span></div>
                          <div className="ibqpSortingText">{item.text||`Item ${i+1}`}</div>
                          <div className="ibqpSortingChoices" role="group" aria-label={`Sort ${item.text||`item ${i+1}`} into group`}>
                            {(q.sortingGroups||["Hardware","Software"]).map((group,j)=><button key={j} type="button" className={sortingAnswers[q.id]?.[item.id]===group?"is-selected":""} aria-pressed={sortingAnswers[q.id]?.[item.id]===group} onClick={()=>setSortingAnswers(previous=>({...previous,[q.id]:{...(previous[q.id]||{}),[item.id]:group}}))}><span className="ibqpSortingChoiceLabel">{group}</span></button>)}
                          </div>
                        </div>)}
                      </div>
                      <div className="ibqpSortingShuffle">Shuffle the Steps for learners <DisplaySwitch on={q.shuffleSorting!==false}/></div>
                      {learnerMode&&<p className="ibqpSortingStatus" role="status">{(q.sortingItems||[]).filter(item=>sortingAnswers[q.id]?.[item.id]===item.group).length} of {(q.sortingItems||[]).length} items sorted correctly.</p>}
                    </div>
                  </section> : q.subtype === "image-sequencing" ? <section className="ibqpPanelSection ibqpSequenceSection">
                    <SectionTitle name="Drag Items" icon={<LabelPreviewAsset file="chart-02.svg" size={18}/>}/>
                    <div className="ibqpSequenceBody">
                      <div className="ibqpSequenceList">
                        {(sequenceOrders[q.id]||getSequenceOrder(q)).map((stepId,i)=>{
                          const step=(q.sequenceSteps||[]).find(v=>v.id===stepId);
                          if(!step) return null;
                          return <div className="ibqpSequenceRow" key={step.id}>
                            <div className="ibqpSequencePicture"><b>{String.fromCharCode(65+i)}.</b><span>{step.image?<img src={step.image} alt={`Sequence step ${i+1}`}/>:<PictureIcon size={22}/>}</span></div>
                            <span className="ibqpSequenceText">{step.text||`Step ${i+1}`}</span>
                            <div className="ibqpSequenceOrder"><button type="button" disabled={i===0} onClick={()=>movePreviewSequence(q,i,-1)} aria-label={`Move ${step.text||`step ${i+1}`} up`}><LabelPreviewAsset file="arrow-up-big.svg" size={28}/></button><button type="button" disabled={i===(q.sequenceSteps||[]).length-1} onClick={()=>movePreviewSequence(q,i,1)} aria-label={`Move ${step.text||`step ${i+1}`} down`}><LabelPreviewAsset file="arrow-down-big.svg" size={28}/></button></div>
                          </div>;
                        })}
                      </div>
                      <div className="ibqpSequenceShuffle">Shuffle the Steps for learners <DisplaySwitch on={q.shuffleSteps!==false}/></div>
                      {learnerMode&&<p className="ibqpSequenceStatus" role="status">{(sequenceOrders[q.id]||getSequenceOrder(q)).every((id,i)=>id===(q.sequenceSteps||[])[i]?.id) ? "Correct order!" : "Use the up/down buttons to arrange the steps in the correct order."}</p>}
                    </div>
                  </section> : q.subtype === "image-dropdown" ? <section className="ibqpPanelSection ibqpDropdownSection">
                    <SectionTitle name="Question and Image" icon={<LabelPreviewAsset file="image-02.svg" size={18}/>} />
                    <div className="ibqpDropdownBody">
                      <div className="ibqpDropdownFrame">
                        <div className="ibqpDropdownStage">
                          {q.image ? <img src={q.image} alt={`Diagram for question ${index+1}`} />:<div className="ibqpMissingImage">No image uploaded</div>}
                          {(q.dropdownSpots||[]).map((spot,i)=>{
                            const values=q.shuffleDropdowns!==false?[...spot.choices].reverse():spot.choices;
                            return <label className="ibqpDropdownOnImage" style={{left:`clamp(80px, ${spot.x}%, calc(100% - 80px))`,top:`clamp(20px, ${spot.y}%, calc(100% - 20px))`}} key={spot.id}>
                              <span className="sr-only">Dropdown {i+1} on the picture</span>
                              <select aria-label={`Dropdown ${i+1} on the picture`} value={dropdownAnswers[q.id]?.[spot.id]||""} onChange={e=>setDropdownAnswers(prev=>({...prev,[q.id]:{...(prev[q.id]||{}),[spot.id]:e.target.value}}))}>
                                <option value="">Choose...</option>
                                {values.map(choice=><option key={choice.id} value={choice.id}>{choice.text}</option>)}
                              </select>
                              <LabelPreviewAsset file="arrow-down-01.svg" size={19}/>
                            </label>;
                          })}
                        </div>
                      </div>
                      <div className="ibqpDropdownShuffle">Shuffle the choices <DisplaySwitch on={q.shuffleDropdowns!==false}/></div>
                      {learnerMode && (q.dropdownSpots||[]).length>0&&<div className="ibqpDropdownProgress" role="status">{(q.dropdownSpots||[]).filter(spot=>!!dropdownAnswers[q.id]?.[spot.id]).length} of {(q.dropdownSpots||[]).length} choices selected.</div>}
                    </div>
                  </section> : q.subtype === "image-labeling" ? <section className="ibqpPanelSection ibqpLabelingSection">
                    <SectionTitle name="Question and Image" icon={<LabelPreviewAsset file="image-02.svg" size={18}/>} />
                    <div className="ibqpLabelingBody">
                      <div className="ibqpLabelingStage">
                        {q.image ? <img src={q.image} alt={`Labeling diagram for question ${index+1}`} /> : <div className="ibqpMissingImage"><PictureIcon size={35}/> Missing image</div>}
                        {(q.labelPins || []).map((pin,i)=><span key={pin.id} className="ibqpLabelPin" style={{left:`${pin.x}%`,top:`${pin.y}%`}}>{i+1}</span>)}
                      </div>
                      <div className="ibqpLabelChoices">
                        {(q.labelPins || []).map((pin,i)=>{
                          const all=[...(q.labelPins||[]).map(p=>p.label),...(q.labelExtras||[])];
                          const options=q.shuffleLabels!==false?[...all].reverse():all;
                          const selectedLabel=labelAnswers[q.id]?.[pin.id]||"";
                          return <label className="ibqpLabelChoice" key={pin.id}>
                            <span className="ibqpLabelChoiceNo">{i+1}</span>
                            <select aria-label={`Choose label for pin ${i+1}`} value={selectedLabel} onChange={e=>setLabelAnswers(prev=>({...prev,[q.id]:{...(prev[q.id]||{}),[pin.id]:e.target.value}}))}>
                              <option value="">Choose Label</option>
                              {options.map((name,j)=><option key={`${name}-${j}`} value={name}>{name}</option>)}
                            </select>
                          </label>;
                        })}
                      </div>
                      <div className="ibqpMatchingShuffle">Shuffle the Labels <DisplaySwitch on={q.shuffleLabels!==false}/></div>
                      {learnerMode&&(q.labelPins||[]).length>0&&<div className="ibqpLabelResult" role="status">
                        {(q.labelPins||[]).every(pin=>labelAnswers[q.id]?.[pin.id]===pin.label) ? "All labels are correct!" : "Choose a matching label for each pin."}
                      </div>}
                    </div>
                  </section> : q.subtype === "image-matching" ? <section className="ibqpPanelSection ibqpMatchingSection">
                    <SectionTitle name="Picture and matching text" icon={<SlidersHorizontal size={18}/>} />
                    <div className="ibqpMatchingBody">
                      <div className="ibqpMatchingHead"><b>Image</b><b>Matching Word</b></div>
                      {(q.matchPairs||[]).map((pair,i)=> {
                        const allChoices=[...(q.matchPairs||[]).map(p=>p.text),...(q.matchExtras||[])];
                        const choices=q.shuffleTexts!==false ? [...allChoices].reverse() : allChoices;
                        return <div className="ibqpMatchingRow" key={i}>
                          <span className="ibqpMatchingImage"><b>{String.fromCharCode(65+i)}.</b><span>{pair.image?<img src={pair.image} alt={`Matching image ${i+1}`}/>:<PictureIcon size={22}/>}</span></span>
                          <label><span className="ibqpApp sr-only">Matching word for image {String.fromCharCode(65+i)}</span><select aria-label={`Matching word for image ${String.fromCharCode(65+i)}`} value={matchingAnswers[q.id]?.[i]||""} onChange={e=>setMatchingAnswers(prev=>({...prev,[q.id]:{...(prev[q.id]||{}),[i]:e.target.value}}))}><option value="">Choose...</option>{choices.map((text,j)=><option key={`${text}-${j}`} value={text}>{text}</option>)}</select></label>
                        </div>;
                      })}
                      <div className="ibqpMatchingShuffle">Shuffle the texts <DisplaySwitch on={q.shuffleTexts!==false}/></div>
                    </div>
                  </section> : <section className="ibqpQuestionImage">
                    <SectionTitle name="Question and Image" icon={<PictureIcon size={18} />} />
                    <div className="ibqpImageStage">{q.image ? <img src={q.image} alt={`Image for question ${index + 1}`} /> : <div className="ibqpMissingImage"><PictureIcon size={35} /><span>No image selected</span></div>}</div>
                    <div className="ibqpOptionGrid">{q.options.map((option, optionIndex) => {
                      const isChosen = selected.includes(optionIndex);
                      return <button key={optionIndex} type="button" className={`ibqpAnswer ${isChosen ? "isChosen" : ""}`} onClick={() => learnerMode && chooseOption(q, optionIndex)} disabled={!learnerMode}>
                        <span className={`ibqpRadio ${isChosen ? "isSelected" : ""}`} />
                        <span>{String.fromCharCode(65 + optionIndex)}. {asText(option.text) || "Untitled option"}</span>
                        {option.image && <img src={option.image} alt="" />}
                      </button>;
                    })}</div>
                    {!learnerMode && <div className="ibqpOptionsSettings">
                      <div><b>Allow more than one correct answer</b><label>More than one answer permission <DisplaySwitch on={!!q.allowMultiple} /></label></div>
                      <div><b>Shuffle</b><label>Shuffle Options <DisplaySwitch on={q.shuffleOptions !== false} /></label></div>
                    </div>}
                  </section>}
                  {!learnerMode && <>
                    <section className="ibqpPanelSection">
                      <SectionTitle name="Grading Method" icon={(q.subtype === "image-labeling" || q.subtype === "image-dropdown" || q.subtype === "image-sequencing") ? <LabelPreviewAsset file="clipboard-check.svg" size={19}/> : <ClipboardList size={19} />} open={fold.grading} onClick={() => setFold(p => ({ ...p, grading: !p.grading }))} />
                      {fold.grading && <div className="ibqpGradingBody">
                        <div className="ibqpGradingFields">
                          <div><label>Grading Method</label><span>{q.gradingMethod || q.grading || "Partial credit - equal marks"}<ChevronDown size={16} /></span></div>
                          <div><label>Points (total for Question)</label><span>{q.points}<ChevronDown size={16} /></span></div>
                          <div><label>Negative Marking</label><span>{q.negativeMarking || "NA"}<ChevronDown size={16} /></span></div>
                        </div>
                        <div className="ibqpGradeFloor">Calculate grade with a minimum score of 0 <DisplaySwitch on={q.minimumZero !== false} /></div>
                      </div>}
                    </section>
                    <section className="ibqpPanelSection">
                      <SectionTitle name={q.subtype === "image-matching" || q.subtype === "image-labeling" || q.subtype === "image-dropdown" || q.subtype === "image-sequencing" || q.subtype === "image-sorting" ? "Feedback and Learning" : "Feedback"} icon={(q.subtype === "image-labeling" || q.subtype === "image-dropdown" || q.subtype === "image-sequencing") ? <LabelPreviewAsset file="message-circle-more.svg" size={18}/> : <ShieldCheck size={18} />} count={`${(q.feedbackFull || q.feedback || "").length}/250`} open={fold.feedback} onClick={() => setFold(p => ({ ...p, feedback: !p.feedback }))} />
                      {fold.feedback && <div className="ibqpFeedbackList">
                        <FeedbackItem tone="full" title="Full Marks" content={q.feedbackFull || q.feedback} icon={<CheckCircle2 size={19} />} />
                        <FeedbackItem tone="partial" title="Partial Marks" content={q.feedbackPartial} icon={<Target size={19} />} />
                        <FeedbackItem tone="zero" title="Zero Marks" content={q.feedbackZero} icon={<XCircle size={19} />} />
                        <FeedbackItem tone="normal" title="Explanation" content={q.explanation} icon={<ClipboardList size={18} />} />
                        <FeedbackItem tone="normal" title="Hint" content={q.hint} icon={<Sparkles size={18} />} />
                      </div>}
                    </section>
                    <section className="ibqpPanelSection">
                      <SectionTitle name="Question Settings" icon={(q.subtype === "image-labeling" || q.subtype === "image-dropdown" || q.subtype === "image-sequencing") ? <LabelPreviewAsset file="tag-01.svg" size={19}/> : <SlidersHorizontal size={19} />} open={fold.settings} onClick={() => setFold(p => ({ ...p, settings: !p.settings }))} />
                      {fold.settings && <div className="ibqpQuestionSettings">
                        <div><label>Difficulty</label><span><LabelPreviewAsset file="target-01.svg" size={20}/>{q.difficulty || "—"}</span></div>
                        <div><label>Blooms Taxonomy</label><span><LabelPreviewAsset file="brain.svg" size={20}/>{q.bloom || "—"}</span></div>
                        <div><label>Category</label><span><LabelPreviewAsset file="folder-03.svg" size={20}/>{q.category || "—"}</span></div>
                        <div><label>Tags</label><span><LabelPreviewAsset file="tag-01.svg" size={20}/>{q.tags?.join(", ") || "—"}</span></div>
                        <div><label>Mandatory</label><span className="ibqpMandatory"><LabelPreviewAsset file="checkmark-circle-02.svg" size={20}/>{q.mandatory ? "YES" : "NO"}</span></div>
                      </div>}
                    </section>
                  </>}
                </article>;
              })}
              {error && <p className="ibqpError" role="alert">{error}</p>}
              <div className="ibqpFooter">
                <button type="button" onClick={() => router.push(CONTENT_URL)}><ChevronLeft size={18} /> Back to Question</button>
                {saving && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>;
}
