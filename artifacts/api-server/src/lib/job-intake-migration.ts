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
CREATE INDEX IF NOT EXISTS job_intake_company_status_idx ON job_intakes(company_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS job_intake_document_active_idx ON job_intake_documents(intake_id,created_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS job_intake_event_idx ON job_intake_events(intake_id,created_at,id);
`);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
