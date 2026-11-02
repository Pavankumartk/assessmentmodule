"use client";

import AIInterviewViewer from "@/modules/assessments/components/type-specific/ai-interviews-and-quizzes/Viewer";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ImageBasedViewer from "@/modules/assessments/components/type-specific/image-based/Viewer";
import ImageAssessmentInstructions from "@/modules/assessments/components/type-specific/image-based/ImageAssessmentInstructions";
import ConnectDotsAssessmentInstructions from "@/modules/assessments/components/type-specific/connect-the-dots/Instructions";
import MatchViewer from "@/modules/assessments/components/type-specific/match-the-following/Viewer";
import ClickableHotspotViewer from "@/modules/assessments/components/type-specific/clickable-hotspot/Viewer";
import ClickableHotspotInstructions from "@/modules/assessments/components/type-specific/clickable-hotspot/Instructions";
import ConnectDotsViewer from "@/modules/assessments/components/type-specific/connect-the-dots/Viewer";
import MemoryViewer from "@/modules/assessments/components/type-specific/memory-game/Viewer";
import Screen from "@/modules/assessments/components/viewer/AssessmentViewer/AssessmentViewer";
import ShortViewer from "@/modules/assessments/components/type-specific/short-answer/Viewer";
import OneViewer from "@/modules/assessments/components/type-specific/one-word/Viewer";

import {
  assessmentStorage,
  setActiveAssessmentId,
  getAssessment,
} from "@/modules/assessments/storage/assessment-storage";

import { getDemoSession } from "@/modules/assessments/auth/demo-auth";

import AssignmentViewer from "@/modules/assessments/components/type-specific/assignment/Viewer";

