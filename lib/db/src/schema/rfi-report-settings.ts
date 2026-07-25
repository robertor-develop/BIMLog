import {
  foreignKey,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export type RfiReportSettingsDocument = {
  schemaVersion: 1;
  preset: "default" | "lean";
  emptyFieldMode: "not_recorded" | "hide_empty";
  sections: Array<{
    id: string;
    visible: boolean;
    order: number;
    fields: Array<{ id: string; visible: boolean; order: number }>;
  }>;
};

export const rfiReportSettingsTable = pgTable(
  "rfi_report_settings",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    version: integer("version").notNull().default(1),
    settings: jsonb("settings").$type<RfiReportSettingsDocument>().notNull(),
    createdById: integer("created_by_id").notNull(),
    updatedById: integer("updated_by_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectUnique: uniqueIndex("rfi_report_settings_project_uidx").on(
      table.projectId,
    ),
    projectForeignKey: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projectsTable.id],
      name: "rfi_report_settings_project_id_fkey",
    }),
    createdByForeignKey: foreignKey({
      columns: [table.createdById],
      foreignColumns: [usersTable.id],
      name: "rfi_report_settings_created_by_id_fkey",
    }),
    updatedByForeignKey: foreignKey({
      columns: [table.updatedById],
      foreignColumns: [usersTable.id],
      name: "rfi_report_settings_updated_by_id_fkey",
    }),
  }),
);

export type RfiReportSettings = typeof rfiReportSettingsTable.$inferSelect;
