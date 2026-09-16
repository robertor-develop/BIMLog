import type { LensNextIssue } from "./lens-next-types";

export type LensNextSelectionDirection = "previous" | "next";

export interface LensNextSelectionTarget {
  issue: LensNextIssue;
  page: number;
  position: number;
  total: number;
}

export function lensNextSelectionTarget(
  issues: readonly LensNextIssue[],
  selectedServerId: number,
  direction: LensNextSelectionDirection,
  pageSize: number,
): LensNextSelectionTarget | null {
  if (!Number.isInteger(pageSize) || pageSize < 1) return null;
  const selectedIndex = issues.findIndex((issue) => issue.identity.serverId === selectedServerId);
  if (selectedIndex < 0) return null;
  const targetIndex = selectedIndex + (direction === "previous" ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= issues.length) return null;
  return {
    issue: issues[targetIndex],
    page: Math.floor(targetIndex / pageSize) + 1,
    position: targetIndex + 1,
    total: issues.length,
  };
}
