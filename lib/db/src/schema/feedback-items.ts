import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const feedbackItemsTable = pgTable("feedback_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  feedbackType: text("feedback_type").notNull(),
  priority: text("priority").default("normal").notNull(),
  module: text("module"),
  pageUrl: text("page_url").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  statusCreatedIdx: index("feedback_items_status_created_idx").on(table.status, table.createdAt.desc()),
  userCreatedIdx: index("feedback_items_user_created_idx").on(table.userId, table.createdAt.desc()),
  projectCreatedIdx: index("feedback_items_project_created_idx").on(table.projectId, table.createdAt.desc()),
}));

export type FeedbackItem = typeof feedbackItemsTable.$inferSelect;
