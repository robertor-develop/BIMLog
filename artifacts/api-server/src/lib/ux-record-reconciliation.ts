export const RECONCILED_RELATIONSHIPS = ["attachments", "assignments", "historical_links"] as const;
export type ReconciledRelationship = (typeof RECONCILED_RELATIONSHIPS)[number];

export type RecordReconciliationSnapshot = Readonly<{
  recordIds: readonly string[];
  relationships: Readonly<Record<ReconciledRelationship, readonly string[]>>;
}>;

export type ReconciliationDisposition = Readonly<{
  kind: "record" | ReconciledRelationship;
  sourceId: string;
  targetId: string | null;
  disposition: "retained" | "explicitly_mapped" | "legitimate_business_event";
  reason: string;
}>;

export type RecordReconciliationResult = Readonly<{
  status: "pass" | "unexplained_delta";
  counts: Readonly<Record<"records" | ReconciledRelationship, Readonly<{ before: number; after: number }>>>;
  unexplained: readonly Readonly<{ kind: "record" | ReconciledRelationship; id: string; direction: "missing_after" | "new_after" }>[];
}>;

function unique(values: readonly string[], label: string): Set<string> {
  const result = new Set(values);
  if (result.size !== values.length || values.some((value) => !value.trim())) throw new Error(`INVALID_${label.toUpperCase()}_IDENTITY_SET`);
  return result;
}

export function reconcileRecords(
  before: RecordReconciliationSnapshot,
  after: RecordReconciliationSnapshot,
  dispositions: readonly ReconciliationDisposition[],
): RecordReconciliationResult {
  const reviewed = new Set(dispositions.map((item) => `${item.kind}:${item.sourceId}:${item.targetId ?? ""}`));
  const unexplained: Array<{ kind: "record" | ReconciledRelationship; id: string; direction: "missing_after" | "new_after" }> = [];
  const counts = {} as Record<"records" | ReconciledRelationship, { before: number; after: number }>;

  const compare = (kind: "record" | ReconciledRelationship, beforeIds: readonly string[], afterIds: readonly string[]) => {
    const prior = unique(beforeIds, `before_${kind}`);
    const current = unique(afterIds, `after_${kind}`);
    counts[kind === "record" ? "records" : kind] = { before: prior.size, after: current.size };
    for (const id of prior) if (!current.has(id) && ![...reviewed].some((entry) => entry.startsWith(`${kind}:${id}:`))) unexplained.push({ kind, id, direction: "missing_after" });
    for (const id of current) if (!prior.has(id) && ![...reviewed].some((entry) => entry.endsWith(`:${id}`))) unexplained.push({ kind, id, direction: "new_after" });
  };

  compare("record", before.recordIds, after.recordIds);
  for (const kind of RECONCILED_RELATIONSHIPS) compare(kind, before.relationships[kind], after.relationships[kind]);
  return Object.freeze({ status: unexplained.length ? "unexplained_delta" : "pass", counts, unexplained: unexplained.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)) });
}
