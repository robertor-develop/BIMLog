import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;
export function startFinancialContractMigration() {
  return ready ?? (ready = ensureFinancialContractSchema());
}
export async function waitForFinancialContractMigration() {
  await startFinancialContractMigration();
}

export async function ensureFinancialContractSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
CREATE TABLE IF NOT EXISTS financial_contracts(id text PRIMARY KEY,bimlog_id text NOT NULL UNIQUE,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),perspective text NOT NULL,contract_type text NOT NULL,legal_number text NOT NULL,counterparty_name text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT financial_contract_perspective_chk CHECK(perspective IN('upstream','downstream')),CONSTRAINT financial_contract_type_chk CHECK(contract_type IN('owner_prime','subcontract','purchase_order','consultant_agreement','other_commitment')),UNIQUE(project_id,perspective,legal_number));
CREATE TABLE IF NOT EXISTS financial_contract_versions(id text PRIMARY KEY,contract_id text NOT NULL REFERENCES financial_contracts(id),version integer NOT NULL,status text NOT NULL,title text NOT NULL,currency text NOT NULL,original_value numeric(30,6) NOT NULL,effective_date date,completion_date date,payment_terms text,commercial_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,budget_snapshot_id text NOT NULL REFERENCES approved_budget_snapshots(id),structure_version_id text NOT NULL REFERENCES project_cost_structure_versions(id),signed_file_id integer REFERENCES files(id),prepared_by_id integer NOT NULL REFERENCES users(id),submitted_by_id integer REFERENCES users(id),reviewed_by_id integer REFERENCES users(id),approved_by_id integer REFERENCES users(id),executed_by_id integer REFERENCES users(id),submitted_at timestamptz,reviewed_at timestamptz,approved_at timestamptz,executed_at timestamptz,outcome_reason text,over_budget_reason text,approval_policy_id text,higher_approval_policy_id text,execution_policy_id text,content_fingerprint text NOT NULL,revision integer NOT NULL DEFAULT 1,supersedes_id text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT financial_contract_version_status_chk CHECK(status IN('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','terminated','voided','closed')),CONSTRAINT financial_contract_version_currency_chk CHECK(currency~'^[A-Z]{3}$'),CONSTRAINT financial_contract_original_value_chk CHECK(original_value>=0),UNIQUE(contract_id,version));
CREATE TABLE IF NOT EXISTS financial_contract_sov_lines(id text PRIMARY KEY,contract_version_id text NOT NULL REFERENCES financial_contract_versions(id),stable_line_id text NOT NULL,budget_snapshot_line_id text NOT NULL REFERENCES approved_budget_snapshot_lines(id),project_cost_node_id text NOT NULL REFERENCES project_cost_nodes(id),schedule_item_placement_id integer REFERENCES schedule_item_placements(id),description text NOT NULL,amount numeric(30,6) NOT NULL,contract_item_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,sort_order integer NOT NULL,CONSTRAINT financial_contract_sov_amount_chk CHECK(amount>=0),UNIQUE(contract_version_id,stable_line_id));
CREATE TABLE IF NOT EXISTS financial_contract_amendments(id text PRIMARY KEY,contract_id text NOT NULL REFERENCES financial_contracts(id),bimlog_id text NOT NULL UNIQUE,legal_number text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(contract_id,legal_number));
CREATE TABLE IF NOT EXISTS financial_contract_amendment_versions(id text PRIMARY KEY,amendment_id text NOT NULL REFERENCES financial_contract_amendments(id),contract_version_id text NOT NULL REFERENCES financial_contract_versions(id),version integer NOT NULL,status text NOT NULL,title text NOT NULL,currency text NOT NULL,amount_delta numeric(30,6) NOT NULL,budget_snapshot_id text NOT NULL REFERENCES approved_budget_snapshots(id),structure_version_id text NOT NULL REFERENCES project_cost_structure_versions(id),signed_file_id integer REFERENCES files(id),prepared_by_id integer NOT NULL REFERENCES users(id),submitted_by_id integer REFERENCES users(id),reviewed_by_id integer REFERENCES users(id),approved_by_id integer REFERENCES users(id),executed_by_id integer REFERENCES users(id),submitted_at timestamptz,reviewed_at timestamptz,approved_at timestamptz,executed_at timestamptz,outcome_reason text,over_budget_reason text,approval_policy_id text,higher_approval_policy_id text,execution_policy_id text,content_fingerprint text NOT NULL,revision integer NOT NULL DEFAULT 1,supersedes_id text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT financial_amendment_status_chk CHECK(status IN('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','voided')),CONSTRAINT financial_amendment_currency_chk CHECK(currency~'^[A-Z]{3}$'),UNIQUE(amendment_id,version));
CREATE TABLE IF NOT EXISTS financial_contract_amendment_lines(id text PRIMARY KEY,amendment_version_id text NOT NULL REFERENCES financial_contract_amendment_versions(id),stable_line_id text NOT NULL,budget_snapshot_line_id text NOT NULL REFERENCES approved_budget_snapshot_lines(id),project_cost_node_id text NOT NULL REFERENCES project_cost_nodes(id),schedule_item_placement_id integer REFERENCES schedule_item_placements(id),description text NOT NULL,amount_delta numeric(30,6) NOT NULL,sort_order integer NOT NULL,UNIQUE(amendment_version_id,stable_line_id));
CREATE TABLE IF NOT EXISTS financial_contract_payment_applications(id text PRIMARY KEY,contract_id text NOT NULL,bimlog_id text NOT NULL,application_number text NOT NULL,idempotency_key text NOT NULL,created_by_id integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT fin_contract_payment_apps_bimlog_id_key UNIQUE(bimlog_id),CONSTRAINT fin_contract_payment_apps_contract_number_key UNIQUE(contract_id,application_number),CONSTRAINT fin_contract_payment_apps_contract_idem_key UNIQUE(contract_id,idempotency_key),CONSTRAINT fin_contract_payment_apps_contract_id_fkey FOREIGN KEY(contract_id) REFERENCES financial_contracts(id),CONSTRAINT fin_contract_payment_apps_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS financial_contract_payment_versions(id text PRIMARY KEY,payment_application_id text NOT NULL,contract_version_id text NOT NULL,version integer NOT NULL,revision integer NOT NULL DEFAULT 1,status text NOT NULL,period_start date NOT NULL,period_end date NOT NULL,currency text NOT NULL,gross_amount numeric(30,6) NOT NULL,retainage_amount numeric(30,6) NOT NULL,net_amount numeric(30,6) NOT NULL,content_fingerprint text NOT NULL,prepared_by_id integer NOT NULL,submitted_by_id integer,approved_by_id integer,submitted_at timestamptz,approved_at timestamptz,outcome_reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT fin_contract_payment_status_chk CHECK(status IN('draft','submitted','approved','returned','rejected','withdrawn','voided')),CONSTRAINT fin_contract_payment_currency_chk CHECK(currency~'^[A-Z]{3}$'),CONSTRAINT fin_contract_payment_amounts_chk CHECK(gross_amount>=0 AND retainage_amount>=0 AND net_amount>=0 AND net_amount=gross_amount-retainage_amount),CONSTRAINT fin_contract_payment_period_chk CHECK(period_end>=period_start),CONSTRAINT fin_contract_payment_versions_app_version_key UNIQUE(payment_application_id,version),CONSTRAINT fin_contract_payment_versions_app_id_fkey FOREIGN KEY(payment_application_id) REFERENCES financial_contract_payment_applications(id),CONSTRAINT fin_contract_payment_versions_contract_ver_fkey FOREIGN KEY(contract_version_id) REFERENCES financial_contract_versions(id),CONSTRAINT fin_contract_payment_versions_prepared_by_fkey FOREIGN KEY(prepared_by_id) REFERENCES users(id),CONSTRAINT fin_contract_payment_versions_submitted_by_fkey FOREIGN KEY(submitted_by_id) REFERENCES users(id),CONSTRAINT fin_contract_payment_versions_approved_by_fkey FOREIGN KEY(approved_by_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS financial_contract_payment_lines(id text PRIMARY KEY,payment_version_id text NOT NULL,contract_sov_line_id text NOT NULL,current_amount numeric(30,6) NOT NULL,evidence jsonb NOT NULL DEFAULT '{}'::jsonb,sort_order integer NOT NULL,CONSTRAINT fin_contract_payment_line_amount_chk CHECK(current_amount>=0),CONSTRAINT fin_contract_payment_lines_version_sov_key UNIQUE(payment_version_id,contract_sov_line_id),CONSTRAINT fin_contract_payment_lines_version_id_fkey FOREIGN KEY(payment_version_id) REFERENCES financial_contract_payment_versions(id),CONSTRAINT fin_contract_payment_lines_sov_line_id_fkey FOREIGN KEY(contract_sov_line_id) REFERENCES financial_contract_sov_lines(id));
CREATE TABLE IF NOT EXISTS financial_contract_import_sessions(id text PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),company_id integer NOT NULL REFERENCES companies(id),actor_user_id integer NOT NULL REFERENCES users(id),source_file_id integer NOT NULL REFERENCES files(id),file_hash text NOT NULL,parsed_fingerprint text NOT NULL,currency text NOT NULL,total numeric(30,6) NOT NULL,accepted_count integer NOT NULL,rejected_count integer NOT NULL,preview jsonb NOT NULL,confirmed_contract_version_id text,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,CONSTRAINT financial_contract_import_ses_confirmed_contract_version_i_fkey FOREIGN KEY(confirmed_contract_version_id) REFERENCES financial_contract_versions(id),CONSTRAINT financial_contract_import_ses_confirmed_contract_version_id_key UNIQUE(confirmed_contract_version_id),UNIQUE(project_id,idempotency_key));
CREATE TABLE IF NOT EXISTS financial_contract_record_grants(id text PRIMARY KEY,contract_id text NOT NULL REFERENCES financial_contracts(id),user_id integer NOT NULL REFERENCES users(id),permission text NOT NULL,version integer NOT NULL,state text NOT NULL,reason text NOT NULL,granted_by_id integer NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT financial_contract_record_permission_chk CHECK(permission IN('view','prepare','review','approve','execute','manage')),CONSTRAINT financial_contract_record_grant_state_chk CHECK(state IN('active','revoked')),UNIQUE(contract_id,user_id,permission,version));
CREATE TABLE IF NOT EXISTS financial_contract_history(id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id),contract_id text NOT NULL REFERENCES financial_contracts(id),contract_version_id text REFERENCES financial_contract_versions(id),amendment_id text REFERENCES financial_contract_amendments(id),amendment_version_id text REFERENCES financial_contract_amendment_versions(id),actor_user_id integer NOT NULL REFERENCES users(id),event_type text NOT NULL,before_state text,after_state text,reason_code text NOT NULL,evidence jsonb NOT NULL DEFAULT '{}'::jsonb,occurred_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS financial_contract_project_idx ON financial_contracts(project_id,perspective,created_at);
CREATE INDEX IF NOT EXISTS financial_contract_history_scope_idx ON financial_contract_history(company_id,project_id,contract_id,occurred_at);
CREATE INDEX IF NOT EXISTS financial_contract_grant_lookup_idx ON financial_contract_record_grants(contract_id,user_id,permission,version DESC NULLS FIRST);
ALTER TABLE financial_contract_sov_lines ADD COLUMN IF NOT EXISTS contract_item_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE financial_contract_history ADD COLUMN IF NOT EXISTS payment_application_id text;
ALTER TABLE financial_contract_history ADD COLUMN IF NOT EXISTS payment_version_id text;
`);
    await client.query(`
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fin_contract_history_payment_app_id_fkey') THEN ALTER TABLE financial_contract_history ADD CONSTRAINT fin_contract_history_payment_app_id_fkey FOREIGN KEY(payment_application_id) REFERENCES financial_contract_payment_applications(id) NOT VALID; ALTER TABLE financial_contract_history VALIDATE CONSTRAINT fin_contract_history_payment_app_id_fkey; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='fin_contract_history_payment_version_id_fkey') THEN ALTER TABLE financial_contract_history ADD CONSTRAINT fin_contract_history_payment_version_id_fkey FOREIGN KEY(payment_version_id) REFERENCES financial_contract_payment_versions(id) NOT VALID; ALTER TABLE financial_contract_history VALIDATE CONSTRAINT fin_contract_history_payment_version_id_fkey; END IF;
END $$;
`);
    await client.query(`
DO $$ BEGIN
  IF EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='financial_contract_import_sessions'
      AND c.conname='financial_contract_import_ses_confirmed_contract_version_i_fkey'
      AND (
        c.contype<>'f'
        OR pg_get_constraintdef(c.oid, true)<> 'FOREIGN KEY (confirmed_contract_version_id) REFERENCES financial_contract_versions(id)'
      )
  ) THEN
    RAISE EXCEPTION 'financial contract import confirmed-version foreign key exists with an unexpected definition';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='financial_contract_import_sessions'
      AND c.conname='financial_contract_import_ses_confirmed_contract_version_i_fkey'
  ) THEN
    ALTER TABLE financial_contract_import_sessions
      ADD CONSTRAINT financial_contract_import_ses_confirmed_contract_version_i_fkey
      FOREIGN KEY(confirmed_contract_version_id) REFERENCES financial_contract_versions(id) NOT VALID;
    ALTER TABLE financial_contract_import_sessions
      VALIDATE CONSTRAINT financial_contract_import_ses_confirmed_contract_version_i_fkey;
  END IF;

  IF EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='financial_contract_import_sessions'
      AND c.conname='financial_contract_import_ses_confirmed_contract_version_id_key'
      AND (
        c.contype<>'u'
        OR pg_get_constraintdef(c.oid, true)<> 'UNIQUE (confirmed_contract_version_id)'
      )
  ) THEN
    RAISE EXCEPTION 'financial contract import confirmed-version uniqueness exists with an unexpected definition';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='financial_contract_import_sessions'
      AND c.conname='financial_contract_import_ses_confirmed_contract_version_id_key'
  ) THEN
    IF EXISTS(
      SELECT confirmed_contract_version_id
      FROM financial_contract_import_sessions
      WHERE confirmed_contract_version_id IS NOT NULL
      GROUP BY confirmed_contract_version_id
      HAVING count(*)>1
    ) THEN
      RAISE EXCEPTION 'cannot add confirmed-version uniqueness: duplicate confirmed contract versions exist';
    END IF;
    ALTER TABLE financial_contract_import_sessions
      ADD CONSTRAINT financial_contract_import_ses_confirmed_contract_version_id_key UNIQUE(confirmed_contract_version_id);
  END IF;
