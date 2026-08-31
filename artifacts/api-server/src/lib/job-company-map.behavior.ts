import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";

const normalized = normalizeJobIntakeData({
  relationships: {
    participants: [
      { id: "BIMTECH", companyName: "BIMTech", role: "service_provider" },
      { id: "GC", companyName: "General Contractor", role: "general_contractor" },
      { id: "HVAC", companyName: "HVAC Company", role: "customer" },
    ],
    engagements: [
      { id: "E1", providerParticipantId: "BIMTECH", customerParticipantId: "GC", description: "BIM coordination" },
      { id: "E2", providerParticipantId: "BIMTECH", customerParticipantId: "HVAC", description: "HVAC shop drawings" },
    ],
  },
});
assert.equal(normalized.relationships.participants.length, 3);
assert.equal(normalized.relationships.engagements.length, 2);
assert.equal(normalized.relationships.engagements[1].description, "HVAC shop drawings");
assert.throws(() => normalizeJobIntakeData({ relationships: { participants: [{ id: "A", companyName: "A", role: "customer" }], engagements: [{ id: "E", providerParticipantId: "A", customerParticipantId: "MISSING" }] } }), /Every relationship must connect/);
assert.throws(() => normalizeJobIntakeData({ relationships: { participants: [{ id: "A", companyName: "A", role: "customer" }], engagements: [{ id: "E", providerParticipantId: "A", customerParticipantId: "A" }] } }), /cannot hire itself/);
assert.throws(() => normalizeJobIntakeData({ relationships: { participants: [{ id: "A", companyName: "", role: "customer" }] } }), /needs a name/);
console.log("Job company map behavior: PASS");
