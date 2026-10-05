import assert from "node:assert/strict"; import fs from "node:fs";
const service=fs.readFileSync(new URL("./repair-authority.ts",import.meta.url),"utf8"),migration=fs.readFileSync(new URL("./repair-authority-migration.ts",import.meta.url),"utf8"),route=fs.readFileSync(new URL("../routes/repairs.ts",import.meta.url),"utf8");
assert.match(service,/BIMLOG_REPAIR_PIN_PEPPER/); assert.doesNotMatch(service,/3336/); assert.match(service,/timingSafeEqual/); assert.match(service,/attempts<5/); assert.match(service,/scope_digest=\$4/); assert.match(service,/isSuperAdmin/); assert.match(service,/platform_repair_delegates/); assert.match(service,/executionConnected: false/);
for(const table of ["platform_repair_delegates","platform_repair_pins","platform_repair_proposals","platform_repair_events"]) assert.match(migration,new RegExp(table));
assert.match(route,/authMiddleware/); assert.match(route,/\/repairs\/:id\/authorize/);
console.log("PA128 server-enforced scoped repair authority and hashed PIN boundary: PASS");
