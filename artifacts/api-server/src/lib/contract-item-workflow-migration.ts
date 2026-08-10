import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;

export function startContractItemWorkflowMigration() {
  if (!ready) ready = migrate();
  return ready;
}

export async function waitForContractItemWorkflowMigration() {
  await startContractItemWorkflowMigration();
}

async function migrate() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS contract_item_workflows(
  id text PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  contract_id text NOT NULL REFERENCES financial_contracts(id),
  contract_version_id text NOT NULL REFERENCES financial_contract_versions(id),
  stable_line_id text NOT NULL,
  display_name text NOT NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  revision integer NOT NULL DEFAULT 1,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_item_workflow_status_chk CHECK(status IN('active','completed','cancelled')),
  CONSTRAINT contract_item_workflow_revision_positive_chk CHECK(revision>0),
  CONSTRAINT contract_item_workflows_version_line_key UNIQUE(contract_version_id,stable_line_id)
);
CREATE TABLE IF NOT EXISTS contract_item_workflow_nodes(
  id text PRIMARY KEY,
  workflow_id text NOT NULL REFERENCES contract_item_workflows(id),
  parent_id text,
  node_type text NOT NULL,
  name text NOT NULL,
  sequence integer NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  due_date date,
  assignee_user_id integer REFERENCES users(id),
  revision integer NOT NULL DEFAULT 1,
  created_by_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_item_workflow_node_type_chk CHECK(node_type IN('phase','revision','version','task')),
  CONSTRAINT contract_item_workflow_node_status_chk CHECK(status IN('not_started','in_progress','blocked','complete','cancelled')),
  CONSTRAINT contract_item_workflow_node_sequence_positive_chk CHECK(sequence>0),
  CONSTRAINT contract_item_workflow_node_revision_positive_chk CHECK(revision>0)
);
CREATE TABLE IF NOT EXISTS contract_item_workflow_events(
  id text PRIMARY KEY,
  workflow_id text NOT NULL REFERENCES contract_item_workflows(id),
  node_id text,
  actor_user_id integer NOT NULL REFERENCES users(id),
  event_type text NOT NULL,
  before_state text,
  after_state text,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_item_workflow_project_idx ON contract_item_workflows(project_id,contract_id,updated_at);
CREATE INDEX IF NOT EXISTS contract_item_workflow_node_tree_idx ON contract_item_workflow_nodes(workflow_id,parent_id,sequence);
CREATE INDEX IF NOT EXISTS contract_item_workflow_event_scope_idx ON contract_item_workflow_events(workflow_id,occurred_at);
`);
}
