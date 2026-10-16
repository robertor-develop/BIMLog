import { createHash } from "node:crypto";
import type { ProtectedFileInventoryRow } from "./ga-protected-file-inventory";

export type RecoveryCandidate = Readonly<{ fileName: string; bytes: Buffer }>;
export type RecoveryCandidateMatch = Readonly<{
  projectId: number;
  fileId: number;
  state: "verified" | "name_mismatch" | "size_mismatch" | "hash_mismatch" | "needs_authoritative_hash";
  actualBytes: number;
  actualSha256: string;
  eligibleForRestore: boolean;
}>;

export function matchRecoveryCandidate(record: ProtectedFileInventoryRow, candidate: RecoveryCandidate): RecoveryCandidateMatch {
  const actualBytes = candidate.bytes.byteLength;
  const actualSha256 = createHash("sha256").update(candidate.bytes).digest("hex");
  let state: RecoveryCandidateMatch["state"];
  if (candidate.fileName !== record.fileName) state = "name_mismatch";
  else if (actualBytes !== record.expectedBytes) state = "size_mismatch";
  else if (record.expectedSha256 === null) state = "needs_authoritative_hash";
  else if (actualSha256 !== record.expectedSha256) state = "hash_mismatch";
  else state = "verified";
  return Object.freeze({ projectId: record.projectId, fileId: record.fileId, state, actualBytes, actualSha256, eligibleForRestore: state === "verified" });
}

export function requireUniqueVerifiedCandidates(matches: readonly RecoveryCandidateMatch[]) {
  const seen = new Set<number>();
  for (const match of matches) {
    if (seen.has(match.fileId)) throw new Error("GA_RECOVERY_CANDIDATE_DUPLICATE");
    if (!match.eligibleForRestore) throw new Error(`GA_RECOVERY_CANDIDATE_${match.state.toUpperCase()}`);
    seen.add(match.fileId);
  }
  return Object.freeze([...matches]);
}
