import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const linkedItemsTable = pgTable("linked_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  fromType: text("from_type").notNull(),
  fromId: integer("from_id").notNull(),
  toType: text("to_type").notNull(),
  toId: integer("to_id").notNull(),
  linkType: text("link_type").notNull().default("related"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LinkedItem = typeof linkedItemsTable.$inferSelect;
