import { BIMLOG_BUDGET_GOVERNANCE_POLICIES, BIMLOG_DELIVERY_METHODS, DEFAULT_BUDGET_GOVERNANCE_POLICY, DEFAULT_DELIVERY_METHOD } from "./job-intake-configuration";
export type IntakeEnforcementMode = "optional" | "enforced";
export function normalizeIntakePolicy(configuration: Record<string, unknown> = {}) {
  const delivery = String(configuration.delivery_method ?? "");
  const budget = String(configuration.budget_governance_policy ?? "");
  const enforcement = String(configuration.enforcement_mode ?? "optional");
  return {
    deliveryMethod: BIMLOG_DELIVERY_METHODS.some((item) => item.key === delivery) ? delivery : DEFAULT_DELIVERY_METHOD,
    budgetGovernancePolicy: BIMLOG_BUDGET_GOVERNANCE_POLICIES.some((item) => item.key === budget) ? budget : DEFAULT_BUDGET_GOVERNANCE_POLICY,
    enforcementMode: (enforcement === "enforced" ? "enforced" : "optional") as IntakeEnforcementMode,
    configured: Boolean(delivery || budget || enforcement === "enforced"),
  };
}
export function applyIntakePolicyDefaults(data: any, policy: ReturnType<typeof normalizeIntakePolicy>) {
  return {
    ...data,
    delivery: { ...data.delivery, workflowTemplate: data.delivery?.workflowTemplate || policy.deliveryMethod },
    governance: { ...data.governance, budgetPolicy: data.governance?.budgetPolicy || policy.budgetGovernancePolicy },
  };
}
