import assert from "node:assert/strict";import {applyApprovedCommercialChange} from "./commercial-change-approval";
const baseline={projectId:26,budgetVersionId:"BUD-v3",budgetFingerprint:"b".repeat(64),apuVersionId:"APU-v7",apuFingerprint:"a".repeat(64),currency:"USD",originalContractValue:"10000.00",currentApprovedValue:"10000.00",version:3};
const decision={changeOrderId:"CO-4",status:"approved" as const,amount:"500.25",currency:"USD",thresholdPolicyVersion:"POL-v2",requiredApproverRoles:["operations_director","ceo"],approvals:[{role:"operations_director",actorId:"od-1",at:"2026-09-28T19:00:00Z"},{role:"ceo",actorId:"ceo-1",at:"2026-09-28T19:05:00Z"}]};
assert.equal(applyApprovedCommercialChange(baseline,decision).currentApprovedValue,"10500.25");assert.equal(applyApprovedCommercialChange(baseline,decision).version,4);
assert.throws(()=>applyApprovedCommercialChange(baseline,{...decision,status:"pending_approval"}),/Only an approved/);assert.throws(()=>applyApprovedCommercialChange(baseline,{...decision,approvals:decision.approvals.slice(0,1)}),/threshold/);assert.equal(baseline.currentApprovedValue,"10000.00");
console.log("C083 approved commercial baseline versioning: PASS");
