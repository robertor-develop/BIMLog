import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decision = JSON.parse(readFileSync("evidence/ga-closure-20261020/publication-cadence-decision.json", "utf8"));

assert.equal(decision.completedBuildsSincePublication, 5);
assert.equal(decision.publishEveryBuilds, 10);
assert.equal(decision.maximumUnpublishedBuilds, 10);
assert.ok(decision.completedBuildsSincePublication < decision.publishEveryBuilds);
assert.ok(decision.completedBuildsSincePublication <= decision.maximumUnpublishedBuilds);
assert.equal(decision.publicationDue, false);
assert.equal(decision.publicationState, "cadence_hold");
assert.equal(decision.productionChangedByThisBlock, false);
assert.equal(decision.authenticatedChromeRequiredAfterNextPublication, true);
assert.match(decision.acceptedSourcePolicy, /exact clean pushed head/);

console.log("GA-CLOSURE-B014 PASS: exact-head publication is held at 5/10 builds by the authorized cadence; production remains unchanged");
