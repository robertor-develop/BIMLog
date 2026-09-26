import assert from "node:assert/strict";
import { FinancialControlError } from "./financial-control-contract";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
import { assertGovernanceChangeAllowed, assertWorkflowReplacementAllowed, workflowDefinitionChanges, validatePublishedWorkflowsForPolicy, validateWorkflowReplacementForPolicy } from "./workflow-governance-binding";
import { validateWorkflowGovernancePolicy } from "./workflow-governance-policy-contract";

const workflow = validateDeliveryWorkflowDefinition({
  schemaVersion: 1, deliverableTypes: ["SHOP_DRAWING"],
  roles: { execute: "DRAFTER", review: "QC_REVIEWER", approve: "PROJECT_MANAGER" },
  phases: [{ id: "phase", code: "PHASE", name: "Phase", order: 1,
    tasks: [{ id: "task", code: "TASK", name: "Task", order: 1, requiredDocuments: [] }],
    completionRule: "all_tasks_complete", qcRequired: false, approvalRequired: false }],
  transitions: [], reopen: { role: "approve", reasonRequired: true },
});
const policy = validateWorkflowGovernancePolicy({
  schemaVersion: 1, scope: { allWorkflows: false, workflowTemplateIds: ["target"] },
  approvalRules: ["create_work_item", "complete_phase", "complete_deliverable", "economic_change", "template_update", "activate_version"]
    .map(action => ({ action, roles: ["PROJECT_MANAGER"], threshold: null })),
  changeRules: ["edit_phases", "edit_tasks_roles", "edit_allocation", "change_apu", "edit_approved_work_item", "retire_version"]
    .map(action => ({ action, allowed: true, requiresReapproval: true, requiresNewVersion: action === "edit_phases" || action === "change_apu" })),
  versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true },
  permissions: [{ role: "PROJECT_MANAGER", actions: ["view", "edit_draft", "approve", "publish", "manage"] }],
  validation: { allocation_total_100: true, task_execute_role: true, phase_review_role: true,
    final_approval: true, required_documents: false, valid_apu: true, unique_phase_codes: true },
});
const rows = [{ templateId: "target", definition: workflow, fingerprint: deliveryWorkflowFingerprint(workflow) }];
const client = { async query(_sql: string, params?: unknown[]) { assert.deepEqual(params, [7]); return { rows }; } };
await assert.rejects(validatePublishedWorkflowsForPolicy(client, 7, policy),
  (error: unknown) => error instanceof FinancialControlError && error.code === "WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED");
rows[0].templateId = "unaffected";
await validatePublishedWorkflowsForPolicy(client, 7, policy);
rows[0].templateId = "target";
rows[0].fingerprint = "tampered";
await assert.rejects(validatePublishedWorkflowsForPolicy(client, 7, policy),
  (error: unknown) => error instanceof FinancialControlError && error.code === "DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH");
assertGovernanceChangeAllowed(policy,"retire_version");
const noRetirement = validateWorkflowGovernancePolicy({ ...policy,
  changeRules: policy.changeRules.map(rule => rule.action === "retire_version" ? { ...rule, allowed: false } : rule) });
assert.throws(() => assertGovernanceChangeAllowed(noRetirement,"retire_version"),
  (error: unknown) => error instanceof FinancialControlError && error.code === "WORKFLOW_POLICY_CHANGE_FORBIDDEN");
console.log("Published workflow policy compatibility: scoped, incompatible and integrity denial PASS");

assert.deepEqual(workflowDefinitionChanges(workflow, structuredClone(workflow)), []);
for (const action of ["edit_phases", "edit_tasks_roles", "change_apu", "edit_allocation"] as const) {
  const next = structuredClone(workflow);
  if (action === "edit_phases") next.phases[0].name = "Changed phase";
  if (action === "edit_tasks_roles") next.roles.execute = "BIM_MODELER";
  if (action === "change_apu" || action === "edit_allocation")
    next.economicAllocation = { sourceVersionId: "source", proposal: { method: "apu_default" } };
  assert.ok(workflowDefinitionChanges(workflow, next).includes(action));
  const forbidden = validateWorkflowGovernancePolicy({ ...policy,
    changeRules: policy.changeRules.map(rule => ({ ...rule, allowed: rule.action !== action })) });
  assert.throws(() => assertWorkflowReplacementAllowed(forbidden, workflow, next),
    (error: unknown) => error instanceof FinancialControlError && error.code === `WORKFLOW_POLICY_${action.toUpperCase()}_FORBIDDEN`);
  assertWorkflowReplacementAllowed(policy, workflow, next);
  assertWorkflowReplacementAllowed(forbidden, workflow, workflow);
}
console.log("Workflow replacement change classification and forbidden/allowed/no-change behavior PASS");
let priorRows: Array<{definition: unknown; fingerprint: string}> = [];
const replacementClient = { async query(sql: string, params?: unknown[]) {
  assert.deepEqual(params, [7,"target",2]);
  assert.match(sql, /t.company_id=\$1 AND t.id=\$2 AND v.version<\$3/);
  assert.match(sql, /'published','superseded','retired'/);
  return { rows: priorRows };
} };
await validateWorkflowReplacementForPolicy(replacementClient,7,"target",2,policy,workflow);
priorRows = [{ definition: workflow, fingerprint: deliveryWorkflowFingerprint(workflow) }];
await validateWorkflowReplacementForPolicy(replacementClient,7,"target",2,policy,workflow);
priorRows[0].fingerprint = "invalid";
await assert.rejects(validateWorkflowReplacementForPolicy(replacementClient,7,"target",2,policy,workflow),
  (error: unknown) => error instanceof FinancialControlError && error.code === "DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH");
console.log("Replacement baseline scope, first release, retired history and integrity checks PASS");
