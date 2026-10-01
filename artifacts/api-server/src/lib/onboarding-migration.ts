import { pool } from "@workspace/db";

let migration: Promise<void> | null = null;

export function startOnboardingMigration() {
  if (!migration) migration = ensureOnboardingSchema();
  return migration;
}

export async function waitForOnboardingMigration() {
  await startOnboardingMigration();
}

export async function ensureOnboardingSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:onboarding-schema-v1'))");
    await client.query(`
CREATE TABLE IF NOT EXISTS user_onboarding_profiles (
  user_id integer PRIMARY KEY REFERENCES users(id),
  company_id integer NOT NULL REFERENCES companies(id),
  email_verified_at timestamptz,
  work_profile text,
  preferred_disciplines jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_document_types jsonb NOT NULL DEFAULT '["Shop Drawings"]'::jsonb,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_onboarding_work_profile_chk CHECK (work_profile IS NULL OR work_profile IN ('bim_coordinator','project_admin','document_controller','designer','field_team','executive'))
);
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens(user_id,created_at DESC);
`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
