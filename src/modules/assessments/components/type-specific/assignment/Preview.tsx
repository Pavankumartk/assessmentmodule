"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssessmentId, getAssessment } from "@/modules/assessments/storage/assessment-storage";
import { AssignmentShell, Panel } from "./AssignmentUI";
import { CONTENT_KEY, defaultContent, readAssignment, type AssignmentContent } from "./assignment-data";
import "./assignment-preview.css";

const onOff = (value: boolean) => (value ? "Enabled" : "Disabled");
const shown = (value: string | number) => value === "" || value === 0 ? "Not entered" : String(value);

export default function AssignmentPreview() {
  const router = useRouter();
  const [content, setContent] = useState<AssignmentContent | null>(null);

  useEffect(() => {
    const id = getActiveAssessmentId();
    const assessment = id ? getAssessment(id) : undefined;
    // Prevent this assignment-only preview being used for another assessment type.
    if (!assessment || assessment.typeCode !== "assignment") {
      router.replace("/assessments/create");
      return;
    }
    setContent(readAssignment(CONTENT_KEY, { ...defaultContent, wordLimit: 0, maxFiles: 0, maxFileSize: 0, acceptedTypes: "" }));
  }, [router]);

  return (
    <AssignmentShell step="content" subtitle="Preview the information entered by the creator before continuing.">
      <div className="asgn-content-page asgn-content-preview">
        <div className="asgn-content-preview-heading">
          <h2>Assignment Preview</h2>
          <p>This is a read-only preview of the current Assignment Content draft.</p>
        </div>
        {!content ? (
          <p role="status">Loading assignment preview…</p>
        ) : (
          <>
            <Panel title="Question document">
              {content.questionDocument ? (
                <div className="asgn-preview-document">
                  <p><strong>File:</strong> {content.questionDocument.name}</p>
                  <p><strong>Size:</strong> {(content.questionDocument.size / 1048576).toFixed(2)} MB</p>
                  {content.questionDocument.dataUrl && (
                    <a className="asgn-button" href={content.questionDocument.dataUrl} download={content.questionDocument.name}>
                      Download question document
                    </a>
                  )}
                  {content.questionDocument.dataUrl && /^image\//.test(content.questionDocument.type) && (
                    /* Uploaded image is a browser-local data URL supplied by the creator. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="asgn-preview-image" src={content.questionDocument.dataUrl} alt="Uploaded assignment question document" />
                  )}
                  {content.questionDocument.dataUrl && (content.questionDocument.type === "application/pdf" || /\.pdf$/i.test(content.questionDocument.name)) && (
                    <object className="asgn-preview-pdf" data={content.questionDocument.dataUrl} type="application/pdf" aria-label="Uploaded assignment PDF preview">
                      <p>Your browser cannot display this PDF. Use the download link above.</p>
                    </object>
                  )}
                </div>
              ) : (
                <p>No question document uploaded yet. Return to Content to add one.</p>
              )}
            </Panel>
            <Panel title="Submission types">
              <dl className="asgn-preview-list">
                <div><dt>Online Text</dt><dd>{onOff(content.onlineText)}</dd></div>
                <div><dt>File submissions</dt><dd>{onOff(content.fileSubmissions)}</dd></div>
                {content.onlineText && <div><dt>Word limit</dt><dd>{shown(content.wordLimit)}</dd></div>}
                {content.fileSubmissions && (
                  <>
                    <div><dt>Maximum uploaded files</dt><dd>{shown(content.maxFiles)}</dd></div>
                    <div><dt>Maximum submission size</dt><dd>{content.maxFileSize ? `${content.maxFileSize} MB` : "Not selected"}</dd></div>
                    <div><dt>Accepted file types</dt><dd>{content.acceptedTypes || "Not selected"}</dd></div>
                  </>
                )}
              </dl>
            </Panel>
            <Panel title="Feedback and submission settings">
              <dl className="asgn-preview-list">
                <div><dt>Feedback Comments</dt><dd>{onOff(content.feedbackComments)}</dd></div>
                <div><dt>Annotate PDF</dt><dd>{onOff(content.annotatePdf)}</dd></div>
                <div><dt>Feedback files</dt><dd>{onOff(content.feedbackFiles)}</dd></div>
                <div><dt>Offline Grading worksheet</dt><dd>{onOff(content.offlineWorksheet)}</dd></div>
                <div><dt>Comment inline</dt><dd>{onOff(content.inlineComment)}</dd></div>
                <div><dt>Require student submission</dt><dd>{onOff(content.requireSubmit)}</dd></div>
                <div><dt>Require submission statement</dt><dd>{onOff(content.requireStatement)}</dd></div>
                <div><dt>Students submit in groups</dt><dd>{onOff(content.groupSubmission)}</dd></div>
                <div><dt>Require group members to submit</dt><dd>{onOff(content.groupMembersSubmit)}</dd></div>
                <div><dt>Notify graders about submissions</dt><dd>{onOff(content.notifyGraders)}</dd></div>
                <div><dt>Notify graders about late submissions</dt><dd>{onOff(content.notifyLate)}</dd></div>
                <div><dt>Notify students by default</dt><dd>{onOff(content.notifyStudents)}</dd></div>
              </dl>
            </Panel>
          </>
        )}
        <div className="asgn-footer asgn-preview-footer">
          <button type="button" className="asgn-button" onClick={() => router.push("/assessments/create/content?edit=true")}>Back to Content</button>
        </div>
      </div>
    </AssignmentShell>
  );
}
