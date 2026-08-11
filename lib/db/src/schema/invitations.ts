import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./users";

export const projectInvitations = pgTable("project_invitations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  invitedByUserId: integer("invited_by_user_id").notNull(),
  companyId: integer("company_id").references(() => companiesTable.id),
  email: text("email").notNull(),
  fullName: text("full_name"),
  companyName: text("company_name"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
}, (table) => [
  index("project_invitation_email_status_idx").on(table.email, table.status),
  index("project_invitation_project_status_idx").on(table.projectId, table.status),
]);
