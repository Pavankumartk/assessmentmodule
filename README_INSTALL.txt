AI Interview camera-specific repair

Files updated:
- src/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer.tsx
- src/modules/assessments/components/type-specific/ai-interviews-and-quizzes/viewai.css

From the assessment project root:
  unzip -o ~/Downloads/AI_Interview_Camera_Detection_And_Preview_Fix.zip -d .
  npm run build
  npm run dev

Changes: plain video:true browser default camera request; optional detected camera selection; diagnostic count and error name; verified live preview; no changes to other assessment types.

Camera permission is controlled by Chrome and macOS. No site code can force a missing/disabled camera to appear. Check chrome://settings/content/camera and macOS System Settings > Privacy & Security > Camera, and try FaceTime/Photo Booth if Chrome reports 0 cameras.
