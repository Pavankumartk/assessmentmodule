/* Register ONLY the Image Dropdown subtype in the existing learner viewer.
   No overwrite of PageClient.tsx: inserts one import and one guarded render branch.
   Idempotent. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const file = path.join(root, 'src/app/assessments/[assessmentId]/viewer/PageClient.tsx');
const component = path.join(root, 'src/modules/assessments/components/type-specific/image-based/ImageDropdownViewer.tsx');
if (!fs.existsSync(file) || !fs.existsSync(component)) {
  console.error('STOPPED: Missing PageClient.tsx or ImageDropdownViewer.tsx; no changes made.');
  process.exit(1);
}
let source = fs.readFileSync(file, 'utf8');
if (source.includes('/* IMAGE_DROPDOWN_VIEWER_REGISTRATION */')) {
  console.log('OK: Image Dropdown viewer is already registered.');
  process.exit(0);
}
const anchor = /return\s*\(\s*<div\s+className=\{`assessment-variant assessment-variant--\$\{type\}`\}/;
const initial = source.search(anchor);
if (initial < 0 || !source.includes('getAssessment(') || !source.includes('const type')) {
  console.error('STOPPED: PageClient.tsx structure differs from the supported viewer layout; no changes made.');
  process.exit(2);
}
const statement = 'import ImageDropdownViewer from "@/modules/assessments/components/type-specific/image-based/ImageDropdownViewer";\n';
if (!source.includes(statement)) {
  const directive = /^\s*["']use client["'];?/m.exec(source);
  if (!directive) { console.error('STOPPED: PageClient.tsx lacks a client directive; no changes made.'); process.exit(2); }
  const insertAt = source.indexOf('\n', directive.index + directive[0].length) + 1;
  if (insertAt <= 0) throw new Error('Cannot locate use-client directive.');
  source = source.slice(0, insertAt) + '\n' + statement + source.slice(insertAt);
}
const insertAt = source.search(anchor);
if (insertAt < 0) throw new Error('Cannot locate default viewer return.');
const block = `/* IMAGE_DROPDOWN_VIEWER_REGISTRATION */
  // Only Image Dropdown. Do not route Image Labeling, Image Matching, etc. here.
  const dropdownRecord = getAssessment(assessmentId) as unknown as Record<string, unknown> | null;
  const dropdownInfo = dropdownRecord ?? {};
  const dropdownAsObject = (v: unknown): Record<string, unknown> => {
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    if (typeof v === "string") { try { const parsed: unknown = JSON.parse(v); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* Unstructured content. */ } }
    return {};
  };
  const dropdownContent = dropdownAsObject(dropdownInfo.content);
  const dropdownDetails = dropdownAsObject(dropdownInfo.details);
  const dropdownCode = String(type || "").toLowerCase();
  const dropdownDescriptor = [dropdownInfo.subtype, dropdownInfo.subType, dropdownInfo.variant,
    dropdownInfo.typeName, dropdownInfo.assessmentType, dropdownInfo.title,
    dropdownContent.subtype, dropdownContent.subType, dropdownContent.type,
    dropdownDetails.subtype, dropdownDetails.subType].filter(Boolean).join(" ");
  const isImageDropdown = /^(image[-_ ]?dropdowns?|dropdowns?[-_ ]?on[-_ ]?(the[-_ ]?)?picture)$/.test(dropdownCode)
    || (dropdownCode === "image-based" && /(?:\\bimage[-_ ]?dropdowns?\\b|\\bdropdowns?[-_ ]+on[-_ ]+(?:the[-_ ]+)?picture\\b)/i.test(dropdownDescriptor));
  if (isImageDropdown) {
    return <div className="assessment-variant assessment-variant--image-based"><ImageDropdownViewer /></div>;
  }

  `;
source = source.slice(0, insertAt) + block + source.slice(insertAt);
const tsPath = path.join(root, 'node_modules/typescript');
try { const ts = require(tsPath); const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); if (sf.parseDiagnostics.length) throw Error('TSX parse error: '+sf.parseDiagnostics[0].messageText); }
catch (err) { console.error('STOPPED: syntax validation failed or TypeScript missing. No changes made.', String(err)); process.exit(2); }
fs.writeFileSync(file, source);
console.log('OK: Registered Image Dropdown viewer (only). Other viewer branches preserved.');
