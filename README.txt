IMAGE DROPDOWN VIEWER + CHECK ANSWER REMOVAL — MINIMAL CHANGES

1) Unzip in assessment project root:
   cd ~/Desktop/assessments/web
   unzip -o ~/Downloads/Image_Dropdown_Check_Answer_Only_Fix.zip -d .

2) Register only Image Dropdown viewer:
   node scripts/install-image-dropdown-viewer.cjs

3) Preview exact Check Answer buttons in assessment VIEWER/PREVIEW TSX files:
   node scripts/remove-check-answer-viewers.cjs --check

4) Remove only those Check Answer JSX buttons:
   node scripts/remove-check-answer-viewers.cjs --apply

5) Verify & start:
   npm run build
   npm run dev

ONLY NEW FILES plus two narrowly scoped Node scripts.
Image Dropdown adds on-image raised Choose... selectors that match supplied Figma.
Other assessment rendering branches, states, scores, navigation and CSS are not replaced.
Check Answer script targets viewer/preview JSX buttons labelled Check Answer, not any other button.
This package expects the previously supplied Image Labeling viewer files to be installed,
so it can reuse that layout's stylesheet. It does not overwrite the Image Labeling viewer.
If PageClient.tsx has a different structure, the installer STOPS rather than risking modifications.
