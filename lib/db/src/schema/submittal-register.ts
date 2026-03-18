import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const submittalRegisterTable = pgTable("submittal_register", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  specSection: text("spec_section").notNull(),
  description: text("description").notNull(),
  trade: text("trade"),
  submittalType: text("submittal_type"),
  requiredByDate: date("required_by_date"),
  leadTimeDays: integer("lead_time_days"),
  responsibleCompany: text("responsible_company"),
  status: text("status").default("pending"),
  dateCreated: timestamp("date_created").defaultNow(),
});

export type SubmittalRegisterItem = typeof submittalRegisterTable.$inferSelect;
