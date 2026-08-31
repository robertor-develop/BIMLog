import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";

const relationships = {
  participants: [{ id: "BIMTECH", companyName: "BIMTech", role: "service_provider" }, { id: "GC", companyName: "General Contractor", role: "customer" }],
  engagements: [{ id: "BIMTECH-GC", providerParticipantId: "BIMTECH", customerParticipantId: "GC", description: "Coordination" }],
};
const normalized = normalizeJobIntakeData({ relationships, commercial: { contracts: [
  { id: "BASE", title: "Coordination contract", engagementId: "BIMTECH-GC", agreementKind: "base", status: "active" },
  { id: "CO-1", title: "Level 12 addition", engagementId: "BIMTECH-GC", parentContractId: "BASE", agreementKind: "change_order", status: "proposed" },
] } });
assert.equal(normalized.commercial.contracts[0].engagementId, "BIMTECH-GC");
assert.equal(normalized.commercial.contracts[1].parentContractId, "BASE");
assert.equal(normalized.commercial.contracts[1].status, "proposed");
assert.equal(normalized.commercial.contracts[1].contractNumber, "", "draft does not invent a legal number");
assert.throws(() => normalizeJobIntakeData({ relationships, commercial: { contracts: [{ id: "BAD", engagementId: "MISSING" }] } }), /relationship must exist/);
assert.throws(() => normalizeJobIntakeData({ relationships, commercial: { contracts: [{ id: "SELF", parentContractId: "SELF", agreementKind: "amendment" }] } }), /different agreement/);
console.log("Job agreement lifecycle behavior: PASS");
