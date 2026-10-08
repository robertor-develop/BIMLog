import { expectedIntakeTaskCount } from "./intake-activation-task-count";
import type { JobIntakeStage } from "./job-intake-workspace-state";
import { withActiveIntakeReturn } from "./active-intake-roundtrip";

const blockerStages: Record<string, JobIntakeStage> = {
  job_name: "identity", job_code: "identity", client: "identity",
  scope: "scope", edt_source: "scope", pricing: "scope",
  contract_title: "contract", contract_number: "contract", counterparty: "contract",
  contract_assignment: "contract", budget_mapping: "contract", budget_snapshot: "contract",
  delivery: "delivery", team: "team", internal_rates: "team", confirmations: "review",
};

const blockerAnchors: Record<string, string> = {
  job_name: "ji-job-name", job_code: "ji-job-code", client: "ji-client",
  scope: "ji-scope", edt_source: "ji-scope", pricing: "ji-scope",
  contract_title: "ji-contract-title", contract_number: "ji-contract-contractNumber",
  counterparty: "ji-contract-counterpartyName", contract_assignment: "ji-contract-item-assignment",
  budget_mapping: "ji-scope", budget_snapshot: "ji-contract",
  delivery: "ji-submittal-strategy", team: "ji-team", internal_rates: "ji-team",
  confirmations: "ji-review",
};

export function jobIntakeBlockerDestination(code: string) {
  const stage = blockerStages[code] ?? "review";
  return { stage, item: blockerAnchors[code] ?? `ji-${stage}` };
}

export function jobIntakeActivationPreview(data: any, completion: any, commercial: boolean) {
  const assignments = Array.isArray(data?.team?.assignments) ? data.team.assignments : [];
  const scopeItems = Array.isArray(data?.scopeItems) ? data.scopeItems : [];
  return {
    workItems: scopeItems.length,
    tasks: expectedIntakeTaskCount(scopeItems, assignments),
    // Activation persists generic rows as Intake demand, never as fake person
    // assignments. Only already named legacy rows are expected in Operations.
    resourcePlans: assignments.filter((row: any) => row.userId != null || String(row.personName ?? "").trim()).length,
    namedAssignments: assignments.filter((row: any) => row.userId != null || String(row.personName ?? "").trim()).length,
    genericResourceDemands: assignments.filter((row: any) => row.userId == null && !String(row.personName ?? "").trim()).length,
    unassignedHours: String(completion?.totals?.unassignedHours ?? "0"),
    contractDrafts: commercial ? (data?.commercial?.contracts?.length ?? 0) : 0,
  };
}

export function jobIntakeActivationMatches(expected: ReturnType<typeof jobIntakeActivationPreview>, activation: any) {
  return expected.workItems === (activation?.workItems?.length ?? 0)
    && expected.tasks === (activation?.tasks?.length ?? 0)
    && expected.resourcePlans === (activation?.assignments?.length ?? 0);
}

export function jobIntakeActivationStructure(status: string, preview: ReturnType<typeof jobIntakeActivationPreview>, activation: any) {
  // The persisted activation receipt is canonical evidence that the job was
  // created. Older Intake rows can carry that receipt while their status is
  // being normalized, so never present a future-tense preview over it.
  if (status !== "activated" && !activation) return { mode: "preview" as const, ...preview };
  return {
    mode: "created" as const,
    workItems: activation?.workItems?.length ?? 0,
    tasks: activation?.tasks?.length ?? 0,
    resourcePlans: activation?.assignments?.length ?? 0,
    namedAssignments: activation?.assignments?.length ?? 0,
    genericResourceDemands: 0,
    unassignedHours: "0",
    contractDrafts: 0,
  };
}

export function jobIntakeActiveChangeDestinations(projectId: number, contractsEnabled: boolean) {
  return {
    operations: withActiveIntakeReturn(`/projects/${projectId}/operations`, projectId),
    contracts: contractsEnabled ? withActiveIntakeReturn(`/projects/${projectId}/financial/contracts`, projectId) : null,
  };
}
