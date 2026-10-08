import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeIntakeReturnTarget, parseActiveIntakeReturn, withActiveIntakeReturn } from "./active-intake-roundtrip";
import { activeIntakeNextActions } from "./job-intake-active-review";
import { jobIntakeActiveChangeDestinations } from "./job-intake-activation-preview";

const projectId = 42;
const returnTarget = "/projects/42/intake?stage=review&item=ji-review";
assert.equal(activeIntakeReturnTarget(projectId), returnTarget);
assert.deepEqual(parseActiveIntakeReturn(`?returnTo=${encodeURIComponent(returnTarget)}`, projectId), { href: returnTarget, projectId });
assert.equal(parseActiveIntakeReturn(`?returnTo=${encodeURIComponent("/projects/41/intake?stage=review&item=ji-review")}`, projectId), null);
assert.equal(parseActiveIntakeReturn(`?returnTo=${encodeURIComponent(returnTarget)}&returnTo=${encodeURIComponent(returnTarget)}`, projectId), null);
assert.equal(parseActiveIntakeReturn(`?returnTo=${encodeURIComponent("https://example.com")}`, projectId), null);
assert.equal(withActiveIntakeReturn("/projects/42/operations", projectId), "/projects/42/operations?returnTo=%2Fprojects%2F42%2Fintake%3Fstage%3Dreview%26item%3Dji-review");
assert.equal(withActiveIntakeReturn("/projects/42/financial/contracts?contractId=C-1", projectId), "/projects/42/financial/contracts?contractId=C-1&returnTo=%2Fprojects%2F42%2Fintake%3Fstage%3Dreview%26item%3Dji-review");

const destinations = jobIntakeActiveChangeDestinations(projectId, true);
assert.ok(destinations.operations.includes("returnTo="));
assert.ok(destinations.contracts?.includes("returnTo="));
assert.equal(jobIntakeActiveChangeDestinations(projectId, false).contracts, null);
assert.equal(activeIntakeNextActions(projectId, true).length, 2);

const operationsSource = readFileSync(new URL("../pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
const contractsSource = readFileSync(new URL("../pages/FinancialContractWorkspace.tsx", import.meta.url), "utf8");
assert.match(operationsSource, /Return to active Intake review/);
assert.match(operationsSource, /parseActiveIntakeReturn\(useSearch\(\), projectId\)/);
assert.match(contractsSource, /deepLink\.intakeReturn && !requestedContract/);
assert.match(contractsSource, /Contract work remains separate from the operational job already created/);

console.log("Human flow continuity Block 10: PASS");
