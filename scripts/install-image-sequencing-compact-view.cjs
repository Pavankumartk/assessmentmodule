/* Installs the compact UI ONLY for Image Sequencing, using the existing viewer.
   --check (default) previews; --apply updates PageClient.tsx.
   Refuses to alter unknown layouts. Does not edit other viewer modules. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const apply = process.argv.includes('--apply');
const target = path.join(root,'src/app/assessments/[assessmentId]/viewer/PageClient.tsx');
const comp = path.join(root,'src/modules/assessments/components/type-specific/image-based/ImageSequencingViewerCompact.tsx');
const css = path.join(root,'src/modules/assessments/components/type-specific/image-based/image-sequencing-compact.css');
if (![target,comp,css].every(f=>fs.existsSync(f))) {
  console.error('STOPPED: Existing PageClient.tsx or the two compact-view files are missing; no changes made.');
  process.exit(1);
}
let ts;
try { ts=require(path.join(root,'node_modules/typescript')); }
catch { try { ts=require('typescript'); } catch { console.error('STOPPED: TypeScript is required; no changes made.'); process.exit(1); } }
const original=fs.readFileSync(target,'utf8');
const marker='/* IMAGE_SEQUENCE_COMPACT_VIEW_ONLY */';
if (original.includes(marker)) {
  console.log('ALREADY INSTALLED: Image Sequencing compact view. No changes made.');
  process.exit(0);
}
if (!/^[\s\S]*?["']use client["'];?/m.test(original) || !/\bgetAssessment\s*\(/.test(original) || !/\bassessmentId\b/.test(original) || !/\bconst\s+Viewer\b/.test(original) || !/\bconst\s+type\b/.test(original)) {
  console.error('STOPPED: The current PageClient.tsx differs from the supported viewer flow; no changes made.');
  process.exit(2);
}
const sf=ts.createSourceFile(target,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if (sf.parseDiagnostics.length) { console.error('STOPPED: PageClient.tsx already contains TSX parse errors; no changes made.');process.exit(2); }
const anchor=/\breturn\s*\(\s*<div\s+className=\{`assessment-variant assessment-variant--\$\{type\}`\}/g;
const matches=[...original.matchAll(anchor)];
if(matches.length!==1) {
  console.error('STOPPED: Could not identify the unique default learner viewer return; no changes made.');
  process.exit(2);
}
const importLine='import ImageSequencingViewerCompact from "@/modules/assessments/components/type-specific/image-based/ImageSequencingViewerCompact";\n';
const branch=`${marker}
  // Strictly limited to the Image Sequencing subtype, not Image Sorting,
  // Image Labeling, Image Matching, MCQ or any other assessment.
  const sequenceRecord = getAssessment(assessmentId) as unknown as Record<string, unknown> | null;
  const sequenceParseMeta = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === "string") {
      try { const value: unknown = JSON.parse(raw); if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>; }
      catch { /* Not JSON. */ }
    }
    return {};
  };
  const sequenceInfo = sequenceRecord ?? {};
  const sequenceContent = sequenceParseMeta(sequenceInfo.content);
  const sequenceDetails = sequenceParseMeta(sequenceInfo.details);
  const sequenceDescriptor = [type, sequenceInfo.subtype, sequenceInfo.subType, sequenceInfo.variant,
    sequenceInfo.typeName, sequenceInfo.assessmentType, sequenceInfo.imageType,
    sequenceContent.subtype, sequenceContent.subType, sequenceContent.variant,
    sequenceContent.type, sequenceDetails.subtype, sequenceDetails.subType,
    sequenceInfo.title].filter(Boolean).join(" ");
  const isImageSequencingViewer = /(?:image[\\s_-]*sequenc(?:e|ing)|sequenc(?:e|ing)[\\s_-]*image)/i.test(sequenceDescriptor)
    && (String(type).toLowerCase() === "image-based" || /sequenc/i.test(String(type)));
  if (isImageSequencingViewer) {
    return (
      <div className={\`assessment-variant assessment-variant--\${type}\`}>
        <ImageSequencingViewerCompact><Viewer /></ImageSequencingViewerCompact>
      </div>
    );
  }

  `;
let next=original.slice(0,matches[0].index)+branch+original.slice(matches[0].index);
if(!next.includes(importLine)){
  const directive=/^[ \t]*["']use client["'];?[ \t]*$/m.exec(next);
  if(!directive) {console.error('STOPPED: use-client directive not found; no changes made.');process.exit(2);}
  const e=next.indexOf('\n',directive.index+directive[0].length);
  if(e<0){console.error('STOPPED: Invalid directive placement; no changes made.');process.exit(2);}
  next=next.slice(0,e+1)+'\n'+importLine+next.slice(e+1);
}
const changed=ts.createSourceFile(target,next,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(changed.parseDiagnostics.length) {
 console.error('STOPPED: Generated TSX is invalid; no changes made. '+changed.parseDiagnostics[0].messageText);
 process.exit(2);
}
console.log('TARGET: '+path.relative(root,target));
console.log('CHANGE: Import the Image Sequencing-only compact-view wrapper.');
console.log('CHANGE: Add one subtype-guarded render branch before the existing default return.');
console.log('UNCHANGED: Other viewer routing, assessment answers, scoring, header, left sidebar and navigation.');
if(!apply)console.log('PREVIEW ONLY. Run node scripts/install-image-sequencing-compact-view.cjs --apply to install.');
else {
  const tmp=target+'.image-sequence-tmp';
  try {fs.writeFileSync(tmp,next);fs.renameSync(tmp,target);} catch(err) {if(fs.existsSync(tmp))fs.unlinkSync(tmp);throw err;}
  console.log('INSTALLED: Image Sequencing-only compact UI.');
}
