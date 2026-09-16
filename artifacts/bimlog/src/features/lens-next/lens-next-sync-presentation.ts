import type { LensNextSyncDisposition, LensNextSyncPlan } from "./lens-next-types";

export const LENS_NEXT_SYNC_LABELS: Readonly<Record<LensNextSyncDisposition, string>> = Object.freeze({
  in_sync: "Already synchronized",
  confirm_local_identity: "Recover identity confirmation",
  pull_from_bimlog: "Pull from BIMLog",
  upload_to_bimlog: "Upload to BIMLog",
  manual_conflict: "Manual conflict",
  blocked: "Blocked",
});

const LENS_NEXT_SYNC_LABELS_ES: Readonly<Record<LensNextSyncDisposition, string>> = Object.freeze({
  in_sync: "Ya sincronizado",
  confirm_local_identity: "Confirmar recuperación de identidad",
  pull_from_bimlog: "Traer desde BIMLog",
  upload_to_bimlog: "Subir a BIMLog",
  manual_conflict: "Conflicto manual",
  blocked: "Bloqueado",
});

export function lensNextSyncLabel(disposition: LensNextSyncDisposition, locale: "en" | "es"): string {
  return locale === "es" ? LENS_NEXT_SYNC_LABELS_ES[disposition] : LENS_NEXT_SYNC_LABELS[disposition];
}

export function lensNextSyncPlanSummary(plan: LensNextSyncPlan, locale: "en" | "es" = "en"): string {
  const changes = plan.confirmLocalIdentity + plan.pullFromBimlog + plan.uploadToBimlog;
  const attention = plan.manualConflict + plan.blocked;
  if (locale === "es") {
    if (attention > 0) return `${attention} ${attention === 1 ? "registro requiere" : "registros requieren"} atención antes de sincronizar`;
    if (changes > 0) return `${changes} ${changes === 1 ? "cambio verificado está listo" : "cambios verificados están listos"} para revisión`;
    return "No hay cambios de sincronización pendientes";
  }
  if (attention > 0) return `${attention} ${attention === 1 ? "record needs" : "records need"} attention before synchronization`;
  if (changes > 0) return `${changes} verified ${changes === 1 ? "change is" : "changes are"} ready for review`;
  return "No synchronization changes are pending";
}

export function lensNextSyncRecoveryGuidance(disposition: LensNextSyncDisposition, hasPlatformRecord: boolean, locale: "en" | "es" = "en"): string | null {
  if (locale === "es") {
    if (disposition === "manual_conflict") return hasPlatformRecord
      ? "Revise la identidad autoritativa de BIMLog y el viewpoint administrado exacto de Navisworks. El reemplazo automático está prohibido."
      : "Revise la identidad local administrada antes de crear o vincular un registro de BIMLog."
    if (disposition === "blocked") return hasPlatformRecord
      ? "Inspeccione la evidencia del registro y use únicamente su flujo explícito de reparación cuando la vista original sea autoritativa."
      : "Este viewpoint local no es elegible para sincronización automática porque falta la identidad administrada exacta de BIMLog."
    if (disposition === "confirm_local_identity") return "Confirme únicamente cuando el Saved Viewpoint local sea la vista administrada exacta de este registro de BIMLog."
    return null;
  }
  if (disposition === "manual_conflict") return hasPlatformRecord
    ? "Review the authoritative BIMLog identity and the exact managed Navisworks viewpoint. Automatic replacement is prohibited."
    : "Review the local managed identity before creating or linking a BIMLog record."
  if (disposition === "blocked") return hasPlatformRecord
    ? "Inspect the record evidence and use only its explicit repair workflow when the original view is authoritative."
    : "This local viewpoint is not eligible for automatic synchronization because exact BIMLog-managed identity is missing."
  if (disposition === "confirm_local_identity") return "Confirm only when the local Saved Viewpoint is the exact managed view for this BIMLog record."
  return null;
}
