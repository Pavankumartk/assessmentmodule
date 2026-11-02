#!/usr/bin/env node
"use strict";
/** Canonical AI Interview naming + routing only. Never rewrites other assessment entries. */
const fs = require('node:fs');
const path = require('node:path');
const argv = process.argv.slice(2);
const root = path.resolve(argv.find(arg => !arg.startsWith('--')) || '.');
const mode = argv.includes('--verify') ? 'verify' : argv.includes('--check') ? 'check' : 'apply';
const base = 'src/modules/assessments';
const aiDir = `${base}/components/type-specific/ai-interviews-and-quizzes`;
const locations = {
  catalogue: `${base}/config/assessment-types.ts`,
  registry: `${base}/config/component-registry.ts`,
  form: `${base}/components/common/AssessmentForm.tsx`,
  entry: `${base}/components/common/AssessmentContentEntry.tsx`,
  route: 'src/app/assessments/[assessmentId]/viewer/PageClient.tsx',
  creator: `${aiDir}/Content.tsx`,
  learner: `${aiDir}/Viewer.tsx`,
  selection: `${aiDir}/AIInterviewSelectionActivator.tsx`,
};
const stop = (message) => { console.error('STOPPED: ' + message); console.error('No changes applied.'); process.exit(1); };
const before = {}, after = {};
for (const [name, rel] of Object.entries(locations)) {
  const location = path.join(root, rel);
  if (!fs.existsSync(location)) stop(`Missing ${rel}. Install the AI Interview integration package first.`);
  before[name] = fs.readFileSync(location, 'utf8'); after[name] = before[name];
}
const escapeRE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function findMatching(source, position, open = '{') {
  const close = open === '{' ? '}' : ']';
  let depth=0, quote='', escape=false, line=false, block=false;
  for(let i=position;i<source.length;i++) {
    const c=source[i], n=source[i+1];
    if(line) { if(c==='\n') line=false; continue; }
    if(block) { if(c==='*'&&n==='/'){block=false;i++;} continue; }
    if(quote) { if(escape){escape=false;continue;} if(c==='\\'){escape=true;continue;} if(c===quote)quote=''; continue; }
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c===open) depth++;
    if(c===close && --depth===0) return i;
  }
  throw Error(`Unbalanced ${open} in source`);
}
function declaration(source,name,open='{') {
  const regexp=new RegExp('\\b(?:export\\s+)?const\\s+'+escapeRE(name)+'\\b[^=]*=\\s*\\'+open);
  const m=regexp.exec(source); if(!m) throw Error(`Cannot safely find ${name} in shared source`);
  const at=m.index+m[0].length-1;
  const end=findMatching(source,at,open);
  return {at,end,body:source.slice(at+1,end)};
}
function editEntry(source,mapName,key,newValue) {
  const p=declaration(source,mapName,'{'); let body=p.body;
  const lookup = new RegExp(`(?:["']${escapeRE(key)}["']|\\b${escapeRE(key)}\\b)\\s*:\\s*`, 'g');
  const matches=[...body.matchAll(lookup)];
  if(matches.length>1) throw Error(`Duplicate ${key} entries in ${mapName}; refusing unsafe edit`);
  if(matches.length===0) body=`\n  ${JSON.stringify(key)}: ${newValue},`+body;
  else {
    const start=matches[0].index+matches[0][0].length, char=body[start];
    if(char!=='{') throw Error(`${mapName}.${key} has a non-object value; cannot safely edit`);
    const end=findMatching(body,start,'{');
    if(body.slice(start,end+1)!==newValue) body=body.slice(0,start)+newValue+body.slice(end+1);
  }
  return source.slice(0,p.at+1)+body+source.slice(p.end);
}
function editArrayEntry(source,name,key,newValue) {
  const p=declaration(source,name,'{'); let body=p.body;
  const lookup=new RegExp(`["']${escapeRE(key)}["']\\s*:\\s*`, 'g');
  const matches=[...body.matchAll(lookup)];
  if(matches.length>1)throw Error(`${name} has duplicated ${key}; stop`);
  if(!matches.length)body=`\n  ${JSON.stringify(key)}: ${newValue},`+body;
  else {
    const start=matches[0].index+matches[0][0].length;
    if(body[start]!=='[') throw Error(`${name}.${key} expected an array`);
    const end=findMatching(body,start,'[');
    body=body.slice(0,start)+newValue+body.slice(end+1);
  }
  return source.slice(0,p.at+1)+body+source.slice(p.end);
}
function replaceExactOnce(source,find,replacement,description) {
  if(source.includes(replacement))return source;
  const index=source.indexOf(find);
  if(index<0)throw Error(`Cannot locate ${description}; refusing to change unrelated code`);
  return source.slice(0,index)+replacement+source.slice(index+find.length);
}
try {
  // Only the visible AI Interview selection item: keep its category and all other types untouched.
  let source=after.catalogue, p=declaration(source,'DEFAULT_ASSESSMENT_TYPES','[');
  const entries=[...p.body.matchAll(/\{[^{}]*\}/g)].map(match=>({text:match[0],code:/\bcode\s*:\s*["']([^"']+)["']/.exec(match[0])?.[1],label:/\blabel\s*:\s*["']([^"']+)["']/.exec(match[0])?.[1]}));
  const exact=entries.filter(e=>e.label==='AI Interview');
  const old=entries.filter(e=>/^AI Interviews?\s*(?:and|&)\s*Quizzes$/i.test(e.label||''));
  if(exact.length>1) throw Error('Multiple AI Interview catalogue items; cannot choose one safely');
  const choice=exact[0] || (old.length===1 ? old[0] : undefined);
  if(!choice)throw Error('AI Interview catalogue item not found; share assessment-types.ts for safe repair');
  const originals=entries.filter(e=>e.code==='ai-interview');
  if(originals.length>1 || (originals.length===1 && originals[0]!==choice))throw Error('Canonical ai-interview code already belongs to another catalogue item');
  let item=choice.text;
  item=item.replace(/(\bcode\s*:\s*)["'][^"']+["']/,'$1"ai-interview"');
  item=item.replace(/(\blabel\s*:\s*)["'][^"']+["']/,'$1"AI Interview"');
  item=item.replace(/\bimplemented\s*:\s*false/,'implemented: true');
  if(!/\bimplemented\s*:/.test(item))item=item.replace(/\}\s*$/,', implemented: true}');
  source=source.replace(choice.text,item);
  after.catalogue=source;

  // Only the AI adapter: retain shared Details/Evaluation keys and AI-only content key.
  source=after.registry;
  const union=/(export\s+type\s+QuestionMode\s*=)([^;]+)(;)/;
  if(!union.test(source))throw Error('QuestionMode type declaration not found');
  source=source.replace(union,(all,prefix,types,semicolon)=>/["']ai-interview["']/.test(types)?all:`${prefix}${types} | "ai-interview"${semicolon}`);
  source=editEntry(source,'ASSESSMENT_ADAPTERS','ai-interview','{code:"ai-interview",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}}');
  after.registry=source;

  // Do not touch Type, Details, Evaluation, Review implementations; only canonical Content mapping.
  source=after.form;
  const importLine='import AIInterviewContent from "../type-specific/ai-interviews-and-quizzes/Content";';
  if(!source.includes(importLine)) {
    if(!/AIInterviewContent\s+from\s+["']\.\.\/type-specific\/ai-interviews-and-quizzes\/Content["']/.test(source)) {
      const directive=/^[\s\uFEFF]*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["'];?/.exec(source);
      if(!directive)throw Error('AssessmentForm.tsx has no first-statement "use client" directive');
      source=source.slice(0,directive[0].length)+'\n'+importLine+source.slice(directive[0].length);
    }
  }
  source=editEntry(source,'TYPE_STEPS','ai-interview','{details:STEPS.details,content:AIInterviewContent,evaluation:STEPS.evaluation,review:STEPS.review}');
  after.form=source;
  source=after.entry;
  source=editArrayEntry(source,'CONTENT_KEYS','ai-interview','["aiContentDraft"]');
  source=editArrayEntry(source,'DETAIL_KEYS','ai-interview','["mcqAssessmentDraft"]');
  after.entry=source;

  // Ensure AI canonical code routes to AI viewer, never a Problem Solving viewer.
  source=after.route;
  const viewerImport='import AIInterviewViewer from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer";';
  if(!/\bimport\s+AIInterviewViewer\s+from\s+["']@\/modules\/assessments\/components\/type-specific\/ai-interviews-and-quizzes\/Viewer["']/.test(source)){
    const imp=/\bimport\s/.exec(source); if(!imp)throw Error('Viewer route import area not found');
    source=source.slice(0,imp.index)+viewerImport+'\n'+source.slice(imp.index);
  }
  if(!/\bconst\s+Viewer\s*=/.test(source))throw Error('Viewer selector not found');
  const canonicalCondition=/\btype\s*===\s*["']ai-interview["']/;
  const aiSelector=/(\([^()]*\btype\s*===\s*["'][^"']+["'][^()]*\)\s*\?\s*AIInterviewViewer\s*:)/;
  if(aiSelector.test(source)){
    const match=aiSelector.exec(source)[0];
    if(!canonicalCondition.test(match))source=source.replace(match,match.replace(/\)\s*\?\s*AIInterviewViewer\s*:/,' || type === "ai-interview") ? AIInterviewViewer :'));
  }else if(!source.includes('/* ai-interview-canonical */')){
    source=source.replace(/\bconst\s+Viewer\s*=\s*/, (whole)=>whole+'/* ai-interview-canonical */ (type === "ai-interview") ? AIInterviewViewer : ');
  }
  after.route=source;

  // Patch ONLY AI-specific visible labels and storage metadata; do not overwrite the user's TSX.
  source=after.creator;
  source=source.replaceAll('Question Content (AI Interviews and Quizzes)','Question Content (AI Interview)');
  source=source.replaceAll('AI Assessment question content','AI Interview question content');
  if(/Question Content \(AI Interviews and Quizzes\)/.test(source))throw Error('AI creator heading still uses old name');
  // Keep the published draft type distinguishable from Problem Solving.
  if (!source.includes('assessmentType?: "ai-interview";')) source=source.replace('type Draft = {','type Draft = { assessmentType?: "ai-interview";');
  if(!source.includes('assessmentType?: "ai-interview";') && !source.includes('assessmentType: "ai-interview";'))throw Error('AI draft type metadata could not be inserted');
  source=source.replaceAll('JSON.stringify({ targetRole, strategy, difficulty, questionCount, questions,', 'JSON.stringify({ assessmentType: "ai-interview" as const, targetRole, strategy, difficulty, questionCount, questions,');
  source=source.replaceAll('JSON.stringify({ targetRole, strategy, difficulty, questionCount, questions }','JSON.stringify({ assessmentType: "ai-interview" as const, targetRole, strategy, difficulty, questionCount, questions }');
  if(!source.includes('<h1>Question Content (AI Interview)</h1>'))throw Error('AI Content heading format differs; cannot safely rename');
  after.creator=source;

  // Prevent legacy generic MCQ/Problem Solving draft from being shown as an AI Interview title.
  source=after.learner;
  source=source.replace('title: "Introduction to Artificial Intelligence", role:', 'title: "AI Interview", role:');
  const fallback='assessmentStorage.getItem("aiInterviewViewerConfig") || assessmentStorage.getItem("mcqAssessmentDraft") || sessionStorage.getItem("aiInterviewViewerConfig")';
  const safe='assessmentStorage.getItem("aiInterviewViewerConfig") || sessionStorage.getItem("aiInterviewViewerConfig")';
  if(source.includes(fallback))source=source.replace(fallback,safe);
  else if(!source.includes(safe))throw Error('AI viewer configuration source differs; cannot safely filter another assessment title');
  after.learner=source;

  // Canonical click navigation only: no new buttons, no generic assessment click interception.
  source=after.selection;
  if(!source.includes('const AI_TYPE_CODE = '))throw Error('AI Interview click activator has a different structure');
  source=source.replace(/(const\s+AI_TYPE_CODE\s*=\s*)["'][^"']*["']/, '$1"ai-interview"');
  after.selection=source;
} catch(error) { stop(error.message); }

const changed=Object.entries(locations).filter(([name])=>before[name]!==after[name]);
console.log('AI Interview canonical code: ai-interview');
console.log('AI type display name: AI Interview');
for(const [name,rel] of changed)console.log('  PATCH '+rel);
if(mode==='verify') {
  if(changed.length)stop('AI Interview naming is not fully installed; run node fix_ai_interview_naming.cjs .');
  console.log('PASS: AI Interview naming and canonical creator/viewer registrations are consistent.');process.exit(0);
}
if(mode==='check'){console.log('CHECK PASSED: no files changed.');process.exit(0)}
const completed=[];
try {
  for(const [name,rel] of changed) {
    const destination=path.join(root,rel);
    completed.push({destination,original:before[name]});
    fs.writeFileSync(destination,after[name],'utf8');
  }
}catch(error){for(const {destination,original} of completed.reverse()){try{fs.writeFileSync(destination,original,'utf8')}catch{}}stop('Writes rolled back: '+error.message)}
console.log('INSTALLED: AI Interview naming only. Re-run --verify and npm run build.');
