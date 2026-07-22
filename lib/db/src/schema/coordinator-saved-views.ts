import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const coordinatorSavedViewsTable = pgTable(
  "coordinator_saved_views",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull(),
    configurationFingerprint: text("configuration_fingerprint").notNull(),
    version: integer("version").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    ownerProjectIndex: index("coordinator_saved_views_owner_project_idx").on(
      table.userId,
      table.projectId,
      table.updatedAt,
    ),
    stableIdentity: uniqueIndex("coordinator_saved_views_identity_uidx").on(
      table.id,
      table.projectId,
      table.userId,
    ),
  }),
);

export const coordinatorSavedViewOperationsTable = pgTable(
  "coordinator_saved_view_operations",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    savedViewId: text("saved_view_id").references(() => coordinatorSavedViewsTable.id),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultVersion: integer("result_version").notNull(),
    resultState: text("result_state").notNull(),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("coordinator_saved_view_operations_idempotency_uidx").on(
      table.userId,
      table.projectId,
      table.idempotencyKey,
    ),
    viewHistoryIndex: index("coordinator_saved_view_operations_view_idx").on(
      table.savedViewId,
      table.createdAt,
    ),
  }),
);

export type CoordinatorSavedView = typeof coordinatorSavedViewsTable.$inferSelect;
export type CoordinatorSavedViewOperation =
  typeof coordinatorSavedViewOperationsTable.$inferSelect;
