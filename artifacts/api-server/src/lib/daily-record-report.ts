import crypto from "node:crypto";
import type { DailyFieldRecord, DailyRecordRevision } from "./daily-field-record";
import type { DailyEvidenceLink } from "./daily-evidence-link";
import type { DailySiteObservation } from "./daily-site-observation";
import type { DailyWorkforceObservation } from "./daily-workforce-observation";

export interface DailyRecordCorrection {
  correctionId: string;
  supersededRevisionId: string;
  correctedBy: string;
  correctedAt: string;
  reason: string;
  replacementRevision: DailyRecordRevision;
}

export interface DailyRecordReport {
  recordId: string;
  projectId: number;
  recordDate: string;
  locationId: string;
  approvedRevisionId: string | null;
  history: DailyRecordRevision[];
  corrections: DailyRecordCorrection[];
  counts: { workforce: number; evidence: number; observations: number; linkedActions: number };
  linkedActionIds: string[];
  fingerprint: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function correctDailyRecord(record: DailyFieldRecord, input: DailyRecordCorrection): { record: DailyFieldRecord; correction: DailyRecordCorrection } {
  const superseded = record.revisions.find(revision => revision.revisionId === input.supersededRevisionId);
  if (!superseded) throw new Error("The corrected revision does not belong to this daily record.");
  if (record.revisions.some(revision => revision.revisionId === input.replacementRevision.revisionId)) throw new Error("Correction revision identity already exists.");
  if (input.replacementRevision.projectId !== record.projectId || input.replacementRevision.recordDate !== record.recordDate || input.replacementRevision.locationId !== record.locationId) throw new Error("Correction cannot change daily record scope.");
  if (Number.isNaN(Date.parse(input.correctedAt))) throw new Error("A valid correction time is required.");
  const correction = { ...input, correctionId: required(input.correctionId, "Correction identity"), correctedBy: required(input.correctedBy, "Correction actor"), reason: required(input.reason, "Correction reason") };
  return { record: { ...record, revisions: [...record.revisions, input.replacementRevision] }, correction };
}

export function buildDailyRecordReport(input: {
  record: DailyFieldRecord;
  corrections: readonly DailyRecordCorrection[];
  workforce: readonly DailyWorkforceObservation[];
  evidence: readonly DailyEvidenceLink[];
  observations: readonly DailySiteObservation[];
  linkedActionIds: readonly string[];
}): DailyRecordReport {
  const inScope = <T extends { projectId: number; dailyRecordId: string }>(rows: readonly T[]) => rows.filter(row => row.projectId === input.record.projectId && row.dailyRecordId === input.record.recordId);
  const linkedActionIds = [...new Set(input.linkedActionIds.map(action => required(action, "Linked action identity")))].sort();
  const counts = { workforce: inScope(input.workforce).length, evidence: inScope(input.evidence).length, observations: inScope(input.observations).length, linkedActions: linkedActionIds.length };
  const approved = [...input.record.revisions].reverse().find(revision => revision.state === "approved") ?? null;
  const payload = { recordId: input.record.recordId, revisions: input.record.revisions.map(revision => revision.revisionId), corrections: input.corrections.map(correction => correction.correctionId), counts, linkedActionIds };
  return { recordId: input.record.recordId, projectId: input.record.projectId, recordDate: input.record.recordDate, locationId: input.record.locationId, approvedRevisionId: approved?.revisionId ?? null, history: [...input.record.revisions], corrections: [...input.corrections], counts, linkedActionIds, fingerprint: crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
