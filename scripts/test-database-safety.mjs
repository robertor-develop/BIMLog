import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { analyzeSql, collectSchemaContract, runStaticGate } from "./check-database-safety.mjs";

assert.deepEqual(
  analyzeSql(`
    CREATE TABLE IF NOT EXISTS safe_table (id integer PRIMARY KEY);
    ALTER TABLE safe_table ADD COLUMN IF NOT EXISTS name text;
    CREATE INDEX IF NOT EXISTS safe_table_name_idx ON safe_table(name);
  `),
  [],
);

const unsafePreview = `
  ALTER TABLE "financial_contracts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "coordinator_saved_views" CASCADE;
  DROP INDEX "living_brief_gate_audit_created_idx";
  DROP/* comment-separated bypass attempt */VIEW "unsafe_view";
  SET row_security = off;
`;
const previewViolations = analyzeSql(unsafePreview, "fixture");
assert.ok(previewViolations.some((item) => item.includes("DROP TABLE")));
assert.ok(previewViolations.some((item) => item.includes("CASCADE")));
assert.ok(previewViolations.some((item) => item.includes("DISABLE ROW LEVEL SECURITY")));
assert.ok(previewViolations.some((item) => item.includes("DROP INDEX")));
assert.ok(previewViolations.some((item) => item.includes("DROP VIEW")));
assert.ok(previewViolations.some((item) => item.includes("SET ROW_SECURITY OFF")));
assert.ok(
  analyzeSql('client.query("DROP/**/TABLE unsafe_table")', "source fixture", {
    sourceContainer: true,
  }).some((item) => item.includes("DROP TABLE")),
  "comment-separated destructive SQL inside a source string must fail closed",
);

const syncScript = path.resolve("lib/db/scripts/sync-development-schema.mjs");
function targetFixture(environment) {
  return spawnSync(process.execPath, [syncScript, "--validate-target-only"], {
    env: { PATH: process.env.PATH, ...environment },
    encoding: "utf8",
  });
}
assert.notEqual(targetFixture({}).status, 0, "missing target must fail closed");
assert.notEqual(
  targetFixture({ BIMLOG_SCHEMA_TARGET: "development" }).status,
  0,
  "missing URLs must fail closed",
);
assert.notEqual(
  targetFixture({
    BIMLOG_SCHEMA_TARGET: "development",
    DATABASE_URL: "postgres://development.invalid/dev",
  }).status,
  0,
  "missing production identity must fail closed",
);
assert.notEqual(
  targetFixture({
    BIMLOG_SCHEMA_TARGET: "development",
    DATABASE_URL: "postgres://helium.invalid/same",
    PROD_DATABASE_URL: "postgres://helium.invalid/same",
  }).status,
  0,
  "development and production identity equality must fail closed",
);
assert.equal(
  targetFixture({
    BIMLOG_SCHEMA_TARGET: "development",
    DATABASE_URL: "postgres://helium.invalid/dev",
    PROD_DATABASE_URL: "postgres://production.invalid/prod",
  }).status,
  0,
  "distinct synthetic identities must pass target-only validation",
);

const contract = collectSchemaContract();
for (const table of [
  "coordinator_saved_views",
  "coordinator_saved_view_operations",
  "financial_contracts",
  "financial_contract_history",
  "meeting_lens_viewpoint_links",
]) {
  assert.ok(contract.tables.includes(table), `missing protected schema table ${table}`);
}
assert.deepEqual(contract.missingExports, []);

const staticGate = runStaticGate();
assert.deepEqual(staticGate.violations, []);

console.log("Database safety fixtures: passed.");
