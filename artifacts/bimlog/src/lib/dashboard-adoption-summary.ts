export type DashboardAdoptionSummary = {
  attention: Array<{ kind: "rfi" | "submittal" | "file"; projectId: number; projectCode: string; projectName: string; count: number }>;
  assigned: Array<{ kind: "rfi" | "submittal"; id: number; projectId: number; number: string; title: string }>;
  recentActivity: Array<{ id: number; projectId: number; projectName: string; userEmail: string | null; userFullName: string; userCompanyName: string | null; actionType: string; entityType: string | null; details: unknown; createdAt: string }>;
  namingCompanies: Array<{ company: string; count: number; projectIds: number[] }>;
};

export const EMPTY_DASHBOARD_ADOPTION_SUMMARY: DashboardAdoptionSummary = {
  attention: [], assigned: [], recentActivity: [], namingCompanies: [],
};

export async function loadDashboardAdoptionSummary(apiBase: string, token: string, signal?: AbortSignal): Promise<DashboardAdoptionSummary> {
  const response = await fetch(`${apiBase}/api/v1/dashboard/adoption-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw new Error("HEADQUARTERS_SUMMARY_UNAVAILABLE");
  return response.json();
}
