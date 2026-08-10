import { pool } from "@workspace/db";

let migration: Promise<void> | null = null;
export function startJobIntakeMigration() {
  if (!migration) migration = ensureJobIntakeSchema();
  return migration;
}
export async function waitForJobIntakeMigration() { await startJobIntakeMigration(); }

export async function ensureJobIntakeSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:job-intake-schema'))");
    await client.query(`
CREATE TABLE IF NOT EXISTS job_intakes(
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  status text NOT NULL DEFAULT 'draft',
  revision integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion jsonb NOT NULL DEFAULT '{}'::jsonb,
  activated_contract_id text REFERENCES financial_contracts(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  CONSTRAINT job_intake_project_uidx UNIQUE(project_id),
  CONSTRAINT job_intake_status_chk CHECK(status IN('draft','ready','activated')),
  CONSTRAINT job_intake_revision_positive_chk CHECK(revision > 0)
);
CREATE TABLE IF NOT EXISTS job_intake_documents(
  id text PRIMARY KEY,
  intake_id text NOT NULL REFERENCES job_intakes(id),
  project_id integer NOT NULL REFERENCES projects(id),
  file_id integer NOT NULL REFERENCES files(id),
  category text NOT NULL,
  revision_label text,
  source_hash text NOT NULL,
  extraction_status text NOT NULL,
  extraction_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by_id integer REFERENCES users(id),
  CONSTRAINT job_intake_document_category_chk CHECK(category IN('quotation','proposal','takeoff','estimate','contract','supporting')),
  CONSTRAINT job_intake_document_extraction_chk CHECK(extraction_status IN('structured_preview','text_preview','manual_review_required')),
  CONSTRAINT job_intake_document_uidx UNIQUE(intake_id,file_id)
);
CREATE TABLE IF NOT EXISTS job_intake_events(
  id text PRIMARY KEY,
  intake_id text NOT NULL REFERENCES job_intakes(id),
  project_id integer NOT NULL REFERENCES projects(id),
  actor_user_id integer NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  before_revision integer,
  after_revision integer,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE job_intakes ADD COLUMN IF NOT EXISTS activation_mode text;
ALTER TABLE job_intakes ADD COLUMN IF NOT EXISTS activation_summary jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS job_activation_work_items(
  id text PRIMARY KEY,
  intake_id text NOT NULL REFERENCES job_intakes(id),
  project_id integer NOT NULL REFERENCES projects(id),
  stable_scope_item_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL,
  planned_hours numeric(30,6) NOT NULL,
  workflow_template text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  billing_hourly_rate numeric(30,6),
  planned_billable_value numeric(30,6),
  apu_plan_version integer,
  budget_snapshot_line_id text,
  project_cost_node_id text,
  contract_id text REFERENCES financial_contracts(id),
  contract_version_id text REFERENCES financial_contract_versions(id),
  commercial_capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_activation_work_item_status_chk CHECK(status IN('active','completed','cancelled')),
  CONSTRAINT job_activation_work_item_hours_chk CHECK(planned_hours>0),
  CONSTRAINT job_activation_work_item_uidx UNIQUE(intake_id,stable_scope_item_id)
);
CREATE TABLE IF NOT EXISTS job_activation_tasks(
  id text PRIMARY KEY,
  work_item_id text NOT NULL REFERENCES job_activation_work_items(id),
  task_key text NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'not_started',
  planned_hours numeric(30,6) NOT NULL,
  assignee_user_id integer REFERENCES users(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_activation_task_status_chk CHECK(status IN('not_started','in_progress','blocked','complete','cancelled')),
  CONSTRAINT job_activation_task_hours_chk CHECK(planned_hours>0),
  CONSTRAINT job_activation_task_uidx UNIQUE(work_item_id,task_key)
);
CREATE TABLE IF NOT EXISTS job_activation_resource_assignments(
  id text PRIMARY KEY,
  intake_id text NOT NULL REFERENCES job_intakes(id),
  work_item_id text NOT NULL REFERENCES job_activation_work_items(id),
  task_id text NOT NULL REFERENCES job_activation_tasks(id),
  source_assignment_id text NOT NULL,
  user_id integer REFERENCES users(id),
  person_name text NOT NULL,
  role text NOT NULL,
  employment_type text NOT NULL,
  planned_hours numeric(30,6) NOT NULL,
  internal_hourly_rate numeric(30,6),
  billing_hourly_rate numeric(30,6),
  planned_internal_cost numeric(30,6),
  planned_billable_value numeric(30,6),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_activation_resource_hours_chk CHECK(planned_hours>0),
  CONSTRAINT job_activation_resource_uidx UNIQUE(intake_id,source_assignment_id)
);
CREATE INDEX IF NOT EXISTS job_intake_company_status_idx ON job_intakes(company_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS job_intake_document_active_idx ON job_intake_documents(intake_id,created_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS job_intake_event_idx ON job_intake_events(intake_id,created_at,id);
CREATE INDEX IF NOT EXISTS job_activation_work_item_project_idx ON job_activation_work_items(project_id,status,created_at);
CREATE INDEX IF NOT EXISTS job_activation_task_work_item_idx ON job_activation_tasks(work_item_id,sequence);
CREATE INDEX IF NOT EXISTS job_activation_resource_work_item_idx ON job_activation_resource_assignments(work_item_id,user_id);
`);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
