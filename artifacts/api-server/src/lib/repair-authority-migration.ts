import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;
export function ensureRepairAuthoritySchema() {
  return ready ??= pool.query(`
    CREATE TABLE IF NOT EXISTS platform_repair_delegates (
      company_id integer NOT NULL, user_id integer NOT NULL REFERENCES users(id), granted_by_id integer NOT NULL REFERENCES users(id),
      active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS platform_repair_pins (
      user_id integer PRIMARY KEY REFERENCES users(id), salt text NOT NULL, digest text NOT NULL, attempts integer NOT NULL DEFAULT 0,
      window_until timestamptz, version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS platform_repair_proposals (
      id uuid PRIMARY KEY, company_id integer NOT NULL, project_id integer, reporter_id integer NOT NULL REFERENCES users(id),
      payload jsonb NOT NULL, scope_digest text NOT NULL, state text NOT NULL CHECK(state IN ('reported','proposed','authorized','implementing','testing','deployed','verified','failed','revoked')),
      created_at timestamptz NOT NULL DEFAULT now(), approved_by_id integer REFERENCES users(id), expires_at timestamptz, execution_receipt jsonb
    );
    CREATE INDEX IF NOT EXISTS platform_repair_proposals_company_created_idx ON platform_repair_proposals(company_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS platform_repair_events (
      id uuid PRIMARY KEY, company_id integer NOT NULL, actor_id integer NOT NULL REFERENCES users(id), proposal_id uuid,
      action text NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
  `).then(() => undefined);
}
