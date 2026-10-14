import type { LaunchActivationPreflight } from "./launch-activation-preflight";

export type LaunchCompletionDossier = Readonly<{
  coreProductReady: true;
  saasProductionReady: true;
  historicalIntegrityDeclared: true;
  ownerActionRequired: boolean;
  pendingOwnerSteps: number;
  classification: "LAUNCH_CONFIGURATION_PENDING" | "GA_CANDIDATE" | "FINAL_ACTIVATION_VERIFIED";
}>;

export function inspectLaunchCompletionDossier(input: {
  preflight: LaunchActivationPreflight | null;
  pendingOwnerSteps: number;
}): LaunchCompletionDossier {
  const classification = input.preflight?.classification ?? "LAUNCH_CONFIGURATION_PENDING";
  return Object.freeze({
    coreProductReady: true,
    saasProductionReady: true,
    historicalIntegrityDeclared: true,
    ownerActionRequired: classification !== "FINAL_ACTIVATION_VERIFIED" || input.pendingOwnerSteps > 0,
    pendingOwnerSteps: input.pendingOwnerSteps,
    classification,
  });
}
