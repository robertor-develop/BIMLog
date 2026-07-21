import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable, companiesTable } from "./users";
import { projectsTable } from "./projects";

export const financialContextVersionsTable = pgTable(
  "financial_context_versions",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    scopeType: text("scope_type").notNull(),
    version: integer("version").notNull(),
    baseCurrency: text("base_currency").notNull(),
    reportingCurrency: text("reporting_currency").notNull(),
    permittedTransactionCurrencies: jsonb("permitted_transaction_currencies")
      .$type<string[]>()
      .notNull(),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    supersedesId: text("supersedes_id"),
    reason: text("reason").notNull(),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("financial_context_scope_version_uidx").on(
      t.companyId,
      sql`coalesce(${t.projectId}, 0)`,
      t.version,
    ),
    index("financial_context_effective_idx").on(
      t.companyId,
      t.projectId,
      t.effectiveFrom,
      t.effectiveTo,
    ),
    check("financial_context_scope_chk", sql`${t.scopeType} = ANY (ARRAY['company'::text, 'project'::text])`),
    check("financial_context_project_chk", sql`(${t.scopeType} = 'company' AND ${t.projectId} IS NULL) OR (${t.scopeType} = 'project' AND ${t.projectId} IS NOT NULL)`),
    check("financial_context_dates_chk", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    check("financial_context_reason_chk", sql`length(${t.reason}) >= 3 AND length(${t.reason}) <= 1000`),
  ],
);

export const financialAuthorityGrantsTable = pgTable(
  "financial_authority_grants",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    scopeType: text("scope_type").notNull(),
    authority: text("authority").notNull(),
    version: integer("version").notNull(),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    reason: text("reason").notNull(),
    grantedById: integer("granted_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("financial_grant_version_uidx").on(
      t.userId,
      t.companyId,
      sql`coalesce(${t.projectId}, 0)`,
      t.authority,
      t.version,
    ),
    index("financial_grant_effective_idx").on(
      t.userId,
      t.companyId,
      t.projectId,
      t.effectiveFrom,
      t.effectiveTo,
    ),
    check("financial_grant_scope_chk", sql`${t.scopeType} = ANY (ARRAY['company'::text, 'project'::text])`),
    check("financial_grant_project_chk", sql`(${t.scopeType} = 'company' AND ${t.projectId} IS NULL) OR (${t.scopeType} = 'project' AND ${t.projectId} IS NOT NULL)`),
    check("financial_grant_authority_chk", sql`${t.authority} = ANY (ARRAY['financial_viewer'::text, 'cost_preparer'::text, 'cost_reviewer'::text, 'cost_approver'::text, 'financial_administrator'::text, 'auditor'::text])`),
    check("financial_grant_dates_chk", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    check("financial_grant_reason_chk", sql`length(${t.reason}) >= 3 AND length(${t.reason}) <= 1000`),
  ],
);

export const financialAuthorityRevocationsTable = pgTable(
  "financial_authority_revocations",
  {
    id: text("id").primaryKey(),
    grantId: text("grant_id")
      .references(() => financialAuthorityGrantsTable.id)
      .notNull(),
    reason: text("reason").notNull(),
    revokedById: integer("revoked_by_id")
      .references(() => usersTable.id)
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("financial_authority_revocations_grant_id_key").on(t.grantId),
    check("financial_revocation_reason_chk", sql`length(${t.reason}) >= 3 AND length(${t.reason}) <= 1000`),
  ],
);

export const financialApprovalPolicyVersionsTable = pgTable(
  "financial_approval_policy_versions",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    scopeType: text("scope_type").notNull(),
    transactionCategory: text("transaction_category").notNull(),
    currency: text("currency").notNull(),
    maxAmount: numeric("max_amount", { precision: 30, scale: 6 }).notNull(),
    version: integer("version").notNull(),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    supersedesId: text("supersedes_id"),
    state: text("state").notNull(),
    reason: text("reason").notNull(),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("financial_policy_scope_version_uidx").on(
      t.companyId,
      sql`coalesce(${t.projectId}, 0)`,
      t.transactionCategory,
      t.currency,
      t.version,
    ),
    index("financial_policy_effective_idx").on(
      t.companyId,
      t.projectId,
      t.transactionCategory,
      t.currency,
      t.effectiveFrom,
      t.effectiveTo,
    ),
    check("financial_policy_scope_chk", sql`${t.scopeType} = ANY (ARRAY['company'::text, 'project'::text])`),
    check("financial_policy_project_chk", sql`(${t.scopeType} = 'company' AND ${t.projectId} IS NULL) OR (${t.scopeType} = 'project' AND ${t.projectId} IS NOT NULL)`),
    check("financial_policy_currency_chk", sql`${t.currency} ~ '^[A-Z]{3}$'::text`),
    check("financial_policy_amount_chk", sql`${t.maxAmount} >= (0)::numeric`),
    check("financial_policy_state_chk", sql`${t.state} = ANY (ARRAY['active'::text, 'revoked'::text])`),
    check("financial_policy_dates_chk", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
    check("financial_policy_reason_chk", sql`length(${t.reason}) >= 3 AND length(${t.reason}) <= 1000`),
  ],
);

export const financialSuspensionEventsTable = pgTable(
  "financial_suspension_events",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    scopeType: text("scope_type").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    actorUserId: integer("actor_user_id")
      .references(() => usersTable.id)
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("financial_suspension_scope_time_idx").on(
      t.companyId,
      t.projectId,
      t.occurredAt,
    ),
    check("financial_suspension_scope_chk", sql`${t.scopeType} = ANY (ARRAY['company'::text, 'project'::text])`),
    check("financial_suspension_project_chk", sql`(${t.scopeType} = 'company' AND ${t.projectId} IS NULL) OR (${t.scopeType} = 'project' AND ${t.projectId} IS NOT NULL)`),
    check("financial_suspension_action_chk", sql`${t.action} = ANY (ARRAY['activate'::text, 'release'::text])`),
    check("financial_suspension_reason_chk", sql`length(${t.reason}) >= 3 AND length(${t.reason}) <= 1000`),
  ],
);

export const financialAuthorityJournalTable = pgTable(
  "financial_authority_journal",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    actorUserId: integer("actor_user_id")
      .references(() => usersTable.id)
      .notNull(),
    subjectUserId: integer("subject_user_id").references(() => usersTable.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    entityVersion: integer("entity_version"),
    decision: text("decision"),
    reasonCode: text("reason_code").notNull(),
    explanationEn: text("explanation_en").notNull(),
    explanationEs: text("explanation_es").notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("financial_journal_scope_time_idx").on(
      t.companyId,
      t.projectId,
      t.occurredAt,
    ),
    index("financial_journal_subject_time_idx").on(
      t.subjectUserId,
      t.occurredAt,
    ),
    check("financial_journal_decision_chk", sql`${t.decision} IS NULL OR ${t.decision} = ANY (ARRAY['allow'::text, 'deny'::text])`),
    check("financial_journal_explanation_chk", sql`(length(${t.explanationEn}) >= 1 AND length(${t.explanationEn}) <= 1000) AND (length(${t.explanationEs}) >= 1 AND length(${t.explanationEs}) <= 1000)`),
  ],
);
