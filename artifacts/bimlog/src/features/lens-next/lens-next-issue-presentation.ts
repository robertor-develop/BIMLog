import type { LensNextIssue, LensNextStatus } from "./lens-next-types";

export const LENS_NEXT_PRIORITY_LABELS: Readonly<Record<number, string>> = Object.freeze({
  1: "P1 Critical",
  2: "P2 High",
  3: "P3 Medium",
  4: "P4 Low",
  5: "P5 Monitor",
});

export const LENS_NEXT_STATUS_LABELS: Readonly<Record<LensNextStatus, string>> = Object.freeze({
  open: "Open",
  follow_up: "Follow Up",
  waiting_design: "Waiting Design",
  approved: "Approved",
  resolved: "Resolved",
});

export function lensNextPriorityLabel(priority: number | null): string {
  return priority === null ? "Priority not recorded" : LENS_NEXT_PRIORITY_LABELS[priority] ?? `P${priority}`;
}

export function lensNextIssueDescription(issue: LensNextIssue): string {
  return issue.note?.trim() || issue.openItems?.trim() || "No issue description recorded";
}

export function lensNextIssueAccessibleLabel(issue: LensNextIssue): string {
  const code = issue.displayId ?? issue.identity.viewpointId;
  return [
    `View issue ${code}`,
    lensNextPriorityLabel(issue.priority),
    LENS_NEXT_STATUS_LABELS[issue.status],
    issue.trade?.trim() || "Trade not recorded",
    issue.floor?.trim() || "Floor not recorded",
  ].join(", ");
}
