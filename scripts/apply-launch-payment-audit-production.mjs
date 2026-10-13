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
const authorization = "launch-payment-verification-audit-v1";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const migrationSql = `
CREATE TABLE IF NOT EXISTS launch_payment_verification_audit (
  id text PRIMARY KEY,
  configuration_id text NOT NULL REFERENCES launch_configurations(id),
  environment text NOT NULL,
  revision integer NOT NULL CONSTRAINT launch_payment_verification_audit_revision_check CHECK (revision > 0),
  method text NOT NULL CONSTRAINT launch_payment_verification_audit_method_check CHECK (method IN ('bank_transfer','qr_payment','stripe')),
  mode text NOT NULL CONSTRAINT launch_payment_verification_audit_mode_check CHECK (mode IN ('manual','sandbox','production')),
  status text NOT NULL CONSTRAINT launch_payment_verification_audit_status_check CHECK (status IN ('configured','verified','failed','unavailable')),
  result_code text NOT NULL,
  actor_user_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launch_payment_verification_audit_time_idx
  ON launch_payment_verification_audit(environment, created_at DESC);
`;

const constraintReconciliationSql = `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_revision_chk')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_revision_check')
  THEN ALTER TABLE launch_payment_verification_audit RENAME CONSTRAINT launch_payment_verification_audit_revision_chk TO launch_payment_verification_audit_revision_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_method_chk')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_method_check')
  THEN ALTER TABLE launch_payment_verification_audit RENAME CONSTRAINT launch_payment_verification_audit_method_chk TO launch_payment_verification_audit_method_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_mode_chk')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_mode_check')
  THEN ALTER TABLE launch_payment_verification_audit RENAME CONSTRAINT launch_payment_verification_audit_mode_chk TO launch_payment_verification_audit_mode_check; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_status_chk')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_status_check')
  THEN ALTER TABLE launch_payment_verification_audit RENAME CONSTRAINT launch_payment_verification_audit_status_chk TO launch_payment_verification_audit_status_check; END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_revision_check') THEN ALTER TABLE launch_payment_verification_audit ADD CONSTRAINT launch_payment_verification_audit_revision_check CHECK (revision > 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_method_check') THEN ALTER TABLE launch_payment_verification_audit ADD CONSTRAINT launch_payment_verification_audit_method_check CHECK (method IN ('bank_transfer','qr_payment','stripe')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_mode_check') THEN ALTER TABLE launch_payment_verification_audit ADD CONSTRAINT launch_payment_verification_audit_mode_check CHECK (mode IN ('manual','sandbox','production')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass AND conname='launch_payment_verification_audit_status_check') THEN ALTER TABLE launch_payment_verification_audit ADD CONSTRAINT launch_payment_verification_audit_status_check CHECK (status IN ('configured','verified','failed','unavailable')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_email_verification_audit'::regclass AND conname='launch_email_verification_audit_provider_check') THEN ALTER TABLE launch_email_verification_audit ADD CONSTRAINT launch_email_verification_audit_provider_check CHECK (provider IN ('smtp','sendgrid')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_email_verification_audit'::regclass AND conname='launch_email_verification_audit_action_check') THEN ALTER TABLE launch_email_verification_audit ADD CONSTRAINT launch_email_verification_audit_action_check CHECK (action IN ('verify','send_test')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.launch_email_verification_audit'::regclass AND conname='launch_email_verification_audit_status_check') THEN ALTER TABLE launch_email_verification_audit ADD CONSTRAINT launch_email_verification_audit_status_check CHECK (status IN ('verified','sent','rejected','unavailable')); END IF; END $$;
`;

function git(args) {
  return execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "-C", root, ...args], { encoding: "utf8" }).trim();
}

function identity(raw) {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) throw new Error("Invalid database URL");
  return `${url.hostname.toLowerCase()}/${url.pathname.replace(/^\/+/, "").toLowerCase()}`;
}

async function catalog(client) {
  const [database, table, columns, constraints, indexes] = await Promise.all([
    client.query("SELECT current_database() database"),
    client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename='launch_payment_verification_audit'"),
    client.query("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='launch_payment_verification_audit' ORDER BY ordinal_position"),
    client.query("SELECT conname,contype,pg_get_constraintdef(oid,true) definition FROM pg_catalog.pg_constraint WHERE conrelid='public.launch_payment_verification_audit'::regclass ORDER BY conname").catch(() => ({ rows: [] })),
    client.query("SELECT indexname,indexdef FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename='launch_payment_verification_audit' ORDER BY indexname"),
  ]);
  return { database: database.rows[0].database, table: table.rows, columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows };
}

function writeReceipt(outputPath, phase, source, inventory) {
  const payload = { schemaVersion: "bimlog-production-additive-migration-v1", phase, source, inventory };
  const receipt = { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
  fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  return receipt;
}

async function main() {
  if (process.env.BIMLOG_PRODUCTION_ADDITIVE_MIGRATION !== authorization) throw new Error(`Set BIMLOG_PRODUCTION_ADDITIVE_MIGRATION=${authorization}`);
  if (!process.env.DATABASE_URL || !process.env.PROD_DATABASE_URL) throw new Error("DATABASE_URL and PROD_DATABASE_URL are required");
  if (identity(process.env.DATABASE_URL) === identity(process.env.PROD_DATABASE_URL)) throw new Error("Development and production identities must differ");
  if (!process.env.BIMLOG_MIGRATION_RECEIPT_DIRECTORY) throw new Error("BIMLOG_MIGRATION_RECEIPT_DIRECTORY is required");
  if (git(["rev-parse", "--abbrev-ref", "HEAD"]) !== "master") throw new Error("Authoritative master branch is required");
  const head = git(["rev-parse", "HEAD"]);
  if (head !== git(["rev-parse", "origin/master"])) throw new Error("HEAD must equal origin/master");
  if (git(["status", "--porcelain"])) throw new Error("Clean source tree is required");

  const directory = path.resolve(process.env.BIMLOG_MIGRATION_RECEIPT_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  const source = { commit: head, tree: git(["rev-parse", "HEAD^{tree}"]) };
  const developmentClient = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
  await developmentClient.connect();
  try {
    await developmentClient.query("BEGIN");
    try {
      await developmentClient.query("SELECT pg_advisory_xact_lock(hashtext('bimlog-launch-payment-verification-audit-v1'))");
      await developmentClient.query(migrationSql);
      await developmentClient.query(constraintReconciliationSql);
      await developmentClient.query("COMMIT");
    } catch (error) {
      await developmentClient.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    await developmentClient.end();
  }

  const client = new Client({ connectionString: process.env.PROD_DATABASE_URL, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 });
  await client.connect();
  try {
    const before = await catalog(client);
    writeReceipt(path.join(directory, "before.json"), "BEFORE", source, before);
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog-launch-payment-verification-audit-v1'))");
      await client.query(migrationSql);
      await client.query(constraintReconciliationSql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    const after = await catalog(client);
    if (after.table.length !== 1 || after.columns.length !== 10) throw new Error("Post-migration table shape verification failed");
    const receipt = writeReceipt(path.join(directory, "after.json"), "AFTER", source, after);
    console.log(JSON.stringify({ result: "PASS", operation: authorization, source, receiptSha256: receipt.receiptSha256 }, null, 2));
  } finally {
    await client.end();
  }
}

await main();
