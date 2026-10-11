import assert from "node:assert/strict";
import { dashboardGuidanceState } from "./dashboard-guidance-state";

assert.equal(dashboardGuidanceState({ enabled: false, loading: false, failed: false, candidateCount: 1 }), "loading");
assert.equal(dashboardGuidanceState({ enabled: true, loading: true, failed: false, candidateCount: 1 }), "loading");
assert.equal(dashboardGuidanceState({ enabled: true, loading: false, failed: true, candidateCount: 1 }), "unavailable");
assert.equal(dashboardGuidanceState({ enabled: true, loading: false, failed: false, candidateCount: 0 }), "empty");
assert.equal(dashboardGuidanceState({ enabled: true, loading: false, failed: false, candidateCount: 1 }), "ready");

console.log("Dashboard guidance state behavior: PASS");
