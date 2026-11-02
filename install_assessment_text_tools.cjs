#!/usr/bin/env node
/* Install a scoped assessment creator editor toolbar into the existing App Router layout. */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]&& !process.argv[2].startsWith('--')?process.argv[2]:'.');
const mode=process.argv.find(s=>['--check','--verify','--apply'].includes(s))||'--check';
const layout=[path.join(root,'src/app/layout.tsx'),path.join(root,'app/layout.tsx')].find(fs.existsSync);
if(!layout){console.error('STOPPED: Could not locate Next.js App Router layout.tsx. No changes made.');process.exit(1);}
const appDir=path.dirname(layout);
const source=path.join(__dirname,'src/app');
const needed=['AssessmentTextToolbarEnhancer.tsx','assessment-text-tools.css'];
const files=needed.map(f=>({target:path.join(appDir,f),source:path.join(source,f)}));
const marker='import AssessmentTextToolbarEnhancer from "./AssessmentTextToolbarEnhancer";';
const content=fs.readFileSync(layout,'utf8');
const hasImport=/import\s+AssessmentTextToolbarEnhancer\s+from\s+["']\.\/AssessmentTextToolbarEnhancer["'];?/.test(content);
const hasComponent=/<AssessmentTextToolbarEnhancer\s*\/>/.test(content);
const bodyMatch=content.match(/<body\b[^>]*>/);
if(!bodyMatch){console.error('STOPPED: layout.tsx has no standard <body> tag. No changes made.');process.exit(1);}
if(hasImport!==hasComponent){console.error('STOPPED: Toolbar partially installed in layout. No changes made; inspect layout.tsx.');process.exit(1);}
if(mode==='--verify'){
 let ok=hasImport&&hasComponent&&files.every(({target,source})=>fs.existsSync(target)&&fs.readFileSync(target,'utf8')===fs.readFileSync(source,'utf8'));
 console.log(ok?'PASS: Toolbar installed; only creator editors are enhanced.':'NOT INSTALLED or files differ.');process.exit(ok?0:1);
}
console.log('App Router layout:',path.relative(root,layout));
console.log('Will add/verify 2 editor-only files:',files.map(x=>path.relative(root,x.target)));
console.log('Will modify layout.tsx by adding one import and one client component inside <body>.');
if(mode==='--check'){console.log('CHECK PASSED: no files modified.');process.exit(0);}
if(!hasImport){
 // Never overwrite the layout or replace existing providers. Keep a backup outside the repository.
 const backupDir=path.join(root,'.git','assessment-toolbar-backups');
 if(fs.existsSync(path.join(root,'.git'))){fs.mkdirSync(backupDir,{recursive:true});const backup=path.join(backupDir,`layout-${new Date().toISOString().replace(/[:.]/g,'-')}.tsx`);fs.copyFileSync(layout,backup);console.log('Layout backup:',path.relative(root,backup));}
 const replacement=content.replace(bodyMatch[0],bodyMatch[0]+'\n        <AssessmentTextToolbarEnhancer />');
 const clientDirective=/^\s*(["'])use client\1;?\s*/.exec(replacement);
 // Put import after client directive when present, otherwise before current imports.
 const updated=clientDirective?replacement.slice(0,clientDirective[0].length)+'\n'+marker+replacement.slice(clientDirective[0].length):marker+'\n'+replacement;
 fs.writeFileSync(layout,updated);
}
for(const file of files){fs.copyFileSync(file.source,file.target);}
console.log('INSTALLED: assessment rich-text toolbar extension. Run --verify then npm run build.');
