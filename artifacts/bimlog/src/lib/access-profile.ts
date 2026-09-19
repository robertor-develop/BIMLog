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
  };
  decisions: Record<AccessSurface, { allow: boolean; code: string }>;
}

export async function loadAccessProfile(token: string, signal?: AbortSignal): Promise<AccessProfile> {
  const response = await fetch("/api/v1/auth/access-profile", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw new Error(`ACCESS_PROFILE_${response.status}`);
  return response.json() as Promise<AccessProfile>;
}
