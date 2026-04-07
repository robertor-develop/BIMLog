import { pgTable, serial, text, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const namingConventionsTable = pgTable("naming_conventions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull().unique(),
  separator: text("separator").notNull(),
  enforceUppercase: boolean("enforce_uppercase").notNull().default(true),
  applyCharLimits: boolean("apply_char_limits").notNull().default(false),
  companyCode: text("company_code").default(""),
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
  userGuidance: text("user_guidance"),
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

export const namingConventionVersionsTable = pgTable("naming_convention_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  conventionVersion: integer("convention_version").notNull(),
  acceptedDisciplines: json("accepted_disciplines").$type<Array<{ code: string; label: string }>>().notNull().default([]),
  acceptedSystems: json("accepted_systems").$type<Array<{ code: string; label: string }>>().notNull().default([]),
  acceptedDocTypes: json("accepted_doc_types").$type<Array<{ code: string; label: string }>>().notNull().default([]),
  acceptedExtraFields: json("accepted_extra_fields").$type<Array<{ key: string; label: string }>>().notNull().default([]),
  acceptedFieldOrder: json("accepted_field_order").$type<string[]>().notNull().default([]),
  analysisSummary: text("analysis_summary"),
  ambiguities: json("ambiguities").$type<string[]>().notNull().default([]),
  userNotes: text("user_notes"),
  changeSummary: text("change_summary"),
  userGuidance: text("user_guidance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id),
});

export type NamingConvention = typeof namingConventionsTable.$inferSelect;
export type NamingField = typeof namingFieldsTable.$inferSelect;
export type NamingConventionVersion = typeof namingConventionVersionsTable.$inferSelect;
