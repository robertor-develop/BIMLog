import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const submittalsTable = pgTable("submittals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  specSection: text("spec_section"),
  submittalType: text("submittal_type").notNull(),
  submittedById: integer("submitted_by_id").references(() => usersTable.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Submittal = typeof submittalsTable.$inferSelect;
