import assert from "node:assert/strict";
import evidence from "../../../../evidence/ga-recovery-20261016/recovery-source-receipts.json";
import { assessRecoverySources } from "./ga-recovery-source-assessment";

const result = assessRecoverySources(evidence.sources);
assert.equal(result.completeInventory, true);
assert.equal(result.exhaustiveNoMatch, false);
assert.deepEqual(result.candidates, []);
assert.deepEqual(result.unresolved.sort(), ["provider_object_storage", "provider_snapshot"].sort());
assert.match(result.sha256, /^[a-f0-9]{64}$/);
assert.throws(() => assessRecoverySources([evidence.sources[0], evidence.sources[0]]), /DUPLICATE/);
console.log("B-GA005R3 recovery source assessment: PASS searched=4 unresolvedProviderSources=2 exhaustionClaim=false");
