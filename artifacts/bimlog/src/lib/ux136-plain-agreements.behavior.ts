import assert from "node:assert/strict";
import { agreementSummaries } from "./agreement-language";

const summaries = agreementSummaries({
  relationships: {
    participants: [{ id: "provider", companyName: "BIMtech" }, { id: "customer", companyName: "Owner Co" }],
    engagements: [{ id: "edge", providerParticipantId: "provider", customerParticipantId: "customer" }],
  },
  commercial: { contracts: [{ id: "base", title: "Tower shop drawings", engagementId: "edge" }] },
});
assert.deepEqual(summaries, [{ provider: "BIMtech", customer: "Owner Co", agreement: "Tower shop drawings", plainLabel: "BIMtech delivers to Owner Co under Tower shop drawings" }]);
assert.equal(agreementSummaries({ commercial: { contracts: [{}] } })[0]?.plainLabel, "Service provider delivers to Customer under Agreement 1");
console.log("UX136_RESULT=PASS company roles and agreement are explained in plain language");
