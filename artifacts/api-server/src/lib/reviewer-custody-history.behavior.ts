import assert from "node:assert/strict";
import { custodyReadContract, normalizeRfiCustody, normalizeSubmittalCustody } from "./reviewer-custody-history";

const rfi = normalizeRfiCustody([
  { id: 1, rfiId: 7, projectId: 3, heldBy: "Ruben", heldByCompany: "BIMTECH CORP", fromDate: "2026-09-25T12:00:00Z", toDate: "2026-09-26T12:00:00Z", daysHeld: 1 },
  { id: 2, rfiId: 7, projectId: 3, heldBy: "Lorena", heldByCompany: "BIMTECH CORP", fromDate: "2026-09-26T12:00:00Z", toDate: null },
  { id: 3, rfiId: 8, projectId: 3, heldBy: "Unknown", heldByCompany: "BIMTECH CORP", fromDate: "bad", toDate: "2026-09-27T12:00:00Z" },
]);
assert.deepEqual(rfi.map(row => row.intervalState), ["closed", "open", "unknown"]);
assert.equal(rfi[0]?.provenance.tableOrField, "rfi_ball_in_court_history");

const submittal = normalizeSubmittalCustody({
  submittalId: 22,
  projectId: 3,
  history: [
    { party: "Trade", setAt: "2026-09-24T12:00:00Z", setBy: "Author" },
    { party: "Architect", setAt: "2026-09-25T12:00:00Z", setBy: "Reviewer" },
  ],
});
assert.equal(submittal[0]?.closedAt, "2026-09-25T12:00:00.000Z");
assert.equal(submittal[0]?.intervalState, "closed");
assert.equal(submittal[1]?.intervalState, "open");

const contract = custodyReadContract({
  rfiRows: [],
  linkedCoordinationEvidence: [{ serverId: 91, displayId: "CL-091", authorizedLink: "/projects/3/clash-reports?viewpoint=91" }],
});
assert.equal(contract.steps.length, 0, "Lens evidence must not manufacture a custody or approval event");
assert.equal(contract.linkedCoordinationEvidence.length, 1);

console.log("C031 custody-history read contract: PASS");
