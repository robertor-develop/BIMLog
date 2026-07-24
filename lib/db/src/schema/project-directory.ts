import {
  foreignKey,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

export const projectDirectoryTable = pgTable(
  "project_directory",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    companyName: text("company_name"),
    companyId: integer("company_id"),
    role: text("role").notNull(),
    bimlogStatus: text("bimlog_status").default("none"),
    notes: text("notes"),
    addedById: integer("added_by_id").references(() => usersTable.id),
    linkedUserId: integer("linked_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.companyId],
      foreignColumns: [companiesTable.id],
      name: "project_directory_company_id_fkey",
    }),
    index("project_directory_company_idx").on(table.projectId, table.companyId),
  ],
);

export type ProjectDirectoryEntry = typeof projectDirectoryTable.$inferSelect;
