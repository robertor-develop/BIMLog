import { pool } from "@workspace/db";

export async function ensureAiControlPlaneSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_ai_administrators (
      id text PRIMARY KEY, company_id integer NOT NULL REFERENCES companies(id), user_id integer NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'active',
      granted_by_id integer NOT NULL REFERENCES users(id), granted_at timestamptz NOT NULL DEFAULT now(), revoked_by_id integer REFERENCES users(id), revoked_at timestamptz, audit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT company_ai_administrators_status_chk CHECK(status IN ('active','revoked'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS company_ai_administrators_active_uidx ON company_ai_administrators(company_id,user_id) WHERE status='active';
    CREATE INDEX IF NOT EXISTS company_ai_administrators_user_idx ON company_ai_administrators(user_id,status);

    CREATE TABLE IF NOT EXISTS provider_connections (
      id text PRIMARY KEY, owner_type text NOT NULL, user_id integer REFERENCES users(id), company_id integer REFERENCES companies(id), provider text NOT NULL, status text NOT NULL DEFAULT 'pending_validation', label text NOT NULL, allowed_models jsonb NOT NULL DEFAULT '[]'::jsonb,
      secret_ciphertext text, secret_iv text, secret_tag text, wrapped_data_key text, wrap_iv text, wrap_tag text, key_version text NOT NULL, validated_at timestamptz, rotated_at timestamptz, revoked_at timestamptz, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT provider_connections_owner_chk CHECK((owner_type='personal' AND user_id IS NOT NULL AND company_id IS NOT NULL) OR (owner_type='company' AND user_id IS NULL AND company_id IS NOT NULL) OR (owner_type='system' AND user_id IS NULL AND company_id IS NULL)),
      CONSTRAINT provider_connections_provider_chk CHECK(provider IN ('openai','anthropic')), CONSTRAINT provider_connections_status_chk CHECK(status IN ('pending_validation','active','disabled','revoked'))
    );
    UPDATE provider_connections SET status='disabled', updated_at=now()
    WHERE id IN (
      SELECT id FROM (
        SELECT id,row_number() OVER (PARTITION BY owner_type,COALESCE(user_id,0),COALESCE(company_id,0),provider ORDER BY updated_at DESC,created_at DESC,id DESC) rn
        FROM provider_connections WHERE status='active'
      ) duplicates WHERE rn>1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_active_personal_uidx ON provider_connections(user_id,provider) WHERE owner_type='personal' AND status='active';
    CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_active_company_uidx ON provider_connections(company_id,provider) WHERE owner_type='company' AND status='active';
    CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_active_system_uidx ON provider_connections(provider) WHERE owner_type='system' AND status='active';

    CREATE TABLE IF NOT EXISTS company_ai_budgets (
      id text PRIMARY KEY, funding_owner_type text NOT NULL, company_id integer REFERENCES companies(id), owner_user_id integer REFERENCES users(id), version integer NOT NULL, currency text NOT NULL,
      limit_micros numeric(30,0) NOT NULL CHECK(limit_micros>=0), reserved_micros numeric(30,0) NOT NULL DEFAULT 0 CHECK(reserved_micros>=0), settled_micros numeric(30,0) NOT NULL DEFAULT 0,
      per_request_limit_micros numeric(30,0) NOT NULL, daily_limit_micros numeric(30,0) NOT NULL, monthly_limit_micros numeric(30,0) NOT NULL, session_limit_micros numeric(30,0) NOT NULL,
      provider_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb, model_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb, capability_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'active', effective_from timestamptz NOT NULL, effective_to timestamptz, supersedes_id text, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT company_ai_budgets_owner_chk CHECK((funding_owner_type='personal' AND owner_user_id IS NOT NULL AND company_id IS NOT NULL) OR (funding_owner_type='company' AND owner_user_id IS NULL AND company_id IS NOT NULL) OR (funding_owner_type='system' AND owner_user_id IS NULL AND company_id IS NULL)),
      CONSTRAINT company_ai_budgets_status_chk CHECK(status IN ('active','disabled','superseded')), CONSTRAINT company_ai_budgets_currency_chk CHECK(currency ~ '^[A-Z]{3}$')
    );
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS funding_owner_type text;
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS owner_user_id integer REFERENCES users(id);
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS daily_limit_micros numeric(30,0);
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS monthly_limit_micros numeric(30,0);
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS session_limit_micros numeric(30,0);
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS capability_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE company_ai_budgets ADD COLUMN IF NOT EXISTS supersedes_id text;
    ALTER TABLE company_ai_budgets ALTER COLUMN company_id DROP NOT NULL;
    UPDATE company_ai_budgets SET funding_owner_type=COALESCE(funding_owner_type,'company'), daily_limit_micros=COALESCE(daily_limit_micros,limit_micros), monthly_limit_micros=COALESCE(monthly_limit_micros,limit_micros), session_limit_micros=COALESCE(session_limit_micros,per_request_limit_micros,limit_micros), per_request_limit_micros=COALESCE(per_request_limit_micros,limit_micros);
    ALTER TABLE company_ai_budgets ALTER COLUMN funding_owner_type SET NOT NULL;
    ALTER TABLE company_ai_budgets ALTER COLUMN daily_limit_micros SET NOT NULL;
    ALTER TABLE company_ai_budgets ALTER COLUMN monthly_limit_micros SET NOT NULL;
    ALTER TABLE company_ai_budgets ALTER COLUMN session_limit_micros SET NOT NULL;
    ALTER TABLE company_ai_budgets ALTER COLUMN per_request_limit_micros SET NOT NULL;
    ALTER TABLE company_ai_budgets DROP CONSTRAINT IF EXISTS company_ai_budgets_company_id_version_key;
    UPDATE company_ai_budgets SET status='superseded',effective_to=COALESCE(effective_to,now())
    WHERE id IN (
      SELECT id FROM (
        SELECT id,row_number() OVER (PARTITION BY funding_owner_type,COALESCE(company_id,0),COALESCE(owner_user_id,0) ORDER BY effective_from DESC,version DESC,created_at DESC,id DESC) rn
        FROM company_ai_budgets WHERE status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
      ) duplicates WHERE rn>1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS company_ai_budgets_scope_version_uidx ON company_ai_budgets(funding_owner_type,COALESCE(company_id,0),COALESCE(owner_user_id,0),version);
    CREATE UNIQUE INDEX IF NOT EXISTS company_ai_budgets_active_scope_uidx ON company_ai_budgets(funding_owner_type,COALESCE(company_id,0),COALESCE(owner_user_id,0)) WHERE status='active' AND effective_to IS NULL;
    CREATE INDEX IF NOT EXISTS company_ai_budgets_effective_idx ON company_ai_budgets(funding_owner_type,company_id,owner_user_id,status);

    CREATE TABLE IF NOT EXISTS user_ai_allocations (
      id text PRIMARY KEY, budget_id text NOT NULL REFERENCES company_ai_budgets(id), company_id integer NOT NULL REFERENCES companies(id), user_id integer NOT NULL REFERENCES users(id), limit_micros numeric(30,0) NOT NULL, reserved_micros numeric(30,0) NOT NULL DEFAULT 0, settled_micros numeric(30,0) NOT NULL DEFAULT 0, daily_limit_micros numeric(30,0) NOT NULL, monthly_limit_micros numeric(30,0) NOT NULL, session_limit_micros numeric(30,0) NOT NULL, status text NOT NULL DEFAULT 'active', created_by_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT user_ai_allocations_status_chk CHECK(status IN ('active','disabled')), UNIQUE(budget_id,user_id)
    );
    ALTER TABLE user_ai_allocations ADD COLUMN IF NOT EXISTS daily_limit_micros numeric(30,0);
    ALTER TABLE user_ai_allocations ADD COLUMN IF NOT EXISTS monthly_limit_micros numeric(30,0);
    ALTER TABLE user_ai_allocations ADD COLUMN IF NOT EXISTS session_limit_micros numeric(30,0);
    UPDATE user_ai_allocations SET daily_limit_micros=COALESCE(daily_limit_micros,limit_micros),monthly_limit_micros=COALESCE(monthly_limit_micros,limit_micros),session_limit_micros=COALESCE(session_limit_micros,limit_micros);
    ALTER TABLE user_ai_allocations ALTER COLUMN daily_limit_micros SET NOT NULL; ALTER TABLE user_ai_allocations ALTER COLUMN monthly_limit_micros SET NOT NULL; ALTER TABLE user_ai_allocations ALTER COLUMN session_limit_micros SET NOT NULL;

    CREATE TABLE IF NOT EXISTS ai_price_schedules (
      id text PRIMARY KEY, version integer NOT NULL, provider text NOT NULL, model text NOT NULL, currency text NOT NULL, unit_basis integer NOT NULL CHECK(unit_basis>0), input_micros numeric(30,0) NOT NULL, output_micros numeric(30,0) NOT NULL, cached_input_micros numeric(30,0), source_url text NOT NULL, verified_by_id integer NOT NULL REFERENCES users(id), verified_at timestamptz NOT NULL, effective_from timestamptz NOT NULL, effective_to timestamptz, supersedes_id text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ai_price_schedules_provider_chk CHECK(provider IN ('openai','anthropic')), CONSTRAINT ai_price_schedules_status_chk CHECK(status IN ('active','superseded')), UNIQUE(provider,model,version)
    );
    ALTER TABLE ai_price_schedules ADD COLUMN IF NOT EXISTS verified_by_id integer REFERENCES users(id);
    ALTER TABLE ai_price_schedules ADD COLUMN IF NOT EXISTS supersedes_id text;
    DO $migration$ BEGIN
      IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='ai_price_schedules' AND column_name='created_by_id') THEN
        EXECUTE 'UPDATE ai_price_schedules SET verified_by_id=COALESCE(verified_by_id,created_by_id) WHERE verified_by_id IS NULL';
        EXECUTE 'ALTER TABLE ai_price_schedules ALTER COLUMN created_by_id DROP NOT NULL';
      END IF;
    END $migration$;
    ALTER TABLE ai_price_schedules ALTER COLUMN verified_by_id SET NOT NULL;
    UPDATE ai_price_schedules SET status='superseded',effective_to=COALESCE(effective_to,now())
    WHERE id IN (
      SELECT id FROM (
        SELECT id,row_number() OVER (PARTITION BY provider,model,currency ORDER BY effective_from DESC,version DESC,created_at DESC,id DESC) rn
        FROM ai_price_schedules WHERE status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
      ) duplicates WHERE rn>1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ai_price_schedules_active_scope_uidx ON ai_price_schedules(provider,model,currency) WHERE status='active' AND effective_to IS NULL;

    CREATE TABLE IF NOT EXISTS entitlement_rules (
      id text PRIMARY KEY, version integer NOT NULL, company_id integer REFERENCES companies(id), capability text NOT NULL, funding_type text NOT NULL CHECK(funding_type IN ('personal','company','system')), provider_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb, model_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb, enabled boolean NOT NULL DEFAULT true, requires_file_confirmation boolean NOT NULL DEFAULT true, effective_from timestamptz NOT NULL, effective_to timestamptz, supersedes_id text, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE entitlement_rules ADD COLUMN IF NOT EXISTS supersedes_id text;
    UPDATE entitlement_rules SET enabled=false,effective_to=COALESCE(effective_to,now())
    WHERE id IN (
      SELECT id FROM (
        SELECT id,row_number() OVER (PARTITION BY COALESCE(company_id,0),capability,funding_type ORDER BY effective_from DESC,version DESC,created_at DESC,id DESC) rn
        FROM entitlement_rules WHERE enabled=true AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
      ) duplicates WHERE rn>1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS entitlement_rules_scope_version_uidx ON entitlement_rules(COALESCE(company_id,0),capability,funding_type,version);
    CREATE UNIQUE INDEX IF NOT EXISTS entitlement_rules_active_scope_uidx ON entitlement_rules(COALESCE(company_id,0),capability,funding_type) WHERE enabled=true AND effective_to IS NULL;

    CREATE TABLE IF NOT EXISTS ai_runs (
      id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), company_id integer NOT NULL REFERENCES companies(id), project_id integer REFERENCES projects(id), session_id text NOT NULL, capability text NOT NULL, purpose text NOT NULL, provider text NOT NULL, model text NOT NULL, connection_id text NOT NULL REFERENCES provider_connections(id), credit_owner_type text NOT NULL,
      context_manifest_hash text NOT NULL, context_categories jsonb NOT NULL, file_manifest_hash text, files_will_be_transmitted boolean NOT NULL DEFAULT false, file_count integer NOT NULL DEFAULT 0, file_types jsonb NOT NULL DEFAULT '[]'::jsonb, file_total_bytes numeric(30,0) NOT NULL DEFAULT 0, page_image_estimate integer NOT NULL DEFAULT 0, transmission_scope text, file_additional_input_tokens_max integer NOT NULL DEFAULT 0, file_additional_cost_micros numeric(30,0) NOT NULL DEFAULT 0,
      price_schedule_id text NOT NULL REFERENCES ai_price_schedules(id), entitlement_rule_id text NOT NULL REFERENCES entitlement_rules(id), budget_id text NOT NULL REFERENCES company_ai_budgets(id), allocation_id text REFERENCES user_ai_allocations(id), input_token_min integer NOT NULL, input_token_max integer NOT NULL, output_token_max integer NOT NULL, estimated_min_micros numeric(30,0) NOT NULL, estimated_max_micros numeric(30,0) NOT NULL, currency text NOT NULL, request_fingerprint text NOT NULL, estimate_fingerprint text NOT NULL, estimate_expires_at timestamptz NOT NULL, confirmation_id text, confirmed_at timestamptz, file_confirmation_id text, file_confirmed_at timestamptz, file_confirmation_expires_at timestamptz, status text NOT NULL DEFAULT 'estimated', idempotency_key text NOT NULL, reserved_micros numeric(30,0) NOT NULL DEFAULT 0, actual_micros numeric(30,0), provider_request_id text, input_tokens_actual integer, output_tokens_actual integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ai_runs_status_chk CHECK(status IN ('estimated','confirmed','file_confirmed','reserved','settled','cancelled','failed')), UNIQUE(user_id,idempotency_key)
    );
    ALTER TABLE ai_runs DROP CONSTRAINT IF EXISTS ai_runs_status_chk;
    ALTER TABLE ai_runs ADD CONSTRAINT ai_runs_status_chk CHECK(status IN ('estimated','confirmed','file_confirmed','reserved','settled','cancelled','failed'));
    ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS session_id text; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS request_fingerprint text; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_count integer NOT NULL DEFAULT 0; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_types jsonb NOT NULL DEFAULT '[]'::jsonb; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_total_bytes numeric(30,0) NOT NULL DEFAULT 0; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS page_image_estimate integer NOT NULL DEFAULT 0; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS transmission_scope text; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_additional_input_tokens_max integer NOT NULL DEFAULT 0; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_additional_cost_micros numeric(30,0) NOT NULL DEFAULT 0; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_confirmation_id text; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_confirmed_at timestamptz; ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS file_confirmation_expires_at timestamptz;
    UPDATE ai_runs SET session_id=COALESCE(session_id,id),request_fingerprint=COALESCE(request_fingerprint,estimate_fingerprint);
    INSERT INTO company_ai_budgets(id,funding_owner_type,company_id,owner_user_id,version,currency,limit_micros,per_request_limit_micros,daily_limit_micros,monthly_limit_micros,session_limit_micros,provider_allowlist,model_allowlist,capability_allowlist,status,effective_from,effective_to,created_by_id)
    SELECT 'legacy-ai-budget-'||r.company_id,'company',r.company_id,NULL,-1,COALESCE(max(r.currency),'USD'),0,0,0,0,0,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'disabled',TIMESTAMPTZ '1970-01-01',now(),min(r.user_id)
    FROM ai_runs r WHERE r.budget_id IS NULL GROUP BY r.company_id
    ON CONFLICT DO NOTHING;
    UPDATE ai_runs SET budget_id='legacy-ai-budget-'||company_id WHERE budget_id IS NULL;
    ALTER TABLE ai_runs ALTER COLUMN session_id SET NOT NULL; ALTER TABLE ai_runs ALTER COLUMN request_fingerprint SET NOT NULL; ALTER TABLE ai_runs ALTER COLUMN budget_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS ai_runs_budget_status_idx ON ai_runs(budget_id,status,created_at);

    CREATE TABLE IF NOT EXISTS ai_usage_costs (
      id text PRIMARY KEY, run_id text NOT NULL REFERENCES ai_runs(id), entry_type text NOT NULL CHECK(entry_type IN ('reservation','settlement','release','correction','failure')), amount_micros numeric(30,0) NOT NULL, currency text NOT NULL, input_tokens integer, output_tokens integer, provider_request_id text, price_schedule_id text REFERENCES ai_price_schedules(id), correction_of_id text, reason text, actor_user_id integer REFERENCES users(id), idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS ai_usage_costs_run_created_idx ON ai_usage_costs(run_id,created_at);

    CREATE OR REPLACE FUNCTION bimlog_ai_usage_costs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ai_usage_costs is append-only'; END; $$;
    DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='ai_usage_costs_immutable_trigger') THEN CREATE TRIGGER ai_usage_costs_immutable_trigger BEFORE UPDATE OR DELETE ON ai_usage_costs FOR EACH ROW EXECUTE FUNCTION bimlog_ai_usage_costs_immutable(); END IF; END $$;
    CREATE OR REPLACE FUNCTION bimlog_ai_config_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE actor_id integer; BEGIN actor_id:=COALESCE((to_jsonb(NEW)->>'created_by_id')::integer,(to_jsonb(NEW)->>'verified_by_id')::integer,(to_jsonb(NEW)->>'granted_by_id')::integer); INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details) SELECT id,email,'ai_control_config_created',TG_TABLE_NAME,NEW.id,jsonb_build_object('version',to_jsonb(NEW)->>'version','status',to_jsonb(NEW)->>'status') FROM users WHERE id=actor_id; RETURN NEW; END; $$;
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='company_ai_administrators_audit_trigger') THEN CREATE TRIGGER company_ai_administrators_audit_trigger AFTER INSERT ON company_ai_administrators FOR EACH ROW EXECUTE FUNCTION bimlog_ai_config_audit_insert(); END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='company_ai_budgets_audit_trigger') THEN CREATE TRIGGER company_ai_budgets_audit_trigger AFTER INSERT ON company_ai_budgets FOR EACH ROW EXECUTE FUNCTION bimlog_ai_config_audit_insert(); END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='entitlement_rules_audit_trigger') THEN CREATE TRIGGER entitlement_rules_audit_trigger AFTER INSERT ON entitlement_rules FOR EACH ROW EXECUTE FUNCTION bimlog_ai_config_audit_insert(); END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='ai_price_schedules_audit_trigger') THEN CREATE TRIGGER ai_price_schedules_audit_trigger AFTER INSERT ON ai_price_schedules FOR EACH ROW EXECUTE FUNCTION bimlog_ai_config_audit_insert(); END IF;
    END $$;
  `);
}
