import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";
import { filesTable } from "./files";
import { jobActivationWorkItemsTable } from "./job-intakes";
import { companyWorkflowGovernancePoliciesTable, companyWorkflowGovernanceVersionsTable } from "./workflow-governance-policies";

export const companyDeliveryWorkflowTemplatesTable = pgTable(
  "company_delivery_workflow_templates",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("company_delivery_workflow_templates_company_id_code_key").on(
      table.companyId,
      table.code,
    ),
    check(
      "company_delivery_workflow_templates_code_check",
      sql`${table.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`,
    ),
  ],
);

export const companyDeliveryWorkflowVersionsTable = pgTable(
  "company_delivery_workflow_versions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => companyDeliveryWorkflowTemplatesTable.id),
    version: integer("version").notNull(),
    state: text("state").notNull().default("draft"),
    revision: integer("revision").notNull().default(1),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    fingerprint: text("fingerprint"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedById: integer("approved_by_id").references(() => usersTable.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedById: integer("published_by_id").references(() => usersTable.id),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredById: integer("retired_by_id").references(() => usersTable.id),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => usersTable.id),
    updatedById: integer("updated_by_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("company_delivery_workflow_versions_template_id_version_key").on(
      table.templateId,
      table.version,
    ),
    uniqueIndex("company_delivery_workflow_one_open_version_uq")
      .on(table.templateId)
      .where(sql`${table.state} IN ('draft','approved')`),
    uniqueIndex("company_delivery_workflow_one_published_version_uq")
      .on(table.templateId)
      .where(sql`${table.state}='published'`),
    check(
      "company_delivery_workflow_versions_version_check",
      sql`${table.version}>0`,
    ),
    check(
      "company_delivery_workflow_versions_revision_check",
      sql`${table.revision}>0`,
    ),
    check(
      "company_delivery_workflow_versions_state_check",
      sql`${table.state} IN ('draft','approved','published','superseded','retired')`,
    ),
    check(
      "company_delivery_workflow_versions_fingerprint_check",
      sql`${table.fingerprint} IS NULL OR ${table.fingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "company_delivery_workflow_approved_chk",
      sql`(${table.state} IN ('approved','published','superseded','retired')) = (${table.approvedAt} IS NOT NULL AND ${table.approvedById} IS NOT NULL AND ${table.fingerprint} IS NOT NULL)`,
    ),
  ],
);

export const companyDeliveryWorkflowEventsTable = pgTable(
  "company_delivery_workflow_events",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id),
    templateId: text("template_id")
      .notNull()
      .references(() => companyDeliveryWorkflowTemplatesTable.id),
    versionId: text("version_id")
      .notNull()
      .references(() => companyDeliveryWorkflowVersionsTable.id),
    action: text("action").notNull(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => usersTable.id),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("company_delivery_workflow_events_history_idx").on(
      table.companyId,
      table.templateId,
      table.createdAt,
    ),
    check(
      "company_delivery_workflow_events_action_check",
      sql`${table.action} IN ('created','edited','approved','published','superseded','retired')`,
    ),
  ],
);

export const companyDeliveryWorkflowWorkItemsTable = pgTable(
  "company_delivery_workflow_work_items",
  {
    workItemId: text("work_item_id")
      .primaryKey()
      .references(() => jobActivationWorkItemsTable.id),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id),
    templateId: text("template_id").references(
      () => companyDeliveryWorkflowTemplatesTable.id,
    ),
    versionId: text("version_id").references(
      () => companyDeliveryWorkflowVersionsTable.id,
    ),
    source: text("source").notNull(),
    templateCode: text("template_code").notNull(),
    templateVersion: integer("template_version").notNull(),
    deliverableType: text("deliverable_type").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    fingerprint: text("fingerprint").notNull(),
    selection: text("selection").notNull(),
    policyId: text("policy_id").references(() => companyWorkflowGovernancePoliciesTable.id),
    policyVersionId: text("policy_version_id").references(() => companyWorkflowGovernanceVersionsTable.id),
    policyCode: text("policy_code"),
    policyVersion: integer("policy_version"),
    policyDefinition: jsonb("policy_definition").$type<Record<string, unknown>>(),
    policyFingerprint: text("policy_fingerprint"),
    phaseIndex: integer("phase_index").notNull().default(1),
    status: text("status").notNull().default("active"),
    revision: integer("revision").notNull().default(1),
    activatedById: integer("activated_by_id")
      .notNull()
      .references(() => usersTable.id),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("company_delivery_workflow_work_item_project_idx").on(
      table.projectId,
      table.workItemId,
    ),
    check(
      "company_delivery_workflow_work_items_source_check",
      sql`${table.source} IN ('bimlog','company')`,
    ),
    check(
      "company_delivery_workflow_work_items_template_version_check",
      sql`${table.templateVersion}>0`,
    ),
    check(
      "company_delivery_workflow_work_items_deliverable_type_check",
      sql`${table.deliverableType} IN ('GENERAL','SHOP_DRAWING','SLEEVE')`,
    ),
    check(
      "company_delivery_workflow_work_items_fingerprint_check",
      sql`${table.fingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "company_delivery_workflow_work_items_selection_check",
      sql`${table.selection} IN ('explicit','single_company','bimlog_default')`,
    ),
    check(
      "company_delivery_workflow_work_items_phase_index_check",
      sql`${table.phaseIndex}>0`,
    ),
    check(
      "company_delivery_workflow_work_items_status_check",
      sql`${table.status} IN ('active','complete')`,
    ),
    check(
      "company_delivery_workflow_work_items_revision_check",
      sql`${table.revision}>0`,
    ),
    check(
      "company_delivery_workflow_binding_source_chk",
      sql`(${table.source}='bimlog' AND ${table.templateId} IS NULL AND ${table.versionId} IS NULL) OR (${table.source}='company' AND ${table.templateId} IS NOT NULL AND ${table.versionId} IS NOT NULL)`,
    ),
    check("company_delivery_workflow_policy_snapshot_chk", sql`(${table.policyId} IS NULL AND ${table.policyVersionId} IS NULL AND ${table.policyCode} IS NULL AND ${table.policyVersion} IS NULL AND ${table.policyDefinition} IS NULL AND ${table.policyFingerprint} IS NULL) OR (${table.policyId} IS NOT NULL AND ${table.policyVersionId} IS NOT NULL AND ${table.policyCode} IS NOT NULL AND ${table.policyVersion}>0 AND ${table.policyDefinition} IS NOT NULL AND ${table.policyFingerprint} ~ '^[a-f0-9]{64}$')`),
  ],
);

export const companyDeliveryWorkflowStepsTable = pgTable(
  "company_delivery_workflow_steps",
  {
    workItemId: text("work_item_id")
      .notNull()
      .references(() => companyDeliveryWorkflowWorkItemsTable.workItemId),
    phaseId: text("phase_id").notNull(),
    taskId: text("task_id").notNull(),
    status: text("status").notNull().default("pending"),
    revision: integer("revision").notNull().default(1),
    completedById: integer("completed_by_id").references(() => usersTable.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.workItemId, table.phaseId, table.taskId],
      name: "company_delivery_workflow_steps_pkey",
    }),
    check(
      "company_delivery_workflow_steps_status_check",
      sql`${table.status} IN ('pending','complete')`,
    ),
    check(
      "company_delivery_workflow_steps_revision_check",
      sql`${table.revision}>0`,
    ),
  ],
);

