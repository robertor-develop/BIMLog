import { expectedIntakeTaskCount } from "./intake-activation-task-count";
import type { JobIntakeStage } from "./job-intake-workspace-state";

const blockerStages: Record<string, JobIntakeStage> = {
  job_name: "identity", job_code: "identity", client: "identity",
  scope: "scope", edt_source: "scope", pricing: "scope",
  contract_title: "contract", contract_number: "contract", counterparty: "contract",
  contract_assignment: "contract", budget_mapping: "contract", budget_snapshot: "contract",
  delivery: "delivery", team: "team", internal_rates: "team", confirmations: "review",
};

export function jobIntakeBlockerDestination(code: string) {
  const stage = blockerStages[code] ?? "review";
  return { stage, item: `ji-${stage}` };
}

export function jobIntakeActivationPreview(data: any, completion: any, commercial: boolean) {
  const assignments = Array.isArray(data?.team?.assignments) ? data.team.assignments : [];
  const scopeItems = Array.isArray(data?.scopeItems) ? data.scopeItems : [];
  return {
    workItems: scopeItems.length,
    tasks: expectedIntakeTaskCount(scopeItems, assignments),
    resourcePlans: assignments.length,
    namedAssignments: assignments.filter((row: any) => row.userId != null).length,
    genericResourceDemands: assignments.filter((row: any) => row.userId == null).length,
    unassignedHours: String(completion?.totals?.unassignedHours ?? "0"),
    contractDrafts: commercial ? (data?.commercial?.contracts?.length ?? 0) : 0,
  };
}

export function jobIntakeActivationMatches(expected: ReturnType<typeof jobIntakeActivationPreview>, activation: any) {
  return expected.workItems === (activation?.workItems?.length ?? 0)
    && expected.tasks === (activation?.tasks?.length ?? 0)
    && expected.resourcePlans === (activation?.assignments?.length ?? 0);
}
