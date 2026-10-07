import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeOperationsReturnTarget } from "./job-operations-daily-work";

assert.deepEqual(safeOperationsReturnTarget("/projects/31/operations?taskId=task-9", 31), { taskId: "task-9", returnTo: "/projects/31/operations?taskId=task-9" });
assert.equal(safeOperationsReturnTarget("/projects/31/operations?taskId=task-9&admin=1", 31), null);
assert.equal(safeOperationsReturnTarget("/projects/32/operations?taskId=task-9", 31), null);
const source = readFileSync(new URL("../pages/CompanyDeliveryWorkflows.tsx", import.meta.url), "utf8");
assert.match(source, /Workflow for the selected task/);
assert.match(source, /operationReturn\.returnTo/);
console.log("Company workflows preserves the exact Operations task return: PASS");
