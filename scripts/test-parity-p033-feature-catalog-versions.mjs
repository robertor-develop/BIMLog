import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/AdminPanel.tsx");
const routes = read("artifacts/api-server/src/routes/features.ts");
const service = read("artifacts/api-server/src/lib/feature-catalog-service.ts");

assert.match(panel, /Feature Catalog History/);
assert.match(panel, /\/admin\/feature-catalog\/versions/);
assert.match(panel, /Read-only Super Admin evidence/);
assert.match(panel, /Loading feature catalog history/);
assert.match(panel, /No feature catalog versions are recorded/);
assert.match(panel, /requested === "feature-catalog-history" && isSuperAdmin/);
assert.match(panel, /activeTab === 12 && isSuperAdmin/);
assert.match(routes, /router\.get\("\/admin\/feature-catalog\/versions", authMiddleware, isSuperAdminMiddleware/);
assert.match(routes, /readOnly: true/);
assert.match(service, /activationAuthority: row\.activated_by_user \? "verified_super_admin" : "verified_system_seed"/);

console.log("P033 feature catalog version parity checks passed");
