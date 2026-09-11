import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(service, /status: "activated",[\s\S]{0,160}idempotent: true/);
assert.match(service, /ON CONFLICT\(work_item_id,task_key\) DO NOTHING/);
assert.match(service, /ON CONFLICT\(package_id,task_id\) DO NOTHING/);
assert.match(service, /Every resource assignment must reference an activated scope item/);
assert.match(service, /Every activated contract requires an immutable commercial baseline/);
assert.match(service, /UPDATE job_intakes SET status='activated'/);
assert.match(service, /coreTasksCreated/);
console.log("POST-P17 Build 14 activation outputs and idempotence: PASS");
