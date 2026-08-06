import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

const exactAmount = (name: string) =>
  numeric(name, { precision: 30, scale: 6 });

/**
 * Additive Generic APU schema candidate. It is intentionally not exported by
 * the schema barrel and does not execute a migration by being imported.
 */
export const genericApuTemplateVersionsTable = pgTable(
  "generic_apu_template_versions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    industry: text("industry").notNull(),
    status: text("status").notNull(),
    currency: text("currency"),
    reason: text("reason").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    publishedById: integer("published_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.supersedesId],
      foreignColumns: [table.id],
      name: "generic_apu_template_supersedes_fk",
    }),
    uniqueIndex("generic_apu_template_version_uidx").on(
      table.templateId,
      table.version,
    ),
    uniqueIndex("generic_apu_template_fingerprint_uidx").on(
      table.companyId,
      table.contentFingerprint,
    ),
    index("generic_apu_template_scope_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    check("generic_apu_template_version_positive_chk", sql`${table.version} > 0`),
    check(
      "generic_apu_template_status_chk",
      sql`${table.status} IN ('draft','published','superseded','retired')`,
    ),
    check(
      "generic_apu_template_currency_chk",
      sql`${table.currency} IS NULL OR ${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "generic_apu_template_reason_chk",
      sql`length(${table.reason}) BETWEEN 1 AND 2000`,
    ),
    check(
      "generic_apu_template_publish_chk",
      sql`(${table.status}='draft' AND ${table.publishedById} IS NULL AND ${table.publishedAt} IS NULL) OR (${table.status}<>'draft' AND ${table.publishedById} IS NOT NULL AND ${table.publishedAt} IS NOT NULL)`,
    ),
    check(
      "generic_apu_template_maker_checker_chk",
      sql`${table.publishedById} IS NULL OR ${table.publishedById} <> ${table.createdById}`,
    ),
  ],
);

export const genericApuTemplateNodesTable = pgTable(
  "generic_apu_template_nodes",
  {
    id: text("id").primaryKey(),
    templateVersionId: text("template_version_id")
      .references(() => genericApuTemplateVersionsTable.id)
      .notNull(),
    stableNodeId: text("stable_node_id").notNull(),
    parentNodeId: text("parent_node_id"),
    method: text("method").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    formula: text("formula"),
    percent: exactAmount("percent"),
    quantity: exactAmount("quantity"),
    unitCost: exactAmount("unit_cost"),
    hours: exactAmount("hours"),
    hourlyRate: exactAmount("hourly_rate"),
    currency: text("currency"),
    sortOrder: integer("sort_order").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentNodeId],
      foreignColumns: [table.id],
      name: "generic_apu_node_parent_fk",
    }),
    uniqueIndex("generic_apu_node_stable_uidx").on(
      table.templateVersionId,
      table.stableNodeId,
    ),
    uniqueIndex("generic_apu_node_order_uidx").on(
      table.templateVersionId,
      table.sortOrder,
    ),
    index("generic_apu_node_parent_idx").on(
      table.templateVersionId,
      table.parentNodeId,
    ),
    check(
      "generic_apu_node_method_chk",
      sql`${table.method} IN ('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula')`,
    ),
    check(
      "generic_apu_node_currency_chk",
      sql`${table.currency} IS NULL OR ${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check("generic_apu_node_sort_chk", sql`${table.sortOrder} >= 0`),
    check(
      "generic_apu_node_operands_chk",
      sql`(
        (${table.method}='fixed_amount' AND ${table.unitCost} IS NOT NULL AND ${table.formula} IS NULL AND ${table.percent} IS NULL AND ${table.quantity} IS NULL AND ${table.hours} IS NULL AND ${table.hourlyRate} IS NULL) OR
        (${table.method}='quantity_unit_cost' AND ${table.quantity} IS NOT NULL AND ${table.unitCost} IS NOT NULL AND ${table.formula} IS NULL AND ${table.percent} IS NULL AND ${table.hours} IS NULL AND ${table.hourlyRate} IS NULL) OR
        (${table.method}='hours_hourly_rate' AND ${table.hours} IS NOT NULL AND ${table.hourlyRate} IS NOT NULL AND ${table.formula} IS NULL AND ${table.percent} IS NULL AND ${table.quantity} IS NULL AND ${table.unitCost} IS NULL) OR
        (${table.method}='percentage_of_parent' AND ${table.parentNodeId} IS NOT NULL AND ${table.percent} IS NOT NULL AND ${table.formula} IS NULL AND ${table.quantity} IS NULL AND ${table.unitCost} IS NULL AND ${table.hours} IS NULL AND ${table.hourlyRate} IS NULL) OR
        (${table.method}='allocation_group' AND ${table.formula} IS NULL AND ${table.percent} IS NULL AND ${table.quantity} IS NULL AND ${table.unitCost} IS NULL AND ${table.hours} IS NULL AND ${table.hourlyRate} IS NULL) OR
        (${table.method}='formula' AND ${table.formula} IS NOT NULL AND ${table.percent} IS NULL AND ${table.quantity} IS NULL AND ${table.unitCost} IS NULL AND ${table.hours} IS NULL AND ${table.hourlyRate} IS NULL)
      )`,
    ),
  ],
);

export const genericProjectApuVersionsTable = pgTable(
  "generic_project_apu_versions",
  {
    id: text("id").primaryKey(),
    projectApuId: text("project_apu_id").notNull(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    templateVersionId: text("template_version_id")
      .references(() => genericApuTemplateVersionsTable.id)
      .notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    currency: text("currency").notNull(),
    templateFingerprint: text("template_fingerprint").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    appliedById: integer("applied_by_id")
      .references(() => usersTable.id)
      .notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.supersedesId],
      foreignColumns: [table.id],
      name: "generic_project_apu_supersedes_fk",
    }),
    uniqueIndex("generic_project_apu_version_uidx").on(
      table.projectApuId,
      table.version,
    ),
    uniqueIndex("generic_project_apu_idempotency_uidx").on(
      table.projectId,
      table.idempotencyKey,
    ),
    index("generic_project_apu_scope_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    check("generic_project_apu_version_positive_chk", sql`${table.version} > 0`),
    check(
      "generic_project_apu_status_chk",
      sql`${table.status} IN ('draft','calculated','overrun_review_required','locked','superseded','void')`,
    ),
    check("generic_project_apu_currency_chk", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const genericCostValuePlanVersionsTable = pgTable(
  "generic_cost_value_plan_versions",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    version: integer("version").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    evaluation: jsonb("evaluation").$type<Record<string, unknown>>().notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.supersedesId],
      foreignColumns: [table.id],
      name: "generic_cost_value_plan_supersedes_fk",
    }),
    uniqueIndex("generic_cost_value_plan_project_version_uidx").on(table.projectId, table.version),
    index("generic_cost_value_plan_project_latest_idx").on(table.projectId, table.version),
    check("generic_cost_value_plan_version_positive_chk", sql`${table.version} > 0`),
  ],
);

