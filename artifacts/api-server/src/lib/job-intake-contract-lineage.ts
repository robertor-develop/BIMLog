import crypto from "node:crypto";

export function canonicalIntakeContractItemSource(intakeId: string, items: Array<{ id: string }>) {
  const stableLineIds = items.map((item) => String(item.id)).sort();
  return {
    kind: "job_intake" as const,
    intakeId,
    stableLineIds,
    fingerprint: crypto.createHash("sha256").update(JSON.stringify({ intakeId, stableLineIds })).digest("hex"),
  };
}

export function reconcileExistingContractSelection(input: {
  selected: { contractId: string; versionId: string; fingerprint: string };
  current: { contractId: string; versionId: string; fingerprint: string };
}) {
  const exact = input.selected.contractId === input.current.contractId &&
    input.selected.versionId === input.current.versionId &&
    input.selected.fingerprint === input.current.fingerprint;
  return exact
    ? { decision: "reuse_exact_version" as const, selected: input.selected, differences: [] as string[] }
    : { decision: "review_required" as const, selected: input.selected, differences: ([
      input.selected.contractId !== input.current.contractId ? "contract" : "",
      input.selected.versionId !== input.current.versionId ? "version" : "",
      input.selected.fingerprint !== input.current.fingerprint ? "content" : "",
    ].filter(Boolean)), current: input.current };
}

export function activatedLineageReceipt(summary: unknown, fallbackContractId: string | null) {
  type Binding = { profileId: string; contractId: string; contractVersionId: string };
  const rows = Array.isArray((summary as any)?.contracts) ? (summary as any).contracts : [];
  const contracts: Binding[] = rows.flatMap((row: any): Binding[] => row?.contractId && row?.contractVersionId
    ? [{ profileId: String(row.profileId ?? ""), contractId: String(row.contractId), contractVersionId: String(row.contractVersionId) }]
    : []);
  if (!contracts.length && fallbackContractId) contracts.push({ profileId: "", contractId: fallbackContractId, contractVersionId: "" });
  return { contracts, contractIds: contracts.map((entry: Binding) => entry.contractId), contractVersionIds: contracts.map((entry: Binding) => entry.contractVersionId).filter(Boolean) };
}