import ProblemSolvingViewer from "@/modules/assessments/components/type-specific/problem-solving/Viewer";
export default function PageClient() {
  const { assessmentId } = useParams<{
    assessmentId: string;
  }>();

  const router = useRouter();
  const [hotspotInstructionsNeeded, setHotspotInstructionsNeeded] = useState(false);
  const [ready, setReady] = useState(false);
  const [imageInstructionsNeeded, setImageInstructionsNeeded] = useState(false);
  const [connectDotsInstructionsNeeded, setConnectDotsInstructionsNeeded] = useState(false);

  const isPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "true";

  useEffect(() => {
    const session = getDemoSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const record = getAssessment(assessmentId);

    if (
      !record ||
      (record.tenantId || "north") !== session.tenantId
    ) {
      router.replace(
        session.role === "admin" ? "/assessments" : "/learner"
      );
      return;
    }

    if (
      isPreview
        ? session.role !== "admin"
        : session.role !== "learner" ||
          record.status !== "Published"
    ) {
      router.replace(
        session.role === "admin" ? "/assessments" : "/learner"
      );
      return;
    }

    setActiveAssessmentId(assessmentId);
    if (record.typeCode === "image-based" && !isPreview) {
      const params = new URLSearchParams(window.location.search);
      const instructionKey = `neurolxp.imageViewer.instructions.${assessmentId}`;
      let acceptedBefore = false;
      try { acceptedBefore = sessionStorage.getItem(instructionKey) === "accepted"; }
      catch { /* private browsing: show instructions */ }
      let completedMatching = false;
      try { completedMatching = sessionStorage.getItem(`neurolxp.imageViewer.matching.finished.${assessmentId}`) === "1"; }
      catch { /* Private browsing: no persisted completion marker. */ }
      setImageInstructionsNeeded(params.get("instructions") === "1" || params.get("retry") === "wrong" || !acceptedBefore || completedMatching);
    } else {
      setImageInstructionsNeeded(false);
    }
    // Connect the Dots uses the SAME instruction-first flow as the other assessments.
    // Its own session key prevents accepting instructions for one assessment from
    // accidentally skipping them on another assessment.
    if (record.typeCode === "connect-the-dots" && !isPreview) {
      const params = new URLSearchParams(window.location.search);
      let acceptedBefore = false;
      try {
        acceptedBefore = sessionStorage.getItem(`neurolxp.connectDotsViewer.instructions.${assessmentId}`) === "accepted";
      } catch { /* Show instructions when session storage is disabled. */ }
      setConnectDotsInstructionsNeeded(
        params.get("instructions") === "1" || params.get("retry") === "wrong" || !acceptedBefore
      );
    } else {
      setConnectDotsInstructionsNeeded(false);
    }
    if (record.typeCode === "clickable-hotspot" && !isPreview) {
      const params = new URLSearchParams(window.location.search);
      const key = `neurolxp.clickableHotspotViewer.instructions.${assessmentId}`;
      let accepted = false;
      try { accepted = sessionStorage.getItem(key) === "accepted"; }
      catch { /* Always show the instructions if storage is disabled. */ }
      setHotspotInstructionsNeeded(params.get("instructions") === "1" || params.get("retry") === "wrong" || !accepted);
    } else {
      setHotspotInstructionsNeeded(false);
    }
    // A learner's completed Hotspot attempt must not open again unless retry was explicitly requested.
    if (record.typeCode === "clickable-hotspot" && !isPreview) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("retry") !== "wrong") {
        try {
          const stored = JSON.parse(assessmentStorage.getItem("viewerAttemptDraft") || "{}");
          if (stored.finished) { router.replace("/learner"); return; }
        } catch { /* Invalid legacy attempt state: continue normally. */ }
      }
    }
    setReady(true);
  }, [assessmentId, isPreview, router]);

  const type = ready
    ? getAssessment(assessmentId)?.typeCode
    : null;

  const Viewer =
     (type === "ai-interviews-and-quizzes" || type === "ai-interview" || type === "ai-interviews" || type === "ai-interviews-quizzes" || type === "ai-interviews-and-quizes" || type === "ai-assessment") ? AIInterviewViewer : (type === "problem-solving-challenge" || type === "problem-solving") ? ProblemSolvingViewer : type === "assignment" ? AssignmentViewer : type === "clickable-hotspot"
      ? ClickableHotspotViewer
      : type === "image-based"
      ? ImageBasedViewer
      : type === "match-the-following"
      ? MatchViewer
      : type === "connect-the-dots"
      ? ConnectDotsViewer
      : type === "memory-game"
      ? MemoryViewer
      : type === "short-answer"
        ? ShortViewer
        : type === "one-word"
          ? OneViewer
          : Screen;

  if (!ready || !type) {
    return null;
  }

  if (type === "image-based" && imageInstructionsNeeded) {
    return <div className="assessment-variant assessment-variant--image-based">
      <ImageAssessmentInstructions assessmentId={assessmentId} onStart={() => {
        try {
          sessionStorage.setItem(`neurolxp.imageViewer.instructions.${assessmentId}`, "accepted");
          // Explicitly starting the test creates a new Image Matching attempt.
          // Other image viewers ignore this marker and remain unchanged.
          sessionStorage.setItem(`neurolxp.imageViewer.matching.run.${assessmentId}`, String(Date.now()));
          sessionStorage.removeItem(`neurolxp.imageViewer.matching.finished.${assessmentId}`);
        } catch { /* continue in this tab */ }
        const url = new URL(window.location.href);
        url.searchParams.delete("instructions");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        setImageInstructionsNeeded(false);
      }} />
    </div>;
  }

  if (type === "connect-the-dots" && connectDotsInstructionsNeeded) {
    return <div className="assessment-variant assessment-variant--connect-the-dots">
      <ConnectDotsAssessmentInstructions assessmentId={assessmentId} onStart={() => {
        try {
          sessionStorage.setItem(`neurolxp.connectDotsViewer.instructions.${assessmentId}`, "accepted");
        } catch { /* Continue without session storage. */ }
        const url = new URL(window.location.href);
        url.searchParams.delete("instructions");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        setConnectDotsInstructionsNeeded(false);
      }} />
    </div>;
  }

  if (type === "clickable-hotspot" && hotspotInstructionsNeeded) {
    return <div className="assessment-variant assessment-variant--clickable-hotspot">
      <ClickableHotspotInstructions assessmentId={assessmentId} onStart={() => {
        try { sessionStorage.setItem(`neurolxp.clickableHotspotViewer.instructions.${assessmentId}`, "accepted"); }
        catch { /* Continue in this tab. */ }
        const url = new URL(window.location.href);
        url.searchParams.delete("instructions");
        window.history.replaceState(window.history.state,"",`${url.pathname}${url.search}${url.hash}`);
        setHotspotInstructionsNeeded(false);
      }}/>
    </div>;
  }

  return (
    <div className={`assessment-variant assessment-variant--${type}`}>
      <Viewer />
    </div>
  );
}