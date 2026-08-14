import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

export const teamCapacityProfileVersionsTable = pgTable(
  "team_capacity_profile_versions",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    userId: integer("user_id").notNull(),
    version: integer("version").notNull(),
    content: jsonb("content").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_capacity_profile_user_version_uidx").on(table.companyId, table.userId, table.version),
    index("team_capacity_profile_latest_idx").on(table.companyId, table.userId, table.version.desc().nullsFirst()),
    foreignKey({ name: "team_capacity_profile_versions_company_id_fkey", columns: [table.companyId], foreignColumns: [companiesTable.id] }),
    foreignKey({ name: "team_capacity_profile_versions_user_id_fkey", columns: [table.userId], foreignColumns: [usersTable.id] }),
    foreignKey({ name: "team_capacity_profile_versions_supersedes_id_fkey", columns: [table.supersedesId], foreignColumns: [table.id] }),
    foreignKey({ name: "team_capacity_profile_versions_created_by_id_fkey", columns: [table.createdById], foreignColumns: [usersTable.id] }),
    check("team_capacity_profile_version_positive_chk", sql`${table.version} > 0`),
    check("team_capacity_profile_content_object_chk", sql`jsonb_typeof(${table.content}) = 'object'`),
  ],
);

export const teamStaffingScenarioVersionsTable = pgTable(
  "team_staffing_scenario_versions",
  {
    id: text("id").primaryKey(),
    scenarioKey: text("scenario_key").notNull(),
    companyId: integer("company_id").notNull(),
    projectId: integer("project_id").notNull(),
    version: integer("version").notNull(),
    content: jsonb("content").notNull(),
    evaluation: jsonb("evaluation").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    supersedesId: text("supersedes_id"),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_staffing_scenario_key_version_uidx").on(table.scenarioKey, table.version),
    index("team_staffing_scenario_project_latest_idx").on(table.projectId, table.createdAt.desc().nullsFirst()),
    foreignKey({ name: "team_staffing_scenario_versions_company_id_fkey", columns: [table.companyId], foreignColumns: [companiesTable.id] }),
    foreignKey({ name: "team_staffing_scenario_versions_project_id_fkey", columns: [table.projectId], foreignColumns: [projectsTable.id] }),
    foreignKey({ name: "team_staffing_scenario_versions_supersedes_id_fkey", columns: [table.supersedesId], foreignColumns: [table.id] }),
    foreignKey({ name: "team_staffing_scenario_versions_created_by_id_fkey", columns: [table.createdById], foreignColumns: [usersTable.id] }),
    check("team_staffing_scenario_version_positive_chk", sql`${table.version} > 0`),
    check("team_staffing_scenario_content_object_chk", sql`jsonb_typeof(${table.content}) = 'object'`),
    check("team_staffing_scenario_evaluation_object_chk", sql`jsonb_typeof(${table.evaluation}) = 'object'`),
  ],
);

export const teamStaffingApplicationEventsTable = pgTable(
  "team_staffing_application_events",
  {
    id: text("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    scenarioVersionId: text("scenario_version_id").notNull(),
    projectId: integer("project_id").notNull(),
    actorUserId: integer("actor_user_id").notNull(),
    reason: text("reason").notNull(),
    result: jsonb("result").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_staffing_application_events_event_key_key").on(table.eventKey),
    index("team_staffing_application_project_time_idx").on(table.projectId, table.occurredAt.desc().nullsFirst()),
    foreignKey({ name: "team_staffing_application_events_scenario_version_id_fkey", columns: [table.scenarioVersionId], foreignColumns: [teamStaffingScenarioVersionsTable.id] }),
    foreignKey({ name: "team_staffing_application_events_project_id_fkey", columns: [table.projectId], foreignColumns: [projectsTable.id] }),
    foreignKey({ name: "team_staffing_application_events_actor_user_id_fkey", columns: [table.actorUserId], foreignColumns: [usersTable.id] }),
    check("team_staffing_application_reason_chk", sql`length(${table.reason}) BETWEEN 10 AND 1000`),
  ],
);
