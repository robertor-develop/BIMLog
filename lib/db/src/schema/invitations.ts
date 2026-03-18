import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const projectInvitations = pgTable("project_invitations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  invitedByUserId: integer("invited_by_user_id").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  companyName: text("company_name"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});
