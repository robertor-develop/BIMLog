import { edtRoleFromCurrentAuthority, edtRouteActorSql } from "./edt-engine-route-context";
import { FinancialControlError } from "./financial-control-contract";
import type { WorkflowGovernancePolicy } from "./workflow-governance-policy-contract";

type Queryable = { query(sql: string, values?: any[]): Promise<{ rows: any[] }> };

/** Resolve existing grants, never grants implied by a policy or a client-supplied role. */
export async function workflowGovernanceActorRoles(client: Queryable, input: {
  actorUserId: number; companyId: number; projectId: number; workItemId: string;
}): Promise<string[]> {
  const row = (await client.query(edtRouteActorSql, [input.actorUserId, input.projectId])).rows[0];
  if (!row || Number(row.company_id) !== input.companyId || Number(row.project_company_id) !== input.companyId)
    throw new FinancialControlError(403, "WORKFLOW_POLICY_COMPANY_REQUIRED", "Governance requires membership in this company.");
  if (!row.project_role)
    throw new FinancialControlError(403, "WORKFLOW_POLICY_PROJECT_MEMBER_REQUIRED", "Governance requires active project membership.");
  const roles = new Set<string>();
  const projectRole = edtRoleFromCurrentAuthority({ projectRole: row.project_role,
    isOperationsDirector: false, isSuperAdmin: false, isCompanyPmo: false });
  if (projectRole) roles.add(projectRole);
  if (row.is_company_pmo === true) roles.add("PMO");
  if (row.is_operations_director === true) roles.add("OPERATIONS_DIRECTOR");
  if (row.is_super_admin === true) roles.add("CEO");
  // QC_REVIEWER is the existing explicitly assigned Work Item review authority,
  // not an alias for every project member or for a company administrator.
  const reviewer = (await client.query(`SELECT 1 FROM company_delivery_workflow_roles r
    JOIN company_delivery_workflow_work_items b ON b.work_item_id=r.work_item_id
    WHERE r.work_item_id=$1 AND r.user_id=$2 AND r.role='review'
      AND b.company_id=$3 AND b.project_id=$4`,
  [input.workItemId, input.actorUserId, input.companyId, input.projectId])).rows[0];
  if (reviewer) roles.add("QC_REVIEWER");
  return [...roles];
}

export function requireWorkflowPolicyRole(policy: WorkflowGovernancePolicy, actorRoles: readonly string[],
  requiredRole: string, action: "view" | "approve") {
  if (!actorRoles.includes(requiredRole) || !policy.permissions.some(row =>
    row.role === requiredRole && row.actions.includes(action)))
    throw new FinancialControlError(403, "WORKFLOW_POLICY_ROLE_REQUIRED",
      `The active company/project authority and policy permission for ${requiredRole} are required.`);
}
