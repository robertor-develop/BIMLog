import assert from "node:assert/strict";
import { canonicalIntakeContractItemSource } from "./job-intake-contract-lineage";

const first = canonicalIntakeContractItemSource("intake-1", [{ id: "item-b" }, { id: "item-a" }]);
const retry = canonicalIntakeContractItemSource("intake-1", [{ id: "item-a" }, { id: "item-b" }]);
assert.deepEqual(first, retry);
assert.equal(first.kind, "job_intake");
assert.deepEqual(first.stableLineIds, ["item-a", "item-b"]);
assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
assert.notEqual(first.fingerprint, canonicalIntakeContractItemSource("intake-2", [{ id: "item-a" }, { id: "item-b" }]).fingerprint);
console.log("UX137_RESULT=PASS Intake items are the canonical draft-contract source and retries do not request duplicate lines");
