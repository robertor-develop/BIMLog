import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const aiUsageEventsTable = pgTable("ai_usage_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(),
  billingMode: text("billing_mode").notNull(),
  estimatedUnits: integer("estimated_units").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("ai_usage_events_user_created_idx").on(table.userId, table.createdAt),
  projectCreatedIdx: index("ai_usage_events_project_created_idx").on(table.projectId, table.createdAt),
}));

export type AiUsageEvent = typeof aiUsageEventsTable.$inferSelect;
