ASSESSMENT ROUTES RECOVERY — preserves existing browser data
===========================================================

IMPORTANT
- The project source ZIP previously supplied to ChatGPT contained only 3
  registered workflows, while your Mac project may have 15 or more.
- Some earlier patch ZIPs contained old copies of shared assessment code.
  Replacing a newer CreateStep/AssessmentDashboard with those older files can
  make saved assessments appear unsupported or prevent their routes from opening.
- This installer reads YOUR local Git history and compares it to your current
  source. It never fabricates or substitutes an MCQ workflow for another type.
- It never clears localStorage, sessionStorage, saved questions or drafts.
- It DOES NOT replace Header, Sidebar, existing CSS, layout, colours,
  icons or other UI. Missing Git-tracked assessment CSS may be re-added.
- It stops when a file has newer or unrecognized changes, so it cannot always
  restore everything automatically. DO NOT force a restore if it stops.

HOW TO USE
1. In the Mac Terminal, stop dev server with Control+C.
2. BACK UP your current project and browser site data before making changes.
3. From your assessment project root:

    cd ~/Desktop/assessments/web
    unzip -o ~/Downloads/Restore_All_Assessment_Routes_From_Git_Safely.zip -d .
    node scripts/restore-assessment-routes.cjs --check

4. REVIEW the printed list of changes and confirm the Git snapshot includes
   at least the same assessment modules as your current code.
5. Only if the preview is correct:

    node scripts/restore-assessment-routes.cjs --apply
    npm run build
    npm run dev

6. Verify: MCQ, One Word, Short Answer, True/False, Fill Blanks, Long Answer,
   Drag & Drop, Memory Game, Match the Following, Assignment, Image Matching,
   Image Labeling, Image Sorting, Image Sequencing, Connect the Dots and other
   types actually present in YOUR Git history. Existing saved items must still
   appear, and Edit, Preview and Viewer should open the right saved item.

WHAT THE INSTALLER CAN SAFELY RESTORE
- Route-related source files known to have been overwritten by previous patches
  IF the active file is an exact copy of one of those known old variants.
- Missing creator/viewer route files and type-specific components which exist
  in your own Git commit, without overwriting current files.
- Older registry/AssessmentForm files only if their fingerprints match the
  previously supplied old project source.
- Creates backups outside your Git repository: ../assessment-route-recovery-backups/

WHAT IT CANNOT DO
- Restore saved browser data that was manually deleted or cleared (the source
  ZIP does not include your Chrome localStorage).
- Recover code that was NEVER committed to Git or included in the uploaded ZIP.
- Infer exact missing assessment types or implement 15 complete workflows from
  incomplete source code. It will print a warning if fewer than 12 registered
  types are found in the Git snapshot.

READ-ONLY CHECK FOR SAVED ASSESSMENTS
In Chrome at http://localhost:3000, open DevTools > Console and run:

    JSON.parse(localStorage.getItem('neurolxp.assessments.v1') || '[]').map(a => ({id:a.id,title:a.title,type:a.typeCode,status:a.status}))

This only reads data. It does NOT remove, reset or modify any assessment.
If the array has saved items, the records still exist in that browser profile.
If empty, check that you are using the SAME Chrome profile and localhost:3000.

If the recovery tool says STOP, send its printed CHECK output and the CURRENT
src folder ZIP. Your original source ZIP is not enough to reconstruct all 15.
