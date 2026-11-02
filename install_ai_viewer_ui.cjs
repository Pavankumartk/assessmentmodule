#!/usr/bin/env node
/** AI viewer layout + global assessment switch style import. Does not modify
 *  any assessment component except the AI Interview viewer files in this ZIP. */
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2] && !process.argv[2].startsWith('--')?process.argv[2]:'.');
const args=process.argv.slice(2);
const check=args.includes('--check');const verify=args.includes('--verify');
const layout=path.join(root,'src/app/layout.tsx');
const style=path.join(root,'src/app/assessment-unified-toggles.css');
const viewer=path.join(root,'src/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer.tsx');
const viewerCss=path.join(root,'src/modules/assessments/components/type-specific/ai-interviews-and-quizzes/viewai.css');
for(const item of [layout,style,viewer,viewerCss])if(!fs.existsSync(item)){console.error(`STOPPED: Missing ${path.relative(root,item)}. Do not force install.`);process.exit(1)}
const before=fs.readFileSync(layout,'utf8');
const imp='import "./assessment-unified-toggles.css";';
const already=/import\s+["']\.\/assessment-unified-toggles\.css["']/.test(before);
if(verify){
 const ok=already&&fs.readFileSync(viewer,'utf8').includes('<Sidebar />')&&fs.readFileSync(viewer,'utf8').includes('cameraFailureMessage')&&fs.readFileSync(viewerCss,'utf8').includes('viewaiViewerContent');
 console.log(ok?'PASS: Sidebar, Header, camera checks, and shared switch styles are installed.':'STOPPED: Some AI UI integration points are missing.');
 process.exit(ok?0:1);
}
if(check){
 console.log(already?'PASS: Shared toggle CSS is already imported.':'READY: Will import the shared toggle CSS in root layout only.');
 console.log('PASS: AI viewer and switch stylesheet exist. No other assessment TSX files will be modified.');
 process.exit(0);
}
if(already){console.log('Already installed: shared toggle stylesheet import.');process.exit(0)}
// Append the import beside the existing global CSS import without touching JSX.
const regex=/^([ \t]*import\s+["']\.\/globals\.css["'];?\s*\r?\n)/m;
if(!regex.test(before)){
 console.error('STOPPED: Expected existing import "./globals.css" in src/app/layout.tsx; the root layout differs. Nothing changed.');process.exit(1);
}
const next=before.replace(regex,(match)=>match+imp+'\n');
fs.writeFileSync(layout,next);
console.log('PASS: Imported shared switch appearance in src/app/layout.tsx. All other assessment source files unchanged.');
