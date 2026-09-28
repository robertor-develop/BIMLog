import { mapCurrentProjectRole } from "./scoped-authority";

export type ProjectRoleReadiness = {
  activeMember: boolean;
  authorities: readonly string[];
  capabilities: {
    reader: boolean;
    executor: boolean;
    reviewer: boolean;
    pmo: boolean;
    lensEligible: boolean;
  };
  missingSetup: readonly ("active_membership" | "known_project_role" | "reviewer_assignment" | "pmo_assignment")[];
};

/** Derives setup guidance from existing membership and assignments; it grants nothing. */
export function projectRoleReadiness(input: {
  membershipStatus: string | null;
  projectRole: string | null;
  permissionCategory?: string | null;
  isCompanyPmo: boolean;
  workflowAssignments: readonly ("execute" | "review")[];
}): ProjectRoleReadiness {
  const activeMember = input.membershipStatus === "active";
  const mapping = mapCurrentProjectRole(input.projectRole, input.permissionCategory);
  const authorities = activeMember && mapping.knownRole ? mapping.authorities : [];
  const reader = authorities.includes("project:read");
  const executor = authorities.includes("project:write") && input.workflowAssignments.includes("execute");
  const reviewer = reader && input.workflowAssignments.includes("review");
  const pmo = reader && input.isCompanyPmo;
  const missingSetup: ProjectRoleReadiness["missingSetup"][number][] = [];
  if (!activeMember) missingSetup.push("active_membership");
  else if (!mapping.knownRole) missingSetup.push("known_project_role");
  if (activeMember && !input.workflowAssignments.includes("review")) missingSetup.push("reviewer_assignment");
  if (activeMember && !input.isCompanyPmo) missingSetup.push("pmo_assignment");
  return {
    activeMember,
    authorities,
    capabilities: { reader, executor, reviewer, pmo, lensEligible: reader },
    missingSetup,
  };
}
