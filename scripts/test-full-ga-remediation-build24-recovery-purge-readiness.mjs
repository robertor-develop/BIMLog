import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

runNodeGate("scripts/test-ga-closure-build011-protected-custody.mjs");
runNodeGate("scripts/test-ga-final-block05-build034-temp-cleanup-readiness.mjs");
runNodeGate("scripts/test-ga-production-purge-build20.mjs");

const inventory = JSON.parse(readFileSync("evidence/ga-recovery-20261016/protected-file-inventory.json", "utf8"));
const reconciliation = JSON.parse(readFileSync("evidence/ga-closure-20261020/protected-custody-reconciliation.json", "utf8"));

assert.equal(inventory.files.length, 16, "all protected custody records must remain represented");
assert.deepEqual([...new Set(inventory.files.map(file => file.projectId))].sort((a, b) => a - b), [23, 26]);
assert.equal(reconciliation.recoveryState, "unresolved");
assert.equal(reconciliation.executionAuthorized, false);
assert.equal(reconciliation.customerRowsChanged, 0);
assert.equal(reconciliation.storageObjectsChanged, 0);
assert.match(reconciliation.claim, /No protected original is represented as recovered/);

console.log("Full-GA Block 5 Build 24 PASS: recovery evidence remains honest and read-only; purge remains blocked-safe");
