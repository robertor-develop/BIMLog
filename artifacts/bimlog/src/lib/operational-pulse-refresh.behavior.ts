import assert from "node:assert/strict";
import { formatOperationalPulseCheckedAt, formatOperationalPulseComparisonAt, operationalPulseRefreshState } from "./operational-pulse-refresh";

assert.equal(operationalPulseRefreshState({ isFetching: true, hasError: false, hasVerifiedData: true }), "refreshing");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: true, hasVerifiedData: true }), "unavailable");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: false, hasVerifiedData: false }), "unavailable");
assert.equal(operationalPulseRefreshState({ isFetching: false, hasError: false, hasVerifiedData: true }), "current");
assert.equal(formatOperationalPulseCheckedAt(0, "en"), null);
assert.ok(formatOperationalPulseCheckedAt(Date.UTC(2026, 9, 9, 12, 30), "en"));
assert.ok(formatOperationalPulseCheckedAt(Date.UTC(2026, 9, 9, 12, 30), "es"));
assert.equal(formatOperationalPulseComparisonAt(0, "en"), null);
assert.match(formatOperationalPulseComparisonAt(Date.UTC(2026, 9, 9, 12, 30), "en") ?? "", /Oct|10/);
assert.match(formatOperationalPulseComparisonAt(Date.UTC(2026, 9, 9, 12, 30), "es") ?? "", /oct|10/i);

console.log("Operational pulse refresh behavior: PASS");
