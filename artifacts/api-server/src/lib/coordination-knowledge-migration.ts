export const COORDINATION_KNOWLEDGE_SCHEMA_VERSION = 3;
export const COORDINATION_KNOWLEDGE_SCHEMA_SQL = String.raw`
CREATE TABLE IF NOT EXISTS coordination_knowledge_taxonomy_terms (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  normalized_key text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_knowledge_taxonomy_scope_uq UNIQUE(id,company_id),
  CONSTRAINT coord_knowledge_taxonomy_key_uq UNIQUE(company_id,kind,normalized_key),
  CONSTRAINT coord_knowledge_taxonomy_kind_chk CHECK (kind IN ('discipline','category','element_type','stage','tag'))
);
CREATE TABLE IF NOT EXISTS coordination_knowledge_taxonomy_term_revisions (
  id text PRIMARY KEY,
  term_id text NOT NULL,
  company_id integer NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  code text NOT NULL,
  label text NOT NULL,
  updated_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_knowledge_taxonomy_revision_scope_fk FOREIGN KEY(term_id,company_id) REFERENCES coordination_knowledge_taxonomy_terms(id,company_id),
  CONSTRAINT coord_knowledge_taxonomy_revision_uq UNIQUE(term_id,revision),
  CONSTRAINT coord_knowledge_taxonomy_revision_scope_uq UNIQUE(id,company_id),
  CONSTRAINT coord_knowledge_taxonomy_revision_positive_chk CHECK (revision>0),
  CONSTRAINT coord_knowledge_taxonomy_status_chk CHECK (status IN ('active','retired')),
  CONSTRAINT coord_knowledge_taxonomy_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$')
);
CREATE INDEX IF NOT EXISTS coord_knowledge_taxonomy_list_idx ON coordination_knowledge_taxonomy_terms(company_id,kind,normalized_key);

CREATE TABLE IF NOT EXISTS coordination_conflict_types (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  code text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_conflict_types_company_code_uq UNIQUE(company_id,code),
  CONSTRAINT coord_conflict_types_id_company_uq UNIQUE(id,company_id),
  CONSTRAINT coord_conflict_types_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$')
);
CREATE TABLE IF NOT EXISTS coordination_conflict_type_revisions (
  id text PRIMARY KEY,
  conflict_type_id text NOT NULL,
  company_id integer NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  name text NOT NULL,
  description text NOT NULL,
  discipline_a text NOT NULL,
  discipline_b text NOT NULL,
  element_type_a text NOT NULL,
  element_type_b text NOT NULL,
  conflict_category text NOT NULL,
  coordination_stage text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  authored_by_id integer NOT NULL REFERENCES users(id),
  approved_by_id integer REFERENCES users(id),
  approved_at timestamptz,
  retired_by_id integer REFERENCES users(id),
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_conflict_type_revision_scope_fk FOREIGN KEY(conflict_type_id,company_id) REFERENCES coordination_conflict_types(id,company_id),
  CONSTRAINT coord_conflict_type_revision_uq UNIQUE(conflict_type_id,revision),
  CONSTRAINT coord_conflict_type_revision_scope_uq UNIQUE(id,company_id),
  CONSTRAINT coord_conflict_type_revision_positive_chk CHECK (revision>0),
  CONSTRAINT coord_conflict_type_status_chk CHECK (status IN ('draft','under_review','approved','retired')),
  CONSTRAINT coord_conflict_type_tags_chk CHECK (jsonb_typeof(tags)='array'),
  CONSTRAINT coord_conflict_type_approval_chk CHECK ((status IN ('approved','retired'))=(approved_by_id IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT coord_conflict_type_retirement_chk CHECK ((status='retired')=(retired_by_id IS NOT NULL AND retired_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coord_conflict_type_status_idx ON coordination_conflict_type_revisions(company_id,status,conflict_type_id);

CREATE TABLE IF NOT EXISTS coordination_rules (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  code text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_rules_company_code_uq UNIQUE(company_id,code),
  CONSTRAINT coord_rules_id_company_uq UNIQUE(id,company_id),
  CONSTRAINT coord_rules_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$')
);
CREATE TABLE IF NOT EXISTS coordination_rule_revisions (
  id text PRIMARY KEY,
  rule_id text NOT NULL,
  company_id integer NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  guidance text NOT NULL,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text NOT NULL,
  exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  "references" jsonb NOT NULL DEFAULT '[]'::jsonb,
  authored_by_id integer NOT NULL REFERENCES users(id),
  approved_by_id integer REFERENCES users(id),
  approved_at timestamptz,
  retired_by_id integer REFERENCES users(id),
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_rule_revision_scope_fk FOREIGN KEY(rule_id,company_id) REFERENCES coordination_rules(id,company_id),
  CONSTRAINT coord_rule_revision_uq UNIQUE(rule_id,revision),
  CONSTRAINT coord_rule_revision_scope_uq UNIQUE(id,company_id),
  CONSTRAINT coord_rule_revision_positive_chk CHECK (revision>0),
  CONSTRAINT coord_rule_status_chk CHECK (status IN ('draft','under_review','approved','retired')),
  CONSTRAINT coord_rule_applicability_chk CHECK (jsonb_typeof(applicability)='object'),
  CONSTRAINT coord_rule_exceptions_chk CHECK (jsonb_typeof(exceptions)='array'),
  CONSTRAINT coord_rule_references_chk CHECK (jsonb_typeof("references")='array'),
  CONSTRAINT coord_rule_approval_chk CHECK ((status IN ('approved','retired'))=(approved_by_id IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT coord_rule_retirement_chk CHECK ((status='retired')=(retired_by_id IS NOT NULL AND retired_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coord_rule_status_idx ON coordination_rule_revisions(company_id,status,rule_id);

CREATE TABLE IF NOT EXISTS coordination_resolution_methods (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  code text NOT NULL,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_methods_company_code_uq UNIQUE(company_id,code),
  CONSTRAINT coord_resolution_methods_id_company_uq UNIQUE(id,company_id),
  CONSTRAINT coord_resolution_methods_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$')
);
CREATE TABLE IF NOT EXISTS coordination_resolution_method_revisions (
  id text PRIMARY KEY,
  resolution_method_id text NOT NULL,
  company_id integer NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  name text NOT NULL,
  description text NOT NULL,
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  responsible_trade text,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  advantages jsonb NOT NULL DEFAULT '[]'::jsonb,
  disadvantages jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  rfi_requirement text NOT NULL DEFAULT 'conditional',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  authored_by_id integer NOT NULL REFERENCES users(id),
  approved_by_id integer REFERENCES users(id),
  approved_at timestamptz,
  retired_by_id integer REFERENCES users(id),
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_revision_scope_fk FOREIGN KEY(resolution_method_id,company_id) REFERENCES coordination_resolution_methods(id,company_id),
  CONSTRAINT coord_resolution_method_revision_uq UNIQUE(resolution_method_id,revision),
  CONSTRAINT coord_resolution_revision_scope_uq UNIQUE(id,company_id),
  CONSTRAINT coord_resolution_revision_positive_chk CHECK (revision>0),
  CONSTRAINT coord_resolution_method_status_chk CHECK (status IN ('draft','under_review','approved','retired')),
  CONSTRAINT coord_resolution_method_applicability_chk CHECK (jsonb_typeof(applicability)='object'),
  CONSTRAINT coord_resolution_method_constraints_chk CHECK (jsonb_typeof(constraints)='array'),
  CONSTRAINT coord_resolution_method_advantages_chk CHECK (jsonb_typeof(advantages)='array'),
  CONSTRAINT coord_resolution_method_disadvantages_chk CHECK (jsonb_typeof(disadvantages)='array'),
  CONSTRAINT coord_resolution_method_approvals_chk CHECK (jsonb_typeof(required_approvals)='array'),
  CONSTRAINT coord_resolution_method_rfi_chk CHECK (rfi_requirement IN ('never','conditional','required')),
  CONSTRAINT coord_resolution_method_details_chk CHECK (jsonb_typeof(details)='object'),
  CONSTRAINT coord_resolution_method_approval_chk CHECK ((status IN ('approved','retired'))=(approved_by_id IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT coord_resolution_method_retirement_chk CHECK ((status='retired')=(retired_by_id IS NOT NULL AND retired_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coord_resolution_method_status_idx ON coordination_resolution_method_revisions(company_id,status,resolution_method_id);

CREATE TABLE IF NOT EXISTS coordination_resolution_method_conflict_types (
  company_id integer NOT NULL,
  resolution_method_revision_id text NOT NULL,
  conflict_type_id text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  linked_by_id integer NOT NULL REFERENCES users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_method_conflict_types_pk PRIMARY KEY(resolution_method_revision_id,conflict_type_id),
  CONSTRAINT coord_resolution_method_revision_scope_fk FOREIGN KEY(resolution_method_revision_id,company_id) REFERENCES coordination_resolution_method_revisions(id,company_id),
  CONSTRAINT coord_resolution_conflict_type_scope_fk FOREIGN KEY(conflict_type_id,company_id) REFERENCES coordination_conflict_types(id,company_id),
  CONSTRAINT coord_resolution_display_order_chk CHECK (display_order>=0)
);
CREATE TABLE IF NOT EXISTS coordination_resolution_method_rules (
  company_id integer NOT NULL,
  resolution_method_revision_id text NOT NULL,
  rule_revision_id text NOT NULL,
  linked_by_id integer NOT NULL REFERENCES users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_method_rules_pk PRIMARY KEY(resolution_method_revision_id,rule_revision_id),
  CONSTRAINT coord_resolution_method_rule_method_fk FOREIGN KEY(resolution_method_revision_id,company_id) REFERENCES coordination_resolution_method_revisions(id,company_id),
  CONSTRAINT coord_resolution_method_rule_scope_fk FOREIGN KEY(rule_revision_id,company_id) REFERENCES coordination_rule_revisions(id,company_id)
);

CREATE TABLE IF NOT EXISTS coordination_project_cases (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  lens_viewpoint_id integer NOT NULL REFERENCES lens_viewpoints(id),
  conflict_type_revision_id text,
  resolution_method_revision_id text,
  status text NOT NULL DEFAULT 'open',
  decision text,
  actual_resolution text,
  created_by_id integer NOT NULL REFERENCES users(id),
  resolved_by_id integer REFERENCES users(id),
  resolved_at timestamptz,
  verified_by_id integer REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_project_case_issue_uq UNIQUE(company_id,project_id,lens_viewpoint_id),
  CONSTRAINT coord_project_case_scope_uq UNIQUE(id,company_id,project_id),
  CONSTRAINT coord_project_case_conflict_revision_fk FOREIGN KEY(conflict_type_revision_id,company_id) REFERENCES coordination_conflict_type_revisions(id,company_id),
  CONSTRAINT coord_project_case_resolution_revision_fk FOREIGN KEY(resolution_method_revision_id,company_id) REFERENCES coordination_resolution_method_revisions(id,company_id),
  CONSTRAINT coord_project_case_status_chk CHECK (status IN ('open','resolved','verified')),
  CONSTRAINT coord_project_case_resolved_chk CHECK ((status IN ('resolved','verified'))=(resolved_by_id IS NOT NULL AND resolved_at IS NOT NULL AND actual_resolution IS NOT NULL)),
  CONSTRAINT coord_project_case_verified_chk CHECK ((status='verified')=(verified_by_id IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coord_project_cases_project_status_idx ON coordination_project_cases(company_id,project_id,status);

CREATE TABLE IF NOT EXISTS coordination_resolution_records (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  project_case_id text NOT NULL,
  lens_viewpoint_id integer NOT NULL REFERENCES lens_viewpoints(id),
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_record_case_scope_fk FOREIGN KEY(project_case_id,company_id,project_id) REFERENCES coordination_project_cases(id,company_id,project_id),
  CONSTRAINT coord_resolution_record_case_uq UNIQUE(company_id,project_id,project_case_id),
  CONSTRAINT coord_resolution_record_issue_uq UNIQUE(company_id,project_id,lens_viewpoint_id),
  CONSTRAINT coord_resolution_record_scope_uq UNIQUE(id,company_id,project_id)
);
CREATE TABLE IF NOT EXISTS coordination_resolution_record_revisions (
  id text PRIMARY KEY,
  resolution_record_id text NOT NULL,
  project_case_id text NOT NULL,
  company_id integer NOT NULL,
  project_id integer NOT NULL,
  lens_viewpoint_id integer NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  method_revision_id text,
  actual_resolution text,
  discipline_changed text,
  responsible_trade text,
  rfi_required boolean NOT NULL DEFAULT false,
  rfi_reference text,
  drawing_submittal_reference text,
  resolved_by_id integer REFERENCES users(id),
  resolution_date timestamptz,
  verified_by_id integer REFERENCES users(id),
  verification_date timestamptz,
  reopen_reason text,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_resolution_record_revision_scope_fk FOREIGN KEY(resolution_record_id,company_id,project_id) REFERENCES coordination_resolution_records(id,company_id,project_id),
  CONSTRAINT coord_resolution_record_revision_case_fk FOREIGN KEY(project_case_id,company_id,project_id) REFERENCES coordination_project_cases(id,company_id,project_id),
  CONSTRAINT coord_resolution_record_revision_method_fk FOREIGN KEY(method_revision_id,company_id) REFERENCES coordination_resolution_method_revisions(id,company_id),
  CONSTRAINT coord_resolution_record_revision_uq UNIQUE(resolution_record_id,revision),
  CONSTRAINT coord_resolution_record_revision_scope_uq UNIQUE(id,company_id,project_id),
  CONSTRAINT coord_resolution_record_revision_positive_chk CHECK (revision>0),
  CONSTRAINT coord_resolution_record_status_chk CHECK (status IN ('draft','completed','verified')),
  CONSTRAINT coord_resolution_record_rfi_chk CHECK (NOT rfi_required OR rfi_reference IS NOT NULL),
  CONSTRAINT coord_resolution_record_completed_chk CHECK (status='draft' OR (actual_resolution IS NOT NULL AND resolved_by_id IS NOT NULL AND resolution_date IS NOT NULL)),
  CONSTRAINT coord_resolution_record_verified_chk CHECK ((status='verified')=(verified_by_id IS NOT NULL AND verification_date IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coord_resolution_record_history_idx ON coordination_resolution_record_revisions(company_id,project_id,lens_viewpoint_id,revision DESC);

CREATE TABLE IF NOT EXISTS coordination_lesson_proposals (
  id text PRIMARY KEY,
  company_id integer NOT NULL,
  project_id integer NOT NULL,
  project_case_id text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  proposal text NOT NULL,
  proposed_by_id integer NOT NULL REFERENCES users(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_id integer REFERENCES users(id),
  reviewed_at timestamptz,
  review_rationale text,
  promoted_entity_type text,
  promoted_entity_id text,
  CONSTRAINT coord_lesson_proposal_case_scope_fk FOREIGN KEY(project_case_id,company_id,project_id) REFERENCES coordination_project_cases(id,company_id,project_id),
  CONSTRAINT coord_lesson_proposal_case_uq UNIQUE(project_case_id),
  CONSTRAINT coord_lesson_proposal_status_chk CHECK (status IN ('proposed','under_review','approved','rejected','merged')),
  CONSTRAINT coord_lesson_review_chk CHECK ((status IN ('approved','rejected','merged'))=(reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL AND review_rationale IS NOT NULL)),
  CONSTRAINT coord_lesson_promotion_pair_chk CHECK ((promoted_entity_type IS NULL)=(promoted_entity_id IS NULL)),
  CONSTRAINT coord_lesson_merge_target_chk CHECK (status<>'merged' OR promoted_entity_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS coord_lesson_proposal_queue_idx ON coordination_lesson_proposals(company_id,status,proposed_at);

CREATE TABLE IF NOT EXISTS coordination_knowledge_evidence (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer NOT NULL REFERENCES projects(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  revision_id text,
  file_id integer NOT NULL REFERENCES files(id),
  evidence_role text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_view_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by_id integer NOT NULL REFERENCES users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_knowledge_evidence_link_uq UNIQUE(company_id,entity_type,entity_id,file_id,evidence_role),
  CONSTRAINT coord_knowledge_evidence_entity_chk CHECK (entity_type IN ('conflict_type','coordination_rule','resolution_method','project_case','lesson_proposal')),
  CONSTRAINT coord_knowledge_evidence_role_chk CHECK (evidence_role IN ('attachment','reference','before','after','supporting'))
);
ALTER TABLE coordination_knowledge_evidence ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE coordination_knowledge_evidence ADD COLUMN IF NOT EXISTS model_view_reference jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS coord_knowledge_evidence_entity_idx ON coordination_knowledge_evidence(company_id,entity_type,entity_id,added_at);
CREATE TABLE IF NOT EXISTS coordination_knowledge_events (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id),
  project_id integer REFERENCES projects(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  revision_id text,
  action text NOT NULL,
  actor_id integer NOT NULL REFERENCES users(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coord_knowledge_events_details_chk CHECK (jsonb_typeof(details)='object')
);
CREATE INDEX IF NOT EXISTS coord_knowledge_events_history_idx ON coordination_knowledge_events(company_id,entity_type,entity_id,created_at);

CREATE OR REPLACE FUNCTION coordination_knowledge_immutable_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Coordination Knowledge revisions and evidence are immutable';
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_conflict_type_revision_immutable') THEN
    CREATE TRIGGER coord_conflict_type_revision_immutable BEFORE UPDATE OR DELETE ON coordination_conflict_type_revisions FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_rule_revision_immutable') THEN
    CREATE TRIGGER coord_rule_revision_immutable BEFORE UPDATE OR DELETE ON coordination_rule_revisions FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_resolution_revision_immutable') THEN
    CREATE TRIGGER coord_resolution_revision_immutable BEFORE UPDATE OR DELETE ON coordination_resolution_method_revisions FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_knowledge_evidence_immutable') THEN
    CREATE TRIGGER coord_knowledge_evidence_immutable BEFORE UPDATE OR DELETE ON coordination_knowledge_evidence FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_knowledge_events_immutable') THEN
    CREATE TRIGGER coord_knowledge_events_immutable BEFORE UPDATE OR DELETE ON coordination_knowledge_events FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_resolution_record_revision_immutable') THEN
    CREATE TRIGGER coord_resolution_record_revision_immutable BEFORE UPDATE OR DELETE ON coordination_resolution_record_revisions FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='coord_knowledge_taxonomy_revision_immutable') THEN
    CREATE TRIGGER coord_knowledge_taxonomy_revision_immutable BEFORE UPDATE OR DELETE ON coordination_knowledge_taxonomy_term_revisions FOR EACH ROW EXECUTE FUNCTION coordination_knowledge_immutable_guard();
  END IF;
END $$;
`;

export type CoordinationKnowledgeMigrationPool = {
  connect(): Promise<{ query(sql: string): Promise<unknown>; release(): void }>;
};

let startup: Promise<void> | null = null;

export async function ensureCoordinationKnowledgeSchema(migrationPool?: CoordinationKnowledgeMigrationPool): Promise<void> {
  if (migrationPool) return runMigration(migrationPool);
  startup ??= import("@workspace/db")
    .then(({ pool }) => runMigration(pool))
    .catch(error => { startup = null; throw error; });
  return startup;
}

async function runMigration(migrationPool: CoordinationKnowledgeMigrationPool): Promise<void> {
  const client = await migrationPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:coordination-knowledge:v1'))");
    await client.query(COORDINATION_KNOWLEDGE_SCHEMA_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
