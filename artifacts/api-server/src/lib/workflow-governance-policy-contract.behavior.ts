import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateWorkflowGovernancePolicy, workflowGovernancePolicyFingerprint, workflowPolicyIndependentCheckerAllowed, WorkflowGovernancePolicyError } from "./workflow-governance-policy-contract";
import { applicablePublishedGovernance } from "./workflow-governance-binding";

const actions = ["create_work_item", "complete_phase", "complete_deliverable", "economic_change", "template_update", "activate_version"];
const changes = ["edit_phases", "edit_tasks_roles", "edit_allocation", "change_apu", "edit_approved_work_item", "retire_version"];
const valid = {
  schemaVersion: 1,
  scope: { allWorkflows: true, workflowTemplateIds: [] },
  approvalRules: actions.map(action => ({ action, roles: ["PROJECT_MANAGER"], threshold: action === "economic_change" ? { currency: "USD", amountMinor: 2500000 } : null })),
  changeRules: changes.map(action => ({ action, allowed: true, requiresReapproval: true, requiresNewVersion: action === "edit_phases" || action === "change_apu" })),
  versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true },
  permissions: [{ role: "PROJECT_MANAGER", actions: ["view", "edit_draft", "approve", "publish", "manage"] }],
  validation: { allocation_total_100: true, task_execute_role: true, phase_review_role: true, final_approval: true, required_documents: true, valid_apu: true, unique_phase_codes: true },
};
const copy = () => structuredClone(valid);
assert.deepEqual(validateWorkflowGovernancePolicy(valid).scope, valid.scope);
assert.match(workflowGovernancePolicyFingerprint(valid), /^[a-f0-9]{64}$/);
assert.equal(workflowGovernancePolicyFingerprint(valid), workflowGovernancePolicyFingerprint(copy()));
assert.equal(workflowPolicyIndependentCheckerAllowed({ actorUserId: 4, createdById: 4, updatedById: 5 }), false);
assert.equal(workflowPolicyIndependentCheckerAllowed({ actorUserId: 5, createdById: 4, updatedById: 5 }), false);
assert.equal(workflowPolicyIndependentCheckerAllowed({ actorUserId: 6, createdById: 4, updatedById: 5 }), true);
assert.equal(workflowPolicyIndependentCheckerAllowed({ actorUserId: 0, createdById: 4, updatedById: 5 }), false);
const published = { policyId: "policy-1", versionId: "version-1", code: "QA-GOV", version: 1,
  definition: validateWorkflowGovernancePolicy(valid), fingerprint: workflowGovernancePolicyFingerprint(valid) };
assert.equal(applicablePublishedGovernance([published], null)?.versionId, "version-1");
assert.equal(applicablePublishedGovernance([], "template-1"), null);
assert.throws(() => applicablePublishedGovernance([published, { ...published, policyId: "policy-2" }], "template-1"),
  (error: unknown) => (error as { code?: string }).code === "WORKFLOW_POLICY_AMBIGUOUS");
assert.throws(() => applicablePublishedGovernance([{ ...published, fingerprint: "0".repeat(64) }], null),
  (error: unknown) => (error as { code?: string }).code === "WORKFLOW_POLICY_FINGERPRINT_MISMATCH");
const policyRoutes = readFileSync(new URL("../routes/workflow-governance-policies.ts", import.meta.url), "utf8");
const workflowRoutes = readFileSync(new URL("../routes/delivery-workflow-templates.ts", import.meta.url), "utf8");
assert.match(policyRoutes.slice(policyRoutes.indexOf('versions/:versionId/retire')), /pg_advisory_xact_lock\(hashtext\('bimlog:workflow-policy-publish'\)/);
assert.match(workflowRoutes.slice(workflowRoutes.indexOf('versions/:versionId/publish')), /pg_advisory_xact_lock\(hashtext\('bimlog:workflow-policy-publish'\)/);
function invalid(change: (value: ReturnType<typeof copy>) => void, field: string) {
  const candidate = copy(); change(candidate);
  assert.throws(() => validateWorkflowGovernancePolicy(candidate), (error: unknown) => error instanceof WorkflowGovernancePolicyError && error.field === field);
}
invalid(value => { value.scope.allWorkflows = false; }, "scope.workflowTemplateIds");
invalid(value => { value.approvalRules[1].action = "create_work_item"; }, "approvalRules.action");
invalid(value => { value.approvalRules[3].threshold = { currency: "USD", amountMinor: -1 }; }, "approvalRules[3].threshold.amountMinor");
invalid(value => { value.changeRules[0].requiresNewVersion = false; }, "changeRules[0].requiresNewVersion");
invalid(value => { value.versioning.lockActivatedSnapshot = false; }, "versioning.lockActivatedSnapshot");
invalid(value => { value.permissions[0].actions = ["approve"]; }, "permissions[0].actions");
invalid(value => { value.approvalRules[0].roles = ["UNMAPPED_ROLE"]; }, "approvalRules.create_work_item.roles");
invalid(value => { value.permissions[0].actions = ["view", "approve"]; }, "permissions.publish");
invalid(value => { value.validation.valid_apu = false; }, "validation.valid_apu");
invalid(value => { (value as Record<string, unknown>).budgetGovernance = {}; }, "definition");
console.log("Workflow Governance Policy contract: strict scope, thresholds, change rules, permissions, validation and fingerprint passed");
