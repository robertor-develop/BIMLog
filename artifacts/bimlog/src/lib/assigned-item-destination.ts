import type { DashboardAdoptionSummary } from "./dashboard-adoption-summary";

export type DashboardAssignedItem = DashboardAdoptionSummary["assigned"][number];

export function assignedItemDestination(item: DashboardAssignedItem): string | null {
  if (!Number.isInteger(item.id) || item.id <= 0 || !Number.isInteger(item.projectId) || item.projectId <= 0) return null;
  const section = item.kind === "rfi" ? "rfis" : "submittals";
  const query = new URLSearchParams({ [item.kind === "rfi" ? "rfi" : "submittal"]: String(item.id) });
  return `/projects/${item.projectId}/${section}?${query.toString()}`;
}
