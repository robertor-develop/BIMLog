import { pool } from "@workspace/db";
import { waitForJobIntakeMigration } from "./job-intake-migration";
import { ensureCompanyMasterCatalogSchema } from "./company-master-catalog-migration";
import { ensureWorkflowGovernancePolicySchema } from "./workflow-governance-policy-migration";

export const DELIVERY_WORKFLOW_TEMPLATE_SQL = String.raw`
CREATE TABLE IF NOT EXISTS company_delivery_workflow_templates (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  name text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,code)
);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_versions (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES company_delivery_workflow_templates(id),
  version integer NOT NULL CHECK (version > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','published','superseded','retired')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  definition jsonb NOT NULL,
  fingerprint text CHECK (fingerprint IS NULL OR fingerprint ~ '^[a-f0-9]{64}$'),
  effective_from timestamptz,
  approved_at timestamptz,
  approved_by_id integer REFERENCES users(id),
  published_at timestamptz,
  published_by_id integer REFERENCES users(id),
  retired_at timestamptz,
  retired_by_id integer REFERENCES users(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id,version),
  CONSTRAINT company_delivery_workflow_approved_chk CHECK ((state IN ('approved','published','superseded','retired')) = (approved_at IS NOT NULL AND approved_by_id IS NOT NULL AND fingerprint IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS company_delivery_workflow_one_open_version_uq
  ON company_delivery_workflow_versions(template_id) WHERE state IN ('draft','approved');
CREATE UNIQUE INDEX IF NOT EXISTS company_delivery_workflow_one_published_version_uq
  ON company_delivery_workflow_versions(template_id) WHERE state='published';
CREATE TABLE IF NOT EXISTS company_delivery_workflow_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  template_id text NOT NULL REFERENCES company_delivery_workflow_templates(id),
  version_id text NOT NULL REFERENCES company_delivery_workflow_versions(id),
  action text NOT NULL CHECK (action IN ('created','edited','approved','published','superseded','retired')),
  actor_id integer NOT NULL REFERENCES users(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_delivery_workflow_events_history_idx
  ON company_delivery_workflow_events(company_id,template_id,created_at);
CREATE OR REPLACE FUNCTION company_delivery_workflow_immutability_guard() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'company_delivery_workflow_events' THEN
    RAISE EXCEPTION 'Delivery Workflow audit events are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Delivery Workflow versions cannot be deleted';
  END IF;
  IF OLD.state <> 'draft' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
    OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION 'Approved and published Delivery Workflow definitions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_delivery_workflow_version_immutable') THEN
    CREATE TRIGGER company_delivery_workflow_version_immutable BEFORE UPDATE OR DELETE ON company_delivery_workflow_versions
      FOR EACH ROW EXECUTE FUNCTION company_delivery_workflow_immutability_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_delivery_workflow_event_immutable') THEN
    CREATE TRIGGER company_delivery_workflow_event_immutable BEFORE UPDATE OR DELETE ON company_delivery_workflow_events
      FOR EACH ROW EXECUTE FUNCTION company_delivery_workflow_immutability_guard();
  END IF;
END $$;
`;

