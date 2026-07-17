import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

const utc = (name: string) => timestamp(name, { withTimezone: true });

export const featureCatalogVersionsTable = pgTable("feature_catalog_versions", {
  id: text("id").primaryKey(),
  featureKey: text("feature_key").notNull(),
  version: integer("version").notNull(),
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionEs: text("description_es").notNull(),
  productFamily: text("product_family").notNull(),
  module: text("module").notNull(),
  capabilityStatus: text("capability_status").notNull(),
  tierAvailability: jsonb("tier_availability").$type<string[]>().notNull().default([]),
  bundleDependencies: jsonb("bundle_dependencies").$type<string[]>().notNull().default([]),
  eligibleSeatClasses: jsonb("eligible_seat_classes").$type<string[]>().notNull().default([]),
  requiredScopedAuthorities: jsonb("required_scoped_authorities").$type<string[]>().notNull().default([]),
  supportsCompanyPolicy: boolean("supports_company_policy").notNull().default(false),
  supportsProjectPolicy: boolean("supports_project_policy").notNull().default(false),
  supportsUserPreference: boolean("supports_user_preference").notNull().default(false),
  policyConfigurationKeys: jsonb("policy_configuration_keys").$type<string[]>().notNull().default([]),
  aiClassification: text("ai_classification").notNull(),
  supportedCreditPayers: jsonb("supported_credit_payers").$type<string[]>().notNull().default([]),
  meteringPolicyKey: text("metering_policy_key"),
  confirmationRequirements: jsonb("confirmation_requirements").$type<string[]>().notNull().default([]),
  fileReading: boolean("file_reading").notNull().default(false),
  externalDelivery: boolean("external_delivery").notNull().default(false),
  auditRequirements: jsonb("audit_requirements").$type<string[]>().notNull().default([]),
  authorizedDataScope: jsonb("authorized_data_scope").$type<string[]>().notNull().default([]),
  previewUpgradeExplanationEn: text("preview_upgrade_explanation_en").notNull(),
  previewUpgradeExplanationEs: text("preview_upgrade_explanation_es").notNull(),
  effectiveFrom: utc("effective_from").notNull(),
  effectiveTo: utc("effective_to"),
  deprecatedAt: utc("deprecated_at"),
  replacementFeatureKey: text("replacement_feature_key"),
  deprecationExplanationEn: text("deprecation_explanation_en"),
  deprecationExplanationEs: text("deprecation_explanation_es"),
  contractOverrideMode: text("contract_override_mode").notNull().default("restrict_only"),
  capabilityDependencies: jsonb("capability_dependencies").$type<string[]>().notNull().default([]),
  commercialAuthority: text("commercial_authority").notNull().default("none"),
  preferenceKey: text("preference_key"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("feature_catalog_versions_key_version_uidx").on(t.featureKey, t.version),
  index("feature_catalog_versions_effective_idx").on(t.featureKey, t.effectiveFrom, t.effectiveTo),
  check("feature_catalog_versions_status_chk", sql`${t.capabilityStatus} in ('available','preview','coming_later','suspended','deprecated')`),
  check("feature_catalog_versions_ai_chk", sql`${t.aiClassification} in ('non_ai','deterministic_automation','text_ai','file_reading_ai','proactive_ai')`),
  check("feature_catalog_versions_contract_chk", sql`${t.contractOverrideMode} in ('none','restrict_only','grant_and_restrict')`),
  check("feature_catalog_versions_commercial_chk", sql`${t.commercialAuthority} in ('none','tier','addon','tier_or_addon')`),
]);

export const featureCatalogActivationsTable = pgTable("feature_catalog_activations", {
  id: text("id").primaryKey(),
  catalogVersionId: text("catalog_version_id").notNull().references(() => featureCatalogVersionsTable.id),
  activatedById: integer("activated_by_id").references(() => usersTable.id),
  activatedAt: utc("activated_at").defaultNow().notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [uniqueIndex("feature_catalog_activations_version_uidx").on(t.catalogVersionId)]);

export const platformCapabilityVersionsTable = pgTable("platform_capability_versions", {
  id: text("id").primaryKey(),
  featureKey: text("feature_key").notNull(),
  version: integer("version").notNull(),
  capabilityStatus: text("capability_status").notNull(),
  reasonCode: text("reason_code").notNull(),
  explanationEn: text("explanation_en").notNull(),
  explanationEs: text("explanation_es").notNull(),
  effectiveFrom: utc("effective_from").notNull(),
  effectiveTo: utc("effective_to"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: utc("created_at").defaultNow().notNull(),
  auditEvidence: jsonb("audit_evidence").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [
  uniqueIndex("platform_capability_versions_key_version_uidx").on(t.featureKey, t.version),
  index("platform_capability_versions_effective_idx").on(t.featureKey, t.effectiveFrom, t.effectiveTo),
  check("platform_capability_versions_status_chk", sql`${t.capabilityStatus} in ('available','preview','coming_later','suspended','deprecated')`),
]);

export const featureCatalogAuditTable = pgTable("feature_catalog_audit", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  featureKey: text("feature_key").notNull(),
  version: integer("version").notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: utc("created_at").defaultNow().notNull(),
}, (t) => [index("feature_catalog_audit_feature_created_idx").on(t.featureKey, t.createdAt)]);

export type FeatureCatalogVersion = typeof featureCatalogVersionsTable.$inferSelect;
