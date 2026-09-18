import { FinancialControlError } from "./financial-control-contract";
import { resolveCompanyPricingTemplateBinding } from "./company-pricing-template-binding";
import { previewEconomicAllocation, type AllocationProposal, type CommercialApuAllocationSource } from "./delivery-workflow-economic-allocation";
import { sourceFromVerifiedCommercialApu } from "./delivery-workflow-allocation-source-contract";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";

type Queryable = { query(sql: string, values?: any[]): Promise<{ rows: any[] }> };

export async function resolveWorkflowAllocationSource(input: {
  client: Queryable;
  companyId: number;
  sourceVersionId: string;
}): Promise<CommercialApuAllocationSource> {
  await waitForGenericApuPersistenceMigration();
  const row = (await input.client.query(`SELECT id,currency,provenance
    FROM generic_apu_template_versions
    WHERE id=$1 AND company_id=$2 AND project_id IS NULL AND status='published'`,
    [input.sourceVersionId, input.companyId])).rows[0];
  if (!row) throw new FinancialControlError(404, "WORKFLOW_APU_NOT_FOUND", "The company has no published APU version with this identity.");
  const binding = await resolveCompanyPricingTemplateBinding({
    client: input.client, companyId: input.companyId, currency: row.currency, versionId: input.sourceVersionId,
  });
  if (!binding) throw new FinancialControlError(409, "WORKFLOW_APU_NOT_FOUND", "A published Commercial APU is required.");
  return sourceFromVerifiedCommercialApu({
    definition: row.provenance?.definition, versionId: binding.versionId,
    fingerprint: binding.fingerprint, currency: binding.currency,
  });
}

export async function previewGovernedWorkflowAllocation(input: {
  client: Queryable;
  companyId: number;
  sourceVersionId: string;
  proposal: AllocationProposal;
  workflowPhases: Array<{ id: string; code: string }>;
}) {
  const source = await resolveWorkflowAllocationSource(input);
  const preview = previewEconomicAllocation(source, input.proposal);
  if (preview.rows.length !== input.workflowPhases.length ||
    preview.rows.some((row, index) => row.phaseId !== input.workflowPhases[index].id ||
      row.code !== input.workflowPhases[index].code))
    throw new FinancialControlError(409, "WORKFLOW_ALLOCATION_PHASE_MISMATCH",
      "The allocation phase identities and order must match the Delivery Workflow.");
  return preview;
}
