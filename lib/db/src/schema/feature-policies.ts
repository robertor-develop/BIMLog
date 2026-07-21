import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
const utc = (name: string) => timestamp(name, { withTimezone: true });

export const companyPolicyAuthorityGrantsTable = pgTable("company_policy_authority_grants", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull(),
  userId: integer("user_id").notNull(), effectiveFrom: utc("effective_from").notNull(),
  effectiveTo: utc("effective_to"), grantedById: integer("granted_by_id").notNull(),
  reasonCode: text("reason_code").notNull(), explanationEn: text("explanation_en").notNull(), explanationEs: text("explanation_es").notNull(),
  auditEvidence: jsonb("audit_evidence").$type<Record<string, unknown>>().notNull().default({}), createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [
  index("company_policy_grants_effective_idx").on(t.companyId, t.userId, t.effectiveFrom, t.effectiveTo),
  check("company_policy_grant_dates_chk", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
]);

export const companyPolicyAuthorityRevocationsTable = pgTable("company_policy_authority_revocations", {
  id: text("id").primaryKey(), grantId: text("grant_id").notNull().references(() => companyPolicyAuthorityGrantsTable.id),
  revokedById: integer("revoked_by_id").notNull(), reasonCode: text("reason_code").notNull(),
  explanationEn: text("explanation_en").notNull(), explanationEs: text("explanation_es").notNull(),
  auditEvidence: jsonb("audit_evidence").$type<Record<string, unknown>>().notNull().default({}), createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [unique("company_policy_authority_revocations_grant_id_key").on(t.grantId)]);

export const projectCompanyBindingVersionsTable = pgTable("project_company_binding_versions", {
  id: text("id").primaryKey(), projectId: integer("project_id").notNull(),
  companyId: integer("company_id").notNull(), version: integer("version").notNull(),
  boundById: integer("bound_by_id").notNull(), reasonCode: text("reason_code").notNull(),
  explanationEn: text("explanation_en").notNull(), explanationEs: text("explanation_es").notNull(),
  supersedesBindingId: text("supersedes_binding_id"), auditEvidence: jsonb("audit_evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("project_company_binding_version_uidx").on(t.projectId, t.version),
  index("project_company_binding_company_idx").on(t.companyId, t.projectId, t.version.desc().nullsFirst()),
  check("project_company_binding_versions_version_check", sql`${t.version} > 0`),
  foreignKey({ columns: [t.supersedesBindingId], foreignColumns: [t.id], name: "project_company_binding_versions_supersedes_binding_id_fkey" }),
]);

export const featurePolicyVersionsTable = pgTable("feature_policy_versions", {
  id: text("id").primaryKey(), scopeType: text("scope_type").notNull(), featureKey: text("feature_key").notNull(),
  companyId: integer("company_id").notNull(), projectId: integer("project_id"),
  userId: integer("user_id"), decision: text("decision").notNull(),
  configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}), version: integer("version").notNull(),
  effectiveFrom: utc("effective_from").notNull(), effectiveTo: utc("effective_to"), actorUserId: integer("actor_user_id").notNull(),
  reasonCode: text("reason_code").notNull(), explanationEn: text("explanation_en").notNull(), explanationEs: text("explanation_es").notNull(),
  supersedesVersionId: text("supersedes_version_id"), auditEvidence: jsonb("audit_evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [
  index("feature_policy_effective_idx").on(t.scopeType, t.companyId, t.projectId, t.userId, t.featureKey, t.effectiveFrom, t.effectiveTo, t.version),
  uniqueIndex("feature_policy_company_version_uidx").on(t.companyId, t.featureKey, t.version).where(sql`scope_type = 'company'`),
  uniqueIndex("feature_policy_project_version_uidx").on(t.projectId, t.featureKey, t.version).where(sql`scope_type = 'project'`),
  uniqueIndex("feature_policy_user_version_uidx").on(t.userId, t.featureKey, t.version).where(sql`scope_type = 'user'`),
  check("feature_policy_decision_chk", sql`${t.decision} in ('enabled','disabled','inherit')`),
  check("feature_policy_dates_chk", sql`${t.effectiveTo} IS NULL OR ${t.effectiveTo} > ${t.effectiveFrom}`),
  check("feature_policy_scope_chk", sql`(${t.scopeType} = 'company' AND ${t.projectId} IS NULL AND ${t.userId} IS NULL) OR (${t.scopeType} = 'project' AND ${t.projectId} IS NOT NULL AND ${t.userId} IS NULL) OR (${t.scopeType} = 'user' AND ${t.projectId} IS NULL AND ${t.userId} IS NOT NULL)`),
  check("feature_policy_versions_version_check", sql`${t.version} > 0`),
  foreignKey({ columns: [t.supersedesVersionId], foreignColumns: [t.id], name: "feature_policy_versions_supersedes_version_id_fkey" }),
]);

export const featurePolicyAuditTable = pgTable("feature_policy_audit", {
  id: text("id").primaryKey(), policyVersionId: text("policy_version_id").notNull().references(() => featurePolicyVersionsTable.id),
  scopeType: text("scope_type").notNull(), featureKey: text("feature_key").notNull(), version: integer("version").notNull(),
  actorUserId: integer("actor_user_id").notNull(), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [unique("feature_policy_audit_policy_version_id_key").on(t.policyVersionId), index("feature_policy_audit_scope_idx").on(t.scopeType, t.featureKey, t.createdAt)]);

export type FeaturePolicyVersion = typeof featurePolicyVersionsTable.$inferSelect;
