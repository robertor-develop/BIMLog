import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const projectMilestonesTable = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  title: text("title").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").default("pending").notNull(),
  linkedModule: text("linked_module"),
  linkedId: integer("linked_id"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectMilestone = typeof projectMilestonesTable.$inferSelect;
