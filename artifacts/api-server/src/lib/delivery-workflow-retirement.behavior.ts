import assert from "node:assert/strict";
import { boundedWorkflowRetirementReason } from "./delivery-workflow-retirement";

assert.equal(boundedWorkflowRetirementReason("  Replaced by v2  "), "Replaced by v2");
assert.equal(boundedWorkflowRetirementReason("no"), null);
assert.equal(boundedWorkflowRetirementReason("line\nbreak"), null);
assert.equal(boundedWorkflowRetirementReason("x".repeat(501)), null);
console.log("Delivery Workflow retirement reason: pass");
