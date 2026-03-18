import { pgTable, serial, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id).notNull(),
  extractedText: text("extracted_text"),
  fileMetadata: json("file_metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectFile = typeof filesTable.$inferSelect;
