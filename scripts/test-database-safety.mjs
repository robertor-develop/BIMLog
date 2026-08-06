import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  analyzeSql,
  collectSchemaContract,
  runStaticGate,
} from "./check-database-safety.mjs";
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

const genericApuMethodConstraintDrop =
  "ALTER TABLE generic_project_apu_lines DROP CONSTRAINT IF EXISTS generic_project_apu_line_method_chk";
assert.ok(
  analyzeSql(genericApuMethodConstraintDrop, "unallowlisted source").some(
    (item) => item.includes("DROP CONSTRAINT"),
  ),
  "the Generic APU exception must remain path-scoped rather than weakening DROP CONSTRAINT detection",
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
assert.ok(
  previewViolations.some((item) => item.includes("DISABLE ROW LEVEL SECURITY")),
);
assert.ok(previewViolations.some((item) => item.includes("DROP INDEX")));
assert.ok(previewViolations.some((item) => item.includes("DROP VIEW")));
assert.ok(
  previewViolations.some((item) => item.includes("SET ROW_SECURITY OFF")),
);
assert.ok(
  analyzeSql('client.query("DROP/**/TABLE unsafe_table")', "source fixture", {
    sourceContainer: true,
  }).some((item) => item.includes("DROP TABLE")),
  "comment-separated destructive SQL inside a source string must fail closed",
);

const rejectedPublishPreview = fs.readFileSync(
  path.resolve("scripts/fixtures/replit-publish-preview-c40d1c4.sql"),
  "utf8",
);
assert.equal(
  crypto.createHash("sha256").update(rejectedPublishPreview).digest("hex"),
  "6f4fa8cc7c88c751ad2d78705e785ab9111dccaa8a3c103969bb83d7f5de73fa",
  "the complete rejected Replit preview fixture must remain byte-identical",
);
const previewDropNames = [
  ...rejectedPublishPreview.matchAll(
    /\bDROP\s+(?:CONSTRAINT|INDEX)\s+"([^"]+)"/gi,
  ),
].map((match) => match[1]);
assert.equal(
  previewDropNames.length,
  105,
  "fixture must retain all 105 destructive operations",
);
assert.equal(
  (rejectedPublishPreview.match(/\bDROP\s+CONSTRAINT\b/gi) ?? []).length,
  87,
);
assert.equal(
  (rejectedPublishPreview.match(/\bDROP\s+INDEX\b/gi) ?? []).length,
  18,
);
const rejectedPreviewViolations = analyzeSql(
  rejectedPublishPreview,
  "complete rejected Replit preview",
);
assert.ok(
  rejectedPreviewViolations.some((item) => item.includes("DROP CONSTRAINT")),
);
assert.ok(
  rejectedPreviewViolations.some((item) => item.includes("DROP INDEX")),
);
const fiveIndexChurnPreview = fs.readFileSync(
  path.resolve(
    "scripts/fixtures/replit-publish-preview-five-index-churn-e3c28a4.sql",
  ),
  "utf8",
);
assert.equal(
  crypto
    .createHash("sha256")
    .update(fiveIndexChurnPreview.replace(/\r\n/g, "\n"))
    .digest("hex"),
  "bbf88bc249552189ad59f3af23c9d2f6d00895c76a5f0f345134f3fd5c0d0519",
  "the exact five-index churn preview fixture must remain text-identical",
);
assert.equal(
  (fiveIndexChurnPreview.match(/\bDROP\s+INDEX\b/gi) ?? []).length,
  5,
);
assert.equal(
  (fiveIndexChurnPreview.match(/\bCREATE\s+INDEX\b/gi) ?? []).length,
  5,
);
assert.ok(
  analyzeSql(fiveIndexChurnPreview, "five-index rejected Replit preview").some(
    (item) => item.includes("DROP INDEX"),
  ),
  "the exact five-index churn preview must fail closed",
);
const finalSixChurnPreview = fs.readFileSync(
  path.resolve("scripts/fixtures/replit-publish-preview-final-six-ef1c423.sql"),
  "utf8",
);
assert.equal(
  crypto
    .createHash("sha256")
    .update(finalSixChurnPreview.replace(/\r\n/g, "\n"))
    .digest("hex"),
  "4fd84b43918e9cbd677591fece630683ddebc8aff9c9472cc49e5d60260dcab0",
  "the exact final-six churn preview fixture must remain text-identical",
);
assert.equal(
  (finalSixChurnPreview.match(/\bDROP\s+CONSTRAINT\b/gi) ?? []).length,
  3,
);
assert.equal(
  (finalSixChurnPreview.match(/\bDROP\s+INDEX\b/gi) ?? []).length,
  3,
);
const finalSixViolations = analyzeSql(
  finalSixChurnPreview,
  "final-six rejected Replit preview",
);
assert.ok(finalSixViolations.some((item) => item.includes("DROP CONSTRAINT")));
assert.ok(finalSixViolations.some((item) => item.includes("DROP INDEX")));
const declarativeSchema = fs
  .readdirSync(path.resolve("lib/db/src/schema"))
  .filter((name) => name.endsWith(".ts"))
  .map((name) =>
    fs.readFileSync(path.resolve("lib/db/src/schema", name), "utf8"),
  )
  .join("\n");
