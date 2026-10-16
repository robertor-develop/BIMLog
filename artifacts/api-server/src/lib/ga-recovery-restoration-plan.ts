import { createHash } from "node:crypto";
import type { ProtectedFileInventoryRow } from "./ga-protected-file-inventory";
import type { RecoveryCandidateMatch } from "./ga-recovery-candidate-match";

export type CurrentProtectedFileState = Readonly<{
  projectId: number;
  fileId: number;
  storagePathPresent: boolean;
  expectedSha256: string | null;
  expectedBytes: number;
}>;

export function buildProtectedRestorationDryRun(input: {
  inventory: readonly ProtectedFileInventoryRow[];
  current: readonly CurrentProtectedFileState[];
  matches: readonly RecoveryCandidateMatch[];
}) {
  const currentById = new Map(input.current.map(row => [row.fileId, row]));
  const matchById = new Map(input.matches.map(row => [row.fileId, row]));
  if (currentById.size !== input.current.length || matchById.size !== input.matches.length) throw new Error("GA_RESTORE_IDENTITY_DUPLICATE");
  const actions = input.inventory.map(record => {
    const current = currentById.get(record.fileId);
    const match = matchById.get(record.fileId);
    if (!current || current.projectId !== record.projectId || current.expectedBytes !== record.expectedBytes || current.expectedSha256 !== record.expectedSha256) {
      return { projectId: record.projectId, fileId: record.fileId, action: "blocked" as const, reason: "current_record_changed" };
    }
    if (current.storagePathPresent) return { projectId: record.projectId, fileId: record.fileId, action: "untouched" as const, reason: "existing_custody_must_not_be_overwritten" };
    if (!match?.eligibleForRestore) return { projectId: record.projectId, fileId: record.fileId, action: "blocked" as const, reason: match?.state ?? "verified_candidate_missing" };
    if (match.actualBytes !== record.expectedBytes || match.actualSha256 !== record.expectedSha256) return { projectId: record.projectId, fileId: record.fileId, action: "blocked" as const, reason: "candidate_identity_changed" };
    return { projectId: record.projectId, fileId: record.fileId, action: "restore_new_object" as const, reason: "verified_original_candidate" };
  });
  const body = {
    mode: "dry_run_only" as const,
    executionAuthorized: false,
    ready: actions.length > 0 && actions.every(action => action.action === "restore_new_object" || action.action === "untouched"),
    restoreCount: actions.filter(action => action.action === "restore_new_object").length,
    blockedCount: actions.filter(action => action.action === "blocked").length,
    overwriteCount: 0,
    actions,
  };
  return Object.freeze({ ...body, sha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
