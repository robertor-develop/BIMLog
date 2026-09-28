import crypto from "node:crypto";
import type { FieldInspection } from "./field-inspection-execution";

export interface FieldCorrectiveAction {
  actionId: string;
  projectId: number;
  originatingInspectionId: string;
  originatingChecklistItemId: string;
  ownerId: string;
  dueDate: string;
  state: "open";
  createdBy: string;
  createdAt: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error("A valid corrective-action due date is required.");
  return value;
}

export function correctiveActionIdentity(inspectionId: string, itemId: string): string {
  return `FCA-${crypto.createHash("sha256").update(`${inspectionId}\u0000${itemId}`).digest("hex").slice(0, 20)}`;
}

export function ensureCorrectiveAction(input: { inspection: FieldInspection; itemId: string; ownerId: string; dueDate: string; createdBy: string; createdAt: string; existing: readonly FieldCorrectiveAction[] }): { action: FieldCorrectiveAction; created: boolean } {
  if (input.inspection.state !== "completed") throw new Error("Corrective actions require a completed inspection.");
  const result = input.inspection.results.find(row => row.itemId === input.itemId);
  if (!result || result.outcome !== "fail") throw new Error("Only a failed checklist result can create a corrective action.");
  const actionId = correctiveActionIdentity(input.inspection.inspectionId, input.itemId);
  const existing = input.existing.find(action => action.actionId === actionId);
  if (existing) {
    if (existing.projectId !== input.inspection.projectId || existing.originatingInspectionId !== input.inspection.inspectionId || existing.originatingChecklistItemId !== input.itemId) throw new Error("Corrective-action identity collision.");
    return { action: existing, created: false };
  }
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("A valid corrective-action creation time is required.");
  return { created: true, action: Object.freeze({ actionId, projectId: input.inspection.projectId, originatingInspectionId: input.inspection.inspectionId, originatingChecklistItemId: input.itemId, ownerId: required(input.ownerId, "Corrective-action owner"), dueDate: dateOnly(input.dueDate), state: "open", createdBy: required(input.createdBy, "Corrective-action creator"), createdAt: input.createdAt }) };
}
