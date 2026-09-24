import assert from "node:assert/strict";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import { chooseDeliveryWorkflow, deliveryWorkflowOptions } from "./delivery-workflow-selection";
import { workflowGovernancePolicyFingerprint } from "./workflow-governance-policy-contract";

const defaults = { mode: "defaults_allowed" as const, options: [...BIMLOG_DELIVERY_WORKFLOWS] };
assert.equal(chooseDeliveryWorkflow(defaults, "GENERAL", "").option.code, "GENERAL");
assert.equal(chooseDeliveryWorkflow(defaults, "SHOP_DRAWING", "").option.code, "SHOP_DRAWING");
assert.equal(chooseDeliveryWorkflow(defaults, "SLEEVE", "").option.code, "SLEEVE");
const company = { ...BIMLOG_DELIVERY_WORKFLOWS[1], versionId: "company-1", templateId: "template-1", source: "company" as const };
assert.equal(chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company] }, "SHOP_DRAWING", "").option.versionId, "company-1");
assert.throws(() => chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company, { ...company, versionId: "company-2" }] }, "SHOP_DRAWING", ""), /Multiple company Delivery Workflows/);
assert.equal(chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company, { ...company, versionId: "company-2" }] }, "SHOP_DRAWING", "company-2").option.versionId, "company-2");
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "SLEEVE", ""), /approved Delivery Workflow/);
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "SHOP_DRAWING", "bimlog:SHOP_DRAWING:1"), /unavailable/);
const policy = {
  schemaVersion: 1,
  scope: { allWorkflows: false, workflowTemplateIds: ["template-1"] },
  approvalRules: ["create_work_item", "complete_phase", "complete_deliverable", "economic_change", "template_update", "activate_version"].map(action => ({ action, roles: ["PROJECT_MANAGER"], threshold: null })),
  changeRules: ["edit_phases", "edit_tasks_roles", "edit_allocation", "change_apu", "edit_approved_work_item", "retire_version"].map(action => ({ action, allowed: true, requiresReapproval: true, requiresNewVersion: action === "edit_phases" || action === "change_apu" })),
  versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true },
  permissions: [{ role: "PROJECT_MANAGER", actions: ["view", "edit_draft", "approve", "publish", "manage"] }],
  validation: { allocation_total_100: true, task_execute_role: true, phase_review_role: false, final_approval: false, required_documents: false, valid_apu: true, unique_phase_codes: true },
};
const policyRow = { policyId: "policy-1", versionId: "policy-v1", code: "PMO-01", version: 1,
  definition: policy, fingerprint: workflowGovernancePolicyFingerprint(policy) };
function fakeClient(policyRows: unknown[], mode = "defaults_allowed") {
  return { async query(sql: string, params?: unknown[]) {
    assert.deepEqual(params, [42]);
    if (sql.includes("company_master_catalog_policies")) return { rows: [{ mode }] };
    if (sql.includes("company_delivery_workflow_templates")) return { rows: [{ ...company, definition: company.definition }] };
    if (sql.includes("company_workflow_governance_policies")) return { rows: policyRows };
    throw new Error(`Unexpected query: ${sql}`);
  } };
}
const governed = await deliveryWorkflowOptions(fakeClient([policyRow]), 42);
assert.equal(governed.options.find(option => option.versionId === company.versionId)?.governancePolicy?.code, "PMO-01");
assert.equal(governed.options.find(option => option.versionId === company.versionId)?.activationBlock, null);
assert.equal(governed.options.find(option => option.source === "bimlog")?.governancePolicy, null);
const blockedPolicy = { ...policy, validation: { ...policy.validation, phase_review_role: true } };
const blocked = await deliveryWorkflowOptions(fakeClient([{ ...policyRow, definition: blockedPolicy,
  fingerprint: workflowGovernancePolicyFingerprint(blockedPolicy) }]), 42);
assert.equal(blocked.options.find(option => option.versionId === company.versionId)?.activationBlock?.code, "WORKFLOW_POLICY_PHASE_REVIEW_REQUIRED");
assert.equal((await deliveryWorkflowOptions(fakeClient([], "approved_only"), 42)).options.length, 1);
await assert.rejects(deliveryWorkflowOptions(fakeClient([{ ...policyRow, fingerprint: "0".repeat(64) }]), 42),
  (error: unknown) => (error as { code?: string }).code === "WORKFLOW_POLICY_FINGERPRINT_MISMATCH");
await assert.rejects(deliveryWorkflowOptions(fakeClient([policyRow, { ...policyRow, policyId: "policy-2" }]), 42),
  (error: unknown) => (error as { code?: string }).code === "WORKFLOW_POLICY_AMBIGUOUS");
console.log("Delivery Workflow selection: defaults, sole company, multiple company, explicit selection, and approved-only gates passed.");
