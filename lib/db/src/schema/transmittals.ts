import { pgTable, serial, text, timestamp, integer, boolean, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { filesTable } from "./files";

export const transmittalsTable = pgTable("transmittals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  purpose: text("purpose"),
  sentById: integer("sent_by_id").references(() => usersTable.id).notNull(),
  sentTo: jsonb("sent_to"),
  status: text("status").default("draft").notNull(),
  companyLogoUrl: text("company_logo_url"),
  aiDraftUsed: boolean("ai_draft_used").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),
});

export const transmittalItemsTable = pgTable("transmittal_items", {
  id: serial("id").primaryKey(),
  transmittalId: integer("transmittal_id").references(() => transmittalsTable.id).notNull(),
  fileId: integer("file_id").references(() => filesTable.id),
  description: text("description"),
  revision: text("revision"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Transmittal = typeof transmittalsTable.$inferSelect;
export type TransmittalItem = typeof transmittalItemsTable.$inferSelect;
