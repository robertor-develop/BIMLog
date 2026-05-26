import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const clashReportsTable = pgTable("clash_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id).notNull(),
  fileName: text("file_name").notNull(),
  format: text("format").notNull(),
  totalClashes: integer("total_clashes").default(0),
  p1Count: integer("p1_count").default(0),
  p2Count: integer("p2_count").default(0),
  p3Count: integer("p3_count").default(0),
  p4Count: integer("p4_count").default(0),
  status: text("status").default("processing"),
  aiSummary: text("ai_summary"),
  reportNumber: text("report_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clashesTable = pgTable("clashes", {
  id: serial("id").primaryKey(),
  clashReportId: integer("clash_report_id").references(() => clashReportsTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  clashIdOriginal: text("clash_id_original"),
  description: text("description"),
  element1: text("element_1"),
  element2: text("element_2"),
  discipline1: text("discipline_1"),
  discipline2: text("discipline_2"),
  gridLocation: text("grid_location"),
  level: text("level"),
  clashType: text("clash_type"),
  priority: text("priority"),
  priorityReason: text("priority_reason"),
  status: text("status").default("open"),
  assignedToName: text("assigned_to_name"),
  assignedToEmail: text("assigned_to_email"),
  linkedRfiId: integer("linked_rfi_id"),
  resolutionNotes: text("resolution_notes"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),
});
