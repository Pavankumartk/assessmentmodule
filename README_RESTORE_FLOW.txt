RESTORE ASSESSMENT OPENING / NAVIGATION — SURGICAL ROLLBACK

This patch reverses only the newly inserted Assessment Type form code from
Assessment_Type_Fixed_Header_Logout_Removal_Only.zip, in place, instead of
replacing any full TSX source files. It restores the exact previous source in:

- src/modules/assessments/components/common/steps/DetailsStep/DetailsStep.tsx
- src/modules/assessments/components/type-specific/long-answer/Details.tsx
- src/modules/assessments/components/type-specific/short-answer/Details.tsx
- src/modules/assessments/components/type-specific/one-word/Details.tsx

It does NOT alter any Header, Sidebar, Dashboard, Create step, Content step,
Evaluation step, review, viewer, routing file, CSS, data or storage. The
separate removal of the extra Header and Dashboard Logout buttons is retained.

WARNING: The previous ZIP replaced entire files. Any custom navigation/link
code that existed only on your Mac and not in the source uploaded earlier is
not reconstructible from the ZIP. The rollback preserves all such code that
still exists in your current files, but it cannot recreate code that was
already overwritten. If routes still fail, restore the affected file from
your last Git commit or a local backup rather than applying more full-file ZIPs.

HOW TO RUN (Mac Terminal)
1. Stop npm run dev (Control + C).
2. cd ~/Desktop/assessments/web
3. unzip -o ~/Downloads/Restore_Assessment_Previous_Flow_Only.zip -d .
4. node scripts/restore-assessment-flow.cjs --check
5. node scripts/restore-assessment-flow.cjs --apply
6. npm run build
7. npm run dev

--check previews the four surgical edits, without changing files.
--apply makes a complete backup OUTSIDE the web Git repository at:
    ~/Desktop/assessments/assessment-flow-backups/<timestamp>/...
It refuses to modify files if only some of the expected edits are present.

This rollback restores the previous editable Assessment Type control in those
four screens; that trade-off is necessary to reverse the previous component
change precisely. The existing chosen-type requirement can be reimplemented
later with the actual latest local files without interfering with routing.

Before applying any more patches, save a Git commit or ZIP of your current
working tree. Do NOT use git reset --hard or git clean -fd; those can destroy
other uncommitted work.
