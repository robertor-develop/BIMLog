import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runStaticGate } from "./check-database-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function sourceSchemaReceipt() {
  const source = runStaticGate();
  if (source.violations.length) throw new Error(`Source schema contract is unsafe: ${source.violations.join("; ")}`);
  const contract = {
    tables: source.contract.tables,
    indexes: source.contract.indexes,
    startupTables: source.startupTables,
  };
  return {
    schemaVersion: "bimlog-schema-receipt-v1",
    sourceContractSha256: sha256(JSON.stringify(contract)),
    counts: {
      tables: contract.tables.length,
      indexes: contract.indexes.length,
      startupTables: contract.startupTables.length,
    },
    contract,
  };
}

export function classifySchemaInventory(receipt, actual) {
  const compare = (expected, observed) => ({
    missing: expected.filter((name) => !observed.includes(name)),
    extra: observed.filter((name) => !expected.includes(name)),
  });
  const tables = compare(receipt.contract.tables, [...actual.tables].sort());
  const rawIndexes = compare(receipt.contract.indexes, [...actual.indexes].sort());
  const constraintIndexes = new Set(actual.constraintIndexes ?? []);
  const indexes = {
    missing: rawIndexes.missing,
    extra: rawIndexes.extra.filter((name) => !constraintIndexes.has(name)),
    constraintBackedExtra: rawIndexes.extra.filter((name) => constraintIndexes.has(name)),
  };
  const missingStartupTables = receipt.contract.startupTables.filter((name) => !actual.tables.includes(name));
  return {
    tables,
    indexes,
    missingStartupTables,
    exact: !tables.missing.length && !tables.extra.length && !indexes.missing.length && !indexes.extra.length && !missingStartupTables.length,
  };
}

export async function readDatabaseInventory(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const identity = await client.query("SELECT current_database() database, current_setting('server_encoding') encoding");
    const tables = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename");
    const indexes = await client.query("SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname='public' ORDER BY indexname");
    const constraintIndexes = await client.query(
      `SELECT i.relname indexname
       FROM pg_catalog.pg_constraint c
       JOIN pg_catalog.pg_class i ON i.oid=c.conindid
       JOIN pg_catalog.pg_namespace n ON n.oid=i.relnamespace
       WHERE n.nspname='public' AND c.conindid <> 0
       ORDER BY i.relname`,
    );
    await client.query("COMMIT");
    return {
      identity: identity.rows[0],
      tables: tables.rows.map((row) => row.tablename),
      indexes: indexes.rows.map((row) => row.indexname),
      constraintIndexes: constraintIndexes.rows.map((row) => row.indexname),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const receipt = sourceSchemaReceipt();
  const databaseUrl = process.env.BIMLOG_SCHEMA_RECEIPT_DATABASE_URL;
  if (!databaseUrl) {
    console.log(JSON.stringify({ ...receipt, database: null, classification: "SOURCE_ONLY" }, null, 2));
    return;
  }
  const actual = await readDatabaseInventory(databaseUrl);
  const comparison = classifySchemaInventory(receipt, actual);
  const output = {
    ...receipt,
    database: {
      name: actual.identity.database,
      encoding: actual.identity.encoding,
      tableCount: actual.tables.length,
      indexCount: actual.indexes.length,
      inventorySha256: sha256(JSON.stringify({ tables: actual.tables, indexes: actual.indexes })),
    },
    comparison,
    classification: comparison.exact ? "EXACT" : "DIFFERENT_CLASSIFIED",
  };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const outputPath = process.argv[outputIndex + 1];
    if (!outputPath) throw new Error("--output requires a path");
    fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
  }
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
