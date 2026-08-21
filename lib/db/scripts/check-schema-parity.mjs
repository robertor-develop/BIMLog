import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const packageRoot = path.resolve(import.meta.dirname, "..");
const schemaDirectory = path.join(packageRoot, "src", "schema");

export const requiredConstraints = [
  {
    name: "financial_contract_import_ses_confirmed_contract_version_i_fkey",
    tableName: "financial_contract_import_sessions",
    type: "f",
    definition:
      "FOREIGN KEY (confirmed_contract_version_id) REFERENCES financial_contract_versions(id)",
  },
  {
    name: "financial_contract_import_ses_confirmed_contract_version_id_key",
    tableName: "financial_contract_import_sessions",
    type: "u",
    definition: "UNIQUE (confirmed_contract_version_id)",
  },
  ...[
    ["feedback_items_company_id_fkey", "feedback_items", "company_id", "companies", "id"],
    ["feedback_relay_jobs_parent_job_id_fkey", "feedback_relay_jobs", "parent_job_id", "feedback_relay_jobs", "id"],
    ["feedback_relay_jobs_receipt_id_fkey", "feedback_relay_jobs", "receipt_id", "feedback_relay_receipts", "id"],
    ["feedback_relay_jobs_deletion_proof_id_fkey", "feedback_relay_jobs", "deletion_proof_id", "feedback_relay_deletion_proofs", "id"],
    ["feedback_relay_nonces_job_id_fkey", "feedback_relay_nonces", "job_id", "feedback_relay_jobs", "id"],
    ["feedback_relay_nonces_company_id_fkey", "feedback_relay_nonces", "company_id", "companies", "id"],
    ["feedback_relay_nonces_project_id_fkey", "feedback_relay_nonces", "project_id", "projects", "id"],
    ["feedback_relay_nonces_feedback_id_fkey", "feedback_relay_nonces", "feedback_id", "feedback_items", "id"],
    ["feedback_relay_nonces_asset_id_fkey", "feedback_relay_nonces", "asset_id", "feedback_assets", "id"],
    ["feedback_relay_receipts_company_id_fkey", "feedback_relay_receipts", "company_id", "companies", "id"],
    ["feedback_relay_receipts_project_id_fkey", "feedback_relay_receipts", "project_id", "projects", "id"],
    ["feedback_relay_receipts_feedback_id_fkey", "feedback_relay_receipts", "feedback_id", "feedback_items", "id"],
    ["feedback_relay_receipts_asset_id_fkey", "feedback_relay_receipts", "asset_id", "feedback_assets", "id"],
  ].map(([name, tableName, column, targetTable, targetColumn]) => ({
    name,
    tableName,
    type: "f",
    definition: `FOREIGN KEY (${column}) REFERENCES ${targetTable}(${targetColumn})`,
  })),
  {
    name: "feedback_relay_jobs_expiry_outcome_chk",
    tableName: "feedback_relay_jobs",
    type: "c",
    definition:
      "CHECK (expiry_outcome IS NULL OR expiry_outcome = ANY (ARRAY['temporary-absent'::text, 'no-temporary-object'::text]))",
  },
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function expectedObjects() {
  const tables = new Set();
  const indexes = new Set();
  for (const filePath of walk(schemaDirectory).filter((file) =>
    file.endsWith(".ts"),
  )) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/\bpgTable\(\s*["'`]([^"'`]+)["'`]/g))
      tables.add(match[1]);
    for (const match of source.matchAll(
      /\b(?:uniqueIndex|index)\(\s*["'`]([^"'`]+)["'`]/g,
    )) {
      indexes.add(match[1]);
    }
  }
  return { tables: [...tables].sort(), indexes: [...indexes].sort() };
}

function connectionIdentity(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname
    ) {
      throw new Error();
    }
    return {
      hostname: url.hostname.toLowerCase(),
      identity: `${url.hostname.toLowerCase()}/${url.pathname
        .replace(/^\/+/, "")
        .toLowerCase()}`,
    };
  } catch {
    throw new Error("Safety refusal: database connection identity is invalid");
  }
}

