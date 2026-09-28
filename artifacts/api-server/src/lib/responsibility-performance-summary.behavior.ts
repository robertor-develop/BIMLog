import assert from "node:assert/strict";
import { responsibilityPerformanceSummary } from "./responsibility-performance-summary";

const summary = responsibilityPerformanceSummary([
  { key: "rfi:1", owner: { company: "BIMTECH CORP" }, authorizedLink: "/projects/8/rfis?record=1", classification: { groups: { due: false, overdue: true, blocked: false, noResponse: true } } },
  { key: "rfi:1", owner: { company: "BIMTECH CORP" }, authorizedLink: "/projects/8/rfis?record=1", classification: { groups: { due: false, overdue: true, blocked: false, noResponse: true } } },
  { key: "submittal:2", owner: { company: null }, authorizedLink: "/projects/8/submittals/2", classification: { groups: { due: true, overdue: false, blocked: true, noResponse: false } } },
]);

const bimtech = summary.aggregates.find(item => item.company === "BIMTECH CORP")!;
assert.equal(bimtech.actionableCount, 2, "the aggregate counts source items while de-duplicating only drill references");
assert.equal(bimtech.sourceReferences.length, 1);
assert.equal(bimtech.overdueCount, 2);
assert.equal(summary.escalationPreparation.notificationSent, false);
assert.equal(summary.escalationPreparation.automaticScore, false);
assert.deepEqual(summary.escalationPreparation.candidates.find(item => item.aggregateIdentity === bimtech.identity)?.sourceReferences, bimtech.sourceReferences);
assert.ok(!("score" in bimtech), "no blame or performance score is produced");

console.log("C035 traceable responsibility performance summary: PASS");
