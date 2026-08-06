export type CommercialProjectScopeRow = { company_id: unknown; member: unknown } | undefined;

export function resolveCommercialProjectScope(input: { projectId: number; requestedCompanyId?: number; isSuperAdmin: boolean; row: CommercialProjectScopeRow }) {
  if (!input.row) return { allowed: false as const, status: 404, code: "FIN_PROJECT_NOT_FOUND", message: "The project does not exist or is archived." };
  if (!input.isSuperAdmin && input.row.member !== true) return { allowed: false as const, status: 403, code: "FIN_SCOPE_MEMBERSHIP_DENIED", message: "Current active project membership is required." };
  const companyId = Number(input.row.company_id);
  if (!Number.isSafeInteger(companyId) || companyId <= 0) return { allowed: false as const, status: 409, code: "FIN_PROJECT_COMPANY_UNRESOLVED", message: "The project owner company could not be resolved." };
  if (input.requestedCompanyId !== undefined && input.requestedCompanyId !== companyId) return { allowed: false as const, status: 403, code: "FIN_PROJECT_COMPANY_MISMATCH", message: "The project does not belong to the requested company." };
  return { allowed: true as const, projectId: input.projectId, companyId };
}
