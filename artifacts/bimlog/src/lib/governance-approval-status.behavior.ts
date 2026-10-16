import assert from "node:assert/strict";
import { governanceApprovalStatus } from "./governance-approval-status";
const progress = { approved: 0, stages: [{ role: "PROJECT_LEADER", level: 1, action: "complete_phase" }], next: { role: "PROJECT_LEADER", level: 1, action: "complete_phase" }, complete: false };
assert.match(governanceApprovalStatus(progress, "BIMTECH-GOV", false) ?? "", /PROJECT_LEADER/);
assert.doesNotMatch(governanceApprovalStatus(progress, "BIMTECH-GOV", false) ?? "", /CEO/);
assert.match(governanceApprovalStatus({ ...progress, next: { role: "CEO", level: 2, action: "economic_change" } }, "CUSTOM", true) ?? "", /CEO/);
console.log("governance-approval-status.behavior: PASS");
