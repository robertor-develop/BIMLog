import assert from "node:assert/strict";
import {
  INTAKE_APU_RATE_DEFAULTS,
  profileForApuRate,
  rateForApuProfile,
} from "./job-intake-apu-rates.ts";

assert.equal(INTAKE_APU_RATE_DEFAULTS.drafting, "35.47");
assert.equal(INTAKE_APU_RATE_DEFAULTS.bim_coordinator, "37.99");
assert.equal(rateForApuProfile("drafting"), "35.47");
assert.equal(rateForApuProfile("bim_coordinator"), "37.99");
assert.equal(rateForApuProfile("unsupported"), null);
assert.equal(profileForApuRate("35.47"), "drafting");
assert.equal(profileForApuRate("37.99"), "bim_coordinator");
assert.equal(profileForApuRate("41.25"), "");

console.log("job-intake-apu-rates.behavior: PASS");
