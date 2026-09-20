import assert from "node:assert/strict";
import { PERFORMANCE_BUDGETS, assertWithinBudget, percentile } from "./performance-budget";

assert.equal(PERFORMANCE_BUDGETS.applicationReadyMs, 8_000);
assert.equal(PERFORMANCE_BUDGETS.lensPayloadBytes, 500 * 1024 * 1024);
assert.equal(percentile([40, 10, 30, 20, 50], 0.95), 50);
assert.doesNotThrow(() => assertWithinBudget("API_P95", 999, PERFORMANCE_BUDGETS.apiP95Ms));
assert.throws(() => assertWithinBudget("API_P95", 1_001, PERFORMANCE_BUDGETS.apiP95Ms), /BUDGET_EXCEEDED/);
assert.throws(() => percentile([], 0.95), /SAMPLE_REQUIRED/);
console.log("block20 build096 performance budgets: PASS");