export const companyDeliveryWorkflowRolesTable = pgTable(
  "company_delivery_workflow_roles",
  {
    workItemId: text("work_item_id")
      .notNull()
      .references(() => companyDeliveryWorkflowWorkItemsTable.workItemId),
    role: text("role").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    assignedById: integer("assigned_by_id")
      .notNull()
      .references(() => usersTable.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.workItemId, table.role],
      name: "company_delivery_workflow_roles_pkey",
    }),
    check(
      "company_delivery_workflow_roles_role_check",
      sql`${table.role} IN ('execute','review','approve')`,
    ),
  ],
);

export const companyDeliveryWorkflowEvidenceTable = pgTable(
  "company_delivery_workflow_evidence",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => companyDeliveryWorkflowWorkItemsTable.workItemId),
    phaseId: text("phase_id").notNull(),
    taskId: text("task_id").notNull(),
    documentCode: text("document_code").notNull(),
    fileId: integer("file_id")
      .notNull()
      .references(() => filesTable.id),
    linkedById: integer("linked_by_id")
      .notNull()
      .references(() => usersTable.id),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("company_delivery_workflow_evidence_unique").on(
      table.workItemId,
      table.phaseId,
      table.taskId,
      table.documentCode,
      table.fileId,
    ),
  ],
);

export const companyDeliveryWorkflowPhaseChecksTable = pgTable(
  "company_delivery_workflow_phase_checks",
  {
    workItemId: text("work_item_id")
      .notNull()
      .references(() => companyDeliveryWorkflowWorkItemsTable.workItemId),
    phaseId: text("phase_id").notNull(),
    qcApprovedById: integer("qc_approved_by_id").references(
      () => usersTable.id,
    ),
    qcApprovedAt: timestamp("qc_approved_at", { withTimezone: true }),
    approvedById: integer("approved_by_id").references(() => usersTable.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.workItemId, table.phaseId],
      name: "company_delivery_workflow_phase_checks_pkey",
    }),
  ],
);

export const companyDeliveryWorkflowWorkItemEventsTable = pgTable(
  "company_delivery_workflow_work_item_events",
  {
    id: text("id").primaryKey(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => companyDeliveryWorkflowWorkItemsTable.workItemId),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id),
    action: text("action").notNull(),
    phaseId: text("phase_id"),
    taskId: text("task_id"),
    actorId: integer("actor_id")
      .notNull()
      .references(() => usersTable.id),
    beforeState: text("before_state"),
    afterState: text("after_state"),
    reason: text("reason"),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("company_delivery_workflow_work_item_event_idx").on(
      table.workItemId,
      table.createdAt,
      table.id,
    ),
  ],
);
