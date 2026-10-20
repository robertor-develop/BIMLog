import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ledger = JSON.parse(readFileSync("evidence/release-reconciliation-20261020/DEPLOYMENT_LEDGER_SUPERSESSION.json", "utf8"));
assert.equal(ledger.schemaVersion, "bimlog-deployment-ledger-supersession-v1");
assert.equal(ledger.mutationPolicy, "ADDITIVE_ONLY");
assert.equal(ledger.ambiguousProviderId, "a34f876f-539a-49d6-bc40-d6281bb9d28b");
assert.deepEqual(ledger.historicalObservations.map(item => item.outcome), ["FAILED_BEFORE_PROMOTION", "PUBLISHED_AND_LIVE_VERIFIED_AT_THE_TIME"]);
assert.equal(new Set(ledger.historicalObservations.map(item => item.sourceCommit)).size, 2);
assert.match(ledger.supersession.rule, /not an immutable release identity/);
assert.deepEqual(ledger.supersession.authoritativeIdentityFields, ["sourceCommit", "assetManifestSha256", "packageId", "databaseMigrationLevel", "observedAt"]);
assert.equal(ledger.supersession.currentProductionObservation.sourceCommit, "89921a87291071d1bdf62a4fe67e836c0ca320f6");
assert.equal(ledger.supersession.currentProductionObservation.state, "LIVE_VERIFIED");
assert.equal(ledger.supersession.currentProductionObservation.independentAccepted, false);
assert.equal(ledger.supersession.currentProductionObservation.customerAccepted, false);
assert.equal(ledger.historicalRecordsRewritten, false);
assert.equal(ledger.historicalRecordsDeleted, false);
console.log("DEPLOYMENT_LEDGER_SUPERSESSION_PASS additive=true observations=2 current=89921a87291071d1bdf62a4fe67e836c0ca320f6");
