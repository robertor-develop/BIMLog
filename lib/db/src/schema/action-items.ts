import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { meetingMinutesTable } from "./meeting-minutes";

export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  description: text("description").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  assignedToExternalEmail: text("assigned_to_external_email"),
  assignedToName: text("assigned_to_name"),
  dueDate: timestamp("due_date"),
  status: text("status").default("open").notNull(),
  linkedRfiId: integer("linked_rfi_id"),
  linkedSubmittalId: integer("linked_submittal_id"),
  linkedFileId: integer("linked_file_id"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ActionItem = typeof actionItemsTable.$inferSelect;
