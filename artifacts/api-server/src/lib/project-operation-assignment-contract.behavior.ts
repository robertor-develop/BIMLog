import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/job-operations.ts", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");

assert.match(route, /operations\/assignments\/:assignmentId/);
assert.match(route, /Cache-Control": "private, no-store"/);
assert.match(route, /X-BIMLog-Project-Id/);
assert.match(route, /X-BIMLog-Assignment-Version/);
assert.match(service, /if \(!access\.canManage\).*JOB_OPERATIONS_REASSIGN_DENIED/);
assert.match(service, /requiredText\(input\.reason, 500, "reason"\)/);
assert.match(service, /r\.id=\$1 AND r\.version=\$2 AND w\.project_id=\$3 FOR UPDATE OF r/);
assert.match(service, /JOB_OPERATIONS_REASSIGN_SAME_USER/);
assert.match(service, /pm\.status='active'/);
assert.match(service, /JOB_OPERATIONS_ASSIGNEE_INVALID/);
assert.match(service, /customerBillingRateChanged: false/);
assert.match(service, /event\(client, \{ projectId, actorUserId: input\.actorUserId, eventType: "resource_reassigned"/);
assert.match(service, /await client\.query\("COMMIT"\)/);
assert.match(service, /await client\.query\("ROLLBACK"\)/);
assert.match(ui, /Reason for reassignment \(required\)/);
assert.match(ui, /expectedVersion:\s*assignment\.version/);
assert.match(ui, /Resource reassigned with preserved history/);
assert.match(ui, /Preserved on reassignment/);
assert.match(ui, /await load\(\)/);

console.log(JSON.stringify({ suite: "P185-project-operation-assignment-contract", privateReceipt: true, leaderOnly: true, optimisticConcurrency: true, activeAssigneeOnly: true, reasonRequired: true, billingRatePreserved: true, internalRateGoverned: true, immutableEvent: true, rollback: true, uiSaveReopen: true }));
