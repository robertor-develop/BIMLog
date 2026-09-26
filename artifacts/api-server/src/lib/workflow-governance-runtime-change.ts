import { FinancialControlError } from "./financial-control-contract";
import type { WorkflowGovernancePolicy } from "./workflow-governance-policy-contract";

export function assertWorkflowApprovedWorkChange(policy: WorkflowGovernancePolicy) {
  const rule = policy.changeRules.find(rule => rule.action === "edit_approved_work_item");
  if (!rule?.allowed)
    throw new FinancialControlError(409, "WORKFLOW_POLICY_CHANGE_FORBIDDEN", "The frozen Governance Policy prohibits changing approved work.");
  if (rule.requiresNewVersion)
    throw new FinancialControlError(409, "WORKFLOW_POLICY_NEW_VERSION_REQUIRED",
      "This policy requires a new governed version. The activated Work Item cannot be rewritten in place.");
  return rule;
}
