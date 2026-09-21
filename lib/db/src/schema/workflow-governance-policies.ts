import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable, usersTable } from "./users";

export const companyWorkflowGovernancePoliciesTable = pgTable("company_workflow_governance_policies", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique("company_workflow_governance_policies_company_code_uq").on(table.companyId, table.code),
  check("company_workflow_governance_policies_code_check", sql`${table.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`),
]);

export const companyWorkflowGovernanceVersionsTable = pgTable("company_workflow_governance_versions", {
  id: text("id").primaryKey(),
  policyId: text("policy_id").notNull().references(() => companyWorkflowGovernancePoliciesTable.id),
  version: integer("version").notNull(),
  state: text("state").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
  fingerprint: text("fingerprint"),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedById: integer("published_by_id").references(() => usersTable.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  retiredById: integer("retired_by_id").references(() => usersTable.id),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  updatedById: integer("updated_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique("company_workflow_governance_versions_policy_version_uq").on(table.policyId, table.version),
  uniqueIndex("company_workflow_governance_one_open_uq").on(table.policyId).where(sql`${table.state} IN ('draft','approved')`),
  uniqueIndex("company_workflow_governance_one_published_uq").on(table.policyId).where(sql`${table.state}='published'`),
  check("company_workflow_governance_versions_version_chk", sql`${table.version}>0`),
  check("company_workflow_governance_versions_revision_check", sql`${table.revision}>0`),
  check("company_workflow_governance_versions_state_check", sql`${table.state} IN ('draft','approved','published','superseded','retired')`),
  check("company_workflow_governance_versions_fingerprint_check", sql`${table.fingerprint} IS NULL OR ${table.fingerprint} ~ '^[a-f0-9]{64}$'`),
  check("company_workflow_governance_versions_approved_chk", sql`(${table.state} IN ('approved','published','superseded','retired')) = (${table.approvedById} IS NOT NULL AND ${table.approvedAt} IS NOT NULL AND ${table.fingerprint} IS NOT NULL)`),
]);

export const companyWorkflowGovernanceEventsTable = pgTable("company_workflow_governance_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  policyId: text("policy_id").notNull().references(() => companyWorkflowGovernancePoliciesTable.id),
  versionId: text("version_id").notNull().references(() => companyWorkflowGovernanceVersionsTable.id),
  action: text("action").notNull(),
  actorId: integer("actor_id").notNull().references(() => usersTable.id),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("company_workflow_governance_events_history_idx").on(table.companyId, table.policyId, table.createdAt),
  check("company_workflow_governance_events_action_check", sql`${table.action} IN ('created','edited','approved','published','superseded','retired')`),
]);
