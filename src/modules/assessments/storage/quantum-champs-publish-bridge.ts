/**
 * Quantum Champs -> Assessment Management listing bridge.
 * Does not change the game's creator, player or question flow.
 * This site's assessment list is browser-local; this does NOT sync across devices.
 */
import { getDemoSession } from "../auth/demo-auth";
import { savePublishedQuantumListing } from "./quantum-champs-published-registry";
import { getAssessment, type StoredAssessment } from "./assessment-storage";

type QuantumStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  flush?: () => Promise<void>;
};
type AnyObject = Record<string, unknown>;

function object(value: unknown): AnyObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyObject : {};
}
function firstText(...values: unknown[]): string {
  return values.find((value) => typeof value === "string" && value.trim())?.toString().trim() || "";
}
function asCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

/** Called only from Quantum Champs Review's existing Publish button. */
export async function publishQuantumChampsToMain(storage: QuantumStorage): Promise<string> {
  const user = getDemoSession();
  if (!user || user.role !== "admin") {
    throw new Error("Sign in as an Institute Admin to publish Quantum Champs.");
  }

  // Write pending Quantum Champs edits before reading its final record.
  if (storage.flush) await storage.flush();
  const id = storage.getItem("quantumChampsCurrentId");
  if (!id) throw new Error("Save Quantum Champs before publishing.");
  const raw = storage.getItem(`quantumChamps:${id}`);
  if (!raw) throw new Error("Could not find the saved Quantum Champs assessment.");

  let record: AnyObject;
  try { record = object(JSON.parse(raw)); }
  catch { throw new Error("The saved Quantum Champs assessment could not be read."); }
  if (!Object.keys(record).length) throw new Error("Save Quantum Champs before publishing.");

  const details = object(record.details);
  const form = object(record.form);
  const content = object(record.createQuestions);
  const rounds = object(content.questions);
  const evaluation = object(record.evaluation);
  const settings = object(evaluation.settings);
  const now = new Date().toISOString();
  const previous = getAssessment(id);
  const numberOfQuestions = Object.values(rounds).reduce<number>((total, items) =>
    total + (Array.isArray(items) ? items.length : 0), 0);

  // Keep the *original* Quantum Champs record and all of its own data intact.
  // Add only the published state that the existing QC player expects.
  const updated = {
    ...record, status: "published", isPublished: true, published: true,
    publishedAt: firstText(record.publishedAt) || now,
    updatedAt: now,
  };
  storage.setItem(`quantumChamps:${id}`, JSON.stringify(updated));
  if (storage.flush) await storage.flush();

  // The shared list is small metadata only, never the game's images/questions.
  const listing: StoredAssessment = {
    id,
    tenantId: user.tenantId,
    creatorId: previous?.creatorId || user.userId,
    typeCode: "quantum-champs",
    typeLabel: "Quantum Champs",
    title: firstText(record.assessmentName, record.title, details.assessmentName,
      details.title, form.assessmentName, form.title) || "Quantum Champs",
    course: firstText(record.course, details.course, form.course),
    questions: numberOfQuestions || asCount(record.totalQuestions) ||
      asCount(details.totalQuestions) || asCount(form.totalQuestions),
    marks: asCount(settings.totalXp) || asCount(evaluation.totalXp) ||
      asCount(record.totalXp),
    status: "Published",
    attemptCount: previous?.attemptCount || 0,
    createdAt: previous?.createdAt || firstText(record.createdAt) || now,
    updatedAt: now,
  };
  await savePublishedQuantumListing(listing);
  return id;
}
