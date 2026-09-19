import { pool } from "@workspace/db";

export const COMPANY_MASTER_CATALOG_SQL = String.raw`
CREATE TABLE IF NOT EXISTS company_master_catalog_administrators (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  user_id integer NOT NULL REFERENCES users(id),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','revoked')),
  granted_by_id integer NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_id integer REFERENCES users(id),
  revoked_at timestamptz,
  CONSTRAINT company_master_catalog_admin_revoke_chk CHECK ((state='revoked')=(revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS company_master_catalog_admin_active_uq
  ON company_master_catalog_administrators(company_id,user_id) WHERE state='active';
CREATE TABLE IF NOT EXISTS company_master_catalog_policies (
  company_id integer PRIMARY KEY REFERENCES companies(id),
  mode text NOT NULL DEFAULT 'defaults_allowed' CHECK (mode IN ('approved_only','defaults_allowed')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS company_master_catalog_entries (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  kind text NOT NULL CHECK (kind IN ('client','discipline','service','phase')),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  name text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aliases)='array'),
  canonical_company_id integer REFERENCES companies(id),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','inactive','retired')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_by_id integer NOT NULL REFERENCES users(id),
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CONSTRAINT company_master_catalog_client_chk CHECK ((kind='client')=(canonical_company_id IS NOT NULL)),
  CONSTRAINT company_master_catalog_retired_chk CHECK ((state='retired')=(retired_at IS NOT NULL)),
  CONSTRAINT company_master_catalog_scope_code_uq UNIQUE(company_id,kind,code)
);
ALTER TABLE company_master_catalog_entries ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  ALTER TABLE company_master_catalog_entries ADD CONSTRAINT company_master_catalog_aliases_array_chk CHECK (jsonb_typeof(aliases)='array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS company_master_catalog_active_idx
  ON company_master_catalog_entries(company_id,kind,state);
CREATE UNIQUE INDEX IF NOT EXISTS company_master_catalog_client_uq
  ON company_master_catalog_entries(company_id,canonical_company_id) WHERE kind='client';
`;

let startup: Promise<void> | null = null;
type MigrationClient = { query(sql: string): Promise<unknown>; release(): void };
type MigrationPool = { connect(): Promise<MigrationClient> };

export function ensureCompanyMasterCatalogSchema(migrationPool?: MigrationPool): Promise<void> {
  if (migrationPool) return runMigration(migrationPool);
  startup ??= runMigration(pool);
  return startup;
}

async function runMigration(migrationPool: MigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:company-master-catalog:v1'))");
    await client.query(COMPANY_MASTER_CATALOG_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
