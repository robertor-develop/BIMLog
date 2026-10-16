import assert from "node:assert/strict";
import inventory from "../../../../evidence/ga-recovery-20261016/protected-file-inventory.json";
import { reconcileProtectedFileInventory } from "./ga-protected-file-inventory";

const result = reconcileProtectedFileInventory(inventory.files);
assert.equal(result.total, 16);
assert.equal(result.blocked, 16);
assert.equal(result.missingStoragePath, 16);
assert.equal(result.missingHash, 14);
assert.equal(result.restorableNow, 0);
assert.deepEqual(result.projectCounts, { 23: 2, 26: 14, 35: 0 });
assert.match(result.sha256, /^[a-f0-9]{64}$/);
assert.throws(() => reconcileProtectedFileInventory([...inventory.files, inventory.files[0]]), /GA_FILE_ID_INVALID/);
console.log("B-GA005R1 protected file inventory: PASS total=16 blocked=16 missingPath=16 missingHash=14");
