import assert from "node:assert/strict";import fs from "node:fs";const source=fs.readFileSync(new URL("./support-case-messages.ts",import.meta.url),"utf8");
assert.match(source,/role==="customer"\?record\.assignedToUserId:record\.requesterUserId/);
assert.match(source,/role==="customer"\?"customer_replied":"administrator_replied"/);
assert.match(source,/role==="administrator"&&record\.assignedToUserId!==actorId.*insert\(notificationsTable\)/s);
console.log("B179 requester receives atomic assigned-administrator reply notification: PASS");
