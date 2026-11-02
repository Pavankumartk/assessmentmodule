#!/usr/bin/env node
"use strict";
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'.');
const base=path.join(root,'public/assets/aiicons');
const names=["mic-vocal.svg","camera-01.svg","volume-off.svg","arrow-right-double.svg","alert-01.svg","checkmark-badge.svg","info.svg","headphones.svg","reload.svg"];
const viewer=path.join(root,'src/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer.tsx');
let missing=0;
console.log('AI Interview icon folder:',base);
for(const name of names){const file=path.join(base,name);const exists=fs.existsSync(file)&&fs.statSync(file).size>30;console.log((exists?'OK     ':'MISSING')+' /assets/aiicons/'+name);if(!exists)missing++;}
if(fs.existsSync(viewer)){ const contents=fs.readFileSync(viewer,'utf8'); console.log('Viewer base path:',contents.includes('const ICONS = "/assets/aiicons/";')?'OK — /assets/aiicons/':'CHECK YOUR VIEWER FILE');}
else console.log('Viewer.tsx not found at expected path; icons may still work if your viewer is elsewhere.');
console.log(missing===0?'PASS: All 9 AI viewer SVG paths exist.':'MISSING: '+missing+' AI viewer icon files.');
if(missing)process.exitCode=1;
