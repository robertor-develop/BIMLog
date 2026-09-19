import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const service = fs.readFileSync(path.join(here, "job-operations-service.ts"), "utf8");
const intake = fs.readFileSync(path.join(here, "job-intake-service.ts"), "utf8");

assert.match(service, /identity:\s*\{ projectId, intakeId: null, companyId: access\.companyId/);
assert.match(service, /const identity = \{[\s\S]*projectId,[\s\S]*intakeId: access\.intakeId,[\s\S]*companyId: access\.companyId/);
assert.match(service, /clientCompanyId: authoritativeIntake\.identity\?\.clientCompanyId \?\? null/);
assert.match(service, /jobCode: authoritativeIntake\.identity\?\.jobCode \|\| access\.projectCode/);
assert.match(service, /return \{ available: safeWorkItems\.length > 0,[\s\S]{0,180}identity,/);
assert.match(intake, /job_activation_work_items\(id,intake_id,project_id,stable_scope_item_id/);
assert.match(intake, /job_activation_resource_assignments\(id,intake_id,work_item_id,task_id,source_assignment_id/);

console.log("Build 056 canonical Intake-to-Operations project identity: PASS");
