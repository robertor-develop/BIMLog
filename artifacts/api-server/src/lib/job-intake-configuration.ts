export const BIMLOG_DELIVERY_METHODS = [
  { key: "bim-submittal", label: "BIM shop drawing / submittal", labelEs: "Plano de taller BIM / submittal" },
  { key: "coordination-delivery", label: "Coordination delivery", labelEs: "Entrega de coordinación" },
  { key: "document-control", label: "Document control", labelEs: "Control de documentos" },
] as const;

export const BIMLOG_BUDGET_GOVERNANCE_POLICIES = [
  { key: "standard", label: "BIMLog standard controls", labelEs: "Controles estándar de BIMLog" },
  { key: "pmo-controlled", label: "PMO controlled", labelEs: "Controlado por PMO" },
  { key: "advisory", label: "Advisory visibility", labelEs: "Visibilidad consultiva" },
] as const;

export type BudgetGovernancePolicyKey = typeof BIMLOG_BUDGET_GOVERNANCE_POLICIES[number]["key"];
export const DEFAULT_DELIVERY_METHOD = BIMLOG_DELIVERY_METHODS[0].key;
export const DEFAULT_BUDGET_GOVERNANCE_POLICY: BudgetGovernancePolicyKey = "standard";

export function normalizeBudgetGovernancePolicy(value: unknown): BudgetGovernancePolicyKey {
  const candidate = String(value ?? "").trim();
  return BIMLOG_BUDGET_GOVERNANCE_POLICIES.some((policy) => policy.key === candidate)
    ? candidate as BudgetGovernancePolicyKey
    : DEFAULT_BUDGET_GOVERNANCE_POLICY;
}
