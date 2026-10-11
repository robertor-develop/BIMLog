import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const route=readFileSync(new URL("./commercial-data-request-review.ts",import.meta.url),"utf8"),notification=readFileSync(new URL("../lib/support-case-notification.ts",import.meta.url),"utf8");
for(const token of ["requesterUserId:supportCasesTable.requesterUserId","supportNotification(\"data_request_reviewed\"","notificationsTable","support_data_request_reviewed","/settings/billing-support?supportCase="])assert.ok(route.includes(token)||notification.includes(token),token);
assert.match(route,/insert\(supportCaseDataRequestReviewsTable\).*insert\(notificationsTable\)/s);
console.log("LR090 atomic customer data-request outcome notification: PASS");
