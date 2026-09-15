export const BIMLOG_CONFIGURATION_AUTHORITIES = {
  client: {
    source: "companies",
    scope: "enterprise",
    intakeRole: "reference",
  },
  discipline: {
    source: "enterprise_trades",
    scope: "enterprise",
    intakeRole: "reference",
  },
  service: {
    source: "enterprise_services",
    scope: "enterprise",
    intakeRole: "reference",
  },
  phase: {
    source: "enterprise_phases",
    scope: "enterprise",
    intakeRole: "reference",
  },
  deliveryMethod: {
    source: "job_intakes.delivery.workflowTemplate",
    scope: "project",
    intakeRole: "select_or_default",
  },
  pricing: {
    source: "generic_apu_template_versions",
    scope: "contract",
    intakeRole: "reference",
  },
  budgetGovernance: {
    source: "job_operations_budget_governance",
    scope: "project",
    intakeRole: "reference_and_snapshot",
  },
} as const;

export type BimlogConfigurationAuthority = keyof typeof BIMLOG_CONFIGURATION_AUTHORITIES;

export function configurationAuthority(authority: BimlogConfigurationAuthority) {
  return BIMLOG_CONFIGURATION_AUTHORITIES[authority];
}
