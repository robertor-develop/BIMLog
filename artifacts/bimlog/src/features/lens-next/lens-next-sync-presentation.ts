import type { LensNextSyncDisposition, LensNextSyncPlan } from "./lens-next-types";

export const LENS_NEXT_SYNC_LABELS: Readonly<Record<LensNextSyncDisposition, string>> = Object.freeze({
  in_sync: "Already synchronized",
  confirm_local_identity: "Recover identity confirmation",
  pull_from_bimlog: "Pull from BIMLog",
  upload_to_bimlog: "Upload to BIMLog",
  manual_conflict: "Manual conflict",
  blocked: "Blocked",
});

export function lensNextSyncPlanSummary(plan: LensNextSyncPlan): string {
  const changes = plan.confirmLocalIdentity + plan.pullFromBimlog + plan.uploadToBimlog;
  const attention = plan.manualConflict + plan.blocked;
  if (attention > 0) return `${attention} ${attention === 1 ? "record needs" : "records need"} attention before synchronization`;
  if (changes > 0) return `${changes} verified ${changes === 1 ? "change is" : "changes are"} ready for review`;
  return "No synchronization changes are pending";
}
