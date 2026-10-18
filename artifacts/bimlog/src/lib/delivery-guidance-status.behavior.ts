import assert from "node:assert/strict";
import { deliveryGuidanceStatus } from "./job-intake-delivery-defaults";
const generated={submittalStrategy:"Draft → Issue",deliveryWorkflowGeneratedStrategy:"Draft → Issue",milestoneSummary:"PRE → FOR",deliveryWorkflowGeneratedMilestones:"PRE → FOR"};
assert.deepEqual(deliveryGuidanceStatus(generated),{strategyGenerated:true,milestonesGenerated:true,generated:true});
assert.deepEqual(deliveryGuidanceStatus({...generated,submittalStrategy:"Reviewed"}),{strategyGenerated:false,milestonesGenerated:true,generated:false});
console.log("delivery guidance status: PASS");
