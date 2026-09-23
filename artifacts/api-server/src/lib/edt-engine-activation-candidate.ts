import { projectActivatedEdtPlan, type ProjectedEdtPlan } from "./edt-engine-plan-projection";
import { loadActivatedEdtSource, type ActivatedEdtSource } from "./edt-engine-source-service";
import { edtFingerprint, EdtEngineConflict, type EdtTransactionClient } from "./edt-engine-transaction";

export type EdtActivationCandidate = Readonly<{
  intakeId: string;
  intakeRevision: number;
  governanceVersionId: string;
  pricingVersionId: string;
  workflowVersionIds: readonly string[];
  sourceFingerprint: string;
  plan: ProjectedEdtPlan;
}>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EdtEngineConflict("EDT_ACTIVATION_SOURCE_INCOMPLETE", "The activated configuration snapshot is missing.");
  return value as Record<string, unknown>;
}

/** Derive version identities from already frozen server records, never from a browser payload. */
export function deriveEdtActivationCandidate(source: ActivatedEdtSource): EdtActivationCandidate {
  const plan = projectActivatedEdtPlan(source);
  const configuration = record(source.intake.activationSummary.configurationSnapshot);
  const governancePolicy = configuration.budgetGovernancePolicy;
  if (typeof governancePolicy !== "string" || !governancePolicy.trim())
    throw new EdtEngineConflict("EDT_GOVERNANCE_SOURCE_MISSING", "The activated Intake has no saved Budget Governance selection.");
  const contracts = source.canonicalContracts;
  const workflows = source.workflowBindings;
  if (!contracts?.length || !workflows?.length || workflows.length !== source.workItems.length)
    throw new EdtEngineConflict("EDT_ACTIVATION_SOURCE_INCOMPLETE", "Canonical Contract and Workflow versions are required for EDT activation.");
  const contractVersions = contracts.map(contract => ({
    id: contract.contractId, versionId: contract.versionId, currency: contract.currency, fingerprint: contract.contentFingerprint,
  })).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(contractVersions.map(item => item.id)).size !== contractVersions.length)
    throw new EdtEngineConflict("EDT_CONTRACT_SOURCE_MISMATCH", "The activated Contract bindings are not unique.");
  const workflowVersions = workflows.map(workflow => ({
    workItemId: workflow.workItemId, source: workflow.source, versionId: workflow.versionId,
    code: workflow.templateCode, version: workflow.templateVersion, fingerprint: workflow.fingerprint,
  })).sort((a, b) => a.workItemId.localeCompare(b.workItemId));
  if (new Set(workflowVersions.map(item => item.workItemId)).size !== workflowVersions.length ||
    workflowVersions.some((item, index) => item.workItemId !== [...source.workItems].sort((a, b) => a.id.localeCompare(b.id))[index]?.id))
    throw new EdtEngineConflict("EDT_WORKFLOW_SOURCE_MISMATCH", "Every Work Item needs exactly one immutable Workflow binding.");
  const governanceVersionId = `activated-governance:${edtFingerprint(configuration)}`;
  const pricingVersionId = `activated-commercial:${edtFingerprint({ contracts: contractVersions, baseline: source.intake.activationSummary.commercialBaselineFingerprint ?? null })}`;
  const workflowVersionIds = workflowVersions.map(binding => `activated-workflow:${edtFingerprint(binding)}`);
  return {
    intakeId: source.intake.id, intakeRevision: source.intake.revision,
    governanceVersionId, pricingVersionId, workflowVersionIds, sourceFingerprint: plan.sourceFingerprint, plan,
  };
}

export async function loadEdtActivationCandidate(client: EdtTransactionClient, input: { companyId: number; projectId: number; intakeId: string }): Promise<EdtActivationCandidate> {
  return deriveEdtActivationCandidate(await loadActivatedEdtSource(client, input));
}
