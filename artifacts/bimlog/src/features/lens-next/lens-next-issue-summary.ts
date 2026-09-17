import { LENS_NEXT_STATUSES, type LensNextIssue, type LensNextStatus } from "./lens-next-types";

export interface LensNextIssueSummary {
  total: number;
  byStatus: Record<LensNextStatus, number>;
  withImageReference: number;
  withVisualPackage: number;
}

export function summarizeLensNextIssues(issues: readonly LensNextIssue[]): LensNextIssueSummary {
  const byStatus = Object.fromEntries(LENS_NEXT_STATUSES.map(status => [status, 0])) as Record<LensNextStatus, number>;
  let withImageReference = 0;
  let withVisualPackage = 0;
  for (const issue of issues) {
    byStatus[issue.status] += 1;
    if (issue.screenshotUrl) withImageReference += 1;
    if (issue.visualStateAvailable) withVisualPackage += 1;
  }
  return { total: issues.length, byStatus, withImageReference, withVisualPackage };
}
