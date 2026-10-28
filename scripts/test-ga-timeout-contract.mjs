import assert from "node:assert/strict";
import fs from "node:fs";
import {
  GA_FINAL_BUILD031_TIMEOUT_MS,
  RECOVERY_GA_BLOCK04_SCENARIO_COUNT,
  RECOVERY_GA_BLOCK04_SCENARIO_TIMEOUT_MS,
  RECOVERY_GA_BLOCK04_TIMEOUT_MS,
} from "./lib/ga-timeout-contract.mjs";

assert.equal(RECOVERY_GA_BLOCK04_SCENARIO_COUNT, 14);
assert.ok(RECOVERY_GA_BLOCK04_TIMEOUT_MS > RECOVERY_GA_BLOCK04_SCENARIO_COUNT * RECOVERY_GA_BLOCK04_SCENARIO_TIMEOUT_MS);
assert.ok(GA_FINAL_BUILD031_TIMEOUT_MS > RECOVERY_GA_BLOCK04_TIMEOUT_MS);
const build031 = fs.readFileSync("scripts/test-ga-final-block05-build031-security-isolation.mjs", "utf8");
const block05 = fs.readFileSync("scripts/test-ga-final-block05.mjs", "utf8");
assert.doesNotMatch(build031, /300_000/);
assert.doesNotMatch(block05, /360_000/);
assert.match(build031, /RECOVERY_GA_BLOCK04_TIMEOUT_MS/);
assert.match(block05, /GA_FINAL_BUILD031_TIMEOUT_MS/);
console.log(`GA_TIMEOUT_CONTRACT=PASS scenarios=${RECOVERY_GA_BLOCK04_SCENARIO_COUNT} scenarioTimeoutMs=${RECOVERY_GA_BLOCK04_SCENARIO_TIMEOUT_MS} recoveryBudgetMs=${RECOVERY_GA_BLOCK04_TIMEOUT_MS} outerBudgetMs=${GA_FINAL_BUILD031_TIMEOUT_MS}`);
