import { pool } from "@workspace/db";

export async function ensureCoordinatorBulkActionSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coordinator_bulk_meeting_operations (
      id text PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id),
      user_id integer NOT NULL REFERENCES users(id),
      meeting_id integer NOT NULL REFERENCES meeting_minutes(id),
      idempotency_key text NOT NULL,
      request_fingerprint text NOT NULL,
      result_snapshot jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT coordinator_bulk_meeting_operation_key_length_chk
        CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
      CONSTRAINT coordinator_bulk_meeting_operation_result_size_chk
        CHECK (octet_length(result_snapshot::text) <= 65536)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_bulk_meeting_operations_idempotency_uidx
      ON coordinator_bulk_meeting_operations(user_id,project_id,idempotency_key);
    CREATE INDEX IF NOT EXISTS coordinator_bulk_meeting_operations_project_meeting_idx
      ON coordinator_bulk_meeting_operations(project_id,meeting_id,created_at DESC);
  `);
}

let startup: Promise<void> | null = null;

export function startCoordinatorBulkActionMigration(): Promise<void> {
  startup ??= ensureCoordinatorBulkActionSchema();
  return startup;
}

export async function waitForCoordinatorBulkActionMigration(): Promise<void> {
  if (!startup) await startCoordinatorBulkActionMigration();
  else await startup;
}
