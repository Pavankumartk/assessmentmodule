#!/usr/bin/env node
"use strict";
/* AI Interview creator selection + existing five-step registration. Node.js only. */
const fs=require('node:fs'), path=require('node:path');
const argv=process.argv.slice(2),root=path.resolve(argv.find(a=>!a.startsWith('--'))||'.');
const mode=argv.includes('--verify')?'verify':argv.includes('--check')?'check':'apply';
const base='src/modules/assessments';
const files={
  catalogue:`${base}/config/assessment-types.ts`,
  registry:`${base}/config/component-registry.ts`,
  form:`${base}/components/common/AssessmentForm.tsx`,
  entry:`${base}/components/common/AssessmentContentEntry.tsx`,
  storage:`${base}/storage/assessment-storage.ts`,
  viewer:'src/app/assessments/[assessmentId]/viewer/PageClient.tsx'
};
const aiDir=`${base}/components/type-specific/ai-interviews-and-quizzes`;
const assets=['Content.tsx','Viewer.tsx','ai.css','viewai.css'];
const ownActivation=`${aiDir}/AIInterviewSelectionActivator.tsx`;
const ownTemplate='src/app/assessments/create/template.tsx';
const own=[...assets.map(a=>`${aiDir}/${a}`),ownActivation,ownTemplate];
const fail=m=>{console.error('STOPPED: '+m);console.error('Other assessment types were not modified.');process.exit(1)};
const original={},next={};
for(const [k,rel] of Object.entries(files)){
  const dest=path.join(root,rel);
  if(!fs.existsSync(dest))fail('Required shared file not found: '+rel);
  original[k]=fs.readFileSync(dest,'utf8');next[k]=original[k];
}
for(const rel of own){if(!fs.existsSync(path.join(__dirname,rel)))fail('ZIP missing '+rel)}
function matchingClose(src,at,opener){
  const closer=opener==='{'?'}':']';let depth=0,quote='',escaped=false,line=false,block=false;
  for(let i=at;i<src.length;i++){
    const ch=src[i],after=src[i+1];
    if(line){if(ch==='\n')line=false;continue}
    if(block){if(ch==='*'&&after==='/'){block=false;i++}continue}
    if(quote){if(escaped){escaped=false;continue}if(ch==='\\'){escaped=true;continue}if(ch===quote)quote='';continue}
    if(ch==='/'&&after==='/'){line=true;i++;continue}if(ch==='/'&&after==='*'){block=true;i++;continue}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch===opener)depth++;
    if(ch===closer){depth--;if(depth===0)return i}
  }throw Error('Unbalanced '+opener+' in shared source');
}
function decl(src,name,opening){
  const pattern=new RegExp('\\b(?:export\\s+)?const\\s+'+name+'\\b[^=]*=\\s*\\'+opening);
  const m=pattern.exec(src);if(!m)throw Error('Cannot safely locate '+name+' declaration');
  const open=m.index+m[0].length-1;
  return {open,close:matchingClose(src,open,opening),body:src.slice(open+1,matchingClose(src,open,opening))};
}
function inObject(src,name,entries){
  const {open,close,body}=decl(src,name,'{');let updated=body;
  for(const [code,value] of entries){const quoted=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(!new RegExp('["\\\']'+quoted+'["\\\']\\s*:').test(updated))updated='\n  '+JSON.stringify(code)+': '+value+','+updated;
  }
  return src.slice(0,open+1)+updated+src.slice(close);
}
function insertAfterClient(s,line){
  if(s.includes(line))return s;
  const directive=/^[\s\uFEFF]*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use client["'];?/m.exec(s);
  if(!directive||directive.index!==0)throw Error('AssessmentForm.tsx must start with "use client"; cannot safely insert import');
  return s.slice(0,directive[0].length)+'\n'+line+s.slice(directive[0].length);
}
function addDrafts(src){
  const name=/\bconst\s+ADDITIONAL_WORKFLOW_DRAFT_KEYS\b/.test(src)?'ADDITIONAL_WORKFLOW_DRAFT_KEYS':/\b(?:export\s+)?const\s+DRAFT_KEYS\b/.test(src)?'DRAFT_KEYS':null;
  if(!name)throw Error('Unable to find existing draft-storage array');
  const p=decl(src,name,'['),keys=['aiContentDraft','aiInterviewViewerConfig','aiInterviewEvaluationDraft'].filter(k=>!new RegExp('["\\\']'+k+'["\\\']').test(p.body));
  return keys.length?src.slice(0,p.open+1)+'\n  '+keys.map(x=>JSON.stringify(x)).join(', ')+','+src.slice(p.open+1):src;
}
function field(obj,key){return new RegExp('\\b'+key+'\\s*:\\s*["\\\']([^"\\\']+)["\\\']').exec(obj)?.[1]}
let selectedCode='';
try{
  // This is the missing match in the previous installers: the visible item is AI Interview (singular).
  let types=next.catalogue;const p=decl(types,'DEFAULT_ASSESSMENT_TYPES','[');
  const items=[...p.body.matchAll(/\{[^{}]*\}/g)].map(m=>({raw:m[0],code:field(m[0],'code'),label:field(m[0],'label')}));
  const exact=items.find(x=>/^AI Interview$/i.test(x.label||''));
  const aliases=items.filter(x=>/^ai[-_ ]?interview/i.test(x.code||'') || /^AI Interviews?\s*(?:&|and)\s*Quizz?e?s$/i.test(x.label||''));
  const chosen=exact||aliases.find(x=>/AI Interview/i.test(x.label||''))||null;
  if(chosen){selectedCode=chosen.code||'ai-interview';
    for(const item of [chosen,...aliases].filter((x,i,a)=>a.indexOf(x)===i)){
      const upgraded=/\bimplemented\s*:\s*false/.test(item.raw)?item.raw.replace(/\bimplemented\s*:\s*false/,'implemented:true'):
        /\bimplemented\s*:/.test(item.raw)?item.raw:item.raw.replace(/\}\s*$/,',implemented:true}');
      types=types.replace(item.raw,upgraded);
    }
  }else{
    selectedCode='ai-interview';
    types=types.slice(0,p.open+1)+'\n  {code:"ai-interview",label:"AI Interview",category:"AI-Powered Assessments",implemented:true},'+types.slice(p.open+1);
  }
  if(!/^[a-zA-Z0-9_-]+$/.test(selectedCode))throw Error('Unexpected AI Interview type code; refusing unsafe routing');
  next.catalogue=types;
  const codes=[...new Set([selectedCode,'ai-interview','ai-interviews-and-quizzes'])];
  let registry=next.registry;
  registry=registry.replace(/(export\s+type\s+QuestionMode\s*=)([^;]+)(;)/,(m,a,b,c)=>/["']ai-interview["']/.test(b)?m:a+b+' | "ai-interview"'+c);
  if(!/\bQuestionMode\s*=/.test(registry)||!/["']ai-interview["']/.test(registry))throw Error('QuestionMode union mismatch');
  next.registry=inObject(registry,'ASSESSMENT_ADAPTERS',codes.map(code=>[code,`{code:${JSON.stringify(code)},questionMode:"ai-interview",draftKeys:{details:"mcqAssessmentDraft",content:"aiContentDraft",evaluation:"mcqAssessmentEvaluationDraft"}}`]));
  let form=insertAfterClient(next.form,'import AIInterviewContent from "../type-specific/ai-interviews-and-quizzes/Content";');
  const fm=decl(form,'TYPE_STEPS','{');const fmEntries=[];
  for(const code of codes){fmEntries.push([code,'{details:STEPS.details,content:AIInterviewContent,evaluation:STEPS.evaluation,review:STEPS.review}'])}
  form=inObject(form,'TYPE_STEPS',fmEntries);next.form=form;
  let entry=next.entry;
  for(const name of ['CONTENT_KEYS','DETAIL_KEYS']){
    if(new RegExp('\\bconst\\s+'+name+'\\b').test(entry))entry=inObject(entry,name,codes.map(code=>[code,name==='CONTENT_KEYS'?'["aiContentDraft"]':'["mcqAssessmentDraft"]']));
    else throw Error('Missing expected '+name+' map in AssessmentContentEntry.tsx');
  }
  next.entry=entry;next.storage=addDrafts(next.storage);
  let viewer=next.viewer;
  const importLine='import AIInterviewViewer from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer";';
  if(!viewer.includes(importLine)){
    const first=/\bimport\s/.exec(viewer);if(!first)throw Error('Cannot locate viewer imports');
    viewer=viewer.slice(0,first.index)+importLine+'\n'+viewer.slice(first.index);
  }
  if(!/\bconst\s+Viewer\s*=/.test(viewer))throw Error('Cannot find shared viewer selector');
  // Extend the FIRST existing AI ternary. Never create a duplicate AI condition.
  const aiTernary=/\(([^()]*\btype\s*===\s*["'][^"']+["'][^()]*)\)\s*\?\s*AIInterviewViewer\s*:/;
  const already=aiTernary.exec(viewer);
  if(already){
    const cond=already[1];const missing=codes.filter(code=>!cond.includes('type === '+JSON.stringify(code))&&!cond.includes("type === '"+code+"'"));
    if(missing.length)viewer=viewer.replace(already[0],`(${cond} || ${missing.map(code=>'type === '+JSON.stringify(code)).join(' || ')}) ? AIInterviewViewer :`);
  }else if(!/\?\s*AIInterviewViewer\s*:/.test(viewer)){
    viewer=viewer.replace(/\bconst\s+Viewer\s*=\s*/,(s)=>s+'('+codes.map(code=>'type === '+JSON.stringify(code)).join(' || ')+') ? AIInterviewViewer : ');
  }else throw Error('Existing AI viewer selector format differs; refusing a duplicate mapping');
  next.viewer=viewer;
}catch(e){fail(e.message)}
// No edits to the existing creator selection page, existing template, or any other type.
const replacements=Object.keys(next).filter(k=>next[k]!==original[k]);
const newFiles=[];
for(const rel of own){
  const destination=path.join(root,rel),source=path.join(__dirname,rel);
  const tpl=rel===ownActivation?fs.readFileSync(source,'utf8').replaceAll('__AI_TYPE_CODE__',selectedCode):fs.readFileSync(source,'utf8');
  if(rel===ownTemplate && fs.existsSync(destination) && fs.readFileSync(destination,'utf8')!==tpl)fail('An existing create/template.tsx is present. Do not overwrite it; share that file for a safe merge.');
  if(rel===ownActivation && fs.existsSync(destination)&&fs.readFileSync(destination,'utf8')!==tpl && !fs.readFileSync(destination,'utf8').includes('AI_TYPE_CODE = '))fail('Existing AISelectionActivator is customized; share it for a safe merge');
  if(!fs.existsSync(destination))newFiles.push({rel,contents:tpl,kind:'ADD'});
  else if(rel===ownActivation && fs.readFileSync(destination,'utf8')!==tpl)newFiles.push({rel,contents:tpl,kind:'UPDATE'});
}
console.log('AI Interview option code:',selectedCode);
console.log('Creator selection route:', '/assessments/create -> /assessments/create/details?type='+selectedCode);
for(const k of replacements)console.log('  PATCH '+files[k]);
for(const f of newFiles)console.log('  '+f.kind+' '+f.rel);
if(mode==='verify'){
  if(replacements.length||newFiles.length)fail('AI Interview selection integration incomplete; run node fix_ai_interview_selection.cjs .');
  console.log('PASS: AI Interview enabled, creator/viewer registered, selection click bridge installed.');process.exit(0);
}
if(mode==='check'){console.log('CHECK PASSED: no files changed.');process.exit(0)}
const applied=[];
try{
  for(const k of replacements){const dest=path.join(root,files[k]);applied.push({dest,backup:Buffer.from(original[k])});fs.writeFileSync(dest,next[k],'utf8')}
  for(const f of newFiles){const dest=path.join(root,f.rel);fs.mkdirSync(path.dirname(dest),{recursive:true});applied.push({dest,backup:fs.existsSync(dest)?fs.readFileSync(dest):null});fs.writeFileSync(dest,f.contents,'utf8')}
}catch(e){for(const a of applied.reverse()){try{a.backup===null?fs.rmSync(a.dest,{force:true}):fs.writeFileSync(a.dest,a.backup)}catch{}}fail('Installation rolled back: '+e.message)}
console.log('INSTALLED AI Interview selection activation and registrations. No other assessment components changed.');
