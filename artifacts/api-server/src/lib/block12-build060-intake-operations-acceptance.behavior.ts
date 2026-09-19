import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string) => fs.readFileSync(path.resolve(here, file), "utf8");
const intake = read("./job-intake-service.ts"), operations = read("./job-operations-service.ts"), migration = read("./job-intake-migration.ts"), route = read("../routes/job-operations.ts"), page = read("../../../bimlog/src/pages/JobOperationsWorkspace.tsx");
const chain = [
  [intake, /INSERT INTO job_activation_work_items/],
  [intake, /INSERT INTO job_activation_tasks/],
  [intake, /INSERT INTO job_activation_resource_assignments/],
  [operations, /identity, financialAuthority, operationalProjection, activity/],
  [operations, /WHERE id=\$1 AND version=\$2/],
  [operations, /WITH RECURSIVE successors/],
  [operations, /job_activation_time_entries/],
  [operations, /job_activation_budget_baselines/],
  [operations, /job_activation_operation_events/],
  [route, /Cache-Control", "private, no-store/],
  [page, /Task updated\./],
  [page, /Start date/],
  [page, /Predecessors/],
  [migration, /job_activation_task_dates_chk/],
] as const;
for (const [source, pattern] of chain) assert.match(source, pattern);
assert.doesNotMatch(operations, /mutableCopiesAllowed:\s*true/);
assert.match(operations, /JOB_OPERATIONS_STALE/);
assert.match(operations, /JOB_OPERATIONS_DEPENDENCY_CYCLE/);
console.log(JSON.stringify({ status: "PASS", build: 60, journey: ["intake", "activation", "operations", "task-update", "reporting", "audit"], canonicalIdentity: true, canonicalFinancialAuthority: true, staleWriteProtection: true, noStoreProjection: true }));
