/** Visible catalogue and client-persisted metadata. Working UI adapters live in component-registry.ts. */
export type AssessmentTypeGroup = {heading:string;items:string[]};
export type AssessmentTypeDefinition = { code:string; label:string; category:string; implemented:boolean };
export const DEFAULT_ASSESSMENT_TYPES: AssessmentTypeDefinition[] = [
  {code:"ai-interview",label:"AI Interview",category:"Practical Assessments",implemented:true},
  {code:"problem-solving-challenge",label:"Problem-Solving Challenge",category:"Practical Assessments",implemented:true},

  {code:"assignment",label:"Assignment",category:"Practical Assessments",implemented:true},
 {code:"clickable-hotspot",label:"Clickable Hotspot",category:"Interactive Assessments",implemented:true},
 {code:"connect-the-dots",label:"Connect the Dots",category:"Interactive Assessments",implemented:true},
 {code:"true-false",label:"True / False",category:"Academic assessment",implemented:true},
 {code:"fill-in-the-blanks",label:"Fill in the Blank",category:"Academic assessment",implemented:true},
 {code:"long-answer",label:"Long Answer / Essay",category:"Academic assessment",implemented:true},
 {code:"drag-and-drop",label:"Drag & Drop",category:"Interactive Assessments",implemented:true},
 {code:"memory-game",label:"Memory Game",category:"Interactive Assessments",implemented:true},
 {code:"image-based",label:"Image-Based Assessment",category:"Multimedia Assessments",implemented:true},
 {code:"match-the-following",label:"Match the Following",category:"Interactive Assessments",implemented:true},
 {code:"mcq",label:"Multiple Choice Question (MCQ)",category:"Academic assessment",implemented:true},
 {code:"short-answer",label:"Short Answer",category:"Academic assessment",implemented:true},
 {code:"one-word",label:"One-Word Answer",category:"Academic assessment",implemented:true},
];
const TYPES_KEY="neurolxp.assessment-types.v1";
export function getAssessmentTypes():AssessmentTypeDefinition[] {
 if(typeof window==="undefined") return DEFAULT_ASSESSMENT_TYPES;
 try {
  const value=JSON.parse(localStorage.getItem(TYPES_KEY)||"null");
  if(!Array.isArray(value)) return DEFAULT_ASSESSMENT_TYPES;
  const saved = value.filter(x=>x&&typeof x.code==="string"&&typeof x.label==="string") as AssessmentTypeDefinition[];
  return [...saved.filter(x=>!DEFAULT_ASSESSMENT_TYPES.some(d=>d.code===x.code || d.label.trim().toLowerCase()===x.label.trim().toLowerCase())),...DEFAULT_ASSESSMENT_TYPES];
 }catch{return DEFAULT_ASSESSMENT_TYPES;}
}
export function registerAssessmentType(item:AssessmentTypeDefinition) {
 const types=getAssessmentTypes();
 const next=[...types.filter(t=>t.code!==item.code),item];
 localStorage.setItem(TYPES_KEY,JSON.stringify(next));
 window.dispatchEvent(new Event("neurolxp-assessments-changed"));
}
export function findAssessmentTypeByLabel(label:string) {return DEFAULT_ASSESSMENT_TYPES.find(t=>t.label.trim().toLowerCase()===label.trim().toLowerCase()) ?? getAssessmentTypes().find(t=>t.label===label);}

