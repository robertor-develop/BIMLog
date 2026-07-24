import {
  boolean,
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
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const coordinatorSavedViewsTable = pgTable(
  "coordinator_saved_views",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    userId: integer("user_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull(),
    configurationFingerprint: text("configuration_fingerprint").notNull(),
    version: integer("version").default(1).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    ownerProjectIndex: index("coordinator_saved_views_owner_project_idx").on(
      table.userId,
      table.projectId,
      table.updatedAt.desc(),
    ),
    stableIdentity: uniqueIndex("coordinator_saved_views_identity_uidx").on(
      table.id,
      table.projectId,
      table.userId,
    ),
    activeName: uniqueIndex("coordinator_saved_views_active_name_uidx")
      .on(table.userId, table.projectId, table.normalizedName)
      .where(sql`${table.deletedAt} IS NULL`),
    activeConfig: uniqueIndex("coordinator_saved_views_active_config_uidx")
      .on(table.userId, table.projectId, table.configurationFingerprint)
      .where(sql`${table.deletedAt} IS NULL`),
    defaultView: uniqueIndex("coordinator_saved_views_default_uidx")
      .on(table.userId, table.projectId)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isDefault} = true`),
    projectForeignKey: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projectsTable.id],
      name: "coordinator_saved_views_project_id_fkey",
    }),
    userForeignKey: foreignKey({
      columns: [table.userId],
      foreignColumns: [usersTable.id],
      name: "coordinator_saved_views_user_id_fkey",
    }),
    versionCheck: check(
      "coordinator_saved_views_version_check",
      sql`${table.version} > 0`,
    ),
    nameLengthCheck: check(
      "coordinator_saved_views_name_length_chk",
      sql`char_length(${table.name}) BETWEEN 1 AND 64`,
    ),
    normalizedNameLengthCheck: check(
      "coordinator_saved_views_normalized_name_length_chk",
      sql`char_length(${table.normalizedName}) BETWEEN 1 AND 64`,
    ),
    configurationSizeCheck: check(
      "coordinator_saved_views_configuration_size_chk",
      sql`octet_length(${table.configuration}::text) <= 4096`,
    ),
  }),
);

export const coordinatorSavedViewOperationsTable = pgTable(
  "coordinator_saved_view_operations",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    userId: integer("user_id").notNull(),
    savedViewId: text("saved_view_id"),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultVersion: integer("result_version").notNull(),
    resultState: text("result_state").notNull(),
    resultSnapshot: jsonb("result_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex(
      "coordinator_saved_view_operations_idempotency_uidx",
    ).on(table.userId, table.projectId, table.idempotencyKey),
    viewHistoryIndex: index("coordinator_saved_view_operations_view_idx").on(
      table.savedViewId,
      table.createdAt.desc(),
    ),
    projectForeignKey: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projectsTable.id],
      name: "coordinator_saved_view_operations_project_id_fkey",
    }),
    userForeignKey: foreignKey({
      columns: [table.userId],
      foreignColumns: [usersTable.id],
      name: "coordinator_saved_view_operations_user_id_fkey",
    }),
    savedViewForeignKey: foreignKey({
      columns: [table.savedViewId],
      foreignColumns: [coordinatorSavedViewsTable.id],
      name: "coordinator_saved_view_operations_saved_view_id_fkey",
    }),
    resultVersionCheck: check(
      "coordinator_saved_view_operations_result_version_check",
      sql`${table.resultVersion} > 0`,
    ),
    operationCheck: check(
      "coordinator_saved_view_operation_chk",
      sql`${table.operation} IN ('create','update','delete')`,
    ),
    stateCheck: check(
      "coordinator_saved_view_operation_state_chk",
      sql`${table.resultState} IN ('active','deleted')`,
    ),
    keyLengthCheck: check(
      "coordinator_saved_view_operation_key_length_chk",
      sql`char_length(${table.idempotencyKey}) BETWEEN 8 AND 100`,
    ),
  }),
);

export type CoordinatorSavedView =
  typeof coordinatorSavedViewsTable.$inferSelect;
export type CoordinatorSavedViewOperation =
  typeof coordinatorSavedViewOperationsTable.$inferSelect;
