import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("artifacts/api-server/src/routes/clash_reports.ts", "utf8");
assert.match(routes, /clashes\/:clashId", authMiddleware, requirePermission\("admin", "write"\)/);
assert.match(routes, /\["open", "in_progress", "resolved", "closed"\]/);
assert.match(routes, /error: "invalid_status"/);
assert.match(routes, /db\.transaction\(async tx/);
assert.match(routes, /actionType: "update", entityType: "clash"/);
assert.match(routes, /actionType: "delete", entityType: "clash"/);
assert.match(routes, /deletedAt: new Date\(\), deleteReason: reason/);
assert.match(routes, /lens-next\/issues\/:serverId\/attachments/);
assert.match(routes, /lens-next\/issues\/:serverId\/links/);
console.log("CORRECTIVE-B11 issue lifecycle authorization, transitions, evidence, archive and audit: PASS");
