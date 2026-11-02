/* Non-destructive Image Labeling viewer registration.
 * Run from the Assessment Next.js project root after unzipping the patch.
 * Does not rewrite or replace other assessment viewer components.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const route = path.join(root, 'src/app/assessments/[assessmentId]/viewer/PageClient.tsx');
const component = path.join(root, 'src/modules/assessments/components/type-specific/image-based/ImageLabelingViewer.tsx');
if (!fs.existsSync(route) || !fs.existsSync(component)) {
  console.error('Missing PageClient.tsx or ImageLabelingViewer.tsx. Run from the project root after unzipping the ZIP.');
  process.exitCode = 1;
} else {
  let src = fs.readFileSync(route, 'utf8');
  if (src.includes('/* IMAGE_LABELING_VIEWER_REGISTRATION */')) {
    console.log('Image Labeling viewer is already registered. No changes needed.');
  } else {
    const anchor = /return\s*\(\s*<div\s+className=\{`assessment-variant assessment-variant--\$\{type\}`\}/;
    const at = src.search(anchor);
    if (at < 0 || !src.includes('getAssessment(')) {
      console.error('Existing PageClient.tsx has a different structure; no changes made. Paste its contents into ChatGPT for an exact safe integration.');
      process.exitCode = 2;
    } else {
      const imp = 'import ImageLabelingViewer from "@/modules/assessments/components/type-specific/image-based/ImageLabelingViewer";\n';
      const afterImports = src.indexOf('\n', src.indexOf('"use client";')) + 1;
      if (afterImports < 1) throw new Error('PageClient must begin with "use client";');
      src = src.slice(0, afterImports) + '\n' + imp + src.slice(afterImports);
      const newAt = src.search(anchor);
      const injection = `/* IMAGE_LABELING_VIEWER_REGISTRATION */
  // Detect only the Image Labeling subtype, leaving other image-based assessments untouched.
  const imageLabelingRecord = getAssessment(assessmentId) as unknown as Record<string, unknown> | null;
  const labelData = imageLabelingRecord ?? {};
  const labelContent = (labelData.content && typeof labelData.content === "object" ? labelData.content : {}) as Record<string, unknown>;
  const labelDetails = (labelData.details && typeof labelData.details === "object" ? labelData.details : {}) as Record<string, unknown>;
  const labelTypeInfo = [labelData.typeCode, labelData.subtype, labelData.subType, labelData.variant, labelData.typeName, labelData.assessmentType, labelData.title, labelContent.subtype, labelContent.type, labelDetails.subtype].filter(Boolean).join(" ");
  if ((type === "image-based" || type === "image-labeling" || type === "image-labelling") && /(?:image[\\s_-]*)?labell?ing/i.test(labelTypeInfo)) {
    return <div className="assessment-variant assessment-variant--image-based"><ImageLabelingViewer /></div>;
  }

  `;
      src = src.slice(0, newAt) + injection + src.slice(newAt);
      fs.writeFileSync(route, src, 'utf8');
      console.log('Registered Image Labeling viewer in existing PageClient.tsx. Other assessment dispatch branches preserved.');
    }
  }
}
