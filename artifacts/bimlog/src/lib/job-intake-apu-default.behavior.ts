import assert from "node:assert/strict";
import { applySoleApuToUnboundItems, contractApuCoverage, soleCompatibleApuVersion } from "./job-intake-apu-default";

const only = [{ version: 3, name: "Approved", sellingPrice: "35.47", currency: "USD" }];
assert.equal(soleCompatibleApuVersion(only, "USD")?.version, 3);
assert.equal(soleCompatibleApuVersion(only, "BOB"), null);
assert.equal(soleCompatibleApuVersion([], "USD"), null);
assert.equal(soleCompatibleApuVersion([...only, { version: 4, sellingPrice: "40", currency: "USD" }], "USD"), null);
assert.equal(soleCompatibleApuVersion([{ version: 0, sellingPrice: "35", currency: "USD" }], "USD"), null);
const explicit = { id: "A", apuPlanVersion: 2, billingHourlyRate: "22" };
const unbound = { id: "B", apuPlanVersion: null, billingHourlyRate: "0" };
const applied = applySoleApuToUnboundItems([explicit, unbound], only, "USD");
assert.deepEqual(applied[0], explicit);
assert.equal(applied[1].apuPlanVersion, 3);
assert.equal(applied[1].billingHourlyRate, "0");
assert.equal(applySoleApuToUnboundItems([{ ...unbound, billingHourlyRate: "75" }], [{ version: 1, sellingPrice: "6000", currency: "USD" }], "USD")[0].billingHourlyRate, "75");
assert.equal(applySoleApuToUnboundItems([unbound], only, "BOB")[0].apuPlanVersion, null);
assert.equal(applySoleApuToUnboundItems([unbound], [...only, { version: 4, sellingPrice: "40", currency: "USD" }], "USD")[0].apuPlanVersion, null);
const coverage = contractApuCoverage(
  [{ id: "C1", title: "Base" }, { id: "C2", contractNumber: "CO-1" }, { id: "C3" }],
  [{ contractId: "C1", apuPlanVersion: 3 }, { contractId: "C1", apuPlanVersion: 4 }, { contractId: "C2", apuPlanVersion: null }],
);
assert.deepEqual(coverage[0], { contractId: "C1", label: "Base", itemCount: 2, boundCount: 2, versions: [3, 4], status: "complete" });
assert.equal(coverage[1].status, "incomplete");
assert.equal(coverage[2].status, "empty");
console.log("job-intake-apu-default: PASS");
