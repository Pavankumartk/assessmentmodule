#!/usr/bin/env node
/**
 * Restore assessment functionality from an explicitly chosen, local Git commit.
 * DOES NOT use the older uploaded Assessment.zip or alter browser localStorage.
 * --check = read-only; --apply requires --commit=<sha> and checks eligibility.
 * Restores only assessment-related source paths. Never deletes other source files.
 * On build failure, changes made by this tool are rolled back automatically.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const commitArg = args.find(x => x.startsWith('--commit='));
if(args.some(x => x !== '--check' && x !== '--apply' && !x.startsWith('--commit=')) ||
   (apply && args.includes('--check')) ||
   (apply && !commitArg) || args.filter(x=>x.startsWith('--commit=')).length>1){
 console.error('Usage: node scripts/restore-working-assessments.cjs --check');
 console.error('       node scripts/restore-working-assessments.cjs --check --commit=<sha>');
 console.error('       node scripts/restore-working-assessments.cjs --apply --commit=<sha>');
 process.exit(2);
}
const root = process.cwd();
const srcRoot=path.join(root,'src');
function git(parts, maxBuffer=12*1024*1024) {
 try {return cp.execFileSync('git',parts,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer});}
 catch {return null;}
}
function gitFile(sha,rel){
 try {return cp.execFileSync('git',['show',`${sha}:${rel}`],{cwd:root,encoding:'buffer',stdio:['ignore','pipe','pipe'],maxBuffer:50*1024*1024});}
 catch{return null;}
}
if(git(['rev-parse','--show-toplevel'])?.trim()!==root){
 console.error('[STOP] Run inside the assessment web Git repository. No files changed.');process.exit(1);
}
if(!fs.existsSync(srcRoot)){console.error('[STOP] Missing src folder. Nothing changed.');process.exit(1);}
const badMessage='This assessment type needs its own question builder; MCQ is fully connected.';
const allowedExt=/\.(tsx?|css|json)$/i;
// Previous updates changed src/modules/assessments and src/app/assessments.
// Some older assessment types have standalone pages. Preserve all other pages.
const typeAppDir=/^(?:mcq|viewer|one[_-]?word|short[_-]?answers?|long[_-]?answers?|fill[_-]?(?:in[_-]?the[_-]?)?blanks?|true[_-]?false|drag[_-]?drop|match[_-]?(?:the[_-]?)?following|memory[_-]?game|connect[_-]?dots|clickable[_-]?hotspot|image[_-]?(?:based|matching|labeling|labelling|sorting|sequencing|sequence|dropdown)|assignment|problem[_-]?solving|viewai|ai[_-]?interview|review|results?)$/i;
function eligible(rel){
 if(!allowedExt.test(rel) || rel.split('/').some(x=>x==='node_modules'||x==='.next'))return false;
 if(rel.startsWith('src/modules/assessments/'))return true;
 if(rel.startsWith('src/app/assessments/'))return true;
 const m=/^src\/app\/([^/]+)\//.exec(rel);
 return Boolean(m && typeAppDir.test(m[1]));
}
function info(sha){
 const tree=git(['ls-tree','-r','--name-only',sha,'--','src/modules/assessments','src/app']);
 if(!tree)return null;
 const all=tree.split('\n').filter(Boolean);
 const typeFolders=[...new Set(all.map(x=>/^src\/modules\/assessments\/components\/type-specific\/([^/]+)\//.exec(x)?.[1]).filter(Boolean))];
 const appFolders=[...new Set(all.map(x=>/^src\/app\/([^/]+)\//.exec(x)?.[1]).filter(x=>x&&typeAppDir.test(x)))];
 const targets=all.filter(eligible);
 const create=gitFile(sha,'src/modules/assessments/components/common/steps/CreateStep/CreateStep.tsx')?.toString('utf8')||'';
 const registry=gitFile(sha,'src/modules/assessments/config/component-registry.ts')?.toString('utf8')||'';
 const defs=gitFile(sha,'src/modules/assessments/config/assessment-types.ts')?.toString('utf8')||'';
 const codes=new Set([...defs.matchAll(/code\s*:\s*["']([^"']+)["']/g)].map(x=>x[1]));
 const implemented=[...defs.matchAll(/\{[^{}]{0,300}implemented\s*:\s*true[^{}]*\}/g)].length;
 const route=targets.some(x=>x==='src/app/assessments/[assessmentId]/viewer/PageClient.tsx');
 const form=targets.includes('src/modules/assessments/components/common/AssessmentForm.tsx');
 const base=targets.some(x=>x==='src/modules/assessments/config/component-registry.ts');
 const createPresent=targets.includes('src/modules/assessments/components/common/steps/CreateStep/CreateStep.tsx') && create.length>0;
 const fallback=create.includes(badMessage);
 const headline=git(['log','-1','--format=%h %ci %s',sha])?.trim().slice(0,160)||sha.slice(0,12);
 const diversity=new Set([...typeFolders.map(x=>x.toLowerCase()),...appFolders.map(x=>x.toLowerCase())]).size;
 const coverage=typeFolders.length + appFolders.filter(x=>!typeFolders.some(t=>x.toLowerCase().includes(t.toLowerCase()))).length;
 const sufficient=(coverage>=12 || (typeFolders.length>=9&&implemented>=9)) && base && form && route && createPresent && !fallback;
 const score=typeFolders.length*5+appFolders.length*2+implemented*3+codes.size + (route?5:0)+(form?3:0) - (fallback?60:0);
 return {sha,targets,typeFolders,appFolders,codes,implemented,route,form,base,createPresent,fallback,coverage,sufficient,score,headline,diversity,registrySize:registry.length};
}
const explicit=commitArg?commitArg.slice('--commit='.length):null;
let choices=[];
if(explicit){
 const sha=git(['rev-parse','--verify',`${explicit}^{commit}`])?.trim();
 if(!sha){console.error('[STOP] Git commit not found. No files changed.');process.exit(1);}
 const result=info(sha);if(!result){console.error('[STOP] Git snapshot has no source files. No changes.');process.exit(1);}
 choices=[result];
}else{
 const refs=[...new Set([...(git(['reflog','--all','--format=%H'])||'').split('\n'),...(git(['rev-list','--all','--max-count=180'])||'').split('\n')].filter(x=>/^[a-f0-9]{40}$/.test(x)))].slice(0,120);
 if(!refs.length){console.error('[STOP] No local Git history found. No files changed.');process.exit(1);}
 // Prefer complete code over recency; no changes are made while scanning.
 choices=refs.map(info).filter(Boolean).sort((a,b)=>Number(b.sufficient)-Number(a.sufficient)||b.score-a.score);
}
function printChoice(c,index){
 console.log(`${index+1}. ${c.headline}`);
 console.log(`   assessment type folders=${c.typeFolders.length}, standalone assessment dirs=${c.appFolders.length}, implemented definitions=${c.implemented}, relevant files=${c.targets.length}`);
 console.log(`   creator=${c.form?'yes':'NO'}, create step=${c.createPresent?'yes':'NO'}, viewer=${c.route?'yes':'NO'}, old placeholder=${c.fallback?'YES':'no'}, recovery eligibility=${c.sufficient?'PASS':'STOP'}`);
 console.log(`   types: ${c.typeFolders.slice(0,23).join(', ')||'(none)'}`);
}
console.log('ASSESSMENT RECOVERY — Git snapshot inspection (NO web requests, NO localStorage modification)');
if(!explicit){
 console.log('Potential working snapshots (highest assessment coverage first):');
 choices.slice(0,8).forEach(printChoice);
 if(!choices.some(c=>c.sufficient)){
  console.log('\n[STOP] Git history does not contain a snapshot with enough evidence for the requested 15+ assessment workflows.');
  console.log('Nothing changed. Do NOT copy the older Assessment.zip over your current source.');
  console.log('Provide this output and a ZIP of your current src folder and any pre-patch backups for manual recovery.');
  process.exitCode=1;
 }else{
  console.log('\nSelect the commit that corresponds to the version where all your assessments were WORKING.');
  console.log('Preview: node scripts/restore-working-assessments.cjs --check --commit=<SHA>');
  console.log('Apply only after preview: node scripts/restore-working-assessments.cjs --apply --commit=<SHA>');
 }
 process.exit();
}
const pick=choices[0];printChoice(pick,0);
if(!pick.sufficient){
 console.error('[STOP] This Git commit contains the old limited flow or lacks evidence for 12+ type routes. No changes made.');
 console.error('Find a working snapshot or upload your CURRENT src + pre-patch backup.');process.exit(1);
}
const changes=[];
for(const rel of pick.targets){
 const source=gitFile(pick.sha,rel);
 if(source===null){console.error(`[STOP] Cannot read ${rel} from Git. No changes made.`);process.exit(1);}
 const full=path.join(root,rel);
 const old=fs.existsSync(full)?fs.readFileSync(full):null;
 if(!old || !old.equals(source))changes.push({rel,old,source});
}
console.log(`\nFiles to restore from the selected working Git version: ${changes.length}`);
changes.slice(0,160).forEach(c=>console.log(`  ${c.old?'RESTORE':'RECOVER'}  ${c.rel}`));
if(changes.length>160)console.log(`  ... and ${changes.length-160} more (see Git tree)`);
console.log('Unrelated files outside assessment directories: NOT TOUCHED.');
console.log('Files present locally but absent from the selected commit: NOT DELETED.');
console.log('Chrome localStorage and saved assessments: NOT TOUCHED.');
if(!apply){console.log('\nREAD-ONLY CHECK COMPLETE. No files changed.');process.exit(0);}
if(!changes.length){console.log('Nothing to restore. No files changed.');process.exit(0);}
const backupDir=path.resolve(root,'..','assessment-recovery-backups',new Date().toISOString().replace(/[:.]/g,'-'));
function rollback(){
 for(const c of [...changes].reverse()){
  const full=path.join(root,c.rel);
  try{if(c.old)fs.writeFileSync(full,c.old);else fs.rmSync(full,{force:true});}
  catch(e){console.error('[ROLLBACK WARNING]',c.rel,e.message);}
 }
}
try{
 fs.mkdirSync(backupDir,{recursive:true});
 for(const c of changes){if(c.old){const out=path.join(backupDir,c.rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,c.old,{flag:'wx'});}}
 for(const c of changes){const target=path.join(root,c.rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,c.source);}
 console.log(`\nSaved originals to: ${backupDir}`);
 console.log('Running npm run build to verify restored code ...');
 const proc=cp.spawnSync('npm',['run','build'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(proc.status!==0){
  console.error('\n[BUILD FAILED] Reverting ALL files modified by this tool to their prior versions.');
  rollback();
  console.error('Source rollback attempted. See build error above. Pre-restoration copies are at:',backupDir);
  process.exit(1);
 }
 console.log('\n[RESTORED] Assessment-related code now matches the selected working Git snapshot.');
 console.log('Your browser saved assessments were not modified.');
 console.log('NEXT: check all created assessments, all creators and viewers, Results, and navigation in the browser BEFORE committing.');
}catch(e){rollback();console.error('[STOP/ROLLBACK]',e.message);console.error('Backup:',backupDir);process.exit(1);}
