#!/usr/bin/env node
"use strict";
/* AI Interviews and Quizzes: source-aware registration repair. No Python. */
const fs=require('node:fs'), path=require('node:path');
const argv=process.argv.slice(2);
const root=path.resolve(argv.find(x=>!x.startsWith('--'))||'.');
const mode=argv.includes('--check')?'check':argv.includes('--verify')?'verify':'apply';
const base='src/modules/assessments';
const files={
  catalogue:`${base}/config/assessment-types.ts`,
  registry:`${base}/config/component-registry.ts`,
  form:`${base}/components/common/AssessmentForm.tsx`,
  contentEntry:`${base}/components/common/AssessmentContentEntry.tsx`,
  storage:`${base}/storage/assessment-storage.ts`,
  viewer:'src/app/assessments/[assessmentId]/viewer/PageClient.tsx',
};
const ownDir=`${base}/components/type-specific/ai-interviews-and-quizzes`;
const ownFiles=['Content.tsx','Viewer.tsx','ai.css','viewai.css'];
const originals={},updates={};
const has=(s,k)=>new RegExp(`(?:["']${k}["']|\\b${k})\\s*:`).test(s);
const stop=(error)=>{console.error('STOPPED: '+error);console.error('No unrelated assessment files were modified.');process.exit(1)};
for(const [k,relative] of Object.entries(files)){
  const f=path.join(root,relative);
  if(fs.existsSync(f))originals[k]=fs.readFileSync(f,'utf8'),updates[k]=originals[k];
  else stop(`Missing required shared file: ${relative}`);
}
for(const file of ownFiles){const f=path.join(__dirname,ownDir,file);if(!fs.existsSync(f))stop(`Missing AI component ${f}`)}
// Parse a balanced TS object/array, ignoring quoted literals and JS comments.
function matchingClose(src,open,opener='{'){
  const closer=opener==='{'?'}':']';let depth=0,quote='',escape=false,line=false,block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(line){if(c==='\n')line=false;continue}
    if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
    if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}
    if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c===opener)depth++;
    if(c===closer){depth--;if(depth===0)return i}
  }throw Error('Unbalanced object/array at character '+open);
}
function declaration(src,name,kind='{'){
 const exp=new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b[\\s\\S]*?=\\s*\\${kind}`,'m'),m=exp.exec(src);
 if(!m)throw Error(`Cannot safely locate ${name} declaration`);
 const open=m.index+m[0].length-1,close=matchingClose(src,open,kind);
 return {open,close,body:src.slice(open+1,close)};
}
function addEntries(src,name,entries){const p=declaration(src,name);let body=p.body;
 for(const [key,value] of entries){if(!has(body,key))body=`\n  "${key}": ${value},`+body}
 return src.slice(0,p.open+1)+body+src.slice(p.close);
}
function addArrayKey(src,name,keys){const p=declaration(src,name,'[');const addition=keys.filter(k=>!new RegExp(`["']${k}["']`).test(p.body));if(!addition.length)return src;
 return src.slice(0,p.open+1)+'\n  '+addition.map(k=>JSON.stringify(k)).join(', ')+','+src.slice(p.open+1);
}
function importAfterClient(s,imp){if(s.includes(imp))return s;
 const m=/^[\s\uFEFF]*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["'];?/m.exec(s);
 if(!m||m.index!==0)throw Error('AssessmentForm.tsx has no first-statement "use client" directive; refusing unsafe import');
 return s.slice(0,m[0].length)+'\n'+imp+s.slice(m[0].length);
}
const registration='ai-interviews-and-quizzes';
const aliases=new Set([registration,'ai-interview','ai-interviews','ai-interviews-quizzes','ai-interviews-and-quizes','ai-assessment']);
try{
  // Respect an existing type selector entry and its code, even if the label uses '&'.
  let catalogue=updates.catalogue;
  const arr=declaration(catalogue,'DEFAULT_ASSESSMENT_TYPES','[');
  const literalObjects=[...arr.body.matchAll(/\{[^{}]*\}/g)];
  let exists=false;
  for(const match of literalObjects){
    const entry=match[0],code=(/\bcode\s*:\s*['"]([^'"]+)['"]/.exec(entry)||[])[1],label=(/\blabel\s*:\s*['"]([^'"]+)['"]/.exec(entry)||[])[1];
    if((code&&/^ai[-_ ]?interview/i.test(code))||(label&&/^AI\s+Interviews?\s*(?:and|&)\s*Quizz?e?s$/i.test(label))){
      exists=true;if(code)aliases.add(code);
      if(/\bimplemented\s*:\s*false/.test(entry))catalogue=catalogue.replace(entry,entry.replace(/\bimplemented\s*:\s*false/,'implemented:true'));
    }
  }
  if(!exists){const at=declaration(catalogue,'DEFAULT_ASSESSMENT_TYPES','[').open+1;
    const available=[...arr.body.matchAll(/\bcategory\s*:\s*["\']([^"\']+)["\']/g)].map(m=>m[1]);
    const category=available.find(x=>/AI/i.test(x))||available.find(x=>/Practical|Application/i.test(x))||available[0]||"General";
    catalogue=catalogue.slice(0,at)+`\n  {code:"ai-interviews-and-quizzes",label:"AI Interviews and Quizzes",category:${JSON.stringify(category)},implemented:true},`+catalogue.slice(at);
  }
  updates.catalogue=catalogue;
  // Workflow adapter. All AI aliases share their own content storage and ordinary shared steps.
  let reg=updates.registry;
  reg=reg.replace(/(export\s+type\s+QuestionMode\s*=)([^;]+)(;)/,(all,a,b,c)=>/["']ai-interview["']/.test(b)?all:a+b+' | "ai-interview"'+c);
  if(!/\bQuestionMode\s*=/.test(reg)||!/['"]ai-interview['"]/.test(reg))throw Error('QuestionMode union differs from known source');
  reg=addEntries(reg,'ASSESSMENT_ADAPTERS',[...aliases].map(code=>[code,`{code:"${code}",questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}}`]));
  updates.registry=reg;
  let form=updates.form;
  form=importAfterClient(form,'import AIInterviewContent from "../type-specific/ai-interviews-and-quizzes/Content";');
  form=addEntries(form,'TYPE_STEPS',[...aliases].map(code=>[code,'{details:STEPS.details,content:AIInterviewContent,evaluation:STEPS.evaluation,review:STEPS.review}']));
  for(const name of ['CONTENT_KEYS','DETAIL_KEYS'])if(new RegExp(`\\bconst\\s+${name}\\b`).test(form))form=addEntries(form,name,[...aliases].map(code=>[code,name==='CONTENT_KEYS'?'["aiContentDraft"]':'["mcqAssessmentDraft"]']));
  updates.form=form;
  // Actual Content-entry keys live in AssessmentContentEntry, not necessarily AssessmentForm.
  if(updates.contentEntry){let s=updates.contentEntry;
   for(const name of ['CONTENT_KEYS','DETAIL_KEYS'])if(new RegExp(`\\bconst\\s+${name}\\b`).test(s))s=addEntries(s,name,[...aliases].map(code=>[code,name==='CONTENT_KEYS'?'["aiContentDraft"]':'["mcqAssessmentDraft"]']));
   updates.contentEntry=s;
  }
  // Ensure AI draft travels with published/saved assessments.
  if(updates.storage){let s=updates.storage;
    if(/\bconst\s+ADDITIONAL_WORKFLOW_DRAFT_KEYS\b/.test(s))s=addArrayKey(s,'ADDITIONAL_WORKFLOW_DRAFT_KEYS',['aiContentDraft','aiInterviewViewerConfig','aiInterviewEvaluationDraft']);
    else if(/\b(?:export\s+)?const\s+DRAFT_KEYS\b/.test(s))s=addArrayKey(s,'DRAFT_KEYS',['aiContentDraft','aiInterviewViewerConfig','aiInterviewEvaluationDraft']);
    else throw Error('Cannot identify assessment storage draft key list; safely stopped');
    updates.storage=s;
  }
  let viewer=updates.viewer;
  const importLine='import AIInterviewViewer from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer";';
  if(!viewer.includes(importLine)){
    // Insert before first import, after the "use client" directive, if it exists.
    const first=/\bimport\s/.exec(viewer);if(!first)throw Error('Cannot find imports in shared viewer');
    viewer=viewer.slice(0,first.index)+importLine+'\n'+viewer.slice(first.index);
  }
  if(!/\bconst\s+Viewer\s*=/.test(viewer))throw Error('Cannot find shared const Viewer selector; no viewer mapping changed');
  // Replace an existing AI conditional if possible, rather than stacking another AI ternary.
  const aiSelector=/\((?:\s*type\s*===\s*["'][^"']+["']\s*(?:\|\|\s*)?)+\)\s*\?\s*AIInterviewViewer\s*:/;
  const conditions=[...aliases].map(code=>`type === ${JSON.stringify(code)}`).join(' || ');
  if(aiSelector.test(viewer))viewer=viewer.replace(aiSelector,`(${conditions}) ? AIInterviewViewer :`);
  else if(!/\?\s*AIInterviewViewer\s*:/.test(viewer))viewer=viewer.replace(/\bconst\s+Viewer\s*=\s*/,m=>m+`(${conditions}) ? AIInterviewViewer : `);
  else if(mode!=='verify')throw Error('Existing AI viewer condition differs; cannot safely append a second mapping');
  updates.viewer=viewer;
  if(!updates.catalogue.includes('AI Interviews')||!updates.form.includes('AIInterviewContent')||!updates.viewer.includes('AIInterviewViewer'))throw Error('Verification of AI mapping failed');
}catch(e){stop(e.message)}
const modifications=Object.keys(updates).filter(k=>updates[k]!==originals[k]);
const missing=ownFiles.filter(name=>!fs.existsSync(path.join(root,ownDir,name)));
console.log(`AI type + creator + viewer registration: ${modifications.length} shared file(s) need edits; ${missing.length} missing AI component file(s).`);
for(const k of modifications)console.log('  PATCH',files[k]);
for(const name of missing)console.log('  ADD  ',`${ownDir}/${name}`);
if(mode==='verify'){
 if(modifications.length||missing.length)stop('AI integration is incomplete. Run node repair_ai_assessment.cjs . to apply the missing registrations.');
 console.log('PASS: AI registered in catalogue, workflow adapter, creator Content, storage, and viewer.');process.exit(0);
}
if(mode==='check'){console.log('CHECK PASSED: inspection only, no files modified.');process.exit(0)}
const undo=[];
try{
 for(const k of modifications){const dest=path.join(root,files[k]);undo.push({dest,old:fs.readFileSync(dest)});fs.writeFileSync(dest,updates[k],'utf8')}
 for(const name of missing){const rel=path.join(ownDir,name),dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});undo.push({dest,old:null});fs.copyFileSync(path.join(__dirname,rel),dest)}
}catch(e){for(const x of undo.reverse()){try{x.old===null?fs.rmSync(x.dest,{force:true}):fs.writeFileSync(x.dest,x.old)}catch{}}stop('Install rolled back: '+e.message)}
console.log('INSTALLED: AI assessment registration only. Existing AI components and all other assessment components preserved.');
