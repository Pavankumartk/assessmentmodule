"use client";

import { useState, type ReactNode } from "react";
import { isMemoryComplete, type MemoryQuestion } from "./model";

// ICONS: These are existing shared icon files. Replace them only under public/assets/assessmenticons/.
const ICON_ROOT = "/assets/assessmenticons/";
const ICON = { down: "arrow-down-01.svg", edit: "edit.svg", view: "view.svg", grading: "clipboard-list.svg", feedback: "message-02.svg", hint: "idea.svg", correct: "checkmark-circle.svg", image: "image.svg", cards: "adjust-position.svg", question: "quiz.svg", explanation: "idea.svg", difficulty: "target.svg", category: "folder.svg", tag: "tag.svg", mandatory: "circle-check.svg", wrong: "checkcircle red.svg", partial: "alert.svg" };
const I = ({ name, size = 18 }: { name: keyof typeof ICON; size?: number }) => <img src={`${ICON_ROOT}${ICON[name]}`} width={size} height={size} alt="" aria-hidden="true" />;

type Props = {
  breadcrumb: ReactNode;
  questions: MemoryQuestion[];
  onBack: () => void;
  onEdit: (index: number) => void;
  onContinue: () => void;
  notice?: string;
  saving: boolean;
};
function Inset({ children }: { children: ReactNode }) { return <div className="memPrevInset">{children}</div>; }
function PreviewToggle({ value }: { value: boolean }) { return <span className={`memPrevToggle ${value ? "active" : ""}`}>{value ? "ON" : "OFF"}<i /></span>; }
function PreviewAccordion({ heading, icon, open, onToggle, children }: { heading: string; icon?: keyof typeof ICON; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="memPrevAccordion"><button className="memPrevAccordionHeading" type="button" aria-expanded={open} onClick={onToggle}>
    <span className="memPrevHeadingTitle">{icon && <span className="memPrevHeadingIcon"><I name={icon} size={17} /></span>}<strong>{heading}</strong></span>
    <span className={open ? "memPrevArrowOpen" : ""}><I name="down" size={22} /></span>
  </button>{open && <div className="memPrevAccordionBody">{children}</div>}</section>;
}

export default function MemoryGamePreview({ breadcrumb, questions, onBack, onEdit, onContinue, notice, saving }: Props) {
  const [filter, setFilter] = useState("All Questions");
  const [learnerPreview, setLearnerPreview] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState({ cards: true, grading: true, feedback: true, settings: true });
  const completed = questions.filter(isMemoryComplete).length;
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const visible = questions.map((question, index) => ({ question, index })).filter(({ question }) => filter === "All Questions" || (filter === "Complete" ? isMemoryComplete(question) : !isMemoryComplete(question)));
  const toggle = (key: keyof typeof expanded) => setExpanded(old => ({ ...old, [key]: !old[key] }));
  const toggleReveal = (id: string) => setRevealed(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);

  return <section className="memPrevPage">
    {breadcrumb}
    <header className="memPrevTop"><h1>Preview Questions</h1><p>Review Your Questions Before Saving.</p></header>
    <div className="memPrevControls"><div className="memPrevSummary"><Inset><strong>{questions.length}</strong><span>Questions</span></Inset><Inset><strong>{totalMarks}</strong><span>Marks</span></Inset><div className="memPrevReadiness"><I name="correct" size={24} /><div><strong>{completed === questions.length ? "Ready" : "Needs Attention"}</strong><span>{completed === questions.length ? "All good to continue" : `${completed} of ${questions.length} complete`}</span></div></div></div>
      <div className="memPrevTools"><label className="memPrevFilter"><span className="memSrOnly">Filter questions</span><select value={filter} onChange={e => setFilter(e.target.value)}><option>All Questions</option><option>Complete</option><option>Needs Attention</option></select><I name="down" size={15} /></label><button type="button" className={`memPrevLearnerButton ${learnerPreview ? "selected" : ""}`} onClick={() => { setLearnerPreview(v => !v); setRevealed([]); }}><I name="view" size={18} /> {learnerPreview ? "Creator Preview" : "Learner Preview"}</button></div>
    </div>
    {visible.length === 0 ? <div className="memPrevEmpty">No questions match the selected filter.</div> : visible.map(({ question: q, index }) => {
      const cards = q.pairs.flatMap((pair, p) => [
        { id: `${q.id}-${p}-a`, value: pair.left, image: pair.leftImage || "", pair: p },
        { id: `${q.id}-${p}-b`, value: pair.right, image: pair.rightImage || "", pair: p }
      ]);
      return <article key={q.id} className="memPrevQuestion">
        <div className="memPrevQuestionTop"><span>Memory Game: {q.points} Points</span><span>Status: <strong className={isMemoryComplete(q) ? "memPrevGreen" : "memPrevRed"}>{isMemoryComplete(q) ? "Complete" : "Needs Attention"}</strong></span><button type="button" onClick={() => onEdit(index)}><I name="edit" size={16} /> Edit</button></div>
        <div className="memPrevSection"><h2>Questions {index + 1}</h2><Inset>{q.text || "Question not entered"}</Inset>{q.image && <img className="memPrevQuestionImage" alt="Question attachment" src={q.image} />}</div>
        <PreviewAccordion heading="Add pictures to cards" icon="cards" open={expanded.cards} onToggle={() => toggle("cards")}>
          <div className="memPrevBoard"><div className="memPrevCardGrid" style={{ gridTemplateColumns: `repeat(${q.columns && q.columns !== "Auto" ? Math.max(2, Math.min(6, Number(q.columns) || 4)) : 4}, minmax(0, 1fr))` }}>
            {cards.map(card => {
              const faceUp = !learnerPreview || revealed.includes(card.id);
              return <button type="button" key={card.id} className={`memPrevCard ${!faceUp ? "isHidden" : ""} ${faceUp && card.image ? "hasImage" : ""}`} onClick={() => { if (learnerPreview) toggleReveal(card.id); }} title={learnerPreview ? "Flip card" : "Card preview"}>
                {faceUp ? card.image ? <img src={card.image} alt={`${card.value || "Memory"} card`} /> : <span>{card.value || <I name="image" size={25} />}</span> : <span className="memPrevCardBack">?</span>}
              </button>;
            })}
          </div></div>
          <div className="memPrevSettings"><h3>Game Settings</h3><div className="memPrevSettingsGrid">
            <div><label>Columns</label><Inset>{q.columns || "Auto"}</Inset></div><div><label>Card Back Colour</label><Inset>{q.cardBackColor || "Blue"}</Inset></div><div><label>Shuffle</label><Inset>Shuffle Cards <PreviewToggle value={q.shuffle} /></Inset></div>
            <div><label>Peek At start (seconds)</label><Inset>{q.showCardsSeconds}</Inset></div><div><label>Flip back delay (MS)</label><Inset>{q.flipBackDelay || "1000"}</Inset></div><div><label>Time Limit</label><Inset>{q.timeLimit || "0"}</Inset></div>
            <div><label>Maximum Move</label><Inset>Show move Counter <PreviewToggle value={q.showMoveCounter ?? true} /></Inset></div><div><label>Timer</label><Inset>Show Timer <PreviewToggle value={q.showTimer ?? true} /></Inset></div>
          </div></div>
        </PreviewAccordion>
        <PreviewAccordion heading="Grading Method" icon="grading" open={expanded.grading} onToggle={() => toggle("grading")}>
          <div className="memPrevSettingsGrid"><div><label>Grading Method</label><Inset>{q.grading === "All or Nothing" ? "Equal Marks" : q.grading}</Inset></div><div><label>Points (total for Question)</label><Inset>{q.points}</Inset></div><div><label>Negative Marking</label><Inset>{q.negativeMarking || "NA"}</Inset></div></div>
          <div className="memPrevToggleSetting"><span>Clicks outside every hotspot count as wrong</span><PreviewToggle value={q.clicksCountWrong ?? true} /></div><div className="memPrevToggleSetting"><span>Calculate grade with a minimum score of 0</span><PreviewToggle value={q.minimumScoreZero ?? true} /></div>
        </PreviewAccordion>
        <PreviewAccordion heading="Feedback and Learning" open={expanded.feedback} onToggle={() => toggle("feedback")}>
          {([{ name: "Full Marks", key: "feedbackFull", style: "green" }, { name: "Partial Marks", key: "feedbackPartial", style: "orange" }, { name: "Zero Marks", key: "feedbackZero", style: "red" }, { name: "Explanation", key: "explanation", style: "neutral" }, { name: "Hint", key: "hint", style: "neutral" }] as const).map(item => <div key={item.key} className={`memPrevFeedbackItem memPrevFeedback-${item.style}`}><h4 className={item.style}><span className="memPrevMiniCircle"><I name={item.key === "hint" ? "hint" : item.key === "explanation" ? "explanation" : item.key === "feedbackZero" ? "wrong" : item.key === "feedbackPartial" ? "partial" : "correct"} size={16} /></span>{item.name}</h4>{item.style === "neutral" ? <p className="memPrevPlainFeedback">{q[item.key] || "—"}</p> : <Inset>{q[item.key] || "—"}</Inset>}</div>)}
        </PreviewAccordion>
        <PreviewAccordion heading="Question Settings" open={expanded.settings} onToggle={() => toggle("settings")}>
          <div className="memPrevSettingsGrid memPrevQuestionSettings"><div><label>Difficulty</label><Inset><span className="memPrevIconValue"><I name="difficulty" size={18} />{q.difficulty}</span></Inset></div><div><label>Blooms Taxonomy</label><Inset><span className="memPrevIconValue"><I name="grading" size={18} />{q.bloom || "—"}</span></Inset></div><div><label>Category</label><Inset><span className="memPrevIconValue"><I name="category" size={18} />{q.category || "—"}</span></Inset></div><div><label>Tags</label><Inset><span className="memPrevIconValue"><I name="tag" size={18} />{q.tags.join(", ") || "—"}</span></Inset></div><div><label>Mandatory</label><Inset><span className="memPrevIconValue"><I name="mandatory" size={18} />{q.mandatory ? "YES" : "NO"}</span></Inset></div></div>
        </PreviewAccordion>
      </article>;
    })}
    {notice && <p role="alert" className="memNotice">{notice}</p>}
    <footer className="memPrevFooter"><button type="button" onClick={onBack}>Back to Question</button>{saving && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}</footer>
  </section>;
}
