import { EdtEngineConflict, type EdtTransactionClient } from "./edt-engine-transaction";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";

export type ActivatedEdtWorkItem = Readonly<{
  id: string;
  stableScopeItemId: string;
  contractId: string | null;
  contractVersionId: string | null;
  status: string;
}>;

export type ActivatedEdtSource = Readonly<{
  project: { id: number; code: string; name: string };
  intake: { id: string; revision: number; data: Record<string, unknown>; activationSummary: Record<string, unknown> };
  workItems: readonly ActivatedEdtWorkItem[];
}>;

function objectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function loadActivatedEdtSource(client: EdtTransactionClient, input: {
  companyId: number;
  projectId: number;
  intakeId: string;
}): Promise<ActivatedEdtSource> {
  const intake = (await client.query<{
    id: string; company_id: number; project_id: number; status: string; revision: number;
    data: unknown; activation_summary: unknown;
  }>(`SELECT id,company_id,project_id,status,revision,data,activation_summary
      FROM job_intakes WHERE id=$1 AND company_id=$2 AND project_id=$3`,
    [input.intakeId, input.companyId, input.projectId])).rows[0];
  if (!intake) throw new EdtEngineConflict("INTAKE_NOT_FOUND", "The Intake is not available in this company and project.");
  if (intake.status !== "activated" || !Number.isInteger(intake.revision) || intake.revision < 1 || !objectRecord(intake.data) || !objectRecord(intake.activation_summary))
    throw new EdtEngineConflict("EDT_SOURCE_NOT_ACTIVATED", "The EDT source requires a saved activated Intake snapshot.");

  const project = (await client.query<{ id: number; code: string; name: string }>(
    "SELECT id,code,name FROM projects WHERE id=$1 AND company_id=$2 AND status<>'archived'", [input.projectId, input.companyId])).rows[0];
  if (!project || !project.code?.trim() || !project.name?.trim())
    throw new EdtEngineConflict("EDT_PROJECT_SOURCE_MISSING", "The saved project identity is unavailable.");

  const workItems = (await client.query<{
    id: string; stableScopeItemId: string; contractId: string | null; contractVersionId: string | null; status: string;
  }>(`SELECT id,stable_scope_item_id AS "stableScopeItemId",contract_id AS "contractId",
      contract_version_id AS "contractVersionId",status
      FROM job_activation_work_items WHERE intake_id=$1 AND project_id=$2 AND status<>'cancelled' ORDER BY stable_scope_item_id,id`,
    [input.intakeId, input.projectId])).rows;
  if (!workItems.length) throw new EdtEngineConflict("EDT_WORK_ITEMS_MISSING", "The activated Intake has no saved Work Items to project.");
  const activationContracts = intake.activation_summary.contracts;
  if (!Array.isArray(activationContracts) || !activationContracts.length || activationContracts.some(value =>
    !objectRecord(value) || typeof value.contractId !== "string" || !value.contractId ||
    typeof value.contractVersionId !== "string" || !value.contractVersionId))
    throw new EdtEngineConflict("EDT_CONTRACT_SOURCE_MISSING", "The activated Intake has no complete canonical Contract bindings.");
  const canonical = (await client.query<{ contractId: string; versionId: string; currency: string; contentFingerprint: string }>(
    `SELECT c.id AS "contractId",v.id AS "versionId",v.currency,v.content_fingerprint AS "contentFingerprint"
      FROM financial_contracts c JOIN financial_contract_versions v ON v.contract_id=c.id
      WHERE c.company_id=$1 AND c.project_id=$2 AND v.id=ANY($3::text[])`,
    [input.companyId, input.projectId, activationContracts.map(value => (value as Record<string, unknown>).contractVersionId)])).rows;
  const versions = new Map(canonical.map(row => [row.versionId, row]));
  if (versions.size !== activationContracts.length || activationContracts.some(value => {
    const binding = value as Record<string, unknown>;
    const row = versions.get(String(binding.contractVersionId));
    return !row || row.contractId !== binding.contractId || !row.currency?.trim() || !/^[a-f0-9]{64}$/.test(row.contentFingerprint);
  })) throw new EdtEngineConflict("EDT_CONTRACT_SOURCE_MISMATCH", "An activated Contract version is missing, outside this company/project, or differs from its saved binding.");
  const workflowBindings = (await client.query<{ workItemId: string; source: string; versionId: string | null; templateCode: string; templateVersion: number; definition: unknown; fingerprint: string }>(
    `SELECT work_item_id AS "workItemId",source,version_id AS "versionId",template_code AS "templateCode",
      template_version AS "templateVersion",definition,fingerprint FROM company_delivery_workflow_work_items
      WHERE company_id=$1 AND project_id=$2 AND work_item_id=ANY($3::text[])`,
    [input.companyId, input.projectId, workItems.map(item => item.id)])).rows;
  const workflows = new Map(workflowBindings.map(row => [row.workItemId, row]));
  if (workflows.size !== workItems.length || workItems.some(item => !workflows.has(item.id)))
    throw new EdtEngineConflict("EDT_WORKFLOW_SOURCE_MISSING", "Every saved Work Item requires its own activated Delivery Workflow binding.");
  for (const binding of workflowBindings) {
    if (!binding.templateCode?.trim() || !Number.isSafeInteger(binding.templateVersion) || binding.templateVersion < 1 ||
      !((binding.source === "company" && binding.versionId) || (binding.source === "bimlog" && binding.versionId === null)))
      throw new EdtEngineConflict("EDT_WORKFLOW_SOURCE_MISMATCH", "A Delivery Workflow binding has an invalid source or version identity.");
    try {
      if (deliveryWorkflowFingerprint(validateDeliveryWorkflowDefinition(binding.definition)) !== binding.fingerprint)
        throw new Error("fingerprint mismatch");
    } catch {
      throw new EdtEngineConflict("EDT_WORKFLOW_SOURCE_MISMATCH", "An activated Delivery Workflow definition failed integrity verification.");
    }
  }
  return { project, intake: { id: intake.id, revision: intake.revision, data: intake.data, activationSummary: intake.activation_summary }, workItems };
}
