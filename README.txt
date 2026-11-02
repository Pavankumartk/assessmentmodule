AI Interviews and Quizzes — Creator + Learner Viewer Registration Repair
======================================================================

This REPAIRS the existing integration in your Assessment Management Next.js project.
It does not overwrite any other assessment components or your text-editor toolbar.

IMPORTANT: Unzipping the ZIP alone only adds AI files and the Node installer.
You MUST run the installer to register AI in the existing assessment flow.

INSTALL:
1) Stop npm run dev (Control+C).
2) cd ~/Desktop/assessments/web
3) unzip -o ~/Downloads/AI_Assessment_Creator_Viewer_Integration_Repair.zip -d .
4) node repair_ai_assessment.cjs . --check
5) node repair_ai_assessment.cjs .
6) node repair_ai_assessment.cjs . --verify
7) npm run build
8) npm run dev

The --check command reports which shared files still need patching. It does NOT modify files.
The install command is 'node repair_ai_assessment.cjs .' (without --check).
The --verify command must print PASS. If STOPPED, do not force patches.

CREATOR:
AI Interviews and Quizzes > Details > Content > Evaluation > Review > Publish.
LEARNER:
Learner dashboard > AI Instructions > Camera/Mic preflight > Interview > Submit > Result.

THIS PACKAGE REPAIRS:
- assessment-types.ts catalogue and an existing AI type code/label if present
- component-registry.ts workflow adapter and QuestionMode
- AssessmentForm.tsx Content mapping, preserving 'use client' as first statement
- AssessmentContentEntry.tsx AI content/detail draft keys
- assessment-storage.ts AI content persistence when saving/publishing
- PageClient.tsx AI learner viewer selection

It copies the supplied AI creator/learner components ONLY if those files are missing.
Existing AI files remain unchanged, as do all other assessment types and editor files.

KNOWN LIMITS:
- The user-supplied Viewai.zip is an AI INTERVIEW viewer, not a separate MCQ-style quiz-taking UI.
- Real AI evaluation/grading, media uploads to a backend, and multi-device persistence are not supplied.
- This installer cannot automatically know whether your current project's UI contains another hardcoded type-selector mapping. If '--check' stops, share its exact output and the four files it names.

No Python.
