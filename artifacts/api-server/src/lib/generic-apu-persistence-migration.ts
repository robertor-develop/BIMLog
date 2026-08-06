import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;

export function startGenericApuPersistenceMigration(): Promise<void> {
  return ready ?? (ready = ensureGenericApuPersistenceSchema());
}

export async function waitForGenericApuPersistenceMigration(): Promise<void> {
  await startGenericApuPersistenceMigration();
}

export async function ensureGenericApuPersistenceSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
CREATE TABLE IF NOT EXISTS generic_apu_template_versions(
  id text PRIMARY KEY,
  template_id text NOT NULL,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer REFERENCES projects(id),
  version integer NOT NULL,
  name text NOT NULL,
  industry text NOT NULL,
  status text NOT NULL,
  currency text,
  reason text NOT NULL,
  content_fingerprint text NOT NULL,
  supersedes_id text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id integer NOT NULL REFERENCES users(id),
  published_by_id integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT generic_apu_template_version_positive_chk CHECK(version > 0),
  CONSTRAINT generic_apu_template_status_chk CHECK(status IN('draft','published','superseded','retired')),
  CONSTRAINT generic_apu_template_currency_chk CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_apu_template_reason_chk CHECK(length(reason) BETWEEN 1 AND 2000),
  CONSTRAINT generic_apu_template_publish_chk CHECK(
    (status='draft' AND published_by_id IS NULL AND published_at IS NULL) OR
    (status<>'draft' AND published_by_id IS NOT NULL AND published_at IS NOT NULL)
  ),
  CONSTRAINT generic_apu_template_maker_checker_chk CHECK(published_by_id IS NULL OR published_by_id <> created_by_id),
  CONSTRAINT generic_apu_template_supersedes_fk FOREIGN KEY(supersedes_id) REFERENCES generic_apu_template_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_template_version_uidx ON generic_apu_template_versions(template_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_template_fingerprint_uidx ON generic_apu_template_versions(company_id,content_fingerprint);
CREATE INDEX IF NOT EXISTS generic_apu_template_scope_idx ON generic_apu_template_versions(company_id,project_id,status);

CREATE TABLE IF NOT EXISTS generic_apu_template_nodes(
  id text PRIMARY KEY,
  template_version_id text NOT NULL REFERENCES generic_apu_template_versions(id),
  stable_node_id text NOT NULL,
  parent_node_id text,
  method text NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  formula text,
  percent numeric(30,6),
  quantity numeric(30,6),
  unit_cost numeric(30,6),
  hours numeric(30,6),
  hourly_rate numeric(30,6),
  currency text,
  sort_order integer NOT NULL,
  content_fingerprint text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_apu_node_method_chk CHECK(method IN('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula')),
  CONSTRAINT generic_apu_node_currency_chk CHECK(currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_apu_node_sort_chk CHECK(sort_order >= 0),
  CONSTRAINT generic_apu_node_operands_chk CHECK(
    (method='fixed_amount' AND unit_cost IS NOT NULL AND formula IS NULL AND percent IS NULL AND quantity IS NULL AND hours IS NULL AND hourly_rate IS NULL) OR
    (method='quantity_unit_cost' AND quantity IS NOT NULL AND unit_cost IS NOT NULL AND formula IS NULL AND percent IS NULL AND hours IS NULL AND hourly_rate IS NULL) OR
    (method='hours_hourly_rate' AND hours IS NOT NULL AND hourly_rate IS NOT NULL AND formula IS NULL AND percent IS NULL AND quantity IS NULL AND unit_cost IS NULL) OR
    (method='percentage_of_parent' AND parent_node_id IS NOT NULL AND percent IS NOT NULL AND formula IS NULL AND quantity IS NULL AND unit_cost IS NULL AND hours IS NULL AND hourly_rate IS NULL) OR
    (method='allocation_group' AND formula IS NULL AND percent IS NULL AND quantity IS NULL AND unit_cost IS NULL AND hours IS NULL AND hourly_rate IS NULL) OR
    (method='formula' AND formula IS NOT NULL AND percent IS NULL AND quantity IS NULL AND unit_cost IS NULL AND hours IS NULL AND hourly_rate IS NULL)
  ),
  CONSTRAINT generic_apu_node_parent_fk FOREIGN KEY(parent_node_id) REFERENCES generic_apu_template_nodes(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_node_stable_uidx ON generic_apu_template_nodes(template_version_id,stable_node_id);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_node_order_uidx ON generic_apu_template_nodes(template_version_id,sort_order);
CREATE INDEX IF NOT EXISTS generic_apu_node_parent_idx ON generic_apu_template_nodes(template_version_id,parent_node_id);

CREATE TABLE IF NOT EXISTS generic_project_apu_versions(
  id text PRIMARY KEY,
  project_apu_id text NOT NULL,
  project_id integer NOT NULL REFERENCES projects(id),
  company_id integer NOT NULL REFERENCES companies(id),
  template_version_id text NOT NULL REFERENCES generic_apu_template_versions(id),
  version integer NOT NULL,
  status text NOT NULL,
  currency text NOT NULL,
  template_fingerprint text NOT NULL,
  content_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  supersedes_id text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_by_id integer NOT NULL REFERENCES users(id),
  applied_at timestamptz NOT NULL,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_project_apu_version_positive_chk CHECK(version > 0),
  CONSTRAINT generic_project_apu_status_chk CHECK(status IN('draft','calculated','overrun_review_required','locked','superseded','void')),
  CONSTRAINT generic_project_apu_currency_chk CHECK(currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_project_apu_supersedes_fk FOREIGN KEY(supersedes_id) REFERENCES generic_project_apu_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_project_apu_version_uidx ON generic_project_apu_versions(project_apu_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS generic_project_apu_idempotency_uidx ON generic_project_apu_versions(project_id,idempotency_key);
CREATE INDEX IF NOT EXISTS generic_project_apu_scope_idx ON generic_project_apu_versions(company_id,project_id,status);

CREATE TABLE IF NOT EXISTS generic_project_apu_lines(
  id text PRIMARY KEY,
  project_apu_version_id text NOT NULL REFERENCES generic_project_apu_versions(id),
  template_node_id text NOT NULL REFERENCES generic_apu_template_nodes(id),
  stable_line_id text NOT NULL,
  method text NOT NULL,
  raw_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_amount text NOT NULL,
  rounded_amount numeric(30,2) NOT NULL,
  currency text NOT NULL,
  sort_order integer NOT NULL,
  content_fingerprint text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_project_apu_line_method_chk CHECK(method IN('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula')),
  CONSTRAINT generic_project_apu_line_raw_amount_chk CHECK(raw_amount ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'),
  CONSTRAINT generic_project_apu_line_currency_chk CHECK(currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_project_apu_line_sort_chk CHECK(sort_order >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_project_apu_line_stable_uidx ON generic_project_apu_lines(project_apu_version_id,stable_line_id);
CREATE UNIQUE INDEX IF NOT EXISTS generic_project_apu_line_order_uidx ON generic_project_apu_lines(project_apu_version_id,sort_order);
ALTER TABLE generic_project_apu_lines DROP CONSTRAINT IF EXISTS generic_project_apu_line_method_chk;
ALTER TABLE generic_project_apu_lines ADD CONSTRAINT generic_project_apu_line_method_chk CHECK(method IN('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula'));

CREATE TABLE IF NOT EXISTS generic_apu_commitment_versions(
  id text PRIMARY KEY,
  commitment_id text NOT NULL,
  version integer NOT NULL,
  project_apu_version_id text NOT NULL REFERENCES generic_project_apu_versions(id),
  project_apu_line_id text NOT NULL REFERENCES generic_project_apu_lines(id),
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  assignment_ref text NOT NULL,
  amount numeric(30,6) NOT NULL,
  currency text NOT NULL,
  state text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  content_fingerprint text NOT NULL,
  supersedes_id text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id integer NOT NULL REFERENCES users(id),
  approved_by_id integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT generic_apu_commitment_version_positive_chk CHECK(version > 0),
  CONSTRAINT generic_apu_commitment_amount_chk CHECK(amount > 0),
  CONSTRAINT generic_apu_commitment_state_chk CHECK(state IN('original','committed','approved','paid_released','remaining','overrun')),
  CONSTRAINT generic_apu_commitment_currency_chk CHECK(currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_apu_commitment_approval_chk CHECK(
    (state IN('approved','paid_released','overrun') AND approved_by_id IS NOT NULL AND approved_at IS NOT NULL) OR
    (state NOT IN('approved','paid_released','overrun') AND approved_by_id IS NULL AND approved_at IS NULL)
  ),
  CONSTRAINT generic_apu_commitment_maker_checker_chk CHECK(approved_by_id IS NULL OR approved_by_id <> created_by_id),
  CONSTRAINT generic_apu_commitment_supersedes_fk FOREIGN KEY(supersedes_id) REFERENCES generic_apu_commitment_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_commitment_version_uidx ON generic_apu_commitment_versions(commitment_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_commitment_idempotency_uidx ON generic_apu_commitment_versions(project_id,idempotency_key);
CREATE INDEX IF NOT EXISTS generic_apu_commitment_line_idx ON generic_apu_commitment_versions(project_apu_line_id,created_at);

CREATE TABLE IF NOT EXISTS generic_apu_overrun_approvals(
  id text PRIMARY KEY,
  commitment_version_id text NOT NULL REFERENCES generic_apu_commitment_versions(id),
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  amount numeric(30,6) NOT NULL,
  currency text NOT NULL,
  reason text NOT NULL,
  approver_id integer NOT NULL REFERENCES users(id),
  content_fingerprint text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_apu_overrun_amount_chk CHECK(amount > 0),
  CONSTRAINT generic_apu_overrun_currency_chk CHECK(currency ~ '^[A-Z]{3}$'),
  CONSTRAINT generic_apu_overrun_reason_chk CHECK(length(reason) BETWEEN 1 AND 2000)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_apu_overrun_fingerprint_uidx ON generic_apu_overrun_approvals(commitment_version_id,content_fingerprint);
CREATE INDEX IF NOT EXISTS generic_apu_overrun_scope_idx ON generic_apu_overrun_approvals(company_id,project_id,approved_at);

CREATE TABLE IF NOT EXISTS generic_cost_value_plan_versions(
  id text PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  version integer NOT NULL,
  content jsonb NOT NULL,
  evaluation jsonb NOT NULL,
  content_fingerprint text NOT NULL,
  supersedes_id text REFERENCES generic_cost_value_plan_versions(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_cost_value_plan_version_positive_chk CHECK(version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_cost_value_plan_project_version_uidx ON generic_cost_value_plan_versions(project_id,version);
CREATE INDEX IF NOT EXISTS generic_cost_value_plan_project_latest_idx ON generic_cost_value_plan_versions(project_id,version DESC);

CREATE TABLE IF NOT EXISTS generic_cost_value_performance_versions(
  id text PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  plan_version_id text NOT NULL REFERENCES generic_cost_value_plan_versions(id),
  version integer NOT NULL,
  content jsonb NOT NULL,
  evaluation jsonb NOT NULL,
  content_fingerprint text NOT NULL,
  supersedes_id text REFERENCES generic_cost_value_performance_versions(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generic_cost_value_performance_version_positive_chk CHECK(version > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS generic_cost_value_performance_project_version_uidx ON generic_cost_value_performance_versions(project_id,version);
CREATE INDEX IF NOT EXISTS generic_cost_value_performance_project_latest_idx ON generic_cost_value_performance_versions(project_id,version DESC);
`);
    await client.query(`
CREATE OR REPLACE FUNCTION reject_generic_apu_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'generic APU history is append-only';
END $$;

CREATE OR REPLACE FUNCTION guard_generic_apu_template_node() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_version text;
BEGIN
  IF NEW.parent_node_id IS NOT NULL THEN
    SELECT template_version_id INTO parent_version FROM generic_apu_template_nodes WHERE id=NEW.parent_node_id;
    IF parent_version IS DISTINCT FROM NEW.template_version_id THEN
      RAISE EXCEPTION 'generic APU parent node scope mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_generic_project_apu_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE template_row generic_apu_template_versions%ROWTYPE;
DECLARE prior_row generic_project_apu_versions%ROWTYPE;
BEGIN
  SELECT * INTO STRICT template_row FROM generic_apu_template_versions WHERE id=NEW.template_version_id;
  IF template_row.company_id <> NEW.company_id OR (template_row.project_id IS NOT NULL AND template_row.project_id <> NEW.project_id) THEN
    RAISE EXCEPTION 'generic APU template scope mismatch';
  END IF;
  IF template_row.status <> 'published' OR template_row.content_fingerprint <> NEW.template_fingerprint THEN
    RAISE EXCEPTION 'generic APU template version is not an exact published match';
  END IF;
  IF template_row.currency IS NOT NULL AND template_row.currency <> NEW.currency THEN
    RAISE EXCEPTION 'generic APU template currency mismatch';
  END IF;
  IF NEW.supersedes_id IS NULL AND NEW.version <> 1 THEN
    RAISE EXCEPTION 'generic APU initial version must be version one';
  ELSIF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO STRICT prior_row FROM generic_project_apu_versions WHERE id=NEW.supersedes_id;
    IF prior_row.project_apu_id <> NEW.project_apu_id OR prior_row.project_id <> NEW.project_id OR prior_row.company_id <> NEW.company_id OR prior_row.version + 1 <> NEW.version THEN
      RAISE EXCEPTION 'generic APU successor chain mismatch';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_generic_project_apu_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE application_row generic_project_apu_versions%ROWTYPE;
DECLARE node_row generic_apu_template_nodes%ROWTYPE;
BEGIN
  SELECT * INTO STRICT application_row FROM generic_project_apu_versions WHERE id=NEW.project_apu_version_id;
  SELECT * INTO STRICT node_row FROM generic_apu_template_nodes WHERE id=NEW.template_node_id;
  IF node_row.template_version_id <> application_row.template_version_id OR node_row.method <> NEW.method OR NEW.currency <> application_row.currency THEN
    RAISE EXCEPTION 'generic APU applied line does not match its frozen template application';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_generic_apu_commitment_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE application_row generic_project_apu_versions%ROWTYPE;
DECLARE line_row generic_project_apu_lines%ROWTYPE;
DECLARE prior_row generic_apu_commitment_versions%ROWTYPE;
DECLARE authorized boolean;
BEGIN
  SELECT * INTO STRICT application_row FROM generic_project_apu_versions WHERE id=NEW.project_apu_version_id;
  SELECT * INTO STRICT line_row FROM generic_project_apu_lines WHERE id=NEW.project_apu_line_id;
  IF line_row.project_apu_version_id <> NEW.project_apu_version_id OR application_row.company_id <> NEW.company_id OR application_row.project_id <> NEW.project_id OR application_row.currency <> NEW.currency OR line_row.currency <> NEW.currency THEN
    RAISE EXCEPTION 'generic APU commitment scope or currency mismatch';
  END IF;
  IF NEW.supersedes_id IS NULL AND NEW.version <> 1 THEN
    RAISE EXCEPTION 'generic APU initial commitment must be version one';
  ELSIF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO STRICT prior_row FROM generic_apu_commitment_versions WHERE id=NEW.supersedes_id;
    IF prior_row.commitment_id <> NEW.commitment_id OR prior_row.project_id <> NEW.project_id OR prior_row.company_id <> NEW.company_id OR prior_row.version + 1 <> NEW.version THEN
      RAISE EXCEPTION 'generic APU commitment successor chain mismatch';
    END IF;
  END IF;
  IF NEW.approved_by_id IS NOT NULL THEN
    IF NEW.approved_at > now() THEN
      RAISE EXCEPTION 'generic APU commitment approval cannot be future-dated';
    END IF;
    NEW.approved_at := now();
    SELECT EXISTS(
      SELECT 1 FROM financial_authority_grants grant_row
      WHERE grant_row.user_id=NEW.approved_by_id
        AND grant_row.company_id=NEW.company_id
        AND (grant_row.scope_type='company' OR (grant_row.scope_type='project' AND grant_row.project_id=NEW.project_id))
        AND grant_row.authority='cost_approver'
        AND grant_row.effective_from <= now()
        AND (grant_row.effective_to IS NULL OR grant_row.effective_to > now())
        AND NOT EXISTS(
          SELECT 1 FROM financial_authority_revocations revocation
          WHERE revocation.grant_id=grant_row.id AND revocation.revoked_at <= now()
        )
    ) INTO authorized;
    IF NOT authorized THEN
      RAISE EXCEPTION 'generic APU commitment approval requires an effective Finance grant';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_generic_apu_overrun_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE commitment_row generic_apu_commitment_versions%ROWTYPE;
DECLARE authorized boolean;
BEGIN
  SELECT * INTO STRICT commitment_row FROM generic_apu_commitment_versions WHERE id=NEW.commitment_version_id;
  IF commitment_row.state <> 'overrun' OR commitment_row.company_id <> NEW.company_id OR commitment_row.project_id <> NEW.project_id OR commitment_row.currency <> NEW.currency OR commitment_row.amount <> NEW.amount THEN
    RAISE EXCEPTION 'generic APU overrun approval scope, state, currency, or amount mismatch';
  END IF;
  IF commitment_row.created_by_id = NEW.approver_id THEN
    RAISE EXCEPTION 'generic APU overrun maker-checker violation';
  END IF;
  IF NEW.approved_at > now() THEN
    RAISE EXCEPTION 'generic APU overrun approval cannot be future-dated';
  END IF;
  NEW.approved_at := now();
  SELECT EXISTS(
    SELECT 1 FROM financial_authority_grants grant_row
    WHERE grant_row.user_id=NEW.approver_id
      AND grant_row.company_id=NEW.company_id
      AND (grant_row.scope_type='company' OR (grant_row.scope_type='project' AND grant_row.project_id=NEW.project_id))
      AND grant_row.authority='cost_approver'
      AND grant_row.effective_from <= now()
      AND (grant_row.effective_to IS NULL OR grant_row.effective_to > now())
      AND NOT EXISTS(
        SELECT 1 FROM financial_authority_revocations revocation
        WHERE revocation.grant_id=grant_row.id AND revocation.revoked_at <= now()
      )
  ) INTO authorized;
  IF NOT authorized THEN
    RAISE EXCEPTION 'generic APU overrun approval requires an effective Finance grant';
  END IF;
  RETURN NEW;
END $$;

DO $generic_apu_triggers$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_template_node_scope_trigger' AND tgrelid='generic_apu_template_nodes'::regclass) THEN
    CREATE TRIGGER generic_apu_template_node_scope_trigger BEFORE INSERT OR UPDATE ON generic_apu_template_nodes FOR EACH ROW EXECUTE FUNCTION guard_generic_apu_template_node();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_project_apu_insert_trigger' AND tgrelid='generic_project_apu_versions'::regclass) THEN
    CREATE TRIGGER generic_project_apu_insert_trigger BEFORE INSERT ON generic_project_apu_versions FOR EACH ROW EXECUTE FUNCTION guard_generic_project_apu_insert();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_project_apu_line_insert_trigger' AND tgrelid='generic_project_apu_lines'::regclass) THEN
    CREATE TRIGGER generic_project_apu_line_insert_trigger BEFORE INSERT ON generic_project_apu_lines FOR EACH ROW EXECUTE FUNCTION guard_generic_project_apu_line();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_commitment_insert_trigger' AND tgrelid='generic_apu_commitment_versions'::regclass) THEN
    CREATE TRIGGER generic_apu_commitment_insert_trigger BEFORE INSERT ON generic_apu_commitment_versions FOR EACH ROW EXECUTE FUNCTION guard_generic_apu_commitment_insert();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_overrun_approval_insert_trigger' AND tgrelid='generic_apu_overrun_approvals'::regclass) THEN
    CREATE TRIGGER generic_apu_overrun_approval_insert_trigger BEFORE INSERT ON generic_apu_overrun_approvals FOR EACH ROW EXECUTE FUNCTION guard_generic_apu_overrun_approval();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_template_versions_immutable' AND tgrelid='generic_apu_template_versions'::regclass) THEN
    CREATE TRIGGER generic_apu_template_versions_immutable BEFORE UPDATE OR DELETE ON generic_apu_template_versions FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_template_nodes_immutable' AND tgrelid='generic_apu_template_nodes'::regclass) THEN
    CREATE TRIGGER generic_apu_template_nodes_immutable BEFORE UPDATE OR DELETE ON generic_apu_template_nodes FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_project_apu_versions_immutable' AND tgrelid='generic_project_apu_versions'::regclass) THEN
    CREATE TRIGGER generic_project_apu_versions_immutable BEFORE UPDATE OR DELETE ON generic_project_apu_versions FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_project_apu_lines_immutable' AND tgrelid='generic_project_apu_lines'::regclass) THEN
    CREATE TRIGGER generic_project_apu_lines_immutable BEFORE UPDATE OR DELETE ON generic_project_apu_lines FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_commitment_versions_immutable' AND tgrelid='generic_apu_commitment_versions'::regclass) THEN
    CREATE TRIGGER generic_apu_commitment_versions_immutable BEFORE UPDATE OR DELETE ON generic_apu_commitment_versions FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_apu_overrun_approvals_immutable' AND tgrelid='generic_apu_overrun_approvals'::regclass) THEN
    CREATE TRIGGER generic_apu_overrun_approvals_immutable BEFORE UPDATE OR DELETE ON generic_apu_overrun_approvals FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_cost_value_plan_versions_immutable' AND tgrelid='generic_cost_value_plan_versions'::regclass) THEN
    CREATE TRIGGER generic_cost_value_plan_versions_immutable BEFORE UPDATE OR DELETE ON generic_cost_value_plan_versions FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='generic_cost_value_performance_versions_immutable' AND tgrelid='generic_cost_value_performance_versions'::regclass) THEN
    CREATE TRIGGER generic_cost_value_performance_versions_immutable BEFORE UPDATE OR DELETE ON generic_cost_value_performance_versions FOR EACH ROW EXECUTE FUNCTION reject_generic_apu_history_mutation();
  END IF;
END $generic_apu_triggers$;
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
