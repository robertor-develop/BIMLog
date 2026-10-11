import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const route=readFileSync(fileURLToPath(new URL("./commercial-data-request-fulfillment.ts",import.meta.url)),"utf8"),notification=readFileSync(fileURLToPath(new URL("../lib/support-case-notification.ts",import.meta.url)),"utf8");
for(const token of ["existing?.actorUserId===actorId&&existing.fingerprint===fingerprint","replayed:true","DATA_REQUEST_FULFILLMENT_CONFLICT","result.replayed?200:201",'supportNotification("data_request_fulfilled"',"notificationsTable"])assert.ok(route.includes(token),token);
assert.equal(route.split('supportNotification("data_request_fulfilled"').length-1,1);assert.ok(notification.includes('type:"support_data_request_fulfilled"'));assert.ok(notification.includes("/settings/billing-support?supportCase="));
console.log("LR095 idempotent fulfillment receipt and notification acceptance: PASS");
