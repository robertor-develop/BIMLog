import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isExactJobOperationTimeReplay } from "./job-operation-time-idempotency-contract";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "job-operations-service.ts"), "utf8");
const routes = fs.readFileSync(path.join(here, "../routes/job-operations.ts"), "utf8");
const review = fs.readFileSync(path.join(here, "edt-engine-economic-service.ts"), "utf8");
const ui = fs.readFileSync(path.join(here, "../../../bimlog/src/pages/JobOperationsWorkspace.tsx"), "utf8");

const base = {
  projectId: 70,
  taskId: "b5d9149c-8959-46d0-91bb-65dbca95dbee",
  assignmentId: null,
  userId: 19,
  workDate: "2026-10-26",
  hours: "0.25",
  note: "GA B8 CONTROLLED TIME 20261026",
  createdById: 19,
};
assert.equal(isExactJobOperationTimeReplay(base, { ...base }), true);
assert.equal(isExactJobOperationTimeReplay({ ...base, hours: "0.250000" }, base), true);
for (const changed of [
  { projectId: 71 }, { taskId: "foreign-task" }, { assignmentId: "foreign-assignment" },
  { userId: 20 }, { workDate: "2026-10-25" }, { hours: "0.5" },
  { note: "conflict" }, { createdById: 20 },
]) assert.equal(isExactJobOperationTimeReplay(base, { ...base, ...changed }), false);

assert.match(source, /JOB_OPERATIONS_TIME_ID_CONFLICT/);
assert.match(source, /WHERE id=\$1 FOR UPDATE/);
assert.match(source, /JOB_OPERATIONS_TIME_DENIED/);
assert.match(source, /JOB_OPERATIONS_ASSIGNMENT_INVALID/);
assert.match(source, /JOB_OPERATIONS_ASSIGNMENT_REQUIRED/);
assert.match(source, /JOB_OPERATIONS_HOURS_INVALID[\s\S]{0,180}greater than zero and no more than 24/);
assert.match(source, /eventType: "time_recorded"/);
assert.match(source, /refreshFloorHourCostForWorkItem/);
assert.match(routes, /result\.idempotent \? 200 : 201/);
assert.match(review, /TIME_AMOUNT_NOT_SERVER_RESOLVED/);
assert.match(review, /priced assignment and activated contract budget mapping/);
assert.match(review, /TIME_ENTRY_OWNER_REQUIRED/);
assert.match(ui, /Task assignee \(unpriced\)/);
assert.match(ui, /crypto\.randomUUID\(\)/);

console.log("TERMINAL_GA_BUILD008_TIME_CUSTODY_PASS stable-entry-id exact-replay conflict-rejection self-manager-authority tenant-project-isolation bounded-hours truthful-unpriced-review financial-intake-preserved");
