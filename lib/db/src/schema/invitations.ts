import { foreignKey, index, uniqueIndex, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

export const projectInvitations = pgTable("project_invitations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  invitedByUserId: integer("invited_by_user_id").notNull(),
  companyId: integer("company_id"),
  email: text("email").notNull(),
  fullName: text("full_name"),
  companyName: text("company_name"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  purpose: text("purpose").notNull().default("legacy"),
  tokenHash: text("token_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  acceptedByUserId: integer("accepted_by_user_id"),
  deliveryStatus: text("delivery_status").notNull().default("not_sent"),
}, (table) => [
  index("project_invitation_email_status_idx").on(table.email, table.status),
  index("project_invitation_project_status_idx").on(table.projectId, table.status),
  uniqueIndex("project_invitation_token_hash_idx").on(table.tokenHash),
  foreignKey({ name: "project_invitations_project_id_fkey", columns: [table.projectId], foreignColumns: [projectsTable.id] }),
  foreignKey({ name: "project_invitations_invited_by_user_id_fkey", columns: [table.invitedByUserId], foreignColumns: [usersTable.id] }),
  foreignKey({ name: "project_invitations_company_id_fkey", columns: [table.companyId], foreignColumns: [companiesTable.id] }),
]);
