import type { LensNextIssue } from "./lens-next-model";

export type LensNextXmlPackage = {
  visualStateJson: string;
  visualStateDigest: string;
};

export type LensNextXmlLoadFailure = {
  issue: LensNextIssue;
  reason: string;
};

export async function loadExportableLensNextPackages(
  candidates: readonly LensNextIssue[],
  loadVisualState: (issue: LensNextIssue) => Promise<LensNextXmlPackage>,
): Promise<{
  exportable: readonly LensNextIssue[];
  packages: ReadonlyMap<number, LensNextXmlPackage>;
  skipped: readonly LensNextXmlLoadFailure[];
}> {
  const settled = await Promise.allSettled(
    candidates.map(async issue => ({ issue, stored: await loadVisualState(issue) })),
  );
  const exportable: LensNextIssue[] = [];
  const packages = new Map<number, LensNextXmlPackage>();
  const skipped: LensNextXmlLoadFailure[] = [];
  settled.forEach((result, index) => {
    const issue = candidates[index];
    if (result.status === "fulfilled") {
      exportable.push(issue);
      packages.set(issue.identity.serverId, result.value.stored);
      return;
    }
    skipped.push({
      issue,
      reason: result.reason instanceof Error ? result.reason.message : "Visual Package could not be verified",
    });
  });
  return Object.freeze({
    exportable: Object.freeze(exportable),
    packages,
    skipped: Object.freeze(skipped),
  });
}

export function lensNextXmlSkippedSummary(skipped: readonly LensNextXmlLoadFailure[]): string {
  return skipped
    .map(({ issue, reason }) => `${issue.displayId ?? issue.identity.viewpointId}: ${reason}`)
    .join("; ");
}
