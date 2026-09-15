import assert from "node:assert/strict";
import { applySoleApuToUnboundItems, soleCompatibleApuVersion } from "./job-intake-apu-default";

const only = [{ version: 3, name: "Approved", sellingPrice: "35.47" }];
assert.equal(soleCompatibleApuVersion(only)?.version, 3);
assert.equal(soleCompatibleApuVersion([]), null);
assert.equal(soleCompatibleApuVersion([...only, { version: 4, sellingPrice: "40" }]), null);
assert.equal(soleCompatibleApuVersion([{ version: 0, sellingPrice: "35" }]), null);
const explicit = { id: "A", apuPlanVersion: 2, billingHourlyRate: "22" };
const unbound = { id: "B", apuPlanVersion: null, billingHourlyRate: "0" };
const applied = applySoleApuToUnboundItems([explicit, unbound], only);
assert.deepEqual(applied[0], explicit);
assert.equal(applied[1].apuPlanVersion, 3);
assert.equal(applied[1].billingHourlyRate, "35.47");
assert.equal(applySoleApuToUnboundItems([unbound], [...only, { version: 4, sellingPrice: "40" }])[0].apuPlanVersion, null);
console.log("job-intake-apu-default: PASS");
