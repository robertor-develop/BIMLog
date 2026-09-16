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

export function lensNextSyncRecoveryGuidance(disposition: LensNextSyncDisposition, hasPlatformRecord: boolean): string | null {
  if (disposition === "manual_conflict") return hasPlatformRecord
    ? "Review the authoritative BIMLog identity and the exact managed Navisworks viewpoint. Automatic replacement is prohibited."
    : "Review the local managed identity before creating or linking a BIMLog record."
  if (disposition === "blocked") return hasPlatformRecord
    ? "Inspect the record evidence and use only its explicit repair workflow when the original view is authoritative."
    : "This local viewpoint is not eligible for automatic synchronization because exact BIMLog-managed identity is missing."
  if (disposition === "confirm_local_identity") return "Confirm only when the local Saved Viewpoint is the exact managed view for this BIMLog record."
  return null;
}
