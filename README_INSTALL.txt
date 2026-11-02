IMAGE-BASED VIEWER: REMOVE CHECK ANSWER / RESTORE MCQ-STYLE RIGHT PANEL / IMAGE SORTING REFERENCE STYLING

Scope:
  - Only the existing image-based learner viewer (src/app/assessments/[assessmentId]/viewer/PageClient.tsx).
  - Removes the visible Check Answer control WITHOUT changing assessment state or scoring.
  - Keeps the right-side question navigator and Tools panel (Scratch pad, Calculator, Formula sheet).
  - If the former Image Sequencing compact patch is installed, removes ONLY its guarded branch
    because that branch hid the question navigator. Does not touch any other assessment branch.
  - Applies the uploaded Image Sorting reference's 740px/328px two-column proportions on
    desktop and neumorphic selection styling, only for the Image Sorting subtype.
  - Existing image sort/order drag actions, Next, Previous, Submit, retry and results remain as before.
  - No assets or icons are replaced. No files from other assessment types are included.

Install in your existing project (Mac):
  cd ~/Desktop/assessments/web
  unzip -o ~/Downloads/Image_Sorting_MCQ_Right_Panel_Check_Answer_Fix.zip -d .
  node scripts/install-image-sorting-mcq-sidebar-fix.cjs --check
  node scripts/install-image-sorting-mcq-sidebar-fix.cjs --apply
  npm run build
  npm run dev

An untouched backup of your original PageClient.tsx is saved as
  src/app/assessments/[assessmentId]/viewer/PageClient.tsx.before-image-mcq-surface-fix.bak

The installer validates the known viewer structure and stops without modifying
PageClient.tsx if its routing differs, rather than risking other assessments.

Verification completed: installer syntax; TSX syntax for generated PageClient.tsx
both WITH and WITHOUT the earlier Image Sequencing patch; component TSX parsing.
The actual local Mac project build and pixel-perfect Figma comparison are NOT
verifiable here because the complete original image sorting viewer TSX and CSS
were not uploaded. The layout styling is the conservative portion of the Figma
reference, not a replacement for your existing sorting UI or functionality.

No Python used.
