import assert from "node:assert/strict";
import { connectContractItemsToApu } from "./job-intake-apu-connection";
import { selectPublishedDeliveryWorkflow } from "./job-intake-delivery-defaults";

const item = connectContractItemsToApu([
  { id: "CI-LORENA", quantity: "10", unit: "Hours", billingHourlyRate: "0", apuPlanVersion: null },
], {
  version: 7, name: "Published coordination APU", sellingPrice: "1250.00",
  currency: "USD", fingerprint: "a".repeat(64),
})[0];
assert.equal(item.billingHourlyRate, "125");
assert.equal(item.rateSource?.planSellingPrice, "1250.00");

const selected = selectPublishedDeliveryWorkflow({}, { versionId: "workflow-v12", definition: { phases: [
  { name: "Preliminary", tasks: [{ name: "Draft" }] },
  { name: "Coordination", tasks: [{ name: "Coordinate" }] },
  { name: "For record", tasks: [{ name: "Issue" }] },
  { name: "As built", tasks: [{ name: "Archive" }] },
] } });
assert.equal(selected.submittalStrategy, "Draft → Coordinate → Issue → Archive");
assert.equal(selected.milestoneSummary, "Preliminary → Coordination → For record → As built");
console.log("lorena-intake-correction-integration.behavior: PASS selected APU and immutable workflow");
