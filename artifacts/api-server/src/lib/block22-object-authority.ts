export const OBJECT_AUTHORITY_SURFACES = [
  "api",
  "files",
  "reports",
  "lens_next",
  "feedback",
  "integrations",
] as const;

export type ObjectAuthoritySurface = (typeof OBJECT_AUTHORITY_SURFACES)[number];

export type ObjectAuthorityRequest = Readonly<{
  authenticated: boolean;
  actorCompanyId: number;
  actorProjectIds: readonly number[];
  requestedCompanyId: number;
  requestedProjectId: number;
  objectProjectId: number;
  objectExists: boolean;
}>;

export type ObjectAuthorityDecision = Readonly<{
  allow: boolean;
  code:
    | "ALLOW_EXACT_SCOPE"
    | "AUTHENTICATION_REQUIRED"
    | "COMPANY_SCOPE_DENIED"
    | "PROJECT_SCOPE_DENIED"
    | "OBJECT_NOT_FOUND";
}>;

export function authorizeObjectRequest(input: ObjectAuthorityRequest): ObjectAuthorityDecision {
  if (!input.authenticated) return { allow: false, code: "AUTHENTICATION_REQUIRED" };
  if (!Number.isSafeInteger(input.actorCompanyId) || input.actorCompanyId <= 0 || input.actorCompanyId !== input.requestedCompanyId) {
    return { allow: false, code: "COMPANY_SCOPE_DENIED" };
  }
  if (!input.actorProjectIds.includes(input.requestedProjectId) || input.requestedProjectId !== input.objectProjectId) {
    return { allow: false, code: "PROJECT_SCOPE_DENIED" };
  }
  if (!input.objectExists) return { allow: false, code: "OBJECT_NOT_FOUND" };
  return { allow: true, code: "ALLOW_EXACT_SCOPE" };
}
