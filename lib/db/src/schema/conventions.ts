import { pgTable, serial, text, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const namingConventionsTable = pgTable("naming_conventions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull().unique(),
  separator: text("separator").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const namingFieldsTable = pgTable("naming_fields", {
  id: serial("id").primaryKey(),
  conventionId: integer("convention_id").references(() => namingConventionsTable.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  fieldOrder: integer("field_order").notNull(),
  allowedValues: json("allowed_values").$type<string[]>().notNull().default([]),
});

export type NamingConvention = typeof namingConventionsTable.$inferSelect;
export type NamingField = typeof namingFieldsTable.$inferSelect;
