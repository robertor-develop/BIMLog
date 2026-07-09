import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
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
});

export type FeedbackItem = typeof feedbackItemsTable.$inferSelect;
