import assert from "node:assert/strict";
import { boundedRetryDelay, recoveryDecision } from "./runtime-resilience";

assert.equal(recoveryDecision({ operation: "read", failure: "provider_unavailable", acknowledged: false }), "retry");
assert.equal(recoveryDecision({ operation: "idempotent_write", failure: "partial_response", acknowledged: true }), "resume");
assert.equal(recoveryDecision({ operation: "non_idempotent_write", failure: "partial_response", acknowledged: false }), "fail_closed");
assert.equal(recoveryDecision({ operation: "read", failure: "invalid_session", acknowledged: false }), "fail_closed");
assert.deepEqual([0, 1, 2, 9].map((attempt) => boundedRetryDelay(attempt)), [100, 200, 400, 5_000]);
assert.throws(() => boundedRetryDelay(-1), /ATTEMPT_INVALID/);
console.log("block20 build099 runtime resilience: PASS");
