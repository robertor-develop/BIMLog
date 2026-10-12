import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const launchConfigurationsTable = pgTable("launch_configurations", {
  id: text("id").primaryKey(),
  environment: text("environment").notNull(),
  revision: integer("revision").notNull().default(1),
  state: text("state").notNull().default("draft"),
  configuration: jsonb("configuration").notNull(),
  readiness: jsonb("readiness").notNull(),
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id),
  updatedByUserId: integer("updated_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("launch_configurations_environment_chk", sql`${table.environment} in ('development','staging','production')`),
  check("launch_configurations_state_chk", sql`${table.state} in ('draft','validated','active','inactive')`),
  check("launch_configurations_revision_chk", sql`${table.revision} > 0`),
  uniqueIndex("launch_configurations_environment_uidx").on(table.environment),
]);

export const launchConfigurationVersionsTable = pgTable("launch_configuration_versions", {
  id: text("id").primaryKey(),
  configurationId: text("configuration_id").notNull().references(() => launchConfigurationsTable.id),
  environment: text("environment").notNull(),
  revision: integer("revision").notNull(),
  state: text("state").notNull(),
  configuration: jsonb("configuration").notNull(),
  readiness: jsonb("readiness").notNull(),
  reason: text("reason").notNull(),
  actorUserId: integer("actor_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("launch_configuration_versions_revision_chk", sql`${table.revision} > 0`),
  uniqueIndex("launch_configuration_versions_revision_uidx").on(table.configurationId, table.revision),
]);

export const launchConfigurationAuditTable = pgTable("launch_configuration_audit", {
  id: text("id").primaryKey(),
  configurationId: text("configuration_id").notNull().references(() => launchConfigurationsTable.id),
  environment: text("environment").notNull(),
  revision: integer("revision").notNull(),
  action: text("action").notNull(),
  actorUserId: integer("actor_user_id").notNull().references(() => usersTable.id),
  reason: text("reason").notNull(),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("launch_configuration_audit_action_chk", sql`${table.action} in ('created','updated','activated','deactivated','restored')`),
  check("launch_configuration_audit_revision_chk", sql`${table.revision} > 0`),
]);

export type LaunchConfigurationRecord = typeof launchConfigurationsTable.$inferSelect;
export type LaunchConfigurationVersion = typeof launchConfigurationVersionsTable.$inferSelect;
export type LaunchConfigurationAuditEntry = typeof launchConfigurationAuditTable.$inferSelect;

export const launchEmailVerificationAuditTable = pgTable("launch_email_verification_audit", {
  id: text("id").primaryKey(), configurationId: text("configuration_id").notNull().references(() => launchConfigurationsTable.id),
  environment: text("environment").notNull(), revision: integer("revision").notNull(), provider: text("provider").notNull(),
  action: text("action").notNull(), status: text("status").notNull(), resultCode: text("result_code").notNull(),
  actorUserId: integer("actor_user_id").notNull().references(() => usersTable.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("launch_email_verification_audit_revision_chk", sql`${table.revision} > 0`)]);