for (const name of previewDropNames) {
  assert.ok(
    declarativeSchema.includes(name),
    `declarative schema must preserve published object authority for ${name}`,
  );
}

const productionDescendingNullsFirstIndexes = [
  {
    name: "coordinator_saved_views_owner_project_idx",
    schema: "lib/db/src/schema/coordinator-saved-views.ts",
    runtime: "artifacts/api-server/src/lib/coordinator-saved-view-migration.ts",
  },
  {
    name: "coordinator_saved_view_operations_view_idx",
    schema: "lib/db/src/schema/coordinator-saved-views.ts",
    runtime: "artifacts/api-server/src/lib/coordinator-saved-view-migration.ts",
  },
  {
    name: "coordinator_bulk_meeting_operations_project_meeting_idx",
    schema: "lib/db/src/schema/coordinator-bulk-operations.ts",
    runtime:
      "artifacts/api-server/src/lib/coordinator-bulk-action-migration.ts",
  },
  {
    name: "living_brief_gate_audit_created_idx",
    schema: "lib/db/src/schema/living-brief-gate.ts",
    runtime: "artifacts/api-server/src/lib/living-brief-migration.ts",
  },
  {
    name: "financial_contract_grant_lookup_idx",
    schema: "lib/db/src/schema/financial-contracts.ts",
    runtime: "artifacts/api-server/src/lib/financial-contract-migration.ts",
  },
];
for (const authority of productionDescendingNullsFirstIndexes) {
  const schemaSource = fs.readFileSync(path.resolve(authority.schema), "utf8");
  const runtimeSource = fs.readFileSync(
    path.resolve(authority.runtime),
    "utf8",
  );
  const escapedName = authority.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    schemaSource,
    new RegExp(
      `index\\(\\s*"${escapedName}"\\s*,?\\s*\\)[\\s\\S]{0,240}?\\.desc\\(\\)\\.nullsFirst\\(\\)`,
    ),
    `${authority.name} must preserve production DESC NULLS FIRST semantics`,
  );
  assert.match(
    runtimeSource,
    new RegExp(`${escapedName}[^;]*DESC\\s+NULLS\\s+FIRST`, "i"),
    `${authority.name} runtime authority must explicitly use DESC NULLS FIRST`,
  );
}

