import type { ReportingBaseline, ReportingBaselineSource } from "./reporting-baseline";

export type BaselineChangeKind = "opened" | "returned" | "closed" | "pending" | "revised" | "voided" | "late_imported";
export type BaselineComparisonRow = { sourceKey: string; recordKey: string; kind: BaselineChangeKind; fromStatus: string | null; toStatus: string | null; fromVersion: number | null; toVersion: number | null };

const closedStatuses = new Set(["closed", "approved", "resolved", "voided"]);
const returnedStatuses = new Set(["returned", "revise_and_resubmit", "rejected"]);

function recordKey(source: Pick<ReportingBaselineSource, "dataset" | "recordId">) { return `${source.dataset}:${source.recordId}`; }
function sourceKey(source: ReportingBaselineSource) { return `${recordKey(source)}:v${source.version}`; }

export function compareReportingBaselines(input: { from: ReportingBaseline; to: ReportingBaseline; knownAtFrom?: ReadonlySet<string> }) {
  if (input.from.tenantId !== input.to.tenantId || input.from.projectId !== input.to.projectId) throw new Error("REPORTING_BASELINE_SCOPE_MISMATCH");
  const fromByRecord = new Map(input.from.sources.map(source => [recordKey(source), source]));
  const toByRecord = new Map(input.to.sources.map(source => [recordKey(source), source]));
  const keys = [...new Set([...fromByRecord.keys(), ...toByRecord.keys()])].sort();
  const changes: BaselineComparisonRow[] = [];
  for (const key of keys) {
    const before = fromByRecord.get(key) ?? null;
    const after = toByRecord.get(key) ?? null;
    let kind: BaselineChangeKind;
    if (!before && after) kind = input.knownAtFrom?.has(key) ? "late_imported" : "opened";
    else if (before && !after) kind = before.status === "voided" ? "voided" : "closed";
    else if (before && after && after.status === "voided") kind = "voided";
    else if (before && after && returnedStatuses.has(after.status) && !returnedStatuses.has(before.status)) kind = "returned";
    else if (before && after && closedStatuses.has(after.status) && !closedStatuses.has(before.status)) kind = "closed";
    else if (before && after && after.version !== before.version) kind = "revised";
    else kind = "pending";
    changes.push({ sourceKey: sourceKey(after ?? before!), recordKey: key, kind, fromStatus: before?.status ?? null, toStatus: after?.status ?? null, fromVersion: before?.version ?? null, toVersion: after?.version ?? null });
  }
  const totals = Object.fromEntries((["opened", "returned", "closed", "pending", "revised", "voided", "late_imported"] as BaselineChangeKind[]).map(kind => [kind, changes.filter(change => change.kind === kind).length])) as Record<BaselineChangeKind, number>;
  return { fromBaselineId: input.from.id, toBaselineId: input.to.id, changes, totals, distinctRecords: new Set(changes.map(change => change.recordKey)).size };
}
