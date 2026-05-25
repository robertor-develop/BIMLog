import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const agentInsightsTable = pgTable("agent_insights", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  agentType: text("agent_type").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  insightType: text("insight_type").notNull(),
  message: text("message").notNull(),
  recommendation: text("recommendation"),
  severity: text("severity").default("info"),
  isRead: boolean("is_read").default(false),
  isActioned: boolean("is_actioned").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentInsight = typeof agentInsightsTable.$inferSelect;
