import { pgTable, serial, text, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const namingConventionsTable = pgTable("naming_conventions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull().unique(),
  separator: text("separator").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  setupContext: text("setup_context"),
  projectEnvironment: text("project_environment"),
  builderIntent: text("builder_intent"),
  scopeType: text("scope_type"),
  scopeDetails: json("scope_details").$type<Record<string, string>>(),
  levelsRelevant: boolean("levels_relevant"),
  primaryStructure: text("primary_structure"),
  availableInputs: json("available_inputs").$type<Record<string, boolean>>(),
  analysisOnlyMode: boolean("analysis_only_mode").default(false),
  conventionVersion: integer("convention_version").default(1),
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