export function normalizeConstraintDefinition(definition) {
  return String(definition)
    .replaceAll('"', "")
    .replace(/\bpublic\./gi, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
    .toLowerCase();
}

export function evaluateParity(
  expected,
  actualTables,
  actualIndexes,
  actualConstraints,
) {
  const missingTables = expected.tables.filter(
    (name) => !actualTables.has(name),
  );
  const missingIndexes = expected.indexes.filter(
    (name) => !actualIndexes.has(name),
  );
  const constraintProblems = [];
  for (const required of requiredConstraints) {
    const actual = actualConstraints.get(required.name);
    if (!actual) {
      constraintProblems.push(`missing constraint ${required.name}`);
      continue;
    }
    if (
      actual.tableName !== required.tableName ||
      actual.type !== required.type ||
      normalizeConstraintDefinition(actual.definition) !==
        normalizeConstraintDefinition(required.definition)
    ) {
      constraintProblems.push(
        `unexpected definition for constraint ${required.name}`,
      );
    }
  }
  return { missingTables, missingIndexes, constraintProblems };
}

async function main() {
  const expected = expectedObjects();
  if (process.argv.includes("--inventory-only")) {
    console.log(
      `Database schema inventory: ${expected.tables.length} tables, ${expected.indexes.length} indexes.`,
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (process.env.BIMLOG_SCHEMA_TARGET !== "development") {
    throw new Error(
      "BIMLOG_SCHEMA_TARGET=development is required for the parity gate",
    );
  }
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is required for the Replit development-schema parity gate",
    );
  if (!process.env.PROD_DATABASE_URL) {
    throw new Error(
      "PROD_DATABASE_URL is required for the parity identity comparison",
    );
  }
  const development = connectionIdentity(databaseUrl);
  const production = connectionIdentity(process.env.PROD_DATABASE_URL);
  if (!development.hostname.includes("helium")) {
    throw new Error(
      "Safety refusal: parity inspection is restricted to Replit Helium",
    );
  }
  if (development.identity === production.identity) {
    throw new Error(
      "Safety refusal: DATABASE_URL resolves to the configured production database",
    );
  }

  const { default: pg } = await import("pg");
  const { Client } = pg;
  const client = new Client({
    connectionString: databaseUrl,
    statement_timeout: 15_000,
  });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const tableResult = await client.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`,
    );
    const indexResult = await client.query(
      `SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname='public'`,
    );
    const constraintResult = await client.query(
      `SELECT c.conname AS name,t.relname AS table_name,c.contype AS type,
              pg_get_constraintdef(c.oid, true) AS definition
       FROM pg_catalog.pg_constraint c
       JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
       JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
       WHERE n.nspname='public' AND c.conname=ANY($1::text[])`,
      [requiredConstraints.map((item) => item.name)],
    );
    await client.query("COMMIT");

    const actualTables = new Set(tableResult.rows.map((row) => row.tablename));
    const actualIndexes = new Set(indexResult.rows.map((row) => row.indexname));
    const actualConstraints = new Map(
      constraintResult.rows.map((row) => [
        row.name,
        {
          tableName: row.table_name,
          type: row.type,
          definition: row.definition,
        },
      ]),
    );
    const { missingTables, missingIndexes, constraintProblems } =
      evaluateParity(expected, actualTables, actualIndexes, actualConstraints);

    if (
      missingTables.length ||
      missingIndexes.length ||
      constraintProblems.length
    ) {
      console.error("Replit development-schema parity FAILED.");
      if (missingTables.length)
        console.error(`Missing tables: ${missingTables.join(", ")}`);
      if (missingIndexes.length)
        console.error(`Missing indexes: ${missingIndexes.join(", ")}`);
      for (const problem of constraintProblems) console.error(problem);
      console.error("Do not open or approve the Publish migration preview.");
      process.exitCode = 1;
      return;
    }

    console.log(
      `Replit development-schema parity: passed (${expected.tables.length} tables, ${expected.indexes.length} indexes).`,
    );
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  await main();
}
