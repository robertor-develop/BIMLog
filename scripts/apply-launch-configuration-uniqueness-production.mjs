import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");
const authorization = "launch-configuration-uniqueness-v1";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function git(args) {
  return execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "-C", root, ...args], { encoding: "utf8" }).trim();
}

function identity(raw) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) throw new Error("Invalid database URL");
  return `${url.hostname.toLowerCase()}/${url.pathname.replace(/^\/+/, "").toLowerCase()}`;
}

function acceptedSource() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = git(["rev-parse", "HEAD"]);
  const expectedBranch = process.env.BIMLOG_ACCEPTED_BRANCH;
  const expectedCommit = process.env.BIMLOG_ACCEPTED_COMMIT;
  if (branch !== expectedBranch || head !== expectedCommit) throw new Error("Exact accepted release source is required");
  if (head !== git(["rev-parse", `origin/${branch}`])) throw new Error("HEAD must equal the accepted remote branch");
  if (git(["status", "--porcelain"])) throw new Error("Clean source tree is required");
  return { branch, commit: head, tree: git(["rev-parse", "HEAD^{tree}"]) };
}

async function catalog(client) {
  const result = await client.query(`SELECT t.relname table_name,c.conname name,pg_get_constraintdef(c.oid,true) definition
    FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
    WHERE c.conname = ANY($1::text[]) ORDER BY c.conname`, [[
      "launch_configurations_environment_key",
      "launch_configuration_versions_configuration_id_revision_key",
    ]]);
  return result.rows;
}

async function assertNoDuplicates(client) {
  const environment = await client.query("SELECT environment,count(*)::int count FROM launch_configurations GROUP BY environment HAVING count(*) > 1");
  const revisions = await client.query("SELECT configuration_id,revision,count(*)::int count FROM launch_configuration_versions GROUP BY configuration_id,revision HAVING count(*) > 1");
  if (environment.rowCount || revisions.rowCount) throw new Error("Uniqueness preflight failed: duplicate launch configuration records exist");
}

async function main() {
  if (process.env.BIMLOG_PRODUCTION_ADDITIVE_MIGRATION !== authorization) throw new Error(`Set BIMLOG_PRODUCTION_ADDITIVE_MIGRATION=${authorization}`);
  if (!process.env.DATABASE_URL || !process.env.PROD_DATABASE_URL) throw new Error("DATABASE_URL and PROD_DATABASE_URL are required");
  if (identity(process.env.DATABASE_URL) === identity(process.env.PROD_DATABASE_URL)) throw new Error("Development and production identities must differ");
  if (!process.env.BIMLOG_MIGRATION_RECEIPT_DIRECTORY) throw new Error("BIMLOG_MIGRATION_RECEIPT_DIRECTORY is required");
  const source = acceptedSource();
  const directory = path.resolve(process.env.BIMLOG_MIGRATION_RECEIPT_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  const client = new Client({ connectionString: process.env.PROD_DATABASE_URL, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
  await client.connect();
  try {
    await assertNoDuplicates(client);
    const before = await catalog(client);
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog-launch-configuration-uniqueness-v1'))");
      await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='launch_configurations_environment_key' AND conrelid='public.launch_configurations'::regclass) THEN ALTER TABLE launch_configurations ADD CONSTRAINT launch_configurations_environment_key UNIQUE(environment); END IF; END $$;`);
      await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='launch_configuration_versions_configuration_id_revision_key' AND conrelid='public.launch_configuration_versions'::regclass) THEN ALTER TABLE launch_configuration_versions ADD CONSTRAINT launch_configuration_versions_configuration_id_revision_key UNIQUE(configuration_id,revision); END IF; END $$;`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    const after = await catalog(client);
    if (after.length !== 2) throw new Error("Post-migration uniqueness verification failed");
    const payload = { schemaVersion: authorization, source, before, after };
    const receipt = { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
    fs.writeFileSync(path.join(directory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ result: "PASS", source, receiptSha256: receipt.receiptSha256 }, null, 2));
  } finally {
    await client.end();
  }
}

await main();
