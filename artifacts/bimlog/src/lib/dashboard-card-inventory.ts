export type DashboardCardKind = "records" | "action" | "guided";

export interface DashboardCardInventoryEntry {
  id: string;
  kind: DashboardCardKind;
  source: string;
  destination: string;
  evidence: string;
}

export const dashboardCardInventory: DashboardCardInventoryEntry[] = [
  { id: "project-briefing", kind: "guided", source: "GET /api/v1/dashboard/briefing", destination: "In-card governed briefing", evidence: "Generation status and critical items" },
  { id: "today-workspace", kind: "action", source: "Dashboard adoption and assigned-work summaries", destination: "Highest-priority authorized record", evidence: "Role-aware reason and destination" },
  { id: "operational-pulse", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending", evidence: "Checked time, count, and movement" },
  { id: "setup-progress", kind: "guided", source: "Onboarding state", destination: "Resume setup", evidence: "Persisted completed steps" },
  { id: "first-value", kind: "action", source: "Onboarding and project records", destination: "/projects/:projectId/:firstValue", evidence: "First-value kind and project" },
  { id: "first-value-success", kind: "records", source: "Onboarding evidence", destination: "/projects/:projectId/:evidence", evidence: "Persisted first-value evidence" },
  { id: "active-projects", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/projects", evidence: "Active project register" },
  { id: "files-processed", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending?type=files", evidence: "Governed file-attention register" },
  { id: "open-rfis", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending?type=rfis", evidence: "Open RFI register" },
  { id: "pending-submittals", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending?type=submittals", evidence: "Pending submittal register" },
  { id: "compliance-rate", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/projects", evidence: "Project compliance records" },
  { id: "total-clashes", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/projects?module=coordination", evidence: "Project coordination registers" },
  { id: "open-clashes", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/projects?module=coordination&state=open", evidence: "Open clash registers" },
  { id: "submittal-trackers", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending?type=submittals", evidence: "Submittal tracking register" },
  { id: "open-submittal-items", kind: "records", source: "GET /api/v1/dashboard/stats", destination: "/pending?type=submittals", evidence: "Open submittal items" },
  { id: "cvr-health", kind: "records", source: "GET /api/v1/cvr-health", destination: "/pending?type=files", evidence: "Pending and flagged CVR records" },
  { id: "project-card", kind: "action", source: "GET /api/v1/projects/workspace-register", destination: "/projects/:projectId", evidence: "Project identity, state, and lifecycle controls" },
  { id: "recent-activity", kind: "records", source: "Project activity summaries", destination: "/projects/:projectId", evidence: "Actor, action, time, and record context" },
  { id: "naming-violations", kind: "records", source: "Dashboard adoption summary", destination: "/projects/:projectId/files", evidence: "Violation count and affected project" },
];

export function dashboardCardDestination(id: string): string {
  const entry = dashboardCardInventory.find(card => card.id === id);
  if (!entry) throw new Error(`Unknown dashboard card: ${id}`);
  return entry.destination;
}
