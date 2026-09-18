import { pool } from "@workspace/db";
import { ensureCompanyMasterCatalogSchema } from "./company-master-catalog-migration";

export const WORKFLOW_GOVERNANCE_POLICY_SQL = String.raw`
CREATE TABLE IF NOT EXISTS company_workflow_governance_policies (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  name text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_workflow_governance_policies_company_code_uq UNIQUE(company_id,code)
);
CREATE TABLE IF NOT EXISTS company_workflow_governance_versions (
  id text PRIMARY KEY,
  policy_id text NOT NULL REFERENCES company_workflow_governance_policies(id),
  version integer NOT NULL CHECK (version>0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','published','superseded','retired')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  definition jsonb NOT NULL,
  fingerprint text CHECK (fingerprint IS NULL OR fingerprint ~ '^[a-f0-9]{64}$'),
  approved_by_id integer REFERENCES users(id),
  approved_at timestamptz,
  published_by_id integer REFERENCES users(id),
  published_at timestamptz,
  retired_by_id integer REFERENCES users(id),
  retired_at timestamptz,
  created_by_id integer NOT NULL REFERENCES users(id),
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_workflow_governance_versions_policy_version_uq UNIQUE(policy_id,version),
  CONSTRAINT company_workflow_governance_versions_approved_chk CHECK
    ((state IN ('approved','published','superseded','retired')) =
     (approved_by_id IS NOT NULL AND approved_at IS NOT NULL AND fingerprint IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS company_workflow_governance_one_open_uq
  ON company_workflow_governance_versions(policy_id) WHERE state IN ('draft','approved');
CREATE UNIQUE INDEX IF NOT EXISTS company_workflow_governance_one_published_uq
  ON company_workflow_governance_versions(policy_id) WHERE state='published';
CREATE TABLE IF NOT EXISTS company_workflow_governance_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  policy_id text NOT NULL REFERENCES company_workflow_governance_policies(id),
  version_id text NOT NULL REFERENCES company_workflow_governance_versions(id),
  action text NOT NULL CHECK (action IN ('created','edited','approved','published','superseded','retired')),
  actor_id integer NOT NULL REFERENCES users(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_workflow_governance_events_history_idx
  ON company_workflow_governance_events(company_id,policy_id,created_at);
CREATE OR REPLACE FUNCTION company_workflow_governance_immutability_guard() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'company_workflow_governance_events' THEN
    RAISE EXCEPTION 'Workflow Governance Policy audit events are immutable';
  END IF;
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Workflow Governance Policy versions cannot be deleted';
  END IF;
  IF OLD.state<>'draft' AND (NEW.definition IS DISTINCT FROM OLD.definition
    OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint OR NEW.policy_id IS DISTINCT FROM OLD.policy_id
    OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'Approved Workflow Governance Policy definitions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_workflow_governance_version_immutable') THEN
    CREATE TRIGGER company_workflow_governance_version_immutable BEFORE UPDATE OR DELETE ON company_workflow_governance_versions
      FOR EACH ROW EXECUTE FUNCTION company_workflow_governance_immutability_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_workflow_governance_event_immutable') THEN
    CREATE TRIGGER company_workflow_governance_event_immutable BEFORE UPDATE OR DELETE ON company_workflow_governance_events
      FOR EACH ROW EXECUTE FUNCTION company_workflow_governance_immutability_guard();
  END IF;
END $$;
`;

type MigrationPool = { connect(): Promise<{ query(sql: string): Promise<unknown>; release(): void }> };
let startup: Promise<void> | null = null;
export async function ensureWorkflowGovernancePolicySchema(migrationPool?: MigrationPool): Promise<void> {
  await ensureCompanyMasterCatalogSchema(migrationPool);
  if (migrationPool) return runMigration(migrationPool);
  startup ??= runMigration(pool).catch(error => { startup = null; throw error; });
  return startup;
}
async function runMigration(migrationPool: MigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-governance-policy:v1'))");
    await client.query(WORKFLOW_GOVERNANCE_POLICY_SQL);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
