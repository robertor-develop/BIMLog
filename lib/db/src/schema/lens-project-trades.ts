import { pgTable, serial, text, integer, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const lensProjectTradesTable = pgTable("lens_project_trades", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectNameUnique: unique("lens_project_trades_project_name_unique").on(table.projectId, table.normalizedName),
  nameLength: check("lens_project_trades_name_length", sql`char_length(${table.name}) BETWEEN 2 AND 80`),
}));

export type LensProjectTrade = typeof lensProjectTradesTable.$inferSelect;
