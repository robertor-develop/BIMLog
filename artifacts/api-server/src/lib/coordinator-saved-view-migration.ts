import { pool } from "@workspace/db";

export async function ensureCoordinatorSavedViewSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coordinator_saved_views (
      id text PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id),
      user_id integer NOT NULL REFERENCES users(id),
      name text NOT NULL,
      normalized_name text NOT NULL,
      configuration jsonb NOT NULL,
      configuration_fingerprint text NOT NULL,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT coordinator_saved_views_name_length_chk CHECK (char_length(name) BETWEEN 1 AND 64),
      CONSTRAINT coordinator_saved_views_normalized_name_length_chk CHECK (char_length(normalized_name) BETWEEN 1 AND 64),
      CONSTRAINT coordinator_saved_views_configuration_size_chk CHECK (octet_length(configuration::text) <= 4096)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_saved_views_identity_uidx
      ON coordinator_saved_views(id,project_id,user_id);
    CREATE INDEX IF NOT EXISTS coordinator_saved_views_owner_project_idx
      ON coordinator_saved_views(user_id,project_id,updated_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_saved_views_active_name_uidx
      ON coordinator_saved_views(user_id,project_id,normalized_name) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_saved_views_active_config_uidx
      ON coordinator_saved_views(user_id,project_id,configuration_fingerprint) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_saved_views_default_uidx
      ON coordinator_saved_views(user_id,project_id) WHERE deleted_at IS NULL AND is_default=true;

    CREATE TABLE IF NOT EXISTS coordinator_saved_view_operations (
      id text PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id),
      user_id integer NOT NULL REFERENCES users(id),
      saved_view_id text REFERENCES coordinator_saved_views(id),
      operation text NOT NULL,
      idempotency_key text NOT NULL,
      request_fingerprint text NOT NULL,
      result_version integer NOT NULL CHECK (result_version > 0),
      result_state text NOT NULL,
      result_snapshot jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT coordinator_saved_view_operation_chk CHECK (operation IN ('create','update','delete')),
      CONSTRAINT coordinator_saved_view_operation_state_chk CHECK (result_state IN ('active','deleted')),
      CONSTRAINT coordinator_saved_view_operation_key_length_chk CHECK (char_length(idempotency_key) BETWEEN 8 AND 100)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS coordinator_saved_view_operations_idempotency_uidx
      ON coordinator_saved_view_operations(user_id,project_id,idempotency_key);
    CREATE INDEX IF NOT EXISTS coordinator_saved_view_operations_view_idx
      ON coordinator_saved_view_operations(saved_view_id,created_at DESC);
  `);
}

let startup: Promise<void> | null = null;
export function startCoordinatorSavedViewMigration(): Promise<void> {
  startup ??= ensureCoordinatorSavedViewSchema();
  return startup;
}

export async function waitForCoordinatorSavedViewMigration(): Promise<void> {
  if (!startup) await startCoordinatorSavedViewMigration();
  else await startup;
}
