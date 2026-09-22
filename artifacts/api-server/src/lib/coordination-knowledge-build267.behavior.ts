import assert from "node:assert/strict";
import { BIMTECH_COORDINATION_STARTER_LIBRARY as seed } from "./bimtech-coordination-starter-library";

assert.ok(seed.conflictTypes.length >= 20 && seed.conflictTypes.length <= 30);
assert.equal(seed.conflictTypes.length, 24);
assert.equal(seed.provenance.synthetic, true);
assert.equal(seed.provenance.professionalApproval, "not_reviewed");
assert.ok(seed.conflictTypes.every(item => item.tags.includes("professional-review-required")));
assert.ok(seed.conflictTypes.every(item => /Review, revise and approve/.test(item.description)));

for (const required of [
  "HVAC-DUCT-BEAM", "PLBG-PIPE-BEAM", "HVAC-DUCT-WALL", "PLBG-PIPE-DUCT", "ELEC-TRAY-DUCT",
  "FP-SPRINKLER-FRAMING", "MEP-EQUIPMENT-CLEARANCE", "MEP-CEILING-SERVICE-ZONE", "MEP-ACCESS-CLEARANCE", "MEP-SLEEVE-OPENING",
]) assert.ok(seed.conflictTypes.some(item => item.code === required), `missing ${required}`);

const serialized = JSON.stringify(seed);
for (const forbidden of ["projectId", "projectName", "customerId", "customerName", "clientName", "approvedBy"]) assert.equal(serialized.includes(`\"${forbidden}\"`), false);

console.log("Build 267 BIMTECH starter Conflict Types: PASS (24 controlled drafts)");
