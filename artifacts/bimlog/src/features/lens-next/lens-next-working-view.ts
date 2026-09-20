import type { LensNextApiClient, LensNextBridgeClient } from "./lens-next-client";
import type { LensNextBridgeProjectContext, LensNextIssue } from "./lens-next-types";

export interface LensNextWorkingViewDependencies {
  apiClient: Pick<LensNextApiClient, "loadVisualState">;
  bridgeClient: Pick<LensNextBridgeClient, "applyPlatformWorkingView">;
  confirmLegacyModelContinuity?: (issue: LensNextIssue, context: LensNextBridgeProjectContext) => boolean;
}

export interface LensNextVisualRepairDependencies {
  apiClient: Pick<LensNextApiClient, "loadVisualState" | "saveVisualState">;
  bridgeClient: Pick<LensNextBridgeClient, "captureCurrentVisualState" | "applyPlatformWorkingView">;
}

export interface LensNextWorkingViewResult {
  migratedHistoricalIssue: boolean;
  visualStateDigest: string;
}

export interface LensNextVisualRepairResult {
  visualStateDigest: string;
}

/**
 * Opens a BIMLog-authoritative Working View from the visual package stored on
 * the platform. A normal open never searches for, activates, or captures a
 * local Saved Viewpoint. Missing historical packages require the separate,
 * explicit repair workflow while the exact original view is already open.
 */
export async function openBimlogWorkingView(
  dependencies: LensNextWorkingViewDependencies,
  issue: LensNextIssue,
  context: LensNextBridgeProjectContext,
  signal?: AbortSignal,
): Promise<LensNextWorkingViewResult> {
  if (issue.identity.projectId !== context.projectId)
    throw new Error("The active Navisworks model is not bound to this BIMLog issue.");

  if (!issue.visualStateAvailable || !issue.visualStateDigest)
    throw new Error(
      "BIMLog is the source of truth, but this platform record has no stored visual package. Open is blocked; display the exact original view in Navisworks and use Repair from current Navisworks view.",
    );

  const stored = await dependencies.apiClient.loadVisualState(issue, context.modelFingerprint, signal);
  const packageState = JSON.parse(stored.visualStateJson) as Record<string, unknown>;
  const packageModelFingerprint = String(packageState.ModelFingerprint ?? packageState.modelFingerprint ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(packageModelFingerprint)) throw new Error("BIMLog visual package has no valid model identity.");
  let legacyModelContinuityConfirmed = false;
  if (packageModelFingerprint !== context.modelFingerprint.toLowerCase()) {
    const contract = String(packageState.ContractVersion ?? packageState.contractVersion ?? "");
    if (contract !== "lens-next-navigation.v1")
      throw new Error("This historical visual package belongs to an earlier model version and needs controlled repair; it cannot be opened automatically.");
    if (!context.modelBindingKey || !context.displayName || !dependencies.confirmLegacyModelContinuity?.(issue, context))
      throw new Error("Working View was not opened because model continuity was not confirmed.");
    legacyModelContinuityConfirmed = true;
  }
  await dependencies.bridgeClient.applyPlatformWorkingView(issue, context, stored.visualStateJson, stored.visualStateDigest, signal, legacyModelContinuityConfirmed);
  return Object.freeze({ migratedHistoricalIssue: false, visualStateDigest: stored.visualStateDigest });
}


/**
 * Repairs one legacy platform record from the view the user has explicitly
 * opened in Navisworks. The same immutable server identity is updated; no
 * local-name search, guessed match, duplicate record, or hard-coded count is
 * involved. The accepted package is immediately read back and applied so the
 * platform round trip is verified before success is reported.
 */
export async function repairBimlogWorkingViewFromCurrent(
  dependencies: LensNextVisualRepairDependencies,
  issue: LensNextIssue,
  context: LensNextBridgeProjectContext,
  confirmationReason: string,
  signal?: AbortSignal,
): Promise<LensNextVisualRepairResult> {
  if (issue.identity.projectId !== context.projectId)
    throw new Error("The active Navisworks model is not bound to this BIMLog issue.");
  if (issue.visualStateAvailable || issue.visualStateDigest)
    throw new Error("This platform record already has a visual package. Refresh and open it normally.");
  if (confirmationReason.trim().length < 3 || confirmationReason.trim().length > 500)
    throw new Error("A bounded migration reason is required.");

  const captured = await dependencies.bridgeClient.captureCurrentVisualState(issue, context, signal);
  await dependencies.apiClient.saveVisualState(issue, captured.visualStateJson, captured.visualStateDigest, confirmationReason.trim(), signal);
  const migratedIssue: LensNextIssue = Object.freeze({
    ...issue,
    visualStateAvailable: true,
    visualStateDigest: captured.visualStateDigest,
  });
  const stored = await dependencies.apiClient.loadVisualState(migratedIssue, context.modelFingerprint, signal);
  await dependencies.bridgeClient.applyPlatformWorkingView(migratedIssue, context, stored.visualStateJson, stored.visualStateDigest, signal);
  return Object.freeze({ visualStateDigest: stored.visualStateDigest });
}
