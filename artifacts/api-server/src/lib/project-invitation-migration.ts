import { pool } from "@workspace/db";

let migration: Promise<void> | null = null;

export function startProjectInvitationMigration() {
  if (!migration) migration = ensureProjectInvitationSchema();
  return migration;
}

export async function waitForProjectInvitationMigration() {
  await startProjectInvitationMigration();
}

export async function ensureProjectInvitationSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:project-invitation-schema'))");
    await client.query(`
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS company_id integer REFERENCES companies(id);
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'legacy';
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS accepted_by_user_id integer;
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_sent';
CREATE UNIQUE INDEX IF NOT EXISTS project_invitation_token_hash_idx ON project_invitations(token_hash);
UPDATE project_invitations invitation
   SET company_id = inviter.company_id
  FROM users inviter
 WHERE invitation.company_id IS NULL
   AND inviter.id = invitation.invited_by_user_id;
CREATE INDEX IF NOT EXISTS project_invitation_email_status_idx ON project_invitations(email,status);
CREATE INDEX IF NOT EXISTS project_invitation_project_status_idx ON project_invitations(project_id,status);
`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
