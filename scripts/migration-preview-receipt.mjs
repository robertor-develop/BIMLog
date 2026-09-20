import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifySchemaInventory, readDatabaseInventory, sourceSchemaReceipt } from "./database-schema-receipt.mjs";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function createMigrationPreviewReceipt(source, actual) {
  const comparison = classifySchemaInventory(source, actual);
  const pending = {
    tables: comparison.tables.missing,
    indexes: comparison.indexes.missing,
    columns: comparison.columns.missing,
    columnShapes: comparison.columnShapes.missing,
    checks: comparison.checks.missing,
  };
  const unexpected = {
    tables: comparison.tables.extra,
    indexes: comparison.indexes.extra,
    columns: comparison.columns.extra,
    columnShapes: comparison.columnShapes.extra,
    checks: comparison.checks.extra,
    constraintBackedIndexes: comparison.indexes.constraintBackedExtra,
  };
  const status = comparison.exact ? "ZERO_PENDING" : "PROVIDER_PREVIEW_REQUIRED";
  const payload = {
    schemaVersion: "bimlog-migration-preview-receipt-v1",
    sourceContractSha256: source.sourceContractSha256,
    status,
    pending,
    unexpected,
    missingStartupTables: comparison.missingStartupTables,
    destructiveSourceGate: "PASS",
    rollbackRequirement: status === "ZERO_PENDING" ? "NO_SCHEMA_CHANGE" : "VERIFIED_BACKUP_AND_COMPLETE_ADDITIVE_INVENTORY_REQUIRED",
  };
  return { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
}

async function main() {
  const databaseUrl = process.env.BIMLOG_MIGRATION_PREVIEW_DATABASE_URL;
  if (!databaseUrl) throw new Error("Set BIMLOG_MIGRATION_PREVIEW_DATABASE_URL to a restored disposable or read-only target database.");
  const source = sourceSchemaReceipt();
  const actual = await readDatabaseInventory(databaseUrl);
  const receipt = createMigrationPreviewReceipt(source, actual);
  console.log(JSON.stringify(receipt, null, 2));
  if (receipt.status !== "ZERO_PENDING") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
