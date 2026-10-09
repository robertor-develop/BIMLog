import assert from "node:assert/strict";
import { formatOperationalPulseCheckedAt, operationalPulseRefreshState } from "./operational-pulse-refresh";

assert.equal(operationalPulseRefreshState({ isFetching: true, hasError: false, hasVerifiedData: true }), "refreshing");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: true, hasVerifiedData: true }), "unavailable");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: false, hasVerifiedData: false }), "unavailable");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: false, hasVerifiedData: true }), "current");
assert.equal(formatOperationalPulseCheckedAt(0, "en"), null);
assert.ok(formatOperationalPulseCheckedAt(Date.UTC(2026, 9, 9, 12, 30), "en"));
assert.ok(formatOperationalPulseCheckedAt(Date.UTC(2026, 9, 9, 12, 30), "es"));

console.log("Operational pulse refresh behavior: PASS");
