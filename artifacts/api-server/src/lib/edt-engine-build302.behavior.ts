import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./edt-engine-qc-import-service.ts", import.meta.url), "utf8");
assert.match(route, /"conflictUserIds" in body/);
assert.doesNotMatch(route, /conflictUserIds:body\.conflictUserIds/);
assert.match(service, /job_activation_resource_assignments WHERE work_item_id=\$1/);
assert.match(service, /job_activation_tasks WHERE work_item_id=\$1/);
assert.match(service, /const conflictUserIds=conflictRows\.map/);
assert.match(service, /issuanceId,input\.projectId,input\.companyId/);
console.log("EDT_ENGINE_BUILD302_RESULT=PASS server-owned QC conflict set");
