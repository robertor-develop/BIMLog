import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTaskUpdateNoop } from "./job-operation-task-update-contract";

const current = {
  status: "not_started",
  progress_percent: 0,
  assignee_user_id: 41,
  start_date: "2026-10-27T00:00:00.000Z",
  due_date: "2026-10-31T00:00:00.000Z",
  predecessor_task_ids: ["task-b", "task-a"],
};
const accepted = {
  status: "not_started",
  progressPercent: 0,
  assigneeUserId: 41,
  startDate: "2026-10-27",
  dueDate: "2026-10-31",
  predecessorTaskIds: ["task-a", "task-b"],
};

assert.equal(isTaskUpdateNoop(current, accepted), true, "the exact accepted assignment save must be a no-op");
assert.equal(isTaskUpdateNoop(current, { ...accepted, assigneeUserId: 42 }), false, "a different stable member id must be a real change");
assert.equal(isTaskUpdateNoop(current, { ...accepted, dueDate: "2026-11-01" }), false, "a changed due date must be a real change");

const service = readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../routes/job-operations.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");

for (const contract of [
  /pm\.project_id=\$1 AND pm\.status='active'/,
  /WHERE pm\.project_id=\$1 AND pm\.user_id=\$2 AND pm\.status='active'/,
  /w\.project_id=\$2/,
  /Number\(control\.task\.version\) !== expectedVersion/,
  /JOB_OPERATIONS_STALE/,
  /JOB_OPERATIONS_TASK_CONTROL_DENIED/,
  /JOB_OPERATIONS_REASSIGN_DENIED/,
  /JOB_OPERATIONS_ASSIGNEE_INVALID/,
  /JOB_OPERATIONS_DATE_RANGE_INVALID/,
  /isTaskUpdateNoop/,
  /event\(client, \{ projectId, actorUserId: input\.actorUserId, eventType: "task_updated"/,
]) assert.match(service, contract);

assert.match(route, /router\.patch\("\/projects\/:projectId\/operations\/tasks\/:taskId"/);
assert.match(route, /expectedVersion: req\.body\?\.expectedVersion/);
assert.match(page, /data\.members\.map/);
assert.match(page, /disabled=\{!data\.canManage\}/);
assert.match(page, /expectedVersion: task\.version/);
assert.match(page, /assigneeUserId: draft\.assigneeUserId/);
assert.match(page, /startDate: draft\.startDate \|\| null/);
assert.match(page, /dueDate: draft\.dueDate \|\| null/);

console.log("TERMINAL_GA_BUILD007_TASK_ASSIGNMENT_PASS stable-member-id expectedVersion tenant-isolation direct-assignee idempotent-noop financial-intake-preserved");
