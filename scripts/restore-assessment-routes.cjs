#!/usr/bin/env node
/*
 * Route recovery without replacing unknown local files.
 * Uses YOUR OWN Git history (not the outdated uploaded project).
 * Only previously overwritten assessment files and missing assessment routes
 * are eligible; leaves all stored assessments, CSS and other screens intact.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const candidateArg=args.find(x=>x.startsWith('--commit='));
if(args.some(x=>x!=='--check'&&x!=='--apply'&&!x.startsWith('--commit='))|| (args.includes('--check')&&apply)) {
 console.error('Usage: node scripts/restore-assessment-routes.cjs --check [--commit=<git-sha>]');
 console.error('   or: node scripts/restore-assessment-routes.cjs --apply [--commit=<git-sha>]');
 process.exit(2);
}
const root=process.cwd();
const BAD=require('./known-overwritten-assessment-files.json');
const TARGETS=Object.keys(BAD);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function git(params,options={}){
 try{return cp.execFileSync('git',params,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:100*1024*1024,...options}).trimEnd();}
 catch {return null;}
}
function gitFile(ref,rel){try{return cp.execFileSync('git',['show',`${ref}:${rel}`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:40*1024*1024});}catch{return null;}}
function lsTree(ref){const t=git(['ls-tree','-r','--name-only',ref,'--','src/app','src/modules/assessments']);return t===null?[]:t.split('\n').filter(Boolean);}
function coverageFromSource(files,fetch){
 const types=new Set(files.filter(x=>x.startsWith('src/modules/assessments/components/type-specific/')).map(x=>x.split('/')[5]).filter(x=>x && x !== 'README.md'));
 const appDirs=new Set(files.filter(x=>/^src\/app\/[^/]+\/page\.tsx$/.test(x)).map(x=>x.split('/')[2]).filter(x=>!['assessments','login','learner','dashboard','calculator','formulasheet','scratch','[portalSection]'].includes(x)));
 const reg=fetch('src/modules/assessments/config/component-registry.ts')||'';
 const defs=fetch('src/modules/assessments/config/assessment-types.ts')||'';
 const registered=new Set();
 for(const m of reg.matchAll(/["']([a-z][a-z0-9-]{2,})["']\s*:\s*\{\s*code\s*:/g))registered.add(m[1]);
 for(const m of defs.matchAll(/\{\s*code\s*:\s*["']([^"']+)["'][^}]*?implemented\s*:\s*true/g))registered.add(m[1]);
 const viewer=files.includes('src/app/assessments/[assessmentId]/viewer/PageClient.tsx')?1:0;
 return {types,appDirs,registered,viewer,score:types.size*4 + appDirs.size*2 + registered.size*5 + viewer*2};
}
if(!git(['rev-parse','--is-inside-work-tree'])){
 console.error('[STOP] Run this inside ~/Desktop/assessments/web (the Git repository). No changes made.');process.exit(1);
}
const currentFiles=[];
function walk(d,prefix=''){
 if(!fs.existsSync(d))return;
 for(const entry of fs.readdirSync(d,{withFileTypes:true})){
  const rel=path.posix.join(prefix,entry.name),abs=path.join(d,entry.name);
  if(entry.isDirectory())walk(abs,rel);
  else if(entry.isFile())currentFiles.push(rel);
 }
}
walk(path.join(root,'src','app'),'src/app');
walk(path.join(root,'src','modules','assessments'),'src/modules/assessments');
function fromDisk(file){const p=path.join(root,file);return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;}
const current=coverageFromSource(currentFiles,fromDisk);
const reflog=(git(['reflog','--all','--format=%H'])||'').split('\n');
const commits=(git(['rev-list','--all','--max-count=180'])||'').split('\n');
const refs=[...new Set([...reflog,...commits].filter(x=>/^[a-f0-9]{40}$/.test(x)))].slice(0,120);
if(candidateArg){
 const val=candidateArg.slice('--commit='.length);
 const full=git(['rev-parse','--verify',`${val}^{commit}`]);
 if(!full){console.error('[STOP] Invalid Git commit. No changes made.');process.exit(1);}
 refs.length=0;refs.push(full);
}
if(!refs.length){console.error('[STOP] No Git commit history found. No changes made.');process.exit(1);}
const variants=[];
for(const ref of refs){
 const files=lsTree(ref);
 if(!files.length)continue;
 const cov=coverageFromSource(files,rel=>gitFile(ref,rel));
 const old=gitFile(ref,'src/modules/assessments/components/common/steps/CreateStep/CreateStep.tsx');
 const dashboard=gitFile(ref,'src/modules/assessments/components/common/AssessmentDashboard/AssessmentDashboard.tsx');
 if(old===null||dashboard===null)continue;
 variants.push({ref,files,...cov});
}
variants.sort((a,b)=>b.score-a.score||b.types.size-a.types.size);
const choice=variants[0];
if(!choice){console.error('[STOP] No usable assessment source found in Git history. No files changed.');process.exit(1);}
const short=x=>x.slice(0,12);
console.log('Assessment route recovery (strict / non-destructive)');
console.log('Current component folders:',[...current.types].sort().join(', ')||'(none)');
console.log('Current registered types:',current.registered.size,'| candidate registered:',choice.registered.size);
if(choice.registered.size<12)console.warn('[WARNING] Found fewer than 12 explicitly registered types in Git; this tool can recover known files but cannot invent missing workflows.');
console.log('Current type folders:',current.types.size,'| candidate type folders:',choice.types.size);
console.log('Best Git snapshot:',short(choice.ref),'| custom app folders:',choice.appDirs.size);
// Never downgrade to a Git snapshot that has LESS routing than the current tree.
if(choice.score<current.score || choice.types.size<current.types.size){
 console.error('[STOP] Existing project has more assessment coverage than Git history. Do not overwrite newer implementations.');
 console.error('Please supply your current web/src ZIP and a known working Git commit to restore accurately.');process.exit(1);
}
const changes=[];
const skips=[];
// Recover ONLY files that match known older assistant-supplied ZIP versions.
for(const relative of TARGETS){
 const live=fromDisk(relative),historic=gitFile(choice.ref,relative);
 if(live===null||historic===null||live===historic)continue;
 const fingerprint=sha(live);
 if(!BAD[relative].includes(fingerprint)){
  skips.push(`${relative} (contains newer/unrecognized local changes)`);continue;
 }
 if(BAD[relative].includes(sha(historic))){
  skips.push(`${relative} (Git snapshot also matches an outdated patch)`);continue;
 }
 changes.push({relative,content:historic,mode:'RESTORE overridden route/flow'});
}
// Restore previously committed files ONLY where they are currently missing.
function assessmentRelated(relative){
 if(!/\.(tsx?|css|json)$/.test(relative))return false;
 if(relative.startsWith('src/modules/assessments/components/type-specific/'))return true;
 if(relative.startsWith('src/app/assessments/'))return true;
 if(relative.startsWith('src/modules/assessments/config/'))return true;
 if(relative.startsWith('src/modules/assessments/components/viewer/'))return true;
 if(relative.startsWith('src/modules/assessments/components/common/')&&/AssessmentForm\.tsx$/.test(relative))return true;
 // Existing separately implemented creator/viewer pages, not unrelated app screens.
 if(relative.startsWith('src/app/')){
  const dir=relative.split('/')[2];
  return choice.appDirs.has(dir)&&!['[portalSection]'].includes(dir);
 }
 return false;
}
for(const relative of choice.files){
 if(!assessmentRelated(relative)||fs.existsSync(path.join(root,relative)))continue;
 const historic=gitFile(choice.ref,relative);
 if(historic===null)continue;
 changes.push({relative,content:historic,mode:'RESTORE missing Git assessment file'});
}
// If a registry is older than its Git counterpart, restore it only when it
// matches the archived base. Otherwise do not touch locally customized code.
const inventory=path.join(root,'src/modules/assessments/config/component-registry.ts');
if(!changes.some(x=>x.relative.endsWith('/component-registry.ts'))&&fs.existsSync(inventory)&&choice.registered.size>current.registered.size){
 skips.push('component-registry.ts differs from Git and was not one of the assistant-overwritten files; manual merge required.');
}
console.log('\nProposed changes:',changes.length);
for(const entry of changes)console.log(' ['+entry.mode+'] '+entry.relative);
if(skips.length){console.log('\nNot overwritten (safety):');for(const s of skips)console.log(' [SKIP] '+s);}
if(!changes.length){
 console.log('\n[STOP] No safely reversible route files found. NO files changed.');
 console.log('If 15 types are still unavailable, supply current ~/Desktop/assessments/web/src ZIP so each registration can be repaired accurately.');
 process.exit(1);
}
const backupDir=path.resolve(root,'..','assessment-route-recovery-backups',new Date().toISOString().replace(/[:.]/g,'-'));
console.log('\nBackup directory:',backupDir);
if(!apply){console.log('\nCHECK ONLY: nothing changed. Run with --apply to restore the files listed above.');process.exit(0);}
if(changes.some(x=>TARGETS.includes(x.relative) && !BAD[x.relative].includes(sha(fromDisk(x.relative)||'')))){
 console.error('[STOP] Local files changed since scan; no files changed.');process.exit(1);
}
let begun=false;
try{
 for(const entry of changes){
  const source=path.join(root,entry.relative);
  if(fs.existsSync(source)){
   const backup=path.join(backupDir,entry.relative);
   fs.mkdirSync(path.dirname(backup),{recursive:true});
   fs.writeFileSync(backup,fs.readFileSync(source),{flag:'wx'});
  }
 }
 // Atomic write by individual files, existing files have been backed up.
 for(const entry of changes){
  const destination=path.join(root,entry.relative);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const temp=destination+'.route-recovery-tmp';
  fs.writeFileSync(temp,entry.content,{flag:'wx'});
  fs.renameSync(temp,destination);begun=true;
 }
 console.log('\n[RESTORED]',changes.length,'assessment source file(s) from',short(choice.ref));
 console.log('Previously existing files backed up to:',backupDir);
 console.log('Browser localStorage was NOT accessed, deleted or changed.');
 console.log('Run npm run build and test saved assessment routes before committing.');
 if(choice.registered.size<12) console.warn('[NOTE] Git snapshot contains fewer than 12 registered assessment types; this cannot independently verify all 15 types.');
}catch(err){
 console.error('[ERROR]',err.message);
 console.error('If any files changed, recover copies from:',backupDir);
 process.exit(1);
}
