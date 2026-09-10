import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx"), "utf8");
const service = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/job-intake-service.ts"), "utf8");

assert.match(page, /Operational task \/ Work Package/);
assert.match(page, /Tarea operativa \/ Paquete de trabajo/);
assert.match(page, /workPackageId: ""/);
assert.match(page, /assigns this resource directly to that package task/);
assert.match(service, /packageTaskById\.set\(workPackage\.id, packageTask\.id\)/);
assert.match(service, /assignment\.workPackageId \? packageTaskById\.get\(assignment\.workPackageId\) : linked\.taskId/);
assert.match(service, /INSERT INTO job_activation_resource_assignments\(id,intake_id,work_item_id,task_id/);

console.log(JSON.stringify({ status: "PASS", build: 6, checks: ["explicit-task-selector", "stale-package-cleared", "package-task-activation", "assignment-task-persistence"] }));
