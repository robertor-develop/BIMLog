import { EdtEngineConflict, type EdtTransactionClient } from "./edt-engine-transaction";

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
    "SELECT id,code,name FROM projects WHERE id=$1 AND status<>'archived'", [input.projectId])).rows[0];
  if (!project || !project.code?.trim() || !project.name?.trim())
    throw new EdtEngineConflict("EDT_PROJECT_SOURCE_MISSING", "The saved project identity is unavailable.");

  const workItems = (await client.query<{
    id: string; stableScopeItemId: string; contractId: string | null; contractVersionId: string | null; status: string;
  }>(`SELECT id,stable_scope_item_id AS "stableScopeItemId",contract_id AS "contractId",
      contract_version_id AS "contractVersionId",status
      FROM job_activation_work_items WHERE intake_id=$1 AND project_id=$2 AND status<>'cancelled' ORDER BY stable_scope_item_id,id`,
    [input.intakeId, input.projectId])).rows;
  if (!workItems.length) throw new EdtEngineConflict("EDT_WORK_ITEMS_MISSING", "The activated Intake has no saved Work Items to project.");
  return { project, intake: { id: intake.id, revision: intake.revision, data: intake.data, activationSummary: intake.activation_summary }, workItems };
}
