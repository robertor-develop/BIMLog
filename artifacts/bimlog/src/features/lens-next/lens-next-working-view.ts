import type { LensNextApiClient, LensNextBridgeClient } from "./lens-next-client";
import type { LensNextBridgeProjectContext, LensNextIssue } from "./lens-next-types";

export interface LensNextWorkingViewDependencies {
  apiClient: Pick<LensNextApiClient, "loadVisualState" | "saveVisualState">;
  bridgeClient: Pick<LensNextBridgeClient, "openWorkingView" | "captureCurrentVisualState" | "applyPlatformWorkingView">;
}

export interface LensNextWorkingViewResult {
  migratedHistoricalViewpoint: boolean;
  visualStateDigest: string;
}

export interface LensNextVisualRepairResult {
  visualStateDigest: string;
}

/**
 * Opens a BIMLog-authoritative Working View. Historical Original Lens records
 * without a platform package are migrated in place by exact identity first;
 * they are never duplicated and never resolved by a similarity search.
 */
export async function openBimlogWorkingView(
  dependencies: LensNextWorkingViewDependencies,
  issue: LensNextIssue,
  context: LensNextBridgeProjectContext,
  signal?: AbortSignal,
): Promise<LensNextWorkingViewResult> {
  if (issue.identity.projectId !== context.projectId)
    throw new Error("The active Navisworks model is not bound to this BIMLog viewpoint.");

  if (issue.visualStateAvailable && issue.visualStateDigest) {
    const stored = await dependencies.apiClient.loadVisualState(issue, signal);
    await dependencies.bridgeClient.applyPlatformWorkingView(issue, context, stored.visualStateJson, signal);
    return Object.freeze({ migratedHistoricalViewpoint: false, visualStateDigest: stored.visualStateDigest });
  }

  if (!issue.navisworksGuid) {
    throw new Error("This platform record has no visual package or exact Navisworks identity. Open its original view manually, then use Repair from current Navisworks view once.");
  }

  // Exact historical recovery: activate the Original Lens Saved Viewpoint,
  // capture its complete state, persist it on the same BIMLog record, then
  // reconstruct from the package BIMLog has just accepted.
  await dependencies.bridgeClient.openWorkingView(issue, context, signal);
  const captured = await dependencies.bridgeClient.captureCurrentVisualState(issue, context, signal);
  await dependencies.apiClient.saveVisualState(issue, captured.visualStateJson, captured.visualStateDigest, signal);

  const migratedIssue: LensNextIssue = Object.freeze({
    ...issue,
    visualStateAvailable: true,
    visualStateDigest: captured.visualStateDigest,
  });
  const stored = await dependencies.apiClient.loadVisualState(migratedIssue, signal);
  await dependencies.bridgeClient.applyPlatformWorkingView(migratedIssue, context, stored.visualStateJson, signal);
  return Object.freeze({ migratedHistoricalViewpoint: true, visualStateDigest: stored.visualStateDigest });
}


/**
 * Repairs one legacy platform record from the view the user has explicitly
 * opened in Navisworks. The same immutable server identity is updated; no
 * local-name search, guessed match, duplicate record, or hard-coded count is
 * involved. The accepted package is immediately read back and applied so the
 * platform round trip is verified before success is reported.
 */
export async function repairBimlogWorkingViewFromCurrent(
  dependencies: LensNextWorkingViewDependencies,
  issue: LensNextIssue,
  context: LensNextBridgeProjectContext,
  signal?: AbortSignal,
): Promise<LensNextVisualRepairResult> {
  if (issue.identity.projectId !== context.projectId)
    throw new Error("The active Navisworks model is not bound to this BIMLog viewpoint.");
  if (issue.visualStateAvailable || issue.visualStateDigest)
    throw new Error("This platform record already has a visual package. Refresh and open it normally.");

  const captured = await dependencies.bridgeClient.captureCurrentVisualState(issue, context, signal);
  await dependencies.apiClient.saveVisualState(issue, captured.visualStateJson, captured.visualStateDigest, signal);
  const migratedIssue: LensNextIssue = Object.freeze({
    ...issue,
    visualStateAvailable: true,
    visualStateDigest: captured.visualStateDigest,
  });
  const stored = await dependencies.apiClient.loadVisualState(migratedIssue, signal);
  await dependencies.bridgeClient.applyPlatformWorkingView(migratedIssue, context, stored.visualStateJson, signal);
  return Object.freeze({ visualStateDigest: stored.visualStateDigest });
}
