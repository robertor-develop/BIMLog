export type AccessSurface =
  | "dashboard"
  | "project_workspace"
  | "project_administration"
  | "total_control"
  | "living_brief"
  | "company_catalogs"
  | "company_pricing"
  | "company_workflows"
  | "feedback_administration";

export interface AccessProfile {
  facts: {
    authenticated: boolean;
    isSuperAdmin: boolean;
    canAccessLivingBrief: boolean;
    isCompanyPmo: boolean;
    isFinancialAdministrator: boolean;
    activeProjectRoles: string[];
    activeProjects: Array<{ id: number; role: string }>;
  };
  decisions: Record<AccessSurface, { allow: boolean; code: string }>;
}

export type ProjectContext =
  | { allow: true; kind: "global_super_admin" | "project_membership"; projectId: number; role: string }
  | { allow: false; kind: "zero_project" | "project_denied"; projectId: number | null; role: null };

export function resolveProjectPageRole(isSuperAdmin: boolean, memberRole: string | null | undefined): string {
  return isSuperAdmin ? "project_admin" : memberRole ?? "";
}

export function projectPageMembershipDenied(hasProject: boolean, hasMembers: boolean, hasCurrentMember: boolean, isSuperAdmin: boolean): boolean {
  return hasProject && hasMembers && !hasCurrentMember && !isSuperAdmin;
}

export function resolveProjectContext(profile: AccessProfile, requestedProjectId: number | null): ProjectContext {
  if (!requestedProjectId || !Number.isSafeInteger(requestedProjectId) || requestedProjectId <= 0)
    return { allow: false, kind: profile.facts.activeProjects.length ? "project_denied" : "zero_project", projectId: null, role: null };
  if (profile.facts.isSuperAdmin)
    return { allow: true, kind: "global_super_admin", projectId: requestedProjectId, role: "super_admin" };
  const membership = profile.facts.activeProjects.find((project) => project.id === requestedProjectId);
  return membership
    ? { allow: true, kind: "project_membership", projectId: requestedProjectId, role: membership.role }
    : { allow: false, kind: profile.facts.activeProjects.length ? "project_denied" : "zero_project", projectId: requestedProjectId, role: null };
}

export async function loadAccessProfile(token: string, signal?: AbortSignal): Promise<AccessProfile> {
  const response = await fetch("/api/v1/auth/access-profile", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw new Error(`ACCESS_PROFILE_${response.status}`);
  return response.json() as Promise<AccessProfile>;
}
