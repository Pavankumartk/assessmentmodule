"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./mobile-landscape.css";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

const PORTRAIT_QUERY = "(orientation: portrait) and (pointer: coarse) and (max-width: 900px)";

const isSmallTouchDevice = () =>
  window.matchMedia("(pointer: coarse)").matches &&
  Math.min(window.screen.width, window.screen.height) <= 900;

export default function MobileLandscape({ children }: { children: ReactNode }) {
  const [portrait, setPortrait] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    const query = window.matchMedia(PORTRAIT_QUERY);
    const sync = () => setPortrait(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const requestLandscape = async () => {
      if (attempted.current || !isSmallTouchDevice()) return;
      attempted.current = true;

      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        const orientation = screen.orientation as LockableOrientation | undefined;
        await orientation?.lock?.("landscape");
      } catch {
        attempted.current = false;
      }
    };

    const handleTap = () => {
      void requestLandscape();
    };

    document.addEventListener("click", handleTap);
    return () => document.removeEventListener("click", handleTap);
  }, []);

  return (
    <>
      <div className="qc-landscape-root" inert={portrait}>
        {children}
      </div>
      {portrait && (
        <div className="qc-rotate-screen" role="alert">
          <div className="qc-rotate-badge">
            <span className="qc-rotate-phone" aria-hidden="true" />
          </div>
          <h2>Rotate your device</h2>
          <p>Quantum Champs plays in landscape. Turn your phone sideways to continue.</p>
        </div>
      )}
    </>
  );
}



// "use client";

// import { useEffect, useRef } from "react";
// import type { ReactNode } from "react";

// export default function MobileLandscape({
//   children,
// }: {
//   children: ReactNode;
// }) {
//   const attempted = useRef(false);

//   useEffect(() => {
//     const requestLandscape = async () => {
//       if (attempted.current) return;

//       const mobile = window.matchMedia(
//         "(max-width: 900px) and (orientation: portrait)"
//       ).matches;

//       if (!mobile) return;

//       attempted.current = true;

//       try {
//         if (!document.fullscreenElement) {
//           await document.documentElement.requestFullscreen();
//         }

//         await screen.orientation.lock("landscape");
//       } catch (error) {
//         attempted.current = false;
//         console.warn("Landscape orientation not supported:", error);
//       }
//     };

//     const handleTap = () => {
//       void requestLandscape();
//     };

//     document.addEventListener("click", handleTap);

//     return () => {
//       document.removeEventListener("click", handleTap);
//     };
//   }, []);

//   return <>{children}</>;
// }