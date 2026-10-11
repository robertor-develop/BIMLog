export type DashboardAttentionKind = "rfi" | "submittal" | "file";

export type DashboardAttentionRow = {
  kind: DashboardAttentionKind;
  projectId: number;
  projectCode: string;
  projectName: string;
  count: number;
};

export type DashboardAssignedItem = {
  kind: "rfi" | "submittal";
  id: number;
  projectId: number;
  number: string;
  title: string;
};

export type DashboardRecentActivity = {
  id: number;
  projectId: number;
  projectName: string;
  userEmail: string | null;
  userFullName: string;
  userCompanyName: string | null;
  actionType: string;
  entityType: string | null;
  details: unknown;
  createdAt: Date | string;
};

export type DashboardNamingCompany = {
  company: string;
  count: number;
  projectIds: number[];
};

export type DashboardAdoptionSummary = {
  attention: DashboardAttentionRow[];
  assigned: DashboardAssignedItem[];
  recentActivity: DashboardRecentActivity[];
  namingCompanies: DashboardNamingCompany[];
};

const MAX_ATTENTION = 20;
const MAX_ASSIGNED = 2;
const MAX_ACTIVITY = 15;
const MAX_NAMING_COMPANIES = 5;

export function boundedDashboardAdoptionSummary(input: DashboardAdoptionSummary): DashboardAdoptionSummary {
  return {
    attention: input.attention.filter(row => row.projectId > 0 && row.count > 0).slice(0, MAX_ATTENTION),
    assigned: input.assigned.filter(row => row.id > 0 && row.projectId > 0 && row.title.trim().length > 0).slice(0, MAX_ASSIGNED),
    recentActivity: input.recentActivity.filter(row => row.projectId > 0).slice(0, MAX_ACTIVITY),
    namingCompanies: input.namingCompanies
      .filter(row => row.count > 0 && row.company.trim().length > 0)
      .map(row => ({ ...row, projectIds: [...new Set(row.projectIds.filter(id => id > 0))] }))
      .slice(0, MAX_NAMING_COMPANIES),
  };
}
