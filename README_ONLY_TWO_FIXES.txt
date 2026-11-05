FIX: Chosen Assessment Type (read only) + Extra Logout (Header and Dashboard)

Only 6 TSX files included. No CSS changes.
- Assessment Type now has its original visible heading/label and the same field background, width, height, and inset shadow, but no dropdown arrow and no click action. Its value comes from the assessment selected at the Type step and stored in the active assessment record.
- Fix applies to shared MCQ/other common details, Short Answer, One Word, and Long Answer details pages, where the dropdown existed.
- Removes the extra logout from the shared Header and from the Assessments dashboard heading (the previous fix missed this second one).
- The left sidebar Logout is untouched and remains the only Logout.
- Does not replace CSS, navigation, validation, viewer logic, scoring, or other files.

INSTALL (Mac):
cd ~/Desktop/assessments/web
# Commit or back up your files before installing.
unzip -o ~/Downloads/Assessment_Type_Fixed_Header_Logout_Removal_Only.zip -d .
npm run build
npm run dev

The supplied project ZIP and previous first-30 patch were used as the reference for these updated files. If you have made further edits to any of these six files since applying those patches, compare the ZIP first to avoid overwriting your newer changes.
