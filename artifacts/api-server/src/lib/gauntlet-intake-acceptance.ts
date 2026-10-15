import { createHash } from "node:crypto";

export const GAUNTLET_INTAKE_STAGES = Object.freeze([
  "draft", "validation", "catalog_selection", "project_configuration", "template", "edt",
  "financial_setup", "team", "workflow_setup", "review",
] as const);
export type GauntletIntakeStage = typeof GAUNTLET_INTAKE_STAGES[number];
export type GauntletIntakeState = "draft" | "ready_for_review" | "active";

export function inspectGauntletIntakeAcceptance(input: {
  projectId: number;
  intakeId: string;
  revision: number;
  state: GauntletIntakeState;
  completedStages: readonly GauntletIntakeStage[];
  serverFingerprint: string;
  activationConfirmedByUser: boolean;
  activationReceiptId?: string | null;
  operationsEntryAvailable: boolean;
}) {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0 || !input.intakeId.trim() || !Number.isSafeInteger(input.revision) || input.revision <= 0)
    throw new Error("GAUNTLET_INTAKE_IDENTITY_INVALID");
  if (!/^[a-f0-9]{64}$/.test(input.serverFingerprint)) throw new Error("GAUNTLET_INTAKE_FINGERPRINT_INVALID");
  if (new Set(input.completedStages).size !== input.completedStages.length) throw new Error("GAUNTLET_INTAKE_STAGE_DUPLICATE");
  const missingStages = GAUNTLET_INTAKE_STAGES.filter(stage => !input.completedStages.includes(stage));
  const active = input.state === "active";
  if (active && (missingStages.length || !input.activationConfirmedByUser || !input.activationReceiptId?.trim() || !input.operationsEntryAvailable))
    throw new Error("GAUNTLET_INTAKE_ACTIVE_CONTRADICTION");
  if (!active && (input.activationReceiptId || input.operationsEntryAvailable)) throw new Error("GAUNTLET_INTAKE_INACTIVE_CONTRADICTION");
  if (input.state === "ready_for_review" && missingStages.length) throw new Error("GAUNTLET_INTAKE_REVIEW_NOT_READY");
  const canonical = {
    projectId: input.projectId, intakeId: input.intakeId.trim(), revision: input.revision, state: input.state,
    completedStages: [...input.completedStages], serverFingerprint: input.serverFingerprint,
    activationConfirmedByUser: input.activationConfirmedByUser, activationReceiptId: input.activationReceiptId ?? null,
    operationsEntryAvailable: input.operationsEntryAvailable,
  };
  return Object.freeze({
    ...canonical,
    missingStages,
    reviewReady: missingStages.length === 0,
    active,
    acceptanceFingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  });
}
