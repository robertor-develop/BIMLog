import assert from "node:assert/strict";
import { connectContractItemsToApu } from "./job-intake-apu-connection.ts";

const original = [
  { id: "CI-1", name: "Fire Protection", billingHourlyRate: "0", apuPlanVersion: null },
  { id: "CI-2", name: "Coordination", billingHourlyRate: "12.50", apuPlanVersion: 2 },
];
const connected = connectContractItemsToApu(original, {
  version: 7,
});

assert.deepEqual(
  connected.map(({ id, name, billingHourlyRate, apuPlanVersion }) => ({
    id,
    name,
    billingHourlyRate,
    apuPlanVersion,
  })),
  [
    { id: "CI-1", name: "Fire Protection", billingHourlyRate: "0", apuPlanVersion: 7 },
    { id: "CI-2", name: "Coordination", billingHourlyRate: "12.50", apuPlanVersion: 7 },
  ],
);

const exact = connectContractItemsToApu([{ billingHourlyRate: "30.00", unit: "Hours", rateSource: null }], { version: 4, name: "BIM coordination", currency: "USD", fingerprint: "abc" })[0];
assert.equal(exact.billingHourlyRate, "30.00");
assert.deepEqual(exact.rateSource, { kind: "saved_apu_rate", sourceId: "apu-plan-v4", sourceLabel: "BIM coordination", unitRate: "30.00", unit: "Hours", currency: "USD", apuPlanVersion: 4, apuFingerprint: "abc" });
assert.equal(original[0].billingHourlyRate, "0");
assert.notEqual(connected, original);

const priced = connectContractItemsToApu([{ billingHourlyRate: "0", unit: "Hours" }], { version: 8, name: "Published APU", sellingPrice: "47.25", currency: "USD" })[0];
assert.equal(priced.billingHourlyRate, "47.25");
assert.equal(priced.rateSource?.unitRate, "47.25");

console.log("job-intake-apu-connection.behavior: PASS");
