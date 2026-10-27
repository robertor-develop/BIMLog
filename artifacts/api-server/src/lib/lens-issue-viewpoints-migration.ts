import { pool } from "@workspace/db";

export const LENS_ISSUE_VIEWPOINTS_SQL = String.raw`
CREATE TABLE IF NOT EXISTS lens_issue_viewpoints (
  id text PRIMARY KEY,
  issue_id integer NOT NULL REFERENCES lens_viewpoints(id),
  idempotency_key text NOT NULL,
  project_id integer NOT NULL,
  model_fingerprint text,
  name text NOT NULL,
  viewpoint_type text NOT NULL DEFAULT 'coordination' CHECK (viewpoint_type IN ('coordination','detail','context','verification')),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','archived')),
  navisworks_guid text,
  screenshot_url text,
  visual_state_json text,
  visual_state_digest text,
  captured_by_user_id integer REFERENCES users(id),
  captured_at timestamptz NOT NULL DEFAULT now(),
  renamed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lens_issue_viewpoints_archive_chk CHECK ((lifecycle_status='archived')=(archived_at IS NOT NULL))
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoints_viewpoint_type_check' AND conrelid='lens_issue_viewpoints'::regclass) THEN
    ALTER TABLE lens_issue_viewpoints ADD CONSTRAINT lens_issue_viewpoints_viewpoint_type_check CHECK (viewpoint_type IN ('coordination','detail','context','verification'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoints_display_order_check' AND conrelid='lens_issue_viewpoints'::regclass) THEN
    ALTER TABLE lens_issue_viewpoints ADD CONSTRAINT lens_issue_viewpoints_display_order_check CHECK (display_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoints_lifecycle_status_check' AND conrelid='lens_issue_viewpoints'::regclass) THEN
    ALTER TABLE lens_issue_viewpoints ADD CONSTRAINT lens_issue_viewpoints_lifecycle_status_check CHECK (lifecycle_status IN ('active','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoints_archive_chk' AND conrelid='lens_issue_viewpoints'::regclass) THEN
    ALTER TABLE lens_issue_viewpoints ADD CONSTRAINT lens_issue_viewpoints_archive_chk CHECK ((lifecycle_status='archived')=(archived_at IS NOT NULL));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS lens_issue_viewpoints_primary_active_uq
  ON lens_issue_viewpoints(issue_id) WHERE is_primary AND lifecycle_status='active';
CREATE UNIQUE INDEX IF NOT EXISTS lens_issue_viewpoints_issue_guid_active_uq
  ON lens_issue_viewpoints(issue_id,navisworks_guid) WHERE navisworks_guid IS NOT NULL AND lifecycle_status='active';
CREATE INDEX IF NOT EXISTS lens_issue_viewpoints_order_idx
  ON lens_issue_viewpoints(issue_id,lifecycle_status,display_order,id);

CREATE TABLE IF NOT EXISTS lens_issue_viewpoint_revisions (
  id text PRIMARY KEY,
  issue_viewpoint_id text NOT NULL REFERENCES lens_issue_viewpoints(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  action text NOT NULL CHECK (action IN ('captured','renamed','reordered','made_primary','archived','restored','opened')),
  name text NOT NULL,
  display_order integer NOT NULL CHECK (display_order >= 0),
  is_primary boolean NOT NULL,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('active','archived')),
  model_fingerprint text,
  navisworks_guid text,
  screenshot_url text,
  visual_state_json text,
  visual_state_digest text,
  actor_user_id integer REFERENCES users(id),
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lens_issue_viewpoint_revisions_number_uq UNIQUE(issue_viewpoint_id,revision_number)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoint_revisions_revision_number_check' AND conrelid='lens_issue_viewpoint_revisions'::regclass) THEN
    ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_revision_number_check CHECK (revision_number > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoint_revisions_action_check' AND conrelid='lens_issue_viewpoint_revisions'::regclass) THEN
    ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_action_check CHECK (action IN ('captured','renamed','reordered','made_primary','archived','restored','opened'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoint_revisions_display_order_check' AND conrelid='lens_issue_viewpoint_revisions'::regclass) THEN
    ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_display_order_check CHECK (display_order >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoint_revisions_lifecycle_status_check' AND conrelid='lens_issue_viewpoint_revisions'::regclass) THEN
    ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_lifecycle_status_check CHECK (lifecycle_status IN ('active','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lens_issue_viewpoint_revisions_number_uq' AND conrelid='lens_issue_viewpoint_revisions'::regclass) THEN
    IF to_regclass('lens_issue_viewpoint_revisions_number_uq') IS NOT NULL THEN
      ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_number_uq UNIQUE USING INDEX lens_issue_viewpoint_revisions_number_uq;
    ELSE
      ALTER TABLE lens_issue_viewpoint_revisions ADD CONSTRAINT lens_issue_viewpoint_revisions_number_uq UNIQUE(issue_viewpoint_id,revision_number);
    END IF;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS lens_issue_viewpoint_revisions_history_idx
  ON lens_issue_viewpoint_revisions(issue_viewpoint_id,revision_number DESC);

INSERT INTO lens_issue_viewpoints (
  id,issue_id,idempotency_key,project_id,name,viewpoint_type,display_order,is_primary,lifecycle_status,
  navisworks_guid,screenshot_url,visual_state_json,visual_state_digest,captured_at,created_at,updated_at
)
SELECT
  'legacy-primary-' || issue.id::text,issue.id,'legacy-primary-' || issue.id::text,issue.project_id,
  COALESCE(NULLIF(issue.display_id,''),NULLIF(issue.viewpoint_id,''),'Primary viewpoint'),
  'coordination',0,true,'active',issue.navisworks_guid,issue.screenshot_url,
  issue.visual_state_json,issue.visual_state_digest,
  COALESCE(issue.captured_at,issue.created_at,now()),COALESCE(issue.created_at,now()),COALESCE(issue.updated_at,now())
FROM lens_viewpoints issue
WHERE NOT EXISTS (SELECT 1 FROM lens_issue_viewpoints existing WHERE existing.issue_id=issue.id);

CREATE UNIQUE INDEX IF NOT EXISTS lens_issue_viewpoints_idempotency_uq
  ON lens_issue_viewpoints(issue_id,idempotency_key);

INSERT INTO lens_issue_viewpoint_revisions (
  id,issue_viewpoint_id,revision_number,action,name,display_order,is_primary,lifecycle_status,
  model_fingerprint,navisworks_guid,screenshot_url,visual_state_json,visual_state_digest,occurred_at
)
SELECT
  'legacy-primary-' || issue.id::text || '-r1',viewpoint.id,1,'captured',viewpoint.name,
  viewpoint.display_order,viewpoint.is_primary,viewpoint.lifecycle_status,viewpoint.model_fingerprint,
  viewpoint.navisworks_guid,viewpoint.screenshot_url,viewpoint.visual_state_json,
  viewpoint.visual_state_digest,viewpoint.captured_at
FROM lens_issue_viewpoints viewpoint
JOIN lens_viewpoints issue ON issue.id=viewpoint.issue_id
WHERE viewpoint.id='legacy-primary-' || issue.id::text
  AND NOT EXISTS (SELECT 1 FROM lens_issue_viewpoint_revisions revision WHERE revision.issue_viewpoint_id=viewpoint.id);
`;

type MigrationClient = { query(sql: string): Promise<unknown>; release(): void };
export type LensIssueViewpointsMigrationPool = { connect(): Promise<MigrationClient> };
let startup: Promise<void> | null = null;

export function ensureLensIssueViewpointsSchema(migrationPool?: LensIssueViewpointsMigrationPool): Promise<void> {
  if (migrationPool) return runMigration(migrationPool);
  startup ??= runMigration(pool);
  return startup;
}

async function runMigration(migrationPool: LensIssueViewpointsMigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:lens-issue-viewpoints:v1'))");
    await client.query(LENS_ISSUE_VIEWPOINTS_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
