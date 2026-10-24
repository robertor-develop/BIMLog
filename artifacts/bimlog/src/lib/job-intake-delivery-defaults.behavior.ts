import assert from "node:assert/strict";
import { deliveryWorkflowDefaults, hydrateSelectedDeliveryWorkflowGuidance, selectDeliveryWorkflow, selectPublishedDeliveryWorkflow } from "./job-intake-delivery-defaults";

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
assert.equal(published.deliveryWorkflowGeneratedStrategy, published.submittalStrategy);
assert.equal(published.deliveryWorkflowGeneratedMilestones, published.milestoneSummary);
const override = selectPublishedDeliveryWorkflow({ deliveryWorkflowVersionId: "wf-v7", deliveryWorkflowDerivedFromVersionId: "wf-v6", submittalStrategy: "Reviewed custom strategy", milestoneSummary: "Custom gate" }, { versionId: "wf-v8", definition: { phases: [{ name: "Issue", tasks: [{ name: "Issue file" }] }] } });
assert.equal(override.submittalStrategy, "Reviewed custom strategy");
assert.equal(override.milestoneSummary, "Custom gate");
const firstGenerated = selectPublishedDeliveryWorkflow({}, { versionId: "wf-v1", definition: { phases: [{ name: "Phase A", tasks: [{ name: "Task A" }] }] } });
const cleared = selectPublishedDeliveryWorkflow(JSON.parse(JSON.stringify(firstGenerated)), null);
assert.equal(cleared.deliveryWorkflowVersionId, "");
assert.equal(cleared.submittalStrategy, "");
assert.equal(cleared.milestoneSummary, "");
const reselected = selectPublishedDeliveryWorkflow(cleared, { versionId: "wf-v2", definition: { phases: [{ name: "Phase B", tasks: [{ name: "Task B" }] }] } });
assert.equal(reselected.submittalStrategy, "Task B");
assert.equal(reselected.milestoneSummary, "Phase B");
const userEdited = { ...firstGenerated, submittalStrategy: "My reviewed strategy", milestoneSummary: "My reviewed milestone" };
const changedVersion = selectPublishedDeliveryWorkflow(JSON.parse(JSON.stringify(userEdited)), { versionId: "wf-v2", definition: { phases: [{ name: "Phase B", tasks: [{ name: "Task B" }] }] } });
assert.equal(changedVersion.submittalStrategy, "My reviewed strategy");
assert.equal(changedVersion.milestoneSummary, "My reviewed milestone");
const clearedCustom = selectPublishedDeliveryWorkflow(changedVersion, null);
assert.equal(clearedCustom.submittalStrategy, "My reviewed strategy");
assert.equal(clearedCustom.milestoneSummary, "My reviewed milestone");
const hydrationOption = { versionId: "wf-v9", definition: { phases: [
  { name: "PRE", tasks: [{ name: "Prepare" }] },
  { name: "COO", tasks: [{ name: "Coordinate" }] },
  { name: "FOR", tasks: [{ name: "Issue" }] },
  { name: "ASB", tasks: [{ name: "Archive" }] },
] } };
const [hydrated, preserved, unavailable] = hydrateSelectedDeliveryWorkflowGuidance([
  { id: "missing-guidance", deliveryWorkflowVersionId: "wf-v9", submittalStrategy: "", milestoneSummary: "" },
  { id: "custom-guidance", deliveryWorkflowVersionId: "wf-v9", submittalStrategy: "Customer review", milestoneSummary: "Customer gate" },
  { id: "retired-version", deliveryWorkflowVersionId: "wf-retired", submittalStrategy: "", milestoneSummary: "" },
], [hydrationOption]);
assert.equal(hydrated.submittalStrategy, "Prepare → Coordinate → Issue → Archive");
assert.equal(hydrated.milestoneSummary, "PRE → COO → FOR → ASB");
assert.equal(hydrated.deliveryWorkflowDerivedFromVersionId, "wf-v9");
assert.equal(preserved.submittalStrategy, "Customer review");
assert.equal(preserved.milestoneSummary, "Customer gate");
assert.equal(unavailable.deliveryWorkflowDerivedFromVersionId, undefined);
console.log("job-intake-delivery-defaults.behavior: PASS");
