import assert from "node:assert/strict";import fs from "node:fs";const source=fs.readFileSync(new URL("./support-cases.ts",import.meta.url),"utf8");
assert.match(source,/patch\("\/admin\/support\/cases\/:id\/status".*db\.transaction\(async tx=>.*update\(supportCasesTable\).*supportNotification\("status_changed".*insert\(notificationsTable\)/s);
assert.match(source,/if\(!updated\).*SUPPORT_CASE_STALE_OR_MISSING/s);
console.log("B180 atomic support status notification: PASS");
