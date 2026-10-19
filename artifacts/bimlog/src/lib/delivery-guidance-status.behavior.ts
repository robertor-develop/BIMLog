import assert from "node:assert/strict";
import { deliveryGuidanceStatus, deliveryGuidanceStatusLabel } from "./job-intake-delivery-defaults";
const generated={submittalStrategy:"Draft → Issue",deliveryWorkflowGeneratedStrategy:"Draft → Issue",milestoneSummary:"PRE → FOR",deliveryWorkflowGeneratedMilestones:"PRE → FOR"};
assert.deepEqual(deliveryGuidanceStatus(generated),{strategyGenerated:true,milestonesGenerated:true,generated:true});
assert.deepEqual(deliveryGuidanceStatus({...generated,submittalStrategy:"Reviewed"}),{strategyGenerated:false,milestonesGenerated:true,generated:false});
assert.match(deliveryGuidanceStatusLabel({...generated,deliveryWorkflowDerivedFromVersionId:"wf-v7"},"strategy"),/version wf-v7/);
assert.match(deliveryGuidanceStatusLabel({...generated,milestoneSummary:"Reviewed"},"milestones"),/Reviewed project text/);
console.log("delivery guidance status: PASS");
