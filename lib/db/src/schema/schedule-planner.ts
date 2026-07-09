import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const scheduleBucketsTable = pgTable("schedule_buckets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  name: text("name").notNull(),
  bucketType: text("bucket_type").default("custom").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectNameUnique: uniqueIndex("schedule_buckets_project_name_uidx").on(table.projectId, table.name),
}));

export const scheduleItemPlacementsTable = pgTable("schedule_item_placements", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id").notNull(),
  bucketId: integer("bucket_id").references(() => scheduleBucketsTable.id),
  rolloverCount: integer("rollover_count").default(0).notNull(),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  itemUnique: uniqueIndex("schedule_item_placements_item_uidx").on(table.projectId, table.sourceType, table.sourceId),
}));

export const scheduleRolloverHistoryTable = pgTable("schedule_rollover_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id").notNull(),
  fromBucketId: integer("from_bucket_id").references(() => scheduleBucketsTable.id),
  fromBucketName: text("from_bucket_name").notNull(),
  toBucketId: integer("to_bucket_id").references(() => scheduleBucketsTable.id),
  toBucketName: text("to_bucket_name").notNull(),
  movedById: integer("moved_by_id").references(() => usersTable.id),
  movedByName: text("moved_by_name"),
  movedAt: timestamp("moved_at").defaultNow().notNull(),
});

export type ScheduleBucket = typeof scheduleBucketsTable.$inferSelect;
export type ScheduleItemPlacement = typeof scheduleItemPlacementsTable.$inferSelect;
export type ScheduleRolloverHistory = typeof scheduleRolloverHistoryTable.$inferSelect;
