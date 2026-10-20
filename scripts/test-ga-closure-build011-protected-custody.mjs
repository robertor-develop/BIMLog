import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessRecoverySources } from "../artifacts/api-server/src/lib/ga-recovery-source-assessment.ts";

const inventory = JSON.parse(readFileSync("evidence/ga-recovery-20261016/protected-file-inventory.json", "utf8"));
const sourceReceipts = JSON.parse(readFileSync("evidence/ga-recovery-20261016/recovery-source-receipts.json", "utf8"));
const reconciliation = JSON.parse(readFileSync("evidence/ga-closure-20261020/protected-custody-reconciliation.json", "utf8"));

assert.equal(inventory.files.length, 16, "the authoritative protected-file inventory must retain all 16 records");
assert.deepEqual([...new Set(inventory.files.map(file => file.projectId))].sort((a, b) => a - b), [23, 26]);
assert.equal(inventory.files.filter(file => file.storagePathPresent).length, 0);
assert.equal(inventory.files.filter(file => file.expectedSha256).length, 2);

const assessment = assessRecoverySources(sourceReceipts.sources);
assert.equal(assessment.completeInventory, true);
assert.deepEqual(assessment.unresolved, ["provider_snapshot", "provider_object_storage"]);
assert.equal(assessment.exhaustiveNoMatch, false, "unseen provider sources must not be described as exhausted");

assert.equal(reconciliation.registeredFiles, inventory.files.length);
assert.equal(reconciliation.portableCustodyVerified, 0);
assert.equal(reconciliation.authoritativeHashesAvailable, 2);
assert.equal(reconciliation.authoritativeHashesMissing, 14);
assert.equal(reconciliation.recoveryState, "unresolved");
assert.equal(reconciliation.executionAuthorized, false);
assert.equal(reconciliation.customerRowsChanged, 0);
assert.equal(reconciliation.storageObjectsChanged, 0);
assert.match(reconciliation.claim, /No protected original is represented as recovered/);

console.log("GA-CLOSURE-B011 PASS: 16 protected custody records reconciled; 0 recovered; provider evidence remains unresolved without mutation");