export const DELIVERY_WORKFLOW_RUNTIME_SQL = String.raw`
CREATE TABLE IF NOT EXISTS company_delivery_workflow_work_items (
  work_item_id text PRIMARY KEY REFERENCES job_activation_work_items(id),
  project_id integer NOT NULL REFERENCES projects(id),
  company_id integer NOT NULL REFERENCES companies(id),
  template_id text REFERENCES company_delivery_workflow_templates(id),
  version_id text REFERENCES company_delivery_workflow_versions(id),
  source text NOT NULL CHECK (source IN ('bimlog','company')),
  template_code text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  deliverable_type text NOT NULL CHECK (deliverable_type IN ('GENERAL','SHOP_DRAWING','SLEEVE')),
  definition jsonb NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  selection text NOT NULL CHECK (selection IN ('explicit','single_company','bimlog_default')),
  policy_id text REFERENCES company_workflow_governance_policies(id),
  policy_version_id text REFERENCES company_workflow_governance_versions(id),
  policy_code text,
  policy_version integer,
  policy_definition jsonb,
  policy_fingerprint text,
  phase_index integer NOT NULL DEFAULT 1 CHECK (phase_index > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  activated_by_id integer NOT NULL REFERENCES users(id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_delivery_workflow_binding_source_chk CHECK ((source='bimlog' AND template_id IS NULL AND version_id IS NULL) OR (source='company' AND template_id IS NOT NULL AND version_id IS NOT NULL))
);
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_id text REFERENCES company_workflow_governance_policies(id);
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_version_id text REFERENCES company_workflow_governance_versions(id);
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_code text;
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_version integer;
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_definition jsonb;
ALTER TABLE company_delivery_workflow_work_items ADD COLUMN IF NOT EXISTS policy_fingerprint text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='company_delivery_workflow_policy_snapshot_chk') THEN
    ALTER TABLE company_delivery_workflow_work_items ADD CONSTRAINT company_delivery_workflow_policy_snapshot_chk CHECK (
      (policy_id IS NULL AND policy_version_id IS NULL AND policy_code IS NULL AND policy_version IS NULL AND policy_definition IS NULL AND policy_fingerprint IS NULL)
      OR (policy_id IS NOT NULL AND policy_version_id IS NOT NULL AND policy_code IS NOT NULL AND policy_version>0 AND policy_definition IS NOT NULL AND policy_fingerprint ~ '^[a-f0-9]{64}$')
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS company_delivery_workflow_work_item_project_idx ON company_delivery_workflow_work_items(project_id,work_item_id);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_steps (
  work_item_id text NOT NULL REFERENCES company_delivery_workflow_work_items(work_item_id),
  phase_id text NOT NULL,
  task_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  completed_by_id integer REFERENCES users(id),
  completed_at timestamptz,
  PRIMARY KEY(work_item_id,phase_id,task_id)
);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_roles (
  work_item_id text NOT NULL REFERENCES company_delivery_workflow_work_items(work_item_id),
  role text NOT NULL CHECK (role IN ('execute','review','approve')),
  user_id integer NOT NULL REFERENCES users(id),
  assigned_by_id integer NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(work_item_id,role)
);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_evidence (
  id text PRIMARY KEY,
  work_item_id text NOT NULL REFERENCES company_delivery_workflow_work_items(work_item_id),
  phase_id text NOT NULL,
  task_id text NOT NULL,
  document_code text NOT NULL,
  file_id integer NOT NULL REFERENCES files(id),
  linked_by_id integer NOT NULL REFERENCES users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_delivery_workflow_evidence_unique UNIQUE(work_item_id,phase_id,task_id,document_code,file_id)
);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_phase_checks (
  work_item_id text NOT NULL REFERENCES company_delivery_workflow_work_items(work_item_id),
  phase_id text NOT NULL,
  qc_approved_by_id integer REFERENCES users(id),
  qc_approved_at timestamptz,
  approved_by_id integer REFERENCES users(id),
  approved_at timestamptz,
  PRIMARY KEY(work_item_id,phase_id)
);
CREATE TABLE IF NOT EXISTS company_delivery_workflow_work_item_events (
  id text PRIMARY KEY,
  work_item_id text NOT NULL REFERENCES company_delivery_workflow_work_items(work_item_id),
  project_id integer NOT NULL REFERENCES projects(id),
  action text NOT NULL,
  phase_id text,
  task_id text,
  actor_id integer NOT NULL REFERENCES users(id),
  before_state text,
  after_state text,
  reason text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_delivery_workflow_work_item_event_idx
  ON company_delivery_workflow_work_item_events(work_item_id,created_at,id);
CREATE OR REPLACE FUNCTION company_delivery_workflow_runtime_immutable_guard() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'company_delivery_workflow_work_item_events' THEN
    RAISE EXCEPTION 'Delivery Workflow runtime events are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Delivery Workflow bindings cannot be deleted';
  END IF;
  IF NEW.definition IS DISTINCT FROM OLD.definition OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
    OR NEW.version_id IS DISTINCT FROM OLD.version_id OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.deliverable_type IS DISTINCT FROM OLD.deliverable_type OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.template_code IS DISTINCT FROM OLD.template_code OR NEW.template_version IS DISTINCT FROM OLD.template_version
    OR NEW.selection IS DISTINCT FROM OLD.selection OR NEW.activated_by_id IS DISTINCT FROM OLD.activated_by_id
    OR NEW.policy_id IS DISTINCT FROM OLD.policy_id OR NEW.policy_version_id IS DISTINCT FROM OLD.policy_version_id
    OR NEW.policy_code IS DISTINCT FROM OLD.policy_code OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
    OR NEW.policy_definition IS DISTINCT FROM OLD.policy_definition OR NEW.policy_fingerprint IS DISTINCT FROM OLD.policy_fingerprint
    OR NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
    RAISE EXCEPTION 'Activated Delivery Workflow snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_delivery_workflow_binding_immutable') THEN
    CREATE TRIGGER company_delivery_workflow_binding_immutable BEFORE UPDATE OR DELETE ON company_delivery_workflow_work_items
      FOR EACH ROW EXECUTE FUNCTION company_delivery_workflow_runtime_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='company_delivery_workflow_runtime_event_immutable') THEN
    CREATE TRIGGER company_delivery_workflow_runtime_event_immutable BEFORE UPDATE OR DELETE ON company_delivery_workflow_work_item_events
      FOR EACH ROW EXECUTE FUNCTION company_delivery_workflow_runtime_immutable_guard();
  END IF;
END $$;
`;

let startup: Promise<void> | null = null;
let runtimeStartup: Promise<void> | null = null;
type MigrationClient = { query(sql: string): Promise<unknown>; release(): void };
type MigrationPool = { connect(): Promise<MigrationClient> };

export function ensureDeliveryWorkflowTemplateSchema(migrationPool?: MigrationPool): Promise<void> {
  if (migrationPool) return runMigration(migrationPool);
  startup ??= runMigration(pool).catch(error => { startup = null; throw error; });
  return startup;
}

export async function ensureDeliveryWorkflowRuntimeSchema(migrationPool?: MigrationPool): Promise<void> {
  await Promise.all([ensureDeliveryWorkflowTemplateSchema(migrationPool),waitForJobIntakeMigration(),ensureCompanyMasterCatalogSchema(migrationPool),ensureWorkflowGovernancePolicySchema(migrationPool)]);
  if (migrationPool) return runRuntimeMigration(migrationPool);
  runtimeStartup ??= runRuntimeMigration(pool).catch(error => { runtimeStartup = null; throw error; });
  return runtimeStartup;
}

async function runRuntimeMigration(migrationPool: MigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:delivery-workflow-runtime:v1'))");
    await client.query(DELIVERY_WORKFLOW_RUNTIME_SQL);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function runMigration(migrationPool: MigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:delivery-workflow-templates:v1'))");
    await client.query(DELIVERY_WORKFLOW_TEMPLATE_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
