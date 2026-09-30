import assert from "node:assert/strict";
import { reconcileExistingContractSelection } from "./job-intake-contract-lineage";

const selected = { contractId: "contract-1", versionId: "version-2", fingerprint: "a".repeat(64) };
assert.equal(reconcileExistingContractSelection({ selected, current: selected }).decision, "reuse_exact_version");
const changed = reconcileExistingContractSelection({ selected, current: { ...selected, versionId: "version-3", fingerprint: "b".repeat(64) } });
assert.deepEqual(changed, { decision: "review_required", selected, differences: ["version", "content"], current: { ...selected, versionId: "version-3", fingerprint: "b".repeat(64) } });
console.log("UX138_RESULT=PASS existing Contract reuse requires the exact authorized version and differences never overwrite it silently");
