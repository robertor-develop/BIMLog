type MigrationClient = { query(sql: string): Promise<unknown>; release(): void };
type MigrationPool = { connect(): Promise<MigrationClient> };

export async function ensureConnectorFoundationSchema(migrationPool?: MigrationPool): Promise<void> {
  const effectivePool = migrationPool ?? (await import("@workspace/db")).pool as unknown as MigrationPool;
  const client = await effectivePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:connector-foundation:v1'))");
    await client.query(CONNECTOR_FOUNDATION_MIGRATION_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export const CLAIM_CONNECTOR_JOB_SQL = String.raw`
WITH candidate AS (
  SELECT id FROM connector_jobs
  WHERE state IN ('queued','retry') AND next_attempt_at<=now() AND attempts<max_attempts
    AND (lease_expires_at IS NULL OR lease_expires_at<now())
  ORDER BY next_attempt_at,created_at
  FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE connector_jobs j SET state='leased',lease_owner=$1,lease_token=$2,
  lease_expires_at=now()+$3::interval,fencing_token=fencing_token+1,
  attempts=attempts+1,updated_at=now()
FROM candidate WHERE j.id=candidate.id
RETURNING j.*`;

export const CONNECTOR_FOUNDATION_MIGRATION_SQL = String.raw`
CREATE TABLE IF NOT EXISTS connector_credentials(
 id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),provider text NOT NULL,label text NOT NULL,state text NOT NULL DEFAULT 'pending_validation',
 secret_ciphertext text NOT NULL,secret_iv text NOT NULL,secret_tag text NOT NULL,wrapped_data_key text NOT NULL,wrap_iv text NOT NULL,wrap_tag text NOT NULL,key_version integer NOT NULL,
 created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),rotated_at timestamptz,revoked_at timestamptz,
 CONSTRAINT connector_credentials_provider_chk CHECK(provider~'^[a-z][a-z0-9_-]{1,63}$'),CONSTRAINT connector_credentials_state_chk CHECK(state IN('pending_validation','active','disabled','revoked')),CONSTRAINT connector_credentials_key_version_chk CHECK(key_version>0),CONSTRAINT connector_credentials_revocation_chk CHECK((state='revoked')=(revoked_at IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS connector_credentials_active_scope_uq ON connector_credentials(company_id,provider,label) WHERE state='active';

CREATE TABLE IF NOT EXISTS connector_jobs(
 id text PRIMARY KEY,credential_id text NOT NULL REFERENCES connector_credentials(id),company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),provider text NOT NULL,job_type text NOT NULL,state text NOT NULL DEFAULT 'queued',
 idempotency_key text NOT NULL,request_digest text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',attempts integer NOT NULL DEFAULT 0,max_attempts integer NOT NULL DEFAULT 5,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_owner text,lease_token text,lease_expires_at timestamptz,fencing_token integer NOT NULL DEFAULT 0,last_error_code text,replay_of_job_id text REFERENCES connector_jobs(id),created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,dead_lettered_at timestamptz,
 CONSTRAINT connector_jobs_id_company_project_uq UNIQUE(id,company_id,project_id),CONSTRAINT connector_jobs_idempotency_uq UNIQUE(company_id,project_id,provider,job_type,idempotency_key),CONSTRAINT connector_jobs_state_chk CHECK(state IN('queued','leased','retry','completed','dead_letter','cancelled')),CONSTRAINT connector_jobs_attempts_chk CHECK(attempts>=0 AND max_attempts>0 AND attempts<=max_attempts),CONSTRAINT connector_jobs_digest_chk CHECK(request_digest~'^[a-f0-9]{64}$'),CONSTRAINT connector_jobs_lease_chk CHECK((state='leased' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR (state<>'leased' AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)),CONSTRAINT connector_jobs_terminal_chk CHECK((state='completed')=(completed_at IS NOT NULL) AND (state='dead_letter')=(dead_lettered_at IS NOT NULL)));
CREATE INDEX IF NOT EXISTS connector_jobs_claim_idx ON connector_jobs(state,next_attempt_at,lease_expires_at);

CREATE TABLE IF NOT EXISTS connector_job_events(
 id text PRIMARY KEY,job_id text NOT NULL,company_id integer NOT NULL,project_id integer NOT NULL,sequence integer NOT NULL,event_type text NOT NULL,from_state text,to_state text NOT NULL,fencing_token integer NOT NULL,actor_type text NOT NULL,actor_id text,reason_code text NOT NULL,evidence jsonb NOT NULL DEFAULT '{}',occurred_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT connector_job_events_job_scope_fk FOREIGN KEY(job_id,company_id,project_id) REFERENCES connector_jobs(id,company_id,project_id),CONSTRAINT connector_job_events_job_sequence_uq UNIQUE(job_id,sequence),CONSTRAINT connector_job_events_sequence_chk CHECK(sequence>0),CONSTRAINT connector_job_events_fencing_chk CHECK(fencing_token>=0));

CREATE TABLE IF NOT EXISTS coordination_files(
 id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),trade_id integer REFERENCES enterprise_trades(id),category text NOT NULL,stable_key text NOT NULL,state text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),retired_at timestamptz,
 CONSTRAINT coordination_files_id_project_uq UNIQUE(id,project_id),CONSTRAINT coordination_files_project_stable_key_uq UNIQUE(project_id,stable_key),CONSTRAINT coordination_files_state_chk CHECK(state IN('active','retired')));

CREATE TABLE IF NOT EXISTS coordination_file_revisions(
 id text PRIMARY KEY,coordination_file_id text NOT NULL,project_id integer NOT NULL,revision_number integer NOT NULL,source_file_id integer REFERENCES files(id),provider text NOT NULL,provider_item_id text NOT NULL,provider_version_id text NOT NULL,content_sha256 text NOT NULL,byte_size integer NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT coordination_file_revisions_file_project_fk FOREIGN KEY(coordination_file_id,project_id) REFERENCES coordination_files(id,project_id),CONSTRAINT coordination_file_revisions_id_file_uq UNIQUE(id,coordination_file_id),CONSTRAINT coordination_file_revisions_number_uq UNIQUE(coordination_file_id,revision_number),CONSTRAINT coordination_file_revisions_provider_version_uq UNIQUE(provider,provider_item_id,provider_version_id),CONSTRAINT coordination_file_revisions_number_chk CHECK(revision_number>0),CONSTRAINT coordination_file_revisions_digest_chk CHECK(content_sha256~'^[a-f0-9]{64}$' AND byte_size>=0));
CREATE TABLE IF NOT EXISTS coordination_file_current_revisions(
 coordination_file_id text PRIMARY KEY,revision_id text NOT NULL UNIQUE,designated_by_id integer NOT NULL REFERENCES users(id),designated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT coordination_file_current_revision_fk FOREIGN KEY(revision_id,coordination_file_id) REFERENCES coordination_file_revisions(id,coordination_file_id));

CREATE TABLE IF NOT EXISTS sharepoint_project_mappings(
 id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),credential_id text NOT NULL REFERENCES connector_credentials(id),site_id text NOT NULL,library_id text NOT NULL,state text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sharepoint_project_mappings_project_uq UNIQUE(project_id),CONSTRAINT sharepoint_project_mappings_scope_uq UNIQUE(id,company_id,project_id),CONSTRAINT sharepoint_project_mappings_state_chk CHECK(state IN('active','disabled','mismatch')));

CREATE TABLE IF NOT EXISTS sharepoint_folder_mappings(
 id text PRIMARY KEY,project_mapping_id text NOT NULL,company_id integer NOT NULL,project_id integer NOT NULL,trade_id integer REFERENCES enterprise_trades(id),category text NOT NULL,folder_id text NOT NULL,folder_path text NOT NULL,state text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sharepoint_folder_mappings_project_scope_fk FOREIGN KEY(project_mapping_id,company_id,project_id) REFERENCES sharepoint_project_mappings(id,company_id,project_id),CONSTRAINT sharepoint_folder_mappings_category_trade_uq UNIQUE NULLS NOT DISTINCT(project_mapping_id,category,trade_id),CONSTRAINT sharepoint_folder_mappings_state_chk CHECK(state IN('active','disabled','mismatch')));

CREATE TABLE IF NOT EXISTS sharepoint_sync_states(
 id text PRIMARY KEY,folder_mapping_id text NOT NULL UNIQUE REFERENCES sharepoint_folder_mappings(id),sync_status text NOT NULL DEFAULT 'never_synced',cursor_ciphertext text,cursor_iv text,cursor_tag text,wrapped_data_key text,wrap_iv text,wrap_tag text,key_version integer,last_sync_at timestamptz,mismatch_code text,updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT sharepoint_sync_states_status_chk CHECK(sync_status IN('never_synced','queued','syncing','current','retry','mismatch','disabled')),CONSTRAINT sharepoint_sync_states_cursor_envelope_chk CHECK((cursor_ciphertext IS NULL AND cursor_iv IS NULL AND cursor_tag IS NULL AND wrapped_data_key IS NULL AND wrap_iv IS NULL AND wrap_tag IS NULL AND key_version IS NULL) OR (cursor_ciphertext IS NOT NULL AND cursor_iv IS NOT NULL AND cursor_tag IS NOT NULL AND wrapped_data_key IS NOT NULL AND wrap_iv IS NOT NULL AND wrap_tag IS NOT NULL AND key_version>0)),CONSTRAINT sharepoint_sync_states_mismatch_chk CHECK((sync_status='mismatch')=(mismatch_code IS NOT NULL)));

CREATE OR REPLACE FUNCTION bimlog_reject_immutable_connector_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable connector evidence cannot be updated or deleted'; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='connector_job_events_immutable') THEN CREATE TRIGGER connector_job_events_immutable BEFORE UPDATE OR DELETE ON connector_job_events FOR EACH ROW EXECUTE FUNCTION bimlog_reject_immutable_connector_update(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='coordination_file_revisions_immutable') THEN CREATE TRIGGER coordination_file_revisions_immutable BEFORE UPDATE OR DELETE ON coordination_file_revisions FOR EACH ROW EXECUTE FUNCTION bimlog_reject_immutable_connector_update(); END IF; END $$;
`;
