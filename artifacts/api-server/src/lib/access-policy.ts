export const ACCESS_SURFACES = [
  "dashboard",
  "project_workspace",
  "project_administration",
  "total_control",
  "living_brief",
  "company_catalogs",
  "company_pricing",
  "company_workflows",
  "feedback_administration",
] as const;

export type AccessSurface = (typeof ACCESS_SURFACES)[number];
export type ProjectRole =
  | "project_admin"
  | "convention_manager"
  | "discipline_lead"
  | "member"
  | "sub_trade"
  | "read_only";

export interface AccessFacts {
  authenticated: boolean;
  isSuperAdmin: boolean;
  canAccessLivingBrief: boolean;
  isCompanyPmo: boolean;
  isFinancialAdministrator: boolean;
  activeProjectRoles: readonly ProjectRole[];
}

export type AccessDecision = Readonly<{
  allow: boolean;
  code: string;
}>;

const allow = (code: string): AccessDecision => Object.freeze({ allow: true, code });
const deny = (code: string): AccessDecision => Object.freeze({ allow: false, code });

export function decideAccess(surface: AccessSurface, facts: AccessFacts): AccessDecision {
  if (!facts.authenticated) return deny("AUTHENTICATION_REQUIRED");
  if (surface === "dashboard") return allow("AUTHENTICATED");
  if (surface === "project_workspace") {
    return facts.isSuperAdmin || facts.activeProjectRoles.length > 0
      ? allow(facts.isSuperAdmin ? "SUPER_ADMIN" : "ACTIVE_PROJECT_MEMBER")
      : deny("ACTIVE_PROJECT_MEMBERSHIP_REQUIRED");
  }
  if (surface === "project_administration") {
    return facts.isSuperAdmin || facts.activeProjectRoles.includes("project_admin")
      ? allow(facts.isSuperAdmin ? "SUPER_ADMIN" : "PROJECT_ADMIN")
      : deny("PROJECT_ADMIN_REQUIRED");
  }
  if (surface === "total_control") {
    return facts.isSuperAdmin ? allow("SUPER_ADMIN") : deny("SUPER_ADMIN_REQUIRED");
  }
  if (surface === "living_brief") {
    return facts.isSuperAdmin || facts.canAccessLivingBrief
      ? allow(facts.isSuperAdmin ? "SUPER_ADMIN" : "EXPLICIT_LIVING_BRIEF_GRANT")
      : deny("LIVING_BRIEF_ACCESS_REQUIRED");
  }
  if (["company_catalogs", "company_pricing", "company_workflows"].includes(surface)) {
    return facts.isSuperAdmin || facts.isCompanyPmo
      ? allow(facts.isSuperAdmin ? "SUPER_ADMIN" : "COMPANY_PMO")
      : deny("COMPANY_PMO_REQUIRED");
  }
  if (surface === "feedback_administration") {
    return facts.isSuperAdmin || facts.activeProjectRoles.includes("project_admin")
      ? allow(facts.isSuperAdmin ? "SUPER_ADMIN" : "PROJECT_ADMIN")
      : deny("FEEDBACK_ADMIN_REQUIRED");
  }
  return deny("ACCESS_SURFACE_UNKNOWN");
}

export function accessMatrix(facts: AccessFacts): Record<AccessSurface, AccessDecision> {
  return Object.fromEntries(
    ACCESS_SURFACES.map((surface) => [surface, decideAccess(surface, facts)]),
  ) as Record<AccessSurface, AccessDecision>;
}
