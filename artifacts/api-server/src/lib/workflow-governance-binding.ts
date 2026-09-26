import { FinancialControlError } from "./financial-control-contract";
import { validateWorkflowGovernancePolicy, workflowGovernancePolicyFingerprint, type WorkflowGovernancePolicy } from "./workflow-governance-policy-contract";
import { previewGovernedWorkflowAllocation } from "./delivery-workflow-allocation-source";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition, type DeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";

type Queryable = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };
type Workflow = { templateId: string | null; definition: DeliveryWorkflowDefinition };
export type GovernanceSnapshot = { policyId: string; versionId: string; code: string; version: number;
  definition: WorkflowGovernancePolicy; fingerprint: string };
export type PublishedGovernanceRow = { policyId: string; versionId: string; code: string; version: number;
  definition: unknown; fingerprint: string };

export async function publishedGovernanceRows(client: Queryable, companyId: number): Promise<PublishedGovernanceRow[]> {
  return (await client.query(`SELECT p.id "policyId",p.code,v.id "versionId",v.version,v.definition,v.fingerprint
    FROM company_workflow_governance_policies p JOIN company_workflow_governance_versions v ON v.policy_id=p.id
    WHERE p.company_id=$1 AND v.state='published' ORDER BY p.code,v.version DESC`, [companyId])).rows;
}

export function policyApplies(definition: WorkflowGovernancePolicy, workflowTemplateId: string | null): boolean {
  return definition.scope.allWorkflows || (workflowTemplateId !== null && definition.scope.workflowTemplateIds.includes(workflowTemplateId));
}
export function policiesOverlap(left: WorkflowGovernancePolicy, right: WorkflowGovernancePolicy): boolean {
  return left.scope.allWorkflows || right.scope.allWorkflows || left.scope.workflowTemplateIds.some(id => right.scope.workflowTemplateIds.includes(id));
}
export function applicablePublishedGovernance(rows: PublishedGovernanceRow[], workflowTemplateId: string | null): GovernanceSnapshot | null {
  const applicable: GovernanceSnapshot[] = [];
  for (const row of rows) {
    const definition = validateWorkflowGovernancePolicy(row.definition);
    if (workflowGovernancePolicyFingerprint(definition) !== row.fingerprint)
      throw new FinancialControlError(409,"WORKFLOW_POLICY_FINGERPRINT_MISMATCH","A published Governance Policy failed integrity verification.");
    if (policyApplies(definition, workflowTemplateId)) applicable.push({ policyId:String(row.policyId), versionId:String(row.versionId),
      code:String(row.code), version:Number(row.version), definition, fingerprint:String(row.fingerprint) });
  }
  if (applicable.length > 1) throw new FinancialControlError(409,"WORKFLOW_POLICY_AMBIGUOUS","Multiple company Governance Policies apply to this Delivery Workflow.");
  return applicable[0] ?? null;
}
export function validateWorkflowAgainstGovernance(definition: WorkflowGovernancePolicy, workflow: DeliveryWorkflowDefinition): void {
  const fail = (code: string) => { throw new FinancialControlError(409, code, "The selected Delivery Workflow does not satisfy its published company Governance Policy."); };
  if (definition.validation.final_approval && !workflow.phases.at(-1)?.approvalRequired) fail("WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED");
  if (definition.validation.phase_review_role && workflow.phases.some(phase => !phase.qcRequired)) fail("WORKFLOW_POLICY_PHASE_REVIEW_REQUIRED");
  if (definition.validation.required_documents && workflow.phases.some(phase => !phase.tasks.some(task => task.requiredDocuments.length))) fail("WORKFLOW_POLICY_DOCUMENT_REQUIRED");
}

export function assertGovernanceChangeAllowed(policy: WorkflowGovernancePolicy, action: WorkflowGovernancePolicy["changeRules"][number]["action"]): void {
  const rule = policy.changeRules.find(item => item.action === action);
  if (!rule?.allowed) throw new FinancialControlError(409,"WORKFLOW_POLICY_CHANGE_FORBIDDEN",`The published Governance Policy forbids ${action}.`);
}

export function workflowDefinitionChanges(before: DeliveryWorkflowDefinition, after: DeliveryWorkflowDefinition) {
  const changed = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);
  const actions: Array<WorkflowGovernancePolicy["changeRules"][number]["action"]> = [];
  const structure = (value: DeliveryWorkflowDefinition) => ({
    deliverableTypes: value.deliverableTypes,
    phases: value.phases.map(({ tasks: _tasks, ...phase }) => phase),
    transitions: value.transitions, reopen: value.reopen,
  });
  const tasks = (value: DeliveryWorkflowDefinition) => ({ roles: value.roles,
    phases: value.phases.map(phase => ({ id: phase.id, tasks: phase.tasks })) });
  if (changed(structure(before), structure(after))) actions.push("edit_phases");
  if (changed(tasks(before), tasks(after))) actions.push("edit_tasks_roles");
  if (changed(before.economicAllocation?.sourceVersionId ?? null, after.economicAllocation?.sourceVersionId ?? null)) actions.push("change_apu");
  if (changed(before.economicAllocation?.proposal ?? null, after.economicAllocation?.proposal ?? null)) actions.push("edit_allocation");
  return actions;
}

export function assertWorkflowReplacementAllowed(policy: WorkflowGovernancePolicy,
  before: DeliveryWorkflowDefinition, after: DeliveryWorkflowDefinition): void {
  for (const action of workflowDefinitionChanges(before, after)) {
    if (!policy.changeRules.find(rule => rule.action === action)?.allowed)
      throw new FinancialControlError(409, `WORKFLOW_POLICY_${action.toUpperCase()}_FORBIDDEN`,
        "The published Governance Policy forbids this workflow replacement change.");
  }
}

export async function validatePublishedWorkflowsForPolicy(client: Queryable, companyId: number,
  policy: WorkflowGovernancePolicy): Promise<void> {
  const rows = (await client.query(`SELECT t.id "templateId",v.definition,v.fingerprint
    FROM company_delivery_workflow_templates t JOIN company_delivery_workflow_versions v ON v.template_id=t.id
    WHERE t.company_id=$1 AND v.state='published' ORDER BY t.id`, [companyId])).rows;
  for (const row of rows) {
    if (!policyApplies(policy, String(row.templateId))) continue;
    const workflow = validateDeliveryWorkflowDefinition(row.definition);
    if (deliveryWorkflowFingerprint(workflow) !== row.fingerprint)
      throw new FinancialControlError(409,"DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH","A published Delivery Workflow failed integrity verification.");
    validateWorkflowAgainstGovernance(policy, workflow);
  }
}

export async function resolveWorkflowGovernanceSnapshot(client: Queryable, companyId: number, workflow: Workflow): Promise<GovernanceSnapshot | null> {
  const rows = await publishedGovernanceRows(client, companyId);
  const selected = applicablePublishedGovernance(rows, workflow.templateId);
  if (!selected) return null;
  validateWorkflowAgainstGovernance(selected.definition, workflow.definition);
  if (workflow.definition.economicAllocation) {
    await previewGovernedWorkflowAllocation({ client, companyId,
      sourceVersionId:workflow.definition.economicAllocation.sourceVersionId,
      proposal:workflow.definition.economicAllocation.proposal,
      workflowPhases:workflow.definition.phases });
  }
  return selected;
}
