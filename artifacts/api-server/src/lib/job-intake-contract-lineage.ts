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
