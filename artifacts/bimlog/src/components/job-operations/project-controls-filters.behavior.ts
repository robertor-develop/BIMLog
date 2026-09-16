import assert from "node:assert/strict";
import { attributableProjectControlsRows, filterProjectControlsRows } from "./project-controls-filters.ts";

const rows = [
  { id: "scope-a", packageIds: ["wp-1"], memberIds: [7], status: "healthy" },
  { id: "scope-b", packageIds: ["wp-2"], memberIds: [8], status: "critical" },
];
const all = { scopeId: "", packageId: "", memberId: "", risk: "" };
assert.equal(filterProjectControlsRows(rows, all).length, 2);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, scopeId: "scope-b" }), [rows[1]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, packageId: "wp-1" }), [rows[0]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, memberId: "7" }), [rows[0]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, risk: "critical" }), [rows[1]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, packageId: "wp-2", memberId: "7" }), []);
const controls = { rows: [{ id: "scope-a", name: "Floor 1", plannedHours: "100", plannedInternalCost: "1000", actualInternalCost: "200", plannedBillableValue: "2000", earnedBillableValue: "400", progressPercent: 20, status: "warning", packageIds: ["wp-1", "wp-2"], memberIds: [7, 8] }], budgetVisible: true, valueVisible: true };
const tasks = [{ id: "task-1", workItemId: "scope-a", plannedHours: "40", progressPercent: 50, status: "in_progress" }, { id: "task-2", workItemId: "scope-a", plannedHours: "60", progressPercent: 0, status: "not_started" }];
const assignments = [{ id: "a-1", taskId: "task-1", workItemId: "scope-a", userId: 7, plannedHours: "20", actualHours: "10", plannedInternalCost: "200", internalHourlyRate: "10", plannedBillableValue: "400", billingHourlyRate: "20" }, { id: "a-2", taskId: "task-2", workItemId: "scope-a", userId: 8, plannedHours: "60", actualHours: "0", plannedInternalCost: "600", internalHourlyRate: "10", plannedBillableValue: "1200", billingHourlyRate: "20" }, { id: "a-3", taskId: null, workItemId: "scope-a", userId: 7, plannedHours: "20", actualHours: "0", plannedInternalCost: "200", internalHourlyRate: "10", plannedBillableValue: "400", billingHourlyRate: "20" }];
const packages = [{ id: "wp-1", workItemId: "scope-a", overdue: false, blockedCount: 0 }, { id: "wp-2", workItemId: "scope-a", overdue: false, blockedCount: 0 }];
const packageTasks = [{ packageId: "wp-1", taskId: "task-1" }, { packageId: "wp-2", taskId: "task-2" }];
const input = { controls, tasks, assignments, workItems: [{ id: "scope-a", billingHourlyRate: "20" }], packages, packageTasks };
assert.equal(attributableProjectControlsRows({ ...input, packageId: "", memberId: "" }).rows[0].plannedInternalCost, "1000", "whole-scope view keeps its authoritative baseline");
const packageOne = attributableProjectControlsRows({ ...input, packageId: "wp-1", memberId: "" });
assert.equal(packageOne.rows[0].plannedHours, "40.00");
assert.equal(packageOne.rows[0].plannedInternalCost, "200.00", "package view must not inherit the full scope budget");
assert.equal(packageOne.rows[0].actualInternalCost, "100.00");
assert.equal(packageOne.rows[0].progressPercent, 50);
assert.equal(packageOne.rows[0].earnedBillableValue, "200.00");
const packageTwo = attributableProjectControlsRows({ ...input, packageId: "wp-2", memberId: "" });
assert.equal(packageTwo.rows[0].plannedHours, "60.00");
assert.equal(packageTwo.rows[0].plannedInternalCost, "600.00", "two packages in one scope item must yield different attributable budgets");
const memberSeven = attributableProjectControlsRows({ ...input, packageId: "", memberId: "7" });
assert.equal(memberSeven.rows[0].plannedHours, "20.00");
assert.equal(memberSeven.rows[0].plannedInternalCost, "200.00", "member view must not inherit another member's budget");
assert.equal(memberSeven.excludedUnlinkedAssignments, 1, "unlinked assignment is disclosed, not silently allocated");
assert.equal(attributableProjectControlsRows({ ...input, packageId: "wp-2", memberId: "7" }).rows.length, 0, "package/member intersection must be exact");
assert.equal(attributableProjectControlsRows({ ...input, packages: [{ ...packages[0], status: "cancelled" }, packages[1]], packageId: "wp-1", memberId: "" }).rows.length, 0, "cancelled packages must not contribute controls figures");
const redacted = attributableProjectControlsRows({ ...input, controls: { ...controls, budgetVisible: false, valueVisible: false }, packageId: "wp-1", memberId: "7" }).rows[0];
assert.equal(redacted.plannedInternalCost, null);
assert.equal(redacted.earnedBillableValue, null);
console.log("Project Controls filter combinations: PASS");
