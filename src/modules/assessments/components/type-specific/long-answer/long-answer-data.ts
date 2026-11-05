export type RubricLevel={id:string;title:string;points:string;description:string};
export type RubricCriterion={id:string;title:string;description:string;levels:RubricLevel[]};
export type LongQuestion={
  id:string;type:"Long Answer";text:string;points:string;difficulty:string;category:string;bloom:string;
  tags:string[];mandatory:boolean;responseFormat:""|"Plain Text"|"Rich Text";
  editorHtml?:Record<string,string>;
  inputBoxLines:string;minWords:string;maxWords:string;maxCharacters:string;responseRequired:boolean;
  answerPlaceholder:string;modelAnswer:string;graderInfo:string;criteria:RubricCriterion[];
  rubricTotalPoints:boolean;rubricLearnerView:boolean;rubricCriterionDescription:boolean;
  rubricPointsVisible:boolean;rubricGraderComments:boolean;rubricCriterionScore:boolean;rubricHideUntilGraded:boolean;
  feedbackFull:string;feedbackPartial:string;feedbackZero:string;explanation:string;hint:string;
  hintBefore:boolean;hintOnRequest:boolean;
  gradingMethod?:""|"Equal Marks"|"Custom";negativeMarking?:string;partialCredit?:boolean;minimumZero?:boolean;scoreOverrides?:Record<string,string>;
};
export type LongAnswerContentDraft={questions:LongQuestion[];active?:number};
export const newId=()=>Math.random().toString(36).slice(2,10);
export const newLevel=(index:number):RubricLevel=>({id:newId(),title:"",points:"",description:""});
export const newCriterion=():RubricCriterion=>({id:newId(),title:"",description:"",levels:[newLevel(0),newLevel(1),newLevel(2)]});
export const newLongQuestion=(points=""):LongQuestion=>({
 id:newId(),type:"Long Answer",text:"",points,difficulty:"",category:"",bloom:"",tags:[],mandatory:true,
 responseFormat:"",inputBoxLines:"",minWords:"",maxWords:"",maxCharacters:"",responseRequired:true,
 gradingMethod:"",negativeMarking:"",editorHtml:{},
 answerPlaceholder:"",modelAnswer:"",graderInfo:"",criteria:[newCriterion()],
 rubricTotalPoints:true,rubricLearnerView:true,rubricCriterionDescription:true,rubricPointsVisible:true,
 rubricGraderComments:true,rubricCriterionScore:true,rubricHideUntilGraded:false,
 feedbackFull:"",feedbackPartial:"",feedbackZero:"",explanation:"",hint:"",hintBefore:true,hintOnRequest:false,
});
export const categories=["AI","Machine Learning","Deep Learning","Data Science","Programming","Computer Networks","Other"];
export const blooms=["Remember","Understand","Apply","Analyze","Evaluate","Create"];
export function loadLongDraft(raw:string|null):LongAnswerContentDraft{
 try {
  const saved:unknown=raw?JSON.parse(raw):null;
  if(!saved||typeof saved!=="object"||!Array.isArray((saved as LongAnswerContentDraft).questions))return {questions:[]};
  const data=saved as LongAnswerContentDraft;
  return {active:data.active??0,questions:data.questions.map(q=>({...newLongQuestion(),...q,
    type:"Long Answer" as const,
    gradingMethod:q.gradingMethod ?? "Equal Marks",
    criteria:Array.isArray(q.criteria)?q.criteria.map(c=>({...newCriterion(),...c,levels:Array.isArray(c.levels)?c.levels:[]})):[newCriterion()],
    tags:Array.isArray(q.tags)?q.tags:[],
  }))};
 }catch{return {questions:[]};}
}
export function validLongQuestion(q:LongQuestion):string[]{
 const issues:string[]=[];
 if(!q.text.trim())issues.push("Enter the question text.");
 if(!Number.isFinite(Number(q.points))||Number(q.points)<=0)issues.push("Enter question points greater than zero.");
 if(!q.difficulty)issues.push("Select a difficulty.");
 if(!q.category)issues.push("Select a category.");
 if(!q.bloom)issues.push("Select Bloom's Taxonomy.");
 if(!q.responseFormat)issues.push("Select a response format.");
 if(!q.inputBoxLines)issues.push("Select the input box size.");
 if(!q.gradingMethod)issues.push("Select a grading method.");
 const min=Number(q.minWords),max=Number(q.maxWords),characters=Number(q.maxCharacters);
 if(!q.minWords.trim()||!q.maxWords.trim()||!(Number.isFinite(min)&&min>=0&&Number.isFinite(max)&&max>0&&max>=min))issues.push("Set a valid minimum and maximum word limit.");
 if(!Number.isFinite(characters)||characters<1)issues.push("Enter a valid maximum character limit.");
 if(!q.modelAnswer.trim())issues.push("Enter a model answer.");
 if(!q.criteria.length)issues.push("Add at least one grading criterion.");
 q.criteria.forEach((c,index)=>{
  if(!c.title.trim())issues.push(`Enter the title for Criterion ${index+1}.`);
 });
 return issues;
}
