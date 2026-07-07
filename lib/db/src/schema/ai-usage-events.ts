import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
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
});

export type AiUsageEvent = typeof aiUsageEventsTable.$inferSelect;
