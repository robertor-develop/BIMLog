import assert from "node:assert/strict";import fs from "node:fs";const source=fs.readFileSync(new URL("./support-cases.ts",import.meta.url),"utf8");
assert.match(source,/db\.transaction\(async tx=>.*insert\(supportCasesTable\).*usersTable\.isSuperAdmin.*supportNotification\("case_opened".*insert\(notificationsTable\)/s);
assert.match(source,/uniqueSupportRecipients\(.*actor\.userId/s);
assert.match(source,/code\?:unknown.*23505.*replayed:true/s);
console.log("B177 atomic support case opening notifications: PASS");
