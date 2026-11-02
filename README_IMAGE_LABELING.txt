IMAGE LABELING VIEWER — Figma-style learner screen

Updated files only:
  src/modules/assessments/components/type-specific/image-based/ImageLabelingViewer.tsx
  src/modules/assessments/components/type-specific/image-based/image-labeling-viewer.css
  scripts/install-image-labeling-viewer.cjs

INSTALL FROM YOUR Mac ASSESSMENT PROJECT:
  cd ~/Desktop/assessments/web
  unzip -o ~/Downloads/Image_Labeling_Viewer_Figma_Integration.zip -d .
  node scripts/install-image-labeling-viewer.cjs
  npm run build
  npm run dev

The installer adds only an import and one subtype-specific branch to your CURRENT
src/app/assessments/[assessmentId]/viewer/PageClient.tsx, preserving all other branches.
It refuses to run if that route has an unexpected layout, instead of replacing it.
Run the installer once. Repeated runs are harmless.

STYLE:
  #DFE6E9 background, Segoe UI, raised/inset cards, timer, image and numbered
  labels, choice dropdowns, Hint, Bloom level, flag, previous/next, navigator,
  tools, confirmation popup, submission popup, results and retry, responsive.
  No unrelated global CSS or creator changes.

DATA:
  Supports image-based records with image-labeling subtype and questions
  containing an image URL and labels/points/markers array.
  Each marker supports id, x/y (percentage or 0..1), label/correctLabel and
  options. If your creator saves another schema, map that schema to the
  normalizer in ImageLabelingViewer.tsx before using this in production.
  Figma export is a layout reference, not assessment question data.

NOTES:
  - Existing Image Matching, Image Sorting, Image Sequence and other
    assessment viewer components are not modified.
  - The generic image-based instruction screen remains in PageClient.tsx.
  - Submission and results are client/session-based in this component. Align
    with your production backend persistence/grading before release.
  - The image file and label coordinates come from saved creator questions;
    they are not invented by this patch.