END $$;
`);
    await client.query(`
CREATE OR REPLACE FUNCTION reject_financial_contract_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'financial contract history is append-only'; END $$;
CREATE OR REPLACE FUNCTION guard_financial_contract_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status IN('executed','superseded','terminated','voided','closed') THEN RAISE EXCEPTION 'executed financial contract version is immutable'; END IF;
  IF OLD.status<>'draft' AND (NEW.title<>OLD.title OR NEW.currency<>OLD.currency OR NEW.original_value<>OLD.original_value OR NEW.budget_snapshot_id<>OLD.budget_snapshot_id OR NEW.structure_version_id<>OLD.structure_version_id OR NEW.commercial_metadata<>OLD.commercial_metadata OR NEW.content_fingerprint<>OLD.content_fingerprint) THEN RAISE EXCEPTION 'submitted financial contract terms are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_financial_amendment_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.status IN('executed','superseded','voided') THEN RAISE EXCEPTION 'executed financial amendment version is immutable'; END IF;
  IF OLD.status<>'draft' AND (NEW.title<>OLD.title OR NEW.currency<>OLD.currency OR NEW.amount_delta<>OLD.amount_delta OR NEW.budget_snapshot_id<>OLD.budget_snapshot_id OR NEW.structure_version_id<>OLD.structure_version_id OR NEW.content_fingerprint<>OLD.content_fingerprint) THEN RAISE EXCEPTION 'submitted financial amendment terms are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_financial_contract_line_scope() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE v_project integer; v_snapshot text; v_structure text; line_snapshot text; node_structure text; schedule_project integer; BEGIN
  IF TG_TABLE_NAME='financial_contract_sov_lines' THEN SELECT c.project_id,v.budget_snapshot_id,v.structure_version_id INTO v_project,v_snapshot,v_structure FROM financial_contract_versions v JOIN financial_contracts c ON c.id=v.contract_id WHERE v.id=NEW.contract_version_id; ELSE SELECT c.project_id,v.budget_snapshot_id,v.structure_version_id INTO v_project,v_snapshot,v_structure FROM financial_contract_amendment_versions v JOIN financial_contract_amendments a ON a.id=v.amendment_id JOIN financial_contracts c ON c.id=a.contract_id WHERE v.id=NEW.amendment_version_id; END IF;
  SELECT snapshot_id INTO line_snapshot FROM approved_budget_snapshot_lines WHERE id=NEW.budget_snapshot_line_id;
  SELECT structure_version_id INTO node_structure FROM project_cost_nodes WHERE id=NEW.project_cost_node_id;
  IF line_snapshot IS DISTINCT FROM v_snapshot OR node_structure IS DISTINCT FROM v_structure OR NOT EXISTS(SELECT 1 FROM approved_budget_snapshot_lines WHERE id=NEW.budget_snapshot_line_id AND project_cost_node_id=NEW.project_cost_node_id) THEN RAISE EXCEPTION 'financial line does not match pinned budget snapshot and structure'; END IF;
  IF NEW.schedule_item_placement_id IS NOT NULL THEN SELECT project_id INTO schedule_project FROM schedule_item_placements WHERE id=NEW.schedule_item_placement_id; IF schedule_project IS DISTINCT FROM v_project THEN RAISE EXCEPTION 'schedule relationship is outside the financial project'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_financial_contract_line_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s text; BEGIN IF TG_TABLE_NAME='financial_contract_sov_lines' THEN SELECT status INTO s FROM financial_contract_versions WHERE id=OLD.contract_version_id; ELSE SELECT status INTO s FROM financial_contract_amendment_versions WHERE id=OLD.amendment_version_id; END IF; IF s<>'draft' THEN RAISE EXCEPTION 'submitted financial lines are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE OR REPLACE FUNCTION guard_financial_payment_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE governed_contract text; exceeded boolean; BEGIN
 IF OLD.status IN('approved','rejected','withdrawn','voided') THEN RAISE EXCEPTION 'decided payment application version is immutable'; END IF;
 IF OLD.status<>'draft' AND (NEW.period_start<>OLD.period_start OR NEW.period_end<>OLD.period_end OR NEW.currency<>OLD.currency OR NEW.gross_amount<>OLD.gross_amount OR NEW.retainage_amount<>OLD.retainage_amount OR NEW.net_amount<>OLD.net_amount OR NEW.content_fingerprint<>OLD.content_fingerprint) THEN RAISE EXCEPTION 'submitted payment application terms are immutable'; END IF;
 IF NEW.status='approved' AND OLD.status<>'approved' THEN
  SELECT contract_id INTO governed_contract FROM financial_contract_payment_applications WHERE id=NEW.payment_application_id;
  PERFORM pg_advisory_xact_lock(hashtext('contract-payment:'||governed_contract));
  SELECT EXISTS(SELECT 1 FROM financial_contract_payment_lines current_line JOIN financial_contract_sov_lines sov ON sov.id=current_line.contract_sov_line_id WHERE current_line.payment_version_id=NEW.id AND current_line.current_amount+COALESCE((SELECT sum(prior_line.current_amount) FROM financial_contract_payment_lines prior_line JOIN financial_contract_payment_versions prior_version ON prior_version.id=prior_line.payment_version_id JOIN financial_contract_payment_applications prior_app ON prior_app.id=prior_version.payment_application_id WHERE prior_app.contract_id=governed_contract AND prior_version.status='approved' AND prior_line.contract_sov_line_id=current_line.contract_sov_line_id),0)>sov.amount) INTO exceeded;
  IF exceeded THEN RAISE EXCEPTION 'approved payment total exceeds the governed SOV line'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_financial_payment_line() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE s text; payment_contract text; line_contract text; BEGIN SELECT v.status,a.contract_id INTO s,payment_contract FROM financial_contract_payment_versions v JOIN financial_contract_payment_applications a ON a.id=v.payment_application_id WHERE v.id=COALESCE(NEW.payment_version_id,OLD.payment_version_id); SELECT v.contract_id INTO line_contract FROM financial_contract_sov_lines l JOIN financial_contract_versions v ON v.id=l.contract_version_id WHERE l.id=COALESCE(NEW.contract_sov_line_id,OLD.contract_sov_line_id); IF payment_contract IS DISTINCT FROM line_contract THEN RAISE EXCEPTION 'payment line is outside the governed contract'; END IF; IF TG_OP<>'INSERT' AND s<>'draft' THEN RAISE EXCEPTION 'submitted payment application lines are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['financial_contracts','financial_contract_amendments','financial_contract_payment_applications','financial_contract_record_grants','financial_contract_history'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=t||'_immutable') THEN EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_financial_contract_history_mutation()',t||'_immutable',t); END IF; END LOOP; END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_contract_version_guard') THEN CREATE TRIGGER financial_contract_version_guard BEFORE UPDATE OR DELETE ON financial_contract_versions FOR EACH ROW EXECUTE FUNCTION guard_financial_contract_version_mutation(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_amendment_version_guard') THEN CREATE TRIGGER financial_amendment_version_guard BEFORE UPDATE OR DELETE ON financial_contract_amendment_versions FOR EACH ROW EXECUTE FUNCTION guard_financial_amendment_version_mutation(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_contract_sov_scope_guard') THEN CREATE TRIGGER financial_contract_sov_scope_guard BEFORE INSERT OR UPDATE ON financial_contract_sov_lines FOR EACH ROW EXECUTE FUNCTION guard_financial_contract_line_scope(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_amendment_line_scope_guard') THEN CREATE TRIGGER financial_amendment_line_scope_guard BEFORE INSERT OR UPDATE ON financial_contract_amendment_lines FOR EACH ROW EXECUTE FUNCTION guard_financial_contract_line_scope(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_contract_sov_mutation_guard') THEN CREATE TRIGGER financial_contract_sov_mutation_guard BEFORE UPDATE OR DELETE ON financial_contract_sov_lines FOR EACH ROW EXECUTE FUNCTION guard_financial_contract_line_mutation(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='financial_amendment_line_mutation_guard') THEN CREATE TRIGGER financial_amendment_line_mutation_guard BEFORE UPDATE OR DELETE ON financial_contract_amendment_lines FOR EACH ROW EXECUTE FUNCTION guard_financial_contract_line_mutation(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='fin_contract_payment_version_guard') THEN CREATE TRIGGER fin_contract_payment_version_guard BEFORE UPDATE OR DELETE ON financial_contract_payment_versions FOR EACH ROW EXECUTE FUNCTION guard_financial_payment_version_mutation(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='fin_contract_payment_line_guard') THEN CREATE TRIGGER fin_contract_payment_line_guard BEFORE INSERT OR UPDATE OR DELETE ON financial_contract_payment_lines FOR EACH ROW EXECUTE FUNCTION guard_financial_payment_line(); END IF;
END $$;
`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    ready = null;
    throw error;
  } finally {
    client.release();
  }
}
