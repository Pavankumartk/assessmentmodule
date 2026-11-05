/** Required-field validation shared by MCQ, One Word and Short Answer Details. */
export type DetailsFieldErrors = Record<string, string>;

export const detailsFieldSections: Record<string, number> = {
  assessmentName: 0, course: 0, language: 0, module: 0, descriptionInstructions: 0,
  totalMarks: 1, questionCount: 1, marksPerQuestion: 1, markingScheme: 1,
  negativeMarkingValue: 1, passingScore: 1, gradeToPass: 1, gradeCategory: 1, roundingRule: 1,
  timeLimit: 2, perQuestionTimer: 2, timeZone: 2, availableFromDate: 2,
  availableFromTime: 2, availableUntilDate: 2, availableUntilTime: 2, lateSubmission: 2,
  attempts: 3, attemptCooldown: 3, gradingMethod: 3, accessCode: 3,
  browserLockdown: 3, webcamProctoring: 3, prerequisite: 3,
  whoCanTake: 4, batch: 4, academicYear: 4, department: 4, program: 4, section: 4,
};

type ValidationOptions = {
  markingScheme: string;
  negativeMarking: boolean;
  gradeToPass: boolean;
  toggles: Record<string, boolean>;
};

function plainText(html: string): string {
  return html.replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160|#xA0);/gi, " ")
    .replace(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi, " ")
    .trim();
}

export function validateCompleteDetails(
  form: Record<string, string>,
  options: ValidationOptions,
): DetailsFieldErrors {
  const errors: DetailsFieldErrors = {};
  const get = (field: string) => (form[field] ?? "").trim();
  const required = (field: string, label: string) => {
    if (!get(field)) errors[field] = `${label} is required.`;
  };
  const positive = (field: string, label: string, integer = false) => {
    const value = get(field);
    if (!value) { errors[field] = `${label} is required.`; return; }
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isSafeInteger(n))) {
      errors[field] = `${label} must be ${integer ? "a positive whole number" : "greater than zero"}.`;
    }
  };
  const switchRequired = (toggle: string, field: string, label: string) => {
    if (options.toggles[toggle]) required(field, label);
  };

  // 1. Basic information. Assessment type was chosen on the previous step.
  required("assessmentName", "Assessment Name");
  required("course", "Course");
  required("language", "Language");
  required("module", "Module / Unit");
  if (!plainText(get("descriptionInstructions"))) {
    errors.descriptionInstructions = "Description / Instructions is required.";
  }
  // Category / tags is optional.

  // 2. Scoring and grading.
  positive("totalMarks", "Total Marks");
  positive("questionCount", "Number of Questions", true);
  if (!errors.questionCount && Number(get("questionCount")) > 500) {
    errors.questionCount = "Number of Questions cannot exceed 500.";
  }
  positive("marksPerQuestion", "Marks per Question");
  if (!options.markingScheme) errors.markingScheme = "Select a Marking Scheme.";
  if (options.negativeMarking) required("negativeMarkingValue", "Negative Marking");
  required("passingScore", "Passing Score");
  if (options.gradeToPass) required("gradeToPass", "Grade to Pass");
  if (options.gradeToPass) required("gradeCategory", "Grade category");
  required("roundingRule", "Rounding Rule");
  if (!errors.totalMarks && !errors.questionCount && !errors.marksPerQuestion
    && options.markingScheme === "Fixed marks per question") {
    const total = Number(get("totalMarks"));
    const expected = Number(get("questionCount")) * Number(get("marksPerQuestion"));
    if (Math.abs(total - expected) > 0.001) {
      errors.totalMarks = `Total Marks must equal Number of Questions × Marks per Question (${expected}).`;
    }
  }

  // 3. Timing and availability. Disabled features do not require a value.
  switchRequired("timeLimit", "timeLimit", "Time Limit");
  switchRequired("perQuestionTimer", "perQuestionTimer", "Per-question Timer");
  required("timeZone", "Time Zone");
  switchRequired("availableFrom", "availableFromDate", "Start Date");
  switchRequired("availableFrom", "availableFromTime", "Start Time");
  switchRequired("availableUntil", "availableUntilDate", "End Date");
  switchRequired("availableUntil", "availableUntilTime", "End Time");
  switchRequired("lateSubmission", "lateSubmission", "Late Submission");
  if (get("lateSubmission") === "Select" && options.toggles.lateSubmission) {
    errors.lateSubmission = "Select a Late Submission setting.";
  }
  if (options.toggles.availableFrom && options.toggles.availableUntil &&
      !errors.availableFromDate && !errors.availableFromTime &&
      !errors.availableUntilDate && !errors.availableUntilTime) {
    const start = new Date(`${get("availableFromDate")}T${get("availableFromTime")}`).getTime();
    const end = new Date(`${get("availableUntilDate")}T${get("availableUntilTime")}`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errors.availableUntilDate = "Available Until must be after Available From.";
    }
  }

  // 4. Attempts and access.
  positive("attempts", "Number of Attempts", true);
  required("attemptCooldown", "Attempt Cooldown");
  required("gradingMethod", "Grading Method");
  switchRequired("accessCode", "accessCode", "Access Code");
  switchRequired("browserLockdown", "browserLockdown", "Browser Lockdown");
  switchRequired("webcamProctoring", "webcamProctoring", "Webcam Proctoring");
  switchRequired("prerequisite", "prerequisite", "Prerequisite");
  // Extra Time / Accommodations is optional.

  // 5. Audience. Excluded Learners and Notify Learners are optional.
  required("whoCanTake", "Who can take this assessment?");
  required("batch", "Batch / Cohort");
  required("academicYear", "Academic Year");
  required("department", "Department");
  required("program", "Program");
  required("section", "Section / Class");

  return errors;
}
