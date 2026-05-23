import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const submittalReportsTable = pgTable("submittal_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id).notNull(),
  fileName: text("file_name").notNull(),
  format: text("format").notNull().default("manual"),
  totalItems: integer("total_items").default(0),
  status: text("status").default("complete"),
  aiSummary: text("ai_summary"),
  reportNumber: text("report_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const submittalItemsTable = pgTable("submittal_items", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => submittalReportsTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  trade: text("trade"),
  submittalType: text("submittal_type"),
  floor: text("floor"),
  fileName: text("file_name"),
  revision: text("revision"),
  version: text("version"),
  submittalStatus: text("submittal_status"),
  date: text("date"),
  description: text("description"),
  openItems: text("open_items"),
  rfiOpen: text("rfi_open"),
  rfiClose: text("rfi_close"),
  rfiDescription: text("rfi_description"),
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
