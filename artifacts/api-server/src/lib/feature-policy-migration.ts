import { pool } from "@workspace/db";
import { startFeatureCatalogMigration } from "./feature-catalog-migration";

export async function ensureFeaturePolicySchema(): Promise<void> {
  await startFeatureCatalogMigration();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_policy_authority_grants (
      id text PRIMARY KEY, company_id integer NOT NULL, user_id integer NOT NULL,
      effective_from timestamptz NOT NULL, effective_to timestamptz, granted_by_id integer NOT NULL,
      reason_code text NOT NULL, explanation_en text NOT NULL, explanation_es text NOT NULL,
      audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT company_policy_grant_dates_chk CHECK(effective_to IS NULL OR effective_to>effective_from)
    );
    CREATE INDEX IF NOT EXISTS company_policy_grants_effective_idx ON company_policy_authority_grants(company_id,user_id,effective_from,effective_to);
    CREATE TABLE IF NOT EXISTS company_policy_authority_revocations (
      id text PRIMARY KEY, grant_id text NOT NULL UNIQUE REFERENCES company_policy_authority_grants(id),
      revoked_by_id integer NOT NULL, reason_code text NOT NULL,
      explanation_en text NOT NULL, explanation_es text NOT NULL, audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS project_company_binding_versions (
      id text PRIMARY KEY, project_id integer NOT NULL, company_id integer NOT NULL,
      version integer NOT NULL CHECK(version>0), bound_by_id integer NOT NULL, reason_code text NOT NULL,
      explanation_en text NOT NULL, explanation_es text NOT NULL, supersedes_binding_id text REFERENCES project_company_binding_versions(id),
      audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS project_company_binding_version_uidx ON project_company_binding_versions(project_id,version);
    CREATE INDEX IF NOT EXISTS project_company_binding_company_idx ON project_company_binding_versions(company_id,project_id,version DESC);

    CREATE TABLE IF NOT EXISTS feature_policy_versions (
      id text PRIMARY KEY, scope_type text NOT NULL, feature_key text NOT NULL,
      company_id integer NOT NULL, project_id integer, user_id integer,
      decision text NOT NULL, configuration jsonb NOT NULL DEFAULT '{}'::jsonb, version integer NOT NULL CHECK(version>0),
      effective_from timestamptz NOT NULL, effective_to timestamptz, actor_user_id integer NOT NULL,
      reason_code text NOT NULL, explanation_en text NOT NULL, explanation_es text NOT NULL,
      supersedes_version_id text REFERENCES feature_policy_versions(id), audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT feature_policy_scope_chk CHECK(
        (scope_type='company' AND project_id IS NULL AND user_id IS NULL) OR
        (scope_type='project' AND project_id IS NOT NULL AND user_id IS NULL) OR
        (scope_type='user' AND project_id IS NULL AND user_id IS NOT NULL)
      ),
      CONSTRAINT feature_policy_decision_chk CHECK(decision IN ('enabled','disabled','inherit')),
      CONSTRAINT feature_policy_dates_chk CHECK(effective_to IS NULL OR effective_to>effective_from)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS feature_policy_company_version_uidx ON feature_policy_versions(company_id,feature_key,version) WHERE scope_type='company';
    CREATE UNIQUE INDEX IF NOT EXISTS feature_policy_project_version_uidx ON feature_policy_versions(project_id,feature_key,version) WHERE scope_type='project';
    CREATE UNIQUE INDEX IF NOT EXISTS feature_policy_user_version_uidx ON feature_policy_versions(user_id,feature_key,version) WHERE scope_type='user';
    CREATE INDEX IF NOT EXISTS feature_policy_effective_idx ON feature_policy_versions(scope_type,company_id,project_id,user_id,feature_key,effective_from,effective_to,version);

    CREATE TABLE IF NOT EXISTS feature_policy_audit (
      id text PRIMARY KEY, policy_version_id text NOT NULL UNIQUE REFERENCES feature_policy_versions(id),
      scope_type text NOT NULL, feature_key text NOT NULL, version integer NOT NULL, actor_user_id integer NOT NULL,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS feature_policy_audit_scope_idx ON feature_policy_audit(scope_type,feature_key,created_at);

    CREATE OR REPLACE FUNCTION bimlog_policy_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'feature policy journals are append-only'; END $$;
    CREATE OR REPLACE FUNCTION bimlog_feature_policy_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO feature_policy_audit(id,policy_version_id,scope_type,feature_key,version,actor_user_id,evidence,created_at)
      VALUES('audit:'||NEW.id,NEW.id,NEW.scope_type,NEW.feature_key,NEW.version,NEW.actor_user_id,
        jsonb_build_object('decision',NEW.decision,'reason_code',NEW.reason_code,'source',COALESCE(NEW.audit_evidence->>'source','policy_api')),NEW.created_at);
      RETURN NEW;
    END $$;
    DO $policy_triggers$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_policy_versions_append_only_trigger') THEN
        CREATE TRIGGER feature_policy_versions_append_only_trigger BEFORE UPDATE OR DELETE ON feature_policy_versions FOR EACH ROW EXECUTE FUNCTION bimlog_policy_append_only();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_policy_audit_append_only_trigger') THEN
        CREATE TRIGGER feature_policy_audit_append_only_trigger BEFORE UPDATE OR DELETE ON feature_policy_audit FOR EACH ROW EXECUTE FUNCTION bimlog_policy_append_only();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='company_policy_grants_append_only_trigger') THEN
        CREATE TRIGGER company_policy_grants_append_only_trigger BEFORE UPDATE OR DELETE ON company_policy_authority_grants FOR EACH ROW EXECUTE FUNCTION bimlog_policy_append_only();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='company_policy_revocations_append_only_trigger') THEN
        CREATE TRIGGER company_policy_revocations_append_only_trigger BEFORE UPDATE OR DELETE ON company_policy_authority_revocations FOR EACH ROW EXECUTE FUNCTION bimlog_policy_append_only();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='project_company_bindings_append_only_trigger') THEN
        CREATE TRIGGER project_company_bindings_append_only_trigger BEFORE UPDATE OR DELETE ON project_company_binding_versions FOR EACH ROW EXECUTE FUNCTION bimlog_policy_append_only();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='feature_policy_audit_insert_trigger') THEN
        CREATE TRIGGER feature_policy_audit_insert_trigger AFTER INSERT ON feature_policy_versions FOR EACH ROW EXECUTE FUNCTION bimlog_feature_policy_audit_insert();
      END IF;
    END $policy_triggers$;
  `);
}

let startup: Promise<void> | null = null;
export function startFeaturePolicyMigration(): Promise<void> { startup ??= ensureFeaturePolicySchema(); return startup; }
export async function waitForFeaturePolicyMigration(): Promise<void> {
  if (!startup) await startFeaturePolicyMigration();
  else await startup;
}
