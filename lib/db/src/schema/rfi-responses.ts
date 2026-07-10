import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { rfisTable } from "./rfis";
import { projectsTable } from "./projects";

export const rfiResponsesTable = pgTable("rfi_responses", {
  id: serial("id").primaryKey(),
  rfiId: integer("rfi_id").notNull().references(() => rfisTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  responseNumber: integer("response_number").notNull().default(1),
  responseText: text("response_text").notNull(),
  answeredBy: text("answered_by"),
  answeredByEmail: text("answered_by_email"),
  answeredByCompany: text("answered_by_company"),
  costImpact: text("cost_impact"),
  costImpactAmount: text("cost_impact_amount"),
  costImpactReason: text("cost_impact_reason"),
  scheduleImpact: text("schedule_impact"),
  scheduleImpactDays: integer("schedule_impact_days"),
  scheduleImpactReason: text("schedule_impact_reason"),
  isConflictOfInterest: boolean("is_conflict_of_interest").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RfiResponse = typeof rfiResponsesTable.$inferSelect;
