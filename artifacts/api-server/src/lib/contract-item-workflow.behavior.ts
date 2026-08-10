import assert from "node:assert/strict";
import { assertWorkflowParent, defaultWorkflowPhases, requiredWorkflowParent, workflowNodeStatus, workflowNodeType } from "./contract-item-workflow-contract";

assert.deepEqual(defaultWorkflowPhases("bim-submittal"), ["Preliminary", "Coordination", "For Record", "As-Built"]);
assert.deepEqual(defaultWorkflowPhases("generic"), ["Phase 1"]);
assert.equal(requiredWorkflowParent("phase"), null);
assert.equal(requiredWorkflowParent("revision"), "phase");
assert.equal(requiredWorkflowParent("version"), "revision");
assert.equal(requiredWorkflowParent("task"), "version");
assert.doesNotThrow(() => assertWorkflowParent("phase", null));
assert.doesNotThrow(() => assertWorkflowParent("revision", "phase"));
assert.doesNotThrow(() => assertWorkflowParent("version", "revision"));
assert.doesNotThrow(() => assertWorkflowParent("task", "version"));
assert.throws(() => assertWorkflowParent("task", "phase"), /must belong to a version/);
assert.throws(() => workflowNodeType("budget"), /type is invalid/);
assert.equal(workflowNodeStatus("complete"), "complete");
assert.throws(() => workflowNodeStatus("approved"), /status is invalid/);

console.log(JSON.stringify({ status: "PASS", tests: 14, hierarchy: "Contract Item > Phase > Revision > Version > Task", budgetMutation: false }));