export const typeGroups: AssessmentTypeGroup[] = [

  { heading: "Academic assessment", items: ["Multiple Choice Question (MCQ)", "Multiple Response", "True / False", "Fill in the Blank", "One-Word Answer", "Short Answer", "Long Answer / Essay", "Numeric Response", "Formula Response", "Matrix Question", "Assertion & Reason", "Ranking Question", "Quick Quiz", "Timed Quiz", "Scenario Quiz"] },

  { heading: "Interactive Assessments", items: ["Drag & Drop", "Match the Following", "Sequence & Order", "Connect the Dots", "Clickable Hotspot", "Interactive Diagram", "Interactive Concept Map", "Puzzle Challenge", "Memory Game", "Interactive Story"] },

  { heading: "Multimedia Assessments", items: ["Image-Based Assessment", "Audio-Based Assessment", "Video-Based Assessment", "Visual Identification", "Video Response", "Audio Response", "Screen Recording Task", "Media Annotation"] },

  { heading: "Application & Practical Assessments", items: ["Case Study", "Problem-Solving Challenge", "Assignment", "Project Assessment", "Research Task", "Practical Task", "Lab Assessment", "Simulation Assessment", "Design Review", "Presentation Assessment", "Role-Play Assessment", "Oral Viva", "Product Demonstration"] },

  { heading: "Portfolio Assessments", items: ["Portfolio Assessment", "Project Showcase", "Code Portfolio", "Design Portfolio", "Research Portfolio"] },

  { heading: "Collaborative Assessments", items: ["Peer Assessment", "Self Assessment", "Group Project Assessment", "Team Challenge", "Discussion Assessment", "Debate Assessment", "Peer Review", "Collaborative Task"] },

  { heading: "Gamified Challenges", items: ["Quiz Battle", "Team Battle (quantum champ)", "Tournament", "Daily Challenge", "Weekly Challenge", "Skill Sprint", "Boss Battle", "Mission Challenge", "Escape Room", "Mystery Challenge"] },

  { heading: "AI-Powered Assessments", items: ["AI Interview", "AI Viva", "Adaptive Assessment", "AI Mentor Challenge", "AI Competency Assessment", "AI Skill Gap Assessment"] },

  { heading: "Certification & Professional Assessments", items: ["Online Exam", "Mock Exam", "Skill Evaluation", "Competency Assessment", "Certification Assessment", "Certification Renewal Assessment", "Professional Readiness Assessment", "Compliance Assessment", "Safety Assessment", "Product Knowledge Assessment", "Sales Competency Assessment"] },

  { heading: "Career & Behavioral Assessments", items: ["Communication Assessment", "Soft Skills Assessment", "Leadership Assessment", "Situational Judgment Test", "Interview Readiness Assessment", "Industry Simulation", "Client Project Assessment", "Startup Challenge", "Product Design Challenge", "Consulting Challenge"] },

];


export const createTypes = [
  { title: "Academic assessment", subtitle: "MCQ, Quiz, Short Answer....", count: 15, tone: "academic" },
  { title: "Interactive Assessments", subtitle: "Drag & Drop, Match the Following..", count: 10, tone: "interactive" },
  { title: "Multimedia Assessments", subtitle: "Image based, Video based ......", count: 8, tone: "multimedia" },
  { title: "Practical Assessments", subtitle: "Case Study, Problem-Solving.....", count: 13, tone: "practical" },
  { title: "Portfolio Assessments", subtitle: "Code Portfolio, Design Portfolio.....", count: 5, tone: "portfolio" },
  { title: "Collaborative Assessments", subtitle: "Peer Assessment, Self Assessment....", count: 8, tone: "collaborative" },
  { title: "Gamified Challenges", subtitle: "Quiz Battle, Team Battle....", count: 10, tone: "gamified" },
  { title: "AI-Powered Assessments", subtitle: "AI Interview, AI Viva....", count: 6, tone: "ai" },
  { title: "Certification Assessments", subtitle: "Online Exam, Mock Exam.....", count: 11, tone: "certification" },
  { title: "Career Assessments", subtitle: "Communication Assessment....", count: 10, tone: "career" },
];


export function getAssessmentTypeGroups(preserveOriginalDropdownLabels = false):AssessmentTypeGroup[] {
 const groups=typeGroups.map(g=>({heading:g.heading,items:g.items.map(label =>
  preserveOriginalDropdownLabels && label === "Team Battle (quantum champ)" ? "Team Battle" : label
 )}));
 for(const t of getAssessmentTypes()){
   let group=groups.find(g=>g.heading===t.category);
   if(!group){group={heading:t.category,items:[]};groups.push(group);}
   if(!group.items.includes(t.label))group.items.push(t.label);
 }
 return groups;
}
