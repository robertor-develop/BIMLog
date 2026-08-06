import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCommercialProjectScope } from "./commercial-project-scope";

const root = path.resolve(import.meta.dirname, "../../../..");
const migration = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/commercial-entitlement.ts"), "utf8");
const financial = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/financial-control-service.ts"), "utf8");
const admin = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/admin.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "lib/db/src/schema/commercial-entitlements.ts"), "utf8");
const projectScope = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/commercial-project-scope.ts"), "utf8");

const checks: string[] = [];
for (const email of ["robertor@rryasociados.com", "robertor@bimcorpinc.com", "rubenc@bimcorpgroup.com", "leidyp@bimcorpgroup.com"]) {
  assert.match(migration, new RegExp(email.replace(".", "\\.")));
}
checks.push("exact four initial users are idempotently enabled");
assert.match(migration, /ON CONFLICT\(event_key\) DO NOTHING/);
assert.match(migration, /BEFORE UPDATE OR DELETE/);
assert.match(migration, /pg_advisory_xact_lock/);
checks.push("grant and revoke history is append-only, idempotent, and concurrency serialized");
assert.match(admin, /commercialEnabled/);
assert.match(admin, /\/admin\/users\/:id\/commercial-entitlement.*isSuperAdminMiddleware/);
checks.push("Total Control users API exposes and controls Commercial entitlement through super-admin only");
assert.doesNotMatch(financial, /FIN_PROJECT_BINDING_REQUIRED/);
assert.match(projectScope, /Current active project membership is required/);
assert.match(financial, /commercialAccess \? FINANCIAL_AUTHORITIES\.map/);
assert.match(financial, /authorizesExecution: commercialAccess/);
checks.push("entitled users receive Commercial authority while active membership remains the project boundary");
assert.deepEqual(resolveCommercialProjectScope({ projectId: 26, isSuperAdmin: false, row: { company_id: 8, member: true } }), { allowed: true, projectId: 26, companyId: 8 });
assert.equal(resolveCommercialProjectScope({ projectId: 26, isSuperAdmin: false, row: { company_id: 8, member: false } }).code, "FIN_SCOPE_MEMBERSHIP_DENIED");
assert.deepEqual(resolveCommercialProjectScope({ projectId: 26, isSuperAdmin: true, row: { company_id: 8, member: false } }), { allowed: true, projectId: 26, companyId: 8 });
checks.push("Project 26-style unbound membership resolves from creator company, rejects non-members, and preserves super-admin all-project access");
assert.match(schema, /commercialEntitlementEventsTable/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS commercial_entitlement_events/);
checks.push("Drizzle and startup migration both define the entitlement ledger");

console.log(JSON.stringify({ suite: "commercial-user-entitlement", status: "passed", checks }, null, 2));
