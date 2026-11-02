/* Exact scope: the existing image-based learner viewer route, NOT global CSS.
   Preview first using --check. Apply with --apply. Reversible via .backup file. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const apply = process.argv.includes('--apply');
const file = path.join(root,'src/app/assessments/[assessmentId]/viewer/PageClient.tsx');
const component = path.join(root,'src/modules/assessments/components/type-specific/image-based/ImageViewerMCQSurfaceFix.tsx');
const css = path.join(root,'src/modules/assessments/components/type-specific/image-based/image-viewer-mcq-surface.css');
if (![file,component,css].every(fs.existsSync)) {
  console.error('STOPPED: Viewer route or patch component is missing. No project files changed.');
  process.exit(1);
}
let ts;
try { ts=require(path.join(root,'node_modules/typescript')); }
catch {try {ts=require('typescript');}catch {console.error('STOPPED: TypeScript is missing. Run npm install.');process.exit(1);}}
const before=fs.readFileSync(file,'utf8');
const marker='/* IMAGE_BASED_MCQ_RIGHT_BAR_FIX */';
if(before.includes(marker)) {console.log('ALREADY INSTALLED. No changes made.'); process.exit(0);}
const sf=ts.createSourceFile(file,before,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(sf.parseDiagnostics.length){console.error('STOPPED: Existing PageClient.tsx has parsing errors.');process.exit(2);}
if(!/import\s+ImageBasedViewer\s+from\s+["']@\/modules\/assessments\/components\/type-specific\/image-based\/Viewer["']/.test(before)
  || !/\bgetAssessment\s*\(assessmentId\)/.test(before)
  || !/\bconst\s+Viewer\s*=/.test(before)
  || !/\bconst\s+type\s*=/.test(before)) {
  console.error('STOPPED: Unrecognized PageClient viewer routing. No changes made.'); process.exit(2);
}
let working=before;
// The former image-sequence compact fix HID the navigator. Restore it by
// removing ONLY that exact installer block, if it is present.
const oldMarker='/* IMAGE_SEQUENCE_COMPACT_VIEW_ONLY */';
if(working.includes(oldMarker)) {
  const begin=working.indexOf(oldMarker);
  const closing='</ImageSequencingViewerCompact>';
  const closingAt=working.indexOf(closing,begin);
  const closeBlock=closingAt>=0 ? working.indexOf('\n  }',closingAt+closing.length) : -1;
  const end=closeBlock>=0 ? closeBlock+'\n  }'.length : -1;
  const old=working.slice(begin,end<0?begin:end);
  if(end<0 || !old.includes('isImageSequencingViewer') || !old.includes('return (') ||
     !old.includes('const sequenceRecord =') || !old.includes('const sequenceDescriptor =')) {
    console.error('STOPPED: Previous sequencing block differs from known patch. No automatic removal.');process.exit(2);
  }
  working=working.slice(0,begin)+working.slice(end);
  const oldImport=/^import ImageSequencingViewerCompact from ["']@\/modules\/assessments\/components\/type-specific\/image-based\/ImageSequencingViewerCompact["'];?\r?\n/m;
  working=working.replace(oldImport,'');
  console.log('RESTORE: Remove old Image Sequencing compact wrapper that hid the right navigator.');
}
const anchor='\n  return (\n    <div className={`assessment-variant assessment-variant--${type}`}>';
const start=working.lastIndexOf(anchor);
if(start<0 || working.indexOf(anchor)!==start) {
 console.error('STOPPED: Default viewer return not found uniquely. No changes made.'); process.exit(2);
}
const branch=`\n  ${marker}
  // Existing image-based viewer only; extra Image Labeling/Dropdown routes
  // continue to use their own components and are not altered.
  if (type === "image-based") {
    const imageViewerRecord = getAssessment(assessmentId) as unknown as Record<string, unknown> | null;
    const imageViewerObj = (raw: unknown): Record<string, unknown> => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
      if (typeof raw === "string") { try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* Keep empty metadata. */ } }
      return {};
    };
    const imageViewerInfo = imageViewerRecord ?? {};
    const imageViewerContent = imageViewerObj(imageViewerInfo.content);
    const imageViewerDetails = imageViewerObj(imageViewerInfo.details);
    const imageViewerDescriptor = [imageViewerInfo.subtype, imageViewerInfo.subType,
      imageViewerInfo.variant, imageViewerInfo.imageType, imageViewerInfo.typeName,
      imageViewerInfo.title, imageViewerContent.subtype, imageViewerContent.subType,
      imageViewerContent.variant, imageViewerContent.type,
      imageViewerDetails.subtype, imageViewerDetails.subType].filter(Boolean).join(" ");
    const isImageSorting = /image[\\s_-]*sort(?:ing)?|sort(?:ing)?[\\s_-]*image/i.test(imageViewerDescriptor);
    return (
      <div className={"assessment-variant assessment-variant--" + type}>
        <ImageViewerMCQSurfaceFix isImageSorting={isImageSorting}><Viewer /></ImageViewerMCQSurfaceFix>
      </div>
    );
  }
`;
working=working.slice(0,start)+branch+working.slice(start);
const importLine='import ImageViewerMCQSurfaceFix from "@/modules/assessments/components/type-specific/image-based/ImageViewerMCQSurfaceFix";\n';
const directive=/^[ \t]*["']use client["'];?[ \t]*$/m.exec(working);
if(!directive) {console.error('STOPPED: use client directive missing.');process.exit(2);}
const newline=working.indexOf('\n',directive.index+directive[0].length);
working=working.slice(0,newline+1)+'\n'+importLine+working.slice(newline+1);
const parsed=ts.createSourceFile(file,working,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(parsed.parseDiagnostics.length) {
 console.error('STOPPED: Patch would cause TSX parsing errors: '+parsed.parseDiagnostics[0].messageText);process.exit(2);
}
console.log('TARGET: '+path.relative(root,file));
console.log('IMAGE VIEWER: Hide only Check Answer buttons; retain MCQ-style right panel.');
console.log('IMAGE SORTING: Apply scoped Figma field/card styling. No functionality changed.');
console.log('UNCHANGED: All other assessment types, routing, questions, scoring, Previous/Next/Submit, results and retry.');
if(!apply) console.log('CHECK ONLY. Run with --apply to install.');
else {
 const backup=file+'.before-image-mcq-surface-fix.bak';
 if(!fs.existsSync(backup)) fs.copyFileSync(file,backup);
 const tmp=file+'.image-viewer-mcq-tmp';
 try { fs.writeFileSync(tmp,working);fs.renameSync(tmp,file); }
 catch(err){if(fs.existsSync(tmp))fs.unlinkSync(tmp);throw err;}
 console.log('INSTALLED. Original viewer route backed up to: '+path.relative(root,backup));
}
