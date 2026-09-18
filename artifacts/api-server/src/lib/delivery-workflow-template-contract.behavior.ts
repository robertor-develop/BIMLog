import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boundedDeliveryWorkflowDraft, deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";

const shop = {
  schemaVersion: 1,
  deliverableTypes: ["SHOP_DRAWING"],
  roles: { execute: "DRAFTER", review: "QC_REVIEWER", approve: "PROJECT_MANAGER" },
  phases: [
    { id: "preliminary", code: "PRE", name: "Preliminary", order: 1,
      tasks: [{ id: "prepare", code: "PREPARE", name: "Prepare drawing", order: 1, requiredDocuments: ["MODEL"] }],
      completionRule: "all_tasks_complete", qcRequired: true, approvalRequired: false },
    { id: "record", code: "REC", name: "For Record", order: 2,
      tasks: [{ id: "issue", code: "ISSUE", name: "Issue drawing", order: 1, requiredDocuments: ["PDF"] }],
      completionRule: "all_tasks_reviewed", qcRequired: false, approvalRequired: true },
  ],
  transitions: [{ from: "preliminary", to: "record", gate: "qc_approved", requiredDocuments: ["PDF"] }],
  reopen: { role: "approve", reasonRequired: true },
};
const clone = () => structuredClone(shop);
const valid = validateDeliveryWorkflowDefinition(shop);
assert.equal(valid.phases.length, 2);
assert.equal(deliveryWorkflowFingerprint(valid), deliveryWorkflowFingerprint(validateDeliveryWorkflowDefinition(clone())));
const governed = validateDeliveryWorkflowDefinition({ ...clone(), economicAllocation: {
  sourceVersionId: "apu-v2", proposal: { method: "apu_default" },
} });
assert.notEqual(deliveryWorkflowFingerprint(valid), deliveryWorkflowFingerprint(governed));
assert.equal(governed.economicAllocation?.sourceVersionId, "apu-v2");
assert.throws(() => validateDeliveryWorkflowDefinition({ ...clone(), economicAllocation: {
  sourceVersionId: "apu-v2", proposal: { method: "apu_default", ignored: 10 },
} }), { code: "WORKFLOW_ALLOCATION_FIELD_INVALID" });

const sleeve = clone(); sleeve.deliverableTypes = ["SLEEVE"]; sleeve.phases[0].name = "Sleeve layout";
assert.notEqual(deliveryWorkflowFingerprint(valid), deliveryWorkflowFingerprint(validateDeliveryWorkflowDefinition(sleeve)));

const rejects = (mutate: (value: ReturnType<typeof clone>) => void, code: string) => {
  const value = clone(); mutate(value);
  assert.throws(() => validateDeliveryWorkflowDefinition(value), { code });
};
rejects(x => { x.phases[1].id = x.phases[0].id; }, "WORKFLOW_DUPLICATE_ID");
rejects(x => { x.phases[0].tasks[0].id = x.phases[1].tasks[0].id; }, "WORKFLOW_DUPLICATE_ID");
rejects(x => { x.phases[0].order = 2; }, "WORKFLOW_PHASE_ORDER_INVALID");
rejects(x => { x.phases[0].tasks[0].order = 2; }, "WORKFLOW_TASK_ORDER_INVALID");
rejects(x => { x.transitions[0].to = "unknown"; }, "WORKFLOW_TRANSITION_GRAPH_INVALID");
rejects(x => { x.phases[0].qcRequired = false; }, "WORKFLOW_QC_GATE_UNSUPPORTED");
rejects(x => { x.roles.execute = "lorena@example.com"; }, "WORKFLOW_CODE_INVALID");
rejects(x => { x.phases[0].tasks[0].requiredDocuments = ["BAD DOCUMENT"]; }, "WORKFLOW_CODE_INVALID");
rejects(x => { x.reopen.reasonRequired = false; }, "WORKFLOW_REOPEN_REASON_REQUIRED");
assert.deepEqual(boundedDeliveryWorkflowDraft({ schemaVersion: 1, phases: [] }), { schemaVersion: 1, phases: [] });
const migration = readFileSync(new URL("./delivery-workflow-template-migration.ts", import.meta.url), "utf8");
assert.match(migration, /one_published_version_uq/);
assert.match(migration, /one_open_version_uq/);
console.log("Delivery Workflow definition, fingerprint, version schema behavior passed");
