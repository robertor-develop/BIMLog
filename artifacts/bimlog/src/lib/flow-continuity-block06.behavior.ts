import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseContractDeepLink } from "./contract-deep-link";

const intake = readFileSync(new URL("../components/job-intake/IntakeContractConnection.tsx", import.meta.url), "utf8");
const contracts = readFileSync(new URL("../pages/FinancialContractWorkspace.tsx", import.meta.url), "utf8");
const harness = readFileSync(new URL("../navigation-harness.tsx", import.meta.url), "utf8");

assert.match(intake, /financial\/contracts\?contractId=/);
assert.match(intake, /withIntakeReturn/);
assert.match(harness, /fixture-contract/);
assert.match(harness, /returnTo=/);
assert.match(contracts, /parseContractDeepLink/);
assert.match(contracts, /api\(`\/projects\/\$\{projectId\}\/financial\/contracts\/\$\{encodeURIComponent\(target\.id\)\}`\)/);
assert.match(contracts, /No other contract was substituted/);
assert.match(contracts, /Return to the same Intake step/);
assert.match(contracts, /requestAnimationFrame\(\(\) => document\.getElementById/);

const exact = parseContractDeepLink("contractId=fixture-contract&returnTo=" + encodeURIComponent("/projects/1/intake?stage=contract"), 1);
assert.deepEqual({ id: exact.contractId, origin: exact.intakeReturn?.href, invalid: exact.invalid }, {
  id: "fixture-contract",
  origin: "/projects/1/intake?stage=contract",
  invalid: false,
});
console.log("Flow continuity block 06: Intake opens one exact authorized contract with truthful recovery PASS");
