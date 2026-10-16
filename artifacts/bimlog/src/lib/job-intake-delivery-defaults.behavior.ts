import assert from "node:assert/strict";
import { deliveryWorkflowDefaults, selectDeliveryWorkflow } from "./job-intake-delivery-defaults";

const selected = selectDeliveryWorkflow({ workflowTemplate: "bim-submittal", submittalStrategy: "", milestoneSummary: "" }, "coordination-delivery");
assert.equal(selected.submittalStrategy, deliveryWorkflowDefaults["coordination-delivery"].submittalStrategy);
assert.equal(selected.milestoneSummary, deliveryWorkflowDefaults["coordination-delivery"].milestoneSummary);
const customized = selectDeliveryWorkflow({ workflowTemplate: "bim-submittal", submittalStrategy: "Customer-specific review", milestoneSummary: "Gate A" }, "document-control");
assert.equal(customized.submittalStrategy, "Customer-specific review");
assert.equal(customized.milestoneSummary, "Gate A");
console.log("job-intake-delivery-defaults.behavior: PASS");
