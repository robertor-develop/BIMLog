import { pool } from "@workspace/db";

export async function ensureLivingBriefMirrorSchema(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS living_brief_documents (
    document_key text PRIMARY KEY,
    content text NOT NULL,
    deployed_source_commit text NOT NULL,
    reconciled_through_commit text NOT NULL,
    source_sha256 text NOT NULL,
    source_changed_at timestamptz NOT NULL,
    mirror_synced_at timestamptz NOT NULL DEFAULT now(),
    synchronization_result text NOT NULL,
    mismatch_detected_at timestamptz,
    version bigint NOT NULL DEFAULT 1,
    CONSTRAINT living_brief_documents_sha256_format CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT living_brief_documents_sync_result CHECK (synchronization_result IN ('current','stale','mismatch','missing'))
  )`);
}

export async function ensureLivingBriefGateSchema(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS living_brief_gate_credentials (
    credential_key text PRIMARY KEY,
    password_hash text NOT NULL,
    version bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id integer,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by_user_id integer,
    session_invalidated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT living_brief_gate_key CHECK (credential_key = 'primary'),
    CONSTRAINT living_brief_gate_hash_not_default CHECK (password_hash <> 'BIMAI360')
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS living_brief_gate_audit (
    id serial PRIMARY KEY,
    action text NOT NULL,
    actor_user_id integer NOT NULL,
    actor_email text NOT NULL,
    reason text NOT NULL,
    credential_version bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT living_brief_gate_audit_action CHECK (action IN ('legacy_migrated','bootstrap','reset'))
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS living_brief_gate_audit_created_idx ON living_brief_gate_audit (created_at DESC)`);
  await pool.query(`WITH migrated AS (
      INSERT INTO living_brief_gate_credentials (credential_key, password_hash, version, created_at, updated_at, session_invalidated_at)
      SELECT 'primary', value, 1, now(), now(), now()
      FROM platform_settings
      WHERE key = 'living_brief_password_hash'
      ON CONFLICT (credential_key) DO NOTHING
      RETURNING version
    )
    INSERT INTO living_brief_gate_audit (action, actor_user_id, actor_email, reason, credential_version)
    SELECT 'legacy_migrated', 0, 'system', 'Migrated existing Living Brief gate hash from legacy platform_settings without reseeding or overwriting.', version
    FROM migrated`);
}
