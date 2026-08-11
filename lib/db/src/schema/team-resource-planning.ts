import { pgTable, text, integer, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const teamCapacityProfileVersionsTable = pgTable("team_capacity_profile_versions", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull(), userId: integer("user_id").references(() => usersTable.id).notNull(),
  version: integer("version").notNull(), content: jsonb("content").notNull(), contentFingerprint: text("content_fingerprint").notNull(),
  supersedesId: text("supersedes_id"), createdById: integer("created_by_id").references(() => usersTable.id).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => ({ userVersion: uniqueIndex("team_capacity_profile_user_version_uidx").on(table.companyId, table.userId, table.version), latest: index("team_capacity_profile_latest_idx").on(table.companyId, table.userId, table.version) }));

export const teamStaffingScenarioVersionsTable = pgTable("team_staffing_scenario_versions", {
  id: text("id").primaryKey(), scenarioKey: text("scenario_key").notNull(), companyId: integer("company_id").notNull(), projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  version: integer("version").notNull(), content: jsonb("content").notNull(), evaluation: jsonb("evaluation").notNull(), contentFingerprint: text("content_fingerprint").notNull(),
  supersedesId: text("supersedes_id"), createdById: integer("created_by_id").references(() => usersTable.id).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => ({ scenarioVersion: uniqueIndex("team_staffing_scenario_key_version_uidx").on(table.scenarioKey, table.version), projectLatest: index("team_staffing_scenario_project_latest_idx").on(table.projectId, table.createdAt) }));

export const teamStaffingApplicationEventsTable = pgTable("team_staffing_application_events", {
  id: text("id").primaryKey(), eventKey: text("event_key").notNull(), scenarioVersionId: text("scenario_version_id").references(() => teamStaffingScenarioVersionsTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(), actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
  reason: text("reason").notNull(), result: jsonb("result").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, table => ({ eventKey: uniqueIndex("team_staffing_application_event_key_uidx").on(table.eventKey), projectTime: index("team_staffing_application_project_time_idx").on(table.projectId, table.occurredAt) }));
