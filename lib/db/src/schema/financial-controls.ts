import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
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
  (t) => [uniqueIndex("financial_grant_revocation_uidx").on(t.grantId)],
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
  ],
);
