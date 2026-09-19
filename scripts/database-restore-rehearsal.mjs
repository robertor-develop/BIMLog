import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { classifySchemaInventory, readDatabaseInventory, sourceSchemaReceipt } from "./database-schema-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");
const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

function requireExactIdentity(rawUrl, expectedDatabase) {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "::1"].includes(host) ||
      url.pathname !== `/${expectedDatabase}` || url.search || url.hash)
    throw new Error(`Rehearsal URL must be loopback PostgreSQL and exact database ${expectedDatabase}.`);
  return url;
}

async function recordCounts(url, tables) {
  const client = new Client({ connectionString: url.toString(), statement_timeout: 30_000 });
  await client.connect();
  try {
    const counts = {};
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::text count FROM public.${quoteIdentifier(table)}`);
      counts[table] = result.rows[0].count;
    }
    return counts;
  } finally { await client.end(); }
}

async function main() {
  const sourceUrl = requireExactIdentity(process.env.BIMLOG_REHEARSAL_SOURCE_DATABASE_URL ?? "", "bimlog_rfi_test");
  const rehearsalRoot = path.resolve(process.env.BIMLOG_REHEARSAL_ROOT ?? "");
  const pgBin = path.resolve(process.env.BIMLOG_POSTGRES_BIN ?? "");
  if (process.platform === "win32" && !rehearsalRoot.toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\"))
    throw new Error("Restore rehearsal custody must stay below F:\\BIMLog\\TestProof.");
  if (!fs.existsSync(path.join(pgBin, "pg_dump.exe")) || !fs.existsSync(path.join(pgBin, "pg_restore.exe")))
    throw new Error("BIMLOG_POSTGRES_BIN must identify the installed PostgreSQL binary directory.");
  fs.mkdirSync(rehearsalRoot, { recursive: true });

  const adminUrl = new URL(sourceUrl); adminUrl.pathname = "/postgres";
  const restoreUrl = new URL(sourceUrl); restoreUrl.pathname = "/bimlog_rfi_restore_test";
  const admin = new Client({ connectionString: adminUrl.toString(), statement_timeout: 30_000 });
  await admin.connect();
  try {
    const identity = await admin.query("SELECT current_setting('data_directory') data_dir, inet_server_port() port");
    if (process.platform === "win32" && !path.resolve(identity.rows[0].data_dir).toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\"))
      throw new Error("The responding PostgreSQL server is not the F-rooted test cluster.");
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='bimlog_rfi_restore_test' AND pid <> pg_backend_pid()");
    await admin.query("DROP DATABASE IF EXISTS bimlog_rfi_restore_test");
    await admin.query("CREATE DATABASE bimlog_rfi_restore_test WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
  } finally { await admin.end(); }

  const backupPath = path.join(rehearsalRoot, "bimlog-rfi-test.backup");
  if (fs.existsSync(backupPath)) throw new Error("Rehearsal backup path already exists; use a fresh evidence directory.");
  execFileSync(path.join(pgBin, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-privileges", "--file", backupPath, sourceUrl.toString()], { windowsHide: true });
  execFileSync(path.join(pgBin, "pg_restore.exe"), ["--no-owner", "--no-privileges", "--dbname", restoreUrl.toString(), backupPath], { windowsHide: true });

  const sourceContract = sourceSchemaReceipt();
  const sourceInventory = await readDatabaseInventory(sourceUrl.toString());
  const restoredInventory = await readDatabaseInventory(restoreUrl.toString());
  const sourceClassification = classifySchemaInventory(sourceContract, sourceInventory);
  const restoredClassification = classifySchemaInventory(sourceContract, restoredInventory);
  const sourceCounts = await recordCounts(sourceUrl, sourceContract.contract.tables);
  const restoredCounts = await recordCounts(restoreUrl, sourceContract.contract.tables);
  const sourceCountSha256 = sha256(JSON.stringify(sourceCounts));
  const restoredCountSha256 = sha256(JSON.stringify(restoredCounts));
  if (!sourceClassification.exact || !restoredClassification.exact || sourceCountSha256 !== restoredCountSha256)
    throw new Error("Restored database does not match the exact source schema and record-count manifest.");

  const receipt = {
    schemaVersion: "bimlog-database-restore-receipt-v1",
    sourceDatabase: "bimlog_rfi_test",
    restoredDatabase: "bimlog_rfi_restore_test",
    sourceContractSha256: sourceContract.sourceContractSha256,
    backupSha256: sha256File(backupPath),
    backupBytes: fs.statSync(backupPath).size,
    sourceRecordCountManifestSha256: sourceCountSha256,
    restoredRecordCountManifestSha256: restoredCountSha256,
    schemaExact: true,
    recordCountsExact: true,
    restoreRetainedForReadinessProof: process.argv.includes("--retain-restore"),
  };
  fs.writeFileSync(path.join(rehearsalRoot, "restore-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(receipt, null, 2));

  if (!receipt.restoreRetainedForReadinessProof) {
    const cleanup = new Client({ connectionString: adminUrl.toString() });
    await cleanup.connect();
    try {
      await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='bimlog_rfi_restore_test' AND pid <> pg_backend_pid()");
      await cleanup.query("DROP DATABASE bimlog_rfi_restore_test");
    } finally { await cleanup.end(); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
