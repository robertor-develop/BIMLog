import assert from "node:assert/strict";
import evidence from "../../../../evidence/ga-recovery-20261016/recovery-source-receipts.json";
import { assessRecoverySources, type RecoverySourceReceipt } from "./ga-recovery-source-assessment";

const sources = evidence.sources as RecoverySourceReceipt[];
const result = assessRecoverySources(sources);
assert.equal(result.completeInventory, true);
assert.equal(result.exhaustiveNoMatch, false);
assert.deepEqual(result.candidates, []);
assert.deepEqual(result.unresolved.sort(), ["provider_object_storage", "provider_snapshot"].sort());
assert.match(result.sha256, /^[a-f0-9]{64}$/);
assert.throws(() => assessRecoverySources([sources[0], sources[0]]), /DUPLICATE/);
console.log("B-GA005R3 recovery source assessment: PASS searched=4 unresolvedProviderSources=2 exhaustionClaim=false");
