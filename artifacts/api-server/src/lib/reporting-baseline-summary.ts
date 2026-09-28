import type { BaselineComparisonRow, BaselineChangeKind } from "./reporting-baseline-comparison";

export type BaselineSourceDetail = { recordKey: string; title: string | null; sourceAvailable: boolean };

export function buildWeeklyCoordinationSummary(input: { changes: readonly BaselineComparisonRow[]; sourceDetails: readonly BaselineSourceDetail[] }) {
  const detailByKey = new Map(input.sourceDetails.map(detail => [detail.recordKey, detail]));
  const groups = new Map<BaselineChangeKind, Array<BaselineComparisonRow & { title: string | null; sourceAvailable: boolean; explanation: string }>>();
  for (const change of input.changes) {
    const detail = detailByKey.get(change.recordKey);
    const sourceAvailable = detail?.sourceAvailable === true;
    const explanation = !detail
      ? "SOURCE_DETAIL_MISSING"
      : !sourceAvailable
        ? "SOURCE_UNAVAILABLE"
        : `${change.kind}:${change.fromStatus ?? "absent"}->${change.toStatus ?? "absent"}`;
    const rows = groups.get(change.kind) ?? [];
    rows.push({ ...change, title: detail?.title ?? null, sourceAvailable, explanation });
    groups.set(change.kind, rows);
  }
  const sections = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kind, rows]) => ({ kind, count: rows.length, rows: rows.sort((a, b) => a.recordKey.localeCompare(b.recordKey)) }));
  return { totalChangedRecords: input.changes.filter(change => change.kind !== "pending").length, sections, missingSourceCount: sections.flatMap(section => section.rows).filter(row => !row.sourceAvailable).length };
}

export function drilldownForKind(summary: ReturnType<typeof buildWeeklyCoordinationSummary>, kind: BaselineChangeKind) {
  return summary.sections.find(section => section.kind === kind)?.rows ?? [];
}
