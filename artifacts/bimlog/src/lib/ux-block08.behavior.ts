import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDailyWorkQueues, canonicalDocumentLauncher, nextTaskAction, operationalHourMetrics, parseOperationalDocumentReturn, taskCostBinding } from "./job-operations-daily-work";

const tasks = [
  { id: "blocked", nameEn: "Resolve clash", status: "blocked", assigneeUserId: 7, dueDate: "2026-09-29", canControl: true, plannedHours: "10", actualHours: "4", progressPercent: 40 },
  { id: "later", nameEn: "Future floor", status: "not_started", assigneeUserId: null, dueDate: null, canControl: false },
  { id: "done", nameEn: "Issued", status: "complete", assigneeUserId: 7, canControl: true },
];
const assignments = [{ id: "priced", taskId: "blocked", userId: 7, personName: "Coordinator", internalHourlyRate: "6.5", billingHourlyRate: "30" }];

const managerQueues = buildDailyWorkQueues(tasks, assignments, 99, true);
assert.deepEqual(managerQueues.blockers.map((task) => task.id), ["blocked"]);
assert.deepEqual(managerQueues.unassigned.map((task) => task.id), ["later"]);
assert.deepEqual(buildDailyWorkQueues(tasks, assignments, 7, false).assigned.map((task) => task.id), ["blocked"]);

const binding = taskCostBinding(tasks[0], assignments, [{ id: 7, profileInternalHourlyRate: "6.5" }]);
assert.equal(binding.assignment?.internalHourlyRate, "6.5");
assert.equal(binding.assignment?.billingHourlyRate, "30", "customer rate stays separate");
assert.equal(taskCostBinding(tasks[1], [], []).operationalOnly, false, "future work may remain unassigned");

assert.deepEqual(nextTaskAction(tasks[0], [], 7, false), { key: "unblock", actor: "Assignee or project leader", eligible: true });
assert.equal(nextTaskAction(tasks[2], [], 7, true).actor, "Independent reviewer");
assert.equal(nextTaskAction({ ...tasks[0], status: "in_progress" }, [{ status: "internal_review", responsibleUserId: 7 }], 7, true).eligible, false);

assert.deepEqual(operationalHourMetrics(10, 4, 40), { planned: 10, actual: 4, unused: 6, progressPercent: 40, estimatedAtCompletion: 10, estimatedRemaining: 6 });
assert.equal(operationalHourMetrics(10, 4, 0).estimatedRemaining, null);
assert.equal(operationalHourMetrics(10, 12, 100).unused, 0);

const launch = canonicalDocumentLauncher(7, "task-1", "rfi");
assert.match(launch, /^\/projects\/7\/rfis\?create=1/);
assert.match(decodeURIComponent(launch), /returnTo=\/projects\/7\/operations\?taskId=task-1/);
assert.deepEqual(parseOperationalDocumentReturn(new URL(launch, "https://bimlog.app").search, 7), { taskId: "task-1", returnTo: "/projects/7/operations?taskId=task-1" });
assert.equal(parseOperationalDocumentReturn("operationTaskId=task-1&returnTo=%2Fprojects%2F8%2Foperations%3FtaskId%3Dtask-1", 7), null);
assert.equal(parseOperationalDocumentReturn("operationTaskId=task-1&returnTo=%2Fprojects%2F7%2Foperations%3FtaskId%3Dtask-2", 7), null);

const page = fs.readFileSync(new URL("../pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
const rfi = fs.readFileSync(new URL("../pages/project/RfisTab.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../../../api-server/src/lib/job-operations-service.ts", import.meta.url), "utf8");
const review = fs.readFileSync(new URL("../../../api-server/src/lib/delivery-workflow-runtime.ts", import.meta.url), "utf8");
for (const phrase of ["Today's work", "Assigned to me", "Needs an assignee", "Next actor", "Unused planned hours", "Estimated hours remaining", "Create RFI", "Cancel returns without changing this task"]) assert.match(page, new RegExp(phrase));
assert.match(rfi, /linkEntityType=rfi&linkEntityId=/);
assert.match(service, /approvedInternalRateApplied/);
assert.match(service, /customerBillingRateChanged: false/);
assert.match(review, /different eligible reviewer must approve/i);
console.log("UX block 08 behavior: PASS");