export const genericProjectApuLinesTable = pgTable(
  "generic_project_apu_lines",
  {
    id: text("id").primaryKey(),
    projectApuVersionId: text("project_apu_version_id")
      .references(() => genericProjectApuVersionsTable.id)
      .notNull(),
    templateNodeId: text("template_node_id")
      .references(() => genericApuTemplateNodesTable.id)
      .notNull(),
    stableLineId: text("stable_line_id").notNull(),
    method: text("method").notNull(),
    rawInputs: jsonb("raw_inputs")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    rawAmount: text("raw_amount").notNull(),
    roundedAmount: numeric("rounded_amount", { precision: 30, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    sortOrder: integer("sort_order").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("generic_project_apu_line_stable_uidx").on(
      table.projectApuVersionId,
      table.stableLineId,
    ),
    uniqueIndex("generic_project_apu_line_order_uidx").on(
      table.projectApuVersionId,
      table.sortOrder,
    ),
    check(
      "generic_project_apu_line_method_chk",
      sql`${table.method} IN ('fixed_amount','quantity_unit_cost','hours_hourly_rate','percentage_of_parent','allocation_group','formula')`,
    ),
    check(
      "generic_project_apu_line_raw_amount_chk",
      sql`${table.rawAmount} ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'`,
    ),
    check("generic_project_apu_line_currency_chk", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("generic_project_apu_line_sort_chk", sql`${table.sortOrder} >= 0`),
  ],
);

export const genericApuCommitmentVersionsTable = pgTable(
  "generic_apu_commitment_versions",
  {
    id: text("id").primaryKey(),
    commitmentId: text("commitment_id").notNull(),
    version: integer("version").notNull(),
    projectApuVersionId: text("project_apu_version_id")
      .references(() => genericProjectApuVersionsTable.id)
      .notNull(),
    projectApuLineId: text("project_apu_line_id")
      .references(() => genericProjectApuLinesTable.id)
      .notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    assignmentRef: text("assignment_ref").notNull(),
    amount: exactAmount("amount").notNull(),
    currency: text("currency").notNull(),
    state: text("state").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    approvedById: integer("approved_by_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.supersedesId],
      foreignColumns: [table.id],
      name: "generic_apu_commitment_supersedes_fk",
    }),
    uniqueIndex("generic_apu_commitment_version_uidx").on(
      table.commitmentId,
      table.version,
    ),
    uniqueIndex("generic_apu_commitment_idempotency_uidx").on(
      table.projectId,
      table.idempotencyKey,
    ),
    index("generic_apu_commitment_line_idx").on(
      table.projectApuLineId,
      table.createdAt,
    ),
    check("generic_apu_commitment_version_positive_chk", sql`${table.version} > 0`),
    check("generic_apu_commitment_amount_chk", sql`${table.amount} > 0`),
    check(
      "generic_apu_commitment_state_chk",
      sql`${table.state} IN ('original','committed','approved','paid_released','remaining','overrun')`,
    ),
    check("generic_apu_commitment_currency_chk", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "generic_apu_commitment_approval_chk",
      sql`(${table.state} IN ('approved','paid_released','overrun') AND ${table.approvedById} IS NOT NULL AND ${table.approvedAt} IS NOT NULL) OR (${table.state} NOT IN ('approved','paid_released','overrun') AND ${table.approvedById} IS NULL AND ${table.approvedAt} IS NULL)`,
    ),
    check(
      "generic_apu_commitment_maker_checker_chk",
      sql`${table.approvedById} IS NULL OR ${table.approvedById} <> ${table.createdById}`,
    ),
  ],
);

export const genericApuOverrunApprovalsTable = pgTable(
  "generic_apu_overrun_approvals",
  {
    id: text("id").primaryKey(),
    commitmentVersionId: text("commitment_version_id")
      .references(() => genericApuCommitmentVersionsTable.id)
      .notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    amount: exactAmount("amount").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    approverId: integer("approver_id")
      .references(() => usersTable.id)
      .notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("generic_apu_overrun_fingerprint_uidx").on(
      table.commitmentVersionId,
      table.contentFingerprint,
    ),
    index("generic_apu_overrun_scope_idx").on(
      table.companyId,
      table.projectId,
      table.approvedAt,
    ),
    check("generic_apu_overrun_amount_chk", sql`${table.amount} > 0`),
    check("generic_apu_overrun_currency_chk", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "generic_apu_overrun_reason_chk",
      sql`length(${table.reason}) BETWEEN 1 AND 2000`,
    ),
  ],
);
