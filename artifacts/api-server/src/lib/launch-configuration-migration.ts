export const LAUNCH_CONFIGURATION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS launch_configurations (
  id text PRIMARY KEY, environment text NOT NULL UNIQUE CHECK (environment IN ('development','staging','production')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','validated','active','inactive')),
  configuration jsonb NOT NULL, readiness jsonb NOT NULL,
  created_by_user_id integer NOT NULL REFERENCES users(id), updated_by_user_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS launch_configuration_versions (
  id text PRIMARY KEY, configuration_id text NOT NULL REFERENCES launch_configurations(id), environment text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), state text NOT NULL, configuration jsonb NOT NULL, readiness jsonb NOT NULL,
  reason text NOT NULL, actor_user_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(configuration_id, revision)
);
CREATE TABLE IF NOT EXISTS launch_configuration_audit (
  id text PRIMARY KEY, configuration_id text NOT NULL REFERENCES launch_configurations(id), environment text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), action text NOT NULL CHECK (action IN ('created','updated','activated','deactivated','restored')),
  actor_user_id integer NOT NULL REFERENCES users(id), reason text NOT NULL, fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launch_configuration_audit_time_idx ON launch_configuration_audit(environment, created_at DESC);
CREATE TABLE IF NOT EXISTS launch_email_verification_audit (
  id text PRIMARY KEY, configuration_id text NOT NULL REFERENCES launch_configurations(id), environment text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0), provider text NOT NULL CHECK (provider IN ('smtp','sendgrid')),
  action text NOT NULL CHECK (action IN ('verify','send_test')), status text NOT NULL CHECK (status IN ('verified','sent','rejected','unavailable')),
  result_code text NOT NULL, actor_user_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launch_email_verification_audit_time_idx ON launch_email_verification_audit(environment, created_at DESC);
`;

type MigrationPool = { query(sql: string): Promise<unknown> };
let startup: Promise<void> | undefined;
export function ensureLaunchConfigurationSchema(pool: MigrationPool): Promise<void> {
  return startup ??= pool.query(LAUNCH_CONFIGURATION_SCHEMA_SQL).then(() => undefined);
}
