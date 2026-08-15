import { pool } from "@workspace/db";

let migration: Promise<void> | null = null;
export function startTeamResourcePlanningMigration() { if (!migration) migration = ensureTeamResourcePlanningSchema(); return migration; }
export async function waitForTeamResourcePlanningMigration() { await startTeamResourcePlanningMigration(); }

export async function ensureTeamResourcePlanningSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:team-resource-planning-schema'))");
    await client.query(`
CREATE TABLE IF NOT EXISTS team_capacity_profile_versions(
 id text PRIMARY KEY, company_id integer NOT NULL, user_id integer NOT NULL, version integer NOT NULL,
 content jsonb NOT NULL, content_fingerprint text NOT NULL, supersedes_id text, created_by_id integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT team_capacity_profile_versions_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id),
 CONSTRAINT team_capacity_profile_versions_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id),
 CONSTRAINT team_capacity_profile_versions_supersedes_id_fkey FOREIGN KEY(supersedes_id) REFERENCES team_capacity_profile_versions(id),
 CONSTRAINT team_capacity_profile_versions_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users(id),
 CONSTRAINT team_capacity_profile_version_positive_chk CHECK(version>0), CONSTRAINT team_capacity_profile_content_object_chk CHECK(jsonb_typeof(content)='object')
);
CREATE UNIQUE INDEX IF NOT EXISTS team_capacity_profile_user_version_uidx ON team_capacity_profile_versions(company_id,user_id,version);
CREATE INDEX IF NOT EXISTS team_capacity_profile_latest_idx ON team_capacity_profile_versions(company_id,user_id,version DESC);
CREATE TABLE IF NOT EXISTS team_staffing_scenario_versions(
 id text PRIMARY KEY, scenario_key text NOT NULL, company_id integer NOT NULL, project_id integer NOT NULL, version integer NOT NULL,
 content jsonb NOT NULL, evaluation jsonb NOT NULL, content_fingerprint text NOT NULL, supersedes_id text, created_by_id integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT team_staffing_scenario_versions_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id),
 CONSTRAINT team_staffing_scenario_versions_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects(id),
 CONSTRAINT team_staffing_scenario_versions_supersedes_id_fkey FOREIGN KEY(supersedes_id) REFERENCES team_staffing_scenario_versions(id),
 CONSTRAINT team_staffing_scenario_versions_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users(id),
 CONSTRAINT team_staffing_scenario_version_positive_chk CHECK(version>0), CONSTRAINT team_staffing_scenario_content_object_chk CHECK(jsonb_typeof(content)='object'), CONSTRAINT team_staffing_scenario_evaluation_object_chk CHECK(jsonb_typeof(evaluation)='object')
);
CREATE UNIQUE INDEX IF NOT EXISTS team_staffing_scenario_key_version_uidx ON team_staffing_scenario_versions(scenario_key,version);
CREATE INDEX IF NOT EXISTS team_staffing_scenario_project_latest_idx ON team_staffing_scenario_versions(project_id,created_at DESC);
CREATE TABLE IF NOT EXISTS team_staffing_application_events(
 id text PRIMARY KEY, event_key text NOT NULL, scenario_version_id text NOT NULL, project_id integer NOT NULL, actor_user_id integer NOT NULL,
 reason text NOT NULL, result jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT team_staffing_application_events_scenario_version_id_fkey FOREIGN KEY(scenario_version_id) REFERENCES team_staffing_scenario_versions(id),
 CONSTRAINT team_staffing_application_events_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects(id),
 CONSTRAINT team_staffing_application_events_actor_user_id_fkey FOREIGN KEY(actor_user_id) REFERENCES users(id),
 CONSTRAINT team_staffing_application_reason_chk CHECK(length(reason) BETWEEN 10 AND 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_staffing_application_events_event_key_key ON team_staffing_application_events(event_key);
CREATE INDEX IF NOT EXISTS team_staffing_application_project_time_idx ON team_staffing_application_events(project_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS team_resource_mutation_rate_limits(
 bucket_key text PRIMARY KEY, window_started_at timestamptz NOT NULL, request_count integer NOT NULL, expires_at timestamptz NOT NULL,
 CONSTRAINT team_resource_mutation_rate_limit_count_chk CHECK(request_count>0)
);
CREATE INDEX IF NOT EXISTS team_resource_mutation_rate_limit_expiry_idx ON team_resource_mutation_rate_limits(expires_at);
`);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
