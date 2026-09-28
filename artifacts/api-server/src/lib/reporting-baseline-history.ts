import crypto from "node:crypto";
import type { ReportingBaseline } from "./reporting-baseline";
import type { ReturnTypeOfWeeklySummary } from "./reporting-baseline-history-types";

export type BaselineHistoryActor = { userId: number; tenantId: number; projectIds: readonly number[]; activeMember: boolean };
export type RetainedBaseline = { baseline: ReportingBaseline; retainedUntil: string; capturedByDisplayName: string };

export function baselineHistoryAccess(entry: RetainedBaseline, actor: BaselineHistoryActor) {
  const allowed = actor.activeMember && actor.tenantId === entry.baseline.tenantId && actor.projectIds.includes(entry.baseline.projectId);
  return { canRead: allowed, denialCode: allowed ? null : "REPORTING_BASELINE_HISTORY_DENIED" };
}

export function listBaselineHistory(entries: readonly RetainedBaseline[], actor: BaselineHistoryActor, asOf: string) {
  return entries
    .filter(entry => baselineHistoryAccess(entry, actor).canRead && Date.parse(entry.retainedUntil) >= Date.parse(asOf))
    .sort((a, b) => b.baseline.capturedAt.localeCompare(a.baseline.capturedAt));
}

export function customerComparisonOutput(input: { from: ReportingBaseline; to: ReportingBaseline; summary: ReturnTypeOfWeeklySummary; language: "en" | "es" }) {
  const model = {
    language: input.language,
    from: { id: input.from.id, capturedAt: input.from.capturedAt, fingerprint: input.from.sourceFingerprint },
    to: { id: input.to.id, capturedAt: input.to.capturedAt, fingerprint: input.to.sourceFingerprint },
    totalChangedRecords: input.summary.totalChangedRecords,
    sections: input.summary.sections.map(section => ({ kind: section.kind, count: section.count, records: section.rows.map(row => ({ recordKey: row.recordKey, explanation: row.explanation })) })),
    missingSourceCount: input.summary.missingSourceCount,
  };
  return { ...model, outputFingerprint: crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex"), captureMode: "explicit_authorized_only" as const };
}
