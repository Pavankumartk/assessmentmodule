RESTORE ASSESSMENT FLOWS FROM A KNOWN-WORKING GIT VERSION
=================================================

This ZIP contains a *recovery utility*, not the old incomplete assessment source.
It DOES NOT contain fake or empty assessment pages, sample question builders, or any replacement TSX/CSS files.

Why: The supplied Assessment.zip was an older incomplete copy. Copying it over your modern project can disconnect newly implemented assessment types.

1) Stop npm run dev with Control+C.
2) Make a backup of your present project and keep Chrome site data intact:
      cd ~/Desktop/assessments/web
      mkdir -p ../assessment-safety-backup
      cp -R src ../assessment-safety-backup/src-before-recovery
3) Unzip this ZIP into ~/Desktop/assessments/web.
4) READ ONLY: list candidate historic Git versions:
      node scripts/restore-working-assessments.cjs --check
5) Read the results. Choose a commit from BEFORE the broken patches when your workflows all worked. The tool requires evidence of at least 12 assessment types, the Creator form, viewer route, and absence of the old placeholder before it can restore.
6) PREVIEW what files would be changed:
      node scripts/restore-working-assessments.cjs --check --commit=PASTE_SHA_HERE
7) RESTORE from that explicitly selected version ONLY:
      node scripts/restore-working-assessments.cjs --apply --commit=PASTE_SHA_HERE

The utility only restores assessment-related source files from the selected Git version and never clears localStorage, alters database contents, deletes any source files that exist only in the current project, or edits unrelated app routes. It backs up overwritten files OUTSIDE the repo. After restoration it runs npm run build; a build failure triggers a rollback of the files changed by this utility. It does not change CSS to a new design: it restores CSS from your previous working version.

IMPORTANT:
 - If the check says STOP, DO NOT force it or copy another old ZIP into the project.
 - Source code restoration cannot guarantee 15+ flows without a known working snapshot.
 - Browser functional tests still must be done even if npm run build passes.
 - Keep Chrome localStorage (saved assessment records and drafts) intact.
 - Do not run git reset --hard / git clean -fd / npm cache clean; none are necessary for this recovery.
 - If check STOPs, send the complete terminal output and a new ZIP of the CURRENT web/src folder and pre-patch backups so individual flows can be recovered.
 - This script does NOT push to GitHub.
