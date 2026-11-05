"use client";

import { useEffect, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { AssetIcon, AssignmentShell, Field, Notice, Panel } from "./AssignmentUI";
import {
  asStoredFile,
  CONTENT_KEY,
  defaultContent,
  defaultEvaluation,
  EVALUATION_KEY,
  readAssignment,
  saveAssignment,
  validateContent,
  type AssignmentContent,
} from "./assignment-data";

/** Try the existing assessment icon; use an inline fallback only when it is missing. */
function UploadIllustration() {
  return <svg className="asgn-content-upload-fallback" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

type SwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
};

/** The 58px inset row and 72x36 switch match the supplied Assignment Content reference. */
function SwitchRow({ label, checked, onChange, description }: SwitchRowProps) {
  return (
    <div className="asgn-content-setting">
      <div className="asgn-content-setting-copy">
        <span className="asgn-content-setting-name">{label}</span>
        {description && <small className="asgn-content-setting-help">{description}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className={`asgn-content-switch ${checked ? "is-on" : "is-off"}`}
        onClick={() => onChange(!checked)}
      >
        <span className="asgn-content-switch-track">
          <span className="asgn-content-switch-word">{checked ? "ON" : "OFF"}</span>
        </span>
        <span className="asgn-content-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

function QuestionDocument({
  file,
  onPick,
  onRemove,
}: {
  file: AssignmentContent["questionDocument"];
  onPick: (files: File[]) => void;
  onRemove: () => void;
}) {
  const accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt";
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPick(Array.from(event.target.files || []));
    event.target.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragging");
    onPick(Array.from(event.dataTransfer.files));
  };
  return (
    <div className="asgn-content-document">
      <div className="asgn-content-file-picker">
        <label className="asgn-content-choose">
          Choose Files
          <input type="file" accept={accept} aria-label="Choose assignment question document" onChange={handleChange} />
        </label>
        <span className="asgn-content-file-caption">{file ? file.name : "No files chosen"}</span>
      </div>
      <label
        className="asgn-content-drop"
        onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }}
        onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")}
        onDrop={handleDrop}
      >
        <UploadIllustration />
        <span>Drag and drop files (max 2 mb)</span>
        <input type="file" accept={accept} aria-label="Drop or browse assignment document" onChange={handleChange} />
      </label>
      {file && (
        <div className="asgn-content-file-selected">
          <span><AssetIcon name="attachment.svg" size={16} />{file.name} ({(file.size / 1048576).toFixed(2)} MB)</span>
          <button type="button" onClick={onRemove}>Remove</button>
        </div>
      )}
    </div>
  );
}

export default function AssignmentContentStep() {
  const router = useRouter();
  const figmaDefaults: AssignmentContent = { ...defaultContent, offlineWorksheet:true, inlineComment:true, groupSubmission:true, groupMembersSubmit:true, acceptedTypes:"Images" };
  const [data, setData] = useState<AssignmentContent>(figmaDefaults);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { if (message !== "Assignment content saved successfully.") return; const timer = window.setTimeout(() => setMessage(""), 3000); return () => window.clearTimeout(timer); }, [message]);
  const [continuing, setContinuing] = useState(false);
  const continueTimer = useRef<number | null>(null);
  useEffect(() => () => { if (continueTimer.current) window.clearTimeout(continueTimer.current); }, []);

  useEffect(() => {
    setData(readAssignment(CONTENT_KEY, figmaDefaults));
    setReady(true);
  }, []);

  /** Preserve the question summary expected by the *existing* common Review page. */
  const forReview = (value: AssignmentContent) => ({
    ...value,
    questions: value.questionDocument
      ? [{
          id: "assignment-document",
          text: `Assignment: ${value.questionDocument.name}`,
          title: value.questionDocument.name,
          points: Number(readAssignment(EVALUATION_KEY, defaultEvaluation).maxGrade) || 100,
          mandatory: true,
        }]
      : [],
  });

  useEffect(() => {
    if (!ready) return;
    try {
      saveAssignment(CONTENT_KEY, forReview(data));
    } catch {
      setMessage("Could not autosave: the document may exceed browser storage capacity.");
    }
  }, [data, ready]);

  const update = <K extends keyof AssignmentContent>(key: K, value: AssignmentContent[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setErrors([]);
    setMessage("");
  };

  const pickQuestion = async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    if (!/\.(?:pdf|docx?|jpe?g|png|txt)$/i.test(file.name)) {
      setErrors(["Upload a PDF, DOC, DOCX, JPG, PNG, or TXT document."]);
      return;
    }
    try {
      update("questionDocument", await asStoredFile(file, 2));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load the question document."]);
    }
  };

  const save = () => {
    try {
      saveAssignment(CONTENT_KEY, forReview(data));
      setMessage("Assignment content saved successfully.");
      return true;
    } catch {
      setErrors(["Cannot save the content. Reduce document size or check browser storage."]);
      return false;
    }
  };

  const continueToEvaluation = () => {
    if (continuing) return;
    const validation = validateContent(data);
    setErrors(validation);
    if (validation.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (save()) { setMessage(""); setContinuing(true); continueTimer.current = window.setTimeout(() => { setContinuing(false); router.push("/assessments/create/evaluation"); }, 3000); }
  };

  return (
    <AssignmentShell
      step="content"
      subtitle="Provide The Essential Details And Settings For Your Assessment."
    >
      <div className="asgn-content-page">
        <Notice errors={errors} message={message} />
        <Panel title="Question document">
          <QuestionDocument
            file={data.questionDocument}
            onPick={pickQuestion}
            onRemove={() => update("questionDocument", null)}
          />
        </Panel>

        <Panel title="Submission types">
          <SwitchRow
            label="Online Text"
            checked={data.onlineText}
            onChange={(value) => update("onlineText", value)}
          />
          <SwitchRow
            label="File submissions"
            checked={data.fileSubmissions}
            onChange={(value) => update("fileSubmissions", value)}
          />
          {(data.onlineText || data.fileSubmissions) && (
            <div className="asgn-content-fields">
              <Field label="Word limit">
                <input type="number" min={1} step={1} disabled={!data.onlineText} value={data.wordLimit} onChange={(event) => update("wordLimit", Number(event.target.value))} />
              </Field>
              <Field label="Maximum number of uploaded files">
                <input type="number" min={1} step={1} disabled={!data.fileSubmissions} value={data.maxFiles} onChange={(event) => update("maxFiles", Number(event.target.value))} />
              </Field>
              <Field label="Maximum submission size">
                <select disabled={!data.fileSubmissions} value={data.maxFileSize} onChange={(event) => update("maxFileSize", Number(event.target.value))}>
                  {[2,5,10,20,50].map(size => <option key={size} value={size}>{size} MB</option>)}
                </select>
              </Field>
              <Field label="Accepted file types">
                <select disabled={!data.fileSubmissions} value={data.acceptedTypes === "PDF, DOC, DOCX, JPG, PNG" ? "Images" : data.acceptedTypes} onChange={(event) => update("acceptedTypes", event.target.value)}>
                  {["Images","Documents","Images and documents","All supported files"].map(kind => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Panel>

        <Panel title="Feedback type">
          <SwitchRow label="Feedback Comments" checked={data.feedbackComments} onChange={(value) => update("feedbackComments", value)} />
          <SwitchRow label="Annotate PDF" checked={data.annotatePdf} onChange={(value) => update("annotatePdf", value)} />
          <SwitchRow label="Feedback files" checked={data.feedbackFiles} onChange={(value) => update("feedbackFiles", value)} />
          <SwitchRow label="Offline Grading worksheet" checked={data.offlineWorksheet} onChange={(value) => update("offlineWorksheet", value)} />
          <SwitchRow label="Comment inline (copy submission text into feedback)" checked={data.inlineComment} onChange={(value) => update("inlineComment", value)} />
        </Panel>

        <Panel title="Submission settings">
          <SwitchRow
            label="Require students to click the submit button"
            description="Otherwise submissions stay as drafts"
            checked={data.requireSubmit}
            onChange={(value) => update("requireSubmit", value)}
          />
          <SwitchRow
            label="Require that students accept the submission statement"
            checked={data.requireStatement}
            onChange={(value) => update("requireStatement", value)}
          />
        </Panel>

        <Panel title="Group Submission Settings">
          <SwitchRow label="Students submit in groups" checked={data.groupSubmission} onChange={(value) => update("groupSubmission", value)} />
          <SwitchRow
            label="Require group members to submit"
            description="All members must click submit"
            checked={data.groupMembersSubmit}
            onChange={(value) => update("groupMembersSubmit", value)}
          />
        </Panel>

        <Panel title="Notifications">
          <SwitchRow label="Notify graders about submissions" checked={data.notifyGraders} onChange={(value) => update("notifyGraders", value)} />
          <SwitchRow label="Notify graders about late submissions" checked={data.notifyLate} onChange={(value) => update("notifyLate", value)} />
          <SwitchRow label="Default for ‘Notify students’" checked={data.notifyStudents} onChange={(value) => update("notifyStudents", value)} />
        </Panel>

        <div className="asgn-footer asgn-content-figma-footer">
          <button type="button" className="asgn-button" onClick={() => router.push("/assessments/create/details")}>Back</button>
          <div className="asgn-footer-right">
            <button type="button" className="asgn-button" onClick={save}>Save</button>
            {continuing && <span className="mcqcSaveSuccessToast" role="status">Successfully saved</span>}<button type="button" className="asgn-button asgn-button-primary" disabled={continuing} onClick={continueToEvaluation}>Continue</button>
          </div>
        </div>
      </div>
    </AssignmentShell>
  );
}
