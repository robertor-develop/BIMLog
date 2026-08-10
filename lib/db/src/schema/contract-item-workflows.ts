import { check, date, foreignKey, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { financialContractsTable, financialContractVersionsTable } from "./financial-contracts";

export const contractItemWorkflowsTable = pgTable("contract_item_workflows", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  contractId: text("contract_id").notNull(),
  contractVersionId: text("contract_version_id").notNull(),
  stableLineId: text("stable_line_id").notNull(),
  displayName: text("display_name").notNull(),
  templateKey: text("template_key").notNull(),
  status: text("status").notNull().default("active"),
  revision: integer("revision").notNull().default(1),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("contract_item_workflows_version_line_key").on(t.contractVersionId, t.stableLineId),
  foreignKey({ columns: [t.projectId], foreignColumns: [projectsTable.id], name: "contract_item_workflows_project_id_fkey" }),
  foreignKey({ columns: [t.contractId], foreignColumns: [financialContractsTable.id], name: "contract_item_workflows_contract_id_fkey" }),
  foreignKey({ columns: [t.contractVersionId], foreignColumns: [financialContractVersionsTable.id], name: "contract_item_workflows_contract_version_id_fkey" }),
  foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "contract_item_workflows_created_by_id_fkey" }),
  check("contract_item_workflow_status_chk", sql`${t.status} IN ('active','completed','cancelled')`),
  check("contract_item_workflow_revision_positive_chk", sql`${t.revision} > 0`),
  index("contract_item_workflow_project_idx").on(t.projectId, t.contractId, t.updatedAt),
]);

export const contractItemWorkflowNodesTable = pgTable("contract_item_workflow_nodes", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  parentId: text("parent_id"),
  nodeType: text("node_type").notNull(),
  name: text("name").notNull(),
  sequence: integer("sequence").notNull(),
  status: text("status").notNull().default("not_started"),
  dueDate: date("due_date"),
  assigneeUserId: integer("assignee_user_id"),
  revision: integer("revision").notNull().default(1),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.workflowId], foreignColumns: [contractItemWorkflowsTable.id], name: "contract_item_workflow_nodes_workflow_id_fkey" }),
  foreignKey({ columns: [t.assigneeUserId], foreignColumns: [usersTable.id], name: "contract_item_workflow_nodes_assignee_user_id_fkey" }),
  foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "contract_item_workflow_nodes_created_by_id_fkey" }),
  check("contract_item_workflow_node_type_chk", sql`${t.nodeType} IN ('phase','revision','version','task')`),
  check("contract_item_workflow_node_status_chk", sql`${t.status} IN ('not_started','in_progress','blocked','complete','cancelled')`),
  check("contract_item_workflow_node_sequence_positive_chk", sql`${t.sequence} > 0`),
  check("contract_item_workflow_node_revision_positive_chk", sql`${t.revision} > 0`),
  index("contract_item_workflow_node_tree_idx").on(t.workflowId, t.parentId, t.sequence),
]);

export const contractItemWorkflowEventsTable = pgTable("contract_item_workflow_events", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull(),
  nodeId: text("node_id"),
  actorUserId: integer("actor_user_id").notNull(),
  eventType: text("event_type").notNull(),
  beforeState: text("before_state"),
  afterState: text("after_state"),
  reason: text("reason").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.workflowId], foreignColumns: [contractItemWorkflowsTable.id], name: "contract_item_workflow_events_workflow_id_fkey" }),
  foreignKey({ columns: [t.actorUserId], foreignColumns: [usersTable.id], name: "contract_item_workflow_events_actor_user_id_fkey" }),
  index("contract_item_workflow_event_scope_idx").on(t.workflowId, t.occurredAt),
]);

export type ContractItemWorkflow = typeof contractItemWorkflowsTable.$inferSelect;
export type ContractItemWorkflowNode = typeof contractItemWorkflowNodesTable.$inferSelect;
