ASSESSMENT MANAGEMENT - FIRST 30 LOGGED ENTRIES ONLY
Source: Use Case Testing.xlsx -> Assessment Management rows 2-31.
This is a PARTIAL, scope-restricted patch. Do not treat all 30 cases as resolved.
Rows 2 and 4 are marked Completed in the supplied testing workbook and were not targeted.

INSTALLATION (Mac):
cd ~/Desktop/assessments/web
# Strongly recommended: commit or back up your existing files before overwriting.
unzip -o ~/Downloads/Assessment_Management_First_30_Logged_Issues_Partial_Fix.zip -d .
npm run build
npm run dev

WHAT WAS UPDATED IN SOURCE (STATIC CHECK PASSED; NOT BROWSER-RETESTED):
Row 3: sidebar collapse chevron direction reversed (CSS only).
Row 6: Course picker displays actual course names, not category, program or organization values.
Row 7: Assessment Name is editable text; removes the fixed list restriction.
Row 8 (partial): changing course clears the previous module selection to prevent mismatched values. Actual course-specific module catalogue not supplied.
Row 9: tags now display a removal cross; existing add/removal behavior retained.
Row 10: generic Description/Instructions placeholder replaces an unrelated Java example.
Row 11 (partial): Pen color and Highlight now issue relevant formatting commands; attachment upload requires separate media-storage integration.
Row 13: Grade category is hidden when Grade to Pass is off.
Row 14: calendar displays DD/MM/YYYY and disables past dates (keeps internal ISO storage).
Row 15: the end availability field says Available to.
Row 16: Academic Year formatting uses an en dash.
Row 18 (partial): required fields include indicators where current validation already requires a value.
Row 20: Question Type in MCQ question builder is fixed to MCQ; dropdown replaced by the same disabled field.
Row 22: Evaluation Back cancels pending redirect and resets saving state.
Row 23: Explanation summary tick is absent when Show Explanation is off.
Row 24: assessment action menu closes on outside click and Escape; existing side-placement retained.
Row 25: Delete action now has a confirmation prompt and removes assessment and its saved drafts, limited to own tenant.
Row 26: previously completed/other wizard steps can be visited during Edit Assessment only; new assessment creation still prevents skipping ahead.
Row 27: View details opens a distinct read-only details page; Edit assessment remains an editable creator route.
Row 30: selecting a type does NOT create a draft; the Continue action creates it.
Row 31: Newest/Oldest sorts using createdAt, not a UUID id.

UNCHANGED / STILL NEEDS TESTING OR SOURCE DATA:
Rows 2 and 4: already Completed in source sheet; not modified.
Row 5: there is no course-category mapping/real course API in supplied code; cannot implement accurate category-dependent course lists without inventing data.
Row 8: the project only has a static AI module list; actual course-to-module mapping absent.
Row 11: attachments require a persistence design to work reliably; only pen/highlight corrected.
Row 12: 'irrelevant option' unspecified in text; needs screenshot/UI identification.
Row 17: official Department/Program lists not supplied; did not invent options.
Row 19: existing update() already clears inline validation on edits; runtime test is still required.
Row 21: 'locked and unnecessary field' is not identified in description; left untouched.
Row 28: blue input box needs reproduction/screenshot; no global styling override applied.
Row 29: intermittent navigation issue needs a reproducible browser trace; no unsafe global router changes made.

TYPECHECK VERIFICATION:
The source ZIP already has 15 TypeScript errors in unrelated components (including missing ViewerInstructions and memory-game files).
A TypeScript check before and after these changes reports the EXACT SAME 15 errors. No new TS errors introduced.
Full Next.js build cannot be certified from the Mac-generated dependencies (the supplied TypeScript binary lacks its Linux platform package); retest npm run build on your Mac.

Only included source paths were modified. No changes to saved assessments, styling outside the listed CSS, routes outside the new read-only details route, or assessment types outside these logged cases.
