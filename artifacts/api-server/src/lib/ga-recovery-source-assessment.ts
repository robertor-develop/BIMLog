import { createHash } from "node:crypto";

export type RecoverySourceState = "searched_no_match" | "candidate_found" | "not_visible" | "not_searched";
export type RecoverySourceReceipt = Readonly<{
  source: "local_f_root" | "local_user_profile" | "git_history" | "production_database" | "provider_snapshot" | "provider_object_storage";
  state: RecoverySourceState;
  checkedAt: string | null;
  evidence: string;
}>;

const REQUIRED_SOURCES: readonly RecoverySourceReceipt["source"][] = [
  "local_f_root", "local_user_profile", "git_history", "production_database", "provider_snapshot", "provider_object_storage",
];

export function assessRecoverySources(receipts: readonly RecoverySourceReceipt[]) {
  const bySource = new Map(receipts.map(receipt => [receipt.source, receipt]));
  if (bySource.size !== receipts.length) throw new Error("GA_RECOVERY_SOURCE_DUPLICATE");
  for (const receipt of receipts) {
    if (!receipt.evidence.trim()) throw new Error("GA_RECOVERY_SOURCE_EVIDENCE_REQUIRED");
    if ((receipt.state === "searched_no_match" || receipt.state === "candidate_found") && !receipt.checkedAt) throw new Error("GA_RECOVERY_SOURCE_CHECK_TIME_REQUIRED");
  }
  const missing = REQUIRED_SOURCES.filter(source => !bySource.has(source));
  const unresolved = REQUIRED_SOURCES.filter(source => !bySource.has(source) || ["not_visible", "not_searched"].includes(bySource.get(source)!.state));
  const candidates = receipts.filter(receipt => receipt.state === "candidate_found").map(receipt => receipt.source);
  const exhaustiveNoMatch = missing.length === 0 && unresolved.length === 0 && candidates.length === 0;
  const body = { completeInventory: missing.length === 0, missing, unresolved, candidates, exhaustiveNoMatch, receipts: [...receipts].sort((a, b) => a.source.localeCompare(b.source)) };
  return Object.freeze({ ...body, sha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
