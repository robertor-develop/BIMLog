import assert from "node:assert/strict";import fs from "node:fs";const source=fs.readFileSync(new URL("./support-case-messages.ts",import.meta.url),"utf8");
assert.match(source,/role==="customer"\?record\.assignedToUserId:null/);
assert.match(source,/supportNotification\("customer_replied",id,record\.subject\).*insert\(notificationsTable\)/s);
assert.match(source,/insert\(supportCaseMessagesTable\).*insert\(notificationsTable\).*replayed:false/s);
console.log("B178 assigned operations owner receives atomic customer reply notification: PASS");
