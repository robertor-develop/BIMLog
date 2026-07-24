import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyzeSql, collectSchemaContract, runStaticGate } from "./check-database-safety.mjs";
import { databaseToolResultFailed } from "../lib/db/scripts/sync-development-schema.mjs";
import {
  evaluateParity,
  requiredConstraints,
} from "../lib/db/scripts/check-schema-parity.mjs";

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

assert.equal(
  databaseToolResultFailed({
    status: 0,
    stdout: "schema inspection completed",
    stderr:
      "PostgresError: constraint already exists\nseverity: ERROR\ncode: 42710",
  }),
  true,
  "database-tool error output must fail even when the child returns zero",
);
assert.equal(
  databaseToolResultFailed({ status: 0, stdout: "changes applied", stderr: "" }),
  false,
  "clean zero-exit database-tool output must remain eligible for parity",
);
assert.equal(
  databaseToolResultFailed({ status: 1, stdout: "", stderr: "" }),
  true,
  "nonzero database-tool status must fail closed",
);

const legacyForeignKeyName =
  "financial_contract_import_sessions_confirmed_contract_version_id_financial_contract_versions_id_fk";
const legacyUniqueName =
  "financial_contract_import_sessions_confirmed_contract_version_id_unique";
assert.equal(
  legacyForeignKeyName.slice(0, 63),
  legacyUniqueName.slice(0, 63),
  "fixture must reproduce PostgreSQL's 63-byte identifier collision",
);
const explicitConstraintNames = requiredConstraints.map((item) => item.name);
assert.equal(new Set(explicitConstraintNames).size, explicitConstraintNames.length);
assert.ok(
  explicitConstraintNames.every((name) => Buffer.byteLength(name, "utf8") <= 63),
  "explicit constraint names must be PostgreSQL length-safe",
);

const passingConstraints = new Map(
  requiredConstraints.map((item) => [
    item.name,
    {
      tableName: item.tableName,
      type: item.type,
      definition: item.definition,
    },
  ]),
);
assert.deepEqual(
  evaluateParity({ tables: [], indexes: [] }, new Set(), new Set(), passingConstraints),
  { missingTables: [], missingIndexes: [], constraintProblems: [] },
);
const missingUniqueConstraint = new Map(passingConstraints);
missingUniqueConstraint.delete("fc_import_confirmed_version_uk");
assert.ok(
  evaluateParity(
    { tables: [], indexes: [] },
    new Set(),
    new Set(),
    missingUniqueConstraint,
  ).constraintProblems.some((problem) =>
    problem.includes("missing constraint fc_import_confirmed_version_uk"),
  ),
  "parity must reject the observed foreign-key-only collision state",
);
const wrongForeignKey = new Map(passingConstraints);
wrongForeignKey.set("fc_import_confirmed_version_fk", {
  tableName: "financial_contract_import_sessions",
  type: "f",
  definition: "FOREIGN KEY (confirmed_contract_version_id) REFERENCES wrong_table(id)",
});
assert.ok(
  evaluateParity({ tables: [], indexes: [] }, new Set(), new Set(), wrongForeignKey)
    .constraintProblems.length > 0,
  "parity must reject a same-name constraint with the wrong definition",
);

const declarativeFinancialSchema = fs.readFileSync(
  path.resolve("lib/db/src/schema/financial-contracts.ts"),
  "utf8",
);
const runtimeFinancialMigration = fs.readFileSync(
  path.resolve("artifacts/api-server/src/lib/financial-contract-migration.ts"),
  "utf8",
);
for (const name of explicitConstraintNames) {
  assert.ok(declarativeFinancialSchema.includes(name), `declarative schema missing ${name}`);
  assert.ok(runtimeFinancialMigration.includes(name), `runtime migration missing ${name}`);
}
assert.match(
  runtimeFinancialMigration,
  /duplicate confirmed contract versions exist/,
  "runtime reconciliation must refuse duplicate synthetic or existing rows",
);
assert.doesNotMatch(
  runtimeFinancialMigration,
  /DROP\s+(?:CONSTRAINT|INDEX|TABLE)/i,
  "runtime reconciliation must remain additive",
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
