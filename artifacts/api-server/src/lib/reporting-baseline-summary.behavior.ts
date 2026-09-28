import assert from "node:assert/strict";
import { buildWeeklyCoordinationSummary, drilldownForKind } from "./reporting-baseline-summary";
import type { BaselineComparisonRow } from "./reporting-baseline-comparison";

const changes: BaselineComparisonRow[] = [
  { sourceKey: "rfi:1:v2", recordKey: "rfi:1", kind: "revised", fromStatus: "open", toStatus: "open", fromVersion: 1, toVersion: 2 },
  { sourceKey: "rfi:2:v1", recordKey: "rfi:2", kind: "closed", fromStatus: "open", toStatus: "closed", fromVersion: 1, toVersion: 1 },
  { sourceKey: "submittal:3:v1", recordKey: "submittal:3", kind: "opened", fromStatus: null, toStatus: "pending", fromVersion: null, toVersion: 1 },
];
const summary = buildWeeklyCoordinationSummary({ changes, sourceDetails: [
  { recordKey: "rfi:1", title: "Mechanical conflict", sourceAvailable: true },
  { recordKey: "rfi:2", title: "Archived response", sourceAvailable: false },
] });
assert.equal(summary.totalChangedRecords, 3);
assert.equal(summary.sections.reduce((sum, section) => sum + section.count, 0), 3, "every count must drill down to the exact changed records");
assert.equal(drilldownForKind(summary, "revised")[0].explanation, "revised:open->open");
assert.equal(drilldownForKind(summary, "closed")[0].explanation, "SOURCE_UNAVAILABLE");
assert.equal(drilldownForKind(summary, "opened")[0].explanation, "SOURCE_DETAIL_MISSING");
assert.equal(summary.missingSourceCount, 2);
console.log("C044 weekly coordination summary and explainable drilldown: PASS");
