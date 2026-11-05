MINIMAL FIX: Next.js 16.4.0 CLIENT_HOOK_DYNAMIC error during production build.

Only changed file:
src/app/assessments/[assessmentId]/details/page.tsx

Cause: useParams() was called in the page component without a parent Suspense boundary. Fix: wrap its unchanged content with React Suspense; the original JSX, state, routes, styles, and interactions are unchanged.

Installation in Mac Terminal (stop npm run dev first):
cd ~/Desktop/assessments/web
unzip -o ~/Downloads/Assessment_Details_UseParams_Suspense_Only.zip -d .
npm run build
npm run dev

No other source file is in this ZIP.