const declarativeRfiSettingsSchema = fs.readFileSync(
  path.resolve("lib/db/src/schema/rfi-report-settings.ts"),
  "utf8",
);
const runtimeRfiSettingsSchema = fs.readFileSync(
  path.resolve("artifacts/api-server/src/app.ts"),
  "utf8",
);
const productionRfiForeignKeys = [
  "rfi_report_settings_project_id_fkey",
  "rfi_report_settings_created_by_id_fkey",
  "rfi_report_settings_updated_by_id_fkey",
];
for (const name of productionRfiForeignKeys) {
  assert.ok(
    declarativeRfiSettingsSchema.includes(name),
    `declarative RFI settings schema missing ${name}`,
  );
  assert.ok(
    runtimeRfiSettingsSchema.includes(name),
    `runtime RFI settings schema missing ${name}`,
  );
}
for (const generatedName of [
  "rfi_report_settings_project_id_projects_id_fk",
  "rfi_report_settings_created_by_id_users_id_fk",
  "rfi_report_settings_updated_by_id_users_id_fk",
]) {
  assert.ok(
    !declarativeRfiSettingsSchema.includes(generatedName),
    `declarative RFI settings schema must not reintroduce ${generatedName}`,
  );
}

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
  databaseToolResultFailed({
    status: 0,
    stdout: "changes applied",
    stderr: "",
  }),
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
assert.equal(
  new Set(explicitConstraintNames).size,
  explicitConstraintNames.length,
);
assert.ok(
  explicitConstraintNames.every(
    (name) => Buffer.byteLength(name, "utf8") <= 63,
  ),
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
  evaluateParity(
    { tables: [], indexes: [] },
    new Set(),
    new Set(),
    passingConstraints,
  ),
  { missingTables: [], missingIndexes: [], constraintProblems: [] },
);
const missingUniqueConstraint = new Map(passingConstraints);
missingUniqueConstraint.delete(
  "financial_contract_import_ses_confirmed_contract_version_id_key",
);
assert.ok(
  evaluateParity(
    { tables: [], indexes: [] },
    new Set(),
    new Set(),
    missingUniqueConstraint,
  ).constraintProblems.some((problem) =>
    problem.includes(
      "missing constraint financial_contract_import_ses_confirmed_contract_version_id_key",
    ),
  ),
  "parity must reject the observed foreign-key-only collision state",
);
const wrongForeignKey = new Map(passingConstraints);
wrongForeignKey.set(
  "financial_contract_import_ses_confirmed_contract_version_i_fkey",
  {
    tableName: "financial_contract_import_sessions",
    type: "f",
    definition:
      "FOREIGN KEY (confirmed_contract_version_id) REFERENCES wrong_table(id)",
  },
);
assert.ok(
  evaluateParity(
    { tables: [], indexes: [] },
    new Set(),
    new Set(),
    wrongForeignKey,
  ).constraintProblems.length > 0,
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
  assert.ok(
    declarativeFinancialSchema.includes(name),
    `declarative schema missing ${name}`,
  );
  assert.ok(
    runtimeFinancialMigration.includes(name),
    `runtime migration missing ${name}`,
  );
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
  assert.ok(
    contract.tables.includes(table),
    `missing protected schema table ${table}`,
  );
}
assert.deepEqual(contract.missingExports, []);

const staticGate = runStaticGate();
assert.deepEqual(staticGate.violations, []);

const genericApuMigration = fs.readFileSync(
  path.resolve("artifacts/api-server/src/lib/generic-apu-persistence-migration.ts"),
  "utf8",
);
assert.equal(
  genericApuMigration.split(genericApuMethodConstraintDrop).length - 1,
  1,
  "the allowlisted Generic APU constraint drop must occur exactly once",
);
assert.match(
  genericApuMigration,
  /ALTER TABLE generic_project_apu_lines DROP CONSTRAINT IF EXISTS generic_project_apu_line_method_chk;\s*ALTER TABLE generic_project_apu_lines ADD CONSTRAINT generic_project_apu_line_method_chk CHECK\(method IN\('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula'\)\);/,
  "the allowlisted drop must be immediately replaced by the accepted method constraint",
);
assert.match(genericApuMigration, /await client\.query\("BEGIN"\)/);
assert.match(genericApuMigration, /await client\.query\("ROLLBACK"\)/);
assert.match(genericApuMigration, /await client\.query\("COMMIT"\)/);

console.log("Database safety fixtures: passed.");
