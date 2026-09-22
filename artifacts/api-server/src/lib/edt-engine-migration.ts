import { pool } from "@workspace/db";
import { waitForJobIntakeMigration } from "./job-intake-migration";

export const EDT_ENGINE_HIERARCHY_SQL = String.raw`
CREATE TABLE IF NOT EXISTS job_activation_edt_nodes (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  intake_id text NOT NULL REFERENCES job_intakes(id),
  parent_id text REFERENCES job_activation_edt_nodes(id),
  node_kind text NOT NULL CHECK (node_kind IN ('project','contract','deliverable','location')),
  source_identity text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  active boolean NOT NULL DEFAULT true,
  source_snapshot jsonb NOT NULL,
  source_fingerprint text NOT NULL CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_activation_edt_node_source_uidx UNIQUE(intake_id,node_kind,source_identity),
  CONSTRAINT job_activation_edt_node_sibling_sequence_uidx UNIQUE(intake_id,parent_id,sequence)
);
CREATE INDEX IF NOT EXISTS job_activation_edt_node_project_idx ON job_activation_edt_nodes(project_id,node_kind,sequence);

ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS edt_node_id text REFERENCES job_activation_edt_nodes(id);
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS location_identity text;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS location_snapshot jsonb;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS trade_identity text;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS trade_snapshot jsonb;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS deliverable_type_identity text;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS deliverable_type_snapshot jsonb;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS display_code text;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS issuance_version integer NOT NULL DEFAULT 0;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS split_from_work_item_id text REFERENCES job_activation_work_items(id);
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS grouped_location_evidence jsonb;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS identity_fingerprint text;
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS economic_plan_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS job_activation_work_item_display_code_uidx ON job_activation_work_items(project_id,display_code) WHERE display_code IS NOT NULL AND status <> 'cancelled';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_activation_work_item_rv_chk') THEN
    ALTER TABLE job_activation_work_items ADD CONSTRAINT job_activation_work_item_rv_chk CHECK (revision_number >= 0 AND issuance_version >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_activation_work_item_identity_fingerprint_chk') THEN
    ALTER TABLE job_activation_work_items ADD CONSTRAINT job_activation_work_item_identity_fingerprint_chk CHECK (identity_fingerprint IS NULL OR identity_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='job_activation_work_item_economic_fingerprint_chk') THEN
    ALTER TABLE job_activation_work_items ADD CONSTRAINT job_activation_work_item_economic_fingerprint_chk CHECK (economic_plan_fingerprint IS NULL OR economic_plan_fingerprint ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_activation_work_item_code_aliases (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  work_item_id text NOT NULL REFERENCES job_activation_work_items(id),
  alias_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  change_request_id text,
  decision_id text,
  reason text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_activation_work_item_alias_period_chk CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_activation_work_item_active_alias_uidx ON job_activation_work_item_code_aliases(project_id,alias_code) WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS job_activation_work_item_alias_lookup_idx ON job_activation_work_item_code_aliases(project_id,alias_code,valid_from);
`;

export const EDT_ENGINE_GOVERNANCE_SQL = String.raw`
CREATE TABLE IF NOT EXISTS job_activation_requests (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id), intake_id text NOT NULL REFERENCES job_intakes(id),
  intake_revision integer NOT NULL CHECK (intake_revision > 0), governance_version_id text NOT NULL, pricing_version_id text NOT NULL, workflow_version_ids jsonb NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'), state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected','cancelled')),
  optimistic_version integer NOT NULL DEFAULT 1 CHECK (optimistic_version > 0), idempotency_key text NOT NULL, requested_by_id integer NOT NULL REFERENCES users(id), eligible_role text NOT NULL,
  reason text NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, UNIQUE(intake_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_activation_request_open_uidx ON job_activation_requests(intake_id) WHERE state='pending';
CREATE INDEX IF NOT EXISTS job_activation_request_project_idx ON job_activation_requests(project_id,state,created_at);
CREATE TABLE IF NOT EXISTS job_activation_decisions (
  id text PRIMARY KEY, request_id text NOT NULL UNIQUE REFERENCES job_activation_requests(id), company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id),
  outcome text NOT NULL CHECK (outcome IN ('approved','rejected')), request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  decided_by_id integer NOT NULL REFERENCES users(id), eligible_role text NOT NULL, reason text NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_activation_decision_project_idx ON job_activation_decisions(project_id,created_at);

CREATE TABLE IF NOT EXISTS job_governed_change_requests (
  id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id), work_item_id text REFERENCES job_activation_work_items(id),
  action_type text NOT NULL CHECK (action_type IN ('redistribute_work_item','redistribute_contract','extra_hours','code_correction','split_work_item','reopen_work_item')),
  target_version integer NOT NULL CHECK (target_version > 0), before_state jsonb NOT NULL, after_state jsonb NOT NULL,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'), state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected','cancelled')),
  optimistic_version integer NOT NULL DEFAULT 1 CHECK (optimistic_version > 0), idempotency_key text NOT NULL, requested_by_id integer NOT NULL REFERENCES users(id), eligible_role text NOT NULL,
  reason text NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, UNIQUE(project_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_governed_change_request_open_uidx ON job_governed_change_requests(project_id,action_type,work_item_id) WHERE state='pending';
CREATE INDEX IF NOT EXISTS job_governed_change_request_project_idx ON job_governed_change_requests(project_id,state,created_at);
CREATE TABLE IF NOT EXISTS job_governed_change_decisions (
  id text PRIMARY KEY, request_id text NOT NULL UNIQUE REFERENCES job_governed_change_requests(id), company_id integer NOT NULL REFERENCES companies(id), project_id integer NOT NULL REFERENCES projects(id),
  outcome text NOT NULL CHECK (outcome IN ('approved','rejected')), request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  decided_by_id integer NOT NULL REFERENCES users(id), eligible_role text NOT NULL, reason text NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_governed_change_decision_project_idx ON job_governed_change_decisions(project_id,created_at);
CREATE OR REPLACE FUNCTION job_edt_decision_immutability_guard() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EDT decisions are immutable'; END; $$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='job_activation_decision_immutable') THEN
    CREATE TRIGGER job_activation_decision_immutable BEFORE UPDATE OR DELETE ON job_activation_decisions FOR EACH ROW EXECUTE FUNCTION job_edt_decision_immutability_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='job_governed_change_decision_immutable') THEN
    CREATE TRIGGER job_governed_change_decision_immutable BEFORE UPDATE OR DELETE ON job_governed_change_decisions FOR EACH ROW EXECUTE FUNCTION job_edt_decision_immutability_guard();
  END IF;
END $$;
`;

let startup: Promise<void> | null = null;
type MigrationClient = { query(sql: string): Promise<unknown>; release(): void };
type MigrationPool = { connect(): Promise<MigrationClient> };

async function runMigration(migrationPool: MigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:edt-engine:v1'))");
    await client.query(EDT_ENGINE_HIERARCHY_SQL);
    await client.query(EDT_ENGINE_GOVERNANCE_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureEdtEngineSchema(migrationPool?: MigrationPool): Promise<void> {
  await waitForJobIntakeMigration();
  if (migrationPool) return runMigration(migrationPool);
  startup ??= runMigration(pool).catch((error) => { startup = null; throw error; });
  return startup;
}
