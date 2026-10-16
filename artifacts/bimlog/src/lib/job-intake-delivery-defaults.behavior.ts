import assert from "node:assert/strict";
import { deliveryWorkflowDefaults, selectDeliveryWorkflow, selectPublishedDeliveryWorkflow } from "./job-intake-delivery-defaults";

const selected = selectDeliveryWorkflow({ workflowTemplate: "bim-submittal", submittalStrategy: "", milestoneSummary: "" }, "coordination-delivery");
assert.equal(selected.submittalStrategy, deliveryWorkflowDefaults["coordination-delivery"].submittalStrategy);
assert.equal(selected.milestoneSummary, deliveryWorkflowDefaults["coordination-delivery"].milestoneSummary);
const customized = selectDeliveryWorkflow({ workflowTemplate: "bim-submittal", submittalStrategy: "Customer-specific review", milestoneSummary: "Gate A" }, "document-control");
assert.equal(customized.submittalStrategy, "Customer-specific review");
assert.equal(customized.milestoneSummary, "Gate A");
const published = selectPublishedDeliveryWorkflow({}, { versionId: "wf-v7", definition: { phases: [
  { name: "Preliminary", tasks: [{ name: "Draft drawing" }, { name: "Internal QA" }] },
  { name: "For approval", tasks: [{ name: "Submit package" }] },
] } });
assert.equal(published.submittalStrategy, "Draft drawing → Internal QA → Submit package");
assert.equal(published.milestoneSummary, "Preliminary → For approval");
assert.equal(published.deliveryWorkflowDerivedFromVersionId, "wf-v7");
const override = selectPublishedDeliveryWorkflow({ deliveryWorkflowVersionId: "wf-v7", deliveryWorkflowDerivedFromVersionId: "wf-v6", submittalStrategy: "Reviewed custom strategy", milestoneSummary: "Custom gate" }, { versionId: "wf-v8", definition: { phases: [{ name: "Issue", tasks: [{ name: "Issue file" }] }] } });
assert.equal(override.submittalStrategy, "Reviewed custom strategy");
assert.equal(override.milestoneSummary, "Custom gate");
console.log("job-intake-delivery-defaults.behavior: PASS");
