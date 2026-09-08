import assert from "node:assert/strict";
import { connectContractItemsToApu } from "./job-intake-apu-connection.ts";

const original = [
  { id: "CI-1", name: "Fire Protection", billingHourlyRate: "0", apuPlanVersion: null },
  { id: "CI-2", name: "Coordination", billingHourlyRate: "12.50", apuPlanVersion: 2 },
];
const connected = connectContractItemsToApu(original, {
  version: 7,
  sellingPrice: "35.47",
});

assert.deepEqual(
  connected.map(({ id, name, billingHourlyRate, apuPlanVersion }) => ({
    id,
    name,
    billingHourlyRate,
    apuPlanVersion,
  })),
  [
    { id: "CI-1", name: "Fire Protection", billingHourlyRate: "35.47", apuPlanVersion: 7 },
    { id: "CI-2", name: "Coordination", billingHourlyRate: "35.47", apuPlanVersion: 7 },
  ],
);
assert.equal(original[0].billingHourlyRate, "0");
assert.notEqual(connected, original);

console.log("job-intake-apu-connection.behavior: PASS");
