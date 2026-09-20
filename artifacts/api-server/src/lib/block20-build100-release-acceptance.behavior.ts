import assert from "node:assert/strict";
import { PERFORMANCE_BUDGETS } from "./performance-budget";
import { recoveryDecision } from "./runtime-resilience";
import { resolveCorrelationId } from "../middlewares/request-diagnostics";
import { ScopedBriefingCache } from "./scoped-briefing-cache";

assert.equal(PERFORMANCE_BUDGETS.applicationReadyMs, 8_000);
assert.equal(PERFORMANCE_BUDGETS.apiP95Ms, 1_000);
assert.equal(ScopedBriefingCache.scopeKey(1, [3, 2]), "1:2,3");
assert.equal(resolveCorrelationId("release-acceptance-100"), "release-acceptance-100");
assert.equal(recoveryDecision({ operation: "non_idempotent_write", failure: "partial_response", acknowledged: false }), "fail_closed");
console.log("block20 build100 release acceptance contract: PASS");
