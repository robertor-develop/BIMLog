import crypto from "node:crypto";
import type { DailyFieldRecord } from "./daily-field-record";
import type { FieldInspection } from "./field-inspection-execution";
import type { FieldCorrectionCase } from "./field-reinspection";

export type FieldQualityAudience = "internal" | "client";

export interface FieldQualityRow {
  inspectionId: string;
  checklistTitle: string;
  checklistVersion: number;
  failedItemIds: readonly string[];
  actionIds: readonly string[];
  state: "open" | "closed" | "reopened";
  latestReinspectionOutcome: string | null;
  evidenceIds: readonly string[];
}

export interface FieldQualityDashboard {
  projectId: number;
  dailyRecordId: string;
  recordDate: string;
  audience: FieldQualityAudience;
  counts: { inspections: number; failedChecks: number; openCorrections: number; closedCorrections: number };
  rows: readonly FieldQualityRow[];
  fingerprint: string;
}

export function buildFieldQualityDashboard(input: { projectId: number; dailyRecord: DailyFieldRecord; inspections: readonly FieldInspection[]; corrections: readonly FieldCorrectionCase[]; audience: FieldQualityAudience }): FieldQualityDashboard {
  if (input.dailyRecord.projectId !== input.projectId) throw new Error("Daily record does not belong to the requested project.");
  const inspections = input.inspections.filter(inspection => inspection.projectId === input.projectId && inspection.state === "completed");
  const rows = inspections.map(inspection => {
    const failedItemIds = inspection.results.filter(result => result.outcome === "fail").map(result => result.itemId).sort();
    const corrections = input.corrections.filter(correction => correction.action.projectId === input.projectId && correction.action.originatingInspectionId === inspection.inspectionId);
    const evidenceIds = input.audience === "internal" ? inspection.results.flatMap(result => result.evidenceIds).sort() : [];
    const latest = corrections.flatMap(correction => correction.reinspections).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1);
    return Object.freeze({ inspectionId: inspection.inspectionId, checklistTitle: inspection.checklist.title, checklistVersion: inspection.checklist.version, failedItemIds: Object.freeze(failedItemIds), actionIds: Object.freeze(corrections.map(correction => correction.action.actionId).sort()), state: corrections.some(correction => correction.state === "reopened") ? "reopened" as const : corrections.length && corrections.every(correction => correction.state === "closed") ? "closed" as const : "open" as const, latestReinspectionOutcome: latest?.outcome ?? null, evidenceIds: Object.freeze(evidenceIds) });
  });
  const allCorrections = input.corrections.filter(correction => correction.action.projectId === input.projectId && inspections.some(inspection => inspection.inspectionId === correction.action.originatingInspectionId));
  const counts = { inspections: rows.length, failedChecks: rows.reduce((sum, row) => sum + row.failedItemIds.length, 0), openCorrections: allCorrections.filter(row => row.state !== "closed").length, closedCorrections: allCorrections.filter(row => row.state === "closed").length };
  const payload = { projectId: input.projectId, dailyRecordId: input.dailyRecord.recordId, recordDate: input.dailyRecord.recordDate, audience: input.audience, counts, rows };
  return Object.freeze({ ...payload, rows: Object.freeze(rows), fingerprint: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") });
}
