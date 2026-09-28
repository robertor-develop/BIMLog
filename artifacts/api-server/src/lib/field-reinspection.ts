import type { FieldCorrectiveAction } from "./field-corrective-action-link";
import type { FieldInspection, InspectionOutcome } from "./field-inspection-execution";

export interface ReinspectionResult {
  reinspectionId: string;
  actionId: string;
  reviewerId: string;
  reviewerRole: "quality_reviewer" | "quality_lead";
  outcome: InspectionOutcome;
  evidenceIds: readonly string[];
  recordedAt: string;
}

export interface FieldCorrectionCase {
  action: FieldCorrectiveAction;
  state: "open" | "closed" | "reopened";
  reinspections: readonly ReinspectionResult[];
  history: readonly { event: "closed" | "reopened"; actorId: string; at: string; reason: string }[];
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function openCorrectionCase(action: FieldCorrectiveAction): FieldCorrectionCase {
  return { action, state: "open", reinspections: Object.freeze([]), history: Object.freeze([]) };
}

export function recordReinspection(correction: FieldCorrectionCase, inspection: FieldInspection, input: ReinspectionResult): FieldCorrectionCase {
  if (correction.state === "closed") throw new Error("Closed correction must be reopened before reinspection.");
  if (inspection.inspectionId !== correction.action.originatingInspectionId) throw new Error("Reinspection origin does not match the corrective action.");
  if (input.actionId !== correction.action.actionId) throw new Error("Reinspection action does not match the correction case.");
  if (input.reviewerId === inspection.executorId) throw new Error("The original executor cannot perform the independent reinspection.");
  if (correction.reinspections.some(row => row.reinspectionId === input.reinspectionId)) throw new Error("Duplicate reinspection identity.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("A valid reinspection time is required.");
  const evidenceIds = [...new Set(input.evidenceIds.map(id => required(id, "Reinspection evidence identity")))];
  if (evidenceIds.length === 0) throw new Error("Reinspection evidence is required.");
  const result = Object.freeze({ ...input, reinspectionId: required(input.reinspectionId, "Reinspection identity"), reviewerId: required(input.reviewerId, "Reinspection reviewer"), evidenceIds: Object.freeze(evidenceIds) });
  return { ...correction, reinspections: Object.freeze([...correction.reinspections, result]) };
}

export function closeCorrectionCase(correction: FieldCorrectionCase, input: { actorId: string; at: string; reason: string }): FieldCorrectionCase {
  const latest = correction.reinspections.at(-1);
  if (!latest || latest.outcome !== "pass") throw new Error("A passing independent reinspection is required for closure.");
  if (latest.reviewerId !== input.actorId) throw new Error("Only the designated reviewer may close this correction.");
  if (Number.isNaN(Date.parse(input.at))) throw new Error("A valid closure time is required.");
  return Object.freeze({ ...correction, state: "closed", history: Object.freeze([...correction.history, Object.freeze({ event: "closed" as const, actorId: required(input.actorId, "Closure actor"), at: input.at, reason: required(input.reason, "Closure reason") })]) });
}

export function reopenCorrectionCase(correction: FieldCorrectionCase, input: { actorId: string; actorRole: "quality_lead" | "other"; at: string; reason: string }): FieldCorrectionCase {
  if (correction.state !== "closed") throw new Error("Only a closed correction can be reopened.");
  if (input.actorRole !== "quality_lead") throw new Error("Quality-lead authorization is required to reopen a correction.");
  if (Number.isNaN(Date.parse(input.at))) throw new Error("A valid reopening time is required.");
  return { ...correction, state: "reopened", history: Object.freeze([...correction.history, Object.freeze({ event: "reopened" as const, actorId: required(input.actorId, "Reopening actor"), at: input.at, reason: required(input.reason, "Reopening reason") })]) };
}
