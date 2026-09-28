import type { FrozenChecklistSnapshot } from "./field-checklist-definition";

export type InspectionOutcome = "pass" | "fail" | "not_applicable";
export type InspectionState = "in_progress" | "completed";

export interface InspectionItemResult {
  itemId: string;
  outcome: InspectionOutcome;
  evidenceIds: readonly string[];
  note: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface FieldInspection {
  inspectionId: string;
  projectId: number;
  checklist: FrozenChecklistSnapshot;
  executorId: string;
  executorRole: "field_inspector" | "quality_inspector";
  state: InspectionState;
  results: readonly InspectionItemResult[];
  completedAt: string | null;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function startFieldInspection(input: { inspectionId: string; projectId: number; checklist: FrozenChecklistSnapshot; executorId: string; executorRole: FieldInspection["executorRole"] }): FieldInspection {
  if (input.projectId !== input.checklist.projectId) throw new Error("Checklist and inspection project must match.");
  return { inspectionId: required(input.inspectionId, "Inspection identity"), projectId: input.projectId, checklist: input.checklist, executorId: required(input.executorId, "Inspection executor"), executorRole: input.executorRole, state: "in_progress", results: Object.freeze([]), completedAt: null };
}

export function recordInspectionResult(inspection: FieldInspection, input: InspectionItemResult): FieldInspection {
  if (inspection.state !== "in_progress") throw new Error("A completed inspection is immutable.");
  if (input.recordedBy !== inspection.executorId) throw new Error("Only the assigned inspection executor may record results.");
  const definition = inspection.checklist.items.find(item => item.itemId === input.itemId);
  if (!definition) throw new Error("Checklist item does not belong to this inspection.");
  if (inspection.results.some(result => result.itemId === input.itemId)) throw new Error("Checklist item already has a result.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("A valid result time is required.");
  const evidenceIds = [...new Set(input.evidenceIds.map(id => required(id, "Evidence identity")))];
  if (definition.evidenceRequired && evidenceIds.length === 0) throw new Error("Required evidence is missing.");
  if (input.outcome === "not_applicable" && !input.note?.trim()) throw new Error("Not-applicable results require a reason.");
  const result = Object.freeze({ ...input, evidenceIds: Object.freeze(evidenceIds), note: input.note?.trim() || null });
  return { ...inspection, results: Object.freeze([...inspection.results, result]) };
}

export function completeFieldInspection(inspection: FieldInspection, completedAt: string): FieldInspection {
  if (inspection.state !== "in_progress") throw new Error("Inspection is already complete.");
  if (Number.isNaN(Date.parse(completedAt))) throw new Error("A valid completion time is required.");
  if (inspection.results.length !== inspection.checklist.items.length || inspection.checklist.items.some(item => !inspection.results.some(result => result.itemId === item.itemId))) throw new Error("Every checklist item requires a result before completion.");
  return Object.freeze({ ...inspection, state: "completed", results: Object.freeze([...inspection.results]), completedAt });
}
