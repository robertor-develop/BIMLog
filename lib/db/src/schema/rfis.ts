import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const rfisTable = pgTable("rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  dueDate: timestamp("due_date"),
  respondedAt: timestamp("responded_at"),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Rfi = typeof rfisTable.$inferSelect;
