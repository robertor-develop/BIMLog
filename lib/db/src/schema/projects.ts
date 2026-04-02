import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  code: text("code").notNull(),
  status: text("status").notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  entryType: text("entry_type").default("fresh_start"),
  clientName: text("client_name"),
  clientCompany: text("client_company"),
  location: text("location"),
  contractValue: text("contract_value"),
  startDate: timestamp("start_date"),
  expectedEndDate: timestamp("expected_end_date"),
  projectType: text("project_type"),
});

export const projectMembersTable = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  role: text("role").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  permissionsOverride: jsonb("permissions_override"),
  status: text("status").default("active"),
});

export type Project = typeof projectsTable.$inferSelect;
export type ProjectMember = typeof projectMembersTable.$inferSelect;
